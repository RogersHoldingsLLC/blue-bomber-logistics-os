import type { Carrier, Company, Contact, Task, TimelineEntry } from "@/types";
import { createUuid } from "@/lib/uuid";

type IntentOwner = "sales" | "operations";

type TaskIntentRule = {
  match: string;
  taskName: string;
  owner: IntentOwner;
  priority: Task["priority"];
  due?: string;
  defaultToday?: boolean;
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

type ContactConfidence = "High" | "Medium" | "Low";

type DetectedContact = {
  name: string;
  department: string;
  confidence: ContactConfidence;
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
    match: "send pricing",
    taskName: "Send Pricing",
    owner: "sales",
    priority: "normal"
  },
  {
    match: "send quote",
    taskName: "Send Quote",
    owner: "sales",
    priority: "normal"
  },
  {
    match: "send update",
    taskName: "Send Update",
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
    match: "follow up with",
    taskName: "Follow Up",
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
    taskName: "Email Contact",
    owner: "sales",
    priority: "normal",
    defaultToday: true
  },
  {
    match: "send email",
    taskName: "Email Contact",
    owner: "sales",
    priority: "normal",
    defaultToday: true
  },
  {
    match: "email",
    taskName: "Email Contact",
    owner: "sales",
    priority: "normal",
    defaultToday: true
  },
  {
    match: "e-mail",
    taskName: "Email Contact",
    owner: "sales",
    priority: "normal",
    defaultToday: true
  },
  {
    match: "email them",
    taskName: "Email Contact",
    owner: "sales",
    priority: "normal",
    defaultToday: true
  },
  {
    match: "email her",
    taskName: "Email Contact",
    owner: "sales",
    priority: "normal",
    defaultToday: true
  },
  {
    match: "email him",
    taskName: "Email Contact",
    owner: "sales",
    priority: "normal",
    defaultToday: true
  },
  {
    match: "email customer",
    taskName: "Email Contact",
    owner: "sales",
    priority: "normal",
    defaultToday: true
  },
  {
    match: "email prospect",
    taskName: "Email Contact",
    owner: "sales",
    priority: "normal",
    defaultToday: true
  },
  {
    match: "email quote",
    taskName: "Send Quote",
    owner: "sales",
    priority: "normal"
  },
  {
    match: "let them know",
    taskName: "Email Contact",
    owner: "sales",
    priority: "normal",
    defaultToday: true
  },
  {
    match: "let her know",
    taskName: "Email Contact",
    owner: "sales",
    priority: "normal",
    defaultToday: true
  },
  {
    match: "let him know",
    taskName: "Email Contact",
    owner: "sales",
    priority: "normal",
    defaultToday: true
  },
  {
    match: "quote request",
    taskName: "Provide Quote",
    owner: "sales",
    priority: "high"
  },
  {
    match: "need to quote",
    taskName: "Quote Load",
    owner: "sales",
    priority: "high",
    defaultToday: true
  },
  {
    match: "quote this load",
    taskName: "Quote Load",
    owner: "sales",
    priority: "high",
    defaultToday: true
  },
  {
    match: "quote load",
    taskName: "Quote Load",
    owner: "sales",
    priority: "high",
    defaultToday: true
  },
  {
    match: "rate load",
    taskName: "Quote Load",
    owner: "sales",
    priority: "high",
    defaultToday: true
  },
  {
    match: "price load",
    taskName: "Quote Load",
    owner: "sales",
    priority: "high",
    defaultToday: true
  },
  {
    match: "need pricing on load",
    taskName: "Quote Load",
    owner: "sales",
    priority: "high",
    defaultToday: true
  },
  {
    match: "need rate from",
    taskName: "Quote Load",
    owner: "sales",
    priority: "high",
    defaultToday: true
  },
  {
    match: "quote from",
    taskName: "Quote Load",
    owner: "sales",
    priority: "high",
    defaultToday: true
  },
  {
    match: "load from",
    taskName: "Quote Load",
    owner: "sales",
    priority: "high",
    defaultToday: true
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
    match: "need to make bol",
    taskName: "Make BOL",
    owner: "sales",
    priority: "normal",
    defaultToday: true
  },
  {
    match: "need to make a bol",
    taskName: "Make BOL",
    owner: "sales",
    priority: "normal",
    defaultToday: true
  },
  {
    match: "make bol",
    taskName: "Make BOL",
    owner: "sales",
    priority: "normal",
    defaultToday: true
  },
  {
    match: "create bol",
    taskName: "Make BOL",
    owner: "sales",
    priority: "normal",
    defaultToday: true
  },
  {
    match: "send bol",
    taskName: "Make BOL",
    owner: "sales",
    priority: "normal",
    defaultToday: true
  },
  {
    match: "bol for",
    taskName: "Make BOL",
    owner: "sales",
    priority: "normal",
    defaultToday: true
  },
  {
    match: "build bol",
    taskName: "Make BOL",
    owner: "sales",
    priority: "normal",
    defaultToday: true
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
  "morning",
  "afternoon",
  "evening",
  "asap",
  "end",
  "day",
  "load",
  "loads",
  "shipment",
  "shipments",
  "truck",
  "trucks",
  "bol",
  "quote",
  "rate",
  "rates",
  "pricing",
  "email",
  "call",
  "text",
  "follow",
  "up",
  "need",
  "to",
  "we",
  "us",
  "carrier",
  "customer",
  "prospect",
  "at",
  "this",
  "by"
]);

const blockedContactPhrases = new Set([
  "this asap",
  "morning",
  "by end",
  "today",
  "tomorrow",
  "bol",
  "quote",
  "load",
  "shipment",
  "follow up",
  "email",
  "call",
  "text",
  "need",
  "need to",
  "we",
  "us",
  "customer",
  "prospect",
  "carrier",
  "call contact",
  "call back",
  "send email",
  "provide quote",
  "quote load",
  "make bol",
  "find email",
  "find better contact",
  "find better number"
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
      const actionName = getActionName(
        taskRule.taskName,
        taskRule.sourceSentence,
        contacts.filter((contact) => contact.companyId === company.id),
        taskRule.detectedDue
      );
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
          due: taskRule.detectedDue ?? taskRule.due ?? (taskRule.defaultToday ? "Today" : ""),
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

function getActionName(taskName: string, note: string, contacts: Contact[], detectedDue = "") {
  const contact = findReferencedContact(note, contacts);

  if (taskName === "Email Contact") {
    return contact?.name ? `Email ${contact.name}` : "Send Email";
  }

  if (taskName === "Send Rates") {
    return contact?.name ? `Send Rates to ${contact.name}` : taskName;
  }

  if (taskName === "Send Quote") {
    return contact?.name ? `Send Quote to ${contact.name}` : taskName;
  }

  if (taskName === "Send Pricing") {
    return contact?.name ? `Send Pricing to ${contact.name}` : taskName;
  }

  if (taskName === "Send Update") {
    return contact?.name ? `Send Update to ${contact.name}` : taskName;
  }

  if (taskName === "Follow Up") {
    return contact?.name ? `Follow Up With ${contact.name}` : taskName;
  }

  if (taskName === "Make BOL") {
    return contact?.name ? `Make BOL for ${contact.name}` : taskName;
  }

  if (taskName === "Quote Load") {
    const lane = extractLane(note);

    return lane ? `Quote Load: ${lane.origin} to ${lane.destination}` : taskName;
  }

  if (taskName !== "Call Contact" && taskName !== "Call Back") {
    return taskName;
  }

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
      priority: /\basap\b/i.test(sentence) ? "high" : rule.priority,
      detectedDue: extractDueFromSentence(sentence) || undefined,
      sourceSentence: sentence
    }));
}

function extractDueFromSentence(sentence: string) {
  if (/\basap\b/i.test(sentence)) {
    return "Today";
  }

  if (/\bnext week\b/i.test(sentence)) {
    return "Next Week";
  }

  const dayMatch = sentence.match(/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  const timeMatch = sentence.match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);

  if (!dayMatch && !timeMatch) {
    return "";
  }

  const day = dayMatch ? toTitleCase(dayMatch[1] ?? "") : "Today";

  if (!timeMatch) {
    return day;
  }

  const hour = Number(timeMatch[1]);
  const minute = timeMatch[2] ?? "00";
  const meridiem = (timeMatch[3] ?? "").toUpperCase();

  return `${day} ${hour}:${minute} ${meridiem}`;
}

function extractLane(sentence: string) {
  const match = sentence.match(
    /\b(?:need\s+rate\s+from|quote\s+from|load\s+from|from)\s+(.+?)\s+to\s+(.+?)(?:\s+(?:today|tomorrow|asap|please|now|for\s+quote))?$/i
  );

  if (!match) {
    return null;
  }

  const origin = formatLaneLocation(match[1] ?? "");
  const destination = formatLaneLocation(match[2] ?? "");

  return origin && destination ? { origin, destination } : null;
}

function formatLaneLocation(value: string) {
  return value
    .replace(/[.,;:]+$/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const cleanedWord = word.replace(/[^a-zA-Z]/g, "");

      if (/^[a-z]{2}$/i.test(cleanedWord)) {
        return cleanedWord.toUpperCase();
      }

      return toTitleCase(cleanedWord);
    })
    .filter(Boolean)
    .join(" ");
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

    return (
      contact.confidence === "High" &&
      normalizedName &&
      !existingNames.has(normalizedName) &&
      !existingFirstNames.has(firstName)
    );
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
    createdBy,
    confidence: contact.confidence
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

function findReferencedContact(note: string, contacts: Contact[]) {
  const detectedContact = extractProbableContacts(note)[0];

  if (detectedContact?.name) {
    const existingContact = contacts.find((contact) => namesMatch(contact.name, detectedContact.name));

    return existingContact ? { name: detectedContact.name, department: existingContact.role } : detectedContact;
  }

  const matchingContacts = contacts.filter((contact) => {
    const firstName = normalizeContactName(contact.name).split(/\s+/)[0] ?? "";

    return Boolean(firstName && new RegExp(`\\b${escapeRegExp(firstName)}\\b`, "i").test(note));
  });

  if (matchingContacts.length === 1) {
    const firstName = matchingContacts[0].name.split(/\s+/)[0] ?? matchingContacts[0].name;

    return { name: firstName, department: matchingContacts[0].role };
  }

  return null;
}

function extractProbableContacts(note: string) {
  const contacts: DetectedContact[] = [];
  const sentences = note
    .split(/[\n.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  const phonePattern = /\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g;
  const triggerPatterns: Array<{ pattern: RegExp; confidence: ContactConfidence }> = [
    { pattern: /\b(?:spoke with|talked to|received email from|email from)\s+([a-z][a-z'’-]+(?:\s+(?:and|&)\s+[a-z][a-z'’-]+)?(?:\s+[a-z][a-z'’-]+)?)(?:\s+in\s+([a-z][a-z &/-]+))?/gi, confidence: "High" },
    { pattern: /^([a-z][a-z'’-]+(?:\s+[a-z][a-z'’-]+)+)(?:\s+in\s+([a-z][a-z &/-]+))?\s+(?:said|says|told|emailed|called|asked|requested)\b/gi, confidence: "High" },
    { pattern: /\b(?:call|follow up with)\s+([a-z][a-z'’-]+(?:\s+[a-z][a-z'’-]+)?)(?:\s+in\s+([a-z][a-z &/-]+))?/gi, confidence: "Medium" },
    { pattern: /\b(?:send rates to|send quote to|send pricing to|send update to|e-?mail quote to|need pricing for|follow up with|check with)\s+([a-z][a-z'’-]+(?:\s+[a-z][a-z'’-]+)?)(?:\s+in\s+([a-z][a-z &/-]+))?/gi, confidence: "Medium" },
    { pattern: /\b(?:need to\s+)?(?:e-?mail|send email to)\s+([a-z][a-z'’-]+(?:\s+[a-z][a-z'’-]+)?)(?:\s+in\s+([a-z][a-z &/-]+))?/gi, confidence: "Medium" },
    { pattern: /\b(?:need to make|make|create|send|build)?\s*bol\s+for\s+([a-z][a-z'’-]+(?:\s+[a-z][a-z'’-]+)?)(?:\s+in\s+([a-z][a-z &/-]+))?/gi, confidence: "Medium" }
  ];

  for (const emailMatch of Array.from(note.matchAll(emailPattern))) {
    const email = emailMatch[0];
    addDetectedContact(contacts, { name: email, department: "Email Address", confidence: "High" });
  }

  for (const phoneMatch of Array.from(note.matchAll(phonePattern))) {
    const phone = phoneMatch[0];
    addDetectedContact(contacts, { name: phone, department: "Phone Number", confidence: "High" });
  }

  sentences.forEach((sentence) => {
    triggerPatterns.forEach(({ pattern, confidence }) => {
      for (const match of Array.from(sentence.matchAll(pattern))) {
        const rawName = match[1] ?? "";
        const department = cleanDetectedDepartment(match[2] ?? "");

        splitDetectedName(rawName, department, confidence).forEach((contact) => {
          if (isAllowedContactName(contact.name, contact.confidence)) {
            addDetectedContact(contacts, contact);
          }
        });
      }
    });
  });

  return contacts;
}

function splitDetectedName(value: string, department: string, confidence: ContactConfidence) {
  return value
    .split(/\s+(?:and|&)\s+/i)
    .map((name) => ({
      name: cleanDetectedName(name),
      department,
      confidence: getContactConfidence(cleanDetectedName(name), confidence)
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
    .map(toTitleCase)
    .join(" ");
}

function cleanDetectedDepartment(value: string) {
  return value
    .replace(/[^a-zA-Z\s&/-]/g, "")
    .trim()
    .split(/\s+/)
    .filter((part) => !ignoredContactWords.has(part.toLowerCase()))
    .slice(0, 3)
    .map(toTitleCase)
    .join(" ");
}

function addDetectedContact(contacts: DetectedContact[], contact: DetectedContact) {
  const existingContact = contacts.find((item) => namesMatch(item.name, contact.name));

  if (!existingContact) {
    contacts.push(contact);
    return;
  }

  if (contactConfidenceRank(contact.confidence) > contactConfidenceRank(existingContact.confidence)) {
    existingContact.confidence = contact.confidence;
    existingContact.department = contact.department || existingContact.department;
  }
}

function getContactConfidence(value: string, baseConfidence: ContactConfidence): ContactConfidence {
  if (isEmailAddress(value) || isPhoneNumber(value)) {
    return "High";
  }

  if (!hasFirstAndLastName(value)) {
    return "Low";
  }

  return "High";
}

function contactConfidenceRank(confidence: ContactConfidence) {
  return confidence === "High" ? 3 : confidence === "Medium" ? 2 : 1;
}

function isAllowedContactName(value: string, confidence: ContactConfidence) {
  const normalizedValue = normalizeContactName(value);
  const parts = value.split(/\s+/).filter(Boolean);

  if (!normalizedValue || blockedContactPhrases.has(normalizedValue)) {
    return false;
  }

  if (isEmailAddress(value) || isPhoneNumber(value)) {
    return true;
  }

  if (confidence !== "High") {
    return false;
  }

  return (
    parts.length >= 2 &&
    parts.every((part) => !ignoredContactWords.has(part.toLowerCase())) &&
    hasFirstAndLastName(value)
  );
}

function hasFirstAndLastName(value: string) {
  const parts = value.split(/\s+/).filter(Boolean);

  return parts.length >= 2 && parts.every((part) => /^[A-Za-z][A-Za-z'’-]+$/.test(part));
}

function isEmailAddress(value: string) {
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value.trim());
}

function isPhoneNumber(value: string) {
  return /^(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}$/.test(value.trim());
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
