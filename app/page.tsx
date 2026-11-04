'use client';
import { canAccessCloudAndDataSettings } from '../lib/cloudGuard';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ShieldCheck, Zap, Database, Building2, Calendar as CalendarIcon, 
  FileText, CheckCircle2, Loader2, FolderCheck, Plus, Search, 
  RefreshCw, ExternalLink, ChevronRight, ChevronLeft, ArrowRight, LayoutGrid, List, Clock,
  BookOpen, Copy, Mail, Check, UserCheck, Activity, DownloadCloud, Eye, EyeOff, MapPin,
  Cloud, CloudOff, Hash, Users, Download, FileSpreadsheet, AlertTriangle, AlertCircle, Timer,
  Target, RotateCcw, Laptop, Briefcase, HeartHandshake, Megaphone, Wrench, PoundSterling, Crown,
  Lock, Phone, PhoneCall, Upload, Flame, Sparkles, LogOut
} from 'lucide-react';
import { db, Contact, ProjectTask, StoredTemplate, AuditRecord, DepartmentRole, EmployeeProfile, NewsItem } from '../packages/storage/src/db';
import { syncOutboxToGoogleSheets, pullContactsFromGoogleSheet } from '../packages/storage/src/sheetsSync';
import { syncTaskToGoogleCalendar } from '../packages/storage/src/calendarSync';
import { logAuditEvent } from '../packages/storage/src/auditLogger';
import { exportPipelineToCSV, exportAuditLogsToCSV } from '../packages/storage/src/exportUtils';
import { DEFAULT_TEMPLATES, replaceTokens, TemplateItem } from '../packages/templates/src/templates';
import { resolveUserWorkspace, UserWorkspaceConfig } from '../packages/storage/src/workspaceManager';
import CommandPalette from '../components/CommandPalette';
import HealthWizard from '../components/HealthWizard';
import DealDetailDrawer from '../components/DealDetailDrawer';
import EmployeeHub, { computeProgression } from '../components/EmployeeHub';
import FinanceDesk from '../components/FinanceDesk';
import OrgRosterDesk from '../components/OrgRosterDesk';
import TelephonyDesk from '../components/TelephonyDesk';
import MailchimpDesk from '../components/MailchimpDesk';
import DataImportWizard from '../components/DataImportWizard';
import DepartmentNewsfeed from '../components/DepartmentNewsfeed';
import { scopeContactsByOrg } from '../packages/storage/src/orgEngine';
import { OrgStructureType } from '../packages/storage/src/db';

declare global {
  interface Window {
    google?: any;
    gapi?: any;
  }
}

type ViewTabType = 'kanban' | 'table' | 'gantt' | 'templates' | 'hub' | 'finance' | 'roster' | 'telephony' | 'mailchimp' | 'import';

const DEPARTMENT_CONFIG: Record<DepartmentRole, { label: string; icon: any; color: string; defaultTab: ViewTabType; allowedTabs: ViewTabType[] }> = {
  MD: { 
    label: 'Managing Director (Executive All-Access)', 
    icon: Crown, 
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/30', 
    defaultTab: 'kanban',
    allowedTabs: ['kanban', 'table', 'gantt', 'templates', 'hub', 'finance', 'roster', 'telephony', 'mailchimp', 'import']
  },
  Sales: { 
    label: 'Sales & Commercial', 
    icon: Briefcase, 
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', 
    defaultTab: 'kanban',
    allowedTabs: ['kanban', 'telephony', 'templates']
  },
  Operations: { 
    label: 'Operations & CS', 
    icon: Wrench, 
    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', 
    defaultTab: 'gantt',
    allowedTabs: ['gantt', 'telephony', 'table']
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
    defaultTab: 'mailchimp',
    allowedTabs: ['mailchimp', 'telephony', 'templates']
  },
  IT: { 
    label: 'IT & Infrastructure', 
    icon: Laptop, 
    color: 'text-sky-400 bg-sky-500/10 border-sky-500/20', 
    defaultTab: 'table',
    allowedTabs: ['table', 'roster', 'import']
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

export default function Dashboard() {
  const [department, setDepartment] = useState<DepartmentRole>('MD');
  const [token, setToken] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string>('');
  const [workspaceConfig, setWorkspaceConfig] = useState<UserWorkspaceConfig | null>(null);
  const [showDriveDetails, setShowDriveDetails] = useState<boolean>(false);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [customTemplates, setCustomTemplates] = useState<StoredTemplate[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([]);
  const [currentProfile, setCurrentProfile] = useState<EmployeeProfile | null>(null);
  const [orgStructure, setOrgStructure] = useState<OrgStructureType>('Hierarchical');
  const [showEmail, setShowEmail] = useState<boolean>(false);
  const [roster, setRoster] = useState<EmployeeProfile[]>([]);

  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSyncedSheetId, setLastSyncedSheetId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewTabType>('kanban');

  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isHealthOpen, setIsHealthOpen] = useState(false);
  const [selectedDealForDrawer, setSelectedDealForDrawer] = useState<Contact | null>(null);

  const [senderName, setSenderName] = useState<string>('Managing Director');
  const [supervisorEmail, setSupervisorEmail] = useState<string>('');

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

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    companyName: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
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
    dealValue: 0,
  });

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tokenClientRef = useRef<any>(null);

  const SCOPES = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
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
    const roster = await db.employees.toArray();

    setContacts(contactList);
    setTasks(taskList);
    setCustomTemplates(storedTpls);
    setRoster(roster);
    const orgSetting = await db.settings.get('biscuit_org_structure');
    if (orgSetting?.value) setOrgStructure(orgSetting.value as OrgStructureType);
    setAuditLogs(storedAudits);

    let activeUser = roster.find(p => p.name.toLowerCase() === senderName.toLowerCase());
    if (!activeUser && roster.length > 0) {
      activeUser = roster[0];
    }
    if (activeUser) setCurrentProfile(activeUser);

    const savedDept = localStorage.getItem('biscuit_crm_user_department') as DepartmentRole;
    if (roster.length <= 1) {
      setDepartment('MD');
    } else if (savedDept && DEPARTMENT_CONFIG[savedDept]) {
      setDepartment(savedDept);
      setViewMode(DEPARTMENT_CONFIG[savedDept].defaultTab);
    }

    const savedSender = localStorage.getItem('biscuit_crm_sender_name');
    if (savedSender) setSenderName(savedSender);

    const savedSupervisor = localStorage.getItem('biscuit_crm_supervisor_email');
    if (savedSupervisor) setSupervisorEmail(savedSupervisor);

    const cachedFolder = localStorage.getItem('biscuit_crm_drive_folder_id');
    const cachedEmail = localStorage.getItem('biscuit_crm_user_email');
    const cachedDomain = localStorage.getItem('biscuit_crm_user_domain');
    const cachedIsPersonal = localStorage.getItem('biscuit_crm_is_personal') === 'true';

    if (cachedFolder) {
      setFolderId(cachedFolder);
      if (cachedEmail) {
        setWorkspaceConfig({
          userEmail: cachedEmail,
          userName: savedSender || cachedEmail.split('@')[0],
          domain: cachedDomain || '',
          isPersonalAccount: cachedIsPersonal,
          driveFolderId: cachedFolder,
        });
      }
    }
  };

  const authenticateToken = useCallback((interactive = true): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (token) return resolve(token);

      const cachedToken = localStorage.getItem('biscuit_crm_google_token');
      const tokenExpiresAt = Number(localStorage.getItem('biscuit_crm_google_token_exp') || '0');

      if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
        setToken(cachedToken);
        return resolve(cachedToken);
      }

      if (!window.google) return reject(new Error('Google library not loaded'));

      if (!tokenClientRef.current) {
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES,
          callback: async (response: any) => {
            if (response.error) {
              return reject(response);
            }

            const accessToken = response.access_token;
            const expiresIn = Number(response.expires_in || 3600);
            const expTime = Date.now() + expiresIn * 1000;

            localStorage.setItem('biscuit_crm_google_token', accessToken);
            localStorage.setItem('biscuit_crm_google_token_exp', String(expTime));
            setToken(accessToken);

            try {
              const ws = await resolveUserWorkspace(accessToken);
              setWorkspaceConfig(ws);
              setFolderId(ws.driveFolderId);
              setSenderName(ws.userName);

              localStorage.setItem('biscuit_crm_drive_folder_id', ws.driveFolderId);
              localStorage.setItem('biscuit_crm_user_email', ws.userEmail);
              localStorage.setItem('biscuit_crm_user_domain', ws.domain);
              localStorage.setItem('biscuit_crm_is_personal', String(ws.isPersonalAccount));
              localStorage.setItem('biscuit_crm_sender_name', ws.userName);

              const roster = await db.employees.toArray();
              if (ws.isPersonalAccount || roster.length <= 1) {
                setDepartment('MD');
                localStorage.setItem('biscuit_crm_user_department', 'MD');
              }
            } catch (wsErr) {
              console.warn('Workspace provisioning fallback:', wsErr);
            }

            resolve(accessToken);
          },
        });
      }

      const storedEmail = localStorage.getItem('biscuit_crm_user_email');
      if (!interactive) {
        tokenClientRef.current.requestAccessToken({ prompt: '', hint: storedEmail || undefined });
      } else {
        tokenClientRef.current.requestAccessToken();
      }
    });
  }, [clientId, token, SCOPES]);

  useEffect(() => {
    const attemptSilentLogin = async () => {
      const cachedToken = localStorage.getItem('biscuit_crm_google_token');
      const tokenExpiresAt = Number(localStorage.getItem('biscuit_crm_google_token_exp') || '0');

      if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
        setToken(cachedToken);
      } else if (localStorage.getItem('biscuit_crm_drive_folder_id')) {
        const checkGapi = setInterval(() => {
          if (window.google?.accounts?.oauth2) {
            clearInterval(checkGapi);
            authenticateToken(false).catch(() => {});
          }
        }, 500);
        setTimeout(() => clearInterval(checkGapi), 5000);
      }
    };

    attemptSilentLogin();
  }, [authenticateToken]);

  const handleDisconnectGoogle = () => {
    localStorage.removeItem('biscuit_crm_google_token');
    localStorage.removeItem('biscuit_crm_google_token_exp');
    localStorage.removeItem('biscuit_crm_google_refresh_token');
    setToken(null);
  };

  const handleSyncToSheets = useCallback(async (silent = false) => {
    if (isSyncing || !navigator.onLine) return;
    setIsSyncing(true);
    try {
      const activeToken = await authenticateToken(!silent);
      let targetFolder = folderId || localStorage.getItem('biscuit_crm_drive_folder_id') || '';

      if (!targetFolder) {
        const ws = await resolveUserWorkspace(activeToken);
        targetFolder = ws.driveFolderId;
        setFolderId(targetFolder);
        setWorkspaceConfig(ws);
      }

      const res = await syncOutboxToGoogleSheets(activeToken, targetFolder);
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

  const awardRepXP = async (amount: number, reason: string) => {
    try {
      const allProfiles = await db.employees.toArray();
      let profile = allProfiles.find(p => p.name.toLowerCase() === senderName.toLowerCase());

      if (!profile) {
        const newProf: EmployeeProfile = {
          name: senderName,
          role: 'Managing Director',
          department: department,
          tier: department === 'MD' ? 'Director' : 'Staff',
          status: 'Active',
          xp: 200,
          level: 2,
          dealsClosed: 0,
          handoverActive: false,
        };
        const id = await db.employees.add(newProf);
        profile = { ...newProf, id };
      }

      const prevProg = computeProgression((profile as any)?.tier || 'Staff', profile.xp);
      const updatedXP = profile.xp + amount;
      const nextProg = computeProgression((profile as any)?.tier || 'Staff', updatedXP);

      await db.employees.update(profile.id!, {
        xp: updatedXP,
        level: nextProg.level,
      });

      setCurrentProfile({ ...profile, xp: updatedXP, level: nextProg.level });

      if (nextProg.level > prevProg.level) {
        await db.newsFeed.add({
          title: `Level Up: ${profile.name} achieved Level ${nextProg.level}!`,
          content: `${profile.name} advanced to ${nextProg.title} with ${updatedXP} XP.`,
          category: 'Level Up',
          department: 'Company-Wide',
          actor: 'System XP Engine',
          badgeColor: 'border-amber-500/30 text-amber-300 bg-amber-500/10',
          createdAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn('XP increment deferred:', e);
    }
  };

  const handleSelectDepartment = (dept: DepartmentRole) => {
    setDepartment(dept);
    localStorage.setItem('biscuit_crm_user_department', dept);
    setViewMode(DEPARTMENT_CONFIG[dept].defaultTab);
  };

  const handleOpenAddModal = (presetStage?: StageType) => {
    let defaultStage: StageType = 'Prospect';
    if (presetStage) {
      defaultStage = presetStage;
    } else if (department === 'Sales') {
      defaultStage = 'Prospect';
    } else if (department === 'Marketing') {
      defaultStage = 'Lead';
    } else if (department === 'Operations') {
      defaultStage = 'Customer Service';
    } else {
      defaultStage = 'Lead';
    }

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
      stage: defaultStage,
      dealValue: 0,
    });
    setSearchResults([]);
    setSearchQuery('');
    setIsModalOpen(true);
  };

  const handleUpdateSenderName = (name: string) => {
    setSenderName(name);
    localStorage.setItem('biscuit_crm_sender_name', name);
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

    await awardRepXP(50, `Advanced deal to ${nextStage}`);

    if (nextStage === 'Customer Service') {
      await db.newsFeed.add({
        title: `Deal Won: ${contact.company || contact.name} onboarded!`,
        content: `${senderName} closed contract for ${contact.company || contact.name} [${contact.accountNumber}].`,
        category: 'Deal Closed',
        department: 'Sales',
        actor: senderName,
        badgeColor: 'border-sky-500/30 text-sky-300 bg-sky-500/10',
        createdAt: now,
      });
    }

    authenticateToken(false).then(async (t) => {
      const activeFolder = folderId || localStorage.getItem('biscuit_crm_drive_folder_id');
      if (activeFolder) {
        await logAuditEvent(t, activeFolder, {
          timestamp: now,
          actor: senderName,
          action: 'UPDATE_STAGE',
          entityId: `Contact_${contact.id}`,
          details: `Advanced stage to "${nextStage}" for ${contact.name} [${contact.accountNumber}]`,
        });
      }
    }).catch(console.warn);

    await loadData();
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

      const regressionEntry = `\n[DEAL REGRESSION ${dateStr}]: Reverted from ${regressingContact.stage} back to ${previousStage} by ${senderName}.\nReason: ${regressionReasonCategory}\nExplanation: ${regressionNotes}`;
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

      setPostRegressionDraft({
        subject: `[URGENT DEAL REGRESSION] ${regressingContact.name} [Ref: ${regressingContact.accountNumber}]`,
        body: `DEAL REGRESSION NOTIFICATION\n\nAccount: ${regressingContact.accountNumber}\nName: ${regressingContact.name}\nPrevious: ${regressingContact.stage}\nReverted To: ${previousStage}\nReason: ${regressionReasonCategory}\nNotes: ${regressionNotes}`,
        recipient: supervisorEmail || senderName,
      });

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

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.name && !newContact.company) return;

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

    await awardRepXP(35, `Enrolled business ${newContact.company || newContact.name}`);

    authenticateToken(false).then(t => {
      const activeFolder = folderId || localStorage.getItem('biscuit_crm_drive_folder_id');
      if (activeFolder) {
        logAuditEvent(t, activeFolder, {
          timestamp: new Date().toISOString(),
          actor: senderName,
          action: 'CREATE_CONTACT',
          entityId: `Contact_${newId}`,
          details: `Manual business intake: ${newContact.company || newContact.name} [Account No: ${assignedAcc}] into stage "${newContact.stage}"`,
        });
      }
    }).catch(console.warn);

    setIsModalOpen(false);
    await loadData();
    triggerDebouncedSync();
  };

  // Resolve visible contacts scoped to active user clearance and org topology
  const scopedContacts = scopeContactsByOrg(contacts, currentProfile, roster, orgStructure);

    const isMD = department === 'MD';
  const isIT = department === 'IT';
  const isSales = department === 'Sales';
  const isMarketing = department === 'Marketing';
  const isOperations = department === 'Operations';
  
  const canAddBusiness = isMD || isSales || isMarketing || isOperations;
  const canViewDriveDetails = isMD || isIT;

  const allowedTabs = DEPARTMENT_CONFIG[department].allowedTabs;
  const CurrentDeptIcon = DEPARTMENT_CONFIG[department].icon;

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

  const userTier = currentProfile?.tier || (isMD ? 'Director' : 'Staff');
  const userXP = currentProfile?.xp || 200;
  const prog = computeProgression(userTier, userXP);
  const progressPercent = Math.min(100, Math.max(0, ((userXP - prog.baseXP) / (prog.nextXP - prog.baseXP)) * 100));

  return (
    <main className="max-w-[1540px] mx-auto px-6 py-8">
      {/* Top Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-800 pb-5 mb-5 gap-4">
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
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Sole Trader Mode{showEmail ? ` (Personal Google Account: ${currentProfile?.email || 'user@corporate-domain.com'})` : ''}</span>
            <button 
              type="button"
              onClick={() => setShowEmail(!showEmail)} 
              title={showEmail ? "Hide account email" : "Show account email"}
              className="text-slate-500 hover:text-slate-300 transition-colors p-0.5 rounded focus:outline-none"
            >
              {showEmail ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* MD Persona Switcher */}
        {isMD ? (
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-amber-500/30">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider px-2">MD Console:</span>
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
              <Crown className="w-3 h-3" /> Unlock MD Mode
            </button>
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* IT & MD Exclusive Drive Diagnostics Visibility Toggle */}
          {canViewDriveDetails && (
            <button
              onClick={() => setShowDriveDetails(!showDriveDetails)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                showDriveDetails
                  ? 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle Drive Workspace Diagnostic Details"
            >
              {showDriveDetails ? <EyeOff className="w-3.5 h-3.5 text-sky-400" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
              <span>{showDriveDetails ? 'Hide Drive Workspace' : 'View Drive Workspace'}</span>
            </button>
          )}

          <button
            onClick={() => setIsCommandOpen(true)}
            className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-lg text-xs text-slate-400 transition"
          >
            <Search className="w-3.5 h-3.5" />
            <kbd className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">⌘K</kbd>
          </button>
          <button
            onClick={() => setIsHealthOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            System Live
          </button>
        </div>
      </header>

      {/* DASHBOARD EXPERIENCE (XP) BAR & LEVEL PROGRESSION */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 shadow-md mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center text-amber-400 font-extrabold text-lg shadow-inner">
              {senderName.charAt(0)}
            </div>
            <span className="absolute -bottom-1 -right-1 px-1 py-0.2 rounded-full text-[9px] font-mono font-bold bg-amber-500 text-slate-950">
              Lv.{prog.level}
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-100 text-sm">{senderName}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${prog.badge}`}>
                {prog.title}
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded">
                {userTier} ({prog.isLeadership ? '5-Level Ladder' : '10-Level System'})
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
              <span>{department} Division</span>
              <span>&bull;</span>
              <span className="text-amber-400 font-mono font-semibold">{userXP} Total XP Earned</span>
            </p>
          </div>
        </div>

        <div className="w-full md:w-80 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-500 animate-pulse" /> Rep Experience Ladder
            </span>
            <span className="font-mono text-amber-400 font-bold text-[11px]">
              {userXP} / {prog.nextXP} XP
            </span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
            <div 
              className="bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 h-full rounded-full transition-all duration-700"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
            <span>Level {prog.level} of {prog.maxLevels}</span>
            <span>{Math.max(0, prog.nextXP - userXP)} XP to Next Level</span>
          </div>
        </div>
      </div>

      {/* DEPARTMENT & COMPANY-WIDE NEWSFEED */}
      <DepartmentNewsfeed
        currentDepartment={department}
        currentUser={senderName}
        onAwardXP={awardRepXP}
      />

      {/* REVEALABLE PRIVATE DRIVE WORKSPACE BANNER (MD & IT ONLY, HIDDEN BY DEFAULT) */}
      {canViewDriveDetails && showDriveDetails && (
        <div className="p-4 rounded-xl bg-slate-900/80 border border-sky-500/30 flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <FolderCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-slate-200">
                  User Private Drive Workspace: {folderId ? <code className="font-mono text-emerald-400 text-[11px]">{folderId}</code> : 'Awaiting Google Authentication'}
                </h3>
                {token && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" /> Connected
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Data is isolated to the user's private Google account. Zero telemetry or central server storage.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowDriveDetails(false)}
            className="text-xs text-slate-400 hover:text-slate-200 underline"
          >
            Hide Workspace Details
          </button>
        </div>
      )}

      {/* ACTION TOOLBAR (COMPACT & CLEAN) */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Logged in as: <strong className="text-slate-200">{senderName}</strong></span>
          <span>&bull;</span>
          <span className="text-amber-400 font-semibold">{DEPARTMENT_CONFIG[department].label}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {canAddBusiness && (
            <button
              onClick={() => handleOpenAddModal()}
              className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              {isSales && 'Add Lead / Account'}
              {isMarketing && 'Add Inbound Lead'}
              {isOperations && 'Add Customer Account'}
              {isMD && 'Add New Business'}
            </button>
          )}

          {(isMD || isIT) && (
            <button
              onClick={() => setViewMode('import')}
              className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition shadow"
            >
              <Upload className="w-3.5 h-3.5" /> Migrate / Upload CSV
            </button>
          )}

          {(isMD || department === "IT") && (!token ? (
            <button
              onClick={() => handleSyncToSheets(false)}
              className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition shadow"
            >
              <Database className="w-3.5 h-3.5" /> Connect Google Drive
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleSyncToSheets(false)}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} /> Sync to Drive
              </button>
              <button
                onClick={handleDisconnectGoogle}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition border border-slate-800"
                title="Disconnect Google session"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Tab Bar */}
      <div className="flex bg-slate-900/90 border border-slate-800 rounded-xl p-1 gap-1 mb-6 shadow-sm overflow-x-auto">
        {(isMD || allowedTabs.includes('kanban')) && (
          <button
            onClick={() => setViewMode('kanban')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition ${viewMode === 'kanban' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Pipeline Board
          </button>
        )}

        {(isMD || allowedTabs.includes('telephony')) && (
          <button
            onClick={() => setViewMode('telephony')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition ${viewMode === 'telephony' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Phone className="w-3.5 h-3.5 text-sky-400" /> CTI Telephony & Dialing
          </button>
        )}

        {(isMD || allowedTabs.includes('mailchimp')) && (
          <button
            onClick={() => setViewMode('mailchimp')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition ${viewMode === 'mailchimp' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Megaphone className="w-3.5 h-3.5 text-purple-400" /> Mailchimp Connector
          </button>
        )}

        {(isMD || allowedTabs.includes('finance')) && (
          <button
            onClick={() => setViewMode('finance')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition ${viewMode === 'finance' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <PoundSterling className="w-3.5 h-3.5 text-emerald-400" /> Finance & Billing Desk
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

        {(isMD || isIT) && (
          <button
            onClick={() => setViewMode('roster')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition ${viewMode === 'roster' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Crown className="w-3.5 h-3.5 text-sky-400" /> Org Roster & Offboarding
          </button>
        )}

        {(isMD || isIT) && (
          <button
            onClick={() => setViewMode('import')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition ${viewMode === 'import' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Upload className="w-3.5 h-3.5 text-amber-400" /> Data Upload / Switch CRM
          </button>
        )}
      </div>

      {/* Screen: Data Import & Onboarding Wizard */}
      {viewMode === 'import' && (isMD || isIT) && (
        <DataImportWizard
          currentUser={senderName}
          onImportComplete={() => {
            loadData();
            triggerDebouncedSync();
          }}
        />
      )}

      {/* Screen: Telephony & CTI */}
      {viewMode === 'telephony' && (isMD || allowedTabs.includes('telephony')) && (
        <TelephonyDesk
          contacts={contacts}
          onOpenContact={(c) => setSelectedDealForDrawer(c)}
          onAwardXP={awardRepXP}
          currentUser={senderName}
        />
      )}

      {/* Screen: Mailchimp Connector */}
      {viewMode === 'mailchimp' && (isMD || allowedTabs.includes('mailchimp')) && (
        <MailchimpDesk
          contacts={contacts}
          onDataChanged={loadData}
          onAwardXP={awardRepXP}
        />
      )}

      {/* Screen: Org Roster Desk */}
      {viewMode === 'roster' && (isMD || isIT) && (
        <OrgRosterDesk
          currentRepName={senderName}
          userRole={department}
          contacts={contacts}
          onDataChanged={loadData}
        />
      )}

      {/* Screen: Finance Desk */}
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

      {/* Screen: Employee Hub */}
      {viewMode === 'hub' && (isMD || allowedTabs.includes('hub')) && (
        <EmployeeHub
          currentRepName={senderName}
          contacts={contacts}
          onRepNameChange={handleUpdateSenderName}
          onAdvanceContactStage={advanceStage}
          onAuthenticateGoogle={authenticateToken}
        />
      )}

      {/* Screen: Pipeline Board */}
      {viewMode === 'kanban' && (isMD || allowedTabs.includes('kanban')) && (
        <section className="grid grid-cols-1 md:grid-cols-7 gap-3 mb-8">
          {PIPELINE_STAGES.map((col, idx) => {
            const colContacts = scopedContacts.filter(c => c.stage === col.key);
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

                        <div className="pt-0.5">
                          <span className={`inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded border ${sla.badgeClass}`}>
                            {sla.badgeLabel}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded font-semibold">
                            {c.accountNumber}
                          </span>
                          {c.mailchimpStatus === 'Synced' && (
                            <span className="text-[9px] font-mono text-purple-300 bg-purple-950/60 border border-purple-800/60 px-1.5 py-0.5 rounded font-semibold">
                              Mailchimp
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 truncate">
                          <span>{c.email}</span>
                          {c.phone && (
                            <a
                              href={`tel:${c.phone.replace(/[^0-9+]/g, '')}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-0.5 text-emerald-400 hover:text-emerald-300 font-mono"
                            >
                              <PhoneCall className="w-2.5 h-2.5" />
                              {c.phone}
                            </a>
                          )}
                        </div>

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
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Screen: Table View */}
      {viewMode === 'table' && (isMD || allowedTabs.includes('table')) && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold text-slate-200 text-sm">All Customer Accounts</h2>
            <div className="flex items-center gap-2">
              {canAddBusiness && (
                <button
                  onClick={() => handleOpenAddModal()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Business / Account
                </button>
              )}
              <button
                onClick={() => exportPipelineToCSV(contacts)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                Export CSV
              </button>
            </div>
          </div>
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-3">Account No</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Company</th>
                <th className="px-6 py-3">Phone</th>
                <th className="px-6 py-3">Stage</th>
                <th className="px-6 py-3">Mailchimp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {contacts.map((c) => (
                <tr key={c.id} onClick={() => setSelectedDealForDrawer(c)} className="hover:bg-slate-800/30 cursor-pointer">
                  <td className="px-6 py-4 font-mono text-emerald-400 font-semibold text-xs">{c.accountNumber}</td>
                  <td className="px-6 py-4 font-semibold text-slate-100">{c.name}</td>
                  <td className="px-6 py-4">{c.company || '—'}</td>
                  <td className="px-6 py-4 font-mono text-xs text-sky-400">{c.phone || '—'}</td>
                  <td className="px-6 py-4 text-xs">{c.stage}</td>
                  <td className="px-6 py-4 text-xs">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                      c.mailchimpStatus === 'Synced' ? 'border-purple-500/30 text-purple-300 bg-purple-500/10' : 'border-slate-800 text-slate-400'
                    }`}>
                      {c.mailchimpStatus || 'Not Synced'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Screen: Gantt View */}
      {viewMode === 'gantt' && (isMD || allowedTabs.includes('gantt')) && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 mb-8">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
            <div>
              <h2 className="font-semibold text-slate-100 text-base">Project Milestones & Interactive Gantt</h2>
              <p className="text-xs text-slate-400 mt-0.5">SLA fulfillment and delivery schedules</p>
            </div>
            <div className="flex items-center gap-2">
              {canAddBusiness && (
                <button
                  onClick={() => handleOpenAddModal('Customer Service')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add CS Client
                </button>
              )}
              <button
                onClick={() => setIsTaskModalOpen(true)}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-3 py-1.5 rounded-lg text-xs transition"
              >
                + New Milestone
              </button>
            </div>
          </div>
          <div className="space-y-4">
            {tasks.map((task) => (
              <div key={task.id} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-semibold text-slate-200 text-sm">{task.title}</h4>
                  <span className="text-xs text-emerald-400 font-mono">Progress: {task.progress}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: `${task.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Screen: Template Vault */}
      {viewMode === 'templates' && (isMD || allowedTabs.includes('templates')) && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {allTemplates.map((tpl) => (
            <div key={tpl.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-semibold text-amber-400">{tpl.category}</span>
                <h3 className="font-semibold text-slate-100 text-sm mb-3 mt-1">{tpl.title}</h3>
                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {tpl.body}
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Manual Business Intake Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div>
                <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-400" /> Manually Intake Business / Account
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Assigned Account Reference: <span className="font-mono text-emerald-400 font-semibold">{newContact.accountNumber}</span>
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>

            <div className="mb-4 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Optional: UK Companies House Autofill (Auto-extract CRN & Address)
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
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Target Funnel Stage</label>
                  <select
                    value={newContact.stage}
                    onChange={(e) => setNewContact({ ...newContact, stage: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-400"
                  >
                    {PIPELINE_STAGES.map(s => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Account Reference</label>
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
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Company / Organization Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Client Account Ltd"
                    value={newContact.company}
                    onChange={(e) => setNewContact({ ...newContact, company: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Primary Contact Name</label>
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
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="client@company.co.uk"
                    value={newContact.email}
                    onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Phone Number (Click-to-Dial)</label>
                  <input
                    type="text"
                    placeholder="+44 20 7946 0912"
                    value={newContact.phone}
                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Companies House CRN</label>
                  <input
                    type="text"
                    placeholder="e.g. 12849501"
                    value={newContact.crn}
                    onChange={(e) => setNewContact({ ...newContact, crn: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Contract / Deal Value (£)</label>
                  <input
                    type="number"
                    placeholder="5000"
                    value={newContact.dealValue || ''}
                    onChange={(e) => setNewContact({ ...newContact, dealValue: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-emerald-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Registered Billing Address</label>
                <textarea
                  rows={2}
                  placeholder="e.g. 100 High Street, London, EC1A 1BB"
                  value={newContact.billingAddress}
                  onChange={(e) => setNewContact({ ...newContact, billingAddress: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs transition shadow"
                >
                  Save Business into CRM (+35 XP)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deal Detail Drawer */}
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

      {/* Command Palette & Health Wizard */}
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        contacts={contacts}
        onSelectView={(mode) => setViewMode(mode)}
        onOpenNewContact={() => handleOpenAddModal('Prospect')}
        onOpenNewMilestone={() => setIsTaskModalOpen(true)}
        onOpenNewTemplate={() => {}}
      />

      <HealthWizard
        isOpen={isHealthOpen}
        onClose={() => setIsHealthOpen(false)}
        folderId={folderId}
      />
    </main>
  );
}
