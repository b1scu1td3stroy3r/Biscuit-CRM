'use client';

import React, { useState, useEffect } from 'react';
import { 
  Trophy, Award, Flame, UserCheck, Calendar, ArrowRightLeft, 
  StickyNote, Plus, Trash2, CheckCircle2, Clock, ShieldCheck, 
  Sparkles, Check, AlertCircle, Send
} from 'lucide-react';
import { db, Contact, WhiteboardNote, LeaveRequest, EmployeeProfile } from '../packages/storage/src/db';

interface EmployeeHubProps {
  currentRepName: string;
  contacts: Contact[];
  onRepNameChange: (newName: string) => void;
  onAdvanceContactStage?: (contact: Contact) => void;
}

const NOTE_COLORS = {
  amber: 'bg-amber-950/40 border-amber-500/30 text-amber-200',
  sky: 'bg-sky-950/40 border-sky-500/30 text-sky-200',
  emerald: 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200',
  purple: 'bg-purple-950/40 border-purple-500/30 text-purple-200',
  rose: 'bg-rose-950/40 border-rose-500/30 text-rose-200',
};

export default function EmployeeHub({
  currentRepName,
  contacts,
  onRepNameChange,
}: EmployeeHubProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'handover' | 'whiteboard' | 'leave'>('profile');
  
  // Gamification & Profile State
  const [profile, setProfile] = useState<EmployeeProfile>({
    name: currentRepName || 'Sarah Jenkins',
    role: 'Senior Account Executive',
    xp: 380,
    level: 2,
    dealsClosed: 4,
    handoverActive: false,
  });

  // Whiteboard State
  const [notes, setNotes] = useState<WhiteboardNote[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [selectedColor, setSelectedColor] = useState<'amber' | 'sky' | 'emerald' | 'purple' | 'rose'>('amber');

  // Leave Requests State
  const [leaveList, setLeaveList] = useState<LeaveRequest[]>([]);
  const [newLeave, setNewLeave] = useState({
    type: 'Annual Leave' as const,
    startDate: '2026-11-20',
    endDate: '2026-11-27',
    notes: 'Q4 Holiday',
  });

  // Handover State
  const [selectedContactForHandover, setSelectedContactForHandover] = useState<string>('');
  const [handoverCoverRep, setHandoverCoverRep] = useState('David Miller');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [handoverSuccess, setHandoverSuccess] = useState(false);

  const loadHubData = async () => {
    try {
      const storedNotes = await db.whiteboardNotes.toArray();
      setNotes(storedNotes.reverse());

      const storedLeave = await db.leaveRequests.toArray();
      setLeaveList(storedLeave.reverse());

      const allProfiles = await db.employees.toArray();
      const existing = allProfiles.find(p => p.name.toLowerCase() === currentRepName.toLowerCase());
      if (existing) {
        setProfile(existing);
      } else {
        const initial = {
          name: currentRepName,
          role: 'Senior Account Executive',
          xp: 450,
          level: 2,
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
    const updatedLevel = Math.floor(updatedXP / 250) + 1;
    const updatedProfile = { ...profile, xp: updatedXP, level: updatedLevel };
    setProfile(updatedProfile);
    if (profile.id) {
      await db.employees.update(profile.id, { xp: updatedXP, level: updatedLevel });
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
    await addXP(20, 'Contributed to Team Whiteboard');
    await loadHubData();
  };

  const handleDeleteNote = async (id?: number) => {
    if (!id) return;
    await db.whiteboardNotes.delete(id);
    await loadHubData();
  };

  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    const start = new Date(newLeave.startDate);
    const end = new Date(newLeave.endDate);
    const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    await db.leaveRequests.add({
      employeeName: currentRepName,
      leaveType: newLeave.type,
      startDate: newLeave.startDate,
      endDate: newLeave.endDate,
      days: diffDays,
      status: 'Approved',
      notes: newLeave.notes,
      createdAt: new Date().toISOString(),
    });

    await addXP(15, 'Scheduled PTO & Leave Coverage');
    await loadHubData();
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

      setHandoverSuccess(true);
      await addXP(35, 'Delegated Deal Handover');
      setTimeout(() => setHandoverSuccess(false), 3000);
      setHandoverNotes('');
    }
  };

  // Rank determination
  const getRank = (lvl: number) => {
    if (lvl >= 5) return { title: 'Grandmaster Dealmaker', badge: 'border-purple-500/40 text-purple-400 bg-purple-500/10' };
    if (lvl >= 3) return { title: 'Pipeline Closer', badge: 'border-amber-500/40 text-amber-400 bg-amber-500/10' };
    return { title: 'Rookie Account Rep', badge: 'border-sky-500/40 text-sky-400 bg-sky-500/10' };
  };

  const rank = getRank(profile.level);
  const nextLevelXP = profile.level * 250;
  const currentLevelBaseXP = (profile.level - 1) * 250;
  const progressPercent = Math.min(100, Math.max(0, ((profile.xp - currentLevelBaseXP) / (nextLevelXP - currentLevelBaseXP)) * 100));

  const totalLeaveTaken = leaveList
    .filter(l => l.employeeName.toLowerCase() === currentRepName.toLowerCase() && l.status === 'Approved')
    .reduce((acc, l) => acc + l.days, 0);

  return (
    <section className="space-y-6 mb-8">
      {/* Top Profile & XP Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center text-amber-400 font-extrabold text-2xl shadow-inner">
              {currentRepName.charAt(0)}
            </div>
            <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500 text-slate-950 shadow">
              Lv.{profile.level}
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
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${rank.badge}`}>
                {rank.title}
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2 mt-1">
              <span>{profile.role}</span>
              <span>&bull;</span>
              <span className="text-emerald-400 font-mono">{contacts.length} Accounts Monitored</span>
            </p>
          </div>
        </div>

        {/* XP Counter Widget */}
        <div className="w-full md:w-80 p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-500 animate-pulse" /> Rep Experience (XP)
            </span>
            <span className="font-mono text-amber-400 font-bold">{profile.xp} / {nextLevelXP} XP</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-700"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
            <span>Level {profile.level}</span>
            <span>{nextLevelXP - profile.xp} XP to Level {profile.level + 1}</span>
          </div>
        </div>
      </div>

      {/* Hub Tabs Navigation */}
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
          onClick={() => setActiveTab('leave')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
            activeTab === 'leave' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" /> Annual Leave Tracker
        </button>
      </div>

      {/* Tab 1: Profile & Badges */}
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
                <span>Submit Deal Handover</span>
                <span className="font-mono text-emerald-400 font-semibold">+25 XP</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span>Post Whiteboard Sticky</span>
                <span className="font-mono text-emerald-400 font-semibold">+20 XP</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span>Log Annual Leave Request</span>
                <span className="font-mono text-emerald-400 font-semibold">+15 XP</span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3 flex flex-col justify-between">
            <div>
              <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-400" /> Rep Standing
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Rep levels determine priority deal allocation and automated routing quotas across your pipeline.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
              <span className="text-xs text-purple-300 block font-semibold">Tier Status</span>
              <span className="text-xl font-extrabold text-purple-400">{rank.title}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Team Whiteboard Canvas */}
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

            {notes.length === 0 && (
              <div className="col-span-full py-12 text-center border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                No sticky notes on the whiteboard yet. Post your team&apos;s first message above!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Deal Handover Desk */}
      {activeTab === 'handover' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4">
            <div>
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-amber-400" /> Delegate Account & Out-of-Office Handover
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Reassign deals to a covering colleague while on leave with full context logs attached
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
                      [{c.accountNumber}] {c.name} - {c.company} ({c.stage})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Covering Representative</label>
                <input
                  type="text"
                  value={handoverCoverRep}
                  onChange={(e) => setHandoverCoverRep(e.target.value)}
                  placeholder="e.g. David Miller"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                  required
                />
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

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition"
              >
                {handoverSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-slate-950" /> Handover Assigned & Synced! (+35 XP)
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Transfer Account Coverage
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Active Managed Accounts
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Accounts currently assigned to {currentRepName}:
              </p>
              
              <div className="mt-4 space-y-2 max-h-72 overflow-y-auto">
                {contacts
                  .filter(c => !c.accountManager || c.accountManager.includes(currentRepName))
                  .map((c) => (
                    <div key={c.id} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-slate-200">{c.name}</div>
                        <div className="text-[10px] text-slate-400">{c.company} &bull; <span className="text-emerald-400 font-mono">{c.accountNumber}</span></div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30">
                        {c.stage}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
              Handing over an account automatically updates the Google Drive Master ledger with the covering rep&apos;s name and logs instructions into confidential notes.
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Annual Leave & Out of Office Tracker */}
      {activeTab === 'leave' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" /> Book Annual Leave / OOO
            </h3>

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
                  placeholder="e.g. Q4 Vacation (Covered by David)"
                  value={newLeave.notes}
                  onChange={(e) => setNewLeave({ ...newLeave, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-400"
                />
              </div>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold transition"
              >
                <Plus className="w-3.5 h-3.5" /> Submit Request (+15 XP)
              </button>
            </form>
          </div>

          <div className="md:col-span-2 p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div>
                <h3 className="font-bold text-slate-100 text-sm">UK Statutory Allowance Balance</h3>
                <p className="text-xs text-slate-400 mt-0.5">28 Days Total Allowance &bull; {28 - totalLeaveTaken} Days Remaining</p>
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
                      <span className="text-[10px] text-slate-400 font-mono">({req.days} days)</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {req.startDate} to {req.endDate} &bull; {req.notes || 'No description'}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" /> {req.status}
                  </span>
                </div>
              ))}

              {leaveList.length === 0 && (
                <div className="py-8 text-center border border-dashed border-slate-800 rounded-lg text-slate-500 text-xs">
                  No annual leave requests recorded. Submit your first holiday booking above.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
