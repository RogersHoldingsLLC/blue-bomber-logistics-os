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
import type { Carrier, Company, CompanyStatus, Contact, Task } from "@/types";

type ProfileTab = "command" | "contacts" | "qualify" | "snapshot";
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
  { id: "command", label: "ACTIVITY NOTES" },
  { id: "contacts", label: "Contacts" },
  { id: "qualify", label: "Qualify" },
  { id: "snapshot", label: "Snapshot" }
];

function statusLabel(status: CompanyStatus) {
  return status === "prospect" ? "Prospect" : "Customer";
}

function taskStatusLabel(status: Task["status"]) {
  return status === "open" ? "Open" : "Done";
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
  const [activeProfileTab, setActiveProfileTab] = useState<ProfileTab>("command");
  const [showProspectForm, setShowProspectForm] = useState(false);
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

  const openTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.status === "open" && isVisibleTaskEntity(task, visibleCompanyIds, carrierIds))
        .sort((firstTask, secondTask) => firstTask.createdAt.localeCompare(secondTask.createdAt)),
    [carrierIds, tasks, visibleCompanyIds]
  );
  const taskItems = useMemo(
    () =>
      tasks
        .filter((task) => {
          if (!isVisibleTaskEntity(task, visibleCompanyIds, carrierIds)) {
            return false;
          }

          if (taskFilter === "completed") {
            return task.status === "done";
          }

          if (task.status !== "open") {
            return false;
          }

          if (taskFilter === "today") {
            return isTaskDueToday(task);
          }

          if (taskFilter === "overdue") {
            return isTaskOverdue(task);
          }

          if (taskFilter === "upcoming") {
            return !isTaskDueToday(task) && !isTaskOverdue(task);
          }

          return true;
        })
        .sort((firstTask, secondTask) => firstTask.createdAt.localeCompare(secondTask.createdAt)),
    [carrierIds, taskFilter, tasks, visibleCompanyIds]
  );
  const selectedCompanyTasks = selectedCompany
    ? tasks.filter((task) => task.companyId === selectedCompany.id)
    : [];
  const selectedCarrierTasks = selectedCarrier
    ? tasks.filter((task) => getTaskEntityType(task, companies, carrierItems) === "carrier" && getTaskEntityId(task) === selectedCarrier.id)
    : [];
  const companyContacts = selectedCompany
    ? contacts.filter((contact) => contact.companyId === selectedCompany.id).slice(0, 3)
    : [];
  const prospectCompanies = visibleCompanies.filter((company) => company.status === "prospect");
  const customerCompanies = visibleCompanies.filter((company) => company.status === "customer");
  const pageTitle = getPageTitle(currentView, selectedCompany, selectedCarrier);
  const taskEntityNameById = useMemo(
    () => entityNameById(visibleCompanies, carrierItems),
    [carrierItems, visibleCompanies]
  );

  function selectCompany(companyId: string) {
    const company = companies.find((companyItem) => companyItem.id === companyId);

    if (!company) {
      return;
    }

    setSelectedCompanyId(company.id);
    setSelectedCarrierId(null);
    setSelectedTaskId(null);
    setActiveProfileTab("command");
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
    setActiveProfileTab("command");
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
    setActiveProfileTab("command");
    setCurrentView(company.status === "customer" ? "customer-profile" : "prospect-profile");
  }

  function openTaskDetail(task: Task) {
    setSelectedTaskId((currentTaskId) => (currentTaskId === task.id ? null : task.id));
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

    const newCompany: Company = {
      id: createUuid(),
      name: trimmedName,
      status: "prospect",
      city: "New",
      state: "Lead",
      segment: "Prospect",
      currentOpportunity: "New prospect. Add opportunity details after first contact.",
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
    setCurrentView("prospect-profile");
    setActiveProfileTab("command");
    setProspectName("");
    setShowProspectForm(false);
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
          state: "Lead",
          segment: "Prospect",
          currentOpportunity: "Imported prospect. Add opportunity details after first contact.",
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
          <p className="app-label">Blue Bomber Logistics OS</p>
          <h1>{pageTitle}</h1>
        </div>
        <div className="topbar-actions">
          <nav className="view-nav" aria-label="Primary navigation">
            <button
              className={currentView === "home" ? "active" : ""}
              type="button"
              onClick={() => openView("home")}
            >
              Tasks
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
          <button className="primary-action" type="button" onClick={() => setShowProspectForm(true)}>
            + Prospect
          </button>
        </div>
      </section>

      {showProspectForm ? (
        <section className="prospect-form" aria-label="Add prospect">
          <input
            autoFocus
            value={prospectName}
            onChange={(event) => setProspectName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                addProspect();
              }
            }}
            placeholder="Company name"
          />
          <button type="button" onClick={addProspect}>
            Add
          </button>
          <button type="button" className="ghost" onClick={() => setShowProspectForm(false)}>
            Cancel
          </button>
        </section>
      ) : null}

      {currentView === "home" ? (
        <section className="task-centerpiece home-tasks" aria-label="Tasks">
          <div className="task-centerpiece-header">
            <div>
              <h2>Tasks</h2>
              <span>Default view: Today</span>
            </div>
            <span>{taskItems.length} shown · {openTasks.length} open</span>
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
          <TaskQueue
            entityNameById={taskEntityNameById}
            onOpenEntity={openTaskEntity}
            onOpenTaskDetail={openTaskDetail}
            selectedTaskId={selectedTaskId}
            taskItems={taskItems}
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
            activeTab={activeProfileTab}
            company={selectedCompany}
            contacts={companyContacts}
            onDeleteCompany={() => deleteCompany(selectedCompany)}
            onSmartNotesChange={(smartNotes) => {
              setCompanies((currentCompanies) => {
                const nextCompanies = currentCompanies.map((company) =>
                  company.id === selectedCompany.id ? { ...company, smartNotes } : company
                );

                persistState({ companies: nextCompanies }, "updating Activity Notes");

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
              const nextTimeline = [result.timelineEntry, ...timeline];

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
            onTabChange={setActiveProfileTab}
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

  return (
    <section className="list-page" aria-label={title}>
      <div className="list-header">
        <div>
          <h2>{title}</h2>
          <span>{companies.length} active</span>
        </div>
        {isProspectList && importInputRef ? (
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
      </div>

      {isProspectList ? (
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
            {isProspectList ? (
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
                {company.city}, {company.state} · {company.segment}
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
  return (
    <section className="profile" aria-label="Carrier Profile">
      <div className="profile-header">
        <div>
          <span className="snapshot-label">Snapshot</span>
          <span className="status">Carrier</span>
          <h2>{carrier.name}</h2>
          <p>
            {carrier.city}, {carrier.state} · {carrier.equipment}
          </p>
        </div>
      </div>

      <section className="command-timeline" aria-label="ACTIVITY NOTES">
        <div className="command-center">
          <div className="command-center-header">
            <h3>ACTIVITY NOTES</h3>
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

        <div className="current-opportunity">
          <span>Carrier Snapshot</span>
          <strong>{carrier.equipment}</strong>
        </div>
        <div className="timeline-stream">
          <h3>Carrier Tasks</h3>
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
  activeTab,
  company,
  contacts: companyContacts,
  tasks: companyTasks,
  timeline,
  noteResult,
  onSmartNotesChange,
  onAddNote,
  onDeleteCompany,
  onTabChange
}: {
  activeTab: ProfileTab;
  company: Company;
  contacts: typeof seedContacts;
  tasks: Task[];
  timeline: typeof seedTimeline;
  noteResult: { tasks: Array<{ title: string; owner: string }> } | null;
  onSmartNotesChange: (smartNotes: string) => void;
  onAddNote: () => void;
  onDeleteCompany: () => void;
  onTabChange: (tab: ProfileTab) => void;
}) {
  return (
    <section className="profile" aria-label="Company Profile">
      <div className="profile-header">
        <div>
          <span className="snapshot-label">Snapshot</span>
          <span className="status">{statusLabel(company.status)}</span>
          <h2>{company.name}</h2>
          <p>
            {company.city}, {company.state} · {company.segment}
          </p>
        </div>
        <div className="profile-actions">
          <button className="files-button" type="button">
            Files
          </button>
          <button className="delete-button" type="button" onClick={onDeleteCompany}>
            Delete
          </button>
        </div>
      </div>

      <div className="tabs profile-tabs" role="tablist" aria-label="Company profile sections">
        {profileTabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? "active" : ""}
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "command" ? (
        <CommandTimeline
          company={company}
          companyTasks={companyTasks}
          timeline={timeline}
          noteResult={noteResult}
          onSmartNotesChange={onSmartNotesChange}
          onAddNote={onAddNote}
        />
      ) : null}

      {activeTab === "contacts" ? (
        <Panel title="Contacts (3)">
          <ul className="contact-list">
            {companyContacts.map((contact) => (
              <li key={contact.id}>
                <strong>{contact.name}</strong>
                <span>{contact.role}</span>
                <span>{contact.email}</span>
                <span>{contact.phone}</span>
                {contact.lastContact ? <span>Last contact: {contact.lastContact}</span> : null}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {activeTab === "qualify" ? (
        <Panel title="5 Qualifying Questions">
          <ol className="question-list">
            {qualifyingQuestions.map((question) => (
              <li key={question}>
                <strong>{question}</strong>
                <span>{company.qualifyingQuestions[question] || "Not answered yet"}</span>
              </li>
            ))}
          </ol>
        </Panel>
      ) : null}

      {activeTab === "snapshot" ? (
        <div className="profile-grid">
          <Panel title="Company Snapshot">
            <dl className="snapshot">
              <div>
                <dt>Status</dt>
                <dd>{statusLabel(company.status)}</dd>
              </div>
              <div>
                <dt>Segment</dt>
                <dd>{company.segment}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>
                  {company.city}, {company.state}
                </dd>
              </div>
              <div>
                <dt>Sales Lead</dt>
                <dd>{company.salesLead}</dd>
              </div>
              <div>
                <dt>Operations Lead</dt>
                <dd>{company.operationsLead}</dd>
              </div>
              <div>
                <dt>Last Contact</dt>
                <dd>{company.lastContact || "Not set"}</dd>
              </div>
              <div>
                <dt>Last Activity</dt>
                <dd>{company.lastActivity || "Not set"}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Current Opportunity">
            <p>{company.currentOpportunity}</p>
          </Panel>
        </div>
      ) : null}
    </section>
  );
}

function CommandTimeline({
  company,
  companyTasks,
  timeline,
  noteResult,
  onSmartNotesChange,
  onAddNote
}: {
  company: Company;
  companyTasks: Task[];
  timeline: typeof seedTimeline;
  noteResult: { tasks: Array<{ title: string; owner: string }> } | null;
  onSmartNotesChange: (smartNotes: string) => void;
  onAddNote: () => void;
}) {
  const timelineEntries = timeline
    .filter((entry) => entry.companyId === company.id)
    .map((entry) => ({
      id: entry.id,
      title: entry.at,
      detail: entry.body,
      createdAt: entry.createdAt,
      type: "timeline"
    }));
  const taskEntries = [...companyTasks]
    .sort((firstTask, secondTask) => secondTask.createdAt.localeCompare(firstTask.createdAt))
    .map((task) => ({
      id: task.id,
      title: task.title,
      detail: `${taskStatusLabel(task.status)} · ${task.due} · Owner: ${task.owner}`,
      createdAt: task.createdAt,
      type: "task"
    }));
  const timelineRows = [...timelineEntries, ...taskEntries].sort(
    (firstEntry, secondEntry) => secondEntry.createdAt.localeCompare(firstEntry.createdAt)
  );

  return (
    <section className="command-timeline" aria-label="ACTIVITY NOTES">
      <div className="command-center">
        <div className="command-center-header">
          <h3>ACTIVITY NOTES</h3>
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

      <div className="current-opportunity">
        <span>Current Opportunity</span>
        <strong>{company.currentOpportunity}</strong>
      </div>

      <div className="timeline-stream">
        <h3>Timeline</h3>
        {timelineRows.map((entry) => (
          <div className={entry.type === "task" ? "timeline-item task-event" : "timeline-item"} key={entry.id}>
            <strong>{entry.title}</strong>
            <span>{entry.detail}</span>
          </div>
        ))}
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
          <dd>{taskStatusLabel(task.status)}</dd>
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

function TaskQueue({
  entityNameById,
  onOpenEntity,
  onOpenTaskDetail,
  selectedTaskId,
  taskItems
}: {
  entityNameById: Record<string, string>;
  onOpenEntity: (task: Task) => void;
  onOpenTaskDetail: (task: Task) => void;
  selectedTaskId: string | null;
  taskItems: Task[];
}) {
  if (!taskItems.length) {
    return <p className="empty">No tasks here.</p>;
  }

  return (
    <ul className="task-list">
      {taskItems.map((task) => (
        <li key={task.id}>
          <article className={selectedTaskId === task.id ? "task-card selected" : "task-card"}>
            <span className={task.priority === "high" ? "task-dot high" : "task-dot"} />
            <div>
              <strong>{task.title}</strong>
              <span>
                <button className="task-entity-link" type="button" onClick={() => onOpenEntity(task)}>
                  {entityNameById[getTaskEntityId(task)] ?? task.sourceCompany}
                </button>
                {" · "}
                {task.due} · {task.owner}
              </span>
            </div>
            <button className="task-detail-button" type="button" onClick={() => onOpenTaskDetail(task)}>
              {selectedTaskId === task.id ? "Hide Details" : "Open/Details"}
            </button>
          </article>
        </li>
      ))}
    </ul>
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

  return "Tasks";
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

function isTaskDueToday(task: Task) {
  const due = task.due.trim().toLowerCase();

  if (due === "today") {
    return true;
  }

  const dueDate = parseDueDate(task.due);

  if (!dueDate) {
    return false;
  }

  const today = new Date();

  return dueDate.toDateString() === today.toDateString();
}

function isTaskOverdue(task: Task) {
  const due = task.due.trim().toLowerCase();

  if (due === "yesterday") {
    return true;
  }

  const dueDate = parseDueDate(task.due);

  if (!dueDate) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  return dueDate < today;
}

function parseDueDate(value: string) {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp);
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
