import { NextResponse } from "next/server";

export const runtime = "nodejs";

type SummaryRequest = {
  company?: {
    name?: string;
    status?: string;
    city?: string;
    state?: string;
    segment?: string;
    currentOpportunity?: string;
    lastContact?: string;
    lastActivity?: string;
  };
  contacts?: Array<{
    name?: string;
    role?: string;
    email?: string;
    phone?: string;
    lastContact?: string;
  }>;
  qualifyingQuestions?: Record<string, string>;
  timeline?: Array<{
    title?: string;
    detail?: string;
    createdAt?: string;
  }>;
  openTasks?: Array<{
    title?: string;
    due?: string;
    owner?: string;
    priority?: string;
    sourceNote?: string;
  }>;
  completedTasks?: Array<{
    title?: string;
    completedAt?: string;
    owner?: string;
  }>;
  fallbackSummary?: string[];
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "AI summary refresh is not configured. Add OPENAI_API_KEY to enable it."
      },
      { status: 503 }
    );
  }

  const body = (await request.json()) as SummaryRequest;
  const model = process.env.OPENAI_SUMMARY_MODEL || "gpt-4.1-mini";
  const prompt = buildPrompt(body);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You write concise logistics account summaries. Return only valid JSON shaped as {\"bullets\":[\"...\"]}. Use 4 to 6 short bullet strings. Do not invent facts."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error: data?.error?.message || "AI summary refresh failed."
        },
        { status: response.status }
      );
    }

    const content = data?.choices?.[0]?.message?.content;
    const parsed = parseSummaryContent(content);

    if (!parsed.length) {
      return NextResponse.json(
        {
          error: "AI summary refresh did not return usable summary bullets."
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ bullets: parsed });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AI summary refresh failed."
      },
      { status: 500 }
    );
  }
}

function buildPrompt(body: SummaryRequest) {
  return JSON.stringify(
    {
      instructions: [
        "Summarize the account intelligence for a freight operations user.",
        "Use only facts in the provided data.",
        "Prioritize contacts, notes, open actions, completed actions, qualifying question answers, and freight opportunity.",
        "Keep each bullet short, direct, and useful for a call or follow-up.",
        "Return 4 to 6 bullet strings."
      ],
      account: body.company ?? {},
      contacts: (body.contacts ?? []).slice(0, 8),
      louiesQualifyingQuestions: body.qualifyingQuestions ?? {},
      recentTimelineNotes: (body.timeline ?? []).slice(0, 12),
      openActions: (body.openTasks ?? []).slice(0, 10),
      completedActions: (body.completedTasks ?? []).slice(0, 8),
      currentFallbackSummary: body.fallbackSummary ?? []
    },
    null,
    2
  );
}

function parseSummaryContent(content: unknown) {
  if (typeof content !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(content) as { bullets?: unknown };

    if (!Array.isArray(parsed.bullets)) {
      return [];
    }

    return parsed.bullets
      .filter((bullet): bullet is string => typeof bullet === "string")
      .map((bullet) => bullet.replace(/^[-•]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 6);
  } catch {
    return [];
  }
}
