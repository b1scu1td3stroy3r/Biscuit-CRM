'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Zap, Database, Building2, Calendar as CalendarIcon, 
  FileText, CheckCircle2, Loader2, FolderCheck, Plus, Search, 
  RefreshCw, ExternalLink, ChevronRight, ArrowRight, LayoutGrid, List, Clock
} from 'lucide-react';
import { db, Contact, ProjectTask } from '../packages/storage/src/db';
import { syncOutboxToGoogleSheets } from '../packages/storage/src/sheetsSync';
import { syncTaskToGoogleCalendar } from '../packages/storage/src/calendarSync';

declare global {
  interface Window {
    google?: any;
    gapi?: any;
  }
}

const PIPELINE_STAGES = [
  { key: 'Lead', label: '1. Inbound Leads', color: 'border-amber-500/40 text-amber-400 bg-amber-500/10' },
  { key: 'Sales', label: '2. Active Sales', color: 'border-sky-500/40 text-sky-400 bg-sky-500/10' },
  { key: 'Procurement', label: '3. Procurement', color: 'border-purple-500/40 text-purple-400 bg-purple-500/10' },
  { key: 'Logistics', label: '4. Logistics', color: 'border-indigo-500/40 text-indigo-400 bg-indigo-500/10' },
  { key: 'Customer Service', label: '5. Retention / CS', color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' },
] as const;

type StageType = typeof PIPELINE_STAGES[number]['key'];

export default function Dashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [folderId] = useState<string>('1WK1GE6vGTuS1KGCC607Jdkcc6464YaST');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedSheetId, setLastSyncedSheetId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'table' | 'gantt'>('kanban');

  // Contact Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Project Task Modal
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    companyName: 'Revolut',
    startDate: '2026-11-05',
    endDate: '2026-11-12',
    progress: 25,
  });

  const [newContact, setNewContact] = useState({
    name: '',
    company: '',
    crn: '',
    email: '',
    phone: '',
    stage: 'Lead' as StageType,
  });

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/calendar.events',
  ].join(' ');

  const loadData = async () => {
    const contactList = await db.contacts.toArray();
    const taskList = await db.projects.toArray();
    setContacts(contactList);
    setTasks(taskList);
    const cachedSheet = localStorage.getItem('biscuit_crm_pipeline_sheet_id');
    if (cachedSheet) setLastSyncedSheetId(cachedSheet);
  };

  useEffect(() => {
    loadData();
  }, []);

  const authenticateToken = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (token) return resolve(token);
      if (!window.google) return reject(new Error('Google library not loaded'));

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: (response: any) => {
          if (response.error) return reject(response);
          setToken(response.access_token);
          resolve(response.access_token);
        },
      });
      client.requestAccessToken();
    });
  };

  const handleSyncToSheets = async () => {
    setIsSyncing(true);
    try {
      const activeToken = await authenticateToken();
      const res = await syncOutboxToGoogleSheets(activeToken, folderId);
      if (res.sheetId) setLastSyncedSheetId(res.sheetId);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Sync failed. Please check browser console.');
    } finally {
      setIsSyncing(false);
    }
  };

  const advanceStage = async (contact: Contact) => {
    const currentIndex = PIPELINE_STAGES.findIndex(s => s.key === contact.stage);
    if (currentIndex >= PIPELINE_STAGES.length - 1) return;

    const nextStage = PIPELINE_STAGES[currentIndex + 1].key;
    const now = new Date().toISOString();

    await db.contacts.update(contact.id!, {
      stage: nextStage,
      synced: false,
      updatedAt: now,
    });

    await db.outbox.add({
      type: 'UPDATE',
      table: 'contacts',
      payload: { id: contact.id, stage: nextStage, updatedAt: now },
      timestamp: Date.now(),
    });

    await loadData();
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const activeToken = await authenticateToken();
      const eventId = await syncTaskToGoogleCalendar(activeToken, {
        ...newTask,
        synced: true,
        updatedAt: new Date().toISOString(),
      });

      await db.projects.add({
        ...newTask,
        calendarEventId: eventId,
        synced: true,
        updatedAt: new Date().toISOString(),
      });

      setIsTaskModalOpen(false);
      setNewTask({
        title: '',
        companyName: 'Revolut',
        startDate: '2026-11-05',
        endDate: '2026-11-12',
        progress: 25,
      });
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to schedule calendar event.');
    }
  };

  const searchCompaniesHouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/companies-house?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const selectCompany = (item: any) => {
    setNewContact({
      ...newContact,
      company: item.title,
      crn: item.company_number,
    });
    setSearchResults([]);
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.name || !newContact.email) return;

    await db.contacts.add({
      ...newContact,
      synced: false,
      updatedAt: new Date().toISOString(),
    });

    await db.outbox.add({
      type: 'INSERT',
      table: 'contacts',
      payload: newContact,
      timestamp: Date.now(),
    });

    setNewContact({ name: '', company: '', crn: '', email: '', phone: '', stage: 'Lead' });
    setIsModalOpen(false);
    await loadData();
  };

  const hasUnsynced = contacts.some(c => !c.synced);

  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      <header className="flex items-center justify-between border-b border-slate-800 pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <span>🍪</span> Biscuit CRM
          </h1>
          <p className="text-sm text-slate-400 mt-1">Zero-Storage Business Operating System</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition ${viewMode === 'kanban' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Pipeline Board
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition ${viewMode === 'table' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <List className="w-3.5 h-3.5" /> Table View
            </button>
            <button
              onClick={() => setViewMode('gantt')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition ${viewMode === 'gantt' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <CalendarIcon className="w-3.5 h-3.5" /> Gantt & Milestones
            </button>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            System Live
          </span>
        </div>
      </header>

      {/* Sync Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 flex items-center justify-between mb-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Live Workspace Persistence Link</h3>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <FolderCheck className="w-3.5 h-3.5 text-emerald-400" />
              Drive Root Folder ID: <code className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono text-[11px]">{folderId}</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasUnsynced && (
            <button
              onClick={handleSyncToSheets}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-lg text-xs transition shadow-md shadow-indigo-600/20"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              Flush Outbox to Drive
            </button>
          )}

          {lastSyncedSheetId && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${lastSyncedSheetId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:underline px-2 py-1 bg-emerald-500/5 rounded border border-emerald-500/10"
            >
              Open Sheets Master <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {viewMode === 'gantt' ? (
            <button
              onClick={() => setIsTaskModalOpen(true)}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2 rounded-lg text-xs transition shadow-md shadow-amber-500/10"
            >
              <Plus className="w-3.5 h-3.5" /> New Calendar Milestone
            </button>
          ) : (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2 rounded-lg text-xs transition shadow-md shadow-amber-500/10"
            >
              <Plus className="w-3.5 h-3.5" /> Add Lead & UK CRN
            </button>
          )}
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === 'kanban' && (
        <section className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          {PIPELINE_STAGES.map((col, idx) => {
            const colContacts = contacts.filter(c => c.stage === col.key);
            const isLastCol = idx === PIPELINE_STAGES.length - 1;

            return (
              <div key={col.key} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 flex flex-col min-h-[460px]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${col.color}`}>
                    {col.label}
                  </span>
                  <span className="text-xs font-mono text-slate-500">{colContacts.length}</span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto">
                  {colContacts.map(c => (
                    <div key={c.id} className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/90 hover:border-slate-700 transition shadow-sm space-y-2.5">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-slate-100 text-sm leading-tight">{c.name}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{c.company}</div>
                        </div>
                        {c.synced ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-400" title="Synced to Sheets" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Outbox Queue" />
                        )}
                      </div>

                      {c.crn && (
                        <div className="text-[10px] font-mono text-sky-400 bg-sky-950/40 border border-sky-900/40 px-2 py-0.5 rounded w-fit">
                          CRN: {c.crn}
                        </div>
                      )}

                      <div className="text-[11px] text-slate-400 truncate">{c.email}</div>

                      {!isLastCol && (
                        <button
                          onClick={() => advanceStage(c)}
                          className="w-full mt-2 inline-flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700/60 transition group"
                        >
                          <span>Move Next</span>
                          <ChevronRight className="w-3.5 h-3.5 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      )}
                    </div>
                  ))}

                  {colContacts.length === 0 && (
                    <div className="h-28 border border-dashed border-slate-800/80 rounded-lg flex items-center justify-center text-[11px] text-slate-600">
                      Empty stage
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {viewMode === 'table' && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold text-slate-200 text-sm">All Pipeline Contacts</h2>
            <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full">{contacts.length} Records</span>
          </div>
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-3">Contact</th>
                <th className="px-6 py-3">Company & CRN</th>
                <th className="px-6 py-3">Stage</th>
                <th className="px-6 py-3">Sync Status</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/30">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-100">{c.name}</div>
                    <div className="text-xs text-slate-400">{c.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div>{c.company || '—'}</div>
                    {c.crn && <span className="text-xs font-mono text-sky-400">CRN: {c.crn}</span>}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 text-xs rounded-full bg-slate-800 text-amber-300 border border-slate-700">
                      {c.stage}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {c.synced ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Synced
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                        Outbox Queued
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => advanceStage(c)}
                      className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
                    >
                      Advance Stage <ArrowRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {viewMode === 'gantt' && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 mb-8">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
            <div>
              <h2 className="font-semibold text-slate-100 text-base flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-400" /> Project Milestones & Interactive Gantt
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Tasks auto-sync as all-day events on your connected Google Calendar</p>
            </div>
            <span className="text-xs font-mono bg-slate-800 text-slate-300 px-3 py-1 rounded-full">{tasks.length} Active Tasks</span>
          </div>

          {tasks.length === 0 ? (
            <div className="py-14 text-center text-slate-500 text-sm">
              No milestones scheduled yet. Click <strong>+ New Calendar Milestone</strong> to plan your first project phase.
            </div>
          ) : (
            <div className="space-y-4">
              {tasks.map((task) => (
                <div key={task.id} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-slate-200 text-sm">{task.title}</h4>
                      <p className="text-xs text-slate-400">{task.companyName} &bull; {task.startDate} to {task.endDate}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      <CalendarIcon className="w-3 h-3" /> Synced to Calendar
                    </span>
                  </div>

                  {/* Visual Timeline Bar */}
                  <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden mt-3">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-amber-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1 font-mono">
                    <span>{task.startDate}</span>
                    <span>Progress: {task.progress}%</span>
                    <span>{task.endDate}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Modal: New Calendar Milestone */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-indigo-400" /> New Calendar Milestone
              </h3>
              <button onClick={() => setIsTaskModalOpen(false)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Task / Phase Title</label>
                <input
                  type="text"
                  placeholder="e.g. Contract Signoff & Delivery Setup"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Company / Account</label>
                <input
                  type="text"
                  value={newTask.companyName}
                  onChange={(e) => setNewTask({ ...newTask, companyName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newTask.startDate}
                    onChange={(e) => setNewTask({ ...newTask, startDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">End Date</label>
                  <input
                    type="date"
                    value={newTask.endDate}
                    onChange={(e) => setNewTask({ ...newTask, endDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Progress ({newTask.progress}%)</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={newTask.progress}
                  onChange={(e) => setNewTask({ ...newTask, progress: Number(e.target.value) })}
                  className="w-full accent-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-lg text-sm transition"
                >
                  Create & Schedule on Calendar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: UK Companies House Lookup */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-sky-400" /> UK Companies House Lead Intake
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>

            <form onSubmit={searchCompaniesHouse} className="mb-4">
              <label className="text-xs font-semibold text-slate-300 block mb-1">Live CRN Lookup</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Dyson, Revolut, Monzo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 flex-1 focus:outline-none focus:border-sky-500"
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold px-4 py-2 rounded-lg text-sm transition flex items-center gap-1.5"
                >
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Search
                </button>
              </div>
            </form>

            {searchResults.length > 0 && (
              <div className="mb-4 max-h-40 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-2 space-y-1">
                {searchResults.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => selectCompany(item)}
                    className="p-2 rounded hover:bg-slate-800 cursor-pointer text-xs flex justify-between items-center transition"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">{item.title}</div>
                      <div className="text-slate-400 text-[10px]">{item.address_snippet}</div>
                    </div>
                    <span className="font-mono text-sky-400 shrink-0 ml-2">#{item.company_number}</span>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleCreateContact} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Company Name</label>
                <input
                  type="text"
                  value={newContact.company}
                  onChange={(e) => setNewContact({ ...newContact, company: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Company Number (CRN)</label>
                  <input
                    type="text"
                    value={newContact.crn}
                    onChange={(e) => setNewContact({ ...newContact, crn: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-sky-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={newContact.name}
                    onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Email Address</label>
                <input
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2 rounded-lg text-sm transition"
                >
                  Save to Pipeline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
