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
    id: "midwest-cold-storage",
    name: "Midwest Cold Storage",
    status: "prospect",
    city: "Columbus",
    state: "OH",
    segment: "Cold storage",
    currentOpportunity: "Weekly dry van lanes from Columbus to Nashville.",
    smartNotes: "Purchasing wants fewer missed pickup windows. Follow up after rate review.",
    salesLead: "Louie",
    operationsLead: "Brian",
    primaryContactId: "dana-ellis",
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
    id: "lakefront-building-supply",
    name: "Lakefront Building Supply",
    status: "prospect",
    city: "Erie",
    state: "PA",
    segment: "Building materials",
    currentOpportunity: "Flatbed capacity for two recurring inbound lanes.",
    smartNotes: "Needs fast check-ins, not a long sales pitch.",
    salesLead: "Louie",
    operationsLead: "Brian",
    primaryContactId: "marcus-clay",
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
    id: "riverside-foods",
    name: "Riverside Foods",
    status: "customer",
    city: "Louisville",
    state: "KY",
    segment: "Food manufacturing",
    currentOpportunity: "Add one outbound lane to the existing weekly schedule.",
    smartNotes: "Customer likes concise summaries and shipment exceptions only.",
    salesLead: "Louie",
    operationsLead: "Brian",
    primaryContactId: "nina-patel",
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
    id: "dana-ellis",
    companyId: "midwest-cold-storage",
    name: "Dana Ellis",
    role: "Operations Purchasing",
    email: "dana@midwestcold.example",
    phone: "(614) 555-0144",
    lastContact: "Today"
  },
  {
    id: "rob-miller",
    companyId: "midwest-cold-storage",
    name: "Rob Miller",
    role: "Shipping Manager",
    email: "rob@midwestcold.example",
    phone: "(614) 555-0180"
  },
  {
    id: "tess-grant",
    companyId: "midwest-cold-storage",
    name: "Tess Grant",
    role: "Accounts Payable",
    email: "tess@midwestcold.example",
    phone: "(614) 555-0128"
  },
  {
    id: "marcus-clay",
    companyId: "lakefront-building-supply",
    name: "Marcus Clay",
    role: "Purchasing Lead",
    email: "marcus@lakefront.example",
    phone: "(814) 555-0162",
    lastContact: "Yesterday"
  },
  {
    id: "sarah-james",
    companyId: "lakefront-building-supply",
    name: "Sarah James",
    role: "Warehouse Manager",
    email: "sarah@lakefront.example",
    phone: "(814) 555-0169"
  },
  {
    id: "nina-patel",
    companyId: "riverside-foods",
    name: "Nina Patel",
    role: "Logistics Director",
    email: "nina@riverside.example",
    phone: "(502) 555-0118",
    lastContact: "Monday"
  },
  {
    id: "owen-fox",
    companyId: "riverside-foods",
    name: "Owen Fox",
    role: "Plant Manager",
    email: "owen@riverside.example",
    phone: "(502) 555-0122"
  },
  {
    id: "maria-lopez",
    companyId: "riverside-foods",
    name: "Maria Lopez",
    role: "Accounts Payable",
    email: "maria@riverside.example",
    phone: "(502) 555-0151"
  }
];

export const tasks: Task[] = [
  {
    id: "task-1",
    companyId: "midwest-cold-storage",
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
    id: "task-2",
    companyId: "lakefront-building-supply",
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
    id: "task-3",
    companyId: "riverside-foods",
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
    id: "task-4",
    companyId: "midwest-cold-storage",
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
    id: "buckeye-transport",
    name: "Buckeye Transport",
    city: "Dayton",
    state: "OH",
    equipment: "Dry van"
  },
  {
    id: "bluegrass-flatbed",
    name: "Bluegrass Flatbed",
    city: "Lexington",
    state: "KY",
    equipment: "Flatbed"
  }
];

export const timeline: TimelineEntry[] = [
  {
    id: "timeline-1",
    companyId: "midwest-cold-storage",
    at: "Today",
    body: "Dana asked for a tighter pickup communication process.",
    createdAt: "2026-06-11T09:00:00.000Z"
  },
  {
    id: "timeline-2",
    companyId: "lakefront-building-supply",
    at: "Yesterday",
    body: "Marcus shared two possible recurring flatbed lanes.",
    createdAt: "2026-06-10T10:30:00.000Z"
  },
  {
    id: "timeline-3",
    companyId: "riverside-foods",
    at: "Monday",
    body: "Nina requested overflow pricing before peak volume.",
    createdAt: "2026-06-08T14:15:00.000Z"
  }
];
