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

type DetectedContact = {
  name: string;
  department: string;
};

type MatchedTaskRule = TaskIntentRule & {
  detectedDue?: string;
  sourceSentence: string;
};

export type IntentResult = {
  company: Company;
  contacts: Contact[];
  contactsAdded: string[];
  tasks: Task[];
  timelineEntry: TimelineEntry;
  contactTimelineEntries: TimelineEntry[];
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
    match: "call back",
    taskName: "Call Contact",
    owner: "sales",
    priority: "normal"
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
    match: "send rates",
    taskName: "Send Rates",
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
    match: "find email",
    taskName: "Find Email",
    owner: "operations",
    priority: "normal"
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
    match: "get coi",
    taskName: "Get Updated COI",
    owner: "operations",
    priority: "high"
  },
  {
    match: "need coi",
    taskName: "Get Updated COI",
    owner: "operations",
    priority: "high"
  },
  {
    match: "coi",
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
    match: "w9",
    taskName: "Get W9",
    owner: "operations",
    priority: "normal"
  },
  {
    match: "check with louie",
    taskName: "Check With Louie",
    owner: "sales",
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

const ignoredContactWords = new Set([
  "today",
  "tomorrow",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "load",
  "loads",
  "truck",
  "trucks",
  "carrier",
  "customer",
  "prospect"
]);

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
  createdBy = "Blue Bomber OS",
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
  const contactDetection = detectAndCreateContacts(note, company, contacts, timestamp, today, createdBy);

  if (matchedTaskRules.length) {
    const generatedTasks = matchedTaskRules.reduce<Task[]>((uniqueTasks, taskRule) => {
      const owner = taskRule.owner === "sales" ? company.salesLead : company.operationsLead;
      const actionName = getActionName(taskRule.taskName, taskRule.sourceSentence, taskRule.detectedDue);
      const dedupeKey = `${actionName}-${owner}-${company.id}-${note}`;
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
          title: actionName,
          due: taskRule.detectedDue ?? taskRule.due ?? "Next",
          priority: taskRule.priority,
          status: "open",
          createdAt: timestamp,
          owner,
          createdBy,
          sourceCompany: company.name,
          sourceNote: note
        }
      ];
    }, []);

    return {
      company: {
        ...company,
        lastContact: contactDetection.contactsAdded.length ? today : company.lastContact,
        lastActivity: today,
        active: true
      },
      contacts: contactDetection.contacts,
      contactsAdded: contactDetection.contactsAdded,
      tasks: generatedTasks,
      timelineEntry,
      contactTimelineEntries: contactDetection.timelineEntries
    };
  }

  const activityRule = activityIntentRules.find((rule) => normalizedNote.includes(rule.match));

  if (activityRule) {
    const contactName = extractTalkedToContact(note);
    const updatedContacts =
      activityRule.updatesLastContact && contactName
        ? updateContactLastContact(contactDetection.contacts, company.id, contactName, today)
        : contactDetection.contacts;

    return {
      company: {
        ...company,
        status: activityRule.updatesStatusToCustomer ? "customer" : company.status,
        lastContact:
          activityRule.updatesLastContact || contactDetection.contactsAdded.length ? today : company.lastContact,
        lastActivity: today,
        active: true
      },
      contacts: updatedContacts,
      contactsAdded: contactDetection.contactsAdded,
      tasks: [],
      timelineEntry,
      contactTimelineEntries: contactDetection.timelineEntries
    };
  }

  return {
    company: {
      ...company,
      lastContact: contactDetection.contactsAdded.length ? today : company.lastContact,
      lastActivity: today,
      active: true
    },
    contacts: contactDetection.contacts,
    contactsAdded: contactDetection.contactsAdded,
    tasks: [],
    timelineEntry,
    contactTimelineEntries: contactDetection.timelineEntries
  };
}

function getActionName(taskName: string, note: string, detectedDue = "") {
  if (taskName === "Send Rates") {
    const contact = extractProbableContacts(note)[0];

    return contact?.name ? `Send Rates to ${contact.name}` : taskName;
  }

  if (taskName !== "Call Contact" && taskName !== "Call Back") {
    return taskName;
  }

  const contact = extractProbableContacts(note)[0];

  if (contact?.name) {
    return `Call ${contact.name}`;
  }

  if (detectedDue) {
    return "Call Back";
  }

  return taskName === "Call Contact" ? "Call Contact" : "Call Back";
}

function splitIntentSentences(note: string) {
  return note
    .split(/[\n.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function findTaskRulesForSentence(sentence: string): MatchedTaskRule[] {
  const normalizedSentence = sentence.toLowerCase();
  const matchedRules = taskIntentRules.filter((rule) => normalizedSentence.includes(rule.match));

  return matchedRules
    .filter(
      (rule) =>
        !matchedRules.some(
          (otherRule) =>
            otherRule !== rule &&
            otherRule.match.includes(rule.match) &&
            otherRule.match.length > rule.match.length
        )
    )
    .map((rule) => ({
      ...rule,
      detectedDue: extractDueFromSentence(sentence),
      sourceSentence: sentence
    }));
}

function extractDueFromSentence(sentence: string) {
  const dayMatch = sentence.match(/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);

  if (!dayMatch) {
    return "";
  }

  const day = toTitleCase(dayMatch[1] ?? "");
  const timeMatch = sentence.match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);

  if (!timeMatch) {
    return day;
  }

  const hour = Number(timeMatch[1]);
  const minute = timeMatch[2] ?? "00";
  const meridiem = (timeMatch[3] ?? "").toUpperCase();

  return `${day} ${hour}:${minute} ${meridiem}`;
}

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function detectAndCreateContacts(
  note: string,
  company: Company,
  contacts: Contact[],
  timestamp: string,
  today: string,
  createdBy: string
) {
  const detectedContacts = extractProbableContacts(note);
  const companyContacts = contacts.filter((contact) => contact.companyId === company.id);
  const existingNames = new Set(companyContacts.map((contact) => normalizeContactName(contact.name)));
  const existingFirstNames = new Set(
    companyContacts.map((contact) => normalizeContactName(contact.name.split(/\s+/)[0] ?? ""))
  );
  const updatedContacts = contacts.map((contact) => {
    const detectedContact = detectedContacts.find((detectedItem) => {
      const normalizedName = normalizeContactName(detectedItem.name);
      const firstName = normalizeContactName(detectedItem.name.split(/\s+/)[0] ?? "");

      return (
        contact.companyId === company.id &&
        (normalizeContactName(contact.name) === normalizedName ||
          normalizeContactName(contact.name.split(/\s+/)[0] ?? "") === firstName)
      );
    });

    if (!detectedContact) {
      return contact;
    }

    return {
      ...contact,
      role:
        detectedContact.department && (!contact.role || contact.role === "Activity Note")
          ? detectedContact.department
          : contact.role,
      lastContact: today,
      source: contact.source ?? "Activity Note",
      createdBy: contact.createdBy ?? createdBy
    };
  });

  const contactsToAdd = detectedContacts.filter((contact) => {
    const normalizedName = normalizeContactName(contact.name);
    const firstName = normalizeContactName(contact.name.split(/\s+/)[0] ?? "");

    return normalizedName && !existingNames.has(normalizedName) && !existingFirstNames.has(firstName);
  });
  const newContacts = contactsToAdd.map<Contact>((contact) => ({
    id: createUuid(),
    companyId: company.id,
    name: contact.name,
    role: contact.department || "Activity Note",
    email: "",
    phone: "",
    lastContact: today,
    source: "Activity Note",
    createdBy
  }));
  const timelineEntries = newContacts.map<TimelineEntry>((contact) => ({
    id: createUuid(),
    companyId: company.id,
    at: "Contact Added",
    body: contact.name,
    createdAt: timestamp
  }));

  return {
    contacts: newContacts.length ? [...newContacts, ...updatedContacts] : updatedContacts,
    contactsAdded: newContacts.map((contact) => contact.name),
    timelineEntries
  };
}

function extractProbableContacts(note: string) {
  const contacts: DetectedContact[] = [];
  const sentences = note
    .split(/[\n.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const triggerPatterns = [
    /\b(?:[Cc]all|[Ff]ollow up with)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?:\s+in\s+([A-Z][A-Za-z &/-]+))?/g,
    /\b(?:[Ss]end rates to|[Ss]end quote to|[Ee]mail quote to|[Nn]eed pricing for|[Ff]ollow up with|[Cc]heck with)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?:\s+in\s+([A-Z][A-Za-z &/-]+))?/g,
    /\b(?:[Ss]poke with|[Tt]alked to|[Rr]eceived email from|[Ee]mail from)\s+([A-Z][a-z]+(?:\s+(?:and|&)\s+[A-Z][a-z]+)?(?:\s+[A-Z][a-z]+)?)(?:\s+in\s+([A-Z][A-Za-z &/-]+))?/g,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?:\s+in\s+([A-Z][A-Za-z &/-]+))?\s+(?:said|says|told|emailed|called|asked|requested)\b/g
  ];

  sentences.forEach((sentence) => {
    triggerPatterns.forEach((pattern) => {
      for (const match of sentence.matchAll(pattern)) {
        const rawName = match[1] ?? "";
        const department = cleanDetectedDepartment(match[2] ?? "");

        splitDetectedName(rawName, department).forEach((contact) => {
          if (
            isAllowedContactName(contact.name) &&
            !contacts.some((existingContact) => namesMatch(existingContact.name, contact.name))
          ) {
            contacts.push(contact);
          }
        });
      }
    });
  });

  return contacts;
}

function splitDetectedName(value: string, department: string) {
  return value
    .split(/\s+(?:and|&)\s+/i)
    .map((name) => ({
      name: cleanDetectedName(name),
      department
    }))
    .filter((contact) => contact.name);
}

function cleanDetectedName(value: string) {
  return value
    .replace(/[^a-zA-Z\s'-]/g, "")
    .trim()
    .split(/\s+/)
    .filter((part) => !ignoredContactWords.has(part.toLowerCase()))
    .slice(0, 2)
    .join(" ");
}

function cleanDetectedDepartment(value: string) {
  return value
    .replace(/[^a-zA-Z\s&/-]/g, "")
    .trim()
    .split(/\s+/)
    .filter((part) => !ignoredContactWords.has(part.toLowerCase()))
    .slice(0, 3)
    .join(" ");
}

function isAllowedContactName(value: string) {
  const parts = value.split(/\s+/).filter(Boolean);

  return Boolean(parts.length) && parts.every((part) => !ignoredContactWords.has(part.toLowerCase()));
}

function normalizeContactName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function namesMatch(firstName: string, secondName: string) {
  const firstNormalized = normalizeContactName(firstName);
  const secondNormalized = normalizeContactName(secondName);
  const firstGiven = firstNormalized.split(/\s+/)[0] ?? "";
  const secondGiven = secondNormalized.split(/\s+/)[0] ?? "";

  return firstNormalized === secondNormalized || Boolean(firstGiven && firstGiven === secondGiven);
}

export function applyCarrierIntent(note: string, carrier: Carrier, createdBy = "Blue Bomber OS", now = new Date()): CarrierIntentResult {
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
        createdBy,
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
