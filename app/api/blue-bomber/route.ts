import { NextResponse } from "next/server";

type BlueBomberRequest = {
  action?: string;
  data?: Record<string, unknown>;
};

export async function POST(request: Request) {
  const appsScriptUrl = process.env.BBL_APPS_SCRIPT_URL;

  if (!appsScriptUrl) {
    return NextResponse.json(
      {
        success: false,
        message: "Missing BBL_APPS_SCRIPT_URL environment variable."
      },
      { status: 500 }
    );
  }

  let payload: BlueBomberRequest;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid JSON payload."
      },
      { status: 400 }
    );
  }

  if (!payload.action) {
    return NextResponse.json(
      {
        success: false,
        message: "Missing action."
      },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(appsScriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      cache: "no-store"
    });

    const responseText = await response.text();

    try {
      const json = JSON.parse(responseText);
      return NextResponse.json(json, { status: response.ok ? 200 : response.status });
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Apps Script returned a non-JSON response.",
          status: response.status,
          body: responseText
        },
        { status: 502 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Unable to reach Apps Script backend.",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 502 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Blue Bomber Vercel API proxy is online."
  });
}
