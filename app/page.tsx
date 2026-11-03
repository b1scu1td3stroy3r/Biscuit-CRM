'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ShieldCheck, Zap, Database, Building2, Calendar as CalendarIcon, 
  FileText, CheckCircle2, Loader2, FolderCheck, Plus, Search, 
  RefreshCw, ExternalLink, ChevronRight, ArrowRight, LayoutGrid, List, Clock,
  BookOpen, Copy, Mail, Check, UserCheck, Activity, DownloadCloud, Eye, MapPin,
  Cloud, CloudOff, Hash, Users
} from 'lucide-react';
import { db, Contact, ProjectTask, StoredTemplate } from '../packages/storage/src/db';
import { syncOutboxToGoogleSheets, pullContactsFromGoogleSheet } from '../packages/storage/src/sheetsSync';
import { syncTaskToGoogleCalendar } from '../packages/storage/src/calendarSync';
import { logAuditEvent } from '../packages/storage/src/auditLogger';
import { DEFAULT_TEMPLATES, replaceTokens, TemplateItem } from '../packages/templates/src/templates';
import CommandPalette from '../components/CommandPalette';
import HealthWizard from '../components/HealthWizard';
import DealDetailDrawer from '../components/DealDetailDrawer';
import EmployeeHub from '../components/EmployeeHub';

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
  const [customTemplates, setCustomTemplates] = useState<StoredTemplate[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSyncedSheetId, setLastSyncedSheetId] = useState<string | null>(null);
  const [auditSheetId, setAuditSheetId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'table' | 'gantt' | 'templates' | 'hub'>('kanban');

  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isHealthOpen, setIsHealthOpen] = useState(false);
  const [selectedDealForDrawer, setSelectedDealForDrawer] = useState<Contact | null>(null);

  const [senderName, setSenderName] = useState<string>('Sarah Jenkins');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [selectedContactForTemplate, setSelectedContactForTemplate] = useState<Contact | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isNewTemplateModalOpen, setIsNewTemplateModalOpen] = useState(false);
  const [newTemplateForm, setNewTemplateForm] = useState({
    title: '',
    category: 'Custom' as const,
    subject: '',
    body: '',
  });

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    companyName: 'Revolut',
    startDate: '2026-11-05',
    endDate: '2026-11-12',
    progress: 25,
  });

  const [newContact, setNewContact] = useState({
    accountNumber: '',
    name: '',
    company: '',
    crn: '',
    email: '',
    phone: '',
    accountManager: '',
    billingAddress: '',
    shippingAddress: '',
    stage: 'Lead' as StageType,
  });

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/calendar.events',
  ].join(' ');

  const loadData = async () => {
    const rawContacts = await db.contacts.toArray();
    
    const contactList: Contact[] = [];
    for (const c of rawContacts) {
      if (!c.accountNumber && c.id) {
        const generatedAcc = `ACC-${10000 + c.id}`;
        await db.contacts.update(c.id, { accountNumber: generatedAcc });
        c.accountNumber = generatedAcc;
      }
      contactList.push(c);
    }

    const taskList = await db.projects.toArray();
    const storedTpls = await db.templates.toArray();
    setContacts(contactList);
    setTasks(taskList);
    setCustomTemplates(storedTpls);

    const savedSender = localStorage.getItem('biscuit_crm_sender_name');
    if (savedSender) setSenderName(savedSender);

    if (contactList.length > 0 && !selectedContactForTemplate) {
      setSelectedContactForTemplate(contactList[0]);
    }
    const cachedSheet = localStorage.getItem('biscuit_crm_pipeline_sheet_id');
    if (cachedSheet) setLastSyncedSheetId(cachedSheet);

    const cachedAudit = localStorage.getItem('biscuit_crm_audit_sheet_id');
    if (cachedAudit) setAuditSheetId(cachedAudit);
  };

  const authenticateToken = useCallback((): Promise<string> => {
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
  }, [clientId, token, SCOPES]);

  const handleSyncToSheets = useCallback(async (silent = false) => {
    if (isSyncing || !navigator.onLine) return;
    setIsSyncing(true);
    try {
      const activeToken = await authenticateToken();
      const res = await syncOutboxToGoogleSheets(activeToken, folderId);
      if (res.sheetId) setLastSyncedSheetId(res.sheetId);
      await loadData();
    } catch (err: any) {
      console.warn('Background sync deferred:', err);
      if (!silent) alert(`Sync failed: ${err.message || err}`);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, folderId, authenticateToken]);

  const triggerDebouncedSync = useCallback(() => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      handleSyncToSheets(true);
    }, 2500);
  }, [handleSyncToSheets]);

  useEffect(() => {
    loadData();

    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      handleSyncToSheets(true);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('keydown', handleKeyDown);
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [handleSyncToSheets]);

  const handleOpenAddModal = () => {
    setNewContact({
      accountNumber: `ACC-${Math.floor(10000 + Math.random() * 90000)}`,
      name: '',
      company: '',
      crn: '',
      email: '',
      phone: '',
      accountManager: senderName,
      billingAddress: '',
      shippingAddress: '',
      stage: 'Lead',
    });
    setIsModalOpen(true);
  };

  const handleUpdateSenderName = (name: string) => {
    setSenderName(name);
    localStorage.setItem('biscuit_crm_sender_name', name);
  };

  const handlePullFromSheets = async () => {
    setIsPulling(true);
    try {
      const activeToken = await authenticateToken();
      const res = await pullContactsFromGoogleSheet(activeToken, folderId);
      if (res.sheetId) setLastSyncedSheetId(res.sheetId);
      await loadData();
    } catch (err: any) {
      console.error(err);
      alert(`Sync pull failed: ${err.message || err}`);
    } finally {
      setIsPulling(false);
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

    authenticateToken().then(t => {
      logAuditEvent(t, folderId, {
        timestamp: now,
        actor: senderName,
        action: 'UPDATE_STAGE',
        entityId: `Contact_${contact.id}`,
        details: `Advanced stage from "${contact.stage}" to "${nextStage}" for ${contact.name} [${contact.accountNumber}]`,
      }).then(() => {
        const cachedAudit = localStorage.getItem('biscuit_crm_audit_sheet_id');
        if (cachedAudit) setAuditSheetId(cachedAudit);
      });
    }).catch(console.warn);

    await loadData();
    if (selectedDealForDrawer?.id === contact.id) {
      setSelectedDealForDrawer({ ...contact, stage: nextStage, updatedAt: now });
    }
    triggerDebouncedSync();
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

      logAuditEvent(activeToken, folderId, {
        timestamp: new Date().toISOString(),
        actor: senderName,
        action: 'SCHEDULE_MILESTONE',
        entityId: `Calendar_${eventId}`,
        details: `Created project milestone "${newTask.title}" for ${newTask.companyName}`,
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

  const handleSaveCustomTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateForm.title || !newTemplateForm.body) return;

    await db.templates.add({
      templateKey: `custom_${Date.now()}`,
      category: newTemplateForm.category,
      title: newTemplateForm.title,
      subject: newTemplateForm.subject,
      body: newTemplateForm.body,
      updatedAt: new Date().toISOString(),
    });

    setNewTemplateForm({ title: '', category: 'Custom', subject: '', body: '' });
    setIsNewTemplateModalOpen(false);
    await loadData();
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
      billingAddress: item.address_snippet || '',
    });
    setSearchResults([]);
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.name || !newContact.email) return;

    const assignedAcc = newContact.accountNumber || `ACC-${Math.floor(10000 + Math.random() * 90000)}`;

    const newId = await db.contacts.add({
      ...newContact,
      accountNumber: assignedAcc,
      synced: false,
      updatedAt: new Date().toISOString(),
    });

    await db.outbox.add({
      type: 'INSERT',
      table: 'contacts',
      payload: { ...newContact, accountNumber: assignedAcc },
      timestamp: Date.now(),
    });

    authenticateToken().then(t => {
      logAuditEvent(t, folderId, {
        timestamp: new Date().toISOString(),
        actor: senderName,
        action: 'CREATE_CONTACT',
        entityId: `Contact_${newId}`,
        details: `Intake customer ${newContact.name} [Account No: ${assignedAcc}]`,
      }).then(() => {
        const cachedAudit = localStorage.getItem('biscuit_crm_audit_sheet_id');
        if (cachedAudit) setAuditSheetId(cachedAudit);
      });
    }).catch(console.warn);

    setIsModalOpen(false);
    await loadData();
    triggerDebouncedSync();
  };

  const handleCopyTemplate = (tpl: { id: string; body: string }) => {
    const populated = replaceTokens(tpl.body, {
      account_number: selectedContactForTemplate?.accountNumber,
      contact_name: selectedContactForTemplate?.name,
      company: selectedContactForTemplate?.company,
      crn: selectedContactForTemplate?.crn,
      stage: selectedContactForTemplate?.stage,
      sender_name: senderName,
    });
    navigator.clipboard.writeText(populated);
    setCopiedId(tpl.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenInGmail = (tpl: { subject?: string; body: string }) => {
    const recipient = selectedContactForTemplate?.email || '';
    const subject = encodeURIComponent(replaceTokens(tpl.subject || '', {
      account_number: selectedContactForTemplate?.accountNumber,
      contact_name: selectedContactForTemplate?.name,
      company: selectedContactForTemplate?.company,
      crn: selectedContactForTemplate?.crn,
      sender_name: senderName,
    }));
    const body = encodeURIComponent(replaceTokens(tpl.body, {
      account_number: selectedContactForTemplate?.accountNumber,
      contact_name: selectedContactForTemplate?.name,
      company: selectedContactForTemplate?.company,
      crn: selectedContactForTemplate?.crn,
      stage: selectedContactForTemplate?.stage,
      sender_name: senderName,
    }));

    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${recipient}&su=${subject}&body=${body}`, '_blank');
  };

  const allTemplates = [
    ...DEFAULT_TEMPLATES,
    ...customTemplates.map(t => ({
      id: `stored_${t.id}`,
      category: t.category,
      title: t.title,
      subject: t.subject,
      body: t.body,
      isCustom: true,
    })),
  ];

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
          <button
            onClick={() => setIsCommandOpen(true)}
            className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-lg text-xs text-slate-400 transition"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Search & Actions</span>
            <kbd className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">⌘K</kbd>
          </button>

          {/* Navigation Bar */}
          <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition ${viewMode === 'kanban' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Pipeline Board
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition ${viewMode === 'table' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <List className="w-3.5 h-3.5" /> Table View
            </button>
            <button
              onClick={() => setViewMode('gantt')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition ${viewMode === 'gantt' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <CalendarIcon className="w-3.5 h-3.5" /> Gantt & Milestones
            </button>
            <button
              onClick={() => setViewMode('templates')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition ${viewMode === 'templates' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <BookOpen className="w-3.5 h-3.5" /> Template Vault
            </button>
            <button
              onClick={() => setViewMode('hub')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition ${viewMode === 'hub' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Users className="w-3.5 h-3.5" /> Employee Hub
            </button>
          </div>

          <button
            onClick={() => setIsHealthOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            System Live
          </button>
        </div>
      </header>

      {/* Persistence Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 flex items-center justify-between mb-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-100">Live Workspace Persistence Link</h3>
              
              {isSyncing ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Auto-syncing to Sheets...
                </span>
              ) : !isOnline ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/30">
                  <CloudOff className="w-3 h-3" /> Offline (Queued)
                </span>
              ) : hasUnsynced ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Outbox Queued
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" /> All changes saved
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <FolderCheck className="w-3.5 h-3.5 text-emerald-400" />
              Drive Root Folder ID: <code className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono text-[11px]">{folderId}</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {contacts.length === 0 && (
            <button
              onClick={handlePullFromSheets}
              disabled={isPulling}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-lg text-xs transition shadow-md shadow-emerald-600/20"
            >
              <DownloadCloud className={`w-3.5 h-3.5 ${isPulling ? 'animate-spin' : ''}`} />
              Pull from Sheets
            </button>
          )}

          {hasUnsynced && (
            <button
              onClick={() => handleSyncToSheets(false)}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 transition"
              title="Force manual sync now"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              Force Sync Now
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

          {auditSheetId && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${auditSheetId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:underline px-2 py-1 bg-indigo-500/5 rounded border border-indigo-500/10"
            >
              Drive Audit Ledger <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {viewMode === 'gantt' && (
            <button
              onClick={() => setIsTaskModalOpen(true)}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2 rounded-lg text-xs transition shadow-md shadow-amber-500/10"
            >
              <Plus className="w-3.5 h-3.5" /> New Calendar Milestone
            </button>
          )}

          {viewMode === 'templates' && (
            <button
              onClick={() => setIsNewTemplateModalOpen(true)}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2 rounded-lg text-xs transition shadow-md shadow-amber-500/10"
            >
              <Plus className="w-3.5 h-3.5" /> Create New Template
            </button>
          )}

          {(viewMode === 'kanban' || viewMode === 'table') && (
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2 rounded-lg text-xs transition shadow-md shadow-amber-500/10"
            >
              <Plus className="w-3.5 h-3.5" /> Add Customer Account
            </button>
          )}
        </div>
      </div>

      {/* View 1: Employee Hub */}
      {viewMode === 'hub' && (
        <EmployeeHub
          currentRepName={senderName}
          contacts={contacts}
          onRepNameChange={handleUpdateSenderName}
          onAdvanceContactStage={advanceStage}
        />
      )}

      {/* View 2: Kanban Pipeline */}
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
                    <div 
                      key={c.id} 
                      onClick={() => setSelectedDealForDrawer(c)}
                      className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/90 hover:border-amber-500/70 transition shadow-sm space-y-2.5 cursor-pointer group"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-slate-100 text-sm leading-tight group-hover:text-amber-400 transition-colors flex items-center gap-1.5">
                            <span>{c.name}</span>
                            <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-amber-400 transition-opacity" />
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{c.company || 'Private Account'}</div>
                        </div>
                        {c.synced ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-400" title="Synced to Sheets" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Outbox Queue" />
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded font-semibold">
                          {c.accountNumber}
                        </span>
                        {c.crn && (
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">
                            CRN: {c.crn}
                          </span>
                        )}
                      </div>

                      {c.accountManager && (
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-amber-400" />
                          <span>{c.accountManager}</span>
                        </div>
                      )}

                      <div className="text-[11px] text-slate-400 truncate">{c.email}</div>

                      <div className="pt-1 flex items-center justify-between border-t border-slate-800/60">
                        <span className="text-[10px] font-medium text-amber-400/80 hover:text-amber-300">
                          View History & Details →
                        </span>
                      </div>

                      {!isLastCol && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            advanceStage(c);
                          }}
                          className="w-full mt-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700/60 transition"
                        >
                          <span>Move Next</span>
                          <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
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

      {/* View 3: Table View */}
      {viewMode === 'table' && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold text-slate-200 text-sm">All Customer Accounts</h2>
            <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full">{contacts.length} Records</span>
          </div>
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-3">Account No</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Company & CRN</th>
                <th className="px-6 py-3">Account Manager</th>
                <th className="px-6 py-3">Stage</th>
                <th className="px-6 py-3">Sync Status</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {contacts.map((c) => (
                <tr 
                  key={c.id} 
                  onClick={() => setSelectedDealForDrawer(c)}
                  className="hover:bg-slate-800/30 cursor-pointer"
                >
                  <td className="px-6 py-4 font-mono text-emerald-400 font-semibold text-xs">
                    {c.accountNumber}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-100 hover:text-amber-400">{c.name}</div>
                    <div className="text-xs text-slate-400">{c.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div>{c.company || '—'}</div>
                    {c.crn && <span className="text-xs font-mono text-slate-400">CRN: {c.crn}</span>}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-slate-300">{c.accountManager || 'Unassigned'}</span>
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
                      onClick={(e) => {
                        e.stopPropagation();
                        advanceStage(c);
                      }}
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

      {/* View 4: Gantt View */}
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

      {/* View 5: Template Vault */}
      {viewMode === 'templates' && (
        <section className="space-y-6 mb-8">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-bold text-slate-100 text-base flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-400" /> Standardized Template & Battlecard Vault
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically substitute pipeline tokens with live customer account numbers
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5">
                <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs text-slate-400">Rep / Sender:</span>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => handleUpdateSenderName(e.target.value)}
                  className="bg-transparent text-xs text-slate-100 focus:outline-none w-32 border-b border-dashed border-slate-700 focus:border-amber-400"
                  placeholder="Your Name"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Inject Customer:</span>
                <select
                  value={selectedContactForTemplate?.id || ''}
                  onChange={(e) => {
                    const target = contacts.find(c => c.id === Number(e.target.value));
                    if (target) setSelectedContactForTemplate(target);
                  }}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{c.accountNumber}] {c.name} {c.company ? `(${c.company})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {allTemplates.map((tpl) => {
              const populatedBody = replaceTokens(tpl.body, {
                account_number: selectedContactForTemplate?.accountNumber,
                contact_name: selectedContactForTemplate?.name,
                company: selectedContactForTemplate?.company,
                crn: selectedContactForTemplate?.crn,
                stage: selectedContactForTemplate?.stage,
                sender_name: senderName,
              });

              return (
                <div key={tpl.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col justify-between shadow-sm">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded border ${
                        tpl.isCustom 
                          ? 'border-indigo-500/30 text-indigo-400 bg-indigo-500/10' 
                          : 'border-amber-500/20 text-amber-400 bg-amber-500/10'
                      }`}>
                        {tpl.category}
                      </span>
                      {tpl.isCustom && <span className="text-[10px] text-slate-500 font-mono">Custom</span>}
                    </div>
                    <h3 className="font-semibold text-slate-100 text-sm mb-3">{tpl.title}</h3>

                    <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto mb-4">
                      {populatedBody}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
                    <button
                      onClick={() => handleCopyTemplate(tpl)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
                    >
                      {copiedId === tpl.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy Script
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleOpenInGmail(tpl)}
                      className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
                      title="Open draft in Gmail"
                    >
                      <Mail className="w-3.5 h-3.5" /> Gmail Draft
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Slide-Over Deal Detail & History Drawer */}
      <DealDetailDrawer
        contact={selectedDealForDrawer}
        isOpen={Boolean(selectedDealForDrawer)}
        onClose={() => setSelectedDealForDrawer(null)}
        onAdvanceStage={advanceStage}
        onContactUpdated={() => {
          loadData();
          triggerDebouncedSync();
        }}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        contacts={contacts}
        onSelectView={(mode) => setViewMode(mode)}
        onOpenNewContact={handleOpenAddModal}
        onOpenNewMilestone={() => setIsTaskModalOpen(true)}
        onOpenNewTemplate={() => setIsNewTemplateModalOpen(true)}
      />

      {/* Health Diagnostic Wizard */}
      <HealthWizard
        isOpen={isHealthOpen}
        onClose={() => setIsHealthOpen(false)}
        folderId={folderId}
      />

      {/* Modal: Add Customer Account */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div>
                <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-amber-400" /> Add Customer Account
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Assigned Account Reference: <span className="font-mono text-emerald-400 font-semibold">{newContact.accountNumber}</span>
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>

            <div className="mb-4 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Optional: UK Companies House Autofill (If Business Customer)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search registered UK company name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 flex-1 focus:outline-none focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={searchCompaniesHouse}
                  disabled={isSearching}
                  className="bg-sky-600 hover:bg-sky-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5"
                >
                  {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Autofill
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-2 space-y-1">
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
            </div>

            <form onSubmit={handleCreateContact} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Account Number</label>
                  <input
                    type="text"
                    value={newContact.accountNumber}
                    onChange={(e) => setNewContact({ ...newContact, accountNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-emerald-400 font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Customer Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. David Clarke"
                    value={newContact.name}
                    onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Company (Optional)</label>
                  <input
                    type="text"
                    placeholder="Leave blank if retail customer"
                    value={newContact.company}
                    onChange={(e) => setNewContact({ ...newContact, company: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Company CRN (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 12849501"
                    value={newContact.crn}
                    onChange={(e) => setNewContact({ ...newContact, crn: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+44 20 7946 0912"
                    value={newContact.phone}
                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Account Manager</label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Jenkins"
                  value={newContact.accountManager}
                  onChange={(e) => setNewContact({ ...newContact, accountManager: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Billing Address</label>
                  <textarea
                    rows={2}
                    placeholder="Registered billing address"
                    value={newContact.billingAddress}
                    onChange={(e) => setNewContact({ ...newContact, billingAddress: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Shipping / Delivery Address</label>
                  <textarea
                    rows={2}
                    placeholder="Physical fulfillment destination"
                    value={newContact.shippingAddress}
                    onChange={(e) => setNewContact({ ...newContact, shippingAddress: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-100"
                  />
                </div>
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
                  Save Customer Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
