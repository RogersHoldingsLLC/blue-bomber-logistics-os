import type { Company, Contact, Task, TimelineEntry } from "@/types";
import { createUuid } from "@/lib/uuid";

type IntentOwner = "sales" | "operations";

type TaskIntentRule = {
  match: string;
  taskName: string;
  owner: IntentOwner;
  priority: Task["priority"];
};

type ActivityIntentRule = {
  match: string;
  updatesLastContact?: boolean;
  updatesStatusToCustomer?: boolean;
};

export type IntentResult = {
  company: Company;
  contacts: Contact[];
  tasks: Task[];
  timelineEntry: TimelineEntry;
};

const taskIntentRules: TaskIntentRule[] = [
  {
    match: "need better number",
    taskName: "Find Better Number",
    owner: "operations",
    priority: "normal"
  },
  {
    match: "need new poc",
    taskName: "Find New POC",
    owner: "operations",
    priority: "normal"
  },
  {
  match: "call",
  taskName: "Call Contact",
  owner: "sales",
  priority: "normal"
},
{
  match: "call back",
  taskName: "Call Contact",
  owner: "sales",
  priority: "normal"
},
{
  match: "reach out",
  taskName: "Call Contact",
  owner: "sales",
  priority: "normal"
},
{
  match: "check back",
  taskName: "Call Contact",
  owner: "sales",
  priority: "normal"
},
  {
    match: "follow up",
    taskName: "Follow Up",
    owner: "sales",
    priority: "normal"
  },
  {
    match: "need email",
    taskName: "Send Email",
    owner: "sales",
    priority: "normal"
  },
  {
    match: "quote request",
    taskName: "Provide Quote",
    owner: "sales",
    priority: "high"
  },
  {
    match: "need pricing",
    taskName: "Provide Quote",
    owner: "sales",
    priority: "high"
  },
  {
    match: "need carrier base",
    taskName: "Build Carrier Base",
    owner: "operations",
    priority: "normal"
  },
  {
    match: "build bol",
    taskName: "Generate BOL",
    owner: "operations",
    priority: "normal"
  },
  {
    match: "dormant prospect",
    taskName: "Re-engage Prospect",
    owner: "sales",
    priority: "normal"
  }
];

const activityIntentRules: ActivityIntentRule[] = [
  {
    match: "lvm"
  },
  {
    match: "talked to",
    updatesLastContact: true
  },
  {
    match: "sent quote"
  },
  {
    match: "received tender"
  },
  {
    match: "first load moved",
    updatesStatusToCustomer: true
  }
];

export function applyIntent(
  note: string,
  company: Company,
  contacts: Contact[],
  now = new Date()
): IntentResult {
  const normalizedNote = note.trim().toLowerCase();
  const timestamp = now.toISOString();
  const today = "Today";
  const timelineEntry: TimelineEntry = {
    id: createUuid(),
    companyId: company.id,
    at: today,
    body: note,
    createdAt: timestamp
  };
  const matchedTaskRules = taskIntentRules.filter((rule) => normalizedNote.includes(rule.match));

  if (matchedTaskRules.length) {
    const generatedTasks = matchedTaskRules.reduce<Task[]>((uniqueTasks, taskRule) => {
      const owner = taskRule.owner === "sales" ? company.salesLead : company.operationsLead;
      const dedupeKey = `${taskRule.taskName}-${owner}-${company.id}-${note}`;
      const hasDuplicate = uniqueTasks.some(
        (task) => `${task.title}-${task.owner}-${task.companyId}-${task.sourceNote}` === dedupeKey
      );

      if (hasDuplicate) {
        return uniqueTasks;
      }

      return [
        ...uniqueTasks,
        {
          id: createUuid(),
          companyId: company.id,
          title: taskRule.taskName,
          due: taskRule.match === "call monday" ? "Monday" : "Next",
          priority: taskRule.priority,
          status: "open",
          createdAt: timestamp,
          owner,
          createdBy: "Blue Bomber OS",
          sourceCompany: company.name,
          sourceNote: note
        }
      ];
    }, []);

    return {
      company: {
        ...company,
        lastActivity: today,
        active: true
      },
      contacts,
      tasks: generatedTasks,
      timelineEntry
    };
  }

  const activityRule = activityIntentRules.find((rule) => normalizedNote.includes(rule.match));

  if (activityRule) {
    const contactName = extractTalkedToContact(note);
    const updatedContacts =
      activityRule.updatesLastContact && contactName
        ? updateContactLastContact(contacts, company.id, contactName, today)
        : contacts;

    return {
      company: {
        ...company,
        status: activityRule.updatesStatusToCustomer ? "customer" : company.status,
        lastContact: activityRule.updatesLastContact ? today : company.lastContact,
        lastActivity: today,
        active: true
      },
      contacts: updatedContacts,
      tasks: [],
      timelineEntry
    };
  }

  return {
    company: {
      ...company,
      lastActivity: today,
      active: true
    },
    contacts,
    tasks: [],
    timelineEntry
  };
}

function extractTalkedToContact(note: string) {
  const match = note.match(/talked to\s+([a-zA-Z]+)(?:\s|$)/i);
  return match?.[1];
}

function updateContactLastContact(
  contacts: Contact[],
  companyId: string,
  contactName: string,
  lastContact: string
) {
  return contacts.map((contact) =>
    contact.companyId === companyId && contact.name.toLowerCase().startsWith(contactName.toLowerCase())
      ? { ...contact, lastContact }
      : contact
  );
}
