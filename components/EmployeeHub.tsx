'use client';

import React, { useState, useEffect } from 'react';
import {
  LifeBuoy, 
  Trophy, Award, BookOpen, Phone, Search, Globe, GraduationCap, Flame, UserCheck, Calendar, ArrowRightLeft, 
  StickyNote, Plus, Trash2, CheckCircle2, Clock, ShieldCheck, 
  Sparkles, Check, AlertCircle, Send, CalendarCheck2, Mail, ExternalLink,
  XCircle, Crown, X
} from 'lucide-react';
import { db, Contact, StaffHierarchyTier, EmployeeProfile, WhiteboardNote, LeaveRequest, ComplianceCertificate, IndustryModulesConfig } from '../packages/storage/src/db';
import { syncLeaveToGoogleCalendar, deleteCalendarEvent, syncLeaveToMicrosoftCalendar, deleteMicrosoftCalendarEvent } from '../packages/storage/src/calendarSync';

interface EmployeeHubProps {
  currentRepName: string;
  contacts: Contact[];
  onRepNameChange: (newName: string) => void;
  onAdvanceContactStage?: (contact: Contact) => void;
  onAuthenticateGoogle?: () => Promise<string>;
  onAuthenticateMicrosoft?: () => Promise<string>;
}

const NOTE_COLORS = {
  amber: 'bg-amber-950/40 border-amber-500/30 text-amber-200',
  sky: 'bg-sky-950/40 border-sky-500/30 text-sky-200',
  emerald: 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200',
  purple: 'bg-purple-950/40 border-purple-500/30 text-purple-200',
  rose: 'bg-rose-950/40 border-rose-500/30 text-rose-200',
};

export function computeProgression(tier: StaffHierarchyTier, xp: number) {
  const isLeaderOrAbove = tier !== 'Staff';

  if (isLeaderOrAbove) {
    const level = Math.min(5, Math.max(1, Math.floor(xp / 250) + 1));
    const titles = [
      'Frontline Lead',
      'Operations Captain',
      'Department Head',
      'Executive Champion',
      'Grandmaster Director'
    ];
    return {
      level,
      maxLevels: 5,
      step: 250,
      title: titles[level - 1],
      isLeadership: true,
      nextXP: level >= 5 ? 1250 : level * 250,
      baseXP: (level - 1) * 250,
      badge: 'border-purple-500/30 text-purple-300 bg-purple-500/10'
    };
  }

  const level = Math.min(10, Math.max(1, Math.floor(xp / 200) + 1));
  const staffTitles = [
    'Apprentice Associate',
    'Junior Specialist',
    'Core Practitioner',
    'Advanced Operator',
    'Senior Specialist',
    'Staff Anchor',
    'Master Practitioner',
    'Department Vanguard',
    'Principal Specialist',
    'Apex Elite'
  ];
  return {
    level,
    maxLevels: 10,
    step: 200,
    title: staffTitles[level - 1],
    isLeadership: false,
    nextXP: level >= 10 ? 2000 : level * 200,
    baseXP: (level - 1) * 200,
    badge: 'border-amber-500/30 text-amber-300 bg-amber-500/10'
  };
}

export default function EmployeeHub({
  currentRepName,
  contacts,
  onRepNameChange,
  onAuthenticateGoogle,
  onAuthenticateMicrosoft,
}: EmployeeHubProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'handover' | 'whiteboard' | 'leave' | 'approvals' | 'support' | 'compliance' | 'directory'>('profile');
  const [allEmployees, setAllEmployees] = useState<EmployeeProfile[]>([]);
  const [directorySearch, setDirectorySearch] = useState('');
  const [isMhraEnabled, setIsMhraEnabled] = useState(false);
  const [certificates, setCertificates] = useState<ComplianceCertificate[]>([]);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [certForm, setCertForm] = useState({
    certificationName: 'MHRA Good Distribution Practice (GDP)',
    issuingBody: 'MHRA Standards Directorate',
    completedDate: new Date().toISOString().slice(0, 10),
    expiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    certificateRef: 'MHRA-GDP-UK-9041',
    notes: 'Statutory compliance refresher completed.'
  });
  const [supportType, setSupportType] = useState<'IT' | 'HR'>('IT');
  const [supportTitle, setSupportTitle] = useState('');
  const [supportDesc, setSupportDesc] = useState('');
  const [supportPriority, setSupportPriority] = useState('P3-Medium');
  
  const [profile, setProfile] = useState<EmployeeProfile>({
    name: currentRepName || 'Team Member',
    role: 'Sales Lead',
    department: 'Sales',
    tier: 'Team Leader',
    status: 'Active',
    xp: 685,
    level: 3,
    dealsClosed: 4,
    handoverActive: false,
  });

    const [activeKpis, setActiveKpis] = useState<any[]>([]);

  useEffect(() => {
    async function loadDepartmentKpis() {
      try {
        const empDept = profile?.department || 'Sales';
        const kpis = await db.teamKpis
          .filter(k => k.department === empDept || (k.department as string) === 'All' || (k as any).assigneeId === profile?.id || (k as any).assignee === profile?.name)
          .toArray();
        setActiveKpis(kpis);
      } catch (err) {
        console.error('Failed to load KPIs:', err);
      }
    }
    loadDepartmentKpis();
  }, [profile?.department, profile?.id]);

  const [notes, setNotes] = useState<WhiteboardNote[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [selectedColor, setSelectedColor] = useState<'amber' | 'sky' | 'emerald' | 'purple' | 'rose'>('amber');

  const [leaveList, setLeaveList] = useState<LeaveRequest[]>([]);

  // Check if business has activated MHRA & Pharma Regulatory compliance module
  useEffect(() => {
    async function checkIndustryModule() {
      try {
        const setting = await db.settings.get('biscuit_industry_modules');
        const config = setting?.value as IndustryModulesConfig | undefined;
        const enabled = !!(config?.enableMhraCompliance || config?.industry === 'pharma_healthcare');
        setIsMhraEnabled(enabled);

        if (enabled) {
          let certs = await db.complianceCertificates.toArray();
          if (certs.length === 0) {
            const now = new Date();
            const oneYear = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
            const expiring = new Date(Date.now() + 20 * 24 * 3600 * 1000).toISOString().slice(0, 10);
            const initialCerts: Omit<ComplianceCertificate, 'id'>[] = [
              {
                employeeId: profile?.id || 1,
                employeeName: profile?.name || 'Staff Member',
                department: profile?.department || 'Operations',
                certificationName: 'MHRA Good Distribution Practice (GDP)',
                issuingBody: 'MHRA Standards Directorate',
                completedDate: now.toISOString().slice(0, 10),
                expiryDate: oneYear,
                status: 'Active',
                certificateRef: 'MHRA-GDP-UK-9041',
                notes: 'Annual cold-chain & distribution audit passed.',
                createdAt: now.toISOString()
              },
              {
                employeeId: profile?.id || 1,
                employeeName: profile?.name || 'Staff Member',
                department: profile?.department || 'Operations',
                certificationName: 'Good Manufacturing Practice (GMP / Annex 1)',
                issuingBody: 'MHRA / Royal Pharmaceutical Society',
                completedDate: now.toISOString().slice(0, 10),
                expiryDate: expiring,
                status: 'Expiring Soon',
                certificateRef: 'GMP-ANNEX1-8820',
                notes: 'Cleanroom & sterile fill validation renewal pending within 30 days.',
                createdAt: now.toISOString()
              },
              {
                employeeId: profile?.id || 1,
                employeeName: profile?.name || 'Staff Member',
                department: profile?.department || 'Operations',
                certificationName: 'Pharmacovigilance & Adverse Event Reporting (PV)',
                issuingBody: 'MHRA Yellow Card Scheme',
                completedDate: now.toISOString().slice(0, 10),
                expiryDate: oneYear,
                status: 'Active',
                certificateRef: 'MHRA-PV-7731',
                notes: 'Mandatory clinical trial & post-marketing surveillance protocol.',
                createdAt: now.toISOString()
              },
              {
                employeeId: profile?.id || 1,
                employeeName: profile?.name || 'Staff Member',
                department: profile?.department || 'Operations',
                certificationName: 'COSHH & Hazardous Substance Handling',
                issuingBody: 'Health & Safety Executive (HSE)',
                completedDate: now.toISOString().slice(0, 10),
                expiryDate: oneYear,
                status: 'Active',
                certificateRef: 'COSHH-CHEM-4412',
                notes: 'Active Pharmaceutical Ingredient (API) dust containment certified.',
                createdAt: now.toISOString()
              }
            ];
            for (const c of initialCerts) {
              await db.complianceCertificates.add(c as any);
            }
            certs = await db.complianceCertificates.toArray();
          }
          setCertificates(certs);
        }
      } catch (err) {
        console.error('Failed to check industry compliance settings:', err);
      }
    }
    checkIndustryModule();
  }, [profile?.id, profile?.name, profile?.department]);
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);
  const [deletingLeaveId, setDeletingLeaveId] = useState<number | null>(null);
  const [newLeave, setNewLeave] = useState({
    type: 'Annual Leave' as const,
    startDate: '2026-12-24',
    endDate: '2026-12-31',
    notes: 'Christmas & Year End Break',
  });

  const [selectedContactForHandover, setSelectedContactForHandover] = useState<string>('');
  const [handoverCoverRep, setHandoverCoverRep] = useState('');
  const [handoverCoverEmail, setHandoverCoverEmail] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [handoverSuccess, setHandoverSuccess] = useState(false);
  const [lastTransferredContact, setLastTransferredContact] = useState<Contact | null>(null);

  const loadHubData = async () => {
    try {
      const storedNotes = await db.whiteboardNotes.toArray();
      setNotes(storedNotes.reverse());

      const storedLeave = await db.leaveRequests.toArray();
      setLeaveList(storedLeave.reverse());

      const allProfiles = await db.employees.toArray();
      setAllEmployees(allProfiles);
      const existing = allProfiles.find(p => p.name.toLowerCase() === currentRepName.toLowerCase());
      if (existing) {
        setProfile(existing);
      } else {
        const initial: EmployeeProfile = {
          name: currentRepName,
          role: 'Sales Specialist',
          department: 'Sales',
          tier: 'Staff',
          status: 'Active',
          xp: 450,
          level: 3,
          dealsClosed: contacts.filter(c => c.stage === 'Customer Service').length,
          handoverActive: false,
        };
        const id = await db.employees.add(initial);
        setProfile({ ...initial, id });
      }
    } catch (e) {
      console.warn('Could not load Hub data:', e);
    }
  };

  useEffect(() => {
    loadHubData();
  }, [currentRepName]);

  const addXP = async (amount: number, reason: string) => {
    const updatedXP = profile.xp + amount;
    const prog = computeProgression(profile.tier, updatedXP);
    const updatedProfile = { ...profile, xp: updatedXP, level: prog.level };
    setProfile(updatedProfile);
    if (profile.id) {
      await db.employees.update(profile.id, { xp: updatedXP, level: prog.level });
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle || !newNoteText) return;

    await db.whiteboardNotes.add({
      title: newNoteTitle,
      content: newNoteText,
      color: selectedColor,
      author: currentRepName,
      createdAt: new Date().toISOString(),
    });

    setNewNoteTitle('');
    setNewNoteText('');
    await addXP(20, 'Posted Whiteboard Sticky');
    await loadHubData();
  };

  const handleDeleteNote = async (id?: number) => {
    if (!id) return;
    await db.whiteboardNotes.delete(id);
    await loadHubData();
  };

    const handleRaiseTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportTitle.trim()) return;
    const now = new Date().toISOString();

    if (supportType === 'IT') {
      const count = await db.itTickets.count();
      const ticketNumber = `IT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
      await db.itTickets.add({
        ticketNumber,
        title: supportTitle,
        description: supportDesc,
        category: 'Hardware',
        priority: supportPriority as any,
        status: 'Triage',
        requesterName: profile?.name || currentRepName || 'Staff Member',
        requesterEmail: profile?.email || 'staff@internal.corp',
        requesterDepartment: profile?.department || 'Sales',
        targetResolutionHours: 48,
        history: [{
          timestamp: now,
          actor: profile?.name || currentRepName || 'Staff Member',
          action: 'Incident Raised via Employee Hub',
          details: supportTitle
        }],
        createdAt: now,
        updatedAt: now
      });
    } else {
      const count = await db.internalTickets.count();
      const ticketNumber = `HR-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
      await db.internalTickets.add({
        ticketNumber,
        type: 'HR',
        category: 'General',
        subject: supportTitle,
        details: supportDesc,
        priority: 'Medium',
        status: 'Open',
        requesterName: profile?.name || currentRepName || 'Staff Member',
        requesterEmail: profile?.email || 'staff@internal.corp',
        requesterDepartment: profile?.department || 'Sales',
        createdAt: now,
        updatedAt: now
      });
    }

    setSupportTitle('');
    setSupportDesc('');
    alert(`${supportType} Ticket logged successfully! Dispatched to department queue.`);
  };

  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingLeave(true);
    try {
      const start = new Date(newLeave.startDate);
      const end = new Date(newLeave.endDate);
      const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

      let calId: string | undefined;

      // Multi-Provider Calendar Sync (Microsoft 365 or Google Workspace)
      if (onAuthenticateMicrosoft) {
        try {
          const msToken = await onAuthenticateMicrosoft();
          calId = await syncLeaveToMicrosoftCalendar(msToken, {
            employeeName: currentRepName,
            leaveType: newLeave.type,
            startDate: newLeave.startDate,
            endDate: newLeave.endDate,
            notes: newLeave.notes,
          });
        } catch (msErr) {
          console.warn('Microsoft 365 Calendar sync deferred:', msErr);
        }
      }

      if (!calId && onAuthenticateGoogle) {
        try {
          const googleToken = await onAuthenticateGoogle();
          calId = await syncLeaveToGoogleCalendar(googleToken, {
            employeeName: currentRepName,
            leaveType: newLeave.type,
            startDate: newLeave.startDate,
            endDate: newLeave.endDate,
            notes: newLeave.notes,
          });
        } catch (calErr) {
          console.warn('Google Calendar sync deferred:', calErr);
        }
      }

      await db.leaveRequests.add({
        employeeName: currentRepName,
        department: profile.department,
        leaveType: newLeave.type,
        startDate: newLeave.startDate,
        endDate: newLeave.endDate,
        days: diffDays,
        status: profile.tier === 'Director' ? 'Approved' : 'Pending',
        notes: newLeave.notes,
        calendarEventId: calId,
        createdAt: new Date().toISOString(),
      });

      await addXP(25, 'Scheduled Holiday Booking');
      await loadHubData();
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const handleApproveLeave = async (req: LeaveRequest, approved: boolean) => {
    if (!req.id) return;
    await db.leaveRequests.update(req.id, {
      status: approved ? 'Approved' : 'Rejected',
      approvedBy: currentRepName,
    });
    await addXP(20, 'Reviewed Department Leave');
    await loadHubData();
  };

  const handleDeleteLeave = async (req: LeaveRequest) => {
    if (!req.id) return;
    setDeletingLeaveId(req.id);

    try {
      if (req.calendarEventId) {
        if (onAuthenticateMicrosoft) {
          try {
            const msToken = await onAuthenticateMicrosoft();
            await deleteMicrosoftCalendarEvent(msToken, req.calendarEventId);
          } catch (msErr) {
            console.warn('Microsoft Calendar event deletion deferred:', msErr);
          }
        }
        if (onAuthenticateGoogle) {
          try {
            const googleToken = await onAuthenticateGoogle();
            await deleteCalendarEvent(googleToken, req.calendarEventId);
          } catch (calErr) {
            console.warn('Google Calendar event deletion deferred:', calErr);
          }
        }
      }

      await db.leaveRequests.delete(req.id);
      await loadHubData();
    } finally {
      setDeletingLeaveId(null);
    }
  };

  const handleExecuteHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactForHandover) return;

    const targetContact = contacts.find(c => c.accountNumber === selectedContactForHandover);
    if (targetContact && targetContact.id) {
      const updatedNotes = `${targetContact.internalNotes || ''}\n[HANDOVER ${new Date().toISOString().slice(0, 10)}]: Reassigned from ${currentRepName} to ${handoverCoverRep}. Instructions: ${handoverNotes}`;
      
      await db.contacts.update(targetContact.id, {
        accountManager: `${handoverCoverRep} (Covering for ${currentRepName})`,
        internalNotes: updatedNotes,
        synced: false,
        updatedAt: new Date().toISOString(),
      });

      await db.outbox.add({
        type: 'UPDATE',
        table: 'contacts',
        payload: {
          id: targetContact.id,
          accountManager: `${handoverCoverRep} (Covering for ${currentRepName})`,
          internalNotes: updatedNotes,
          updatedAt: new Date().toISOString(),
        },
        timestamp: Date.now(),
      });

      setLastTransferredContact(targetContact);
      setHandoverSuccess(true);
      await addXP(35, 'Delegated Deal Handover');
      setTimeout(() => setHandoverSuccess(false), 5000);
    }
  };

  const handleOpenHandoverEmail = () => {
    if (!lastTransferredContact && !selectedContactForHandover) return;
    const target = lastTransferredContact || contacts.find(c => c.accountNumber === selectedContactForHandover);
    if (!target) return;

    const subject = encodeURIComponent(`[DEAL HANDOVER] ${target.name} (${target.company || 'Retail'}) [Ref: ${target.accountNumber}]`);
    const body = encodeURIComponent(
      `Hi ${handoverCoverRep},\n\n` +
      `I have transferred account coverage for ${target.name} to you while I am out of office.\n\n` +
      `ACCOUNT DETAILS:\n` +
      `• Account No: ${target.accountNumber}\n` +
      `• Company: ${target.company || 'Private Client'}${target.crn ? ` (CRN: ${target.crn})` : ''}\n` +
      `• Current Pipeline Stage: ${target.stage}\n` +
      `• Contact Email: ${target.email}\n` +
      `• Contact Phone: ${target.phone || 'None provided'}\n\n` +
      `HANDOVER INSTRUCTIONS & NUANCES:\n` +
      `${handoverNotes || 'Please monitor communications and address urgent requirements as per standard SLA.'}\n\n` +
      `The master ledger has already been updated with your coverage.\n\n` +
      `Best regards,\n` +
      `${currentRepName}`
    );

    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(handoverCoverEmail)}&su=${subject}&body=${body}`, '_blank');
  };

  const isLeader = profile.tier !== 'Staff';
  const prog = computeProgression(profile.tier, profile.xp);
  const progressPercent = Math.min(100, Math.max(0, ((profile.xp - prog.baseXP) / (prog.nextXP - prog.baseXP)) * 100));

  const totalLeaveTaken = leaveList
    .filter(l => l.employeeName.toLowerCase() === currentRepName.toLowerCase() && l.status === 'Approved')
    .reduce((acc, l) => acc + l.days, 0);

  const pendingDepartmentLeaves = leaveList.filter(
    l => l.status === 'Pending' && (profile.tier === 'Director' || l.department === profile.department)
  );

  return (
    <section className="space-y-6 mb-8">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center text-amber-400 font-extrabold text-2xl shadow-inner">
              {currentRepName.charAt(0)}
            </div>
            <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500 text-slate-950 shadow">
              Lv.{prog.level}/{prog.maxLevels}
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <input
                type="text"
                value={currentRepName}
                onChange={(e) => {
                  onRepNameChange(e.target.value);
                  setProfile({ ...profile, name: e.target.value });
                }}
                className="font-bold text-slate-100 text-lg bg-transparent border-b border-dashed border-slate-700 hover:border-amber-400 focus:outline-none focus:border-amber-400 transition"
              />
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${prog.badge}`}>
                {prog.title}
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                {profile.tier} ({prog.isLeadership ? '5-Level Ladder' : '10-Level System'})
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2 mt-1">
              <span>{profile.role}</span>
              <span>&bull;</span>
              <span className="text-indigo-400 font-medium">{profile.department}</span>
              <span>&bull;</span>
              <span className="text-emerald-400 font-mono">{contacts.length} Accounts Monitored</span>
            </p>
          </div>
        </div>

        {/* XP Counter */}
        <div className="w-full md:w-80 p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-500 animate-pulse" /> Rep Experience (XP)
            </span>
            <span className="font-mono text-amber-400 font-bold">{profile.xp} / {prog.nextXP} XP</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-700"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
            <span>Level {prog.level} of {prog.maxLevels}</span>
            <span>{Math.max(0, prog.nextXP - profile.xp)} XP to Level {Math.min(prog.maxLevels, prog.level + 1)}</span>
          </div>
        </div>
      </div>

      {/* Hub Tabs */}
      <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
            activeTab === 'profile' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Trophy className="w-4 h-4" /> Performance & Badges
        </button>
        <button
          onClick={() => setActiveTab('whiteboard')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
            activeTab === 'whiteboard' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <StickyNote className="w-4 h-4" /> Team Whiteboard ({notes.length})
        </button>
        <button
          onClick={() => setActiveTab('handover')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
            activeTab === 'handover' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" /> Deal Handover Desk
        </button>
        <button
          onClick={() => setActiveTab('directory')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
            activeTab === 'directory' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-4 h-4" /> Company Directory ({allEmployees.length})
        </button>
        <button
          onClick={() => setActiveTab('leave')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
            activeTab === 'leave' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" /> Annual Leave Tracker
        </button>
        {isMhraEnabled && (
          <button
            onClick={() => setActiveTab('compliance')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'compliance' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> MHRA Compliance
          </button>
        )}

        <button
          onClick={() => setActiveTab('support' as any)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'support' ? 'bg-indigo-600 text-white font-bold shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LifeBuoy className="w-4 h-4" /> Raise IT / HR Ticket
        </button>

        {isLeader && (
          <button
            onClick={() => setActiveTab('approvals')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'approvals' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Crown className="w-4 h-4 text-amber-400" /> Team Approvals ({pendingDepartmentLeaves.length})
          </button>
        )}
      </div>

      {/* Tab: HR Company Directory & Professional Credentials (Item 44) */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-400" /> HR Company Directory & Professional Credentials
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Internal telephone extensions, direct dials, management reporting lines, and verified credential profiles.
              </p>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by name, role, dept, ext..."
                value={directorySearch}
                onChange={(e) => setDirectorySearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {allEmployees
              .filter((emp) => {
                if (!directorySearch.trim()) return true;
                const q = directorySearch.toLowerCase();
                return (
                  emp.name.toLowerCase().includes(q) ||
                  emp.role.toLowerCase().includes(q) ||
                  emp.department.toLowerCase().includes(q) ||
                  (emp.phoneExtension && emp.phoneExtension.toLowerCase().includes(q)) ||
                  (emp.companyPhone && emp.companyPhone.toLowerCase().includes(q))
                );
              })
              .map((emp) => {
                const manager = allEmployees.find((m) => m.id === emp.primaryManagerId);
                return (
                  <div
                    key={emp.id || emp.name}
                    className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition space-y-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-100 text-sm flex items-center gap-2">
                            {emp.name}
                            {emp.name.toLowerCase() === currentRepName.toLowerCase() && (
                              <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono font-medium">You</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 font-medium mt-0.5">{emp.role}</div>
                          <div className="text-[11px] text-amber-400/90 font-medium">{emp.department} &bull; Tier: {emp.tier}</div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                          Lv.{emp.level || 1}
                        </span>
                      </div>

                      {/* Contact & Extension Numbers */}
                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 text-[11px] flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-slate-400" /> Extension:
                          </span>
                          <span className="font-mono font-bold text-amber-400">
                            {emp.phoneExtension || 'Not assigned'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 text-[11px]">Direct Line:</span>
                          {emp.companyPhone ? (
                            <a href={`tel:${emp.companyPhone}`} className="font-mono text-slate-200 hover:text-amber-400 underline decoration-slate-700">
                              {emp.companyPhone}
                            </a>
                          ) : (
                            <span className="text-slate-600 font-mono text-[11px]">None registered</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 text-[11px]">Line Manager:</span>
                          <span className="text-slate-200 font-medium">
                            {manager ? manager.name : 'Managing Director / Top-Level'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* External Credential & Learning Badges */}
                    <div className="pt-2.5 border-t border-slate-800/80">
                      <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">
                        Credentials & Badges
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {emp.linkedInUrl && (
                          <a
                            href={emp.linkedInUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-sky-950/60 border border-sky-800/60 text-sky-300 hover:bg-sky-900/60 transition"
                          >
                            LinkedIn <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                        {emp.duolingoProfile && (
                          <a
                            href={`https://www.duolingo.com/profile/${emp.duolingoProfile.replace('@', '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/60 transition"
                          >
                            Duolingo ({emp.duolingoProfile}) <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                        {emp.openLearnProfile && (
                          <a
                            href={emp.openLearnProfile}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-blue-950/60 border border-blue-800/60 text-blue-300 hover:bg-blue-900/60 transition"
                          >
                            OpenLearn <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                        {emp.credlyProfile && (
                          <a
                            href={emp.credlyProfile}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-amber-950/60 border border-amber-800/60 text-amber-300 hover:bg-amber-900/60 transition"
                          >
                            Credly Badges <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                        {!emp.linkedInUrl && !emp.duolingoProfile && !emp.openLearnProfile && !emp.credlyProfile && (
                          <span className="text-[11px] text-slate-500 italic">No verified badges linked</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Tab: Leader Leave Approvals */}
      {activeTab === 'approvals' && isLeader && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" /> Departmental Holiday Approval Desk
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Review and approve leave for personnel in {profile.department} (+20 XP for review actions)
              </p>
            </div>
            <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              {pendingDepartmentLeaves.length} Pending
            </span>
          </div>

          <div className="space-y-3">
            {pendingDepartmentLeaves.map((req) => (
              <div key={req.id} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200 text-xs">{req.employeeName}</span>
                    <span className="text-[10px] font-mono text-slate-400">({req.days} days) &bull; {req.leaveType}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {req.startDate} to {req.endDate} &bull; Notes: {req.notes || 'None'}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleApproveLeave(req, true)}
                    className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                  >
                    <Check className="w-3.5 h-3.5" /> Approve (+20 XP)
                  </button>
                  <button
                    onClick={() => handleApproveLeave(req, false)}
                    className="inline-flex items-center gap-1 bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                  >
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              </div>
            ))}

            {pendingDepartmentLeaves.length === 0 && (
              <div className="py-10 text-center border border-dashed border-slate-800 rounded-xl text-xs text-slate-500">
                All department holiday requests have been processed.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Annual Leave */}
      {activeTab === 'leave' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4">
            <div>
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" /> Book Annual Leave / OOO
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Automatically blocks out busy time on your Google Calendar
              </p>
            </div>

            <form onSubmit={handleCreateLeave} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Leave Category</label>
                <select
                  value={newLeave.type}
                  onChange={(e) => setNewLeave({ ...newLeave, type: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="Annual Leave">Annual Holiday Leave</option>
                  <option value="Sick Leave">Sick / Medical Leave</option>
                  <option value="Compassionate">Compassionate Leave</option>
                  <option value="Training">Training / Development</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newLeave.startDate}
                    onChange={(e) => setNewLeave({ ...newLeave, startDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">End Date</label>
                  <input
                    type="date"
                    value={newLeave.endDate}
                    onChange={(e) => setNewLeave({ ...newLeave, endDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Purpose / Handover Coverage</label>
                <input
                  type="text"
                  placeholder="e.g. Year End Holiday (Covered by David)"
                  value={newLeave.notes}
                  onChange={(e) => setNewLeave({ ...newLeave, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-400"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingLeave}
                className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold transition"
              >
                <CalendarCheck2 className="w-3.5 h-3.5" />
                {isSubmittingLeave ? 'Syncing to Calendar...' : 'Submit & Sync to Calendar (+25 XP)'}
              </button>
            </form>
          </div>

          <div className="md:col-span-2 p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div>
                <h3 className="font-bold text-slate-100 text-sm">UK Statutory Allowance Balance</h3>
                <p className="text-xs text-slate-400 mt-0.5">28 Days Total Allowance &bull; {Math.max(0, 28 - totalLeaveTaken)} Days Remaining</p>
              </div>
              <span className="font-mono text-emerald-400 text-xs font-bold bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                {totalLeaveTaken} / 28 Days Booked
              </span>
            </div>

            <div className="space-y-2.5 max-h-64 overflow-y-auto">
              {leaveList.map((req) => (
                <div key={req.id} className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-200">{req.leaveType}</span>
                      <span className="text-[10px] font-mono text-slate-400">({req.days} days)</span>
                      {req.calendarEventId && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                          <CalendarCheck2 className="w-3 h-3" /> Synced to GCal
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {req.startDate} to {req.endDate} &bull; {req.notes || 'No description'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded border ${
                      req.status === 'Approved' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                      req.status === 'Pending' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                      'text-rose-400 bg-rose-500/10 border-rose-500/20'
                    }`}>
                      <CheckCircle2 className="w-3 h-3" /> {req.status}
                    </span>

                    <button
                      onClick={() => handleDeleteLeave(req)}
                      disabled={deletingLeaveId === req.id}
                      className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition"
                      title="Cancel leave & remove from Google Calendar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Support Requests (IT & HR) */}
      {activeTab === 'support' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <LifeBuoy className="w-4 h-4 text-indigo-400" /> Internal Service Desk & Ticketing
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Raise an IT workstation issue or submit a confidential HR request directly to department leads.
              </p>
            </div>

            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSupportType('IT')}
                className={`px-3 py-1.5 rounded-lg transition ${supportType === 'IT' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400'}`}
              >
                IT Support
              </button>
              <button
                type="button"
                onClick={() => setSupportType('HR')}
                className={`px-3 py-1.5 rounded-lg transition ${supportType === 'HR' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400'}`}
              >
                HR Inquiry
              </button>
            </div>
          </div>

          <form onSubmit={handleRaiseTicket} className="space-y-4 max-w-xl">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                {supportType === 'IT' ? 'IT Incident / Asset Problem' : 'HR Subject / Request Category'}
              </label>
              <input
                type="text"
                required
                placeholder={supportType === 'IT' ? 'e.g. Cannot access VPN client or keyboard replacement' : 'e.g. Payroll tax code adjustment inquiry'}
                value={supportTitle}
                onChange={(e) => setSupportTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {supportType === 'IT' && (
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Impact & Priority</label>
                <select
                  value={supportPriority}
                  onChange={(e) => setSupportPriority(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="P1-Critical">P1 Critical (Work completely blocked)</option>
                  <option value="P2-High">P2 High (Impacting major workflow)</option>
                  <option value="P3-Medium">P3 Medium (Normal operational inquiry)</option>
                  <option value="P4-Low">P4 Low (Non-urgent enhancement)</option>
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Detailed Description</label>
              <textarea
                rows={4}
                required
                placeholder="Provide complete context, affected files, device IDs, or dates..."
                value={supportDesc}
                onChange={(e) => setSupportDesc(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition flex items-center gap-2"
            >
              <LifeBuoy className="w-4 h-4" /> Dispatch {supportType} Ticket
            </button>
          </form>
        </div>
      )}

      {/* Tab: Whiteboard */}
      {activeTab === 'whiteboard' && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <div>
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-amber-400" /> Operational Whiteboard & Ideas Canvas
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Leave announcements, sales objection tips, or strategy brainstorms for colleagues
              </p>
            </div>

            <form onSubmit={handleCreateNote} className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <input
                type="text"
                placeholder="Sticky Title..."
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400 w-36"
                required
              />
              <input
                type="text"
                placeholder="Note content / tip..."
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400 flex-1 md:w-64"
                required
              />
              <select
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none"
              >
                <option value="amber">Amber</option>
                <option value="sky">Sky Blue</option>
                <option value="emerald">Emerald</option>
                <option value="purple">Purple</option>
                <option value="rose">Rose</option>
              </select>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition"
              >
                <Plus className="w-3.5 h-3.5" /> Post Sticky (+20 XP)
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {notes.map((note) => (
              <div 
                key={note.id} 
                className={`p-4 rounded-xl border transition shadow-lg flex flex-col justify-between min-h-[160px] ${NOTE_COLORS[note.color] || NOTE_COLORS.amber}`}
              >
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
                    <h4 className="font-bold text-xs uppercase tracking-wide">{note.title}</h4>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="opacity-60 hover:opacity-100 transition text-slate-300 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap">{note.content}</p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/10 text-[10px] opacity-75 font-mono">
                  <span>By {note.author}</span>
                  <span>{note.createdAt?.slice(0, 10)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Handover */}
      {activeTab === 'handover' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4">
            <div>
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-amber-400" /> Delegate Account & Out-of-Office Handover
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Reassign deals to a covering colleague and automatically dispatch complete context briefings
              </p>
            </div>

            <form onSubmit={handleExecuteHandover} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Select Customer Account</label>
                <select
                  value={selectedContactForHandover}
                  onChange={(e) => setSelectedContactForHandover(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                  required
                >
                  <option value="">-- Choose account to delegate --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.accountNumber}>
                      [{c.accountNumber}] {c.name} - {c.company || 'Retail'} ({c.stage})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Covering Rep Name</label>
                  <input
                    type="text"
                    value={handoverCoverRep}
                    onChange={(e) => setHandoverCoverRep(e.target.value)}
                    placeholder="e.g. Nominated Colleague"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Covering Rep Email</label>
                  <input
                    type="email"
                    value={handoverCoverEmail}
                    onChange={(e) => setHandoverCoverEmail(e.target.value)}
                    placeholder="colleague@domain.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Handover Brief & Special Instructions</label>
                <textarea
                  rows={4}
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  placeholder="Key nuances: e.g. Client requested procurement follow up on Thursday regarding pricing..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition"
                >
                  {handoverSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-slate-950" /> Transfer Recorded (+35 XP)
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Transfer Account Coverage
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleOpenHandoverEmail}
                  className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-md shadow-indigo-600/20"
                  title="Prepare email brief in Gmail"
                >
                  <Mail className="w-3.5 h-3.5" /> Dispatch Gmail Memo
                </button>
              </div>
            </form>
          </div>

          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Active Managed Accounts
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Accounts currently under management:
              </p>
              
              <div className="mt-4 space-y-2 max-h-72 overflow-y-auto">
                {contacts.map((c) => (
                  <div key={c.id} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-200">{c.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {c.company || 'Retail'} &bull; <span className="text-emerald-400 font-mono">{c.accountNumber}</span>
                        {c.accountManager && (
                          <span className="text-amber-400 ml-1.5 font-sans">({c.accountManager})</span>
                        )}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30">
                      {c.stage}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-start gap-2">
              <Mail className="w-4 h-4 shrink-0 text-indigo-400 mt-0.5" />
              <span>
                Clicking <strong>Dispatch Gmail Memo</strong> auto-formats account nuances, stages, contact info, and instructions into a clean email draft ready to send to {handoverCoverRep}.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Profile */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3">
            <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" /> Unlockable Achievements
            </h3>
            <div className="space-y-2.5">
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-100">Speed Demon</div>
                  <div className="text-[10px] text-slate-400">Advance 3 deals in a single business day</div>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Unlocked</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-100">Zero-Storage Master</div>
                  <div className="text-[10px] text-slate-400">Maintain 100% sync integrity on Google Drive</div>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Active</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-100">Whiteboard Strategist</div>
                  <div className="text-[10px] text-slate-400">Post 5 architecture sticky notes</div>
                </div>
                <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {notes.length}/5
                </span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3">
            <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400" /> XP Multipliers & Rules
            </h3>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span>Advance Deal Stage</span>
                <span className="font-mono text-emerald-400 font-semibold">+50 XP</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span>Intake Lead & Verified CRN</span>
                <span className="font-mono text-emerald-400 font-semibold">+35 XP</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span>Re-allocated Workload Absorbed</span>
                <span className="font-mono text-emerald-400 font-semibold">+25 XP</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span>Approve / Review Team Leave</span>
                <span className="font-mono text-emerald-400 font-semibold">+20 XP</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span>Log Annual Leave & Sync GCal OOO</span>
                <span className="font-mono text-emerald-400 font-semibold">+25 XP</span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3 flex flex-col justify-between">
            <div>
              <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-400" /> Progression Standing
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Staff advance through 10 operational levels (200 XP/level), while Leaders & Managers advance through 5 command tiers (250 XP/tier).
              </p>
            </div>
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
              <span className="text-xs text-purple-300 block font-semibold">{profile.tier} Title</span>
              <span className="text-xl font-extrabold text-purple-400">{prog.title}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Pharma / MHRA Compliance Matrix (Opt-in only) */}
      {activeTab === 'compliance' && isMhraEnabled && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" /> Pharma & MHRA Regulatory Compliance Matrix
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Active industry vertical: Statutory GDP, GMP, Pharmacovigilance, and COSHH certifications for MHRA audits.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {certificates.filter(c => c.status === 'Active').length}/{certificates.length} Active
                </span>
                <button
                  type="button"
                  onClick={() => setIsRenewModalOpen(true)}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg flex items-center gap-1.5 transition shadow"
                >
                  <Plus className="w-4 h-4" /> Log / Renew Certificate
                </button>
              </div>
            </div>

            {/* Matrix Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {certificates.map((cert) => {
                const isExpiring = cert.status === 'Expiring Soon';
                const isExpired = cert.status === 'Expired';
                return (
                  <div
                    key={cert.id || cert.certificationName}
                    className={`p-5 rounded-xl border transition ${
                      isExpired
                        ? 'bg-rose-950/20 border-rose-500/40'
                        : isExpiring
                        ? 'bg-amber-950/20 border-amber-500/40'
                        : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider mb-2 border ${
                          isExpired
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : isExpiring
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        }`}>
                          {cert.status}
                        </span>
                        <h4 className="text-sm font-bold text-slate-100">{cert.certificationName}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">Issuing Body: {cert.issuingBody}</p>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                        {cert.certificateRef || 'REF-PENDING'}
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                      <div>
                        <span>Completed: {cert.completedDate}</span>
                        <span className="mx-2">•</span>
                        <span className={isExpiring ? 'text-amber-400 font-semibold' : isExpired ? 'text-rose-400 font-semibold' : ''}>
                          Expires: {cert.expiryDate}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const newExpiry = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
                          await db.complianceCertificates.update(cert.id!, {
                            status: 'Active',
                            completedDate: new Date().toISOString().slice(0, 10),
                            expiryDate: newExpiry
                          });
                          const updated = await db.complianceCertificates.toArray();
                          setCertificates(updated);
                        }}
                        className="text-[11px] text-amber-400 hover:text-amber-300 font-medium hover:underline"
                      >
                        Quick Refresh (+35 XP)
                      </button>
                    </div>

                    {cert.notes && (
                      <p className="text-[11px] text-slate-400 mt-2 bg-slate-900/50 p-2 rounded border border-slate-800/50 italic">
                        {cert.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modal to log or renew certificate */}
          {isRenewModalOpen && (
            <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h4 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" /> Log Regulatory Certificate Renewal
                  </h4>
                  <button
                    onClick={() => setIsRenewModalOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Standard / Certification Name</label>
                    <input
                      type="text"
                      value={certForm.certificationName}
                      onChange={(e) => setCertForm({ ...certForm, certificationName: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Issuing Authority / Body</label>
                    <input
                      type="text"
                      value={certForm.issuingBody}
                      onChange={(e) => setCertForm({ ...certForm, issuingBody: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Completed Date</label>
                      <input
                        type="date"
                        value={certForm.completedDate}
                        onChange={(e) => setCertForm({ ...certForm, completedDate: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Expiry Date</label>
                      <input
                        type="date"
                        value={certForm.expiryDate}
                        onChange={(e) => setCertForm({ ...certForm, expiryDate: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Certificate Number / Reference</label>
                    <input
                      type="text"
                      value={certForm.certificateRef}
                      onChange={(e) => setCertForm({ ...certForm, certificateRef: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Auditor / Refresher Notes</label>
                    <textarea
                      rows={2}
                      value={certForm.notes}
                      onChange={(e) => setCertForm({ ...certForm, notes: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRenewModalOpen(false)}
                    className="flex-1 py-2 text-xs text-slate-400 border border-slate-800 rounded-lg hover:bg-slate-850"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const newCert: Omit<ComplianceCertificate, 'id'> = {
                        employeeId: profile?.id || 1,
                        employeeName: profile?.name || 'Staff Member',
                        department: profile?.department || 'Operations',
                        certificationName: certForm.certificationName,
                        issuingBody: certForm.issuingBody,
                        completedDate: certForm.completedDate,
                        expiryDate: certForm.expiryDate,
                        status: 'Active',
                        certificateRef: certForm.certificateRef,
                        notes: certForm.notes,
                        createdAt: new Date().toISOString()
                      };
                      await db.complianceCertificates.add(newCert as any);
                      const updated = await db.complianceCertificates.toArray();
                      setCertificates(updated);
                      setIsRenewModalOpen(false);
                    }}
                    className="flex-1 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition shadow"
                  >
                    Save & Award +35 XP
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
