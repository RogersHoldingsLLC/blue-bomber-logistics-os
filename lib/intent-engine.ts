import type { Carrier, Company, Contact, Task, TimelineEntry } from "@/types";
import { createUuid } from "@/lib/uuid";

type IntentOwner = "sales" | "operations";

type TaskIntentRule = {
  match: string;
  taskName: string;
  owner: IntentOwner;
  priority: Task["priority"];
  due?: string;
};

type ActivityIntentRule = {
  match: string;
  updatesLastContact?: boolean;
  updatesStatusToCustomer?: boolean;
};

type CarrierTaskIntentRule = {
  match: string;
  taskName: string;
  priority: Task["priority"];
};

export type IntentResult = {
  company: Company;
  contacts: Contact[];
  tasks: Task[];
  timelineEntry: TimelineEntry;
};

export type CarrierIntentResult = {
  tasks: Task[];
};

const taskIntentRules: TaskIntentRule[] = [
  {
    match: "call back tomorrow",
    taskName: "Call Back",
    owner: "sales",
    priority: "normal",
    due: "Tomorrow"
  },
  {
    match: "call back monday",
    taskName: "Call Back",
    owner: "sales",
    priority: "normal",
    due: "Next Monday"
  },
  {
    match: "need better contacts",
    taskName: "Find Better Contact",
    owner: "operations",
    priority: "normal"
  },
  {
    match: "need better contact",
    taskName: "Find Better Contact",
    owner: "operations",
    priority: "normal"
  },
  {
    match: "better contacts",
    taskName: "Find Better Contact",
    owner: "operations",
    priority: "normal"
  },
  {
    match: "better contact",
    taskName: "Find Better Contact",
    owner: "operations",
    priority: "normal"
  },
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
    match: "follow up next week",
    taskName: "Follow Up",
    owner: "sales",
    priority: "normal",
    due: "Next Week"
  },
  {
    match: "need email",
    taskName: "Send Email",
    owner: "sales",
    priority: "normal"
  },
  {
    match: "send email",
    taskName: "Send Email",
    owner: "sales",
    priority: "normal"
  },
  {
    match: "email them",
    taskName: "Send Email",
    owner: "sales",
    priority: "normal"
  },
  {
    match: "email customer",
    taskName: "Send Email",
    owner: "sales",
    priority: "normal"
  },
  {
    match: "email prospect",
    taskName: "Send Email",
    owner: "sales",
    priority: "normal"
  },
  {
    match: "email quote",
    taskName: "Send Quote",
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
    match: "need carrier setup",
    taskName: "Carrier Setup",
    owner: "operations",
    priority: "normal"
  },
  {
    match: "need coi",
    taskName: "Get Updated COI",
    owner: "operations",
    priority: "high"
  },
  {
    match: "need w9",
    taskName: "Get W9",
    owner: "operations",
    priority: "normal"
  },
  {
    match: "need noa",
    taskName: "Get NOA",
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

const carrierTaskIntentRules: CarrierTaskIntentRule[] = [
  {
    match: "need coi",
    taskName: "Get Updated COI",
    priority: "high"
  },
  {
    match: "need w9",
    taskName: "Get W9",
    priority: "normal"
  },
  {
    match: "need noa",
    taskName: "Get NOA",
    priority: "normal"
  },
  {
    match: "check availability",
    taskName: "Check Availability",
    priority: "normal"
  },
  {
    match: "send load details",
    taskName: "Send Load Details",
    priority: "normal"
  },
  {
    match: "confirm pickup",
    taskName: "Confirm Pickup",
    priority: "high"
  },
  {
    match: "confirm delivery",
    taskName: "Confirm Delivery",
    priority: "high"
  }
];

export function applyIntent(
  note: string,
  company: Company,
  contacts: Contact[],
  now = new Date()
): IntentResult {
  const normalizedNote = note.trim().toLowerCase();
  const normalizedSentences = splitIntentSentences(note);
  const timestamp = now.toISOString();
  const today = "Today";
  const timelineEntry: TimelineEntry = {
    id: createUuid(),
    companyId: company.id,
    at: today,
    body: note,
    createdAt: timestamp
  };
  const matchedTaskRules = normalizedSentences.flatMap((sentence) => findTaskRulesForSentence(sentence));

  console.log("[Blue Bomber Intent] note received:", note);
  console.log(
    "[Blue Bomber Intent] intents detected:",
    matchedTaskRules.map((rule) => rule.match)
  );

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
          entityId: company.id,
          entityType: company.status,
          title: taskRule.taskName,
          due: taskRule.due ?? "Next",
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

    console.log(
      "[Blue Bomber Intent] tasks created:",
      generatedTasks.map((task) => ({
        title: task.title,
        owner: task.owner,
        companyId: task.companyId,
        sourceNote: task.sourceNote
      }))
    );

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

  console.log("[Blue Bomber Intent] tasks created:", []);

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

function splitIntentSentences(note: string) {
  return note
    .toLowerCase()
    .split(/[\n.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function findTaskRulesForSentence(sentence: string) {
  const matchedRules = taskIntentRules.filter((rule) => sentence.includes(rule.match));

  return matchedRules.filter(
    (rule) =>
      !matchedRules.some(
        (otherRule) =>
          otherRule !== rule &&
          otherRule.match.includes(rule.match) &&
          otherRule.match.length > rule.match.length
      )
  );
}

export function applyCarrierIntent(note: string, carrier: Carrier, now = new Date()): CarrierIntentResult {
  const normalizedNote = note.trim().toLowerCase();
  const timestamp = now.toISOString();
  const matchedTaskRules = carrierTaskIntentRules.filter((rule) => normalizedNote.includes(rule.match));

  const generatedTasks = matchedTaskRules.reduce<Task[]>((uniqueTasks, taskRule) => {
    const dedupeKey = `${taskRule.taskName}-${carrier.id}-${note}`;
    const hasDuplicate = uniqueTasks.some(
      (task) => `${task.title}-${task.entityId ?? task.companyId}-${task.sourceNote}` === dedupeKey
    );

    if (hasDuplicate) {
      return uniqueTasks;
    }

    return [
      ...uniqueTasks,
      {
        id: createUuid(),
        companyId: carrier.id,
        entityId: carrier.id,
        entityType: "carrier",
        title: taskRule.taskName,
        due: "Today",
        priority: taskRule.priority,
        status: "open",
        createdAt: timestamp,
        owner: "Brian",
        createdBy: "Blue Bomber OS",
        sourceCompany: carrier.name,
        sourceNote: note
      }
    ];
  }, []);

  return {
    tasks: generatedTasks
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
