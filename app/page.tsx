"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import {
  carriers as seedCarriers,
  communicationLogs as seedCommunicationLogs,
  companies as seedCompanies,
  contacts as seedContacts,
  files as seedFiles,
  qualifyingQuestions,
  tasks as seedTasks,
  timeline as seedTimeline
} from "@/lib/data";
import { applyCarrierIntent, applyIntent, type IntentResult } from "@/lib/intent-engine";
import { loadStoredState, saveStoredState, type StoredBlueBomberState } from "@/lib/storage";
import {
  canUseSupabase,
  deleteSupabaseCompanies,
  deleteSupabaseCompany,
  importSupabaseProspects,
  createSupabaseAccountFileSignedUrl,
  loadSupabaseState,
  saveSupabaseState
} from "@/lib/supabase-storage";
import { createUuid } from "@/lib/uuid";
import { supabase } from "@/lib/supabase";
import type { AccountFile, AccountFileCategory, Carrier, CommunicationLog, Company, CompanyStatus, Contact, Task, TimelineEntry } from "@/types";

type AppRole = "Admin" | "Operations";
type AppUser = {
  id: string;
  email: string;
  name: string;
  role: AppRole;
};
type ProfileTab = "tasks";
type QuickCreateType = "prospect" | "customer" | "carrier";
type ManualContactInput = {
  name: string;
  role: string;
  phone: string;
  email: string;
};
type ManualTaskInput = {
  title: string;
  owner: string;
  due: string;
  priority: Task["priority"];
};
type ManualEmailLogInput = {
  direction: CommunicationLog["direction"];
  subject: string;
  contactOrEmail: string;
  date: string;
  summary: string;
  followUpNeeded: boolean;
  followUpActionText: string;
  followUpDueDate: string;
};
type CompanyEditInput = {
  name: string;
  status: CompanyStatus;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  website: string;
  primaryContact: string;
  lastContact: string;
};
type NoteSaveResult = {
  contacts: string[];
  tasks: Array<{ title: string; owner: string }>;
  systemUpdates: string[];
};
type SmartNoteReview = {
  companyId: string;
  note: string;
  result: IntentResult;
  newContacts: Contact[];
  selectedContactIds: string[];
  selectedTaskIds: string[];
};
type ProfileTimelineRow = {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
  type: "timeline" | "task";
};
type ThemeMode = "light" | "dark";
type SyncStatus = "synced" | "syncing" | "failed" | "unsaved";
type AppView =
  | "home"
  | "prospects"
  | "customers"
  | "carriers"
  | "prospect-profile"
  | "customer-profile"
  | "carrier-profile";
type TaskFilter = "today" | "tomorrow" | "future" | "completed";
type AccountTab = "all" | "prospects" | "customers" | "carriers";
type ProspectImportRow = {
  companyName: string;
  status: CompanyStatus;
  salesLead: string;
  operationsLead: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  website: string;
  contactName: string;
  contactRole: string;
  contactPhone: string;
  contactEmail: string;
  contacts: Array<{
    name: string;
    title: string;
    phone: string;
    email: string;
  }>;
  notes: string;
};
type ImportFieldKey =
  | "companyName"
  | "status"
  | "address"
  | "city"
  | "state"
  | "zip"
  | "phone"
  | "website"
  | "notes"
  | "contactName"
  | "contactRole"
  | "contactPhone"
  | "contactEmail";
type ImportPreviewRow = {
  rowNumber: number;
  row: ProspectImportRow;
  action: "ready" | "skip";
  skippedReason: string;
};
type ImportPreview = {
  fileName: string;
  detectedColumns: string[];
  normalizedColumns: string[];
  fieldMapping: Record<ImportFieldKey, string>;
  mappedColumns: Array<{ detected: string; mappedTo: string }>;
  confidence: "High Confidence" | "Medium Confidence" | "Low Confidence";
  unmappedColumns: string[];
  rows: ImportPreviewRow[];
};

type CarrierImportRow = {
  carrierName: string;
  mcNumber: string;
  dotNumber: string;
  primaryContact: string;
  dispatchPhone: string;
  dispatchEmail: string;
  mainPhone: string;
  email: string;
  safetyEmail: string;
  accountingEmail: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  equipment: string;
  notes: string;
  status: string;
  w9Status: string;
  coiStatus: string;
  noaStatus: string;
  carrierPacketStatus: string;
};

type CarrierImportFieldKey = keyof CarrierImportRow;

type CarrierImportPreviewRow = {
  rowNumber: number;
  row: CarrierImportRow;
  action: "ready" | "skip";
  skippedReason: string;
  duplicateReason: string;
};

type CarrierImportPreview = {
  fileName: string;
  detectedColumns: string[];
  normalizedColumns: string[];
  fieldMapping: Record<CarrierImportFieldKey, string>;
  mappedColumns: Array<{ detected: string; mappedTo: string }>;
  confidence: "High Confidence" | "Medium Confidence" | "Low Confidence";
  unmappedColumns: string[];
  rows: CarrierImportPreviewRow[];
};

const THEME_STORAGE_KEY = "blue-bomber-theme";

const taskFilters: Array<{ id: TaskFilter; label: string }> = [
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "future", label: "Future" },
  { id: "completed", label: "Completed" }
];

const profileTabs: Array<{ id: ProfileTab; label: string }> = [
  { id: "tasks", label: "Tasks" }
];

const louieQuestions = [
  "What do they ship?",
  "Where do they ship?",
  "How often do they ship?",
  "Who handles freight decisions?",
  "What is the next opportunity?"
];

function mapSupabaseUser(user: User): AppUser {
  const metadataName = [user.user_metadata?.name, user.user_metadata?.full_name]
    .filter(Boolean)
    .join(" ");
  const email = user.email ?? "";
  const identityText = `${email} ${metadataName}`.toLowerCase();

  if (identityText.includes("brian")) {
    return {
      id: user.id,
      email,
      name: "Brian",
      role: "Admin"
    };
  }

  if (identityText.includes("louie")) {
    return {
      id: user.id,
      email,
      name: "Louie",
      role: "Admin"
    };
  }

  return {
    id: user.id,
    email,
    name: metadataName || email.split("@")[0] || "User",
    role: "Operations"
  };
}

function statusLabel(status: CompanyStatus) {
  return status === "prospect" ? "Prospect" : "Customer";
}

function formatSyncStatus(status: SyncStatus, lastSyncedAt: Date | null) {
  if (status === "syncing") {
    return "Syncing...";
  }

  if (status === "failed") {
    return "Sync failed";
  }

  if (status === "unsaved") {
    return "Unsaved changes";
  }

  if (!lastSyncedAt) {
    return "Synced just now";
  }

  const secondsAgo = Math.max(0, Math.floor((Date.now() - lastSyncedAt.getTime()) / 1000));

  return secondsAgo < 60 ? "Synced just now" : "Synced " + Math.floor(secondsAgo / 60) + "m ago";
}

function formatCompanyMeta(company: Company) {
  const location = [company.city, company.state]
    .filter((value) => value && value.toLowerCase() !== "lead")
    .join(", ");
  const fallback = statusLabel(company.status);

  return `${location || fallback} · ${company.segment || fallback}`;
}

function formatLocation(company: Company) {
  return [company.city, company.state]
    .filter((value) => value && value.toLowerCase() !== "lead")
    .join(", ") || "Not set";
}

function getPrimaryContact(company: Company, contacts: Contact[]) {
  return contacts.find((contact) => contact.id === company.primaryContactId) ?? contacts[0] ?? null;
}

function getCompanyWebsite(company: Company) {
  return getSmartNoteField(company, "website");
}

function formatExternalUrl(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  return /^https?:\/\//i.test(trimmedValue) ? trimmedValue : `https://${trimmedValue}`;
}

function getCompanyAddress(company: Company) {
  return getSmartNoteField(company, "address");
}

function getCompanyZip(company: Company) {
  return getSmartNoteField(company, "zip");
}

function formatCityStateZip(company: Company) {
  const city = company.city.trim();
  const state = company.state.trim();
  const zip = getCompanyZip(company).trim();
  const cityState = [city, state].filter(Boolean).join(", ");

  return [cityState, zip].filter(Boolean).join(" ");
}

function getCompanyEquipment(company: Company) {
  return getSmartNoteField(company, "equipment") || company.segment;
}

function getCompanyLanes(company: Company) {
  return getSmartNoteField(company, "lanes");
}

function getSmartNoteField(company: Company, fieldName: string) {
  const fieldLine = company.smartNotes
    .split("\n")
    .find((line) => line.trim().toLowerCase().startsWith(`${fieldName.toLowerCase()}:`));

  return fieldLine?.replace(new RegExp(`^${fieldName}:\\s*`, "i"), "").trim() || "";
}

function setSmartNoteField(notes: string, fieldName: string, value: string) {
  const trimmedValue = value.trim();
  const lines = notes
    .split("\n")
    .filter((line) => !line.trim().toLowerCase().startsWith(`${fieldName.toLowerCase()}:`));

  if (trimmedValue) {
    lines.unshift(`${fieldName}: ${trimmedValue}`);
  }

  return lines.join("\n").trim();
}

function getCompanyTimelineRows(
  company: Company,
  timeline: TimelineEntry[],
  communicationLogs: CommunicationLog[] = []
): ProfileTimelineRow[] {
  return [
    ...timeline
      .filter((entry) => entry.companyId === company.id)
      .map((entry) => ({
        id: entry.id,
        title: entry.at,
        detail: entry.body,
        createdAt: entry.createdAt,
        type: "timeline" as const
      })),
    ...getCommunicationTimelineRows(communicationLogs.filter((log) => log.entityId === company.id))
  ].sort((firstEntry, secondEntry) => secondEntry.createdAt.localeCompare(firstEntry.createdAt));
}

function getCommunicationTimelineRows(communicationLogs: CommunicationLog[]): ProfileTimelineRow[] {
  return communicationLogs.map((log) => ({
    id: log.id,
    title: (log.direction === "sent" ? "Email Sent" : "Email Received") + ": " + log.subject,
    detail: [log.contactOrEmail, log.summary, "Source: " + log.source].filter(Boolean).join(" · "),
    createdAt: log.occurredAt || log.createdAt,
    type: "timeline" as const
  }));
}

function buildAccountSummary(
  company: Company,
  contacts: Contact[],
  openTasks: Task[],
  timelineRows: ProfileTimelineRow[]
) {
  const location = formatLocation(company);
  const primaryContact = getPrimaryContact(company, contacts);
  const latestNote = timelineRows[0]?.detail;
  const nextAction = getNextAction(openTasks);
  const equipment = getCompanyEquipment(company);
  const lanes = getCompanyLanes(company);

  return [
    `${statusLabel(company.status)}${location === "Not set" ? "" : ` in ${location}`}.`,
    primaryContact
      ? `Primary contact: ${primaryContact.name}${primaryContact.role ? `, ${primaryContact.role}` : ""}.`
      : "Primary contact: Not set.",
    `Freight opportunity: ${company.currentOpportunity || "Not set"}${equipment ? ` Equipment: ${equipment}.` : "."}${lanes ? ` Lanes: ${lanes}.` : ""}`,
    latestNote ? `Most recent activity: ${latestNote}` : "Most recent activity: Not set.",
    nextAction
      ? `Next action: ${nextAction.title}${nextAction.due ? ` ${nextAction.due}` : ""}.`
      : "Next action: No Action Scheduled."
  ];
}

function getNextAction(openTasks: Task[]) {
  return [...openTasks].sort((firstTask, secondTask) => secondTask.createdAt.localeCompare(firstTask.createdAt))[0] ?? null;
}

function getMostRecentContact(contacts: Contact[], timelineRows: ProfileTimelineRow[]) {
  const latestContactEvent = timelineRows.find((entry) => entry.title === "Contact Added");

  if (latestContactEvent?.detail) {
    return latestContactEvent.detail;
  }

  return contacts.find((contact) => contact.lastContact === "Today")?.name ?? "";
}

function taskStatusLabel(status: Task["status"]) {
  const labels: Record<Task["status"], string> = {
    open: "Open",
    in_progress: "In Progress",
    waiting: "Waiting",
    completed: "Completed",
    cancelled: "Cancelled",
    overdue: "OVERDUE"
  };

  return labels[status];
}

export default function Home() {
  const [authInitialized, setAuthInitialized] = useState(false);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [companies, setCompanies] = useState(seedCompanies);
  const [contacts, setContacts] = useState(seedContacts);
  const [tasks, setTasks] = useState(seedTasks);
  const [timeline, setTimeline] = useState(seedTimeline);
  const [carrierItems, setCarrierItems] = useState(seedCarriers);
  const [files, setFiles] = useState<AccountFile[]>(seedFiles);
  const [communicationLogs, setCommunicationLogs] = useState<CommunicationLog[]>(seedCommunicationLogs);
  const [hasHydratedStorage, setHasHydratedStorage] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedCarrierId, setSelectedCarrierId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<AppView>("home");
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("today");
  const [globalSearch, setGlobalSearch] = useState("");
  const [showTaskAdvanced, setShowTaskAdvanced] = useState(false);
  const [showProspectForm, setShowProspectForm] = useState(false);
  const [quickCreateType, setQuickCreateType] = useState<QuickCreateType>("prospect");
  const [prospectName, setProspectName] = useState("");
  const [carrierNote, setCarrierNote] = useState("");
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [hasHydratedTheme, setHasHydratedTheme] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [carrierImportResult, setCarrierImportResult] = useState<{
    imported: number;
    skipped: number;
    duplicates: number;
    errors: number;
  } | null>(null);
  const [carrierImportPreview, setCarrierImportPreview] = useState<CarrierImportPreview | null>(null);
  const [isCarrierImporting, setIsCarrierImporting] = useState(false);
  const [selectedBulkProspectIds, setSelectedBulkProspectIds] = useState<string[]>([]);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const carrierImportInputRef = useRef<HTMLInputElement | null>(null);
  const [noteResult, setNoteResult] = useState<NoteSaveResult | null>(null);
  const [smartNoteReview, setSmartNoteReview] = useState<SmartNoteReview | null>(null);
  const [fileCabinetError, setFileCabinetError] = useState("");
  const [showManualActionForm, setShowManualActionForm] = useState(false);
  const [manualActionTitle, setManualActionTitle] = useState("");
  const [manualActionEntityId, setManualActionEntityId] = useState("");
  const [manualActionOwner, setManualActionOwner] = useState("Louie");
  const [manualActionDueDate, setManualActionDueDate] = useState("Today");
  const [manualActionDueTime, setManualActionDueTime] = useState("");
  const [manualActionPriority, setManualActionPriority] = useState<Task["priority"]>("normal");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const syncInFlightRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const skipNextAutoPersistRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    let fallbackTimer: number | null = null;

    if (!supabase) {
      setAuthInitialized(true);
      return () => {
        isMounted = false;
      };
    }

    fallbackTimer = window.setTimeout(() => {
      if (isMounted) {
        setAuthInitialized(true);
      }
    }, 2500);

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("[Blue Bomber Auth] session load failed:", error.message);
      }

      if (!isMounted) {
        return;
      }

      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer);
      }

      const nextUser = data.session?.user ? mapSupabaseUser(data.session.user) : null;

      if (nextUser) {
        console.log("[Blue Bomber Auth] session found:", {
          name: nextUser.name,
          role: nextUser.role
        });
      } else {
        console.log("[Blue Bomber Auth] no active session");
      }

      setAppUser(nextUser);
      setAuthInitialized(true);
    });

    const {
      data: { subscription }
    } = supabase?.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ? mapSupabaseUser(session.user) : null;

      if (nextUser) {
        console.log("[Blue Bomber Auth] logged in user:", {
          name: nextUser.name,
          role: nextUser.role
        });
      }

      setAppUser(nextUser);
      setShowUserMenu(false);

      if (!session?.user) {
        setHasHydratedStorage(false);
      }
    }) ?? { data: { subscription: null } };

    return () => {
      isMounted = false;
      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer);
      }
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const nextTheme = storedTheme === "dark" ? "dark" : "light";

    setThemeMode(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    setHasHydratedTheme(true);
  }, []);

  useEffect(() => {
    if (!hasHydratedTheme) {
      return;
    }

    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [hasHydratedTheme, themeMode]);

  const hasBlockingLocalEdits = useCallback(() => {
    if (saveInFlightRef.current || smartNoteReview || showProspectForm || showManualActionForm || importPreview || isImporting || carrierImportPreview || isCarrierImporting) {
      return true;
    }

    const activeElement = document.activeElement as HTMLElement | null;

    if (!activeElement) {
      return false;
    }

    return Boolean(
      activeElement.closest(".command-center") ||
        activeElement.closest(".louie-questions-card") ||
        activeElement.closest(".manual-form") ||
        activeElement.closest(".prospect-form") ||
        activeElement.closest(".new-menu-panel") ||
        activeElement.getAttribute("role") === "dialog"
    );
  }, [carrierImportPreview, importPreview, isCarrierImporting, isImporting, showManualActionForm, showProspectForm, smartNoteReview]);

  const applySyncedState = useCallback((nextState: StoredBlueBomberState) => {
    skipNextAutoPersistRef.current = true;
    setCompanies(nextState.companies);
    setContacts(nextState.contacts);
    setTasks(nextState.tasks);
    setTimeline(nextState.timeline);
    setCarrierItems(nextState.carriers.length ? nextState.carriers : seedCarriers);
    setFiles(nextState.files ?? []);
    setCommunicationLogs(nextState.communicationLogs ?? []);
    saveStoredState(nextState);
  }, []);

  const loadLatestState = useCallback(async (): Promise<StoredBlueBomberState | null> => {
    if (canUseSupabase()) {
      const supabaseState = await loadSupabaseState();

      if (supabaseState) {
        return {
          companies: supabaseState.companies,
          contacts: supabaseState.contacts,
          tasks: supabaseState.tasks,
          timeline: supabaseState.timeline,
          carriers: supabaseState.carriers,
          files: supabaseState.files ?? [],
          communicationLogs: supabaseState.communicationLogs ?? []
        };
      }
    }

    const storedState = loadStoredState();

    if (!storedState) {
      return null;
    }

    return {
      companies: storedState.companies,
      contacts: storedState.contacts,
      tasks: storedState.tasks,
      timeline: storedState.timeline,
      carriers: storedState.carriers.length ? storedState.carriers : seedCarriers,
      files: storedState.files ?? [],
      communicationLogs: storedState.communicationLogs ?? []
    };
  }, []);

  const refreshLatestData = useCallback(async (reason = "manual") => {
    if (!appUser || syncInFlightRef.current) {
      return;
    }

    if (hasBlockingLocalEdits()) {
      setSyncStatus("unsaved");
      return;
    }

    syncInFlightRef.current = true;
    saveInFlightRef.current = true;
    setSyncStatus("syncing");

    try {
      const nextState = await loadLatestState();

      if (nextState) {
        applySyncedState(nextState);
      }

      setLastSyncedAt(new Date());
      setSyncStatus("synced");
      console.log("[Blue Bomber Sync] refresh success:", reason);
    } catch (error) {
      setSyncStatus("failed");
      console.error("[Blue Bomber Sync] refresh failed:", error instanceof Error ? error.message : error);
    } finally {
      syncInFlightRef.current = false;
    }
  }, [appUser, applySyncedState, hasBlockingLocalEdits, loadLatestState]);

  useEffect(() => {
    if (!authInitialized || !appUser) {
      return;
    }

    let isMounted = true;

    async function hydrateState() {
      setSyncStatus("syncing");

      try {
        const nextState = await loadLatestState();

        if (nextState && isMounted) {
          applySyncedState(nextState);
          setLastSyncedAt(new Date());
          setSyncStatus("synced");
        }
      } catch {
        const storedState = loadStoredState();

        if (storedState && isMounted) {
          applySyncedState({
            companies: storedState.companies,
            contacts: storedState.contacts,
            tasks: storedState.tasks,
            timeline: storedState.timeline,
            carriers: storedState.carriers.length ? storedState.carriers : seedCarriers,
            files: storedState.files ?? [],
            communicationLogs: storedState.communicationLogs ?? []
          });
        }

        setSyncStatus("failed");
      } finally {
        if (isMounted) {
          setHasHydratedStorage(true);
        }
      }
    }

    hydrateState();

    return () => {
      isMounted = false;
    };
  }, [appUser, applySyncedState, authInitialized, loadLatestState]);

  useEffect(() => {
    if (!hasHydratedStorage) {
      return;
    }

    if (skipNextAutoPersistRef.current) {
      skipNextAutoPersistRef.current = false;
      return;
    }

    persistState({
      companies,
      contacts,
      tasks,
      timeline,
      carriers: carrierItems,
      files,
      communicationLogs
    });
  }, [carrierItems, communicationLogs, companies, contacts, files, hasHydratedStorage, tasks, timeline]);

  useEffect(() => {
    if (!hasHydratedStorage || !appUser) {
      return;
    }

    let timer: number | null = null;
    let isCancelled = false;

    function scheduleNextRefresh() {
      if (isCancelled) {
        return;
      }

      const intervalMs = document.hidden ? 120000 : 30000;
      timer = window.setTimeout(() => {
        void refreshLatestData(document.hidden ? "auto-hidden" : "auto").finally(scheduleNextRefresh);
      }, intervalMs);
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        return;
      }

      if (timer) {
        window.clearTimeout(timer);
      }

      void refreshLatestData("tab-active").finally(scheduleNextRefresh);
    }

    scheduleNextRefresh();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isCancelled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [appUser, hasHydratedStorage, refreshLatestData]);

  useEffect(() => {
    if (!hasHydratedStorage) {
      return;
    }

    const nextTasks = tasks.map((task) =>
      shouldMarkTaskOverdue(task) ? { ...task, status: "overdue" as const } : task
    );
    const hasOverdueChanges = nextTasks.some((task, index) => task.status !== tasks[index].status);

    if (!hasOverdueChanges) {
      return;
    }

    setTasks(nextTasks);
    persistState({ tasks: nextTasks }, "marking overdue tasks");
  }, [hasHydratedStorage, tasks]);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  );
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks]
  );
  const selectedCarrier = useMemo(
    () => carrierItems.find((carrier) => carrier.id === selectedCarrierId) ?? null,
    [carrierItems, selectedCarrierId]
  );
  const visibleCompanies = useMemo(
    () => companies.filter((company) => company.active !== false),
    [companies]
  );
  const visibleCompanyIds = useMemo(
    () => new Set(visibleCompanies.map((company) => company.id)),
    [visibleCompanies]
  );
  const carrierIds = useMemo(
    () => new Set(carrierItems.map((carrier) => carrier.id)),
    [carrierItems]
  );

  const taskEntityNameById = useMemo(
    () => entityNameById(visibleCompanies, carrierItems),
    [carrierItems, visibleCompanies]
  );
  const taskSearchTextById = useMemo(
    () => entitySearchTextById(visibleCompanies, carrierItems, contacts, timeline),
    [carrierItems, contacts, timeline, visibleCompanies]
  );
  const activeTasks = useMemo(
    () =>
      tasks
        .filter((task) => isActiveTask(task) && isVisibleTaskEntity(task, visibleCompanyIds, carrierIds))
        .sort(compareTasksByDueThenCreated),
    [carrierIds, tasks, visibleCompanyIds]
  );
  const taskCounters = useMemo(
    () => ({
      open: activeTasks.length,
      dueToday: activeTasks.filter((task) => isTaskDueToday(task)).length,
      overdue: activeTasks.filter((task) => isTaskOverdue(task)).length,
      completedToday: tasks.filter((task) => task.status === "completed" && wasTaskCompletedToday(task)).length
    }),
    [activeTasks, tasks]
  );
  const actionFilterCounts = useMemo(
    () => ({
      today: activeTasks.filter((task) => isTaskOverdue(task) || isTaskDueToday(task)).length,
      tomorrow: activeTasks.filter((task) => isTaskDueTomorrow(task)).length,
      future: activeTasks.filter((task) => isTaskDueAfterTomorrow(task)).length,
      completed: tasks.filter((task) => task.status === "completed").length
    }),
    [activeTasks, tasks]
  );
  const taskItems = useMemo(
    () =>
      tasks
        .filter((task) => {
          if (!isVisibleTaskEntity(task, visibleCompanyIds, carrierIds)) {
            return false;
          }

          if (taskFilter === "completed") {
            return task.status === "completed";
          }

          if (!isActiveTask(task)) {
            return false;
          }

          if (taskFilter === "today") {
            return isTaskOverdue(task) || isTaskDueToday(task);
          }

          if (taskFilter === "tomorrow") {
            return isTaskDueTomorrow(task);
          }

          if (taskFilter === "future") {
            return isTaskDueAfterTomorrow(task);
          }

          return true;
        })
        .filter((task) => doesTaskMatchSearch(task, taskSearchTextById, globalSearch))
        .sort(compareTasksByDueThenCreated),
    [carrierIds, globalSearch, taskFilter, taskSearchTextById, tasks, visibleCompanyIds]
  );
  const selectedCompanyTasks = selectedCompany
    ? tasks.filter((task) => task.companyId === selectedCompany.id)
    : [];
  const selectedCarrierTasks = selectedCarrier
    ? tasks.filter((task) => getTaskEntityType(task, companies, carrierItems) === "carrier" && getTaskEntityId(task) === selectedCarrier.id)
    : [];
  const companyContacts = selectedCompany
    ? contacts.filter((contact) => contact.companyId === selectedCompany.id)
    : [];
  const prospectCompanies = useMemo(
    () =>
      visibleCompanies
        .filter((company) => company.status === "prospect")
        .filter((company) => doesCompanyMatchGlobalSearch(company, contacts, tasks, timeline, globalSearch)),
    [contacts, globalSearch, tasks, timeline, visibleCompanies]
  );
  const customerCompanies = useMemo(
    () =>
      visibleCompanies
        .filter((company) => company.status === "customer")
        .filter((company) => doesCompanyMatchGlobalSearch(company, contacts, tasks, timeline, globalSearch)),
    [contacts, globalSearch, tasks, timeline, visibleCompanies]
  );
  const visibleCarriers = useMemo(
    () => carrierItems.filter((carrier) => doesCarrierMatchGlobalSearch(carrier, tasks, globalSearch)),
    [carrierItems, globalSearch, tasks]
  );
  const pageTitle = getPageTitle(currentView, selectedCompany, selectedCarrier);
  const currentUserName = appUser?.name ?? "Blue Bomber OS";
  const isAdmin = appUser?.role === "Admin";

  async function login(email: string, password: string) {
    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }
  }

  async function logout() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setAppUser(null);
    setSelectedCompanyId(null);
    setSelectedCarrierId(null);
    setSelectedTaskId(null);
    setCurrentView("home");
  }

  function selectCompany(companyId: string) {
    const company = companies.find((companyItem) => companyItem.id === companyId);

    if (!company) {
      return;
    }

    setSelectedCompanyId(company.id);
    setSelectedCarrierId(null);
    setSelectedTaskId(null);
    setCurrentView(company.status === "customer" ? "customer-profile" : "prospect-profile");
  }

  function selectTask(task: Task) {
    setSelectedTaskId(task.id);

    if (getTaskEntityType(task, companies, carrierItems) === "carrier") {
      const carrier = carrierItems.find((carrierItem) => carrierItem.id === getTaskEntityId(task));

      if (!carrier) {
        return;
      }

      setSelectedCarrierId(carrier.id);
      setSelectedCompanyId(null);
      setCurrentView("carrier-profile");
      return;
    }

    const company = companies.find((companyItem) => companyItem.id === task.companyId);

    if (!company) {
      return;
    }

    setSelectedCompanyId(company.id);
    setSelectedCarrierId(null);
    setCurrentView(company.status === "customer" ? "customer-profile" : "prospect-profile");
  }

  function openTaskEntity(task: Task) {
    if (getTaskEntityType(task, companies, carrierItems) === "carrier") {
      const carrier = carrierItems.find((carrierItem) => carrierItem.id === getTaskEntityId(task));

      if (!carrier) {
        return;
      }

      setSelectedCarrierId(carrier.id);
      setSelectedCompanyId(null);
      setSelectedTaskId(null);
      setCurrentView("carrier-profile");
      return;
    }

    const company = companies.find((companyItem) => companyItem.id === task.companyId);

    if (!company) {
      return;
    }

    setSelectedCompanyId(company.id);
    setSelectedCarrierId(null);
    setSelectedTaskId(null);
    setCurrentView(company.status === "customer" ? "customer-profile" : "prospect-profile");
  }

  function openTaskDetail(task: Task) {
    setSelectedTaskId((currentTaskId) => (currentTaskId === task.id ? null : task.id));
  }

  function updateTaskLifecycle(
    task: Task,
    updates: Partial<Task>,
    eventTitle: string,
    eventDetail: string
  ) {
    const updatedTask = { ...task, ...updates };
    const nextTasks = tasks.map((taskItem) => (taskItem.id === task.id ? updatedTask : taskItem));
    const event = createTaskTimelineEvent(updatedTask, eventTitle, eventDetail);
    const nextTimeline = event ? [event, ...timeline] : timeline;

    setTasks(nextTasks);
    setTimeline(nextTimeline);
    persistState({
      tasks: nextTasks,
      timeline: nextTimeline
    }, eventTitle.toLowerCase());
  }

  function completeTask(task: Task) {
    const completedByInput = window.prompt("Completed by: Brian or Louie", currentUserName)?.trim();
    const completedBy = completedByInput?.toLowerCase() === "brian"
      ? "Brian"
      : completedByInput?.toLowerCase() === "louie"
        ? "Louie"
        : currentUserName;
    const completedAt = new Date();

    updateTaskLifecycle(
      task,
      {
        status: "completed",
        completedAt: completedAt.toISOString()
      },
      "Action Completed",
      `Action Completed: ${task.title}\nCompleted by ${completedBy}\n${formatDateTime(completedAt)}`
    );
  }

  function setTaskDue(task: Task, due: string) {
    updateTaskLifecycle(
      task,
      {
        due,
        status: task.status === "completed" || task.status === "cancelled" ? task.status : "open"
      },
      "Action Snoozed",
      `${task.title} moved to ${due} by ${currentUserName}.`
    );
  }

  function reassignTask(task: Task) {
    const nextOwner = window.prompt("Assign task to", task.owner)?.trim();

    if (!nextOwner || nextOwner === task.owner) {
      return;
    }

    updateTaskLifecycle(
      task,
      { owner: nextOwner },
      "Action Reassigned",
      `${task.title} reassigned from ${task.owner} to ${nextOwner} by ${currentUserName}.`
    );
  }

  function editTask(task: Task) {
    const nextTitle = window.prompt("Action name", task.title)?.trim();

    if (!nextTitle) {
      return;
    }

    const nextDue = window.prompt("Due date", task.due)?.trim() || task.due;
    const nextStatusInput = window
      .prompt("Status: open, in_progress, waiting, completed, cancelled", task.status)
      ?.trim()
      .toLowerCase();
    const nextStatus = parseTaskStatus(nextStatusInput) ?? task.status;

    updateTaskLifecycle(
      task,
      {
        title: nextTitle,
        due: nextDue,
        status: nextStatus === "overdue" && !isTaskOverdue({ ...task, due: nextDue }) ? "open" : nextStatus
      },
      "Action Edited",
      `${task.title} edited by ${currentUserName}.`
    );
  }

  function selectCarrier(carrierId: string) {
    setSelectedCarrierId(carrierId);
    setSelectedCompanyId(null);
    setSelectedTaskId(null);
    setCurrentView("carrier-profile");
  }

  function openView(view: AppView) {
    setCurrentView(view);
    setSelectedTaskId(null);
    setSelectedCarrierId(null);

    if (view === "home" || view === "prospects" || view === "customers" || view === "carriers") {
      setSelectedCompanyId(null);
      setSelectedBulkProspectIds([]);
    }
  }

  function toggleBulkProspect(companyId: string) {
    setSelectedBulkProspectIds((currentIds) =>
      currentIds.includes(companyId)
        ? currentIds.filter((currentId) => currentId !== companyId)
        : [...currentIds, companyId]
    );
  }

  function toggleVisibleBulkProspects(companyIds: string[]) {
    if (!companyIds.length) {
      return;
    }

    setSelectedBulkProspectIds((currentIds) => {
      const visibleIds = new Set(companyIds);
      const allVisibleSelected = companyIds.every((companyId) => currentIds.includes(companyId));

      if (allVisibleSelected) {
        return currentIds.filter((currentId) => !visibleIds.has(currentId));
      }

      return Array.from(new Set([...currentIds, ...companyIds]));
    });
  }

  async function persistStateToStorage(state: {
    companies: typeof companies;
    contacts: typeof contacts;
    tasks: typeof tasks;
    timeline: typeof timeline;
    carriers: typeof carrierItems;
    files: typeof files;
    communicationLogs: typeof communicationLogs;
  }, reason: string) {
    setSyncStatus("syncing");

    try {
      const savedToSupabase = await saveSupabaseState(state);

      saveStoredState(state);
      console.log("[Blue Bomber Supabase] save result:", savedToSupabase ? "success" : "localStorage fallback");

      if (savedToSupabase) {
        setLastSyncedAt(new Date());
        setSyncStatus("synced");
      } else {
        setSyncStatus("failed");
        console.warn("[Blue Bomber Supabase] localStorage fallback used:", reason);
      }
    } catch (error) {
      console.error("[Blue Bomber Supabase] localStorage fallback after Supabase error:", {
        reason,
        error: error instanceof Error ? error.message : error
      });
      setSyncStatus("failed");
      saveStoredState(state);
    } finally {
      saveInFlightRef.current = false;
    }
  }

  function persistState(overrides: {
    companies?: typeof companies;
    contacts?: typeof contacts;
    tasks?: typeof tasks;
    timeline?: typeof timeline;
    carriers?: typeof carrierItems;
    files?: typeof files;
    communicationLogs?: typeof communicationLogs;
  }, reason = "state change") {
    void persistStateToStorage({
      companies: overrides.companies ?? companies,
      contacts: overrides.contacts ?? contacts,
      tasks: overrides.tasks ?? tasks,
      timeline: overrides.timeline ?? timeline,
      carriers: overrides.carriers ?? carrierItems,
      files: overrides.files ?? files,
      communicationLogs: overrides.communicationLogs ?? communicationLogs
    }, reason);
  }

  async function addProspect() {
  const trimmedName = prospectName.trim();

  if (!trimmedName) {
    return;
  }

  if (quickCreateType === "carrier") {
    const newCarrier: Carrier = {
      id: createUuid(),
      name: trimmedName,
      city: "New",
      state: "Carrier",
      equipment: "Equipment TBD"
    };
    const nextCarriers = [newCarrier, ...carrierItems];

    setCarrierItems(nextCarriers);
    persistState({ carriers: nextCarriers }, "creating carrier");
    setSelectedCarrierId(newCarrier.id);
    setSelectedCompanyId(null);
    setCurrentView("carrier-profile");
    setProspectName("");
    setShowProspectForm(false);
    return;
  }

  const companyStatus = quickCreateType === "customer" ? "customer" : "prospect";

  if (companyStatus === "prospect") {
    const response = await fetch("/api/blue-bomber", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "CREATE_PROSPECT",
        data: {
          companyName: trimmedName,
          contact: "",
          email: "",
          assignedTo: "Brian",
          notes: "Created from Blue Bomber OS web app."
        }
      })
    });

    const result = await response.json();

    if (!result.success) {
      alert(result.message || "Blue Bomber automation failed.");
      return;
    }
  }

  const newCompany: Company = {
    id: createUuid(),
    name: trimmedName,
    status: companyStatus,
    city: "New",
    state: statusLabel(companyStatus),
    segment: statusLabel(companyStatus),
    currentOpportunity: `New ${statusLabel(companyStatus).toLowerCase()}. Add freight notes after first contact.`,
    smartNotes: "",
    salesLead: "Louie",
    operationsLead: "Brian",
    primaryContactId: "",
    lastContact: "",
    lastActivity: "Today",
    active: true,
    qualifyingQuestions: Object.fromEntries(
      qualifyingQuestions.map((question) => [question, ""])
    )
  };

  const nextCompanies = [newCompany, ...companies];

  setCompanies(nextCompanies);
  persistState({ companies: nextCompanies }, "creating company");
  setSelectedCompanyId(newCompany.id);
  setSelectedCarrierId(null);
  setCurrentView(companyStatus === "customer" ? "customer-profile" : "prospect-profile");
  setProspectName("");
  setShowProspectForm(false);
}

  function openQuickCreate(type: QuickCreateType) {
    setQuickCreateType(type);
    setProspectName("");
    setShowProspectForm(true);
    setShowNewMenu(false);
  }

  function addManualContact(company: Company, values: ManualContactInput) {
    const trimmedName = values.name.trim();

    if (!trimmedName) {
      return;
    }

    const now = new Date().toISOString();
    const newContact: Contact = {
      id: createUuid(),
      companyId: company.id,
      name: trimmedName,
      role: values.role.trim(),
      phone: values.phone.trim(),
      email: values.email.trim(),
      lastContact: "",
      source: "Manual",
      createdBy: currentUserName
    };
    const nextContacts = [newContact, ...contacts];
    const nextCompanies = companies.map((companyItem) =>
      companyItem.id === company.id
        ? {
            ...companyItem,
            primaryContactId: companyItem.primaryContactId || newContact.id,
            lastActivity: "Today"
          }
        : companyItem
    );
    const nextTimeline = [
      {
        id: createUuid(),
        companyId: company.id,
        at: "Contact Added",
        body: `${newContact.name}${newContact.role ? `, ${newContact.role}` : ""} · Added by ${currentUserName}`,
        createdAt: now
      },
      ...timeline
    ];

    setContacts(nextContacts);
    setCompanies(nextCompanies);
    setTimeline(nextTimeline);
    persistState({
      companies: nextCompanies,
      contacts: nextContacts,
      timeline: nextTimeline
    }, "adding manual contact");
  }

  function repairImportedContacts(company: Company) {
    const companyContacts = contacts.filter((contact) => contact.companyId === company.id);
    const repairableContacts = companyContacts
      .map((contact) => ({
        original: contact,
        parts: parseImportedContactParts(contact.name, contact.role)
      }))
      .filter(({ parts }) => parts.length > 1);

    if (!repairableContacts.length) {
      return;
    }

    if (!window.confirm("Repair imported contacts for this account?")) {
      return;
    }

    const repairedOriginalIds = new Set(repairableContacts.map(({ original }) => original.id));
    const existingKeys = new Set(
      contacts
        .filter((contact) => contact.companyId === company.id && !repairedOriginalIds.has(contact.id))
        .map((contact) => `${normalizeCompanyName(contact.name)}:${contact.email.toLowerCase()}`)
    );
    const repairedContacts = repairableContacts.flatMap(({ original, parts }) =>
      parts
        .map((part) => ({
          id: createUuid(),
          companyId: company.id,
          name: part.name,
          role: part.title || original.role || "Imported",
          email: original.email,
          phone: original.phone,
          lastContact: original.lastContact,
          source: "Import Repair",
          createdBy: currentUserName
        }) satisfies Contact)
        .filter((contact) => {
          const key = `${normalizeCompanyName(contact.name)}:${contact.email.toLowerCase()}`;

          if (existingKeys.has(key)) {
            return false;
          }

          existingKeys.add(key);
          return true;
        })
    );

    if (!repairedContacts.length) {
      return;
    }

    const nextContacts = [
      ...repairedContacts,
      ...contacts.filter((contact) => !repairedOriginalIds.has(contact.id))
    ];
    const primaryReplacement = repairedContacts[0];
    const nextCompanies = companies.map((companyItem) =>
      companyItem.id === company.id
        ? {
            ...companyItem,
            primaryContactId: repairedOriginalIds.has(companyItem.primaryContactId)
              ? primaryReplacement.id
              : companyItem.primaryContactId,
            lastActivity: "Contacts repaired"
          }
        : companyItem
    );
    const nextTimeline = [
      {
        id: createUuid(),
        companyId: company.id,
        at: "Contacts Repaired",
        body: `Repaired ${repairedContacts.length} imported contacts.`,
        createdAt: new Date().toISOString()
      },
      ...timeline
    ];

    setContacts(nextContacts);
    setCompanies(nextCompanies);
    setTimeline(nextTimeline);
    persistState({
      companies: nextCompanies,
      contacts: nextContacts,
      timeline: nextTimeline
    }, "repairing imported contacts");
  }

  function createFollowUpTask({
    entityId,
    entityType,
    sourceName,
    title,
    due,
    sourceNote
  }: {
    entityId: string;
    entityType: Task["entityType"];
    sourceName: string;
    title: string;
    due: string;
    sourceNote: string;
  }) {
    const now = new Date().toISOString();

    return {
      id: createUuid(),
      companyId: entityId,
      entityId,
      entityType,
      title,
      due: due || "Today",
      priority: "normal" as const,
      status: "open" as const,
      createdAt: now,
      owner: currentUserName,
      createdBy: currentUserName,
      sourceCompany: sourceName,
      sourceNote
    } satisfies Task;
  }

  function addManualTask(company: Company, values: ManualTaskInput) {
    const trimmedTitle = values.title.trim();

    if (!trimmedTitle) {
      return;
    }

    const now = new Date().toISOString();
    const newTask: Task = {
      id: createUuid(),
      companyId: company.id,
      entityId: company.id,
      entityType: company.status,
      title: trimmedTitle,
      due: values.due.trim() || "Today",
      priority: values.priority,
      status: "open",
      createdAt: now,
      owner: values.owner.trim() || "Louie",
      createdBy: currentUserName,
      sourceCompany: company.name,
      sourceNote: "Manual task"
    };
    const taskTimelineEvent = createTaskTimelineEvent(
      newTask,
      "Action Created",
      `${newTask.title} created for ${newTask.owner} by ${currentUserName}.`
    );
    const nextTasks = [newTask, ...tasks];
    const nextTimeline = taskTimelineEvent ? [taskTimelineEvent, ...timeline] : timeline;

    setTasks(nextTasks);
    setTimeline(nextTimeline);
    persistState({
      tasks: nextTasks,
      timeline: nextTimeline
    }, "adding manual task");
  }

  function logCompanyEmail(company: Company, values: ManualEmailLogInput) {
    const subject = values.subject.trim();

    if (!subject) {
      return;
    }

    const now = new Date().toISOString();
    const occurredAt = dateInputToIso(values.date) || now;
    const newLog: CommunicationLog = {
      id: createUuid(),
      entityId: company.id,
      entityType: company.status,
      direction: values.direction,
      subject,
      contactOrEmail: values.contactOrEmail.trim(),
      occurredAt,
      summary: values.summary.trim(),
      followUpNeeded: values.followUpNeeded,
      followUpActionText: values.followUpActionText.trim(),
      followUpDueDate: values.followUpDueDate.trim(),
      source: "Outlook",
      createdAt: now,
      createdBy: currentUserName
    };
    const followUpTask = values.followUpNeeded && newLog.followUpActionText
      ? createFollowUpTask({
          entityId: company.id,
          entityType: company.status,
          sourceName: company.name,
          title: newLog.followUpActionText,
          due: newLog.followUpDueDate || "Today",
          sourceNote: "Manual email log: " + subject
        })
      : null;
    const taskEvent = followUpTask
      ? createTaskTimelineEvent(
          followUpTask,
          "Action Created",
          followUpTask.title + " created for " + followUpTask.owner + " from manual email log."
        )
      : null;
    const nextCommunicationLogs = [newLog, ...communicationLogs];
    const nextTasks = followUpTask ? [followUpTask, ...tasks] : tasks;
    const nextTimeline = taskEvent ? [taskEvent, ...timeline] : timeline;
    const nextCompanies = companies.map((companyItem) =>
      companyItem.id === company.id
        ? {
            ...companyItem,
            lastContact: formatShortDate(occurredAt),
            lastActivity: "Email Logged"
          }
        : companyItem
    );

    setCommunicationLogs(nextCommunicationLogs);
    setTasks(nextTasks);
    setTimeline(nextTimeline);
    setCompanies(nextCompanies);
    persistState({
      companies: nextCompanies,
      tasks: nextTasks,
      timeline: nextTimeline,
      communicationLogs: nextCommunicationLogs
    }, followUpTask ? "logging email and creating follow-up" : "logging email");
    setNoteResult({
      contacts: [],
      tasks: followUpTask ? [{ title: followUpTask.title, owner: followUpTask.owner }] : [],
      systemUpdates: [(newLog.direction === "sent" ? "Email Sent" : "Email Received") + ": " + subject, "Source: " + newLog.source]
    });
    window.setTimeout(() => setNoteResult(null), 5000);
  }

  function logCarrierEmail(carrier: Carrier, values: ManualEmailLogInput) {
    const subject = values.subject.trim();

    if (!subject) {
      return;
    }

    const now = new Date().toISOString();
    const occurredAt = dateInputToIso(values.date) || now;
    const newLog: CommunicationLog = {
      id: createUuid(),
      entityId: carrier.id,
      entityType: "carrier",
      direction: values.direction,
      subject,
      contactOrEmail: values.contactOrEmail.trim(),
      occurredAt,
      summary: values.summary.trim(),
      followUpNeeded: values.followUpNeeded,
      followUpActionText: values.followUpActionText.trim(),
      followUpDueDate: values.followUpDueDate.trim(),
      source: "Gmail Operations",
      createdAt: now,
      createdBy: currentUserName
    };
    const followUpTask = values.followUpNeeded && newLog.followUpActionText
      ? createFollowUpTask({
          entityId: carrier.id,
          entityType: "carrier",
          sourceName: carrier.name,
          title: newLog.followUpActionText,
          due: newLog.followUpDueDate || "Today",
          sourceNote: "Manual email log: " + subject
        })
      : null;
    const nextCommunicationLogs = [newLog, ...communicationLogs];
    const nextTasks = followUpTask ? [followUpTask, ...tasks] : tasks;

    setCommunicationLogs(nextCommunicationLogs);
    setTasks(nextTasks);
    persistState({
      tasks: nextTasks,
      communicationLogs: nextCommunicationLogs
    }, followUpTask ? "logging carrier email and creating follow-up" : "logging carrier email");
    setNoteResult({
      contacts: [],
      tasks: followUpTask ? [{ title: followUpTask.title, owner: followUpTask.owner }] : [],
      systemUpdates: [(newLog.direction === "sent" ? "Email Sent" : "Email Received") + ": " + subject, "Source: " + newLog.source]
    });
    window.setTimeout(() => setNoteResult(null), 5000);
  }

  function addGlobalManualAction() {
    const trimmedTitle = manualActionTitle.trim();

    if (!trimmedTitle || !manualActionEntityId) {
      return;
    }

    const company = companies.find((companyItem) => companyItem.id === manualActionEntityId);
    const carrier = carrierItems.find((carrierItem) => carrierItem.id === manualActionEntityId);

    if (!company && !carrier) {
      return;
    }

    const due = [manualActionDueDate.trim() || "Today", manualActionDueTime.trim()]
      .filter(Boolean)
      .join(" ");
    const now = new Date().toISOString();
    const newTask: Task = {
      id: createUuid(),
      companyId: manualActionEntityId,
      entityId: manualActionEntityId,
      entityType: carrier ? "carrier" : company?.status,
      title: trimmedTitle,
      due,
      priority: manualActionPriority,
      status: "open",
      createdAt: now,
      owner: manualActionOwner.trim() || "Louie",
      createdBy: currentUserName,
      sourceCompany: company?.name ?? carrier?.name ?? "",
      sourceNote: "Manual action"
    };
    const event = createTaskTimelineEvent(
      newTask,
      "Action Created",
      `${newTask.title} created for ${newTask.owner} by ${currentUserName}.`
    );
    const nextTasks = [newTask, ...tasks];
    const nextTimeline = event ? [event, ...timeline] : timeline;

    setTasks(nextTasks);
    setTimeline(nextTimeline);
    persistState({ tasks: nextTasks, timeline: nextTimeline }, "adding global manual action");
    setManualActionTitle("");
    setManualActionEntityId("");
    setManualActionOwner("Louie");
    setManualActionDueDate("Today");
    setManualActionDueTime("");
    setManualActionPriority("normal");
    setShowManualActionForm(false);
  }

  function updateCompanyProfile(company: Company, values: CompanyEditInput) {
    const now = new Date().toISOString();
    const trimmedPrimaryName = values.primaryContact.trim();
    const companyContact = contacts.find(
      (contact) =>
        contact.companyId === company.id &&
        trimmedPrimaryName &&
        normalizeCompanyName(contact.name) === normalizeCompanyName(trimmedPrimaryName)
    );
    const newPrimaryContact =
      trimmedPrimaryName && !companyContact
        ? {
            id: createUuid(),
            companyId: company.id,
            name: trimmedPrimaryName,
            role: "",
            email: "",
            phone: values.phone.trim(),
            lastContact: values.lastContact.trim(),
            source: "Manual",
            createdBy: currentUserName
          } satisfies Contact
        : null;
    const primaryContactId = companyContact?.id ?? newPrimaryContact?.id ?? company.primaryContactId;
    const nextContacts = contacts
      .map((contact) =>
        contact.id === primaryContactId
          ? {
              ...contact,
              name: trimmedPrimaryName || contact.name,
              phone: values.phone.trim(),
              lastContact: values.lastContact.trim() || contact.lastContact
            }
          : contact
      )
      .concat(newPrimaryContact ? [newPrimaryContact] : []);
    const nextCompanies = companies.map((companyItem) => {
      if (companyItem.id !== company.id) {
        return companyItem;
      }

      let smartNotes = companyItem.smartNotes;
      smartNotes = setSmartNoteField(smartNotes, "Address", values.address);
      smartNotes = setSmartNoteField(smartNotes, "Zip", values.zip);
      smartNotes = setSmartNoteField(smartNotes, "Website", values.website);

      return {
        ...companyItem,
        name: values.name.trim() || companyItem.name,
        status: values.status,
        city: values.city.trim(),
        state: values.state.trim(),
        smartNotes,
        primaryContactId,
        lastContact: values.lastContact.trim(),
        lastActivity: "Today"
      };
    });
    const nextTimeline = [
      {
        id: createUuid(),
        companyId: company.id,
        at: "Account Updated",
        body: `Account details updated by ${currentUserName}.`,
        createdAt: now
      },
      ...timeline
    ];

    setCompanies(nextCompanies);
    setContacts(nextContacts);
    setTimeline(nextTimeline);
    persistState({
      companies: nextCompanies,
      contacts: nextContacts,
      timeline: nextTimeline
    }, "updating company profile");

    if (values.status !== company.status) {
      setCurrentView(values.status === "customer" ? "customer-profile" : "prospect-profile");
    }
  }

  function convertProspectToCustomer(company: Company) {
    if (company.status !== "prospect") {
      return;
    }

    if (!window.confirm("Convert this prospect to customer?")) {
      return;
    }

    updateCompanyProfile(company, {
      name: company.name,
      status: "customer",
      address: getCompanyAddress(company),
      city: company.city,
      state: company.state,
      zip: getCompanyZip(company),
      phone: getPrimaryContact(company, contacts)?.phone ?? "",
      website: getCompanyWebsite(company),
      primaryContact: getPrimaryContact(company, contacts)?.name ?? "",
      lastContact: company.lastContact
    });
  }

  async function uploadAccountFile(
    accountId: string,
    accountType: AccountFile["accountType"],
    file: File,
    category: AccountFileCategory
  ) {
    setFileCabinetError("");

    try {
      const account = accountType === "carrier"
        ? carrierItems.find((carrier) => carrier.id === accountId)
        : companies.find((company) => company.id === accountId);
      const formData = new FormData();

      formData.append("file", file);
      formData.append("accountId", accountId);
      formData.append("accountType", accountType);
      formData.append("accountName", account?.name ?? "Unknown Account");
      formData.append("accountStatus", accountType === "carrier" ? "carrier" : (account as Company | undefined)?.status ?? "prospect");
      formData.append("category", category);
      formData.append("uploadedBy", currentUserName);

      const response = await fetch("/api/file-cabinet/upload", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as { file?: AccountFile; error?: string };

      if (!response.ok || !payload.file) {
        throw new Error(payload.error || "File upload failed.");
      }

      const nextFiles = [payload.file, ...files.filter((existingFile) => existingFile.id !== payload.file?.id)];

      setFiles(nextFiles);
      persistState({ files: nextFiles }, "uploading account file");
    } catch (error) {
      const message = error instanceof Error ? error.message : "File upload failed.";

      setFileCabinetError(message);
      console.error("[Blue Bomber Files] file upload failed:", message);
    }
  }

  async function openAccountFile(file: AccountFile, download = false) {
    setFileCabinetError("");

    try {
      const fileUrl = file.provider === "google_drive"
        ? download
          ? file.googleDriveWebContentLink || file.googleDriveWebViewLink
          : file.googleDriveWebViewLink || file.googleDriveWebContentLink
        : await createSupabaseAccountFileSignedUrl(file, download);

      if (!fileUrl) {
        throw new Error("Could not open file. Check Google Drive file permissions.");
      }

      const openedWindow = window.open(fileUrl, "_blank", "noopener,noreferrer");

      if (!openedWindow) {
        const link = document.createElement("a");
        link.href = fileUrl;
        link.target = "_blank";
        link.rel = "noreferrer";

        if (download) {
          link.download = file.name;
        }

        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not open file. Check Supabase Storage read policy.";

      setFileCabinetError(message);
      console.error("[Blue Bomber Files] file open failed:", message);
    }
  }

  function deleteCompany(company: Company) {
    if (!window.confirm(`Delete ${company.name}? This will remove related contacts, tasks, and timeline entries.`)) {
      return;
    }

    const nextCompanies = companies.filter((companyItem) => companyItem.id !== company.id);
    const nextContacts = contacts.filter((contact) => contact.companyId !== company.id);
    const nextTasks = tasks.filter((task) => task.companyId !== company.id);
    const nextTimeline = timeline.filter((entry) => entry.companyId !== company.id);
    const nextFiles = files.filter((file) => file.accountId !== company.id);
    const nextCommunicationLogs = communicationLogs.filter((log) => log.entityId !== company.id);

    setCompanies(nextCompanies);
    setContacts(nextContacts);
    setTasks(nextTasks);
    setTimeline(nextTimeline);
    setFiles(nextFiles);
    setCommunicationLogs(nextCommunicationLogs);
    setSelectedCompanyId(null);
    setSelectedTaskId(null);
    setCurrentView(company.status === "customer" ? "customers" : "prospects");
    saveStoredState({
      companies: nextCompanies,
      contacts: nextContacts,
      tasks: nextTasks,
      timeline: nextTimeline,
      carriers: carrierItems,
      files: nextFiles,
      communicationLogs: nextCommunicationLogs
    });

    void deleteSupabaseCompany(company.id).catch((error) => {
      console.error("[Blue Bomber Supabase] local-only delete after Supabase error:", {
        company: company.name,
        error: error instanceof Error ? error.message : error
      });
    });
  }

  async function importProspects(file: File) {
    setIsImporting(true);

    try {
      const parsedImport = await readProspectImportRows(file);
      const preview = buildImportPreview(file.name, parsedImport, companies);

      setImportPreview(preview);
      setImportResult(null);
    } catch (error) {
      console.error("[Blue Bomber Import] Prospect import preview failed:", error);
      window.alert(error instanceof Error ? error.message : "Prospect import failed.");
    } finally {
      setIsImporting(false);

      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  }

  async function confirmImportPreview() {
    if (!importPreview) {
      return;
    }

    setIsImporting(true);

    try {
      const rows = importPreview.rows
        .filter((row) => row.action === "ready")
        .map((row) => row.row);
      const existingByName = new Map(companies.map((company) => [normalizeCompanyName(company.name), company]));
      const contactKeys = new Set(
        contacts.map((contact) => `${contact.companyId}:${normalizeCompanyName(contact.name)}:${contact.email.toLowerCase()}`)
      );
      const seenNames = new Set<string>();
      const importedCompanies: Company[] = [];
      const importedContacts: Contact[] = [];
      let skipped = 0;

      rows.forEach((row) => {
        const normalizedName = normalizeCompanyName(row.companyName);
        const existingCompany = existingByName.get(normalizedName);

        if (!normalizedName) {
          skipped += 1;
          return;
        }

        if (existingCompany || seenNames.has(normalizedName)) {
          skipped += 1;

          const duplicateCompany =
            existingCompany ?? importedCompanies.find((company) => normalizeCompanyName(company.name) === normalizedName);
          const importedRowContacts = buildImportedContacts(row, duplicateCompany?.id ?? "");

          if (duplicateCompany) {
            importedRowContacts.forEach((importedContact) => {
              const contactKey = `${duplicateCompany.id}:${normalizeCompanyName(importedContact.name)}:${importedContact.email.toLowerCase()}`;

              if (!contactKeys.has(contactKey)) {
                importedContacts.push(importedContact);
                contactKeys.add(contactKey);
              }
            });
          }

          return;
        }

        seenNames.add(normalizedName);

        const companyId = createUuid();
        const importedRowContacts = buildImportedContacts(row, companyId);
        const primaryImportedContact = importedRowContacts[0] ?? null;
        const smartNotes = [
          row.notes,
          row.address ? `Address: ${row.address}` : "",
          row.zip ? `Zip: ${row.zip}` : "",
          row.website ? `Website: ${row.website}` : ""
        ]
          .filter(Boolean)
          .join("\n");
        const company: Company = {
          id: companyId,
          name: row.companyName,
          status: row.status,
          city: row.city || "Imported",
          state: row.state || statusLabel(row.status),
          segment: statusLabel(row.status),
          currentOpportunity: "Imported prospect. Add freight notes after first contact.",
          smartNotes,
          salesLead: row.salesLead || "Louie",
          operationsLead: row.operationsLead || "Brian",
          primaryContactId: primaryImportedContact ? primaryImportedContact.id : "",
          lastContact: "",
          lastActivity: "Imported",
          active: true,
          qualifyingQuestions: Object.fromEntries(
            qualifyingQuestions.map((question) => [question, ""])
          )
        };

        importedCompanies.push(company);
        existingByName.set(normalizedName, company);

        importedRowContacts.forEach((importedContact) => {
          importedContacts.push(importedContact);
          contactKeys.add(`${company.id}:${normalizeCompanyName(importedContact.name)}:${importedContact.email.toLowerCase()}`);
        });
      });

      if (importedCompanies.length || importedContacts.length) {
        const savedToSupabase = await importSupabaseProspects(importedCompanies, importedContacts);

        if (!savedToSupabase) {
          throw new Error("Supabase client unavailable.");
        }

        const nextCompanies = importedCompanies.length ? [...importedCompanies, ...companies] : companies;
        const nextContacts = [...importedContacts, ...contacts];

        setCompanies(nextCompanies);
        setContacts(nextContacts);
        saveStoredState({
          companies: nextCompanies,
          contacts: nextContacts,
          tasks,
          timeline,
          carriers: carrierItems,
          files,
          communicationLogs
        });
      }

      setImportResult({ imported: importedCompanies.length, skipped });
      setImportPreview(null);
    } catch (error) {
      console.error("[Blue Bomber Import] Prospect import failed:", error);
      window.alert(error instanceof Error ? error.message : "Prospect import failed.");
    } finally {
      setIsImporting(false);
    }
  }

  async function importCarriers(file: File) {
    setIsCarrierImporting(true);

    try {
      const parsedImport = await readCarrierImportRows(file);
      const preview = buildCarrierImportPreview(file.name, parsedImport, carrierItems);

      setCarrierImportPreview(preview);
      setCarrierImportResult(null);
    } catch (error) {
      console.error("[Blue Bomber Import] Carrier import preview failed:", error);
      window.alert(error instanceof Error ? error.message : "Carrier import failed.");
    } finally {
      setIsCarrierImporting(false);

      if (carrierImportInputRef.current) {
        carrierImportInputRef.current.value = "";
      }
    }
  }

  async function confirmCarrierImportPreview() {
    if (!carrierImportPreview) {
      return;
    }

    setIsCarrierImporting(true);

    try {
      const readyRows = carrierImportPreview.rows.filter((row) => row.action === "ready");
      const importedCarriers: Carrier[] = [];
      const importedTimeline: TimelineEntry[] = [];
      const seenImportKeys = new Set<string>();
      let errors = 0;

      readyRows.forEach((previewRow) => {
        const row = previewRow.row;
        const carrierName = row.carrierName.trim();

        if (!carrierName) {
          errors += 1;
          return;
        }

        const duplicateKey = getCarrierImportDuplicateKey(row);

        if (duplicateKey && seenImportKeys.has(duplicateKey)) {
          errors += 1;
          return;
        }

        if (duplicateKey) {
          seenImportKeys.add(duplicateKey);
        }

        const carrierId = createUuid();
        const carrier: Carrier = {
          id: carrierId,
          name: carrierName,
          city: row.city || "Imported",
          state: row.state || "Carrier",
          equipment: buildImportedCarrierEquipment(row)
        };

        importedCarriers.push(carrier);
        importedTimeline.push({
          id: createUuid(),
          companyId: carrierId,
          at: "Carrier Imported",
          body: buildCarrierImportTimelineBody(row),
          createdAt: new Date().toISOString()
        });
      });

      const skippedRows = carrierImportPreview.rows.filter((row) => row.action === "skip");
      const duplicateRows = skippedRows.filter((row) => row.duplicateReason).length;
      const nextCarriers = importedCarriers.length ? [...importedCarriers, ...carrierItems] : carrierItems;
      const nextTimeline = importedTimeline.length ? [...importedTimeline, ...timeline] : timeline;

      if (importedCarriers.length || importedTimeline.length) {
        setCarrierItems(nextCarriers);
        setTimeline(nextTimeline);
        persistState({ carriers: nextCarriers, timeline: nextTimeline }, "importing carriers");
      }

      setCarrierImportResult({
        imported: importedCarriers.length,
        skipped: skippedRows.length,
        duplicates: duplicateRows,
        errors
      });
      setCarrierImportPreview(null);
    } catch (error) {
      console.error("[Blue Bomber Import] Carrier import failed:", error);
      window.alert(error instanceof Error ? error.message : "Carrier import failed.");
    } finally {
      setIsCarrierImporting(false);
    }
  }

  function cancelCarrierImportPreview() {
    setCarrierImportPreview(null);
  }

  function cancelImportPreview() {
    setImportPreview(null);
  }

  function toggleSmartNoteContact(contactId: string) {
    setSmartNoteReview((review) =>
      review
        ? {
            ...review,
            selectedContactIds: review.selectedContactIds.includes(contactId)
              ? review.selectedContactIds.filter((id) => id !== contactId)
              : [...review.selectedContactIds, contactId]
          }
        : review
    );
  }

  function toggleSmartNoteTask(taskId: string) {
    setSmartNoteReview((review) =>
      review
        ? {
            ...review,
            selectedTaskIds: review.selectedTaskIds.includes(taskId)
              ? review.selectedTaskIds.filter((id) => id !== taskId)
              : [...review.selectedTaskIds, taskId]
          }
        : review
    );
  }

  function cancelSmartNoteReview() {
    setSmartNoteReview(null);
  }

  function confirmSmartNoteReview() {
    if (!smartNoteReview) {
      return;
    }

    const latestCompany =
      companies.find((company) => company.id === smartNoteReview.companyId) ?? smartNoteReview.result.company;
    const selectedContactIds = new Set(smartNoteReview.selectedContactIds);
    const selectedTaskIds = new Set(smartNoteReview.selectedTaskIds);
    const newContactIds = new Set(smartNoteReview.newContacts.map((contact) => contact.id));
    const selectedNewContacts = smartNoteReview.newContacts.filter((contact) => {
      if (!selectedContactIds.has(contact.id)) {
        return false;
      }

      return !contacts.some((existingContact) =>
        existingContact.companyId === contact.companyId && contactNamesOverlap(existingContact.name, contact.name)
      );
    });
    const selectedContactNames = new Set(selectedNewContacts.map((contact) => contact.name));
    const nextContacts = smartNoteReview.result.contacts.filter((contact) => {
      if (!newContactIds.has(contact.id)) {
        return true;
      }

      return selectedNewContacts.some((selectedContact) => selectedContact.id === contact.id);
    });
    const selectedTasks = smartNoteReview.result.tasks.filter((task) => {
      if (!selectedTaskIds.has(task.id)) {
        return false;
      }

      return !tasks.some((existingTask) => taskIdentity(existingTask) === taskIdentity(task));
    });
    const nextTasks = selectedTasks.length ? [...selectedTasks, ...tasks] : tasks;
    const taskCreatedEvents = selectedTasks
      .map((task) =>
        createTaskTimelineEvent(task, "Action Created", `${task.title} created for ${task.owner} by ${task.createdBy}.`)
      )
      .filter((entry): entry is TimelineEntry => Boolean(entry));
    const contactTimelineEntries = smartNoteReview.result.contactTimelineEntries.filter((entry) =>
      selectedContactNames.has(entry.body)
    );
    const nextTimeline = [
      ...taskCreatedEvents,
      ...contactTimelineEntries,
      smartNoteReview.result.timelineEntry,
      ...timeline
    ];
    const nextCompanies = companies.map((company) =>
      company.id === latestCompany.id
        ? {
            ...smartNoteReview.result.company,
            smartNotes: "",
            lastContact: selectedNewContacts.length
              ? smartNoteReview.result.company.lastContact
              : latestCompany.lastContact
          }
        : company
    );

    setCompanies(nextCompanies);
    setContacts(nextContacts);
    setTasks(nextTasks);
    setTimeline(nextTimeline);
    persistState({
      companies: nextCompanies,
      contacts: nextContacts,
      tasks: nextTasks,
      timeline: nextTimeline
    }, selectedTasks.length ? "confirming note and generating actions" : "confirming note");
    setNoteResult({
      contacts: selectedNewContacts.map((contact) => contact.name),
      tasks: selectedTasks.map((task) => ({ title: task.title, owner: task.owner })),
      systemUpdates: [
        ...selectedNewContacts.map((contact) => `Contact Added: ${contact.name}`),
        "Timeline Updated"
      ]
    });
    setSmartNoteReview(null);
    window.setTimeout(() => setNoteResult(null), 5000);
  }

  function updateSelectedProspectStatus(status: CompanyStatus) {
    if (!selectedBulkProspectIds.length) {
      return;
    }

    const selectedIds = new Set(selectedBulkProspectIds);
    const nextCompanies = companies.map((company) =>
      selectedIds.has(company.id) ? { ...company, status } : company
    );

    setCompanies(nextCompanies);
    setSelectedBulkProspectIds([]);
    persistState({ companies: nextCompanies }, "bulk updating prospect status");
  }

  function archiveSelectedProspects() {
    if (!selectedBulkProspectIds.length) {
      return;
    }

    const selectedIds = new Set(selectedBulkProspectIds);
    const nextCompanies = companies.map((company) =>
      selectedIds.has(company.id) ? { ...company, active: false } : company
    );

    setCompanies(nextCompanies);
    setSelectedBulkProspectIds([]);

    if (selectedCompanyId && selectedIds.has(selectedCompanyId)) {
      setSelectedCompanyId(null);
      setSelectedTaskId(null);
      setCurrentView("prospects");
    }

    persistState({ companies: nextCompanies }, "bulk archiving prospects");
  }

  function deleteSelectedProspects() {
    if (!selectedBulkProspectIds.length) {
      return;
    }

    const companyIdsToDelete = selectedBulkProspectIds;
    const selectedIds = new Set(companyIdsToDelete);
    const selectedNames = companies
      .filter((company) => selectedIds.has(company.id))
      .map((company) => company.name);

    if (
      !window.confirm(
        `Delete ${selectedNames.length} selected prospect${selectedNames.length === 1 ? "" : "s"}? This cannot be undone.`
      )
    ) {
      return;
    }

    const nextCompanies = companies.filter((company) => !selectedIds.has(company.id));
    const nextContacts = contacts.filter((contact) => !selectedIds.has(contact.companyId));
    const nextTasks = tasks.filter((task) => !selectedIds.has(task.companyId));
    const nextTimeline = timeline.filter((entry) => !selectedIds.has(entry.companyId));
    const nextFiles = files.filter((file) => !selectedIds.has(file.accountId));
    const nextCommunicationLogs = communicationLogs.filter((log) => !selectedIds.has(log.entityId));

    setCompanies(nextCompanies);
    setContacts(nextContacts);
    setTasks(nextTasks);
    setTimeline(nextTimeline);
    setFiles(nextFiles);
    setCommunicationLogs(nextCommunicationLogs);
    setSelectedBulkProspectIds([]);

    if (selectedCompanyId && selectedIds.has(selectedCompanyId)) {
      setSelectedCompanyId(null);
      setSelectedTaskId(null);
      setCurrentView("prospects");
    }

    saveStoredState({
      companies: nextCompanies,
      contacts: nextContacts,
      tasks: nextTasks,
      timeline: nextTimeline,
      carriers: carrierItems,
      files: nextFiles,
      communicationLogs: nextCommunicationLogs
    });

    void deleteSupabaseCompanies(companyIdsToDelete).catch((error) => {
      console.error("[Blue Bomber Supabase] local-only bulk delete after Supabase error:", {
        count: companyIdsToDelete.length,
        error: error instanceof Error ? error.message : error
      });
    });
  }

  if (!authInitialized || !appUser) {
    return (
      <LoginScreen
        authAvailable={Boolean(supabase)}
        isLoading={!authInitialized}
        onLogin={login}
      />
    );
  }

  return (
    <main className="shell">
      <section className="topbar" aria-label="Home">
        <div>
          <div className="brand-lockup">
            <img className="brand-logo" src="/blue-bomber-logo.png" alt="Blue Bomber Logistics" />
          </div>
        </div>
        <div className="topbar-actions">
          <label className="global-search" htmlFor="global-search">
            <span>Search</span>
            <input
              id="global-search"
              value={globalSearch}
              onChange={(event) => setGlobalSearch(event.target.value)}
              placeholder="Search Companies, Contacts, Actions..."
              type="search"
            />
          </label>
          <nav className="view-nav" aria-label="Primary navigation">
            <button
              className={currentView === "home" ? "active" : ""}
              type="button"
              onClick={() => openView("home")}
            >
              Today&apos;s Actions
            </button>
            <button
              className={currentView === "prospects" || currentView === "prospect-profile" ? "active" : ""}
              type="button"
              onClick={() => openView("prospects")}
            >
              Prospects
            </button>
            <button
              className={currentView === "customers" || currentView === "customer-profile" ? "active" : ""}
              type="button"
              onClick={() => openView("customers")}
            >
              Customers
            </button>
            <button
              className={currentView === "carriers" || currentView === "carrier-profile" ? "active" : ""}
              type="button"
              onClick={() => openView("carriers")}
            >
              Carriers
            </button>
          </nav>
          <div className="theme-toggle" aria-label="Theme mode">
            <button
              aria-pressed={themeMode === "light"}
              className={themeMode === "light" ? "active" : ""}
              type="button"
              onClick={() => setThemeMode("light")}
            >
              Light
            </button>
            <button
              aria-pressed={themeMode === "dark"}
              className={themeMode === "dark" ? "active" : ""}
              type="button"
              onClick={() => setThemeMode("dark")}
            >
              Dark
            </button>
          </div>
          <div className="quick-actions new-menu" aria-label="New">
            <button className="primary-action" type="button" onClick={() => setShowNewMenu((value) => !value)}>
              * New
            </button>
            {showNewMenu ? (
              <div className="new-menu-panel">
                <button type="button" onClick={() => openQuickCreate("prospect")}>
                  Prospect
                </button>
                <button type="button" onClick={() => openQuickCreate("customer")}>
                  Customer
                </button>
                <button type="button" onClick={() => openQuickCreate("carrier")}>
                  Carrier
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewMenu(false);
                    setShowManualActionForm(true);
                    setShowProspectForm(false);
                  }}
                >
                  Action
                </button>
              </div>
            ) : null}
          </div>
          <div className={`sync-indicator sync-indicator-${syncStatus}`} aria-live="polite">
            <span>{formatSyncStatus(syncStatus, lastSyncedAt)}</span>
            <button
              className="secondary-action sync-refresh"
              disabled={syncStatus === "syncing"}
              type="button"
              onClick={() => void refreshLatestData("manual")}
            >
              Refresh
            </button>
          </div>
          <div className="user-menu">
            <button
              aria-label={`${appUser.name} ${appUser.role} menu`}
              className="user-menu-trigger profile-pill"
              type="button"
              onClick={() => setShowUserMenu((value) => !value)}
            >
              <span className="profile-pill-avatar" aria-hidden="true">
                👤
              </span>
              <span className="profile-pill-label">
                <strong>{appUser.name}</strong>
                <span aria-hidden="true">•</span>
                <em>{appUser.role}</em>
              </span>
              <span className="profile-pill-chevron" aria-hidden="true">
                ▾
              </span>
            </button>
            {showUserMenu ? (
              <div className="user-menu-panel">
                <span>{appUser.email}</span>
                <button type="button" onClick={() => void logout()}>
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {showProspectForm ? (
        <section className="prospect-form" aria-label={`Add ${quickCreateType}`}>
          <input
            autoFocus
            value={prospectName}
            onChange={(event) => setProspectName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                addProspect();
              }
            }}
            placeholder={quickCreateType === "carrier" ? "Carrier name" : "Company name"}
          />
          <button type="button" onClick={addProspect}>
            Add {quickCreateType === "carrier" ? "Carrier" : statusLabel(quickCreateType)}
          </button>
          <button type="button" className="ghost" onClick={() => setShowProspectForm(false)}>
            Cancel
          </button>
        </section>
      ) : null}

      {showManualActionForm ? (
        <section className="prospect-form manual-action-form" aria-label="Add Action">
          <input
            autoFocus
            value={manualActionTitle}
            onChange={(event) => setManualActionTitle(event.target.value)}
            placeholder="Action Name"
          />
          <select
            value={manualActionEntityId}
            onChange={(event) => setManualActionEntityId(event.target.value)}
            aria-label="Company or carrier"
          >
            <option value="">Company/Carrier</option>
            {visibleCompanies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
            {carrierItems.map((carrier) => (
              <option key={carrier.id} value={carrier.id}>
                {carrier.name} (Carrier)
              </option>
            ))}
          </select>
          <input value={manualActionOwner} onChange={(event) => setManualActionOwner(event.target.value)} placeholder="Owner" />
          <input
            value={manualActionDueDate}
            onChange={(event) => setManualActionDueDate(event.target.value)}
            placeholder="Due Date"
          />
          <input
            value={manualActionDueTime}
            onChange={(event) => setManualActionDueTime(event.target.value)}
            placeholder="Due Time optional"
          />
          <select
            value={manualActionPriority}
            onChange={(event) => setManualActionPriority(event.target.value as Task["priority"])}
            aria-label="Priority"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <button type="button" onClick={addGlobalManualAction}>
            Save Action
          </button>
          <button type="button" className="ghost" onClick={() => setShowManualActionForm(false)}>
            Cancel
          </button>
        </section>
      ) : null}

      {currentView === "home" ? (
        <section className="task-centerpiece home-tasks" aria-label="Today's Actions">
          <div className="task-centerpiece-header">
            <div>
              <h2>Today&apos;s Actions</h2>
            </div>
            {showTaskAdvanced ? <span>{taskItems.length} shown · {taskCounters.open} open</span> : null}
          </div>
          <div className="tabs action-filter-tabs" role="tablist" aria-label="Action filter">
            {taskFilters.map((filter) => (
              <button
                aria-selected={taskFilter === filter.id}
                className={taskFilter === filter.id ? "active" : ""}
                key={filter.id}
                onClick={() => setTaskFilter(filter.id)}
                role="tab"
                type="button"
              >
                {filter.label} ({actionFilterCounts[filter.id]})
              </button>
            ))}
          </div>
          <div className="task-more-row">
            <button className="secondary-action" type="button" onClick={() => setShowTaskAdvanced((value) => !value)}>
              {showTaskAdvanced ? "Hide Tools" : "Tools"}
            </button>
          </div>
          {showTaskAdvanced ? (
            <>
              <div className="home-shortcuts" aria-label="Work lists">
                <button type="button" onClick={() => openView("prospects")}>
                  Prospects
                </button>
                <button type="button" onClick={() => openView("customers")}>
                  Customers
                </button>
                <button type="button" onClick={() => openView("carriers")}>
                  Carriers
                </button>
              </div>
              <div className="task-counters" aria-label="Task counters">
                <div>
                  <span>Open Actions</span>
                  <strong>{taskCounters.open}</strong>
                </div>
                <div>
                  <span>Due Today</span>
                  <strong>{taskCounters.dueToday}</strong>
                </div>
                <div>
                  <span>Overdue</span>
                  <strong>{taskCounters.overdue}</strong>
                </div>
                <div>
                  <span>Completed Today</span>
                  <strong>{taskCounters.completedToday}</strong>
                </div>
              </div>
            </>
          ) : null}
          <TaskDashboard
            entityNameById={taskEntityNameById}
            onCompleteTask={completeTask}
            onEditTask={editTask}
            onOpenEntity={openTaskEntity}
            onOpenTaskDetail={openTaskDetail}
            onReassignTask={reassignTask}
            onSetTaskDue={setTaskDue}
            selectedTaskId={selectedTaskId}
            taskFilter={taskFilter}
            taskItems={taskItems}
          />
        </section>
      ) : null}

      {currentView === "prospects" ? (
        <CompanyListPage
          companies={prospectCompanies}
          importInputRef={importInputRef}
          importPreview={importPreview}
          importResult={importResult}
          isImporting={isImporting}
          canManageList={isAdmin}
          selectedBulkProspectIds={selectedBulkProspectIds}
          title="Prospect List"
          onArchiveSelected={archiveSelectedProspects}
          onBulkStatusChange={updateSelectedProspectStatus}
          onDeleteSelected={deleteSelectedProspects}
          onCancelImportPreview={cancelImportPreview}
          onConfirmImportPreview={confirmImportPreview}
          onImportFile={importProspects}
          onSelect={selectCompany}
          onToggleBulkProspect={toggleBulkProspect}
          onToggleVisibleBulkProspects={toggleVisibleBulkProspects}
        />
      ) : null}

      {currentView === "customers" ? (
        <CompanyListPage
          companies={customerCompanies}
          canManageList={false}
          importPreview={null}
          selectedBulkProspectIds={[]}
          title="Customer List"
          onArchiveSelected={() => undefined}
          onBulkStatusChange={() => undefined}
          onDeleteSelected={() => undefined}
          onCancelImportPreview={() => undefined}
          onConfirmImportPreview={() => undefined}
          onImportFile={importProspects}
          onSelect={selectCompany}
          onToggleBulkProspect={() => undefined}
          onToggleVisibleBulkProspects={() => undefined}
        />
      ) : null}

      {currentView === "carriers" ? (
        <CarrierListPage
          carriers={visibleCarriers}
          importInputRef={carrierImportInputRef}
          importPreview={carrierImportPreview}
          importResult={carrierImportResult}
          isImporting={isCarrierImporting}
          onCancelImportPreview={cancelCarrierImportPreview}
          onConfirmImportPreview={confirmCarrierImportPreview}
          onImportFile={importCarriers}
          onSelect={selectCarrier}
        />
      ) : null}

      {(currentView === "prospect-profile" || currentView === "customer-profile") && selectedCompany ? (
        <>
          <CompanyProfile
            company={selectedCompany}
            contacts={companyContacts}
            communicationLogs={communicationLogs.filter((log) => log.entityId === selectedCompany.id)}
            canManageAccount={isAdmin}
            files={files.filter((file) => file.accountId === selectedCompany.id)}
            fileCabinetError={fileCabinetError}
            onAddManualContact={(values) => addManualContact(selectedCompany, values)}
            onAddManualTask={(values) => addManualTask(selectedCompany, values)}
            onLogEmail={(values) => logCompanyEmail(selectedCompany, values)}
            onConvertToCustomer={() => convertProspectToCustomer(selectedCompany)}
            onDeleteCompany={() => deleteCompany(selectedCompany)}
            onRepairContacts={() => repairImportedContacts(selectedCompany)}
            onUpdateCompany={(values) => updateCompanyProfile(selectedCompany, values)}
            onUpdateQuestion={(question, answer) => {
              setCompanies((currentCompanies) => {
                const nextCompanies = currentCompanies.map((company) =>
                  company.id === selectedCompany.id
                    ? {
                        ...company,
                        qualifyingQuestions: {
                          ...company.qualifyingQuestions,
                          [question]: answer
                        },
                        lastActivity: "Today"
                      }
                    : company
                );

                persistState({ companies: nextCompanies }, "updating Louie's questions");

                return nextCompanies;
              });
            }}
            onUploadFile={(file, category) => void uploadAccountFile(selectedCompany.id, "company", file, category)}
            onOpenFile={(file, download) => void openAccountFile(file, download)}
            onSmartNotesChange={(smartNotes) => {
              setCompanies((currentCompanies) => {
                const nextCompanies = currentCompanies.map((company) =>
                  company.id === selectedCompany.id ? { ...company, smartNotes } : company
                );

                persistState({ companies: nextCompanies }, "updating Call Notes");

                return nextCompanies;
              });
            }}
            onAddNote={() => {
              const latestCompany =
                companies.find((company) => company.id === selectedCompany.id) ?? selectedCompany;
              const note = latestCompany.smartNotes.trim();

              if (!note) {
                return;
              }

              setSelectedTaskId(null);
              const contactChoices = resolveAmbiguousContactChoices(
                note,
                contacts.filter((contact) => contact.companyId === latestCompany.id)
              );
              const baseResult = applyIntent(note, latestCompany, contacts, currentUserName);
              const result = contactChoices.size
                ? {
                    ...baseResult,
                    tasks: baseResult.tasks.map((task) => ({
                      ...task,
                      title: applyContactChoiceToActionTitle(task.title, contactChoices)
                    }))
                  }
                : baseResult;
              const existingContactIds = new Set(contacts.map((contact) => contact.id));
              const newContacts = result.contacts.filter((contact) => !existingContactIds.has(contact.id));

              setSmartNoteReview({
                companyId: latestCompany.id,
                note,
                result,
                newContacts,
                selectedContactIds: newContacts
                  .filter((contact) => contact.confidence === "High")
                  .map((contact) => contact.id),
                selectedTaskIds: result.tasks.map((task) => task.id)
              });
            }}
            tasks={selectedCompanyTasks}
            timeline={timeline}
            noteResult={noteResult}
          />
        </>
      ) : null}

      {currentView === "carrier-profile" && selectedCarrier ? (
        <>
          <CarrierProfile
            carrier={selectedCarrier}
            files={files.filter((file) => file.accountId === selectedCarrier.id)}
            fileCabinetError={fileCabinetError}
            communicationLogs={communicationLogs.filter((log) => log.entityId === selectedCarrier.id)}
            timeline={timeline.filter((entry) => entry.companyId === selectedCarrier.id)}
            note={carrierNote}
            noteResult={noteResult}
            tasks={selectedCarrierTasks}
            onAddNote={() => {
              const note = carrierNote.trim();

              if (!note) {
                return;
              }

              setSelectedTaskId(null);
              const result = applyCarrierIntent(note, selectedCarrier, currentUserName);
              const nextTasks = result.tasks.length ? [...result.tasks, ...tasks] : tasks;

              if (result.tasks.length) {
                setTasks(nextTasks);
              }

              setCarrierNote("");
              persistState({
                tasks: nextTasks
              }, result.tasks.length ? "adding carrier note and generating task" : "adding carrier note");
              setNoteResult({
                contacts: [],
                tasks: result.tasks.map((task) => ({ title: task.title, owner: task.owner })),
                systemUpdates: result.tasks.length ? ["Carrier actions updated"] : ["Carrier note saved"]
              });
              window.setTimeout(() => setNoteResult(null), 5000);
            }}
            onNoteChange={setCarrierNote}
            onUploadFile={(file, category) => void uploadAccountFile(selectedCarrier.id, "carrier", file, category)}
            onOpenFile={(file, download) => void openAccountFile(file, download)}
            onLogEmail={(values) => logCarrierEmail(selectedCarrier, values)}
          />
        </>
      ) : null}

      <footer className="app-footer">Blue Bomber OS v1.0</footer>

      {smartNoteReview ? (
        <SmartNoteReviewModal
          review={smartNoteReview}
          onCancel={cancelSmartNoteReview}
          onConfirm={confirmSmartNoteReview}
          onToggleContact={toggleSmartNoteContact}
          onToggleTask={toggleSmartNoteTask}
        />
      ) : null}
    </main>
  );
}

function LoginScreen({
  authAvailable,
  isLoading,
  onLogin
}: {
  authAvailable: boolean;
  isLoading: boolean;
  onLogin: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!authAvailable || isLoading) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await onLogin(email.trim(), password);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-label="Login">
        <img className="login-logo" src="/blue-bomber-logo.png" alt="Blue Bomber Logistics" />
        <h1>Blue Bomber Logistics OS</h1>
        <p>Operations Command Center</p>
        <form onSubmit={submitLogin}>
          <label>
            Email
            <input
              autoComplete="email"
              disabled={!authAvailable || isLoading || isSubmitting}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              type="email"
              value={email}
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              disabled={!authAvailable || isLoading || isSubmitting}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              type="password"
              value={password}
            />
          </label>
          {errorMessage ? <p className="login-error">{errorMessage}</p> : null}
          {!authAvailable ? <p className="login-error">Supabase is not configured.</p> : null}
          <button disabled={!authAvailable || isLoading || isSubmitting} type="submit">
            {isLoading ? "Checking session" : isSubmitting ? "Signing in" : "Sign In"}
          </button>
        </form>
      </section>
    </main>
  );
}

function CompanyListPage({
  canManageList,
  companies,
  importInputRef,
  importPreview,
  importResult,
  isImporting = false,
  selectedBulkProspectIds,
  title,
  onArchiveSelected,
  onBulkStatusChange,
  onDeleteSelected,
  onCancelImportPreview,
  onConfirmImportPreview,
  onImportFile,
  onSelect,
  onToggleBulkProspect,
  onToggleVisibleBulkProspects
}: {
  canManageList: boolean;
  companies: Company[];
  importInputRef?: React.RefObject<HTMLInputElement>;
  importPreview: ImportPreview | null;
  importResult?: { imported: number; skipped: number } | null;
  isImporting?: boolean;
  selectedBulkProspectIds: string[];
  title: string;
  onArchiveSelected: () => void;
  onBulkStatusChange: (status: CompanyStatus) => void;
  onDeleteSelected: () => void;
  onCancelImportPreview: () => void;
  onConfirmImportPreview: () => void;
  onImportFile: (file: File) => void;
  onSelect: (companyId: string) => void;
  onToggleBulkProspect: (companyId: string) => void;
  onToggleVisibleBulkProspects: (companyIds: string[]) => void;
}) {
  const isProspectList = title === "Prospect List";
  const hasBulkSelection = selectedBulkProspectIds.length > 0;
  const visibleCompanyIds = companies.map((company) => company.id);
  const allVisibleSelected = Boolean(
    visibleCompanyIds.length && visibleCompanyIds.every((companyId) => selectedBulkProspectIds.includes(companyId))
  );
  const [showListManagement, setShowListManagement] = useState(false);

  return (
    <section className="list-page" aria-label={title}>
      <div className="list-header">
        <div>
          <h2>{title}</h2>
          <span>{companies.length} active</span>
        </div>
        {isProspectList && canManageList ? (
          <div className="list-header-actions">
            {importInputRef ? (
              <div className="import-control">
                <button type="button" onClick={() => importInputRef.current?.click()} disabled={isImporting}>
                  {isImporting ? "Importing" : "Import"}
                </button>
                <input
                  ref={importInputRef}
                  accept=".csv,.xlsx"
                  aria-label="Import prospects"
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0];

                    if (file) {
                      void onImportFile(file);
                    }
                  }}
                />
                {importResult ? (
                  <span>
                    Imported {importResult.imported} · Skipped {importResult.skipped}
                  </span>
                ) : null}
              </div>
            ) : null}
            <button className="secondary-action" type="button" onClick={() => setShowListManagement((value) => !value)}>
              {showListManagement ? "Done" : "Manage List"}
            </button>
          </div>
        ) : null}
      </div>

      {isProspectList && canManageList && importPreview ? (
        <ImportPreviewPanel
          importPreview={importPreview}
          isImporting={isImporting}
          onCancel={onCancelImportPreview}
          onConfirm={onConfirmImportPreview}
        />
      ) : null}

      {isProspectList && canManageList && showListManagement ? (
        <div className="bulk-control list-bulk-control" aria-label="Bulk prospect actions">
          <div className="bulk-actions horizontal">
            <span>{selectedBulkProspectIds.length} selected</span>
            <button
              type="button"
              disabled={!visibleCompanyIds.length}
              onClick={() => onToggleVisibleBulkProspects(visibleCompanyIds)}
            >
              {allVisibleSelected ? "Deselect All" : "Select All"}
            </button>
            <select
              aria-label="Change selected prospect status"
              disabled={!hasBulkSelection}
              defaultValue=""
              onChange={(event) => {
                const status = event.target.value as CompanyStatus | "";

                if (status) {
                  onBulkStatusChange(status);
                  event.currentTarget.value = "";
                }
              }}
            >
              <option value="">Status</option>
              <option value="prospect">Prospect</option>
              <option value="customer">Customer</option>
            </select>
            <button type="button" disabled={!hasBulkSelection} onClick={onArchiveSelected}>
              Archive
            </button>
            <button
              className="danger"
              type="button"
              disabled={!hasBulkSelection}
              onClick={onDeleteSelected}
            >
              Delete Selected ({selectedBulkProspectIds.length})
            </button>
          </div>
        </div>
      ) : null}

      <ul className="record-list">
        {companies.map((company) => (
          <li key={company.id}>
            {isProspectList && canManageList && showListManagement ? (
              <input
                aria-label={`Select ${company.name}`}
                checked={selectedBulkProspectIds.includes(company.id)}
                type="checkbox"
                onChange={() => onToggleBulkProspect(company.id)}
              />
            ) : null}
            <button type="button" onClick={() => onSelect(company.id)}>
              <span>{statusLabel(company.status)}</span>
              <strong>{company.name}</strong>
              <small>
                {formatCompanyMeta(company)}
              </small>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ImportPreviewPanel({
  importPreview,
  isImporting,
  onCancel,
  onConfirm
}: {
  importPreview: ImportPreview;
  isImporting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const readyRows = importPreview.rows.filter((row) => row.action === "ready");
  const skippedRows = importPreview.rows.filter((row) => row.action === "skip");
  const companyFields: ImportFieldKey[] = [
    "companyName",
    "status",
    "address",
    "city",
    "state",
    "zip",
    "phone",
    "website",
    "notes"
  ];
  const contactFields: ImportFieldKey[] = ["contactName", "contactRole", "contactPhone", "contactEmail"];

  return (
    <section className="import-preview" aria-label="Import Preview">
      <div className="import-preview-header">
        <div>
          <h3>Import Preview</h3>
          <span>{importPreview.fileName}</span>
        </div>
        <strong className={confidenceClassName(importPreview.confidence)}>{importPreview.confidence}</strong>
        <div className="profile-actions">
          <button type="button" onClick={onCancel} disabled={isImporting}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={isImporting || !readyRows.length}>
            {isImporting ? "Importing" : `Import ${readyRows.length}`}
          </button>
        </div>
      </div>

      <div className="import-preview-grid">
        <div>
          <strong>Detected Columns</strong>
          <span>{importPreview.detectedColumns.join(", ") || "None"}</span>
        </div>
        <div>
          <strong>Unmapped Columns</strong>
          <span>{importPreview.unmappedColumns.join(", ") || "None"}</span>
        </div>
      </div>

      <div className="import-mapping-grid">
        <div>
          <strong>Detected → Mapped To</strong>
          <ul>
            {importPreview.mappedColumns.length ? importPreview.mappedColumns.map((mapping) => (
              <li key={`${mapping.detected}-${mapping.mappedTo}`}>
                <span>{mapping.detected}</span>
                <b>{mapping.mappedTo}</b>
              </li>
            )) : (
              <li>
                <span>No mapped columns</span>
                <b>Low Confidence</b>
              </li>
            )}
          </ul>
        </div>
        <div>
          <strong>Required Fields</strong>
          <ul>
            {[...companyFields, ...contactFields].map((field) => (
              <li key={field}>
                <span>{formatImportField(field)}</span>
                <b>{importPreview.fieldMapping[field] || "Not mapped"}</b>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="import-preview-grid">
        <div>
          <strong>Rows Ready To Import</strong>
          <span>{readyRows.length}</span>
        </div>
        <div>
          <strong>Rows Skipped</strong>
          <span>{skippedRows.length}</span>
        </div>
      </div>

      {importPreview.rows.length ? (
        <ul className="import-row-preview">
          {importPreview.rows.slice(0, 8).map((row) => (
            <li className={row.action === "skip" ? "skipped" : ""} key={row.rowNumber}>
              <strong>Row {row.rowNumber}: {row.row.companyName || "No company"}</strong>
              {row.action === "ready" ? (
                <>
                  <span>{row.row.contacts.length} contact{row.row.contacts.length === 1 ? "" : "s"}</span>
                  {row.row.contacts.length ? (
                    <ul className="import-contact-preview">
                      {row.row.contacts.map((contact, contactIndex) => (
                        <li key={`${row.rowNumber}-${contact.name}-${contactIndex}`}>
                          {contact.name} | {contact.title || "Not set"}
                          {contact.phone ? ` | ${contact.phone}` : ""}
                          {contact.email ? ` | ${contact.email}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span>No contacts detected</span>
                  )}
                </>
              ) : (
                <span>{row.skippedReason}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function SmartNoteReviewModal({
  review,
  onCancel,
  onConfirm,
  onToggleContact,
  onToggleTask
}: {
  review: SmartNoteReview;
  onCancel: () => void;
  onConfirm: () => void;
  onToggleContact: (contactId: string) => void;
  onToggleTask: (taskId: string) => void;
}) {
  const hasDetectedUpdates = Boolean(review.newContacts.length || review.result.tasks.length);

  useEffect(() => {
    function handleSmartNoteModalKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const isTextArea = target instanceof HTMLTextAreaElement;

      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key === "Enter") {
        if (isTextArea && event.shiftKey) {
          return;
        }

        event.preventDefault();
        onConfirm();
      }
    }

    document.addEventListener("keydown", handleSmartNoteModalKeyDown);

    return () => {
      document.removeEventListener("keydown", handleSmartNoteModalKeyDown);
    };
  }, [onCancel, onConfirm]);

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="smart-note-modal" aria-label="Smart Notes Found" role="dialog" aria-modal="true">
        <div className="smart-note-modal-header">
          <h3>Smart Notes Found</h3>
          <p>
            {hasDetectedUpdates
              ? "Confirm what Blue Bomber OS should save."
              : "No actions detected. Save note only?"}
          </p>
        </div>

        <div className="smart-note-review-section">
          <strong>Contacts:</strong>
          {review.newContacts.length ? (
            <ul>
              {review.newContacts.map((contact) => (
                <li key={contact.id}>
                  <label>
                    <input
                      checked={review.selectedContactIds.includes(contact.id)}
                      disabled={contact.confidence !== "High"}
                      type="checkbox"
                      onChange={() => onToggleContact(contact.id)}
                    />
                    <span>
                      {contact.name}
                      {contact.role ? ` - ${contact.role}` : ""}
                      {contact.confidence ? ` · ${contact.confidence} confidence` : ""}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p>No new contacts found.</p>
          )}
        </div>

        <div className="smart-note-review-section">
          <strong>Suggested Actions:</strong>
          {review.result.tasks.length ? (
            <ul>
              {review.result.tasks.map((task) => (
                <li key={task.id}>
                  <label>
                    <input
                      checked={review.selectedTaskIds.includes(task.id)}
                      type="checkbox"
                      onChange={() => onToggleTask(task.id)}
                    />
                    <span>
                      {task.title} - {task.due || "No due date"} - {task.owner}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p>No actions detected. Save note only?</p>
          )}
        </div>

        <div className="smart-note-source">
          <strong>Source Note</strong>
          <p>{review.note}</p>
        </div>

        <div className="smart-note-modal-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary-action" type="button" onClick={onConfirm}>
            {hasDetectedUpdates ? "Confirm Selected" : "Save Note"}
          </button>
        </div>
      </section>
    </div>
  );
}

function CarrierImportPreviewPanel({
  importPreview,
  isImporting,
  onCancel,
  onConfirm
}: {
  importPreview: CarrierImportPreview;
  isImporting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const readyRows = importPreview.rows.filter((row) => row.action === "ready");
  const skippedRows = importPreview.rows.filter((row) => row.action === "skip");
  const duplicateRows = skippedRows.filter((row) => row.duplicateReason);
  const primaryFields: CarrierImportFieldKey[] = ["carrierName", "mcNumber", "dotNumber"];
  const contactFields: CarrierImportFieldKey[] = [
    "primaryContact",
    "dispatchPhone",
    "dispatchEmail",
    "mainPhone",
    "email",
    "safetyEmail",
    "accountingEmail"
  ];
  const operationsFields: CarrierImportFieldKey[] = [
    "address",
    "city",
    "state",
    "zip",
    "equipment",
    "notes",
    "status",
    "w9Status",
    "coiStatus",
    "noaStatus",
    "carrierPacketStatus"
  ];

  return (
    <section className="import-preview" aria-label="Carrier Import Preview">
      <div className="import-preview-header">
        <div>
          <h3>Carrier Import Wizard</h3>
          <span>{importPreview.fileName}</span>
        </div>
        <strong className={confidenceClassName(importPreview.confidence)}>{importPreview.confidence}</strong>
        <div className="profile-actions">
          <button type="button" onClick={onCancel} disabled={isImporting}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={isImporting || !readyRows.length}>
            {isImporting ? "Importing" : "Import Carriers (" + readyRows.length + ")"}
          </button>
        </div>
      </div>

      <div className="import-preview-grid">
        <div>
          <strong>Upload Carrier List</strong>
          <span>{importPreview.fileName}</span>
        </div>
        <div>
          <strong>Detected Columns</strong>
          <span>{importPreview.detectedColumns.join(", ") || "None"}</span>
        </div>
        <div>
          <strong>Unmapped Columns</strong>
          <span>{importPreview.unmappedColumns.join(", ") || "None"}</span>
        </div>
      </div>

      <div className="import-mapping-grid">
        <div>
          <strong>Detected → Mapped To</strong>
          <ul>
            {importPreview.mappedColumns.length ? importPreview.mappedColumns.map((mapping) => (
              <li key={mapping.detected + "-" + mapping.mappedTo}>
                <span>{mapping.detected}</span>
                <b>{mapping.mappedTo}</b>
              </li>
            )) : (
              <li>
                <span>No mapped columns</span>
                <b>Low Confidence</b>
              </li>
            )}
          </ul>
        </div>
        <div>
          <strong>Mapped Fields</strong>
          <ul>
            {[...primaryFields, ...contactFields, ...operationsFields].map((field) => (
              <li key={field}>
                <span>{formatCarrierImportField(field)}</span>
                <b>{importPreview.fieldMapping[field] || "Not mapped"}</b>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="import-preview-grid">
        <div>
          <strong>Rows Ready to Import</strong>
          <span>{readyRows.length}</span>
        </div>
        <div>
          <strong>Duplicate Rows</strong>
          <span>{duplicateRows.length}</span>
        </div>
        <div>
          <strong>Rows Skipped</strong>
          <span>{skippedRows.length}</span>
        </div>
      </div>

      {importPreview.rows.length ? (
        <ul className="import-row-preview">
          {importPreview.rows.slice(0, 10).map((row) => (
            <li className={row.action === "skip" ? "skipped" : ""} key={row.rowNumber}>
              <strong>Row {row.rowNumber}: {row.row.carrierName || "No carrier"}</strong>
              {row.action === "ready" ? (
                <>
                  <span>
                    {[row.row.mcNumber ? "MC " + row.row.mcNumber : "", row.row.dotNumber ? "DOT " + row.row.dotNumber : "", row.row.city && row.row.state ? row.row.city + ", " + row.row.state : row.row.city || row.row.state]
                      .filter(Boolean)
                      .join(" · ") || "Ready"}
                  </span>
                  <ul className="import-contact-preview">
                    <li>Contact: {row.row.primaryContact || "Not set"}</li>
                    <li>Dispatch: {[row.row.dispatchPhone, row.row.dispatchEmail].filter(Boolean).join(" | ") || "Not set"}</li>
                    <li>Compliance: {buildCarrierComplianceSummary(row.row) || "Not set"}</li>
                  </ul>
                </>
              ) : (
                <span>{row.skippedReason}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function CarrierListPage({
  carriers,
  importInputRef,
  importPreview,
  importResult,
  isImporting,
  onCancelImportPreview,
  onConfirmImportPreview,
  onImportFile,
  onSelect
}: {
  carriers: Carrier[];
  importInputRef: React.RefObject<HTMLInputElement>;
  importPreview: CarrierImportPreview | null;
  importResult: { imported: number; skipped: number; duplicates: number; errors: number } | null;
  isImporting: boolean;
  onCancelImportPreview: () => void;
  onConfirmImportPreview: () => void;
  onImportFile: (file: File) => void;
  onSelect: (carrierId: string) => void;
}) {
  return (
    <section className="list-page" aria-label="Carrier List">
      <div className="list-header">
        <div>
          <h2>Carrier List</h2>
          <span>{carriers.length} active</span>
        </div>
        <div className="list-header-actions">
          <div className="import-control">
            <button type="button" onClick={() => importInputRef.current?.click()} disabled={isImporting}>
              {isImporting ? "Importing" : "Import Carriers"}
            </button>
            <input
              ref={importInputRef}
              accept=".csv,.xlsx"
              aria-label="Import carriers"
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];

                if (file) {
                  void onImportFile(file);
                }
              }}
            />
            {importResult ? (
              <span>
                Imported {importResult.imported} · Skipped {importResult.skipped} · Duplicates {importResult.duplicates} · Errors {importResult.errors}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {importPreview ? (
        <CarrierImportPreviewPanel
          importPreview={importPreview}
          isImporting={isImporting}
          onCancel={onCancelImportPreview}
          onConfirm={onConfirmImportPreview}
        />
      ) : null}

      <ul className="record-list">
        {carriers.map((carrier) => (
          <li key={carrier.id}>
            <button type="button" onClick={() => onSelect(carrier.id)}>
              <span>Carrier</span>
              <strong>{carrier.name}</strong>
              <small>
                {carrier.city}, {carrier.state} · {carrier.equipment}
              </small>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CarrierProfile({
  carrier,
  files,
  fileCabinetError,
  communicationLogs,
  timeline,
  note,
  noteResult,
  tasks,
  onAddNote,
  onNoteChange,
  onUploadFile,
  onOpenFile,
  onLogEmail
}: {
  carrier: Carrier;
  files: AccountFile[];
  fileCabinetError: string;
  communicationLogs: CommunicationLog[];
  timeline: TimelineEntry[];
  note: string;
  noteResult: NoteSaveResult | null;
  tasks: Task[];
  onAddNote: () => void;
  onNoteChange: (note: string) => void;
  onUploadFile: (file: File, category: AccountFileCategory) => void;
  onOpenFile: (file: AccountFile, download?: boolean) => void;
  onLogEmail: (values: ManualEmailLogInput) => void;
}) {
  const [showCarrierDetails, setShowCarrierDetails] = useState(false);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [manualPanel, setManualPanel] = useState<"email" | null>(null);
  const carrierTimelineRows = [
    ...timeline.map((entry) => ({
      id: entry.id,
      title: entry.at,
      detail: entry.body,
      createdAt: entry.createdAt,
      type: "timeline" as const
    })),
    ...getCommunicationTimelineRows(communicationLogs)
  ].sort((firstEntry, secondEntry) => secondEntry.createdAt.localeCompare(firstEntry.createdAt));

  return (
    <section className="profile" aria-label="Carrier Profile">
      <div className="profile-header">
        <div>
          <span className="status">Carrier</span>
          <h2>{carrier.name}</h2>
          <p>
            {carrier.city}, {carrier.state} · {carrier.equipment}
          </p>
        </div>
        <button className="secondary-action" type="button" onClick={() => setShowCarrierDetails((value) => !value)}>
          {showCarrierDetails ? "Less" : "More"}
        </button>
      </div>

      <section className="account-card-section manual-entry carrier-manual-entry">
        <button
          className="secondary-action manual-entry-toggle"
          type="button"
          onClick={() => {
            setIsManualEntryOpen((value) => !value);
            setManualPanel(null);
          }}
        >
          Operations Center
        </button>
        {isManualEntryOpen ? (
          <div className="manual-entry-panel">
            <div className="manual-entry-options">
              <button type="button" onClick={() => setManualPanel(manualPanel === "email" ? null : "email")}>
                Log Email
              </button>
            </div>
            {manualPanel === "email" ? (
              <ManualEmailLogForm source="Gmail Operations" onSave={onLogEmail} />
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="command-timeline" aria-label="Call Notes">
        <div className="command-center">
          <div className="command-center-header">
            <h3>Call Notes</h3>
            <p>Type notes naturally. Blue Bomber OS will detect tasks and activities automatically.</p>
          </div>
          <textarea
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onAddNote();
              }
            }}
            placeholder={`Need COI

Need W9

Check availability

Send load details

Confirm pickup

Confirm delivery`}
          />
          <div className="note-actions">
            <button type="button" onClick={onAddNote}>
              Add Note
            </button>
          </div>
          {noteResult ? <NoteSavedMessage {...noteResult} /> : null}
        </div>

        {showCarrierDetails ? (
          <div className="current-opportunity">
            <span>Carrier Details</span>
            <strong>{carrier.equipment}</strong>
            <FileCabinet
              accountType="carrier"
              files={files}
              fileCabinetError={fileCabinetError}
              onOpenFile={onOpenFile}
              onUploadFile={onUploadFile}
            />
          </div>
        ) : null}
        <div className="timeline-stream">
          <h3>Next Actions</h3>
          {tasks.length ? (
            tasks.map((task) => (
              <div className="timeline-item task-event" key={task.id}>
                <strong>{task.title}</strong>
                <span>{taskStatusLabel(task.status)} · {task.due} · Owner: {task.owner}</span>
              </div>
            ))
          ) : (
            <p className="empty">No carrier tasks here.</p>
          )}
        </div>
        <div className="timeline-stream">
          <h3>Timeline</h3>
          {carrierTimelineRows.length ? (
            carrierTimelineRows.map((entry) => (
              <div className="timeline-item" key={entry.id}>
                <strong>{formatTimelineTitle(entry.title)}</strong>
                <span>{entry.detail}</span>
              </div>
            ))
          ) : (
            <p className="empty">No timeline yet.</p>
          )}
        </div>
      </section>
    </section>
  );
}

function CompanyProfile({
  canManageAccount,
  company,
  contacts: companyContacts,
  communicationLogs,
  files,
  fileCabinetError,
  tasks: companyTasks,
  timeline,
  noteResult,
  onSmartNotesChange,
  onAddNote,
  onAddManualContact,
  onAddManualTask,
  onLogEmail,
  onConvertToCustomer,
  onDeleteCompany,
  onRepairContacts,
  onUpdateCompany,
  onUpdateQuestion,
  onUploadFile,
  onOpenFile
}: {
  canManageAccount: boolean;
  company: Company;
  contacts: typeof seedContacts;
  communicationLogs: CommunicationLog[];
  files: AccountFile[];
  fileCabinetError: string;
  tasks: Task[];
  timeline: typeof seedTimeline;
  noteResult: NoteSaveResult | null;
  onSmartNotesChange: (smartNotes: string) => void;
  onAddNote: () => void;
  onAddManualContact: (values: ManualContactInput) => void;
  onAddManualTask: (values: ManualTaskInput) => void;
  onLogEmail: (values: ManualEmailLogInput) => void;
  onConvertToCustomer: () => void;
  onDeleteCompany: () => void;
  onRepairContacts: () => void;
  onUpdateCompany: (values: CompanyEditInput) => void;
  onUpdateQuestion: (question: string, answer: string) => void;
  onUploadFile: (file: File, category: AccountFileCategory) => void;
  onOpenFile: (file: AccountFile, download?: boolean) => void;
}) {
  const [expandedSection, setExpandedSection] = useState<ProfileTab | null>(null);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [manualPanel, setManualPanel] = useState<"edit" | "contact" | "action" | "file" | "email" | null>(null);
  const [contactPage, setContactPage] = useState(0);
  const primaryContact = getPrimaryContact(company, companyContacts);
  const openTasks = companyTasks.filter(isActiveTask).sort(compareTasksByDueThenCreated);
  const completedTasks = companyTasks.filter((task) => task.status === "completed");
  const timelineRows = getCompanyTimelineRows(company, timeline, communicationLogs);
  const fallbackAccountSummary = buildAccountSummary(company, companyContacts, openTasks, timelineRows);
  const [accountSummaryOverride, setAccountSummaryOverride] = useState<string[] | null>(null);
  const [isRefreshingSummary, setIsRefreshingSummary] = useState(false);
  const [summaryRefreshError, setSummaryRefreshError] = useState("");
  const accountSummary = accountSummaryOverride ?? fallbackAccountSummary;
  const nextAction = getNextAction(openTasks);
  const sortedContacts = primaryContact
    ? [primaryContact, ...companyContacts.filter((contact) => contact.id !== primaryContact.id)]
    : companyContacts;
  const contactPageSize = 3;
  const totalContactPages = Math.max(1, Math.ceil(sortedContacts.length / contactPageSize));
  const safeContactPage = Math.min(contactPage, totalContactPages - 1);
  const contactStartIndex = safeContactPage * contactPageSize;
  const contactEndIndex = Math.min(contactStartIndex + contactPageSize, sortedContacts.length);
  const visibleContacts = sortedContacts.slice(contactStartIndex, contactEndIndex);
  const contactRangeLabel = sortedContacts.length
    ? `${contactStartIndex + 1}-${contactEndIndex} of ${sortedContacts.length}`
    : "0";
  const mainPhone = primaryContact?.phone || "";
  const website = getCompanyWebsite(company);
  const websiteUrl = formatExternalUrl(website);
  const hasRepairableContacts = companyContacts.some((contact) =>
    parseImportedContactParts(contact.name, contact.role).length > 1
  );

  useEffect(() => {
    setContactPage(0);
    setAccountSummaryOverride(null);
    setSummaryRefreshError("");
  }, [company.id]);

  function toggleSection(tab: ProfileTab) {
    setExpandedSection((currentSection) => (currentSection === tab ? null : tab));
  }

  function saveAccountEdit(values: CompanyEditInput) {
    onUpdateCompany(values);
    setManualPanel(null);
  }

  async function refreshAccountSummary() {
    setIsRefreshingSummary(true);
    setSummaryRefreshError("");

    try {
      const response = await fetch("/api/account-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          company,
          contacts: companyContacts,
          qualifyingQuestions: company.qualifyingQuestions,
          timeline: timelineRows.slice(0, 12),
          openTasks,
          completedTasks: completedTasks.slice(0, 8),
          fallbackSummary: fallbackAccountSummary
        })
      });
      const payload = (await response.json()) as { bullets?: string[]; error?: string };

      if (!response.ok || !payload.bullets?.length) {
        throw new Error(payload.error || "Could not refresh account summary.");
      }

      const previewText = [
        "Replace AI Account Brief with this AI refresh?",
        "",
        ...payload.bullets.map((bullet) => "- " + bullet)
      ].join("\n");

      if (window.confirm(previewText)) {
        setAccountSummaryOverride(payload.bullets);
      }
    } catch (error) {
      setSummaryRefreshError(error instanceof Error ? error.message : "Could not refresh account summary.");
    } finally {
      setIsRefreshingSummary(false);
    }
  }

  return (
    <section className="profile" aria-label="Company Profile">
      <div className="profile-top-row">
        <section className="account-card" aria-label="Account Card">
          <div className="account-card-section account-company-section">
            <div className="account-card-heading">
              <span>Company</span>
              <strong>{statusLabel(company.status)}</strong>
            </div>
            <h2>{company.name || "Not set"}</h2>
            <dl className="account-field-list">
              <div>
                <dt>Address</dt>
                <dd>{getCompanyAddress(company) || "Not set"}</dd>
              </div>
              <div>
                <dt>City, State Zip</dt>
                <dd>{formatCityStateZip(company) || "Not set"}</dd>
              </div>
              <div>
                <dt>Main Phone</dt>
                <dd>
                  {mainPhone ? (
                    <a className="contact-quick-link" href={`tel:${mainPhone}`}>
                      {mainPhone}
                    </a>
                  ) : (
                    "Not set"
                  )}
                </dd>
              </div>
              <div>
                <dt>Website</dt>
                <dd>
                  {websiteUrl ? (
                    <a className="contact-quick-link" href={websiteUrl} target="_blank" rel="noreferrer">
                      {website}
                    </a>
                  ) : (
                    "Not set"
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div className="account-card-section account-card-contacts">
            <div className="account-card-heading">
              <span>Contacts ({contactRangeLabel})</span>
            </div>
            {hasRepairableContacts ? (
              <button className="secondary-action repair-contacts-action" type="button" onClick={onRepairContacts}>
                Repair Contacts
              </button>
            ) : null}
            {visibleContacts.length ? (
              <>
                <ul className="inline-contact-list">
                  {visibleContacts.map((contact) => (
                    <li key={contact.id}>
                      <strong>
                        {contact.name || "Not set"}
                        {primaryContact?.id === contact.id ? (
                          <span className="primary-contact-badge">Primary</span>
                        ) : null}
                      </strong>
                      <span>{contact.role || "Not set"}</span>
                      <span>
                        {contact.phone ? (
                          <a className="contact-quick-link" href={`tel:${contact.phone}`} aria-label={`Call ${contact.name}`}>
                            ☎ {contact.phone}
                          </a>
                        ) : (
                          "Not set"
                        )}
                      </span>
                      <span>
                        {contact.email ? (
                          <a className="contact-quick-link" href={`mailto:${contact.email}`} aria-label={`Email ${contact.name}`}>
                            ✉ {contact.email}
                          </a>
                        ) : (
                          "Not set"
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                {totalContactPages > 1 ? (
                  <div className="contact-pager" aria-label="Contact paging">
                    <button
                      className="secondary-action"
                      disabled={safeContactPage === 0}
                      type="button"
                      onClick={() => setContactPage((page) => Math.max(0, page - 1))}
                    >
                      Previous
                    </button>
                    <button
                      className="secondary-action"
                      disabled={safeContactPage >= totalContactPages - 1}
                      type="button"
                      onClick={() => setContactPage((page) => Math.min(totalContactPages - 1, page + 1))}
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="empty">No contacts saved.</p>
            )}
          </div>

          <div className="account-card-section account-actions-section">
            <div className="account-card-heading">
              <span>Actions</span>
              <strong>Open Actions ({openTasks.length})</strong>
            </div>
            <dl className="account-field-list">
              <div className="next-action-row">
                <dt>Next Action</dt>
                <dd>
                  {nextAction ? (
                    <>
                      <strong>{nextAction.title}</strong>
                      <span>{nextAction.due || "Not set"}</span>
                      <small>Owner: {nextAction.owner}</small>
                    </>
                  ) : (
                    "No Action Scheduled"
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div className="account-card-section manual-entry account-card-manual-entry">
            <button
              className="secondary-action manual-entry-toggle"
              type="button"
              onClick={() => {
                setIsManualEntryOpen((value) => !value);
                setManualPanel(null);
              }}
            >
              Operations Center
            </button>
            {isManualEntryOpen ? (
              <div className="manual-entry-panel">
                <div className="manual-entry-options">
                  <button type="button" onClick={() => setManualPanel(manualPanel === "edit" ? null : "edit")}>
                    Edit Company Info
                  </button>
                  <button type="button" onClick={() => setManualPanel(manualPanel === "contact" ? null : "contact")}>
                    Add Contact
                  </button>
                  <button type="button" onClick={() => setManualPanel(manualPanel === "action" ? null : "action")}>
                    Add Action
                  </button>
                  <button type="button" onClick={() => setManualPanel(manualPanel === "file" ? null : "file")}>
                    Add File
                  </button>
                  <button type="button" onClick={() => setManualPanel(manualPanel === "email" ? null : "email")}>
                    Log Email
                  </button>
                  {company.status === "prospect" ? (
                    <button type="button" onClick={onConvertToCustomer}>
                      Convert Prospect to Customer
                    </button>
                  ) : null}
                </div>
                {manualPanel === "edit" ? (
                  <AccountEditForm
                    company={company}
                    primaryContact={primaryContact}
                    onCancel={() => setManualPanel(null)}
                    onSave={saveAccountEdit}
                  />
                ) : null}
                {manualPanel === "contact" ? (
                  <ProfileContactsSection contacts={companyContacts} onAddManualContact={onAddManualContact} />
                ) : null}
                {manualPanel === "action" ? (
                  <ProfileTasksSection tasks={openTasks} onAddManualTask={onAddManualTask} />
                ) : null}
                {manualPanel === "email" ? (
                  <ManualEmailLogForm source="Outlook" onSave={onLogEmail} />
                ) : null}
                {manualPanel === "file" ? (
                  <FileCabinet
                    accountType="company"
                    files={files}
                    fileCabinetError={fileCabinetError}
                    onOpenFile={onOpenFile}
                    onUploadFile={onUploadFile}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <div className="profile-side-column">
          <section className="account-summary" aria-label="AI Account Brief">
            <div className="account-summary-header">
              <h3>AI Account Brief</h3>
              <button className="secondary-action" disabled={isRefreshingSummary} type="button" onClick={() => void refreshAccountSummary()}>
                {isRefreshingSummary ? "Refreshing" : "AI Refresh Summary"}
              </button>
            </div>
            {summaryRefreshError ? <p className="error-text">{summaryRefreshError}</p> : null}
            {accountSummary.length ? (
              <ul className="account-summary-list">
                {accountSummary.map((sentence) => (
                  <li key={sentence}>{sentence}</li>
                ))}
              </ul>
            ) : (
              <p className="account-summary-empty">No operational intelligence available yet.</p>
            )}
          </section>

          <section className="louie-questions-card" aria-label="Louie's Qualifying Questions">
            <h3>Louie&apos;s Qualifying Questions</h3>
            <div className="louie-question-list">
              {louieQuestions.map((question) => (
                <label className="louie-question-row" key={question}>
                  <span>{question}</span>
                  <textarea
                    value={company.qualifyingQuestions?.[question] ?? ""}
                    onChange={(event) => onUpdateQuestion(question, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="profile-section-buttons" role="tablist" aria-label="Account sections">
        {profileTabs.map((tab) => (
          <button
            aria-selected={expandedSection === tab.id}
            className={expandedSection === tab.id ? "active" : ""}
            key={tab.id}
            onClick={() => toggleSection(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {expandedSection === "tasks" ? (
        <ProfileTasksSection tasks={openTasks} onAddManualTask={onAddManualTask} />
      ) : null}

      <CommandTimeline
        company={company}
        timelineRows={timelineRows}
        noteResult={noteResult}
        onSmartNotesChange={onSmartNotesChange}
        onAddNote={onAddNote}
      />
    </section>
  );
}

function AccountEditForm({
  company,
  primaryContact,
  onCancel,
  onSave
}: {
  company: Company;
  primaryContact: Contact | null;
  onCancel: () => void;
  onSave: (values: CompanyEditInput) => void;
}) {
  const [name, setName] = useState(company.name);
  const [status, setStatus] = useState<CompanyStatus>(company.status);
  const [address, setAddress] = useState(getCompanyAddress(company));
  const [city, setCity] = useState(company.city);
  const [state, setState] = useState(company.state);
  const [zip, setZip] = useState(getCompanyZip(company));
  const [phone, setPhone] = useState(primaryContact?.phone ?? "");
  const [website, setWebsite] = useState(getCompanyWebsite(company));
  const [primaryContactName, setPrimaryContactName] = useState(primaryContact?.name ?? "");
  const [lastContact, setLastContact] = useState(company.lastContact || primaryContact?.lastContact || "");

  return (
    <div className="manual-form account-edit-form" aria-label="Edit account">
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Company Name" />
      <select value={status} onChange={(event) => setStatus(event.target.value as CompanyStatus)} aria-label="Status">
        <option value="prospect">Prospect</option>
        <option value="customer">Customer</option>
      </select>
      <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Address" />
      <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="City" />
      <input value={state} onChange={(event) => setState(event.target.value)} placeholder="State" />
      <input value={zip} onChange={(event) => setZip(event.target.value)} placeholder="Zip" />
      <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone" />
      <input value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="Website" />
      <input
        value={primaryContactName}
        onChange={(event) => setPrimaryContactName(event.target.value)}
        placeholder="Primary Contact"
      />
      <input value={lastContact} onChange={(event) => setLastContact(event.target.value)} placeholder="Last Contact" />
      <button
        type="button"
        onClick={() =>
          onSave({
            name,
            status,
            address,
            city,
            state,
            zip,
            phone,
            website,
            primaryContact: primaryContactName,
            lastContact
          })
        }
      >
        Save
      </button>
      <button className="ghost" type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

function ManualEmailLogForm({
  source,
  onSave
}: {
  source: CommunicationLog["source"];
  onSave: (values: ManualEmailLogInput) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [pasteText, setPasteText] = useState("");
  const [direction, setDirection] = useState<CommunicationLog["direction"]>("sent");
  const [subject, setSubject] = useState("");
  const [contactOrEmail, setContactOrEmail] = useState("");
  const [date, setDate] = useState(today);
  const [summary, setSummary] = useState("");
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [followUpActionText, setFollowUpActionText] = useState("");
  const [followUpDueDate, setFollowUpDueDate] = useState("");

  function parsePastedEmail() {
    const parsedEmail = parseEmailPaste(pasteText, source);

    if (parsedEmail.direction) {
      setDirection(parsedEmail.direction);
    }

    setSubject(parsedEmail.subject || subject);
    setContactOrEmail(parsedEmail.contactOrEmail || contactOrEmail);
    setDate(parsedEmail.date || date);
    setSummary(parsedEmail.summary || summary);

    if (parsedEmail.followUpActionText) {
      setFollowUpNeeded(true);
      setFollowUpActionText(parsedEmail.followUpActionText);
      setFollowUpDueDate(parsedEmail.followUpDueDate || followUpDueDate);
    }
  }

  function submitEmailLog() {
    if (!subject.trim()) {
      return;
    }

    onSave({
      direction,
      subject,
      contactOrEmail,
      date,
      summary,
      followUpNeeded,
      followUpActionText,
      followUpDueDate
    });
    setDirection("sent");
    setSubject("");
    setContactOrEmail("");
    setDate(today);
    setSummary("");
    setFollowUpNeeded(false);
    setFollowUpActionText("");
    setFollowUpDueDate("");
    setPasteText("");
  }

  return (
    <div className="manual-form email-log-form" aria-label="Log email">
      <textarea
        className="email-paste-box"
        value={pasteText}
        onChange={(event) => setPasteText(event.target.value)}
        placeholder="Paste Email Here"
      />
      <button className="secondary-action" disabled={!pasteText.trim()} type="button" onClick={parsePastedEmail}>
        Parse Email
      </button>
      <select
        value={direction}
        onChange={(event) => setDirection(event.target.value as CommunicationLog["direction"])}
        aria-label="Direction"
      >
        <option value="sent">Sent</option>
        <option value="received">Received</option>
      </select>
      <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" />
      <input
        value={contactOrEmail}
        onChange={(event) => setContactOrEmail(event.target.value)}
        placeholder="Contact / Email"
      />
      <input value={date} onChange={(event) => setDate(event.target.value)} type="date" aria-label="Date" />
      <textarea value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Summary / Notes" />
      <label className="manual-checkbox-row">
        <input
          checked={followUpNeeded}
          onChange={(event) => setFollowUpNeeded(event.target.checked)}
          type="checkbox"
        />
        <span>Follow-up needed</span>
      </label>
      {followUpNeeded ? (
        <>
          <input
            value={followUpActionText}
            onChange={(event) => setFollowUpActionText(event.target.value)}
            placeholder="Follow-up action text"
          />
          <input
            value={followUpDueDate}
            onChange={(event) => setFollowUpDueDate(event.target.value)}
            placeholder="Follow-up due date"
          />
        </>
      ) : null}
      <div className="manual-source-row">Source: {source}</div>
      <button type="button" onClick={submitEmailLog}>
        Save Email Log
      </button>
    </div>
  );
}

function parseEmailPaste(rawText: string, source: CommunicationLog["source"]) {
  const text = rawText.trim();
  const headers = extractEmailHeaders(text);
  const body = extractEmailBody(text, headers.headerLineCount);
  const from = headers.from ?? "";
  const to = headers.to ?? "";
  const subject = headers.subject || firstMeaningfulLine(body) || "";
  const contactOrEmail = extractContactOrEmail(source === "Outlook" ? from || to : from || to);
  const direction = inferEmailDirection(from, to, source);
  const date = parsePastedEmailDate(headers.date ?? headers.sent ?? "");
  const summary = summarizePastedEmailBody(body || text);
  const followUpActionText = suggestEmailFollowUp(summary || subject);

  return {
    direction,
    subject,
    contactOrEmail,
    date,
    summary,
    followUpActionText,
    followUpDueDate: followUpActionText ? "Today" : ""
  };
}

function extractEmailHeaders(text: string) {
  const headers: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  let headerLineCount = 0;
  let currentHeader = "";

  for (const line of lines) {
    const match = line.match(/^(from|to|subject|sent|date|cc):\s*(.*)$/i);

    if (match) {
      currentHeader = match[1].toLowerCase();
      headers[currentHeader] = match[2].trim();
      headerLineCount += 1;
      continue;
    }

    if (currentHeader && /^\s+/.test(line)) {
      headers[currentHeader] = [headers[currentHeader], line.trim()].filter(Boolean).join(" ");
      headerLineCount += 1;
      continue;
    }

    if (line.trim() === "") {
      headerLineCount += 1;
      continue;
    }

    break;
  }

  return {
    from: headers.from,
    to: headers.to,
    subject: headers.subject,
    sent: headers.sent,
    date: headers.date,
    cc: headers.cc,
    headerLineCount
  };
}

function extractEmailBody(text: string, headerLineCount: number) {
  const lines = text.split(/\r?\n/);

  return lines
    .slice(headerLineCount)
    .join("\n")
    .replace(/^[-_]{2,}.*$/gm, "")
    .trim();
}

function firstMeaningfulLine(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !/^(from|to|subject|sent|date|cc):/i.test(line)) ?? "";
}

function extractContactOrEmail(value: string) {
  const emailMatch = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);

  if (emailMatch) {
    return emailMatch[0];
  }

  return value.replace(/[<>]/g, "").trim();
}

function inferEmailDirection(from: string, to: string, source: CommunicationLog["source"]): CommunicationLog["direction"] | "" {
  const userMailboxes = source === "Outlook"
    ? ["brian@mcggrain.com", "louie@mcggrain.com"]
    : ["operations@bluebomberlogistics.com"];
  const normalizedFrom = from.toLowerCase();
  const normalizedTo = to.toLowerCase();

  if (userMailboxes.some((mailbox) => normalizedFrom.includes(mailbox))) {
    return "sent";
  }

  if (userMailboxes.some((mailbox) => normalizedTo.includes(mailbox))) {
    return "received";
  }

  return "";
}

function parsePastedEmailDate(value: string) {
  if (!value.trim()) {
    return "";
  }

  const parsedDate = new Date(value);

  return Number.isNaN(parsedDate.getTime()) ? "" : parsedDate.toISOString().slice(0, 10);
}

function summarizePastedEmailBody(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6)
    .join("\n");
}

function suggestEmailFollowUp(value: string) {
  const normalizedValue = value.toLowerCase();
  const trigger = [
    "please update",
    "need to",
    "can you",
    "follow up",
    "send",
    "resend",
    "quote",
    "bol",
    "pod",
    "coi",
    "w9"
  ].find((phrase) => normalizedValue.includes(phrase));

  if (!trigger) {
    return "";
  }

  if (normalizedValue.includes("coi")) {
    return "Follow up on COI";
  }

  if (normalizedValue.includes("w9")) {
    return "Follow up on W9";
  }

  if (normalizedValue.includes("pod")) {
    return "Follow up on POD";
  }

  if (normalizedValue.includes("bol")) {
    return "Follow up on BOL";
  }

  if (normalizedValue.includes("quote")) {
    return "Follow up on quote";
  }

  return "Follow up on email";
}

const companyFileCategories: AccountFileCategory[] = ["BOLs", "PODs", "Rate Confirmations", "COIs", "Invoices", "Misc"];
const carrierFileCategories: AccountFileCategory[] = ["COIs", "W9s", "NOAs", "Carrier Packets", "Misc"];

function FileCabinet({
  accountType,
  files,
  fileCabinetError,
  onOpenFile,
  onUploadFile
}: {
  accountType: AccountFile["accountType"];
  files: AccountFile[];
  fileCabinetError: string;
  onOpenFile: (file: AccountFile, download?: boolean) => void;
  onUploadFile: (file: File, category: AccountFileCategory) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const categoryOptions = accountType === "carrier" ? carrierFileCategories : companyFileCategories;
  const [category, setCategory] = useState<AccountFileCategory>("Misc");

  return (
    <div className="file-cabinet" aria-label="File Cabinet">
      <div className="profile-section-heading file-cabinet-heading">
        <span>{files.length} file{files.length === 1 ? "" : "s"}</span>
        <div className="file-upload-controls">
          <label>
            <span className="sr-only">File category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as AccountFileCategory)}
            >
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <button className="secondary-action" type="button" onClick={() => inputRef.current?.click()}>
            Upload File
          </button>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            onUploadFile(file, category);
            event.target.value = "";
          }
        }}
      />
      {fileCabinetError ? <p className="error-text">{fileCabinetError}</p> : null}
      {files.length ? (
        <ul className="compact-profile-list file-list">
          {files.map((file) => (
            <li key={file.id}>
              <div className="file-row-main">
                <button className="file-name-button" type="button" onClick={() => onOpenFile(file)}>
                  {file.name}
                </button>
                <span>
                  {file.category} · {getFileExtension(file.name)} · {formatFileSize(file.size)} · Uploaded {formatFileDate(file.uploadedAt)}
                  {file.uploadedBy ? ` by ${file.uploadedBy}` : ""}
                  {file.provider === "google_drive" ? " · Google Drive" : " · Supabase Storage"}
                </span>
              </div>
              <div className="file-row-actions">
                <button className="secondary-action" type="button" onClick={() => onOpenFile(file)}>
                  Open
                </button>
                <button className="ghost" type="button" onClick={() => onOpenFile(file, true)}>
                  Download
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">No files uploaded.</p>
      )}
    </div>
  );
}

function ProfileTasksSection({
  tasks,
  onAddManualTask
}: {
  tasks: Task[];
  onAddManualTask: (values: ManualTaskInput) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("Louie");
  const [due, setDue] = useState("Today");
  const [priority, setPriority] = useState<Task["priority"]>("normal");

  function submitTask() {
    onAddManualTask({ title, owner, due, priority });
    setTitle("");
    setOwner("Louie");
    setDue("Today");
    setPriority("normal");
    setShowForm(false);
  }

  return (
    <Panel title="Tasks">
      <div className="profile-section-heading">
        <span>{tasks.length} open</span>
        <button className="secondary-action" type="button" onClick={() => setShowForm((value) => !value)}>
          + Action
        </button>
      </div>
      {showForm ? (
        <div className="manual-form" aria-label="Add manual task">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Action Name" />
          <input value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Owner" />
          <input value={due} onChange={(event) => setDue(event.target.value)} placeholder="Due" />
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as Task["priority"])}
            aria-label="Priority"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <button type="button" onClick={submitTask}>
            Save Action
          </button>
        </div>
      ) : null}
      {tasks.length ? (
        <ul className="compact-profile-list">
          {tasks.map((task) => (
            <li key={task.id}>
              <strong>{task.title}</strong>
              <span>{task.owner} · {task.due} · {taskStatusLabel(getTaskDisplayStatus(task))}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">No open actions.</p>
      )}
    </Panel>
  );
}

function ProfileContactsSection({
  contacts,
  onAddManualContact
}: {
  contacts: typeof seedContacts;
  onAddManualContact: (values: ManualContactInput) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  function submitContact() {
    onAddManualContact({ name, role, phone, email });
    setName("");
    setRole("");
    setPhone("");
    setEmail("");
    setShowForm(false);
  }

  return (
    <Panel title="Contacts">
      <div className="profile-section-heading">
        <span>{contacts.length} saved</span>
        <button className="secondary-action" type="button" onClick={() => setShowForm((value) => !value)}>
          + Contact
        </button>
      </div>
      {showForm ? (
        <div className="manual-form" aria-label="Add manual contact">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" />
          <input value={role} onChange={(event) => setRole(event.target.value)} placeholder="Role" />
          <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone" />
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
          <button type="button" onClick={submitContact}>
            Save Contact
          </button>
        </div>
      ) : null}
      {contacts.length ? (
        <ul className="compact-profile-list">
          {contacts.map((contact) => (
            <li key={contact.id}>
              <strong>{contact.name}</strong>
              <span>{[contact.role, contact.phone, contact.email].filter(Boolean).join(" · ") || "No details yet"}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">No contacts saved.</p>
      )}
    </Panel>
  );
}

function CommandTimeline({
  company,
  timelineRows,
  noteResult,
  onSmartNotesChange,
  onAddNote
}: {
  company: Company;
  timelineRows: ProfileTimelineRow[];
  noteResult: NoteSaveResult | null;
  onSmartNotesChange: (smartNotes: string) => void;
  onAddNote: () => void;
}) {
  const [showSystemEvents, setShowSystemEvents] = useState(false);
  const humanRows = timelineRows.filter((entry) => !isSystemTimelineEvent(entry));
  const systemRows = timelineRows.filter(isSystemTimelineEvent);
  const visibleRows = showSystemEvents ? timelineRows : humanRows;

  return (
    <section className="command-timeline" aria-label="Call Notes">
      <div className="command-center">
        <div className="command-center-header">
          <h3>Call Notes</h3>
          <p>Type notes naturally. Blue Bomber OS will detect tasks and activities automatically.</p>
        </div>

        <textarea
          value={company.smartNotes}
          onChange={(event) => onSmartNotesChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onAddNote();
            }
          }}
          placeholder={"What's goin' on Jerry?"}
        />
        <div className="note-actions">
          <button type="button" onClick={onAddNote}>
            Add Note
          </button>
        </div>
        {noteResult ? <NoteSavedMessage {...noteResult} /> : null}
      </div>

      <div className="timeline-stream">
        <div className="timeline-heading">
          <h3>Timeline</h3>
          {systemRows.length ? (
            <button type="button" onClick={() => setShowSystemEvents((value) => !value)}>
              {showSystemEvents ? "Hide System Events" : "Show System Events"}
            </button>
          ) : null}
        </div>
        {visibleRows.length ? (
          visibleRows.map((entry) => (
            <div className={getTimelineItemClassName(entry)} key={entry.id}>
              <span className="timeline-icon" aria-hidden="true">{getTimelineIcon(entry)}</span>
              <div className="timeline-copy">
                <strong>{formatTimelineTitle(entry.title)}</strong>
                <span>{entry.detail}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="empty">No timeline yet.</p>
        )}
      </div>
    </section>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function NoteSavedMessage({ tasks, systemUpdates }: NoteSaveResult) {
  return (
    <div className="note-saved" role="status">
      <strong>✓ Note Saved</strong>
      {tasks.length ? (
        <>
          <span>User Actions Created:</span>
          <ul>
            {tasks.map((task) => (
              <li key={`${task.title}-${task.owner}`}>
                {task.title} ({task.owner})
              </li>
            ))}
          </ul>
        </>
      ) : (
        <span>No user actions created.</span>
      )}
      {systemUpdates.length ? (
        <>
          <span>System Updates:</span>
          <ul>
            {systemUpdates.map((update) => (
              <li key={update}>{update}</li>
            ))}
          </ul>
        </>
      ) : (
        <span>System Updates:</span>
      )}
    </div>
  );
}

function CompanySearch({
  activeAccountTab,
  companies,
  importInputRef,
  importResult,
  isImporting,
  previewCompany,
  searchValue,
  selectedBulkProspectIds,
  selectedCompanyId,
  onArchiveSelected,
  onBulkStatusChange,
  onDeleteSelected,
  onImportFile,
  onSearchChange,
  onSelect,
  onToggleBulkProspect
}: {
  activeAccountTab: AccountTab;
  companies: Company[];
  importInputRef: React.RefObject<HTMLInputElement>;
  importResult: { imported: number; skipped: number } | null;
  isImporting: boolean;
  previewCompany: Company | null;
  searchValue: string;
  selectedBulkProspectIds: string[];
  selectedCompanyId: string | null;
  onArchiveSelected: () => void;
  onBulkStatusChange: (status: CompanyStatus) => void;
  onDeleteSelected: () => void;
  onImportFile: (file: File) => void;
  onSearchChange: (value: string) => void;
  onSelect: (companyId: string) => void;
  onToggleBulkProspect: (companyId: string) => void;
}) {
  const hasBulkSelection = selectedBulkProspectIds.length > 0;

  return (
    <div className="company-picker">
      <label htmlFor="company-search">Search Companies</label>
      {activeAccountTab === "prospects" ? (
        <>
          <div className="import-control">
            <button type="button" onClick={() => importInputRef.current?.click()} disabled={isImporting}>
              {isImporting ? "Importing" : "Import"}
            </button>
            <input
              ref={importInputRef}
              accept=".csv,.xlsx"
              aria-label="Import prospects"
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];

                if (file) {
                  void onImportFile(file);
                }
              }}
            />
            {importResult ? (
              <span>
                Imported {importResult.imported} · Skipped {importResult.skipped}
              </span>
            ) : null}
          </div>
          <div className="bulk-control" aria-label="Bulk prospect actions">
            <div className="bulk-actions">
              <span>{selectedBulkProspectIds.length} selected</span>
              <select
                aria-label="Change selected prospect status"
                disabled={!hasBulkSelection}
                defaultValue=""
                onChange={(event) => {
                  const status = event.target.value as CompanyStatus | "";

                  if (status) {
                    onBulkStatusChange(status);
                    event.currentTarget.value = "";
                  }
                }}
              >
                <option value="">Status</option>
                <option value="prospect">Prospect</option>
                <option value="customer">Customer</option>
              </select>
              <button type="button" disabled={!hasBulkSelection} onClick={onArchiveSelected}>
                Archive
              </button>
              <button
                className="danger"
                type="button"
                disabled={!hasBulkSelection}
                onClick={onDeleteSelected}
              >
                Delete
              </button>
            </div>
            {companies.length ? (
              <ul className="bulk-list">
                {companies.map((company) => (
                  <li key={company.id}>
                    <label>
                      <input
                        checked={selectedBulkProspectIds.includes(company.id)}
                        type="checkbox"
                        onChange={() => onToggleBulkProspect(company.id)}
                      />
                      <span>{company.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </>
      ) : null}
      <input
        id="company-search"
        list="company-options"
        onChange={(event) => {
          const value = event.target.value;
          onSearchChange(value);
          const match = companies.find((company) => company.name === value);

          if (match) {
            onSelect(match.id);
          }
        }}
        placeholder="Search Companies"
        value={searchValue}
      />
      <datalist id="company-options">
        {companies.map((company) => (
          <option key={company.id} value={company.name} />
        ))}
      </datalist>

      {previewCompany ? (
        <button
          className={previewCompany.id === selectedCompanyId ? "company-preview selected" : "company-preview"}
          type="button"
          onClick={() => onSelect(previewCompany.id)}
        >
          <span>{statusLabel(previewCompany.status)}</span>
          <strong>{previewCompany.name}</strong>
          <small>
            {previewCompany.city}, {previewCompany.state}
          </small>
        </button>
      ) : (
        <div className="company-preview empty-preview">No company selected.</div>
      )}
    </div>
  );
}

async function readProspectImportRows(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "csv") {
    return parseProspectRows(parseCsv(await file.text()));
  }

  if (extension === "xlsx") {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return parseProspectRows([]);
    }

    return parseProspectRows(
      XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheetName], {
        defval: ""
      })
    );
  }

  throw new Error("Import requires a .csv or .xlsx file.");
}

function parseProspectRows(rows: Array<Record<string, unknown>>): {
  headers: string[];
  normalizedHeaders: string[];
  fieldMapping: Record<ImportFieldKey, string>;
  rows: ProspectImportRow[];
  unmappedColumns: string[];
} {
  const headers = getImportHeaders(rows);
  const fieldMapping = mapImportHeaders(headers);
  const mappedHeaders = new Set(Object.values(fieldMapping).filter(Boolean));
  const unmappedColumns = headers.filter((header) => !mappedHeaders.has(header));

  return {
    headers,
    normalizedHeaders: headers.map(normalizeImportHeader),
    fieldMapping,
    unmappedColumns,
    rows: rows.map((row) => {
      const contactName = getImportMappedValue(row, fieldMapping.contactName);
      const contactRole = getImportMappedValue(row, fieldMapping.contactRole);
      const contactPhone = getImportPhoneValue(row, fieldMapping.contactPhone || fieldMapping.phone);
      const contactEmail = getImportEmailValue(row, fieldMapping.contactEmail);

      return {
        companyName: getImportMappedValue(row, fieldMapping.companyName),
        status: parseImportStatus(getImportMappedValue(row, fieldMapping.status)),
        salesLead: getImportValueByAliases(row, ["sales lead", "sales owner"]) || "Louie",
        operationsLead: getImportValueByAliases(row, ["operations lead", "operations owner"]) || "Brian",
        address: getImportMappedValue(row, fieldMapping.address),
        city: getImportMappedValue(row, fieldMapping.city),
        state: getImportMappedValue(row, fieldMapping.state),
        zip: getImportMappedValue(row, fieldMapping.zip),
        phone: getImportPhoneValue(row, fieldMapping.phone),
        email: contactEmail,
        website: getImportMappedValue(row, fieldMapping.website),
        contactName,
        contactRole,
        contactPhone,
        contactEmail,
        contacts: parseImportedContactRecords(contactName, contactRole, contactPhone, contactEmail),
        notes: getImportMappedValue(row, fieldMapping.notes)
      };
    })
  };
}

function buildImportedContacts(row: ProspectImportRow, companyId: string): Contact[] {
  const parsedContacts = row.contacts.length
    ? row.contacts
    : parseImportedContactRecords(row.contactName, row.contactRole, row.contactPhone, row.contactEmail);

  if (!companyId || !parsedContacts.length) {
    return [];
  }

  return parsedContacts.map((contact) => ({
    id: createUuid(),
    companyId,
    name: contact.name,
    role: contact.title || "Imported",
    email: contact.email,
    phone: contact.phone,
    source: "Import",
    createdBy: "Import"
  }));
}

function parseImportedContactRecords(contactName: string, contactRole: string, phone: string, email: string) {
  const contactParts = parseImportedContactParts(contactName, contactRole);
  const cleanPhone = phone.trim();
  const cleanEmail = email.trim();
  const extractedPhones = extractImportPhones([contactName, contactRole, cleanPhone].join(" "));
  const extractedEmails = extractImportEmails([contactName, contactRole, cleanEmail].join(" "));
  const parts = contactParts.length
    ? contactParts
    : contactName.trim() || cleanPhone || cleanEmail
      ? [{ name: cleanImportedContactField(contactName) || "Imported Contact", title: cleanImportedContactField(contactRole) || "Imported" }]
      : [];
  const phoneAssignments = assignImportedContactValues(
    parts,
    extractedPhones.length ? extractedPhones : cleanPhone ? [cleanPhone] : [],
    "phone"
  );
  const emailAssignments = assignImportedContactValues(
    parts,
    extractedEmails.length ? extractedEmails : cleanEmail ? [cleanEmail] : [],
    "email"
  );

  return parts
    .map((part, index) => ({
      name: part.name,
      title: part.title || cleanImportedContactField(contactRole),
      phone: phoneAssignments[index] ?? "",
      email: emailAssignments[index] ?? ""
    }))
    .filter((contact) => contact.name);
}

function assignImportedContactValues(
  parts: Array<{ name: string; title: string }>,
  values: string[],
  type: "email" | "phone"
) {
  const assignments = parts.map(() => "");

  if (!values.length || !parts.length) {
    return assignments;
  }

  if (parts.length === 1) {
    assignments[0] = values[0] ?? "";
    return assignments;
  }

  values.forEach((value, valueIndex) => {
    const matchedIndex =
      type === "email" ? parts.findIndex((part) => emailLooksOwnedByContact(value, part.name)) : -1;
    const fallbackIndex = values.length === 1 ? 0 : parts.findIndex((_, index) => !assignments[index]);
    const assignmentIndex = matchedIndex >= 0 ? matchedIndex : fallbackIndex;

    if (assignmentIndex >= 0 && !assignments[assignmentIndex]) {
      assignments[assignmentIndex] = value;
    } else if (valueIndex === 0 && !assignments[0]) {
      assignments[0] = value;
    }
  });

  return assignments;
}

function extractImportEmails(value: string) {
  return Array.from(new Set(value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []));
}

function extractImportPhones(value: string) {
  return Array.from(new Set(value.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g) ?? []));
}

function emailLooksOwnedByContact(email: string, contactName: string) {
  const localPart = email.split("@")[0]?.toLowerCase() ?? "";
  const nameTokens = contactName
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z]/g, ""))
    .filter((token) => token.length > 2);

  if (!localPart || !nameTokens.length) {
    return false;
  }

  return nameTokens.some((token) => localPart.includes(token));
}

function parseImportedContactParts(contactName: string, contactRole: string) {
  const value = removeContactLocationFragments(contactName.trim());

  if (!value) {
    return [];
  }

  const repeatedPatternContacts = parseRepeatedNameTitlePattern(value);

  if (repeatedPatternContacts.length) {
    return repeatedPatternContacts;
  }

  const dashParts = value.split(/\s*[-–—]\s*/).map(cleanImportedContactField).filter(Boolean);

  if (dashParts.length >= 2) {
    const contactParts: Array<{ name: string; title: string }> = [];
    let currentName = dashParts[0];

    dashParts.slice(1).forEach((part, index, parts) => {
      const isLastPart = index === parts.length - 1;
      const trailingName = isLastPart ? null : extractTrailingImportedName(part);
      const role = trailingName ? cleanImportedContactField(part.slice(0, trailingName.index)) : part;

      if (currentName) {
        contactParts.push({ name: currentName, title: role });
      }

      currentName = trailingName?.name ?? "";
    });

    if (contactParts.length) {
      return contactParts;
    }
  }

  const contactParts: Array<{ name: string; title: string }> = [];
  const nameTitlePattern =
    /([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+)+)\s*(?:[-–—]\s*)?([\s\S]*?)(?=\s+[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+)+\s*[-–—]|$)/g;

  for (const match of value.matchAll(nameTitlePattern)) {
    const name = cleanImportedContactField(match[1] ?? "");
    const role = cleanImportedContactField(match[2] ?? "");

    if (name) {
      contactParts.push({ name, title: role });
    }
  }

  if (contactParts.length) {
    return contactParts;
  }

  return [
    {
      name: cleanImportedContactField(value),
      title: cleanImportedContactField(contactRole)
    }
  ].filter((contact) => contact.name);
}

function parseRepeatedNameTitlePattern(value: string) {
  const cleanValue = removeContactLocationFragments(value);
  const segments = cleanValue.split(/\s*[-–—]\s*/).map(cleanImportedContactField).filter(Boolean);

  if (segments.length < 4 || segments.length % 2 !== 0) {
    return [];
  }

  const contacts: Array<{ name: string; title: string }> = [];

  for (let index = 0; index < segments.length; index += 2) {
    const name = segments[index];
    const title = segments[index + 1] ?? "";

    if (!looksLikeImportedContactName(name)) {
      return [];
    }

    contacts.push({ name, title });
  }

  return contacts;
}

function removeContactLocationFragments(value: string) {
  return value
    .replace(/\b(?:louisville|fort wayne|lexington)\s*,?\s*(?:KY|IN)\b/gi, " ")
    .replace(/\b[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)?\s*,\s*(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NJ|NM|NV|NY|OH|OK|OR|PA|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY)\b/g, " ")
    .replace(/\b(?:location|city|state|province)\s*[:/-]\s*[A-Za-z .'-]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeImportedContactName(value: string) {
  const words = value.split(/\s+/).filter(Boolean);

  return words.length >= 2 && words.length <= 3 && words.every((word) => /^[A-Z][A-Za-z'’-]+$/i.test(word));
}

function cleanImportedContactField(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ")
    .replace(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*[-–—]\s*$/, "")
    .trim();
}

function extractTrailingImportedName(value: string) {
  const words = value.split(/\s+/).filter(Boolean);

  if (words.length < 3) {
    return null;
  }

  const trailingWords = words.slice(-2);

  if (!trailingWords.every((word) => /^[A-Z][A-Za-z'’-]+$/.test(word))) {
    return null;
  }

  const name = trailingWords.join(" ");

  return {
    name,
    index: value.lastIndexOf(name)
  };
}

const importFieldAliases: Record<ImportFieldKey, string[]> = {
  companyName: ["company", "company name", "customer", "account", "business", "business name", "account name", "name"],
  status: ["status", "type", "stage", "category"],
  address: ["address", "street", "street address", "address 1", "mailing address"],
  city: ["city", "location city", "location: city", "town"],
  state: ["state", "province", "location state", "location: state", "st"],
  zip: ["zip", "zipcode", "zip code", "postal code"],
  phone: ["phone", "phone number", "main phone", "contact phone", "company phone", "office phone", "telephone", "number", "email phone", "email & phone"],
  website: ["website", "web", "url", "company website"],
  notes: ["notes", "note", "comments", "description"],
  contactName: ["contact", "contact name", "primary contact", "poc", "point of contact", "name of contact"],
  contactRole: ["title", "role", "position", "contact title", "job title", "department"],
  contactPhone: ["contact phone", "phone", "phone number", "mobile", "cell", "direct phone", "main phone", "email phone", "email & phone"],
  contactEmail: ["email", "email address", "contact email", "e-mail", "email phone", "email & phone"]
};

function buildImportPreview(
  fileName: string,
  parsedImport: {
    headers: string[];
    normalizedHeaders: string[];
    fieldMapping: Record<ImportFieldKey, string>;
    rows: ProspectImportRow[];
    unmappedColumns: string[];
  },
  existingCompanies: Company[]
): ImportPreview {
  const existingNames = new Set(existingCompanies.map((company) => normalizeCompanyName(company.name)));
  const seenNames = new Set<string>();

  return {
    fileName,
    detectedColumns: parsedImport.headers,
    normalizedColumns: parsedImport.normalizedHeaders,
    fieldMapping: parsedImport.fieldMapping,
    mappedColumns: buildImportMappedColumns(parsedImport.headers, parsedImport.fieldMapping),
    confidence: getImportConfidence(parsedImport.fieldMapping),
    unmappedColumns: parsedImport.unmappedColumns,
    rows: parsedImport.rows.map((row, index) => {
      const normalizedName = normalizeCompanyName(row.companyName);
      let skippedReason = "";

      if (!normalizedName) {
        skippedReason = "Missing company name";
      } else if (existingNames.has(normalizedName)) {
        skippedReason = "Duplicate company already exists";
      } else if (seenNames.has(normalizedName)) {
        skippedReason = "Duplicate company in import file";
      }

      if (normalizedName) {
        seenNames.add(normalizedName);
      }

      return {
        rowNumber: index + 2,
        row,
        action: skippedReason ? "skip" : "ready",
        skippedReason
      };
    })
  };
}

function buildImportMappedColumns(headers: string[], fieldMapping: Record<ImportFieldKey, string>) {
  return headers
    .map((header) => {
      const mappedFields = (Object.entries(fieldMapping) as Array<[ImportFieldKey, string]>)
        .filter(([, mappedHeader]) => mappedHeader === header)
        .map(([field]) => formatImportField(field));

      return {
        detected: header,
        mappedTo: mappedFields.join(", ")
      };
    })
    .filter((mapping) => mapping.mappedTo);
}

function getImportConfidence(fieldMapping: Record<ImportFieldKey, string>): ImportPreview["confidence"] {
  const requiredFields: ImportFieldKey[] = ["companyName", "city", "state", "contactName", "contactEmail", "contactPhone"];
  const mappedRequiredCount = requiredFields.filter((field) => fieldMapping[field]).length;

  if (fieldMapping.companyName && mappedRequiredCount >= 5) {
    return "High Confidence";
  }

  if (fieldMapping.companyName && mappedRequiredCount >= 3) {
    return "Medium Confidence";
  }

  return "Low Confidence";
}

function confidenceClassName(confidence: ImportPreview["confidence"]) {
  return `import-confidence ${confidence.toLowerCase().replace(/\s+/g, "-")}`;
}

function getImportHeaders(rows: Array<Record<string, unknown>>) {
  const headers = new Set<string>();

  rows.forEach((row) => {
    Object.keys(row).forEach((header) => {
      if (header.trim()) {
        headers.add(header.trim());
      }
    });
  });

  return [...headers];
}

function mapImportHeaders(headers: string[]): Record<ImportFieldKey, string> {
  return Object.fromEntries(
    Object.entries(importFieldAliases).map(([field, aliases]) => {
      const matchedHeader = findBestImportHeader(headers, aliases);

      return [field, matchedHeader];
    })
  ) as Record<ImportFieldKey, string>;
}

function findBestImportHeader(headers: string[], aliases: string[]) {
  const scoredHeaders = headers
    .map((header) => ({
      header,
      score: getImportHeaderScore(header, aliases)
    }))
    .filter((item) => item.score > 0)
    .sort((first, second) => second.score - first.score);

  return scoredHeaders[0]?.header ?? "";
}

function getImportHeaderScore(header: string, aliases: string[]) {
  const normalizedHeader = normalizeImportHeader(header);
  const compactHeader = compactImportHeader(header);

  return aliases.reduce((bestScore, alias) => {
    const normalizedAlias = normalizeImportHeader(alias);
    const compactAlias = compactImportHeader(alias);

    if (normalizedHeader === normalizedAlias || compactHeader === compactAlias) {
      return Math.max(bestScore, 100);
    }

    if (normalizedHeader.includes(normalizedAlias) || compactHeader.includes(compactAlias)) {
      return Math.max(bestScore, 80);
    }

    if (normalizedAlias.includes(normalizedHeader) || compactAlias.includes(compactHeader)) {
      return Math.max(bestScore, 60);
    }

    return bestScore;
  }, 0);
}

function getImportMappedValue(row: Record<string, unknown>, mappedHeader: string) {
  if (!mappedHeader) {
    return "";
  }

  const value = row[mappedHeader];

  return value == null ? "" : String(value).trim();
}

function getImportEmailValue(row: Record<string, unknown>, mappedHeader: string) {
  return getImportMappedValue(row, mappedHeader);
}

function getImportPhoneValue(row: Record<string, unknown>, mappedHeader: string) {
  const value = getImportMappedValue(row, mappedHeader);
  const phone = value.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/)?.[0] ?? "";

  return phone || value;
}

function getImportValueByAliases(row: Record<string, unknown>, aliases: string[]) {
  const entries = Object.entries(row);
  const normalizedAliases = new Set(aliases.map(normalizeImportHeader));
  const match = entries.find(([key]) => normalizedAliases.has(normalizeImportHeader(key)));

  return match?.[1] == null ? "" : String(match[1]).trim();
}

function normalizeImportHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/%23/g, " ")
    .replace(/#/g, " ")
    .replace(/&/g, " ")
    .replace(/:/g, " ")
    .replace(/[_/-]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ");
}

function compactImportHeader(value: string) {
  return normalizeImportHeader(value).replace(/\s+/g, "");
}

function formatImportField(field: ImportFieldKey) {
  const labels: Record<ImportFieldKey, string> = {
    companyName: "Company Name",
    status: "Status",
    address: "Address",
    city: "City",
    state: "State",
    zip: "Zip",
    phone: "Phone",
    website: "Website",
    notes: "Notes",
    contactName: "Contact Name",
    contactRole: "Contact Title",
    contactPhone: "Contact Phone",
    contactEmail: "Contact Email"
  };

  return labels[field];
}

async function readCarrierImportRows(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "csv") {
    return parseCarrierRows(parseCsv(await file.text()));
  }

  if (extension === "xlsx") {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return parseCarrierRows([]);
    }

    return parseCarrierRows(
      XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheetName], {
        defval: ""
      })
    );
  }

  throw new Error("Carrier import requires a .csv or .xlsx file.");
}

function parseCarrierRows(rows: Array<Record<string, unknown>>): {
  headers: string[];
  normalizedHeaders: string[];
  fieldMapping: Record<CarrierImportFieldKey, string>;
  rows: CarrierImportRow[];
  unmappedColumns: string[];
} {
  const headers = getImportHeaders(rows);
  const fieldMapping = mapCarrierImportHeaders(headers);
  const mappedHeaders = new Set(Object.values(fieldMapping).filter(Boolean));
  const unmappedColumns = headers.filter((header) => !mappedHeaders.has(header));

  console.log("[Blue Bomber Carrier Import] raw headers:", headers);
  console.log("[Blue Bomber Carrier Import] normalized headers:", headers.map(normalizeImportHeader));
  console.log("[Blue Bomber Carrier Import] field mapping result:", fieldMapping);

  return {
    headers,
    normalizedHeaders: headers.map(normalizeImportHeader),
    fieldMapping,
    unmappedColumns,
    rows: rows.map((row) => ({
      carrierName: getImportMappedValue(row, fieldMapping.carrierName),
      mcNumber: normalizeCarrierNumber(getImportMappedValue(row, fieldMapping.mcNumber)),
      dotNumber: normalizeCarrierNumber(getImportMappedValue(row, fieldMapping.dotNumber)),
      primaryContact: cleanBlankImportValue(getImportMappedValue(row, fieldMapping.primaryContact)),
      dispatchPhone: normalizeImportPhone(getImportMappedValue(row, fieldMapping.dispatchPhone)),
      dispatchEmail: normalizeImportEmail(getImportMappedValue(row, fieldMapping.dispatchEmail)),
      mainPhone: normalizeImportPhone(getImportMappedValue(row, fieldMapping.mainPhone)),
      email: normalizeImportEmail(getImportMappedValue(row, fieldMapping.email)),
      safetyEmail: normalizeImportEmail(getImportMappedValue(row, fieldMapping.safetyEmail)),
      accountingEmail: normalizeImportEmail(getImportMappedValue(row, fieldMapping.accountingEmail)),
      address: cleanBlankImportValue(getImportMappedValue(row, fieldMapping.address)),
      city: cleanBlankImportValue(getImportMappedValue(row, fieldMapping.city)),
      state: normalizeStateAbbreviation(getImportMappedValue(row, fieldMapping.state)),
      zip: cleanBlankImportValue(getImportMappedValue(row, fieldMapping.zip)),
      equipment: cleanBlankImportValue(getImportMappedValue(row, fieldMapping.equipment)),
      notes: cleanBlankImportValue(getImportMappedValue(row, fieldMapping.notes)),
      status: cleanBlankImportValue(getImportMappedValue(row, fieldMapping.status)),
      w9Status: cleanBlankImportValue(getImportMappedValue(row, fieldMapping.w9Status)),
      coiStatus: cleanBlankImportValue(getImportMappedValue(row, fieldMapping.coiStatus)),
      noaStatus: cleanBlankImportValue(getImportMappedValue(row, fieldMapping.noaStatus)),
      carrierPacketStatus: cleanBlankImportValue(getImportMappedValue(row, fieldMapping.carrierPacketStatus))
    }))
  };
}

const carrierImportFieldAliases: Record<CarrierImportFieldKey, string[]> = {
  carrierName: ["carrier", "carrier name", "company", "company name", "name"],
  mcNumber: ["mc", "mc number", "mc#", "mc no", "mc no.", "motor carrier"],
  dotNumber: ["dot", "dot number", "dot#", "dot no", "dot no.", "usdot", "us dot"],
  primaryContact: ["contact", "primary contact", "contact name", "poc", "dispatcher", "dispatch contact"],
  dispatchPhone: ["dispatch phone", "contact phone", "phone", "phone number"],
  dispatchEmail: ["dispatch email", "contact email", "email", "email address"],
  mainPhone: ["main phone", "office phone", "carrier phone", "telephone"],
  email: ["email", "email address", "main email", "carrier email"],
  safetyEmail: ["safety email", "safety"],
  accountingEmail: ["accounting email", "billing email", "accounts payable", "ap email"],
  address: ["address", "street", "street address", "address 1", "mailing address"],
  city: ["city", "location city", "location: city", "town"],
  state: ["state", "province", "location state", "location: state", "st"],
  zip: ["zip", "zipcode", "zip code", "postal code"],
  equipment: ["equipment", "equipment type", "trucks", "trailer", "trailer type"],
  notes: ["notes", "note", "comments", "description"],
  status: ["status", "carrier status", "type", "category"],
  w9Status: ["w9", "w9 status", "w-9", "w-9 status"],
  coiStatus: ["coi", "coi status", "insurance", "insurance status", "certificate of insurance"],
  noaStatus: ["noa", "noa status"],
  carrierPacketStatus: ["packet", "carrier packet", "carrier packet status", "setup packet"]
};

function mapCarrierImportHeaders(headers: string[]): Record<CarrierImportFieldKey, string> {
  return Object.fromEntries(
    Object.entries(carrierImportFieldAliases).map(([field, aliases]) => {
      const matchedHeader = findBestImportHeader(headers, aliases);

      return [field, matchedHeader];
    })
  ) as Record<CarrierImportFieldKey, string>;
}

function buildCarrierImportPreview(
  fileName: string,
  parsedImport: {
    headers: string[];
    normalizedHeaders: string[];
    fieldMapping: Record<CarrierImportFieldKey, string>;
    rows: CarrierImportRow[];
    unmappedColumns: string[];
  },
  existingCarriers: Carrier[]
): CarrierImportPreview {
  const existingKeys = new Set(existingCarriers.flatMap(getCarrierDuplicateKeys));
  const seenKeys = new Set<string>();

  return {
    fileName,
    detectedColumns: parsedImport.headers,
    normalizedColumns: parsedImport.normalizedHeaders,
    fieldMapping: parsedImport.fieldMapping,
    mappedColumns: buildCarrierImportMappedColumns(parsedImport.headers, parsedImport.fieldMapping),
    confidence: getCarrierImportConfidence(parsedImport.fieldMapping),
    unmappedColumns: parsedImport.unmappedColumns,
    rows: parsedImport.rows.map((row, index) => {
      const duplicateKey = getCarrierImportDuplicateKey(row);
      const duplicateReason = getCarrierImportDuplicateReason(row, existingKeys, seenKeys);
      let skippedReason = duplicateReason;

      if (!row.carrierName.trim()) {
        skippedReason = "Missing carrier name";
      }

      if (duplicateKey) {
        seenKeys.add(duplicateKey);
      }

      console.log("[Blue Bomber Carrier Import] row import result:", {
        rowNumber: index + 2,
        carrierName: row.carrierName,
        action: skippedReason ? "skip" : "ready",
        skippedReason
      });

      return {
        rowNumber: index + 2,
        row,
        action: skippedReason ? "skip" : "ready",
        skippedReason,
        duplicateReason
      };
    })
  };
}

function buildCarrierImportMappedColumns(headers: string[], fieldMapping: Record<CarrierImportFieldKey, string>) {
  return headers
    .map((header) => {
      const mappedFields = (Object.entries(fieldMapping) as Array<[CarrierImportFieldKey, string]>)
        .filter(([, mappedHeader]) => mappedHeader === header)
        .map(([field]) => formatCarrierImportField(field));

      return {
        detected: header,
        mappedTo: mappedFields.join(", ")
      };
    })
    .filter((mapping) => mapping.mappedTo);
}

function getCarrierImportConfidence(fieldMapping: Record<CarrierImportFieldKey, string>): CarrierImportPreview["confidence"] {
  const requiredFields: CarrierImportFieldKey[] = ["carrierName", "mcNumber", "dotNumber"];
  const mappedRequiredCount = requiredFields.filter((field) => fieldMapping[field]).length;
  const mappedOperationalCount = (["dispatchPhone", "dispatchEmail", "city", "state", "equipment"] as CarrierImportFieldKey[])
    .filter((field) => fieldMapping[field]).length;

  if (fieldMapping.carrierName && mappedRequiredCount >= 2 && mappedOperationalCount >= 2) {
    return "High Confidence";
  }

  if (fieldMapping.carrierName && mappedRequiredCount >= 1) {
    return "Medium Confidence";
  }

  return "Low Confidence";
}

function formatCarrierImportField(field: CarrierImportFieldKey) {
  const labels: Record<CarrierImportFieldKey, string> = {
    carrierName: "Carrier Name",
    mcNumber: "MC Number",
    dotNumber: "DOT Number",
    primaryContact: "Primary Contact",
    dispatchPhone: "Dispatch Phone",
    dispatchEmail: "Dispatch Email",
    mainPhone: "Main Phone",
    email: "Email",
    safetyEmail: "Safety Email",
    accountingEmail: "Accounting Email",
    address: "Address",
    city: "City",
    state: "State",
    zip: "Zip",
    equipment: "Equipment",
    notes: "Notes",
    status: "Status",
    w9Status: "W9 Status",
    coiStatus: "COI Status",
    noaStatus: "NOA Status",
    carrierPacketStatus: "Carrier Packet Status"
  };

  return labels[field];
}

function getCarrierImportDuplicateReason(row: CarrierImportRow, existingKeys: Set<string>, seenKeys: Set<string>) {
  const duplicateKey = getCarrierImportDuplicateKey(row);

  if (!duplicateKey) {
    return "";
  }

  if (existingKeys.has(duplicateKey)) {
    return duplicateKey.startsWith("mc:")
      ? "Duplicate MC Number already exists"
      : duplicateKey.startsWith("dot:")
        ? "Duplicate DOT Number already exists"
        : "Duplicate carrier name already exists";
  }

  if (seenKeys.has(duplicateKey)) {
    return duplicateKey.startsWith("mc:")
      ? "Duplicate MC Number in import file"
      : duplicateKey.startsWith("dot:")
        ? "Duplicate DOT Number in import file"
        : "Duplicate carrier name in import file";
  }

  return "";
}

function getCarrierImportDuplicateKey(row: CarrierImportRow) {
  if (row.mcNumber) {
    return "mc:" + row.mcNumber;
  }

  if (row.dotNumber) {
    return "dot:" + row.dotNumber;
  }

  const normalizedName = normalizeCompanyName(row.carrierName);

  return normalizedName ? "name:" + normalizedName : "";
}

function getCarrierDuplicateKeys(carrier: Carrier) {
  const keys: string[] = [];
  const mcNumber = extractCarrierNumber(carrier.equipment, "mc");
  const dotNumber = extractCarrierNumber(carrier.equipment, "dot");
  const normalizedName = normalizeCompanyName(carrier.name);

  if (mcNumber) {
    keys.push("mc:" + mcNumber);
  }

  if (dotNumber) {
    keys.push("dot:" + dotNumber);
  }

  if (normalizedName) {
    keys.push("name:" + normalizedName);
  }

  return keys;
}

function extractCarrierNumber(value: string, type: "mc" | "dot") {
  const pattern = type === "mc" ? /MCs*:?s*(d+)/i : /DOTs*:?s*(d+)/i;

  return value.match(pattern)?.[1] ?? "";
}

function buildImportedCarrierEquipment(row: CarrierImportRow) {
  return [
    row.equipment || "Equipment TBD",
    row.mcNumber ? "MC " + row.mcNumber : "",
    row.dotNumber ? "DOT " + row.dotNumber : ""
  ]
    .filter(Boolean)
    .join(" · ");
}

function buildCarrierComplianceSummary(row: CarrierImportRow) {
  return [
    row.w9Status ? "W9: " + row.w9Status : "",
    row.coiStatus ? "COI: " + row.coiStatus : "",
    row.noaStatus ? "NOA: " + row.noaStatus : "",
    row.carrierPacketStatus ? "Packet: " + row.carrierPacketStatus : ""
  ]
    .filter(Boolean)
    .join(" · ");
}

function buildCarrierImportTimelineBody(row: CarrierImportRow) {
  const lines = [
    row.mcNumber ? "MC Number: " + row.mcNumber : "",
    row.dotNumber ? "DOT Number: " + row.dotNumber : "",
    row.primaryContact ? "Primary Contact: " + row.primaryContact : "",
    row.dispatchPhone ? "Dispatch Phone: " + row.dispatchPhone : "",
    row.dispatchEmail ? "Dispatch Email: " + row.dispatchEmail : "",
    row.mainPhone ? "Main Phone: " + row.mainPhone : "",
    row.email ? "Email: " + row.email : "",
    row.safetyEmail ? "Safety Email: " + row.safetyEmail : "",
    row.accountingEmail ? "Accounting Email: " + row.accountingEmail : "",
    row.address ? "Address: " + row.address : "",
    row.city || row.state || row.zip ? "Location: " + [row.city, row.state, row.zip].filter(Boolean).join(", ") : "",
    row.status ? "Status: " + row.status : "",
    buildCarrierComplianceSummary(row),
    row.notes ? "Notes: " + row.notes : ""
  ].filter(Boolean);

  return lines.length ? lines.join("\n") : "Carrier Imported";
}

function normalizeCarrierNumber(value: string) {
  return cleanBlankImportValue(value).replace(/[^0-9]/g, "");
}

function normalizeImportEmail(value: string) {
  return extractImportEmails(value)[0]?.toLowerCase() ?? cleanBlankImportValue(value).toLowerCase();
}

function normalizeImportPhone(value: string) {
  const phone = extractImportPhones(value)[0] ?? cleanBlankImportField(value);

  return phone.replace(/\s+/g, " ").trim();
}

function cleanBlankImportField(value: string) {
  return cleanBlankImportValue(value);
}

function cleanBlankImportValue(value: string) {
  const trimmed = String(value ?? "").trim();

  return /^(?:n\/?a|na|none|null|undefined|-)$/i.test(trimmed) ? "" : trimmed;
}

function normalizeStateAbbreviation(value: string) {
  const cleanValue = cleanBlankImportValue(value);
  const upperValue = cleanValue.toUpperCase();

  if (/^[A-Z]{2}$/.test(upperValue)) {
    return upperValue;
  }

  const stateMap: Record<string, string> = {
    alabama: "AL",
    alaska: "AK",
    arizona: "AZ",
    arkansas: "AR",
    california: "CA",
    colorado: "CO",
    connecticut: "CT",
    delaware: "DE",
    florida: "FL",
    georgia: "GA",
    illinois: "IL",
    indiana: "IN",
    kentucky: "KY",
    michigan: "MI",
    newyork: "NY",
    ohio: "OH",
    pennsylvania: "PA",
    tennessee: "TN",
    texas: "TX",
    wisconsin: "WI"
  };

  return stateMap[compactImportHeader(cleanValue)] ?? cleanValue;
}

function parseCsv(value: string) {
  const rows: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let isQuoted = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const nextCharacter = value[index + 1];

    if (character === '"' && isQuoted && nextCharacter === '"') {
      currentField += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      isQuoted = !isQuoted;
      continue;
    }

    if (character === "," && !isQuoted) {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !isQuoted) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
      continue;
    }

    currentField += character;
  }

  currentRow.push(currentField);
  rows.push(currentRow);

  const [headers = [], ...dataRows] = rows.filter((row) => row.some((field) => field.trim()));

  return dataRows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), row[index]?.trim() ?? ""]))
  );
}

function parseImportStatus(value: string): CompanyStatus {
  return value.toLowerCase() === "customer" ? "customer" : "prospect";
}

function normalizeCompanyName(value: string) {
  return value.trim().toLowerCase();
}

function contactNamesOverlap(leftName: string, rightName: string) {
  const left = normalizeCompanyName(leftName);
  const right = normalizeCompanyName(rightName);
  const leftFirst = left.split(/\s+/)[0] ?? "";
  const rightFirst = right.split(/\s+/)[0] ?? "";

  return Boolean(left && right && (left === right || leftFirst === right || rightFirst === left));
}

function taskIdentity(task: Task) {
  return [
    normalizeCompanyName(task.title),
    normalizeCompanyName(task.owner),
    task.companyId,
    normalizeCompanyName(task.sourceNote)
  ].join("|");
}

function resolveAmbiguousContactChoices(note: string, accountContacts: Contact[]) {
  const choices = new Map<string, string>();
  const contactsByFirstName = accountContacts.reduce<Map<string, Contact[]>>((groups, contact) => {
    const firstName = normalizeCompanyName(contact.name.split(/\s+/)[0] ?? "");

    if (!firstName) {
      return groups;
    }

    groups.set(firstName, [...(groups.get(firstName) ?? []), contact]);
    return groups;
  }, new Map());

  contactsByFirstName.forEach((matchingContacts, firstName) => {
    if (matchingContacts.length < 2 || !new RegExp(`\\b${escapeRegExp(firstName)}\\b`, "i").test(note)) {
      return;
    }

    const options = matchingContacts
      .map((contact, index) => `${index + 1}. ${contact.name}${contact.role ? ` - ${contact.role}` : ""}`)
      .join("\n");
    const answer = window.prompt(`Multiple contacts named ${toTitleCase(firstName)} found. Choose one:\n${options}`);
    const selectedIndex = Number(answer) - 1;
    const selectedContact = Number.isInteger(selectedIndex) ? matchingContacts[selectedIndex] : null;

    if (selectedContact) {
      choices.set(firstName, selectedContact.name);
    }
  });

  return choices;
}

function applyContactChoiceToActionTitle(title: string, choices: Map<string, string>) {
  return Array.from(choices.entries()).reduce(
    (currentTitle, [firstName, fullName]) =>
      currentTitle.replace(new RegExp(`\\b${escapeRegExp(firstName)}\\b`, "i"), fullName),
    title
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function CarrierPreview({ carriers: carrierItems }: { carriers: Carrier[] }) {
  const previewCarrier = carrierItems[0];

  if (!previewCarrier) {
    return (
      <div className="company-picker">
        <label htmlFor="carrier-search">Search Companies</label>
        <input id="carrier-search" list="carrier-options" placeholder="Search Carriers" />
        <div className="company-preview empty-preview">No company selected.</div>
      </div>
    );
  }

  return (
    <div className="company-picker">
      <label htmlFor="carrier-search">Search Companies</label>
      <input id="carrier-search" list="carrier-options" placeholder="Search Carriers" />
      <datalist id="carrier-options">
        {carrierItems.map((carrier) => (
          <option key={carrier.id} value={carrier.name} />
        ))}
      </datalist>

      <div className="company-preview">
        <span>Carrier</span>
        <strong>{previewCarrier.name}</strong>
        <small>
          {previewCarrier.city}, {previewCarrier.state} · {previewCarrier.equipment}
        </small>
      </div>
    </div>
  );
}

function TaskDetail({ entityLabel, task }: { entityLabel: string; task: Task }) {
  return (
    <section className="task-detail" aria-label="Action Detail">
      <h2>Action Detail</h2>
      <dl>
        <div>
          <dt>Action Name</dt>
          <dd>{task.title}</dd>
        </div>
        <div>
          <dt>Assigned To</dt>
          <dd>{task.owner}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{taskStatusLabel(getTaskDisplayStatus(task))}</dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd>{task.due || "Not set"}</dd>
        </div>
        <div>
          <dt>{entityLabel}</dt>
          <dd>{task.sourceCompany}</dd>
        </div>
        <div>
          <dt>Created Date</dt>
          <dd>{formatDate(task.createdAt)}</dd>
        </div>
        <div className="source-note-row">
          <dt>Source Note</dt>
          <dd>{task.sourceNote}</dd>
        </div>
      </dl>
    </section>
  );
}

function TaskCardDetail({ entityLabel, task }: { entityLabel: string; task: Task }) {
  return (
    <dl className="task-card-detail" aria-label="Action Detail">
      <div>
        <dt>Assigned To</dt>
        <dd>{task.owner}</dd>
      </div>
      <div>
        <dt>{entityLabel}</dt>
        <dd>{task.sourceCompany}</dd>
      </div>
      <div>
        <dt>Created</dt>
        <dd>{formatDate(task.createdAt)}</dd>
      </div>
      <div className="source-note-row">
        <dt>Source Note</dt>
        <dd>{task.sourceNote}</dd>
      </div>
    </dl>
  );
}

function TaskDashboard({
  entityNameById,
  onCompleteTask,
  onEditTask,
  onOpenEntity,
  onOpenTaskDetail,
  onReassignTask,
  onSetTaskDue,
  selectedTaskId,
  taskFilter,
  taskItems
}: {
  entityNameById: Record<string, string>;
  onCompleteTask: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onOpenEntity: (task: Task) => void;
  onOpenTaskDetail: (task: Task) => void;
  onReassignTask: (task: Task) => void;
  onSetTaskDue: (task: Task, due: string) => void;
  selectedTaskId: string | null;
  taskFilter: TaskFilter;
  taskItems: Task[];
}) {
  if (!taskItems.length) {
    return (
      <div className="empty-state action-empty-state">
        <strong>No actions due in this view.</strong>
        <span>Use Call Notes or Operations Center when new work comes in.</span>
      </div>
    );
  }

  const todaySections = [
    { title: "Overdue Actions", tasks: taskItems.filter((task) => isTaskOverdue(task)) },
    { title: "Today's Actions", tasks: taskItems.filter((task) => isTaskDueToday(task) && !isTaskOverdue(task)) }
  ];
  const sections =
    taskFilter === "today"
      ? todaySections
      : [{ title: `${taskFilters.find((filter) => filter.id === taskFilter)?.label ?? "Actions"} Actions`, tasks: taskItems }];

  return (
    <div className="task-dashboard-groups">
      {sections
        .filter((section) => section.tasks.length)
        .map((section) => (
          <TaskDashboardSection
            entityNameById={entityNameById}
            key={section.title}
            onCompleteTask={onCompleteTask}
            onEditTask={onEditTask}
            onOpenEntity={onOpenEntity}
            onOpenTaskDetail={onOpenTaskDetail}
            onReassignTask={onReassignTask}
            onSetTaskDue={onSetTaskDue}
            selectedTaskId={selectedTaskId}
            tasks={section.tasks}
            title={section.title}
          />
        ))}
    </div>
  );
}

function TaskDashboardSection({
  entityNameById,
  onCompleteTask,
  onEditTask,
  onOpenEntity,
  onOpenTaskDetail,
  onReassignTask,
  onSetTaskDue,
  selectedTaskId,
  tasks,
  title
}: {
  entityNameById: Record<string, string>;
  onCompleteTask: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onOpenEntity: (task: Task) => void;
  onOpenTaskDetail: (task: Task) => void;
  onReassignTask: (task: Task) => void;
  onSetTaskDue: (task: Task, due: string) => void;
  selectedTaskId: string | null;
  tasks: Task[];
  title: string;
}) {
  const owners = groupTasksByOwner(tasks);

  return (
    <section className="task-dashboard-section" aria-label={title}>
      <h3>{title}</h3>
      {owners.map(([owner, ownerTasks]) => (
        <div className="owner-task-group" key={`${title}-${owner}`}>
          <h4>{owner}</h4>
          <ul className="task-list">
            {ownerTasks.map((task) => {
              const isOpen = selectedTaskId === task.id;
              const entityName = entityNameById[getTaskEntityId(task)] ?? task.sourceCompany;

              return (
                <li key={task.id}>
                  <article
                    className={[
                      "task-card",
                      getOwnerClassName(task.owner),
                      isOpen ? "selected" : ""
                    ].filter(Boolean).join(" ")}
                    onDoubleClick={() => onOpenTaskDetail(task)}
                    title="Double-click to expand"
                  >
                    <span className={task.priority === "high" ? "task-dot high" : "task-dot"} />
                    <div className="task-card-main">
                      <div className="action-card-summary">
                        <strong>{getActionIcon(task)} {task.title}</strong>
                        <button
                          className="task-entity-link"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenEntity(task);
                          }}
                        >
                          {entityName}
                        </button>
                        <span>{task.owner}</span>
                        <span className="task-due-time">{formatTaskDue(task.due)}</span>
                      </div>
                    </div>
                    <div className="task-card-actions">
                      <button type="button" onClick={() => onCompleteTask(task)}>
                        Complete
                      </button>
                      <button type="button" onClick={() => onSetTaskDue(task, "Tomorrow")}>
                        Tomorrow
                      </button>
                      <button type="button" onClick={() => onSetTaskDue(task, "Friday")}>
                        Friday
                      </button>
                      <button type="button" onClick={() => onSetTaskDue(task, "Next Week")}>
                        Next Week
                      </button>
                    </div>
                    {isOpen ? (
                      <div className="task-card-expanded">
                        <TaskCardDetail entityLabel="Account" task={task} />
                        <div className="task-card-secondary-actions">
                          <button type="button" onClick={() => onReassignTask(task)}>
                            Reassign
                          </button>
                          <button type="button" onClick={() => onEditTask(task)}>
                            Edit
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

function getPageTitle(view: AppView, company: Company | null, carrier: Carrier | null) {
  if (view === "prospect-profile" || view === "customer-profile") {
    return company?.name ?? "Company Profile";
  }

  if (view === "carrier-profile") {
    return carrier?.name ?? "Carrier Profile";
  }

  if (view === "prospects") {
    return "Prospects";
  }

  if (view === "customers") {
    return "Customers";
  }

  if (view === "carriers") {
    return "Carriers";
  }

  return "Today's Actions";
}

function getTaskEntityId(task: Task) {
  return task.entityId ?? task.companyId;
}

function getTaskEntityType(task: Task, companies: Company[], carriers: Carrier[]) {
  if (task.entityType) {
    return task.entityType;
  }

  if (carriers.some((carrier) => carrier.id === task.companyId)) {
    return "carrier";
  }

  const company = companies.find((companyItem) => companyItem.id === task.companyId);

  return company?.status ?? "prospect";
}

function getTaskEntityLabel(task: Task, companies: Company[], carriers: Carrier[]) {
  return getTaskEntityType(task, companies, carriers) === "carrier" ? "Carrier" : "Company";
}

function getActionIcon(task: Task) {
  const title = task.title.toLowerCase();

  if (title.includes("email") || title.includes("quote") || title.includes("rates")) {
    return "✉";
  }

  if (title.includes("coi") || title.includes("w9") || title.includes("noa") || title.includes("insurance")) {
    return "✓";
  }

  return "☎";
}

function getOwnerClassName(owner: string) {
  const normalizedOwner = owner.trim().toLowerCase();

  if (normalizedOwner === "brian") {
    return "owner-brian";
  }

  if (normalizedOwner === "louie") {
    return "owner-louie";
  }

  return "";
}

function getTimelineIcon(entry: ProfileTimelineRow) {
  const text = `${entry.title} ${entry.detail}`.toLowerCase();

  if (entry.type === "task" || text.includes("action")) {
    return "✓";
  }

  if (text.includes("email") || text.includes("outlook") || text.includes("gmail")) {
    return "✉";
  }

  if (text.includes("file") || text.includes("bol") || text.includes("pod") || text.includes("coi") || text.includes("w9")) {
    return "▣";
  }

  if (isSystemTimelineEvent(entry)) {
    return "•";
  }

  return "✎";
}

function getTimelineItemClassName(entry: ProfileTimelineRow) {
  const text = `${entry.title} ${entry.detail}`.toLowerCase();
  const classes = ["timeline-item"];

  if (entry.type === "task" || text.includes("action")) {
    classes.push("task-event", "timeline-action");
  } else if (text.includes("email") || text.includes("outlook") || text.includes("gmail")) {
    classes.push("timeline-email");
  } else if (text.includes("file") || text.includes("bol") || text.includes("pod") || text.includes("coi") || text.includes("w9")) {
    classes.push("timeline-file");
  } else if (isSystemTimelineEvent(entry)) {
    classes.push("timeline-system");
  } else {
    classes.push("timeline-note");
  }

  return classes.join(" ");
}

function isSystemTimelineEvent(entry: ProfileTimelineRow) {
  const systemTitles = new Set([
    "Action Created",
    "Action Updated",
    "Action Completed",
    "Action Snoozed",
    "Action Reassigned",
    "Action Edited",
    "Task Created",
    "Task Updated",
    "Task Completed",
    "Task Snoozed",
    "Task Reassigned",
    "Task Edited",
    "Status Changed"
  ]);

  return entry.type === "task" || systemTitles.has(entry.title);
}

function formatTimelineTitle(title: string) {
  return title.replace(/^Task\b/, "Action");
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function getFileExtension(fileName: string) {
  const extension = fileName.split(".").pop();

  return extension && extension !== fileName ? extension.toUpperCase() : "File";
}

function formatFileDate(uploadedAt: string) {
  if (!uploadedAt) {
    return "date not set";
  }

  const date = new Date(uploadedAt);

  if (Number.isNaN(date.getTime())) {
    return "date not set";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function dateInputToIso(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value + "T12:00:00");

  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function formatShortDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Today";
  }

  return date.toLocaleDateString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric"
  });
}

function entityNameById(companies: Company[], carriers: Carrier[]) {
  return {
    ...Object.fromEntries(companies.map((company) => [company.id, company.name])),
    ...Object.fromEntries(carriers.map((carrier) => [carrier.id, carrier.name]))
  };
}

function entitySearchTextById(
  companies: Company[],
  carriers: Carrier[],
  contacts: Contact[],
  timeline: TimelineEntry[]
) {
  return {
    ...Object.fromEntries(
      companies.map((company) => {
        const companyContacts = contacts.filter((contact) => contact.companyId === company.id);
        const companyTimeline = timeline.filter((entry) => entry.companyId === company.id);

        return [
          company.id,
          [
            company.name,
            company.city,
            company.state,
            company.currentOpportunity,
            company.smartNotes,
            ...companyContacts.flatMap((contact) => [contact.name, contact.role, contact.phone, contact.email]),
            ...companyTimeline.flatMap((entry) => [entry.at, entry.body])
          ].join(" ")
        ];
      })
    ),
    ...Object.fromEntries(
      carriers.map((carrier) => [
        carrier.id,
        [carrier.name, carrier.city, carrier.state, carrier.equipment].join(" ")
      ])
    )
  };
}

function isVisibleTaskEntity(
  task: Task,
  visibleCompanyIds: Set<string>,
  carrierIds: Set<string>
) {
  const entityId = getTaskEntityId(task);

  return visibleCompanyIds.has(entityId) || carrierIds.has(entityId);
}

function isActiveTask(task: Task) {
  return task.status !== "completed" && task.status !== "cancelled";
}

function getTaskDisplayStatus(task: Task): Task["status"] {
  if (isActiveTask(task) && isTaskOverdue(task)) {
    return "overdue";
  }

  return task.status;
}

function parseTaskStatus(value: string | undefined): Task["status"] | null {
  if (
    value === "open" ||
    value === "in_progress" ||
    value === "waiting" ||
    value === "completed" ||
    value === "cancelled" ||
    value === "overdue"
  ) {
    return value;
  }

  return null;
}

function shouldMarkTaskOverdue(task: Task) {
  return task.status !== "overdue" && isActiveTask(task) && isTaskOverdue(task);
}

function isTaskDueToday(task: Task) {
  const due = task.due.trim().toLowerCase();

  if (due === "today") {
    return true;
  }

  const dueDate = parseDueDate(task.due, task.createdAt);

  if (!dueDate) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  return dueDate.getTime() === today.getTime();
}

function isTaskDueTomorrow(task: Task) {
  const due = task.due.trim().toLowerCase();

  if (due === "tomorrow") {
    return true;
  }

  const dueDate = parseDueDate(task.due, task.createdAt);

  if (!dueDate) {
    return false;
  }

  const tomorrow = addDays(startOfDay(new Date()), 1);
  dueDate.setHours(0, 0, 0, 0);

  return dueDate.getTime() === tomorrow.getTime();
}

function isTaskDueAfterTomorrow(task: Task) {
  const dueDate = parseDueDate(task.due, task.createdAt);

  if (!dueDate) {
    return true;
  }

  const tomorrow = addDays(startOfDay(new Date()), 1);
  dueDate.setHours(0, 0, 0, 0);

  return dueDate > tomorrow;
}

function isTaskOverdue(task: Task) {
  const due = task.due.trim().toLowerCase();

  if (due === "yesterday") {
    return true;
  }

  const dueDate = parseDueDate(task.due, task.createdAt);

  if (!dueDate) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  return dueDate < today;
}

function wasTaskCompletedToday(task: Task) {
  if (!task.completedAt) {
    return false;
  }

  const completedDate = new Date(task.completedAt);
  const today = new Date();

  return completedDate.toDateString() === today.toDateString();
}

function formatDateTime(value: Date) {
  return value.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatTaskDue(due: string) {
  return due.trim() || "Not set";
}

function parseDueDate(value: string, createdAt?: string) {
  const normalizedValue = value.trim().toLowerCase();
  const baseDate = createdAt ? new Date(createdAt) : new Date();
  const timeMatch = normalizedValue.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);

  if (normalizedValue.startsWith("today")) {
    return applyDueTime(startOfDay(new Date()), timeMatch);
  }

  if (normalizedValue.startsWith("tomorrow")) {
    return applyDueTime(addDays(startOfDay(baseDate), 1), timeMatch);
  }

  if (normalizedValue === "next week") {
    return addDays(startOfDay(baseDate), 7);
  }

  if (normalizedValue.startsWith("next monday") || normalizedValue.startsWith("monday")) {
    return applyDueTime(nextWeekday(baseDate, 1), timeMatch);
  }

  if (normalizedValue.startsWith("tuesday")) {
    return applyDueTime(nextWeekday(baseDate, 2), timeMatch);
  }

  if (normalizedValue.startsWith("wednesday")) {
    return applyDueTime(nextWeekday(baseDate, 3), timeMatch);
  }

  if (normalizedValue.startsWith("thursday")) {
    return applyDueTime(nextWeekday(baseDate, 4), timeMatch);
  }

  if (normalizedValue.startsWith("friday")) {
    return applyDueTime(nextWeekday(baseDate, 5), timeMatch);
  }

  if (normalizedValue.startsWith("saturday")) {
    return applyDueTime(nextWeekday(baseDate, 6), timeMatch);
  }

  if (normalizedValue.startsWith("sunday")) {
    return applyDueTime(nextWeekday(baseDate, 0), timeMatch);
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp);
}

function applyDueTime(value: Date, match: RegExpMatchArray | null) {
  if (!match) {
    return value;
  }

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  const meridiem = (match[3] ?? "").toLowerCase();

  if (meridiem === "pm" && hour < 12) {
    hour += 12;
  }

  if (meridiem === "am" && hour === 12) {
    hour = 0;
  }

  value.setHours(hour, minute, 0, 0);
  return value;
}

function startOfDay(value: Date) {
  const nextDate = new Date(value);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function addDays(value: Date, days: number) {
  const nextDate = new Date(value);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function nextWeekday(value: Date, weekday: number) {
  const nextDate = startOfDay(value);
  const currentDay = nextDate.getDay();
  const dayOffset = (weekday - currentDay + 7) % 7 || 7;
  nextDate.setDate(nextDate.getDate() + dayOffset);
  return nextDate;
}

function compareTasksByDueThenCreated(firstTask: Task, secondTask: Task) {
  const firstOverdue = isTaskOverdue(firstTask);
  const secondOverdue = isTaskOverdue(secondTask);

  if (firstOverdue !== secondOverdue) {
    return firstOverdue ? -1 : 1;
  }

  const firstDue = parseDueDate(firstTask.due, firstTask.createdAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const secondDue = parseDueDate(secondTask.due, secondTask.createdAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;

  if (firstDue !== secondDue) {
    return firstDue - secondDue;
  }

  return firstTask.createdAt.localeCompare(secondTask.createdAt);
}

function doesTaskMatchSearch(task: Task, namesById: Record<string, string>, search: string) {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  const entityName = namesById[getTaskEntityId(task)] ?? task.sourceCompany;

  return [task.title, entityName, task.owner, task.sourceNote, task.sourceCompany]
    .some((value) => value.toLowerCase().includes(normalizedSearch));
}

function doesCompanyMatchGlobalSearch(
  company: Company,
  contacts: Contact[],
  tasks: Task[],
  timeline: TimelineEntry[],
  search: string
) {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  const companyContacts = contacts.filter((contact) => contact.companyId === company.id);
  const companyTasks = tasks.filter((task) => task.companyId === company.id || getTaskEntityId(task) === company.id);
  const companyTimeline = timeline.filter((entry) => entry.companyId === company.id);
  const values = [
    company.name,
    company.city,
    company.state,
    company.segment,
    company.currentOpportunity,
    company.smartNotes,
    company.lastContact,
    ...companyContacts.flatMap((contact) => [contact.name, contact.role, contact.phone, contact.email]),
    ...companyTasks.flatMap((task) => [task.title, task.owner, task.sourceNote]),
    ...companyTimeline.flatMap((entry) => [entry.at, entry.body])
  ];

  return values.some((value) => value.toLowerCase().includes(normalizedSearch));
}

function doesCarrierMatchGlobalSearch(carrier: Carrier, tasks: Task[], search: string) {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  const carrierTasks = tasks.filter((task) => getTaskEntityId(task) === carrier.id);
  const values = [
    carrier.name,
    carrier.city,
    carrier.state,
    carrier.equipment,
    ...carrierTasks.flatMap((task) => [task.title, task.owner, task.sourceNote])
  ];

  return values.some((value) => value.toLowerCase().includes(normalizedSearch));
}

function groupTasksByOwner(tasks: Task[]) {
  const ownerOrder = ["Brian", "Louie"];
  const groupedTasks = tasks.reduce<Record<string, Task[]>>((groups, task) => {
    return {
      ...groups,
      [task.owner]: [...(groups[task.owner] ?? []), task]
    };
  }, {});

  return Object.entries(groupedTasks).sort(([firstOwner], [secondOwner]) => {
    const firstIndex = ownerOrder.indexOf(firstOwner);
    const secondIndex = ownerOrder.indexOf(secondOwner);

    if (firstIndex !== -1 || secondIndex !== -1) {
      return (firstIndex === -1 ? Number.MAX_SAFE_INTEGER : firstIndex) -
        (secondIndex === -1 ? Number.MAX_SAFE_INTEGER : secondIndex);
    }

    return firstOwner.localeCompare(secondOwner);
  });
}

function createTaskTimelineEvent(task: Task, title: string, detail: string): TimelineEntry | null {
  if (task.entityType === "carrier") {
    return null;
  }

  const now = new Date().toISOString();

  return {
    id: createUuid(),
    companyId: task.companyId,
    at: title,
    body: detail,
    createdAt: now
  };
}

function companyNameById(companyItems: Company[]) {
  return Object.fromEntries(companyItems.map((company) => [company.id, company.name]));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}
