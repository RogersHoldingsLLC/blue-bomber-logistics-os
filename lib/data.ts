import type { AccountFile, Carrier, CommunicationLog, Company, Contact, Task, TimelineEntry } from "@/types";

export const qualifyingQuestions = [
  "What do they ship?",
  "Where do they ship?",
  "How often do they ship?",
  "Who handles freight decisions?",
  "What is the next opportunity?"
] as const;

export const companies: Company[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Hirata Corporation",
    status: "prospect",
    city: "New Hudson",
    state: "MI",
    segment: "Automotive manufacturing",
    currentOpportunity: "Quote production freight from Lexington, KY to New York, NY and evaluate recurring automotive parts lanes.",
    smartNotes: "Spoke with Cheri about the last load. Service was rough, but they have another shipment coming up and need clean BOL support.",
    salesLead: "Louie",
    operationsLead: "Brian",
    primaryContactId: "11111111-1111-4111-8111-111111111101",
    lastContact: "Today",
    lastActivity: "Today",
    active: true,
    qualifyingQuestions: {
      "What do they ship?": "Automotive parts, production equipment, and plant materials.",
      "Where do they ship?": "Michigan, Kentucky, New York, and supplier locations across the Midwest.",
      "How often do they ship?": "Several spot loads per month with potential weekly production freight.",
      "Who handles freight decisions?": "Cheri Parker coordinates traffic; Eric Boyd supports shipping decisions.",
      "What is the next opportunity?": "Quote Lexington to New York and prove follow-up reliability."
    }
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Gate Precast",
    status: "customer",
    city: "Winchester",
    state: "KY",
    segment: "Precast concrete",
    currentOpportunity: "Active flatbed and step deck support for Midwest project deliveries.",
    smartNotes: "Project team likes quick updates, clear POD follow-through, and early carrier confirmation before crane windows.",
    salesLead: "Louie",
    operationsLead: "Brian",
    primaryContactId: "22222222-2222-4222-8222-222222222201",
    lastContact: "Yesterday",
    lastActivity: "Yesterday",
    active: true,
    qualifyingQuestions: {
      "What do they ship?": "Precast wall panels, forms, and project materials.",
      "Where do they ship?": "Kentucky, Indiana, Ohio, Tennessee, and job sites across the Midwest.",
      "How often do they ship?": "Multiple loads per week during active projects.",
      "Who handles freight decisions?": "Megan Roberts manages logistics; Tom Harris coordinates job-site receiving.",
      "What is the next opportunity?": "Secure reliable flatbed capacity for the Indianapolis project schedule."
    }
  }
];

export const contacts: Contact[] = [
  {
    id: "11111111-1111-4111-8111-111111111101",
    companyId: "11111111-1111-4111-8111-111111111111",
    name: "Cheri Parker",
    role: "Traffic Manager",
    email: "cheri.parker@hirata.example",
    phone: "(248) 555-0148",
    lastContact: "Today",
    source: "Demo Data",
    createdBy: "Brian",
    confidence: "High"
  },
  {
    id: "11111111-1111-4111-8111-111111111102",
    companyId: "11111111-1111-4111-8111-111111111111",
    name: "Eric Boyd",
    role: "Shipping",
    email: "eric.boyd@hirata.example",
    phone: "(248) 555-0191",
    source: "Demo Data",
    createdBy: "Brian",
    confidence: "High"
  },
  {
    id: "11111111-1111-4111-8111-111111111103",
    companyId: "11111111-1111-4111-8111-111111111111",
    name: "Aaron Mills",
    role: "Receiving",
    email: "aaron.mills@hirata.example",
    phone: "(248) 555-0174",
    source: "Demo Data",
    createdBy: "Louie",
    confidence: "High"
  },
  {
    id: "22222222-2222-4222-8222-222222222201",
    companyId: "22222222-2222-4222-8222-222222222222",
    name: "Megan Roberts",
    role: "Logistics Coordinator",
    email: "megan.roberts@gateprecast.example",
    phone: "(859) 555-0119",
    lastContact: "Yesterday",
    source: "Demo Data",
    createdBy: "Louie",
    confidence: "High"
  },
  {
    id: "22222222-2222-4222-8222-222222222202",
    companyId: "22222222-2222-4222-8222-222222222222",
    name: "Tom Harris",
    role: "Project Manager",
    email: "tom.harris@gateprecast.example",
    phone: "(859) 555-0127",
    source: "Demo Data",
    createdBy: "Brian",
    confidence: "High"
  },
  {
    id: "22222222-2222-4222-8222-222222222203",
    companyId: "22222222-2222-4222-8222-222222222222",
    name: "Angela Reed",
    role: "Accounts Payable",
    email: "angela.reed@gateprecast.example",
    phone: "(859) 555-0165",
    source: "Demo Data",
    createdBy: "Louie",
    confidence: "High"
  }
];

export const tasks: Task[] = [
  {
    id: "44444444-4444-4444-8444-444444444401",
    companyId: "11111111-1111-4111-8111-111111111111",
    entityId: "11111111-1111-4111-8111-111111111111",
    entityType: "prospect",
    title: "Quote Load: Lexington KY to New York NY",
    due: "Today 10:00 AM",
    priority: "high",
    status: "open",
    createdAt: "2026-06-18T09:00:00.000Z",
    owner: "Louie",
    createdBy: "Louie",
    sourceCompany: "Hirata Corporation",
    sourceNote: "Need to quote load from Lexington KY to New York NY."
  },
  {
    id: "44444444-4444-4444-8444-444444444402",
    companyId: "11111111-1111-4111-8111-111111111111",
    entityId: "11111111-1111-4111-8111-111111111111",
    entityType: "prospect",
    title: "Make BOL for Cheri",
    due: "Today 2:00 PM",
    priority: "high",
    status: "open",
    createdAt: "2026-06-18T10:15:00.000Z",
    owner: "Louie",
    createdBy: "Louie",
    sourceCompany: "Hirata Corporation",
    sourceNote: "Need to make BOL for Cheri asap."
  },
  {
    id: "44444444-4444-4444-8444-444444444403",
    companyId: "22222222-2222-4222-8222-222222222222",
    entityId: "22222222-2222-4222-8222-222222222222",
    entityType: "customer",
    title: "Confirm Indianapolis flatbed capacity",
    due: "Today 11:30 AM",
    priority: "normal",
    status: "open",
    createdAt: "2026-06-18T08:20:00.000Z",
    owner: "Brian",
    createdBy: "Brian",
    sourceCompany: "Gate Precast",
    sourceNote: "Need carrier base for Indianapolis job-site deliveries."
  },
  {
    id: "44444444-4444-4444-8444-444444444404",
    companyId: "22222222-2222-4222-8222-222222222222",
    entityId: "22222222-2222-4222-8222-222222222222",
    entityType: "customer",
    title: "Send POD package to Megan",
    due: "Completed",
    priority: "normal",
    status: "completed",
    completedAt: "2026-06-18T15:40:00.000Z",
    createdAt: "2026-06-17T13:30:00.000Z",
    owner: "Louie",
    createdBy: "Louie",
    sourceCompany: "Gate Precast",
    sourceNote: "Megan requested POD package for last week's delivery."
  },
  {
    id: "44444444-4444-4444-8444-444444444405",
    companyId: "55555555-5555-4555-8555-555555555501",
    entityId: "55555555-5555-4555-8555-555555555501",
    entityType: "carrier",
    title: "Get Updated COI",
    due: "Today 3:00 PM",
    priority: "high",
    status: "open",
    createdAt: "2026-06-18T11:00:00.000Z",
    owner: "Brian",
    createdBy: "Brian",
    sourceCompany: "ABC Transport",
    sourceNote: "Need COI before assigning project freight."
  },
  {
    id: "44444444-4444-4444-8444-444444444406",
    companyId: "55555555-5555-4555-8555-555555555501",
    entityId: "55555555-5555-4555-8555-555555555501",
    entityType: "carrier",
    title: "Get W9",
    due: "Tomorrow",
    priority: "normal",
    status: "open",
    createdAt: "2026-06-18T11:10:00.000Z",
    owner: "Brian",
    createdBy: "Brian",
    sourceCompany: "ABC Transport",
    sourceNote: "Need W9 for carrier packet."
  }
];

export const carriers: Carrier[] = [
  {
    id: "55555555-5555-4555-8555-555555555501",
    name: "ABC Transport",
    city: "Indianapolis",
    state: "IN",
    equipment: "Dry van, flatbed, step deck | Packet pending COI and W9"
  }
];

export const timeline: TimelineEntry[] = [
  {
    id: "66666666-6666-4666-8666-666666666601",
    companyId: "11111111-1111-4111-8111-111111111111",
    at: "Today",
    body: "Spoke with Cheri Parker. Prior load had service issues, but Hirata is open to quoting the next Lexington to New York shipment.",
    createdAt: "2026-06-18T09:15:00.000Z"
  },
  {
    id: "66666666-6666-4666-8666-666666666602",
    companyId: "11111111-1111-4111-8111-111111111111",
    at: "Today",
    body: "Action Created: Make BOL for Cheri\nOwner: Louie\nDue: Today 2:00 PM",
    createdAt: "2026-06-18T10:15:00.000Z"
  },
  {
    id: "66666666-6666-4666-8666-666666666603",
    companyId: "22222222-2222-4222-8222-222222222222",
    at: "Yesterday",
    body: "Megan confirmed Gate Precast needs flatbed coverage for the Indianapolis project and wants proactive pickup updates.",
    createdAt: "2026-06-17T13:10:00.000Z"
  },
  {
    id: "66666666-6666-4666-8666-666666666604",
    companyId: "22222222-2222-4222-8222-222222222222",
    at: "Yesterday",
    body: "Action Completed: Send POD package to Megan\nCompleted by Louie\n06/18/2026 3:40 PM",
    createdAt: "2026-06-18T15:40:00.000Z"
  },
  {
    id: "66666666-6666-4666-8666-666666666605",
    companyId: "22222222-2222-4222-8222-222222222222",
    at: "Monday",
    body: "File Added: Gate Precast rate confirmation packet.",
    createdAt: "2026-06-16T12:00:00.000Z"
  }
];

export const communicationLogs: CommunicationLog[] = [
  {
    id: "77777777-7777-4777-8777-777777777701",
    entityId: "11111111-1111-4111-8111-111111111111",
    entityType: "prospect",
    direction: "received",
    subject: "Lexington to New York quote request",
    contactOrEmail: "Cheri Parker <cheri.parker@hirata.example>",
    occurredAt: "2026-06-18T09:30:00.000Z",
    summary: "Cheri asked for pricing and BOL support for the next load.",
    followUpNeeded: true,
    followUpActionText: "Quote Load: Lexington KY to New York NY",
    followUpDueDate: "Today",
    source: "Outlook",
    createdAt: "2026-06-18T09:32:00.000Z",
    createdBy: "Louie"
  },
  {
    id: "77777777-7777-4777-8777-777777777702",
    entityId: "22222222-2222-4222-8222-222222222222",
    entityType: "customer",
    direction: "sent",
    subject: "POD package and project update",
    contactOrEmail: "Megan Roberts <megan.roberts@gateprecast.example>",
    occurredAt: "2026-06-18T15:35:00.000Z",
    summary: "Sent POD package and confirmed next project freight schedule.",
    followUpNeeded: false,
    followUpActionText: "",
    followUpDueDate: "",
    source: "Outlook",
    createdAt: "2026-06-18T15:36:00.000Z",
    createdBy: "Louie"
  },
  {
    id: "77777777-7777-4777-8777-777777777703",
    entityId: "55555555-5555-4555-8555-555555555501",
    entityType: "carrier",
    direction: "received",
    subject: "Carrier packet documents",
    contactOrEmail: "dispatch@abctransport.example",
    occurredAt: "2026-06-18T11:20:00.000Z",
    summary: "ABC Transport sent packet details; COI and W9 still need to be collected.",
    followUpNeeded: true,
    followUpActionText: "Get Updated COI",
    followUpDueDate: "Today",
    source: "Gmail Operations",
    createdAt: "2026-06-18T11:25:00.000Z",
    createdBy: "Brian"
  }
];

export const files: AccountFile[] = [
  {
    id: "demo-gate-rate-confirmation",
    accountId: "22222222-2222-4222-8222-222222222222",
    accountType: "company",
    provider: "google_drive",
    category: "Rate Confirmations",
    name: "Gate Precast - Indianapolis Rate Confirmation.pdf",
    path: "demo-gate-rate-confirmation",
    size: 284000,
    mimeType: "application/pdf",
    uploadedAt: "2026-06-16T12:00:00.000Z",
    uploadedBy: "Brian",
    googleDriveFileId: "demo-gate-rate-confirmation",
    googleDriveFolderId: "demo-gate-folder",
    googleDriveWebViewLink: "https://drive.google.com/",
    googleDriveWebContentLink: "https://drive.google.com/"
  },
  {
    id: "demo-gate-pod-package",
    accountId: "22222222-2222-4222-8222-222222222222",
    accountType: "company",
    provider: "google_drive",
    category: "PODs",
    name: "Gate Precast - POD Package.pdf",
    path: "demo-gate-pod-package",
    size: 176000,
    mimeType: "application/pdf",
    uploadedAt: "2026-06-18T15:35:00.000Z",
    uploadedBy: "Louie",
    googleDriveFileId: "demo-gate-pod-package",
    googleDriveFolderId: "demo-gate-folder",
    googleDriveWebViewLink: "https://drive.google.com/",
    googleDriveWebContentLink: "https://drive.google.com/"
  },
  {
    id: "demo-abc-coi",
    accountId: "55555555-5555-4555-8555-555555555501",
    accountType: "carrier",
    provider: "google_drive",
    category: "COIs",
    name: "ABC Transport - COI Pending.pdf",
    path: "demo-abc-coi",
    size: 98000,
    mimeType: "application/pdf",
    uploadedAt: "2026-06-18T11:20:00.000Z",
    uploadedBy: "Brian",
    googleDriveFileId: "demo-abc-coi",
    googleDriveFolderId: "demo-abc-folder",
    googleDriveWebViewLink: "https://drive.google.com/",
    googleDriveWebContentLink: "https://drive.google.com/"
  },
  {
    id: "demo-abc-w9",
    accountId: "55555555-5555-4555-8555-555555555501",
    accountType: "carrier",
    provider: "google_drive",
    category: "W9s",
    name: "ABC Transport - W9 Requested.pdf",
    path: "demo-abc-w9",
    size: 76000,
    mimeType: "application/pdf",
    uploadedAt: "2026-06-18T11:22:00.000Z",
    uploadedBy: "Brian",
    googleDriveFileId: "demo-abc-w9",
    googleDriveFolderId: "demo-abc-folder",
    googleDriveWebViewLink: "https://drive.google.com/",
    googleDriveWebContentLink: "https://drive.google.com/"
  }
];
