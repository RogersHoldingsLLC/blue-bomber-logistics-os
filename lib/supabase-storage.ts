import { supabase } from "@/lib/supabase";
import type { StoredBlueBomberState } from "@/lib/storage";
import { createUuid } from "@/lib/uuid";
import type { AccountFile, Carrier, CommunicationLog, Company, Contact, Task, TimelineEntry } from "@/types";

export const FILE_BUCKET = "blue-bomber-files";

type CompanyRow = {
  id: string;
  name: string;
  status: Company["status"];
  city: string | null;
  state: string | null;
  segment: string | null;
  current_opportunity: string | null;
  smart_notes: string | null;
  qualifying_questions: Company["qualifyingQuestions"];
  sales_lead: string;
  operations_lead: string;
  primary_contact_id: string | null;
  last_contact: string | null;
  last_activity: string | null;
  active: boolean;
};

type CarrierRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  equipment: string | null;
};

type ContactRow = {
  id: string;
  company_id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  last_contact: string | null;
};

type TaskRow = {
  id: string;
  company_id: string | null;
  carrier_id?: string | null;
  entity_id?: string | null;
  entity_type?: Task["entityType"];
  title: string;
  due: string | null;
  priority: Task["priority"];
  status: Task["status"] | "done";
  owner: string;
  created_by: string;
  source_company: string;
  source_note: string;
  completed_at: string | null;
  created_at: string;
};

type TimelineRow = {
  id: string;
  company_id: string;
  at?: string;
  body: string;
  occurred_at: string;
  created_at: string;
};

type CommunicationLogRow = {
  id: string;
  company_id: string | null;
  carrier_id: string | null;
  entity_id: string;
  entity_type: CommunicationLog["entityType"];
  direction: CommunicationLog["direction"];
  subject: string;
  contact_or_email: string | null;
  occurred_at: string;
  summary: string | null;
  follow_up_needed: boolean;
  follow_up_action_text: string | null;
  follow_up_due_date: string | null;
  source: CommunicationLog["source"];
  created_by: string;
  created_at: string;
};

export function canUseSupabase() {
  return Boolean(supabase);
}

export async function loadSupabaseState() {
  if (!supabase) {
    return null;
  }

  const [companiesResult, contactsResult, tasksResult, timelineResult, carriersResult] =
    await Promise.all([
      supabase.from("companies").select("*").order("created_at", { ascending: true }),
      supabase.from("contacts").select("*").order("created_at", { ascending: true }),
      supabase.from("tasks").select("*").order("created_at", { ascending: true }),
      supabase.from("timeline").select("*").order("created_at", { ascending: false }),
      supabase.from("carriers").select("*").order("created_at", { ascending: true })
    ]);

  const error =
    companiesResult.error ||
    contactsResult.error ||
    tasksResult.error ||
    timelineResult.error ||
    carriersResult.error;

  if (error) {
    console.error("[Blue Bomber Supabase] load from Supabase failed:", formatSupabaseError(error));
    throw error;
  }

  const companyRows = (companiesResult.data ?? []) as CompanyRow[];
  const carrierRows = (carriersResult.data ?? []) as CarrierRow[];

  return {
    companies: companyRows.map(fromCompanyRow),
    contacts: ((contactsResult.data ?? []) as ContactRow[]).map(fromContactRow),
    tasks: ((tasksResult.data ?? []) as TaskRow[]).map(fromTaskRow),
    timeline: ((timelineResult.data ?? []) as TimelineRow[]).map(fromTimelineRow),
    carriers: carrierRows.map(fromCarrierRow),
    communicationLogs: await loadSupabaseCommunicationLogs(),
    files: await loadSupabaseAccountFiles([
      ...companyRows.map((company) => ({ accountId: company.id, accountType: "company" as const })),
      ...carrierRows.map((carrier) => ({ accountId: carrier.id, accountType: "carrier" as const }))
    ])
  };
}

export async function saveSupabaseState(state: StoredBlueBomberState) {
  if (!supabase) {
    console.warn("[Blue Bomber Supabase] save skipped: client unavailable");
    return false;
  }

  const companies = state.companies.map(toCompanyRow);
  const carriers = state.carriers.map(toCarrierRow);
  const contacts = state.contacts.map(toContactRow);
  const companyTasks = state.tasks
    .filter((task) => task.entityType !== "carrier")
    .map(toTaskRow);
  const carrierTasks = state.tasks
    .filter((task) => task.entityType === "carrier")
    .map(toCarrierTaskRow);
  const timeline = state.timeline.map(toTimelineRow);
  const communicationLogs = (state.communicationLogs ?? []).map(toCommunicationLogRow);

  const companyResult = companies.length
    ? await supabase.from("companies").upsert(companies, { onConflict: "id" })
    : { error: null };

  if (companyResult.error) {
    console.error(
      "[Blue Bomber Supabase] save to Supabase failed at companies:",
      formatSupabaseError(companyResult.error)
    );
    throw companyResult.error;
  }

  const carrierResult = carriers.length
    ? await supabase.from("carriers").upsert(carriers, { onConflict: "id" })
    : { error: null };

  if (carrierResult.error) {
    console.error(
      "[Blue Bomber Supabase] save to Supabase failed at carriers:",
      formatSupabaseError(carrierResult.error)
    );
    throw carrierResult.error;
  }

  const contactResult = contacts.length
    ? await supabase.from("contacts").upsert(contacts, { onConflict: "id" })
    : { error: null };

  if (contactResult.error) {
    console.error(
      "[Blue Bomber Supabase] save to Supabase failed at contacts:",
      formatSupabaseError(contactResult.error)
    );
    throw contactResult.error;
  }

  const taskResult = companyTasks.length
    ? await supabase.from("tasks").upsert(companyTasks, { onConflict: "id" })
    : { error: null };

  if (taskResult.error) {
    console.error("[Blue Bomber Supabase] save to Supabase failed at tasks:", formatSupabaseError(taskResult.error));
    throw taskResult.error;
  }

  if (carrierTasks.length) {
    const carrierTaskResult = await supabase.from("tasks").upsert(carrierTasks, { onConflict: "id" });

    if (carrierTaskResult.error) {
      console.error(
        "[Blue Bomber Supabase] save to Supabase failed at carrier tasks:",
        formatSupabaseError(carrierTaskResult.error)
      );
      throw carrierTaskResult.error;
    }
  }

  const timelineResult = timeline.length
    ? await supabase.from("timeline").upsert(timeline, { onConflict: "id" })
    : { error: null };

  if (timelineResult.error) {
    console.error(
      "[Blue Bomber Supabase] save to Supabase failed at timeline:",
      formatSupabaseError(timelineResult.error)
    );
    throw timelineResult.error;
  }

  const communicationResult = communicationLogs.length
    ? await supabase.from("communication_logs").upsert(communicationLogs, { onConflict: "id" })
    : { error: null };

  if (communicationResult.error) {
    console.error(
      "[Blue Bomber Supabase] save to Supabase failed at communication logs:",
      formatSupabaseError(communicationResult.error)
    );
    throw communicationResult.error;
  }

  console.log("[Blue Bomber Supabase] save to Supabase success");

  return true;
}

export async function uploadSupabaseAccountFile({
  accountId,
  accountType,
  file,
  uploadedBy
}: {
  accountId: string;
  accountType: AccountFile["accountType"];
  file: File;
  uploadedBy: string;
}) {
  if (!supabase) {
    throw new Error("Supabase Storage is not configured.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${accountType}/${accountId}/${createUuid()}-${safeName}`;
  const result = await supabase.storage.from(FILE_BUCKET).upload(path, file, {
    upsert: false,
    metadata: {
      accountId,
      accountType,
      originalName: file.name,
      uploadedBy
    }
  });

  if (result.error) {
    console.error("[Blue Bomber Storage] upload failed:", formatSupabaseError(result.error));
    throw new Error(
      `File upload failed. Confirm Supabase Storage bucket "${FILE_BUCKET}" exists and allows uploads. ${result.error.message}`
    );
  }

  console.log("[Blue Bomber Storage] upload success:", path);

  return {
    id: path,
    accountId,
    accountType,
    name: file.name,
    path,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy
  } satisfies AccountFile;
}

export async function createSupabaseAccountFileSignedUrl(file: AccountFile, download = false) {
  if (!supabase) {
    throw new Error("Supabase Storage is not configured.");
  }

  const signedUrlResult = await supabase.storage.from(FILE_BUCKET).createSignedUrl(
    file.path,
    60 * 60,
    download
      ? {
          download: file.name
        }
      : undefined
  );

  if (signedUrlResult.error || !signedUrlResult.data?.signedUrl) {
    console.error(
      "[Blue Bomber Storage] signed URL failed:",
      signedUrlResult.error ? formatSupabaseError(signedUrlResult.error) : "No signed URL returned"
    );
    throw new Error("Could not open file. Check Supabase Storage read policy.");
  }

  console.log("[Blue Bomber Storage] signed URL created:", file.path);

  return signedUrlResult.data.signedUrl;
}

export async function deleteSupabaseCompany(companyId: string) {
  if (!supabase) {
    return false;
  }

  const result = await supabase.from("companies").delete().eq("id", companyId);

  if (result.error) {
    console.error(
      "[Blue Bomber Supabase] delete company failed:",
      formatSupabaseError(result.error)
    );
    throw result.error;
  }

  return true;
}

export async function deleteSupabaseCompanies(companyIds: string[]) {
  if (!supabase) {
    return false;
  }

  if (!companyIds.length) {
    return true;
  }

  const result = await supabase.from("companies").delete().in("id", companyIds);

  if (result.error) {
    console.error(
      "[Blue Bomber Supabase] bulk delete companies failed:",
      formatSupabaseError(result.error)
    );
    throw result.error;
  }

  return true;
}

export async function importSupabaseProspects(companies: Company[], contacts: Contact[]) {
  if (!supabase) {
    return false;
  }

  const companyRows = companies.map(toCompanyRow);
  const contactRows = contacts.map(toContactRow);

  const companyResult = companyRows.length
    ? await supabase.from("companies").insert(companyRows)
    : { error: null };

  if (companyResult.error) {
    console.error(
      "[Blue Bomber Supabase] import prospects failed at companies:",
      formatSupabaseError(companyResult.error)
    );
    throw companyResult.error;
  }

  const contactResult = contactRows.length
    ? await supabase.from("contacts").insert(contactRows)
    : { error: null };

  if (contactResult.error) {
    console.error(
      "[Blue Bomber Supabase] import prospects failed at contacts:",
      formatSupabaseError(contactResult.error)
    );
    throw contactResult.error;
  }

  return true;
}

async function loadSupabaseCommunicationLogs() {
  if (!supabase) {
    return [];
  }

  const result = await supabase.from("communication_logs").select("*").order("occurred_at", { ascending: false });

  if (result.error) {
    console.warn("[Blue Bomber Supabase] communication logs unavailable:", formatSupabaseError(result.error));
    return [];
  }

  return ((result.data ?? []) as CommunicationLogRow[]).map(fromCommunicationLogRow);
}

async function loadSupabaseAccountFiles(accounts: Array<Pick<AccountFile, "accountId" | "accountType">>) {
  if (!supabase || !accounts.length) {
    return [];
  }

  const storageClient = supabase.storage.from(FILE_BUCKET);
  const fileGroups = await Promise.all(
    accounts.map(async ({ accountId, accountType }) => {
      const prefix = `${accountType}/${accountId}`;
      const result = await storageClient.list(prefix, {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" }
      });

      if (result.error) {
        console.error("[Blue Bomber Storage] file list failed:", formatSupabaseError(result.error));
        return [];
      }

      return (result.data ?? [])
        .filter((file) => file.name)
        .map((file) => {
          const path = `${prefix}/${file.name}`;

          return {
            id: path,
            accountId,
            accountType,
            name: displayFileName(file.name),
            path,
            size: getStorageFileSize(file.metadata),
            uploadedAt: file.created_at ?? file.updated_at ?? new Date(0).toISOString(),
            uploadedBy: ""
          } satisfies AccountFile;
        });
    })
  );

  return fileGroups.flat().sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
}

function displayFileName(storageName: string) {
  return storageName.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, "");
}

function getStorageFileSize(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return 0;
  }

  const size = (metadata as { size?: unknown }).size;

  return typeof size === "number" ? size : 0;
}

function toCompanyRow(company: Company): CompanyRow {
  return {
    id: company.id,
    name: company.name,
    status: company.status,
    city: company.city || null,
    state: company.state || null,
    segment: company.segment || null,
    current_opportunity: company.currentOpportunity || null,
    smart_notes: company.smartNotes,
    qualifying_questions: company.qualifyingQuestions,
    sales_lead: company.salesLead,
    operations_lead: company.operationsLead,
    primary_contact_id: company.primaryContactId || null,
    last_contact: company.lastContact || null,
    last_activity: company.lastActivity || null,
    active: company.active
  };
}

function fromCompanyRow(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    city: row.city ?? "",
    state: row.state ?? "",
    segment: row.segment ?? "",
    currentOpportunity: row.current_opportunity ?? "",
    smartNotes: row.smart_notes ?? "",
    qualifyingQuestions: row.qualifying_questions ?? {},
    salesLead: row.sales_lead,
    operationsLead: row.operations_lead,
    primaryContactId: row.primary_contact_id ?? "",
    lastContact: row.last_contact ?? "",
    lastActivity: row.last_activity ?? "",
    active: row.active
  };
}

function toCarrierRow(carrier: Carrier): CarrierRow {
  return {
    id: carrier.id,
    name: carrier.name,
    city: carrier.city || null,
    state: carrier.state || null,
    equipment: carrier.equipment || null
  };
}

function fromCarrierRow(row: CarrierRow): Carrier {
  return {
    id: row.id,
    name: row.name,
    city: row.city ?? "",
    state: row.state ?? "",
    equipment: row.equipment ?? ""
  };
}

function toContactRow(contact: Contact): ContactRow {
  return {
    id: contact.id,
    company_id: contact.companyId,
    name: contact.name,
    role: contact.role || null,
    email: contact.email || null,
    phone: contact.phone || null,
    last_contact: contact.lastContact ?? null
  };
}

function fromContactRow(row: ContactRow): Contact {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    role: row.role ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    lastContact: row.last_contact ?? undefined
  };
}

function toTaskRow(task: Task): TaskRow {
  return {
    id: task.id,
    company_id: task.companyId,
    title: task.title,
    due: task.due || null,
    priority: task.priority,
    status: task.status,
    owner: task.owner,
    created_by: task.createdBy,
    source_company: task.sourceCompany,
    source_note: task.sourceNote,
    completed_at: task.completedAt ?? null,
    created_at: task.createdAt
  };
}

function toCarrierTaskRow(task: Task): TaskRow {
  return {
    id: task.id,
    company_id: null,
    carrier_id: task.entityId ?? task.companyId,
    entity_id: task.entityId ?? task.companyId,
    entity_type: "carrier",
    title: task.title,
    due: task.due || null,
    priority: task.priority,
    status: task.status,
    owner: task.owner,
    created_by: task.createdBy,
    source_company: task.sourceCompany,
    source_note: task.sourceNote,
    completed_at: task.completedAt ?? null,
    created_at: task.createdAt
  };
}

function fromTaskRow(row: TaskRow): Task {
  const entityType = row.entity_type;
  const entityId = row.entity_id ?? row.carrier_id ?? row.company_id ?? "";

  return {
    id: row.id,
    companyId: entityId,
    entityId,
    entityType,
    title: row.title,
    due: row.due ?? "",
    priority: row.priority,
    status: normalizeTaskStatus(row.status),
    createdAt: row.created_at,
    owner: row.owner,
    createdBy: row.created_by,
    sourceCompany: row.source_company,
    sourceNote: row.source_note,
    completedAt: row.completed_at ?? undefined
  };
}

function toCommunicationLogRow(log: CommunicationLog): CommunicationLogRow {
  return {
    id: log.id,
    company_id: log.entityType === "carrier" ? null : log.entityId,
    carrier_id: log.entityType === "carrier" ? log.entityId : null,
    entity_id: log.entityId,
    entity_type: log.entityType,
    direction: log.direction,
    subject: log.subject,
    contact_or_email: log.contactOrEmail || null,
    occurred_at: log.occurredAt,
    summary: log.summary || null,
    follow_up_needed: log.followUpNeeded,
    follow_up_action_text: log.followUpActionText || null,
    follow_up_due_date: log.followUpDueDate || null,
    source: log.source,
    created_by: log.createdBy,
    created_at: log.createdAt
  };
}

function fromCommunicationLogRow(row: CommunicationLogRow): CommunicationLog {
  return {
    id: row.id,
    entityId: row.entity_id ?? row.carrier_id ?? row.company_id ?? "",
    entityType: row.entity_type,
    direction: row.direction,
    subject: row.subject,
    contactOrEmail: row.contact_or_email ?? "",
    occurredAt: row.occurred_at,
    summary: row.summary ?? "",
    followUpNeeded: row.follow_up_needed,
    followUpActionText: row.follow_up_action_text ?? "",
    followUpDueDate: row.follow_up_due_date ?? "",
    source: row.source,
    createdAt: row.created_at,
    createdBy: row.created_by
  };
}

function toTimelineRow(entry: TimelineEntry): TimelineRow {
  return {
    id: entry.id,
    company_id: entry.companyId,
    body: entry.body,
    occurred_at: entry.createdAt,
    created_at: entry.createdAt
  };
}

function fromTimelineRow(row: TimelineRow): TimelineEntry {
  return {
    id: row.id,
    companyId: row.company_id,
    at: row.at ?? "Today",
    body: row.body,
    createdAt: row.created_at
  };
}

function formatSupabaseError(error: { message?: string; code?: string; details?: string; hint?: string }) {
  return {
    message: error.message ?? "Unknown Supabase error",
    code: error.code,
    details: error.details,
    hint: error.hint
  };
}

function normalizeTaskStatus(status: TaskRow["status"]): Task["status"] {
  return status === "done" ? "completed" : status;
}
