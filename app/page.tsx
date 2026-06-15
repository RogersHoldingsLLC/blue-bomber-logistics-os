"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  carriers as seedCarriers,
  companies as seedCompanies,
  contacts as seedContacts,
  qualifyingQuestions,
  tasks as seedTasks,
  timeline as seedTimeline
} from "@/lib/data";
import { applyCarrierIntent, applyIntent } from "@/lib/intent-engine";
import { loadStoredState, saveStoredState } from "@/lib/storage";
import {
  canUseSupabase,
  deleteSupabaseCompanies,
  deleteSupabaseCompany,
  importSupabaseProspects,
  loadSupabaseState,
  saveSupabaseState
} from "@/lib/supabase-storage";
import { createUuid } from "@/lib/uuid";
import type { Carrier, Company, CompanyStatus, Contact, Task, TimelineEntry } from "@/types";

type ProfileTab = "tasks" | "contacts" | "freight" | "files";
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
type ProfileTimelineRow = {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
  type: "timeline" | "task";
};
type ThemeMode = "light" | "dark";
type AppView =
  | "home"
  | "prospects"
  | "customers"
  | "carriers"
  | "prospect-profile"
  | "customer-profile"
  | "carrier-profile";
type TaskFilter = "today" | "overdue" | "upcoming" | "all" | "completed";
type AccountTab = "all" | "prospects" | "customers" | "carriers";
type ProspectImportRow = {
  companyName: string;
  status: CompanyStatus;
  salesLead: string;
  operationsLead: string;
  phone: string;
  email: string;
  website: string;
  notes: string;
};

const THEME_STORAGE_KEY = "blue-bomber-theme";

const taskFilters: Array<{ id: TaskFilter; label: string }> = [
  { id: "today", label: "Today" },
  { id: "overdue", label: "Overdue" },
  { id: "upcoming", label: "Upcoming" },
  { id: "all", label: "All" },
  { id: "completed", label: "Completed" }
];

const profileTabs: Array<{ id: ProfileTab; label: string }> = [
  { id: "tasks", label: "Tasks" },
  { id: "contacts", label: "Contacts" },
  { id: "freight", label: "Freight Op" },
  { id: "files", label: "Files" }
];

function statusLabel(status: CompanyStatus) {
  return status === "prospect" ? "Prospect" : "Customer";
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
  const websiteLine = company.smartNotes
    .split("\n")
    .find((line) => line.trim().toLowerCase().startsWith("website:"));

  return websiteLine?.replace(/^website:\s*/i, "").trim() || "";
}

function getCompanyTimelineRows(company: Company, timeline: TimelineEntry[]): ProfileTimelineRow[] {
  return timeline
    .filter((entry) => entry.companyId === company.id)
    .map((entry) => ({
      id: entry.id,
      title: entry.at,
      detail: entry.body,
      createdAt: entry.createdAt,
      type: "timeline" as const
    }))
    .sort((firstEntry, secondEntry) => secondEntry.createdAt.localeCompare(firstEntry.createdAt));
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
  const taskSentence = openTasks.length
    ? `${openTasks.length} open task${openTasks.length === 1 ? "" : "s"} need attention, led by ${openTasks[0].owner} on ${openTasks[0].title}.`
    : "There are no open tasks on this account right now.";

  return [
    `${company.name} is a ${statusLabel(company.status).toLowerCase()} account${location === "Not set" ? "" : ` in ${location}`}${company.segment ? ` for ${company.segment.toLowerCase()} work` : ""}.`,
    primaryContact
      ? `${primaryContact.name}${primaryContact.role ? ` handles ${primaryContact.role.toLowerCase()}` : " is the primary contact"}${primaryContact.phone ? ` and can be reached at ${primaryContact.phone}` : ""}.`
      : "No primary contact is set yet.",
    latestNote ? `Most recent note: ${latestNote}` : `${contacts.length} contact${contacts.length === 1 ? "" : "s"} saved on the account.`,
    `${taskSentence} Freight opportunity: ${company.currentOpportunity || "Not set yet."}`
  ].slice(0, 4);
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
  const [companies, setCompanies] = useState(seedCompanies);
  const [contacts, setContacts] = useState(seedContacts);
  const [tasks, setTasks] = useState(seedTasks);
  const [timeline, setTimeline] = useState(seedTimeline);
  const [carrierItems, setCarrierItems] = useState(seedCarriers);
  const [hasHydratedStorage, setHasHydratedStorage] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedCarrierId, setSelectedCarrierId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<AppView>("home");
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("today");
  const [taskSearch, setTaskSearch] = useState("");
  const [showTaskAdvanced, setShowTaskAdvanced] = useState(false);
  const [showProspectForm, setShowProspectForm] = useState(false);
  const [quickCreateType, setQuickCreateType] = useState<QuickCreateType>("prospect");
  const [prospectName, setProspectName] = useState("");
  const [carrierNote, setCarrierNote] = useState("");
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [hasHydratedTheme, setHasHydratedTheme] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedBulkProspectIds, setSelectedBulkProspectIds] = useState<string[]>([]);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [noteResult, setNoteResult] = useState<{ tasks: Array<{ title: string; owner: string }> } | null>(
    null
  );

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

  useEffect(() => {
    let isMounted = true;

    async function hydrateState() {
      try {
        const supabaseAvailable = canUseSupabase();
        console.log("[Blue Bomber Supabase] client available:", supabaseAvailable);

        if (!supabaseAvailable) {
          const storedState = loadStoredState();

          if (storedState && isMounted) {
            setCompanies(storedState.companies);
            setContacts(storedState.contacts);
            setTasks(storedState.tasks);
            setTimeline(storedState.timeline);
            setCarrierItems(storedState.carriers.length ? storedState.carriers : seedCarriers);
          }

          return;
        }

        const supabaseState = await loadSupabaseState();

        if (supabaseState && isMounted) {
          const storedState = loadStoredState();
          const storedCarrierTasks = storedState?.tasks.filter((task) => task.entityType === "carrier") ?? [];
          const supabaseTaskIds = new Set(supabaseState.tasks.map((task) => task.id));

          setCompanies(supabaseState.companies);
          setContacts(supabaseState.contacts);
          setTasks([
            ...supabaseState.tasks,
            ...storedCarrierTasks.filter((task) => !supabaseTaskIds.has(task.id))
          ]);
          setTimeline(supabaseState.timeline);
          setCarrierItems(supabaseState.carriers);
        }
      } catch {
        const storedState = loadStoredState();

        if (storedState && isMounted) {
          setCompanies(storedState.companies);
          setContacts(storedState.contacts);
          setTasks(storedState.tasks);
          setTimeline(storedState.timeline);
          setCarrierItems(storedState.carriers.length ? storedState.carriers : seedCarriers);
        }
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
  }, []);

  useEffect(() => {
    if (!hasHydratedStorage) {
      return;
    }

    persistState({
      companies,
      contacts,
      tasks,
      timeline,
      carriers: carrierItems
    });
  }, [carrierItems, companies, contacts, hasHydratedStorage, tasks, timeline]);

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
            return true;
          }

          if (taskFilter === "overdue") {
            return isTaskOverdue(task);
          }

          if (taskFilter === "upcoming") {
            return !isTaskDueToday(task) && !isTaskOverdue(task);
          }

          return true;
        })
        .filter((task) => doesTaskMatchSearch(task, taskEntityNameById, taskSearch))
        .sort(compareTasksByDueThenCreated),
    [carrierIds, taskEntityNameById, taskFilter, taskSearch, tasks, visibleCompanyIds]
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
  const prospectCompanies = visibleCompanies.filter((company) => company.status === "prospect");
  const customerCompanies = visibleCompanies.filter((company) => company.status === "customer");
  const pageTitle = getPageTitle(currentView, selectedCompany, selectedCarrier);

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
    updateTaskLifecycle(
      task,
      {
        status: "completed",
        completedAt: new Date().toISOString()
      },
      "Task Completed",
      `${task.title} completed by ${task.owner}.`
    );
  }

  function snoozeTask(task: Task) {
    updateTaskLifecycle(
      task,
      {
        due: "Tomorrow",
        status: "waiting"
      },
      "Task Snoozed",
      `${task.title} snoozed until Tomorrow.`
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
      "Task Reassigned",
      `${task.title} reassigned from ${task.owner} to ${nextOwner}.`
    );
  }

  function editTask(task: Task) {
    const nextTitle = window.prompt("Task name", task.title)?.trim();

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
      "Task Edited",
      `${task.title} edited.`
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

  async function persistStateToStorage(state: {
    companies: typeof companies;
    contacts: typeof contacts;
    tasks: typeof tasks;
    timeline: typeof timeline;
    carriers: typeof carrierItems;
  }, reason: string) {
    console.log("[Blue Bomber Supabase] persist requested:", reason);
    console.log("[Blue Bomber Supabase] client available:", canUseSupabase());

    try {
      const savedToSupabase = await saveSupabaseState(state);

      saveStoredState(state);
      console.log("[Blue Bomber Supabase] save result:", savedToSupabase ? "Supabase success" : "localStorage fallback");

      if (!savedToSupabase) {
        console.log("[Blue Bomber Supabase] localStorage fallback used:", reason);
      }
    } catch (error) {
      console.error("[Blue Bomber Supabase] localStorage fallback after Supabase error:", {
        reason,
        error: error instanceof Error ? error.message : error
      });
      saveStoredState(state);
    }
  }

  function persistState(overrides: {
    companies?: typeof companies;
    contacts?: typeof contacts;
    tasks?: typeof tasks;
    timeline?: typeof timeline;
    carriers?: typeof carrierItems;
  }, reason = "state change") {
    void persistStateToStorage({
      companies: overrides.companies ?? companies,
      contacts: overrides.contacts ?? contacts,
      tasks: overrides.tasks ?? tasks,
      timeline: overrides.timeline ?? timeline,
      carriers: overrides.carriers ?? carrierItems
    }, reason);
  }

  function addProspect() {
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
      lastContact: ""
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
        body: `${newContact.name}${newContact.role ? `, ${newContact.role}` : ""}`,
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
      createdBy: "Manual",
      sourceCompany: company.name,
      sourceNote: "Manual task"
    };
    const taskTimelineEvent = createTaskTimelineEvent(
      newTask,
      "Task Created",
      `${newTask.title} created for ${newTask.owner}.`
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

  function deleteCompany(company: Company) {
    if (!window.confirm(`Delete ${company.name}? This will remove related contacts, tasks, and timeline entries.`)) {
      return;
    }

    const nextCompanies = companies.filter((companyItem) => companyItem.id !== company.id);
    const nextContacts = contacts.filter((contact) => contact.companyId !== company.id);
    const nextTasks = tasks.filter((task) => task.companyId !== company.id);
    const nextTimeline = timeline.filter((entry) => entry.companyId !== company.id);

    setCompanies(nextCompanies);
    setContacts(nextContacts);
    setTasks(nextTasks);
    setTimeline(nextTimeline);
    setSelectedCompanyId(null);
    setSelectedTaskId(null);
    setCurrentView(company.status === "customer" ? "customers" : "prospects");
    saveStoredState({
      companies: nextCompanies,
      contacts: nextContacts,
      tasks: nextTasks,
      timeline: nextTimeline,
      carriers: carrierItems
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
      const rows = await readProspectImportRows(file);
      const existingNames = new Set(companies.map((company) => normalizeCompanyName(company.name)));
      const seenNames = new Set<string>();
      const importedCompanies: Company[] = [];
      const importedContacts: Contact[] = [];
      let skipped = 0;

      rows.forEach((row) => {
        const normalizedName = normalizeCompanyName(row.companyName);

        if (!normalizedName || existingNames.has(normalizedName) || seenNames.has(normalizedName)) {
          skipped += 1;
          return;
        }

        seenNames.add(normalizedName);

        const companyId = createUuid();
        const contactId = createUuid();
        const smartNotes = [row.notes, row.website ? `Website: ${row.website}` : ""]
          .filter(Boolean)
          .join("\n");
        const company: Company = {
          id: companyId,
          name: row.companyName,
          status: row.status,
          city: "Imported",
          state: statusLabel(row.status),
          segment: statusLabel(row.status),
          currentOpportunity: "Imported prospect. Add freight notes after first contact.",
          smartNotes,
          salesLead: row.salesLead || "Louie",
          operationsLead: row.operationsLead || "Brian",
          primaryContactId: row.phone || row.email ? contactId : "",
          lastContact: "",
          lastActivity: "Imported",
          active: true,
          qualifyingQuestions: Object.fromEntries(
            qualifyingQuestions.map((question) => [question, ""])
          )
        };

        importedCompanies.push(company);

        if (row.phone || row.email) {
          importedContacts.push({
            id: contactId,
            companyId,
            name: "Imported Contact",
            role: "Imported",
            email: row.email,
            phone: row.phone
          });
        }
      });

      if (importedCompanies.length) {
        const savedToSupabase = await importSupabaseProspects(importedCompanies, importedContacts);

        if (!savedToSupabase) {
          throw new Error("Supabase client unavailable.");
        }

        const nextCompanies = [...importedCompanies, ...companies];
        const nextContacts = [...importedContacts, ...contacts];

        setCompanies(nextCompanies);
        setContacts(nextContacts);
        saveStoredState({
          companies: nextCompanies,
          contacts: nextContacts,
          tasks,
          timeline,
          carriers: carrierItems
        });
      }

      setImportResult({ imported: importedCompanies.length, skipped });
    } catch (error) {
      console.error("[Blue Bomber Import] Prospect import failed:", error);
      window.alert(error instanceof Error ? error.message : "Prospect import failed.");
    } finally {
      setIsImporting(false);

      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
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
        `Delete ${selectedNames.length} selected prospect${selectedNames.length === 1 ? "" : "s"}? This will remove related contacts, tasks, and timeline entries.`
      )
    ) {
      return;
    }

    const nextCompanies = companies.filter((company) => !selectedIds.has(company.id));
    const nextContacts = contacts.filter((contact) => !selectedIds.has(contact.companyId));
    const nextTasks = tasks.filter((task) => !selectedIds.has(task.companyId));
    const nextTimeline = timeline.filter((entry) => !selectedIds.has(entry.companyId));

    setCompanies(nextCompanies);
    setContacts(nextContacts);
    setTasks(nextTasks);
    setTimeline(nextTimeline);
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
      carriers: carrierItems
    });

    void deleteSupabaseCompanies(companyIdsToDelete).catch((error) => {
      console.error("[Blue Bomber Supabase] local-only bulk delete after Supabase error:", {
        count: companyIdsToDelete.length,
        error: error instanceof Error ? error.message : error
      });
    });
  }

  return (
    <main className="shell">
      <section className="topbar" aria-label="Home">
        <div>
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">BB</span>
            <p className="app-label">Blue Bomber Command Center</p>
          </div>
          <h1>{pageTitle}</h1>
        </div>
        <div className="topbar-actions">
          <nav className="view-nav" aria-label="Primary navigation">
            <button
              className={currentView === "home" ? "active" : ""}
              type="button"
              onClick={() => openView("home")}
            >
              Today&apos;s Tasks
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
          <div className="quick-actions" aria-label="Quick Actions">
            <button className="primary-action" type="button" onClick={() => openQuickCreate("prospect")}>
              Add Prospect
            </button>
            <button className="secondary-action" type="button" onClick={() => openQuickCreate("customer")}>
              Add Customer
            </button>
            <button className="secondary-action" type="button" onClick={() => openQuickCreate("carrier")}>
              Add Carrier
            </button>
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

      {currentView === "home" ? (
        <section className="task-centerpiece home-tasks" aria-label="TASK DASHBOARD">
          <div className="task-centerpiece-header">
            <div>
              <h2>Command Center</h2>
            </div>
            {showTaskAdvanced ? <span>{taskItems.length} shown · {taskCounters.open} open</span> : null}
          </div>
          <div className="task-more-row">
            <button className="secondary-action" type="button" onClick={() => setShowTaskAdvanced((value) => !value)}>
              {showTaskAdvanced ? "Less" : "More"}
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
                  <span>Open Tasks</span>
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
              <div className="tabs task-filter-tabs" role="tablist" aria-label="Task filter">
                {taskFilters.map((filter) => (
                  <button
                    aria-selected={taskFilter === filter.id}
                    className={taskFilter === filter.id ? "active" : ""}
                    key={filter.id}
                    onClick={() => setTaskFilter(filter.id)}
                    role="tab"
                    type="button"
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <input
                className="task-search"
                value={taskSearch}
                onChange={(event) => setTaskSearch(event.target.value)}
                placeholder="Search tasks, company, owner"
                type="search"
              />
            </>
          ) : null}
          <TaskDashboard
            entityNameById={taskEntityNameById}
            onCompleteTask={completeTask}
            onEditTask={editTask}
            onOpenEntity={openTaskEntity}
            onOpenTaskDetail={openTaskDetail}
            onReassignTask={reassignTask}
            onSnoozeTask={snoozeTask}
            selectedTaskId={selectedTaskId}
            taskFilter={taskFilter}
            taskItems={taskItems}
            showAdvanced={showTaskAdvanced}
          />
          {selectedTask ? (
            <TaskDetail
              entityLabel={getTaskEntityLabel(selectedTask, companies, carrierItems)}
              task={selectedTask}
            />
          ) : null}
        </section>
      ) : null}

      {currentView === "prospects" ? (
        <CompanyListPage
          companies={prospectCompanies}
          importInputRef={importInputRef}
          importResult={importResult}
          isImporting={isImporting}
          selectedBulkProspectIds={selectedBulkProspectIds}
          title="Prospect List"
          onArchiveSelected={archiveSelectedProspects}
          onBulkStatusChange={updateSelectedProspectStatus}
          onDeleteSelected={deleteSelectedProspects}
          onImportFile={importProspects}
          onSelect={selectCompany}
          onToggleBulkProspect={toggleBulkProspect}
        />
      ) : null}

      {currentView === "customers" ? (
        <CompanyListPage
          companies={customerCompanies}
          selectedBulkProspectIds={[]}
          title="Customer List"
          onArchiveSelected={() => undefined}
          onBulkStatusChange={() => undefined}
          onDeleteSelected={() => undefined}
          onImportFile={importProspects}
          onSelect={selectCompany}
          onToggleBulkProspect={() => undefined}
        />
      ) : null}

      {currentView === "carriers" ? (
        <CarrierListPage carriers={carrierItems} onSelect={selectCarrier} />
      ) : null}

      {(currentView === "prospect-profile" || currentView === "customer-profile") && selectedCompany ? (
        <>
          <CompanyProfile
            company={selectedCompany}
            contacts={companyContacts}
            onAddManualContact={(values) => addManualContact(selectedCompany, values)}
            onAddManualTask={(values) => addManualTask(selectedCompany, values)}
            onDeleteCompany={() => deleteCompany(selectedCompany)}
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
              const result = applyIntent(latestCompany.smartNotes, latestCompany, contacts);
              const nextCompanies = companies.map((company) =>
                company.id === latestCompany.id ? { ...result.company, smartNotes: "" } : company
              );
              const nextTasks = result.tasks.length ? [...result.tasks, ...tasks] : tasks;
              const taskCreatedEvents = result.tasks
                .map((task) =>
                  createTaskTimelineEvent(task, "Task Created", `${task.title} created for ${task.owner}.`)
                )
                .filter((entry): entry is TimelineEntry => Boolean(entry));
              const nextTimeline = [...taskCreatedEvents, result.timelineEntry, ...timeline];

              setCompanies(nextCompanies);
              setContacts(result.contacts);

              if (result.tasks.length) {
                setTasks(nextTasks);
              }

              setTimeline(nextTimeline);
              persistState({
                companies: nextCompanies,
                contacts: result.contacts,
                tasks: nextTasks,
                timeline: nextTimeline
              }, result.tasks.length ? "adding note and generating task" : "adding note");
              setNoteResult({
                tasks: result.tasks.map((task) => ({ title: task.title, owner: task.owner }))
              });
              window.setTimeout(() => setNoteResult(null), 5000);
            }}
            tasks={selectedCompanyTasks}
            timeline={timeline}
            noteResult={noteResult}
          />
          {selectedTask ? (
            <TaskDetail
              entityLabel={getTaskEntityLabel(selectedTask, companies, carrierItems)}
              task={selectedTask}
            />
          ) : null}
        </>
      ) : null}

      {currentView === "carrier-profile" && selectedCarrier ? (
        <>
          <CarrierProfile
            carrier={selectedCarrier}
            note={carrierNote}
            noteResult={noteResult}
            tasks={selectedCarrierTasks}
            onAddNote={() => {
              const note = carrierNote.trim();

              if (!note) {
                return;
              }

              setSelectedTaskId(null);
              const result = applyCarrierIntent(note, selectedCarrier);
              const nextTasks = result.tasks.length ? [...result.tasks, ...tasks] : tasks;

              if (result.tasks.length) {
                setTasks(nextTasks);
              }

              setCarrierNote("");
              persistState({
                tasks: nextTasks
              }, result.tasks.length ? "adding carrier note and generating task" : "adding carrier note");
              setNoteResult({
                tasks: result.tasks.map((task) => ({ title: task.title, owner: task.owner }))
              });
              window.setTimeout(() => setNoteResult(null), 5000);
            }}
            onNoteChange={setCarrierNote}
          />
          {selectedTask ? (
            <TaskDetail
              entityLabel={getTaskEntityLabel(selectedTask, companies, carrierItems)}
              task={selectedTask}
            />
          ) : null}
        </>
      ) : null}
    </main>
  );
}

function CompanyListPage({
  companies,
  importInputRef,
  importResult,
  isImporting = false,
  selectedBulkProspectIds,
  title,
  onArchiveSelected,
  onBulkStatusChange,
  onDeleteSelected,
  onImportFile,
  onSelect,
  onToggleBulkProspect
}: {
  companies: Company[];
  importInputRef?: React.RefObject<HTMLInputElement>;
  importResult?: { imported: number; skipped: number } | null;
  isImporting?: boolean;
  selectedBulkProspectIds: string[];
  title: string;
  onArchiveSelected: () => void;
  onBulkStatusChange: (status: CompanyStatus) => void;
  onDeleteSelected: () => void;
  onImportFile: (file: File) => void;
  onSelect: (companyId: string) => void;
  onToggleBulkProspect: (companyId: string) => void;
}) {
  const isProspectList = title === "Prospect List";
  const hasBulkSelection = selectedBulkProspectIds.length > 0;
  const [showListManagement, setShowListManagement] = useState(false);

  return (
    <section className="list-page" aria-label={title}>
      <div className="list-header">
        <div>
          <h2>{title}</h2>
          <span>{companies.length} active</span>
        </div>
        {isProspectList ? (
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

      {isProspectList && showListManagement ? (
        <div className="bulk-control list-bulk-control" aria-label="Bulk prospect actions">
          <div className="bulk-actions horizontal">
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
        </div>
      ) : null}

      <ul className="record-list">
        {companies.map((company) => (
          <li key={company.id}>
            {isProspectList && showListManagement ? (
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

function CarrierListPage({ carriers, onSelect }: { carriers: Carrier[]; onSelect: (carrierId: string) => void }) {
  return (
    <section className="list-page" aria-label="Carrier List">
      <div className="list-header">
        <div>
          <h2>Carrier List</h2>
          <span>{carriers.length} active</span>
        </div>
      </div>

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
  note,
  noteResult,
  tasks,
  onAddNote,
  onNoteChange
}: {
  carrier: Carrier;
  note: string;
  noteResult: { tasks: Array<{ title: string; owner: string }> } | null;
  tasks: Task[];
  onAddNote: () => void;
  onNoteChange: (note: string) => void;
}) {
  const [showCarrierDetails, setShowCarrierDetails] = useState(false);

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

      <section className="command-timeline" aria-label="Call Notes">
        <div className="command-center">
          <div className="command-center-header">
            <h3>Call Notes</h3>
            <p>Type notes naturally. Blue Bomber OS will detect tasks and activities automatically.</p>
          </div>
          <textarea
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
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
          {noteResult ? <NoteSavedMessage tasks={noteResult.tasks} /> : null}
        </div>

        {showCarrierDetails ? (
          <div className="current-opportunity">
            <span>Carrier Details</span>
            <strong>{carrier.equipment}</strong>
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
      </section>
    </section>
  );
}

function CompanyProfile({
  company,
  contacts: companyContacts,
  tasks: companyTasks,
  timeline,
  noteResult,
  onSmartNotesChange,
  onAddNote,
  onAddManualContact,
  onAddManualTask,
  onDeleteCompany
}: {
  company: Company;
  contacts: typeof seedContacts;
  tasks: Task[];
  timeline: typeof seedTimeline;
  noteResult: { tasks: Array<{ title: string; owner: string }> } | null;
  onSmartNotesChange: (smartNotes: string) => void;
  onAddNote: () => void;
  onAddManualContact: (values: ManualContactInput) => void;
  onAddManualTask: (values: ManualTaskInput) => void;
  onDeleteCompany: () => void;
}) {
  const [expandedSection, setExpandedSection] = useState<ProfileTab | null>(null);
  const primaryContact = getPrimaryContact(company, companyContacts);
  const openTasks = companyTasks.filter(isActiveTask).sort(compareTasksByDueThenCreated);
  const timelineRows = getCompanyTimelineRows(company, timeline);
  const accountSummary = buildAccountSummary(company, companyContacts, openTasks, timelineRows);

  function toggleSection(tab: ProfileTab) {
    setExpandedSection((currentSection) => (currentSection === tab ? null : tab));
  }

  return (
    <section className="profile" aria-label="Company Profile">
      <div className="profile-top-row">
        <section className="account-card" aria-label="Account Card">
          <span className="status">{statusLabel(company.status)}</span>
          <h2>{company.name}</h2>
          <dl>
            <div>
              <dt>City / State</dt>
              <dd>{formatLocation(company)}</dd>
            </div>
            {primaryContact?.phone ? (
              <div>
                <dt>Phone</dt>
                <dd>{primaryContact.phone}</dd>
              </div>
            ) : null}
            {getCompanyWebsite(company) ? (
              <div>
                <dt>Website</dt>
                <dd>{getCompanyWebsite(company)}</dd>
              </div>
            ) : null}
            {primaryContact ? (
              <div>
                <dt>Primary Contact</dt>
                <dd>{primaryContact.name}</dd>
              </div>
            ) : null}
            <div>
              <dt>Last Contact</dt>
              <dd>{company.lastContact || primaryContact?.lastContact || "Not set"}</dd>
            </div>
            <div>
              <dt>Open Tasks</dt>
              <dd>{openTasks.length}</dd>
            </div>
          </dl>
        </section>

        <section className="account-summary" aria-label="Account Summary">
          <h3>Account Summary</h3>
          {accountSummary.map((sentence) => (
            <p key={sentence}>{sentence}</p>
          ))}
        </section>
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

      {expandedSection === "contacts" ? (
        <ProfileContactsSection contacts={companyContacts} onAddManualContact={onAddManualContact} />
      ) : null}

      {expandedSection === "freight" ? (
        <Panel title="Freight Op">
          <p>{company.currentOpportunity}</p>
        </Panel>
      ) : null}

      {expandedSection === "files" ? (
        <Panel title="Files">
          <p className="empty">Files placeholder.</p>
          <div className="profile-actions">
            <button className="files-button" type="button">
              Files
            </button>
            <button className="delete-button" type="button" onClick={onDeleteCompany}>
              Delete Account
            </button>
          </div>
        </Panel>
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
          + Task
        </button>
      </div>
      {showForm ? (
        <div className="manual-form" aria-label="Add manual task">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Task Name" />
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
            Save Task
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
        <p className="empty">No open tasks.</p>
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
  noteResult: { tasks: Array<{ title: string; owner: string }> } | null;
  onSmartNotesChange: (smartNotes: string) => void;
  onAddNote: () => void;
}) {
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
          placeholder={`Talked to Aaron today

Need better number

Need new POC

Call back Wednesday

53ft dry vans only

Requested email only`}
        />
        <div className="note-actions">
          <button type="button" onClick={onAddNote}>
            Add Note
          </button>
        </div>
        {noteResult ? <NoteSavedMessage tasks={noteResult.tasks} /> : null}
      </div>

      <div className="timeline-stream">
        <h3>Timeline</h3>
        {timelineRows.length ? (
          timelineRows.map((entry) => (
            <div className={entry.type === "task" ? "timeline-item task-event" : "timeline-item"} key={entry.id}>
              <strong>{entry.title}</strong>
              <span>{entry.detail}</span>
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

function NoteSavedMessage({ tasks }: { tasks: Array<{ title: string; owner: string }> }) {
  return (
    <div className="note-saved" role="status">
      <strong>✓ Note Saved</strong>
      {tasks.length ? (
        <>
          <span>Tasks Created:</span>
          <ul>
            {tasks.map((task) => (
              <li key={`${task.title}-${task.owner}`}>
                {task.title} ({task.owner})
              </li>
            ))}
          </ul>
        </>
      ) : (
        <span>No tasks created.</span>
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
      return [];
    }

    return parseProspectRows(
      XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheetName], {
        defval: ""
      })
    );
  }

  throw new Error("Import requires a .csv or .xlsx file.");
}

function parseProspectRows(rows: Array<Record<string, unknown>>): ProspectImportRow[] {
  return rows
    .map((row) => ({
      companyName: getImportValue(row, "Company Name"),
      status: parseImportStatus(getImportValue(row, "Status")),
      salesLead: getImportValue(row, "Sales Lead"),
      operationsLead: getImportValue(row, "Operations Lead"),
      phone: getImportValue(row, "Phone"),
      email: getImportValue(row, "Email"),
      website: getImportValue(row, "Website"),
      notes: getImportValue(row, "Notes")
    }))
    .filter((row) => row.companyName);
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

function getImportValue(row: Record<string, unknown>, columnName: string) {
  const match = Object.entries(row).find(
    ([key]) => key.trim().toLowerCase() === columnName.toLowerCase()
  );

  return match?.[1] == null ? "" : String(match[1]).trim();
}

function parseImportStatus(value: string): CompanyStatus {
  return value.toLowerCase() === "customer" ? "customer" : "prospect";
}

function normalizeCompanyName(value: string) {
  return value.trim().toLowerCase();
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
    <section className="task-detail" aria-label="Task Detail">
      <h2>Task Detail</h2>
      <dl>
        <div>
          <dt>Task Name</dt>
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
          <dt>Due Date</dt>
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

function TaskDashboard({
  entityNameById,
  onCompleteTask,
  onEditTask,
  onOpenEntity,
  onOpenTaskDetail,
  onReassignTask,
  onSnoozeTask,
  selectedTaskId,
  showAdvanced,
  taskFilter,
  taskItems
}: {
  entityNameById: Record<string, string>;
  onCompleteTask: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onOpenEntity: (task: Task) => void;
  onOpenTaskDetail: (task: Task) => void;
  onReassignTask: (task: Task) => void;
  onSnoozeTask: (task: Task) => void;
  selectedTaskId: string | null;
  showAdvanced: boolean;
  taskFilter: TaskFilter;
  taskItems: Task[];
}) {
  if (!taskItems.length) {
    return <p className="empty">No tasks here.</p>;
  }

  const recentTasks = [...taskItems]
    .sort((firstTask, secondTask) => secondTask.createdAt.localeCompare(firstTask.createdAt))
    .slice(0, 6);
  const todaySections = [
    { title: "Due Today", tasks: taskItems.filter((task) => isTaskDueToday(task) && !isTaskOverdue(task)) },
    { title: "Overdue", tasks: taskItems.filter((task) => isTaskOverdue(task)) },
    { title: "Recently Updated", tasks: recentTasks }
  ];
  const sections =
    taskFilter === "today"
      ? showAdvanced
        ? [
            ...todaySections,
            { title: "Upcoming", tasks: taskItems.filter((task) => !isTaskDueToday(task) && !isTaskOverdue(task)) }
          ]
        : todaySections
      : [{ title: taskFilters.find((filter) => filter.id === taskFilter)?.label ?? "Tasks", tasks: taskItems }];

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
            onSnoozeTask={onSnoozeTask}
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
  onSnoozeTask,
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
  onSnoozeTask: (task: Task) => void;
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
              const displayStatus = getTaskDisplayStatus(task);
              const isOpen = selectedTaskId === task.id;

              return (
                <li key={task.id}>
                  <article className={isOpen ? "task-card selected" : "task-card"}>
                    <span className={task.priority === "high" ? "task-dot high" : "task-dot"} />
                    <div className="task-card-main">
                      <strong>{task.title}</strong>
                      <span>
                        <button className="task-entity-link" type="button" onClick={() => onOpenEntity(task)}>
                          {entityNameById[getTaskEntityId(task)] ?? task.sourceCompany}
                        </button>
                      </span>
                      <dl className="task-card-meta">
                        <div>
                          <dt>Owner</dt>
                          <dd>{task.owner}</dd>
                        </div>
                        <div>
                          <dt>Due Date</dt>
                          <dd>{task.due || "Not set"}</dd>
                        </div>
                        <div>
                          <dt>Status</dt>
                          <dd>
                            <span className={displayStatus === "overdue" ? "task-status overdue" : "task-status"}>
                              {taskStatusLabel(displayStatus)}
                            </span>
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <div className="task-card-actions">
                      <button className="task-detail-button" type="button" onClick={() => onOpenTaskDetail(task)}>
                        {isOpen ? "Close" : "Open"}
                      </button>
                      {isOpen ? (
                        <>
                          <button type="button" onClick={() => onCompleteTask(task)}>
                            Complete
                          </button>
                          <button type="button" onClick={() => onSnoozeTask(task)}>
                            Snooze
                          </button>
                          <button type="button" onClick={() => onReassignTask(task)}>
                            Reassign
                          </button>
                          <button type="button" onClick={() => onEditTask(task)}>
                            Edit
                          </button>
                        </>
                      ) : null}
                    </div>
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

  return "Today's Tasks";
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

function entityNameById(companies: Company[], carriers: Carrier[]) {
  return {
    ...Object.fromEntries(companies.map((company) => [company.id, company.name])),
    ...Object.fromEntries(carriers.map((carrier) => [carrier.id, carrier.name]))
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

function parseDueDate(value: string, createdAt?: string) {
  const normalizedValue = value.trim().toLowerCase();
  const baseDate = createdAt ? new Date(createdAt) : new Date();

  if (normalizedValue === "today") {
    return startOfDay(new Date());
  }

  if (normalizedValue === "tomorrow") {
    return addDays(startOfDay(baseDate), 1);
  }

  if (normalizedValue === "next week") {
    return addDays(startOfDay(baseDate), 7);
  }

  if (normalizedValue === "next monday" || normalizedValue === "monday") {
    return nextWeekday(baseDate, 1);
  }

  if (normalizedValue === "friday") {
    return nextWeekday(baseDate, 5);
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp);
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

  return [task.title, entityName, task.owner]
    .some((value) => value.toLowerCase().includes(normalizedSearch));
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
