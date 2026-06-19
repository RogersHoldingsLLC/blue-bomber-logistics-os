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

export type AccountFileProvider = "google_drive" | "supabase_storage";
export type AccountFileCategory =
  | "BOLs"
  | "PODs"
  | "Rate Confirmations"
  | "COIs"
  | "Invoices"
  | "W9s"
  | "NOAs"
  | "Carrier Packets"
  | "Misc";

export type AccountFile = {
  id: string;
  accountId: string;
  accountType: "company" | "carrier";
  provider: AccountFileProvider;
  category: AccountFileCategory;
  name: string;
  path: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy: string;
  googleDriveFileId?: string;
  googleDriveFolderId?: string;
  googleDriveWebViewLink?: string;
  googleDriveWebContentLink?: string;
  supabaseStoragePath?: string;
};

export type CommunicationLog = {
  id: string;
  entityId: string;
  entityType: TaskEntityType;
  direction: "sent" | "received";
  subject: string;
  contactOrEmail: string;
  occurredAt: string;
  summary: string;
  followUpNeeded: boolean;
  followUpActionText: string;
  followUpDueDate: string;
  source: "Outlook" | "Gmail Operations";
  createdAt: string;
  createdBy: string;
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
