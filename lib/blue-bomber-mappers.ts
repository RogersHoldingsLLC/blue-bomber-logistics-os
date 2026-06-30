import type { CommunicationLog, Company, Task } from "@/types";

type SheetRow = Record<string, unknown>;

function text(row: SheetRow, key: string, fallback = "") {
  return String(row[key] ?? fallback).trim();
}

function normalizeStatus(value: string): Company["status"] {
  const status = value.toLowerCase();

  if (status === "customer") return "customer";
  if (status === "inactive") return "inactive";

  return "prospect";
}

function normalizePriority(value: string): Task["priority"] {
  const priority = value.toLowerCase();

  if (priority === "critical") return "critical";
  if (priority === "high") return "high";
  if (priority === "low") return "low";

  return "normal";
}

function normalizeTaskStatus(value: string): Task["status"] {
  const status = value.toLowerCase();

  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  if (status === "waiting") return "waiting";
  if (status === "in progress" || status === "in_progress") return "in_progress";
  if (status === "overdue") return "overdue";

  return "open";
}

export function mapCompanyFromSheet(row: SheetRow): Company {
  return {
    id: text(row, "Company ID"),
    name: text(row, "Legal Name") || text(row, "Company Name") || text(row, "DBA Name"),
    status: normalizeStatus(text(row, "Status")),
    city: text(row, "City, State ZIP") || text(row, "City") || "Not set",
    state: text(row, "State") || "Prospect",
    segment: text(row, "Industry") || "Transportation",
    currentOpportunity: text(row, "Notes") || "New prospect. Add freight notes after first contact.",
    smartNotes: text(row, "Notes"),
    qualifyingQuestions: {},
    salesLead: "Louie",
    operationsLead: "Brian",
    primaryContactId: "",
    lastContact: text(row, "Last Update") || "Not set",
    lastActivity: text(row, "Last Updated By") || "Not set",
    active: text(row, "Status") !== "Inactive"
  };
}

export function mapTaskFromSheet(row: SheetRow): Task {
  return {
    id: text(row, "Task ID"),
    companyId: text(row, "Company ID") || text(row, "Related Record ID"),
    entityId: text(row, "Related Record ID"),
    entityType: "company",
    title: text(row, "Task Title") || text(row, "Task Type") || "Follow up",
    due: text(row, "Due Date") || "Today",
    priority: normalizePriority(text(row, "Priority")),
    status: normalizeTaskStatus(text(row, "Status")),
    createdAt: text(row, "Created Date") || new Date().toISOString(),
    owner: text(row, "Assigned To") || "Brian",
    createdBy: text(row, "Created By") || "Blue Bomber Platform",
    sourceCompany: text(row, "Company ID"),
    sourceNote: text(row, "Task Description"),
    completedAt: text(row, "Completed Date") || undefined
  };
}

export function mapActivityFromSheet(row: SheetRow): CommunicationLog {
  return {
    id: text(row, "Activity ID"),
    entityId: text(row, "Related Record ID") || text(row, "Company ID"),
    entityType: "company",
    direction: "sent",
    subject: text(row, "Activity Type"),
    contactOrEmail: text(row, "Notes"),
    occurredAt: text(row, "Timestamp") || new Date().toISOString(),
    summary: text(row, "Activity Description"),
    followUpNeeded: false,
    followUpActionText: "",
    followUpDueDate: "",
    source: "Gmail Operations",
    createdAt: text(row, "Timestamp") || new Date().toISOString(),
    createdBy: text(row, "Performed By") || "Blue Bomber Platform"
  };
}