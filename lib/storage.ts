import type { AccountFile, Carrier, CommunicationLog, Company, Contact, Task, TimelineEntry } from "@/types";

const STORAGE_KEY = "blue-bomber-logistics-os:v1";

export type StoredBlueBomberState = {
  companies: Company[];
  contacts: Contact[];
  tasks: Task[];
  timeline: TimelineEntry[];
  carriers: Carrier[];
  files?: AccountFile[];
  communicationLogs?: CommunicationLog[];
};

export function loadStoredState() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEY);

    if (!storedValue) {
      return null;
    }

    const parsedValue = JSON.parse(storedValue) as Partial<StoredBlueBomberState>;

    if (
      !Array.isArray(parsedValue.companies) ||
      !Array.isArray(parsedValue.contacts) ||
      !Array.isArray(parsedValue.tasks) ||
      !Array.isArray(parsedValue.timeline)
    ) {
      return null;
    }

    return {
      companies: parsedValue.companies,
      contacts: parsedValue.contacts,
      tasks: parsedValue.tasks,
      timeline: parsedValue.timeline,
      carriers: Array.isArray(parsedValue.carriers) ? parsedValue.carriers : [],
      files: Array.isArray(parsedValue.files) ? parsedValue.files : [],
      communicationLogs: Array.isArray(parsedValue.communicationLogs) ? parsedValue.communicationLogs : []
    };
  } catch {
    return null;
  }
}

export function saveStoredState(state: StoredBlueBomberState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
