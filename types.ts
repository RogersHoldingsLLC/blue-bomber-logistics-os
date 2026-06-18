export type CompanyStatus = "prospect" | "customer";

export type AccountTab = "all" | "prospects" | "customers" | "carriers";

export type TaskStatus = "open" | "in_progress" | "waiting" | "completed" | "cancelled" | "overdue";

export type TaskEntityType = "prospect" | "customer" | "carrier";

export type Contact = {
  id: string;
  companyId: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  lastContact?: string;
  source?: string;
  createdBy?: string;
  confidence?: "High" | "Medium" | "Low";
};

export type Task = {
  id: string;
  companyId: string;
  entityId?: string;
  entityType?: TaskEntityType;
  title: string;
  due: string;
  priority: "critical" | "high" | "normal" | "low";
  status: TaskStatus;
  createdAt: string;
  owner: string;
  createdBy: string;
  sourceCompany: string;
  sourceNote: string;
  completedAt?: string;
};

export type TimelineEntry = {
  id: string;
  companyId: string;
  at: string;
  body: string;
  createdAt: string;
};

export type AccountFile = {
  id: string;
  accountId: string;
  accountType: "company" | "carrier";
  name: string;
  path: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
};

export type Company = {
  id: string;
  name: string;
  status: CompanyStatus;
  city: string;
  state: string;
  segment: string;
  currentOpportunity: string;
  smartNotes: string;
  qualifyingQuestions: Record<string, string>;
  salesLead: string;
  operationsLead: string;
  primaryContactId: string;
  lastContact: string;
  lastActivity: string;
  active: boolean;
};

export type Carrier = {
  id: string;
  name: string;
  city: string;
  state: string;
  equipment: string;
};
