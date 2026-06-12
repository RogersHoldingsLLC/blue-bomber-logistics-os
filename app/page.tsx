"use client";

import { useEffect, useMemo, useState } from "react";
import {
  carriers as seedCarriers,
  companies as seedCompanies,
  contacts as seedContacts,
  qualifyingQuestions,
  tasks as seedTasks,
  timeline as seedTimeline
} from "@/lib/data";
import { applyIntent } from "@/lib/intent-engine";
import { loadStoredState, saveStoredState } from "@/lib/storage";
import {
  canUseSupabase,
  deleteSupabaseCompany,
  loadSupabaseState,
  saveSupabaseState
} from "@/lib/supabase-storage";
import type { AccountTab, Carrier, Company, CompanyStatus, Task } from "@/types";

type ProfileTab = "command" | "contacts" | "qualify" | "snapshot";
type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "blue-bomber-theme";

const accountTabs: Array<{ id: AccountTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "prospects", label: "Prospects" },
  { id: "customers", label: "Customers" },
  { id: "carriers", label: "Carriers" }
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
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [activeAccountTab, setActiveAccountTab] = useState<AccountTab>("all");
  const [activeProfileTab, setActiveProfileTab] = useState<ProfileTab>("command");
  const [showProspectForm, setShowProspectForm] = useState(false);
  const [prospectName, setProspectName] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [hasHydratedTheme, setHasHydratedTheme] = useState(false);
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
          setCompanies(supabaseState.companies);
          setContacts(supabaseState.contacts);
          setTasks(supabaseState.tasks);
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

  const openTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.status === "open")
        .sort((firstTask, secondTask) => firstTask.createdAt.localeCompare(secondTask.createdAt)),
    [tasks]
  );
  const selectedCompanyTasks = selectedCompany
    ? tasks.filter((task) => task.companyId === selectedCompany.id)
    : [];
  const companyContacts = selectedCompany
    ? contacts.filter((contact) => contact.companyId === selectedCompany.id).slice(0, 3)
    : [];
  const filteredCompanies = companies.filter((company) => {
    if (activeAccountTab === "prospects") {
      return company.status === "prospect";
    }

    if (activeAccountTab === "customers") {
      return company.status === "customer";
    }

    if (activeAccountTab === "carriers") {
      return false;
    }

    return true;
  });
  const previewCompany =
    selectedCompany ??
    filteredCompanies.find((company) =>
      company.name.toLowerCase().includes(searchValue.toLowerCase())
    ) ??
    null;

  function selectCompany(companyId: string) {
    setSelectedCompanyId(companyId);
    setSelectedTaskId(null);
    setActiveProfileTab("command");
  }

  function selectTask(task: Task) {
    setSelectedCompanyId(task.companyId);
    setSelectedTaskId(task.id);
    setActiveProfileTab("command");
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

      if (!savedToSupabase) {
        console.log("[Blue Bomber Supabase] localStorage fallback used:", reason);
        saveStoredState(state);
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
      id: crypto.randomUUID(),
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
    setActiveAccountTab("all");
    setActiveProfileTab("command");
    setSearchValue(newCompany.name);
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
    setSearchValue("");
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

  return (
    <main className="shell">
      <section className="topbar" aria-label="Home">
        <div>
          <p className="app-label">Blue Bomber Logistics OS</p>
          <h1>Tasks</h1>
        </div>
        <div className="topbar-actions">
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

      <section className="command-layout">
        <section className="task-centerpiece" aria-label="Tasks">
          <div className="task-centerpiece-header">
            <h2>Open Tasks</h2>
            <span>{openTasks.length} active</span>
          </div>
          <TaskQueue
            companyNameById={companyNameById(companies)}
            onSelectTask={selectTask}
            taskItems={openTasks}
          />
        </section>

        <aside className="account-browser" aria-label="Accounts">
          <div className="tabs compact-tabs" role="tablist" aria-label="Account filter">
            {accountTabs.map((tab) => (
              <button
                aria-selected={activeAccountTab === tab.id}
                className={activeAccountTab === tab.id ? "active" : ""}
                key={tab.id}
                onClick={() => {
                  setActiveAccountTab(tab.id);
                  setSearchValue("");
                  setSelectedCompanyId(null);
                  setSelectedTaskId(null);
                }}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeAccountTab === "carriers" ? (
            <CarrierPreview carriers={carrierItems} />
          ) : (
            <CompanySearch
              companies={filteredCompanies}
              previewCompany={previewCompany}
              searchValue={searchValue}
              selectedCompanyId={selectedCompanyId}
              onSearchChange={setSearchValue}
              onSelect={selectCompany}
            />
          )}
        </aside>
      </section>

      {selectedCompany ? (
        <CompanyProfile
          activeTab={activeProfileTab}
          company={selectedCompany}
          contacts={companyContacts}
          onDeleteCompany={() => deleteCompany(selectedCompany)}
          onSmartNotesChange={(smartNotes) => {
            setCompanies((currentCompanies) =>
              {
                const nextCompanies = currentCompanies.map((company) =>
                  company.id === selectedCompany.id ? { ...company, smartNotes } : company
                );

                persistState({ companies: nextCompanies }, "updating Activity Notes");

                return nextCompanies;
              }
            );
          }}
          onAddNote={() => {
            const latestCompany =
              companies.find((company) => company.id === selectedCompany.id) ?? selectedCompany;
            const note = latestCompany.smartNotes.trim();

            if (!note) {
              return;
            }

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
              setSelectedTaskId(result.tasks[0].id);
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
      ) : (
        <section className="profile-empty" aria-label="Company Profile">
          <h2>Select a task</h2>
          <p>Company data stays hidden until work requires it.</p>
        </section>
      )}

      {selectedTask ? (
        <TaskDetail task={selectedTask} />
      ) : null}
    </main>
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
  companies,
  previewCompany,
  searchValue,
  selectedCompanyId,
  onSearchChange,
  onSelect
}: {
  companies: Company[];
  previewCompany: Company | null;
  searchValue: string;
  selectedCompanyId: string | null;
  onSearchChange: (value: string) => void;
  onSelect: (companyId: string) => void;
}) {
  return (
    <div className="company-picker">
      <label htmlFor="company-search">Search Companies</label>
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

function TaskDetail({ task }: { task: Task }) {
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
          <dt>Company</dt>
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
  taskItems,
  companyNameById,
  onSelectTask
}: {
  taskItems: Task[];
  companyNameById: Record<string, string>;
  onSelectTask: (task: Task) => void;
}) {
  if (!taskItems.length) {
    return <p className="empty">No tasks here.</p>;
  }

  return (
    <ul className="task-list">
      {taskItems.map((task) => (
        <li key={task.id}>
          <button type="button" onClick={() => onSelectTask(task)}>
            <span className={task.priority === "high" ? "task-dot high" : "task-dot"} />
            <div>
              <strong>{task.title}</strong>
              <span>
                {companyNameById[task.companyId]} · {task.due} · {task.owner}
              </span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
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
