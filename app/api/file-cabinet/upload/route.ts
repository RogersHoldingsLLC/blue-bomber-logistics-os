import { Buffer } from "node:buffer";
import { createSign } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { FILE_BUCKET } from "@/lib/supabase-storage";
import { createUuid } from "@/lib/uuid";
import type { AccountFile, AccountFileCategory } from "@/types";

export const runtime = "nodejs";

const folderMimeType = "application/vnd.google-apps.folder";
const companyCategories: AccountFileCategory[] = ["BOLs", "PODs", "Rate Confirmations", "COIs", "Invoices", "Misc"];
const carrierCategories: AccountFileCategory[] = ["COIs", "W9s", "NOAs", "Carrier Packets", "Misc"];

type UploadContext = {
  accountId: string;
  accountType: AccountFile["accountType"];
  accountName: string;
  accountStatus: "prospect" | "customer" | "carrier";
  category: AccountFileCategory;
  uploadedBy: string;
};

type DriveFileResult = {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  webViewLink?: string;
  webContentLink?: string;
  parents?: string[];
};

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "No file provided." }, { status: 400 });
  }

  const context = parseUploadContext(formData);
  const driveConfigured = isGoogleDriveConfigured();
  const fallbackEnabled = process.env.GOOGLE_DRIVE_FALLBACK_TO_SUPABASE === "true";

  if (driveConfigured) {
    try {
      const uploadedFile = await uploadGoogleDriveFile(file, context);
      await upsertAccountFile(uploadedFile);
      return Response.json({ file: uploadedFile });
    } catch (error) {
      console.error("[Blue Bomber Drive] upload failed:", error instanceof Error ? error.message : error);

      if (!fallbackEnabled) {
        return Response.json(
          { error: "Google Drive upload failed and Supabase fallback is disabled." },
          { status: 500 }
        );
      }
    }
  }

  if (!fallbackEnabled) {
    return Response.json(
      { error: "Google Drive is not configured and Supabase fallback is disabled." },
      { status: 503 }
    );
  }

  try {
    const fallbackFile = await uploadSupabaseFallback(file, context);

    try {
      await upsertAccountFile(fallbackFile);
    } catch (metadataError) {
      console.warn(
        "[Blue Bomber Files] fallback metadata save skipped:",
        metadataError instanceof Error ? metadataError.message : metadataError
      );
    }

    return Response.json({ file: fallbackFile, fallback: true });
  } catch (error) {
    console.error("[Blue Bomber Files] fallback upload failed:", error instanceof Error ? error.message : error);
    return Response.json(
      { error: "File upload failed. Google Drive is unavailable and Supabase Storage fallback failed." },
      { status: 500 }
    );
  }
}

function parseUploadContext(formData: FormData): UploadContext {
  const accountType = formData.get("accountType") === "carrier" ? "carrier" : "company";
  const accountStatusValue = String(formData.get("accountStatus") ?? "prospect").toLowerCase();
  const accountStatus = accountType === "carrier"
    ? "carrier"
    : accountStatusValue === "customer"
      ? "customer"
      : "prospect";
  const allowedCategories = accountType === "carrier" ? carrierCategories : companyCategories;
  const rawCategory = String(formData.get("category") ?? "Misc") as AccountFileCategory;
  const category = allowedCategories.includes(rawCategory) ? rawCategory : "Misc";

  return {
    accountId: String(formData.get("accountId") ?? ""),
    accountType,
    accountName: String(formData.get("accountName") ?? "").trim() || "Unknown Account",
    accountStatus,
    category,
    uploadedBy: String(formData.get("uploadedBy") ?? "System").trim() || "System"
  };
}

async function uploadGoogleDriveFile(file: File, context: UploadContext): Promise<AccountFile> {
  const accessToken = await getGoogleAccessToken();
  const rootFolderId = await getRootFolderId(accessToken);
  const bucketFolder = await findOrCreateFolder(accessToken, getBucketFolderName(context), rootFolderId);
  const accountFolder = await findOrCreateFolder(accessToken, context.accountName, bucketFolder);
  const categoryFolder = await findOrCreateFolder(accessToken, context.category, accountFolder);
  const driveFile = await createDriveFile(accessToken, file, categoryFolder);

  return {
    id: driveFile.id,
    accountId: context.accountId,
    accountType: context.accountType,
    provider: "google_drive",
    category: context.category,
    name: driveFile.name || file.name,
    path: driveFile.id,
    size: Number(driveFile.size ?? file.size),
    mimeType: driveFile.mimeType || file.type || "application/octet-stream",
    uploadedAt: new Date().toISOString(),
    uploadedBy: context.uploadedBy,
    googleDriveFileId: driveFile.id,
    googleDriveFolderId: categoryFolder,
    googleDriveWebViewLink: driveFile.webViewLink,
    googleDriveWebContentLink: driveFile.webContentLink
  };
}

async function uploadSupabaseFallback(file: File, context: UploadContext): Promise<AccountFile> {
  const supabase = getServerSupabaseClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${context.accountType}/${context.accountId}/${createUuid()}-${safeName}`;
  const result = await supabase.storage.from(FILE_BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), {
    contentType: file.type || "application/octet-stream",
    upsert: false,
    metadata: {
      accountId: context.accountId,
      accountType: context.accountType,
      category: context.category,
      originalName: file.name,
      uploadedBy: context.uploadedBy
    }
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return {
    id: path,
    accountId: context.accountId,
    accountType: context.accountType,
    provider: "supabase_storage",
    category: context.category,
    name: file.name,
    path,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
    uploadedAt: new Date().toISOString(),
    uploadedBy: context.uploadedBy,
    supabaseStoragePath: path
  };
}

async function upsertAccountFile(file: AccountFile) {
  const supabase = getServerSupabaseClient();
  const result = await supabase.from("account_files").upsert(
    {
      id: file.id,
      company_id: file.accountType === "company" ? file.accountId : null,
      carrier_id: file.accountType === "carrier" ? file.accountId : null,
      account_id: file.accountId,
      account_type: file.accountType,
      provider: file.provider,
      file_name: file.name,
      mime_type: file.mimeType,
      size_bytes: file.size,
      category: file.category,
      google_drive_file_id: file.googleDriveFileId ?? null,
      google_drive_folder_id: file.googleDriveFolderId ?? null,
      google_drive_web_view_link: file.googleDriveWebViewLink ?? null,
      google_drive_web_content_link: file.googleDriveWebContentLink ?? null,
      supabase_storage_path: file.supabaseStoragePath ?? null,
      uploaded_by: file.uploadedBy,
      uploaded_at: file.uploadedAt
    },
    { onConflict: "id" }
  );

  if (result.error) {
    throw new Error(result.error.message);
  }
}

function getServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase server credentials are not configured.");
  }

  return createClient(url, key);
}

function isGoogleDriveConfigured() {
  return Boolean(process.env.GOOGLE_DRIVE_CLIENT_EMAIL && process.env.GOOGLE_DRIVE_PRIVATE_KEY);
}

async function getGoogleAccessToken() {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const impersonatedUser = process.env.GOOGLE_DRIVE_IMPERSONATED_USER || "operations@bluebomberlogistics.com";

  if (!clientEmail || !privateKey) {
    throw new Error("Google Drive is not configured.");
  }

  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt(
    {
      alg: "RS256",
      typ: "JWT"
    },
    {
      iss: clientEmail,
      sub: impersonatedUser,
      scope: "https://www.googleapis.com/auth/drive",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600
    },
    privateKey
  );
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const tokenPayload = (await tokenResponse.json()) as { access_token?: string; error_description?: string; error?: string };

  if (!tokenResponse.ok || !tokenPayload.access_token) {
    throw new Error(tokenPayload.error_description || tokenPayload.error || "Google token request failed.");
  }

  return tokenPayload.access_token;
}

function signJwt(header: Record<string, unknown>, payload: Record<string, unknown>, privateKey: string) {
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signer = createSign("RSA-SHA256");
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  signer.update(signingInput);
  signer.end();

  return `${signingInput}.${signer.sign(privateKey, "base64url")}`;
}

function base64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

async function getRootFolderId(accessToken: string) {
  if (process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID) {
    return process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  }

  return findOrCreateFolder(accessToken, process.env.GOOGLE_DRIVE_ROOT_NAME || "Blue Bomber OS", "root");
}

async function findOrCreateFolder(accessToken: string, name: string, parentId: string) {
  const escapedName = name.replace(/'/g, "\\'");
  const query = [
    "mimeType = '" + folderMimeType + "'",
    "name = '" + escapedName + "'",
    "'" + parentId + "' in parents",
    "trashed = false"
  ].join(" and ");
  const searchUrl = new URL("https://www.googleapis.com/drive/v3/files");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("fields", "files(id,name)");
  searchUrl.searchParams.set("supportsAllDrives", "true");
  searchUrl.searchParams.set("includeItemsFromAllDrives", "true");

  const searchResult = await driveFetch<{ files?: Array<{ id: string; name: string }> }>(accessToken, searchUrl.toString());
  const existingFolder = searchResult.files?.[0];

  if (existingFolder?.id) {
    return existingFolder.id;
  }

  const createResult = await driveFetch<{ id: string }>(accessToken, "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name,
      mimeType: folderMimeType,
      parents: [parentId]
    })
  });

  return createResult.id;
}

async function createDriveFile(accessToken: string, file: File, parentId: string): Promise<DriveFileResult> {
  const boundary = "blue-bomber-" + createUuid();
  const metadata = {
    name: file.name,
    parents: [parentId]
  };
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--`)
  ]);
  const uploadUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size,webViewLink,webContentLink,parents";

  return driveFetch<DriveFileResult>(accessToken, uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/related; boundary=${boundary}`
    },
    body
  });
}

async function driveFetch<T>(accessToken: string, url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...normalizeHeaders(init.headers)
    }
  });
  const payload = (await response.json()) as T & { error?: { message?: string } };

  if (!response.ok) {
    throw new Error(payload.error?.message || "Google Drive request failed.");
  }

  return payload as T;
}

function normalizeHeaders(headers: HeadersInit | undefined) {
  if (!headers) {
    return {};
  }

  return Object.fromEntries(new Headers(headers).entries());
}

function getBucketFolderName(context: UploadContext) {
  if (context.accountType === "carrier") {
    return "Carriers";
  }

  return context.accountStatus === "customer" ? "Customers" : "Prospects";
}
