import type { Carrier, Company, Contact, Task, TimelineEntry } from "@/types";

export const qualifyingQuestions = [
  "Who handles purchasing?",
  "What are you currently buying?",
  "Who is your current supplier?",
  "What challenges are you experiencing?",
  "When would you consider evaluating alternatives?"
] as const;

export const companies: Company[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Midwest Cold Storage",
    status: "prospect",
    city: "Columbus",
    state: "OH",
    segment: "Cold storage",
    currentOpportunity: "Weekly dry van lanes from Columbus to Nashville.",
    smartNotes: "Purchasing wants fewer missed pickup windows. Follow up after rate review.",
    salesLead: "Louie",
    operationsLead: "Brian",
    primaryContactId: "11111111-1111-4111-8111-111111111101",
    lastContact: "Today",
    lastActivity: "Today",
    active: true,
    qualifyingQuestions: {
      "Who handles purchasing?": "Dana Ellis, Operations Purchasing",
      "What are you currently buying?": "Dry van and reefer spot freight",
      "Who is your current supplier?": "Regional broker mix",
      "What challenges are you experiencing?": "Late pickups and poor update cadence",
      "When would you consider evaluating alternatives?": "After the current month closes"
    }
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Lakefront Building Supply",
    status: "prospect",
    city: "Erie",
    state: "PA",
    segment: "Building materials",
    currentOpportunity: "Flatbed capacity for two recurring inbound lanes.",
    smartNotes: "Needs fast check-ins, not a long sales pitch.",
    salesLead: "Louie",
    operationsLead: "Brian",
    primaryContactId: "22222222-2222-4222-8222-222222222201",
    lastContact: "Yesterday",
    lastActivity: "Yesterday",
    active: true,
    qualifyingQuestions: {
      "Who handles purchasing?": "Marcus Clay",
      "What are you currently buying?": "Flatbed and step deck moves",
      "Who is your current supplier?": "Incumbent asset carrier",
      "What challenges are you experiencing?": "Capacity gets tight at month end",
      "When would you consider evaluating alternatives?": "If service slips again"
    }
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Riverside Foods",
    status: "customer",
    city: "Louisville",
    state: "KY",
    segment: "Food manufacturing",
    currentOpportunity: "Add one outbound lane to the existing weekly schedule.",
    smartNotes: "Customer likes concise summaries and shipment exceptions only.",
    salesLead: "Louie",
    operationsLead: "Brian",
    primaryContactId: "33333333-3333-4333-8333-333333333301",
    lastContact: "Monday",
    lastActivity: "Monday",
    active: true,
    qualifyingQuestions: {
      "Who handles purchasing?": "Nina Patel",
      "What are you currently buying?": "Reefer freight and seasonal overflow",
      "Who is your current supplier?": "Blue Bomber plus two backup brokers",
      "What challenges are you experiencing?": "Seasonal surges",
      "When would you consider evaluating alternatives?": "Already evaluating overflow options"
    }
  }
];

export const contacts: Contact[] = [
  {
    id: "11111111-1111-4111-8111-111111111101",
    companyId: "11111111-1111-4111-8111-111111111111",
    name: "Dana Ellis",
    role: "Operations Purchasing",
    email: "dana@midwestcold.example",
    phone: "(614) 555-0144",
    lastContact: "Today"
  },
  {
    id: "11111111-1111-4111-8111-111111111102",
    companyId: "11111111-1111-4111-8111-111111111111",
    name: "Rob Miller",
    role: "Shipping Manager",
    email: "rob@midwestcold.example",
    phone: "(614) 555-0180"
  },
  {
    id: "11111111-1111-4111-8111-111111111103",
    companyId: "11111111-1111-4111-8111-111111111111",
    name: "Tess Grant",
    role: "Accounts Payable",
    email: "tess@midwestcold.example",
    phone: "(614) 555-0128"
  },
  {
    id: "22222222-2222-4222-8222-222222222201",
    companyId: "22222222-2222-4222-8222-222222222222",
    name: "Marcus Clay",
    role: "Purchasing Lead",
    email: "marcus@lakefront.example",
    phone: "(814) 555-0162",
    lastContact: "Yesterday"
  },
  {
    id: "22222222-2222-4222-8222-222222222202",
    companyId: "22222222-2222-4222-8222-222222222222",
    name: "Sarah James",
    role: "Warehouse Manager",
    email: "sarah@lakefront.example",
    phone: "(814) 555-0169"
  },
  {
    id: "33333333-3333-4333-8333-333333333301",
    companyId: "33333333-3333-4333-8333-333333333333",
    name: "Nina Patel",
    role: "Logistics Director",
    email: "nina@riverside.example",
    phone: "(502) 555-0118",
    lastContact: "Monday"
  },
  {
    id: "33333333-3333-4333-8333-333333333302",
    companyId: "33333333-3333-4333-8333-333333333333",
    name: "Owen Fox",
    role: "Plant Manager",
    email: "owen@riverside.example",
    phone: "(502) 555-0122"
  },
  {
    id: "33333333-3333-4333-8333-333333333303",
    companyId: "33333333-3333-4333-8333-333333333333",
    name: "Maria Lopez",
    role: "Accounts Payable",
    email: "maria@riverside.example",
    phone: "(502) 555-0151"
  }
];

export const tasks: Task[] = [
  {
    id: "44444444-4444-4444-8444-444444444401",
    companyId: "11111111-1111-4111-8111-111111111111",
    title: "Send Columbus to Nashville lane estimate",
    due: "Today",
    priority: "high",
    status: "open",
    createdAt: "2026-06-08T09:00:00.000Z",
    owner: "Louie",
    createdBy: "System",
    sourceCompany: "Midwest Cold Storage",
    sourceNote: "Initial lane estimate needed for Columbus to Nashville."
  },
  {
    id: "44444444-4444-4444-8444-444444444402",
    companyId: "22222222-2222-4222-8222-222222222222",
    title: "Call Marcus about month-end flatbed needs",
    due: "Tomorrow",
    priority: "normal",
    status: "open",
    createdAt: "2026-06-09T10:30:00.000Z",
    owner: "Louie",
    createdBy: "System",
    sourceCompany: "Lakefront Building Supply",
    sourceNote: "Marcus has month-end flatbed needs."
  },
  {
    id: "44444444-4444-4444-8444-444444444403",
    companyId: "33333333-3333-4333-8333-333333333333",
    title: "Confirm next outbound pickup schedule",
    due: "Friday",
    priority: "normal",
    status: "open",
    createdAt: "2026-06-10T14:00:00.000Z",
    owner: "Louie",
    createdBy: "System",
    sourceCompany: "Riverside Foods",
    sourceNote: "Confirm next outbound pickup schedule."
  },
  {
    id: "44444444-4444-4444-8444-444444444404",
    companyId: "11111111-1111-4111-8111-111111111111",
    title: "Confirm Dana approved service cadence",
    due: "Next",
    priority: "normal",
    status: "open",
    createdAt: "2026-06-11T08:00:00.000Z",
    owner: "Brian",
    createdBy: "System",
    sourceCompany: "Midwest Cold Storage",
    sourceNote: "Confirm Dana approved service cadence."
  }
];

export const carriers: Carrier[] = [
  {
    id: "55555555-5555-4555-8555-555555555501",
    name: "Buckeye Transport",
    city: "Dayton",
    state: "OH",
    equipment: "Dry van"
  },
  {
    id: "55555555-5555-4555-8555-555555555502",
    name: "Bluegrass Flatbed",
    city: "Lexington",
    state: "KY",
    equipment: "Flatbed"
  }
];

export const timeline: TimelineEntry[] = [
  {
    id: "66666666-6666-4666-8666-666666666601",
    companyId: "11111111-1111-4111-8111-111111111111",
    at: "Today",
    body: "Dana asked for a tighter pickup communication process.",
    createdAt: "2026-06-11T09:00:00.000Z"
  },
  {
    id: "66666666-6666-4666-8666-666666666602",
    companyId: "22222222-2222-4222-8222-222222222222",
    at: "Yesterday",
    body: "Marcus shared two possible recurring flatbed lanes.",
    createdAt: "2026-06-10T10:30:00.000Z"
  },
  {
    id: "66666666-6666-4666-8666-666666666603",
    companyId: "33333333-3333-4333-8333-333333333333",
    at: "Monday",
    body: "Nina requested overflow pricing before peak volume.",
    createdAt: "2026-06-08T14:15:00.000Z"
  }
];
