import { supabase } from "@/lib/supabase";
import type { StoredBlueBomberState } from "@/lib/storage";
import type { Carrier, Company, Contact, Task, TimelineEntry } from "@/types";

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
  company_id: string;
  title: string;
  due: string | null;
  priority: Task["priority"];
  status: Task["status"];
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

export function canUseSupabase() {
  return Boolean(supabase);
}

export async function loadSupabaseState() {
  if (!supabase) {
    console.log("[Blue Bomber Supabase] load skipped: client unavailable");
    return null;
  }

  console.log("[Blue Bomber Supabase] load from Supabase started");

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

  console.log("[Blue Bomber Supabase] load from Supabase success:", {
    companies: companyRows.length,
    contacts: contactsResult.data?.length ?? 0,
    tasks: tasksResult.data?.length ?? 0,
    timeline: timelineResult.data?.length ?? 0,
    carriers: carriersResult.data?.length ?? 0
  });

  return {
    companies: companyRows.map(fromCompanyRow),
    contacts: ((contactsResult.data ?? []) as ContactRow[]).map(fromContactRow),
    tasks: ((tasksResult.data ?? []) as TaskRow[]).map(fromTaskRow),
    timeline: ((timelineResult.data ?? []) as TimelineRow[]).map(fromTimelineRow),
    carriers: ((carriersResult.data ?? []) as CarrierRow[]).map(fromCarrierRow)
  };
}

export async function saveSupabaseState(state: StoredBlueBomberState) {
  if (!supabase) {
    console.log("[Blue Bomber Supabase] save skipped: client unavailable");
    return false;
  }

  console.log("[Blue Bomber Supabase] save to Supabase started:", {
    companies: state.companies.length,
    contacts: state.contacts.length,
    tasks: state.tasks.length,
    timeline: state.timeline.length,
    carriers: state.carriers.length
  });

  const companies = state.companies.map(toCompanyRow);
  const carriers = state.carriers.map(toCarrierRow);
  const contacts = state.contacts.map(toContactRow);
  const tasks = state.tasks.map(toTaskRow);
  const timeline = state.timeline.map(toTimelineRow);

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

  const taskResult = tasks.length
    ? await supabase.from("tasks").upsert(tasks, { onConflict: "id" })
    : { error: null };

  if (taskResult.error) {
    console.error("[Blue Bomber Supabase] save to Supabase failed at tasks:", formatSupabaseError(taskResult.error));
    throw taskResult.error;
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

  console.log("[Blue Bomber Supabase] save to Supabase success");

  return true;
}

export async function deleteSupabaseCompany(companyId: string) {
  if (!supabase) {
    console.log("[Blue Bomber Supabase] delete skipped: client unavailable");
    return false;
  }

  console.log("[Blue Bomber Supabase] delete company started:", companyId);

  const result = await supabase.from("companies").delete().eq("id", companyId);

  if (result.error) {
    console.error(
      "[Blue Bomber Supabase] delete company failed:",
      formatSupabaseError(result.error)
    );
    throw result.error;
  }

  console.log("[Blue Bomber Supabase] delete company success:", companyId);

  return true;
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

function fromTaskRow(row: TaskRow): Task {
  return {
    id: row.id,
    companyId: row.company_id,
    title: row.title,
    due: row.due ?? "",
    priority: row.priority,
    status: row.status,
    createdAt: row.created_at,
    owner: row.owner,
    createdBy: row.created_by,
    sourceCompany: row.source_company,
    sourceNote: row.source_note,
    completedAt: row.completed_at ?? undefined
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
