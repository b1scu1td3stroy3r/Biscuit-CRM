'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ShieldCheck, Zap, Database, Building2, Calendar as CalendarIcon, 
  FileText, CheckCircle2, Loader2, FolderCheck, Plus, Search, 
  RefreshCw, ExternalLink, ChevronRight, ChevronLeft, ArrowRight, LayoutGrid, List, Clock,
  BookOpen, Copy, Mail, Check, UserCheck, Activity, DownloadCloud, Eye, MapPin,
  Cloud, CloudOff, Hash, Users, Download, FileSpreadsheet, AlertTriangle, AlertCircle, Timer,
  Target, RotateCcw, Laptop, Briefcase, HeartHandshake, Megaphone, Wrench, PoundSterling, Crown,
  Lock
} from 'lucide-react';
import { db, Contact, ProjectTask, StoredTemplate, AuditRecord, DepartmentRole } from '../packages/storage/src/db';
import { syncOutboxToGoogleSheets, pullContactsFromGoogleSheet } from '../packages/storage/src/sheetsSync';
import { syncTaskToGoogleCalendar } from '../packages/storage/src/calendarSync';
import { logAuditEvent } from '../packages/storage/src/auditLogger';
import { exportPipelineToCSV, exportAuditLogsToCSV } from '../packages/storage/src/exportUtils';
import { DEFAULT_TEMPLATES, replaceTokens, TemplateItem } from '../packages/templates/src/templates';
import CommandPalette from '../components/CommandPalette';
import HealthWizard from '../components/HealthWizard';
import DealDetailDrawer from '../components/DealDetailDrawer';
import EmployeeHub from '../components/EmployeeHub';
import FinanceDesk from '../components/FinanceDesk';

declare global {
  interface Window {
    google?: any;
    gapi?: any;
  }
}

type ViewTabType = 'kanban' | 'table' | 'gantt' | 'templates' | 'hub' | 'finance';

const DEPARTMENT_CONFIG: Record<DepartmentRole, { label: string; icon: any; color: string; defaultTab: ViewTabType; allowedTabs: ViewTabType[] }> = {
  MD: { 
    label: 'Managing Director (Executive All-Access)', 
    icon: Crown, 
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/30', 
    defaultTab: 'kanban',
    allowedTabs: ['kanban', 'table', 'gantt', 'templates', 'hub', 'finance']
  },
  Sales: { 
    label: 'Sales & Commercial', 
    icon: Briefcase, 
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', 
    defaultTab: 'kanban',
    allowedTabs: ['kanban', 'templates']
  },
  Operations: { 
    label: 'Operations & Logistics', 
    icon: Wrench, 
    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', 
    defaultTab: 'gantt',
    allowedTabs: ['gantt']
  },
  HR: { 
    label: 'People & HR', 
    icon: HeartHandshake, 
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', 
    defaultTab: 'hub',
    allowedTabs: ['hub']
  },
  Marketing: { 
    label: 'Growth & Marketing', 
    icon: Megaphone, 
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', 
    defaultTab: 'templates',
    allowedTabs: ['templates']
  },
  IT: { 
    label: 'IT & Infrastructure', 
    icon: Laptop, 
    color: 'text-sky-400 bg-sky-500/10 border-sky-500/20', 
    defaultTab: 'table',
    allowedTabs: ['table']
  },
  Finance: { 
    label: 'Finance & Invoicing', 
    icon: PoundSterling, 
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', 
    defaultTab: 'finance',
    allowedTabs: ['finance', 'table']
  },
};

const PIPELINE_STAGES = [
  { key: 'Prospect', label: '0. Cold Prospects', desc: 'Target list for cold calling (never bought)', color: 'border-slate-500/40 text-slate-300 bg-slate-500/10' },
  { key: 'Lead', label: '1. Inbound Leads', desc: 'Qualified form submissions & warm intros', color: 'border-amber-500/40 text-amber-400 bg-amber-500/10' },
  { key: 'Sales', label: '2. Active Sales', desc: 'Discovery, demos & commercial negotiation', color: 'border-sky-500/40 text-sky-400 bg-sky-500/10' },
  { key: 'Procurement', label: '3. Procurement', desc: 'Legal agreements & vendor quotes', color: 'border-purple-500/40 text-purple-400 bg-purple-500/10' },
  { key: 'Logistics', label: '4. Logistics', desc: 'Dispatch SLA & delivery fulfillment', color: 'border-indigo-500/40 text-indigo-400 bg-indigo-500/10' },
  { key: 'Customer Service', label: '5. Retention / CS', desc: 'Onboarding follow-up & active support', color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' },
  { key: 'Winback', label: '6. Win-Backs', desc: 'Cold deals or inactive > 12 months', color: 'border-rose-500/40 text-rose-400 bg-rose-500/10' },
] as const;

type StageType = typeof PIPELINE_STAGES[number]['key'];

interface SLAStatus {
  daysInactive: number;
  level: 'normal' | 'warning' | 'breach';
  badgeLabel: string;
  badgeClass: string;
}

function calculateSLAStatus(contact: Contact): SLAStatus {
  const updated = new Date(contact.updatedAt || Date.now());
  const now = new Date();
  const diffDays = Math.max(0, Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24)));

  let warnDays = 5;
  let breachDays = 10;

  if (contact.stage === 'Prospect') { warnDays = 7; breachDays = 14; }
  else if (contact.stage === 'Lead') { warnDays = 2; breachDays = 4; }
  else if (contact.stage === 'Sales') { warnDays = 4; breachDays = 7; }
  else if (contact.stage === 'Procurement') { warnDays = 5; breachDays = 10; }
  else if (contact.stage === 'Logistics') { warnDays = 3; breachDays = 5; }
  else if (contact.stage === 'Customer Service') { warnDays = 14; breachDays = 30; }
  else if (contact.stage === 'Winback') { warnDays = 30; breachDays = 60; }

  if (diffDays >= breachDays) {
    return {
      daysInactive: diffDays,
      level: 'breach',
      badgeLabel: `${diffDays}d Stalled (SLA Breach)`,
      badgeClass: 'bg-rose-500/15 border-rose-500/40 text-rose-300 animate-pulse',
    };
  }

  if (diffDays >= warnDays) {
    return {
      daysInactive: diffDays,
      level: 'warning',
      badgeLabel: `${diffDays}d Idle (Action Needed)`,
      badgeClass: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
    };
  }

  return {
    daysInactive: diffDays,
    level: 'normal',
    badgeLabel: diffDays === 0 ? 'Active Today' : `${diffDays}d in stage`,
    badgeClass: 'bg-slate-800/80 border-slate-700/80 text-slate-400',
  };
}

function getMilestoneConfigForStage(stage: StageType, companyOrName: string) {
  const today = new Date();
  const format = (d: Date) => d.toISOString().slice(0, 10);

  if (stage === 'Procurement') {
    const end = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
    return {
      title: `Procurement & Supplier Agreement (${companyOrName})`,
      startDate: format(today),
      endDate: format(end),
      progress: 15,
    };
  }

  if (stage === 'Logistics') {
    const end = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000);
    return {
      title: `Logistics Dispatch & Delivery Window (${companyOrName})`,
      startDate: format(today),
      endDate: format(end),
      progress: 40,
    };
  }

  if (stage === 'Customer Service') {
    const end = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    return {
      title: `Post-Onboarding Review & Retention SLA (${companyOrName})`,
      startDate: format(today),
      endDate: format(end),
      progress: 80,
    };
  }

  if (stage === 'Winback') {
    const end = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    return {
      title: `Winback Re-engagement Outreach (${companyOrName})`,
      startDate: format(today),
      endDate: format(end),
      progress: 10,
    };
  }

  return null;
}

export default function Dashboard() {
  const [department, setDepartment] = useState<DepartmentRole>('MD');
  const [token, setToken] = useState<string | null>(null);
  const [folderId] = useState<string>('1WK1GE6vGTuS1KGCC607Jdkcc6464YaST');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [customTemplates, setCustomTemplates] = useState<StoredTemplate[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSyncedSheetId, setLastSyncedSheetId] = useState<string | null>(null);
  const [auditSheetId, setAuditSheetId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewTabType>('kanban');

  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isHealthOpen, setIsHealthOpen] = useState(false);
  const [selectedDealForDrawer, setSelectedDealForDrawer] = useState<Contact | null>(null);

  const [senderName, setSenderName] = useState<string>('Sarah Jenkins');
  const [supervisorEmail, setSupervisorEmail] = useState<string>('sales.lead@biscuitcrm.internal');

  const [regressingContact, setRegressingContact] = useState<Contact | null>(null);
  const [regressionReasonCategory, setRegressionReasonCategory] = useState<string>('Client Requested Timeline Postponement');
  const [regressionNotes, setRegressionNotes] = useState<string>('');
  const [isRegressing, setIsRegressing] = useState(false);
  const [postRegressionDraft, setPostRegressionDraft] = useState<{
    subject: string;
    body: string;
    recipient: string;
  } | null>(null);

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
    stage: 'Prospect' as StageType,
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
    const storedAudits = await db.auditLogs.toArray();

    setContacts(contactList);
    setTasks(taskList);
    setCustomTemplates(storedTpls);
    setAuditLogs(storedAudits);

    const savedDept = localStorage.getItem('biscuit_crm_user_department') as DepartmentRole;
    if (savedDept && DEPARTMENT_CONFIG[savedDept]) {
      setDepartment(savedDept);
      setViewMode(DEPARTMENT_CONFIG[savedDept].defaultTab);
    }

    const savedSender = localStorage.getItem('biscuit_crm_sender_name');
    if (savedSender) setSenderName(savedSender);

    const savedSupervisor = localStorage.getItem('biscuit_crm_supervisor_email');
    if (savedSupervisor) setSupervisorEmail(savedSupervisor);

    if (contactList.length > 0 && !selectedContactForTemplate) {
      setSelectedContactForTemplate(contactList[0]);
    }
    const cachedSheet = localStorage.getItem('biscuit_crm_pipeline_sheet_id');
    if (cachedSheet) setLastSyncedSheetId(cachedSheet);

    const cachedAudit = localStorage.getItem('biscuit_crm_audit_sheet_id');
    if (cachedAudit) setAuditSheetId(cachedAudit);
  };

  const handleSelectDepartment = (dept: DepartmentRole) => {
    setDepartment(dept);
    localStorage.setItem('biscuit_crm_user_department', dept);
    setViewMode(DEPARTMENT_CONFIG[dept].defaultTab);
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

  const handleOpenAddModal = (presetStage?: StageType) => {
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
      stage: presetStage || (department === 'Sales' ? 'Prospect' : 'Lead'),
    });
    setIsModalOpen(true);
  };

  const handleUpdateSenderName = (name: string) => {
    setSenderName(name);
    localStorage.setItem('biscuit_crm_sender_name', name);
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

    try {
      const allProfiles = await db.employees.toArray();
      const profile = allProfiles.find(p => p.name.toLowerCase() === senderName.toLowerCase());
      if (profile && profile.id) {
        const updatedXP = profile.xp + 50;
        const updatedLevel = Math.floor(updatedXP / 250) + 1;
        await db.employees.update(profile.id, { xp: updatedXP, level: updatedLevel });
      }
    } catch (xpErr) {
      console.warn('Could not increment XP on stage advance:', xpErr);
    }

    const milestoneConfig = getMilestoneConfigForStage(nextStage, contact.company || contact.name);

    authenticateToken().then(async (t) => {
      let createdEventId: string | undefined;

      if (milestoneConfig) {
        try {
          createdEventId = await syncTaskToGoogleCalendar(t, {
            title: milestoneConfig.title,
            companyName: contact.company || contact.name,
            startDate: milestoneConfig.startDate,
            endDate: milestoneConfig.endDate,
            progress: milestoneConfig.progress,
            synced: true,
            updatedAt: now,
          });

          await db.projects.add({
            title: milestoneConfig.title,
            companyName: contact.company || contact.name,
            startDate: milestoneConfig.startDate,
            endDate: milestoneConfig.endDate,
            progress: milestoneConfig.progress,
            calendarEventId: createdEventId,
            synced: true,
            updatedAt: now,
          });
        } catch (calErr) {
          console.warn('Milestone calendar auto-creation deferred:', calErr);
        }
      }

      await logAuditEvent(t, folderId, {
        timestamp: now,
        actor: senderName,
        action: 'UPDATE_STAGE',
        entityId: `Contact_${contact.id}`,
        details: `Advanced stage to "${nextStage}" for ${contact.name} [${contact.accountNumber}]${
          milestoneConfig ? ` & auto-scheduled GCal delivery milestone "${milestoneConfig.title}"` : ''
        }`,
      });

      const cachedAudit = localStorage.getItem('biscuit_crm_audit_sheet_id');
      if (cachedAudit) setAuditSheetId(cachedAudit);
    }).catch(console.warn);

    await loadData();
    if (selectedDealForDrawer?.id === contact.id) {
      setSelectedDealForDrawer({ ...contact, stage: nextStage, updatedAt: now });
    }
    triggerDebouncedSync();
  };

  const initiateStageRegression = (contact: Contact) => {
    setRegressingContact(contact);
    setRegressionReasonCategory('Client Requested Timeline Postponement');
    setRegressionNotes('');
    setPostRegressionDraft(null);
  };

  const handleConfirmRegression = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regressingContact || !regressingContact.id) return;
    setIsRegressing(true);

    try {
      const currentIndex = PIPELINE_STAGES.findIndex(s => s.key === regressingContact.stage);
      if (currentIndex <= 0) return;

      const previousStage = PIPELINE_STAGES[currentIndex - 1].key;
      const now = new Date().toISOString();
      const dateStr = now.slice(0, 10);

      const regressionEntry = `\n[DEAL REGRESSION ${dateStr}]: Stage reverted from ${regressingContact.stage} back to ${previousStage} by ${senderName}.\nReason Category: ${regressionReasonCategory}\nExplanation: ${regressionNotes}`;
      const updatedInternalNotes = `${regressingContact.internalNotes || ''}${regressionEntry}`;

      await db.contacts.update(regressingContact.id, {
        stage: previousStage,
        internalNotes: updatedInternalNotes,
        synced: false,
        updatedAt: now,
      });

      await db.outbox.add({
        type: 'UPDATE',
        table: 'contacts',
        payload: {
          id: regressingContact.id,
          stage: previousStage,
          internalNotes: updatedInternalNotes,
          updatedAt: now,
        },
        timestamp: Date.now(),
      });

      const assignedRep = regressingContact.accountManager || senderName;
      const emailSubject = `[URGENT DEAL REGRESSION] ${regressingContact.name} (${regressingContact.company || 'Retail'}) [Ref: ${regressingContact.accountNumber}]`;
      const emailBody = 
        `ATTENTION: DEAL REGRESSION NOTIFICATION\n\n` +
        `This is an automated operational alert. The following customer deal has been moved backwards in the pipeline.\n\n` +
        `CUSTOMER RECORD:\n` +
        `• Account Reference: ${regressingContact.accountNumber}\n` +
        `• Customer Name: ${regressingContact.name}\n` +
        `• Company: ${regressingContact.company || 'Private'}${regressingContact.crn ? ` (CRN: ${regressingContact.crn})` : ''}\n` +
        `• Previous Stage: ${regressingContact.stage}\n` +
        `• Reverted Stage: ${previousStage}\n` +
        `• Assigned Manager: ${assignedRep}\n` +
        `• Regression Initiated By: ${senderName}\n\n` +
        `REASON CATEGORY:\n` +
        `${regressionReasonCategory}\n\n` +
        `DETAILED EXPLANATION:\n` +
        `${regressionNotes}\n\n` +
        `The master ledger on Google Drive and local audit logs have recorded this regression.\n` +
        `Please review the account notes and re-engage if necessary.`;

      setPostRegressionDraft({
        subject: emailSubject,
        body: emailBody,
        recipient: `${supervisorEmail}`,
      });

      authenticateToken().then(async (t) => {
        await logAuditEvent(t, folderId, {
          timestamp: now,
          actor: senderName,
          action: 'UPDATE_STAGE',
          entityId: `Contact_${regressingContact.id}`,
          details: `Reverted stage backward from "${regressingContact.stage}" to "${previousStage}" for ${regressingContact.name} [${regressingContact.accountNumber}]. Reason: ${regressionReasonCategory} - ${regressionNotes}`,
        });
        const cachedAudit = localStorage.getItem('biscuit_crm_audit_sheet_id');
        if (cachedAudit) setAuditSheetId(cachedAudit);
      }).catch(console.warn);

      await loadData();
      triggerDebouncedSync();
    } finally {
      setIsRegressing(false);
    }
  };

  const handleDispatchRegressionAlert = () => {
    if (!postRegressionDraft) return;
    const recipient = encodeURIComponent(postRegressionDraft.recipient);
    const subject = encodeURIComponent(postRegressionDraft.subject);
    const body = encodeURIComponent(postRegressionDraft.body);
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${recipient}&su=${subject}&body=${body}`, '_blank');
    setRegressingContact(null);
    setPostRegressionDraft(null);
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
        details: `Intake customer ${newContact.name} [Account No: ${assignedAcc}] into "${newContact.stage}"`,
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
  const CurrentDeptIcon = DEPARTMENT_CONFIG[department].icon;
  const isMD = department === 'MD';
  const allowedTabs = DEPARTMENT_CONFIG[department].allowedTabs;

  return (
    <main className="max-w-[1540px] mx-auto px-6 py-8">
      {/* Top Header & RBAC Identity Bar */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-800 pb-5 mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
              <span>🍪</span> Biscuit CRM
            </h1>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${DEPARTMENT_CONFIG[department].color}`}>
              <CurrentDeptIcon className="w-3.5 h-3.5" />
              {DEPARTMENT_CONFIG[department].label}
            </span>
            {!isMD && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                <Lock className="w-2.5 h-2.5 text-slate-500" /> Screen Locked
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Role-Tailored Zero-Storage Operating System</p>
        </div>

        {/* Managing Director Full Persona Switcher (Locked & Hidden from regular personnel) */}
        {isMD ? (
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-amber-500/30">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider px-2">MD Superuser:</span>
            {(['MD', 'Sales', 'Operations', 'Finance', 'HR', 'Marketing', 'IT'] as DepartmentRole[]).map((dept) => {
              const isSelected = department === dept;
              const Icon = DEPARTMENT_CONFIG[dept].icon;

              return (
                <button
                  key={dept}
                  onClick={() => handleSelectDepartment(dept)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {dept}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSelectDepartment('MD')}
              className="text-[11px] text-slate-500 hover:text-amber-400 transition flex items-center gap-1"
            >
              <Crown className="w-3 h-3" /> Switch to MD Login
            </button>
          </div>
        )}

        {/* Global Shortcuts */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCommandOpen(true)}
            className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-lg text-xs text-slate-400 transition"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Search & Actions</span>
            <kbd className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">⌘K</kbd>
          </button>

          <button
            onClick={() => setIsHealthOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            System Live
          </button>
        </div>
      </header>

      {/* Role-Gated Navigation Tab Bar */}
      <div className="flex bg-slate-900/90 border border-slate-800 rounded-xl p-1 gap-1 mb-6 shadow-sm overflow-x-auto">
        {(isMD || allowedTabs.includes('kanban')) && (
          <button
            onClick={() => setViewMode('kanban')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition ${viewMode === 'kanban' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Pipeline Board
          </button>
        )}

        {(isMD || allowedTabs.includes('finance')) && (
          <button
            onClick={() => setViewMode('finance')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition ${viewMode === 'finance' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <PoundSterling className="w-3.5 h-3.5 text-emerald-400" /> Finance & Billing Desk
            {department === 'Finance' && <span className="text-[10px] bg-slate-950 text-emerald-300 px-1.5 py-0.5 rounded ml-1">Finance</span>}
          </button>
        )}

        {(isMD || allowedTabs.includes('table')) && (
          <button
            onClick={() => setViewMode('table')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition ${viewMode === 'table' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <List className="w-3.5 h-3.5" /> Table View ({contacts.length})
          </button>
        )}

        {(isMD || allowedTabs.includes('gantt')) && (
          <button
            onClick={() => setViewMode('gantt')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition ${viewMode === 'gantt' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <CalendarIcon className="w-3.5 h-3.5" /> Gantt & Milestones ({tasks.length})
          </button>
        )}

        {(isMD || allowedTabs.includes('templates')) && (
          <button
            onClick={() => setViewMode('templates')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition ${viewMode === 'templates' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <BookOpen className="w-3.5 h-3.5" /> Template Vault
          </button>
        )}

        {(isMD || allowedTabs.includes('hub')) && (
          <button
            onClick={() => setViewMode('hub')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition ${viewMode === 'hub' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Users className="w-3.5 h-3.5" /> Employee Hub & Leave
          </button>
        )}
      </div>

      {/* Role-Specific Action Banner */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg border ${DEPARTMENT_CONFIG[department].color}`}>
            <CurrentDeptIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-200">
              {department === 'MD' && 'Executive Master Console — Full unconstrained visibility across all 7 operational departments'}
              {department === 'Finance' && 'Finance & Invoicing Center — Client remittance schedules, VAT records & contract valuations'}
              {department === 'Sales' && 'Commercial Funnel Active — Inbound leads, prospect outreach & deal velocity'}
              {department === 'Operations' && 'Operations Desk — Active SLA fulfillment, supplier delivery windows & calendar sync'}
              {department === 'HR' && 'People & HR Center — Employee XP progression, deal delegations & 28-day statutory leave tracking'}
              {department === 'Marketing' && 'Marketing Hub — Outbound battlecard templates, cold email hooks & messaging playbooks'}
              {department === 'IT' && 'IT Systems & Architecture — Google Drive persistence, Dexie sync mutations & audit logs'}
            </h3>
            <p className="text-[11px] text-slate-400">
              Active User: <span className="text-slate-200 font-semibold">{senderName}</span> &bull; Storage: <span className="text-emerald-400 font-mono">100% Client-Side Local First</span>
            </p>
          </div>
        </div>

        {/* Tailored Quick Actions */}
        <div className="flex items-center gap-2">
          {(department === 'Sales' || department === 'MD') && (
            <button
              onClick={() => handleOpenAddModal('Prospect')}
              className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-3 py-1.5 rounded-lg text-xs transition"
            >
              <Plus className="w-3.5 h-3.5" /> New Prospect Account
            </button>
          )}

          {department === 'Finance' && (
            <button
              onClick={() => exportPipelineToCSV(contacts)}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Export Billing Register
            </button>
          )}

          {(department === 'Operations' || department === 'MD') && (
            <button
              onClick={() => setIsTaskModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition"
            >
              <Plus className="w-3.5 h-3.5" /> Schedule Delivery Milestone
            </button>
          )}

          {(department === 'IT' || department === 'MD') && (
            <div className="flex gap-2">
              <button
                onClick={() => handleSyncToSheets(false)}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} /> Flush Outbox to Drive
              </button>
              <button
                onClick={() => exportAuditLogsToCSV(auditLogs)}
                className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-3 py-1.5 rounded-lg text-xs border border-slate-700 transition"
              >
                <Download className="w-3.5 h-3.5 text-indigo-400" /> Export Audit Trail
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Screen 1: Finance Desk */}
      {viewMode === 'finance' && (isMD || allowedTabs.includes('finance')) && (
        <FinanceDesk
          contacts={contacts}
          onContactUpdated={() => {
            loadData();
            triggerDebouncedSync();
          }}
          currentUser={senderName}
        />
      )}

      {/* Screen 2: Employee Hub */}
      {viewMode === 'hub' && (isMD || allowedTabs.includes('hub')) && (
        <EmployeeHub
          currentRepName={senderName}
          contacts={contacts}
          onRepNameChange={handleUpdateSenderName}
          onAdvanceContactStage={advanceStage}
          onAuthenticateGoogle={authenticateToken}
        />
      )}

      {/* Screen 3: 7-Stage Extended Kanban Board */}
      {viewMode === 'kanban' && (isMD || allowedTabs.includes('kanban')) && (
        <section className="grid grid-cols-1 md:grid-cols-7 gap-3 mb-8">
          {PIPELINE_STAGES.map((col, idx) => {
            const colContacts = contacts.filter(c => c.stage === col.key);
            const isFirstCol = idx === 0;
            const isLastCol = idx === PIPELINE_STAGES.length - 1;

            return (
              <div key={col.key} className="rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 flex flex-col min-h-[500px]">
                <div className="pb-2.5 border-b border-slate-800/80 mb-2.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${col.color}`}>
                      {col.label}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">{colContacts.length}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 leading-tight">{col.desc}</p>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto">
                  {colContacts.map(c => {
                    const sla = calculateSLAStatus(c);

                    return (
                      <div 
                        key={c.id} 
                        onClick={() => setSelectedDealForDrawer(c)}
                        className={`p-3 rounded-lg border transition shadow-sm space-y-2 cursor-pointer group ${
                          sla.level === 'breach'
                            ? 'bg-rose-950/20 border-rose-500/60 hover:border-rose-400'
                            : sla.level === 'warning'
                            ? 'bg-amber-950/20 border-amber-500/50 hover:border-amber-400'
                            : 'border-slate-800 bg-slate-900/90 hover:border-amber-500/70'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-semibold text-slate-100 text-xs leading-tight group-hover:text-amber-400 transition-colors flex items-center gap-1">
                              <span>{c.name}</span>
                              <Eye className="w-3 h-3 opacity-0 group-hover:opacity-100 text-amber-400 transition-opacity" />
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[140px]">{c.company || 'Private Account'}</div>
                          </div>
                          {c.synced ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Synced" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="Outbox Queued" />
                          )}
                        </div>

                        {/* SLA Inactivity Status Badge */}
                        <div className="pt-0.5">
                          <span className={`inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded border ${sla.badgeClass}`}>
                            {sla.level === 'breach' ? (
                              <AlertCircle className="w-2.5 h-2.5 text-rose-400" />
                            ) : sla.level === 'warning' ? (
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                            ) : (
                              <Timer className="w-2.5 h-2.5 text-slate-400" />
                            )}
                            {sla.badgeLabel}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded font-semibold">
                            {c.accountNumber}
                          </span>
                          {c.crn && (
                            <span className="text-[9px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-1 py-0.5 rounded">
                              CRN:{c.crn}
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] text-slate-400 truncate">{c.email}</div>

                        {/* Directional Controls */}
                        <div className="flex items-center gap-1 pt-1 border-t border-slate-800/60">
                          {!isFirstCol && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                initiateStageRegression(c);
                              }}
                              className="p-1 text-[10px] bg-slate-800 hover:bg-rose-950/50 hover:text-rose-300 text-slate-400 rounded border border-slate-700/60 transition"
                              title="Revert stage"
                            >
                              <ChevronLeft className="w-3 h-3 text-rose-400" />
                            </button>
                          )}

                          {!isLastCol && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                advanceStage(c);
                              }}
                              className="flex-1 inline-flex items-center justify-center gap-1 text-[10px] font-medium py-1 px-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700/60 hover:border-amber-500/40 transition"
                            >
                              <span>Next</span>
                              <ChevronRight className="w-3 h-3 text-amber-400" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {colContacts.length === 0 && (
                    <div className="h-24 border border-dashed border-slate-800/80 rounded-lg flex items-center justify-center text-[10px] text-slate-600">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Screen 4: Table View */}
      {viewMode === 'table' && (isMD || allowedTabs.includes('table')) && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-200 text-sm">All Customer Accounts</h2>
              <p className="text-xs text-slate-400 mt-0.5">Primary pipeline dataset across all 7 lifecycle stages</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => exportPipelineToCSV(contacts)}
                disabled={contacts.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-md shadow-emerald-600/20"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Export Pipeline CSV
              </button>
              <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full">{contacts.length} Records</span>
            </div>
          </div>
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-3">Account No</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Company & CRN</th>
                <th className="px-6 py-3">Account Manager</th>
                <th className="px-6 py-3">Stage</th>
                <th className="px-6 py-3">SLA Status</th>
                <th className="px-6 py-3">Sync Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {contacts.map((c) => {
                const isFirstCol = c.stage === 'Prospect';
                const sla = calculateSLAStatus(c);

                return (
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
                      <span className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded border ${sla.badgeClass}`}>
                        {sla.badgeLabel}
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
                    <td className="px-6 py-4 text-right space-x-2">
                      {!isFirstCol && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            initiateStageRegression(c);
                          }}
                          className="inline-flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300"
                        >
                          <ChevronLeft className="w-3 h-3" /> Revert
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          advanceStage(c);
                        }}
                        className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
                      >
                        Advance <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* Screen 5: Gantt View */}
      {viewMode === 'gantt' && (isMD || allowedTabs.includes('gantt')) && (
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
              No milestones scheduled yet. Advance a deal or schedule delivery phases.
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

      {/* Screen 6: Template Vault */}
      {viewMode === 'templates' && (isMD || allowedTabs.includes('templates')) && (
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
                <span className="text-xs text-slate-400">Sender:</span>
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

      {/* Mandatory Deal Regression Modal */}
      {regressingContact && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-base">Revert Deal Pipeline Stage</h3>
                  <p className="text-xs text-slate-400">
                    Account: <span className="text-emerald-400 font-mono font-semibold">{regressingContact.accountNumber}</span> &bull; {regressingContact.name} ({regressingContact.company || 'Retail'})
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setRegressingContact(null);
                  setPostRegressionDraft(null);
                }} 
                className="text-slate-400 hover:text-slate-200"
              >✕</button>
            </div>

            {!postRegressionDraft ? (
              <form onSubmit={handleConfirmRegression} className="space-y-4">
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 leading-relaxed">
                  You are moving this deal backward from <strong>{regressingContact.stage}</strong>. Company policy requires an explanation and will prepare an escalation notification to the account manager and supervisor.
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Primary Reason for Delay / Cold Interest
                  </label>
                  <select
                    value={regressionReasonCategory}
                    onChange={(e) => setRegressionReasonCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-400"
                  >
                    <option value="Client Requested Timeline Postponement">Client Requested Timeline Postponement</option>
                    <option value="Budget Freeze / Internal Re-allocation">Budget Freeze / Internal Re-allocation</option>
                    <option value="Procurement / Legal Contract Issues">Procurement / Legal Contract Issues</option>
                    <option value="Key Champion Left the Company">Key Champion Left the Company</option>
                    <option value="Cold Communication / Unresponsive">Cold Communication / Unresponsive</option>
                    <option value="Competitive Threat / Evaluation Reopened">Competitive Threat / Evaluation Reopened</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Mandatory Notes & Nuances for Management
                  </label>
                  <textarea
                    rows={4}
                    value={regressionNotes}
                    onChange={(e) => setRegressionNotes(e.target.value)}
                    placeholder="Describe specific details: e.g. Client CFO requested to defer signature to Q1 due to fiscal year close..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-rose-400"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Supervisor / Escalation Notification Email
                  </label>
                  <input
                    type="email"
                    value={supervisorEmail}
                    onChange={(e) => {
                      setSupervisorEmail(e.target.value);
                      localStorage.setItem('biscuit_crm_supervisor_email', e.target.value);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 font-mono"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setRegressingContact(null)}
                    className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRegressing}
                    className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold px-4 py-2 rounded-lg text-xs transition"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    {isRegressing ? 'Recording Regression...' : 'Confirm Stage Rollback'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300">
                  Stage rollback recorded in Dexie and queued for Google Drive master ledger.
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {postRegressionDraft.body}
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setRegressingContact(null);
                      setPostRegressionDraft(null);
                    }}
                    className="flex-1 py-2 text-xs text-slate-400 hover:text-slate-200 border border-slate-800 rounded-lg"
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    onClick={handleDispatchRegressionAlert}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-lg text-xs transition shadow-md shadow-indigo-600/20"
                  >
                    <Mail className="w-3.5 h-3.5" /> Dispatch Alert in Gmail
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
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
        onOpenNewContact={() => handleOpenAddModal('Prospect')}
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
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Initial Pipeline Stage</label>
                  <select
                    value={newContact.stage}
                    onChange={(e) => setNewContact({ ...newContact, stage: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                  >
                    {PIPELINE_STAGES.map(s => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Customer / Contact Name</label>
                  <input
                    type="text"
                    placeholder="e.g. David Clarke"
                    value={newContact.name}
                    onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Company (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Client Account Ltd"
                    value={newContact.company}
                    onChange={(e) => setNewContact({ ...newContact, company: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
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
