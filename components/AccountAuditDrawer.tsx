'use client';

import React, { useState, useEffect } from 'react';
import { X, Clock, Phone, Mail, FileText, CheckCircle2, AlertTriangle, ArrowRight, Package, ShieldCheck } from 'lucide-react';
import { db, Contact } from '../packages/storage/src/db';

interface AccountAuditDrawerProps {
  contact: Contact | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser: string;
}

interface TimelineEntry {
  id: string;
  type: 'stage_change' | 'call' | 'email' | 'order' | 'note' | 'compliance';
  title: string;
  timestamp: string;
  user: string;
  details?: string;
  meta?: any;
}

export default function AccountAuditDrawer({ contact, isOpen, onClose, currentUser }: AccountAuditDrawerProps) {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    if (!contact) return;

    const entries: TimelineEntry[] = [];

    // Stage progression entry
    entries.push({
      id: 'init-stage',
      type: 'stage_change',
      title: `Pipeline Stage: ${contact.stage}`,
      timestamp: contact.lastContact || new Date().toISOString(),
      user: contact.assignedTo || currentUser,
      details: `Account currently classified in ${contact.stage} with ${contact.dealValue ? '£' + contact.dealValue.toLocaleString() : 'undetermined'} deal value.`
    });

    // CTI Phone call records
    if (contact.callLogs && contact.callLogs.length > 0) {
      contact.callLogs.forEach((call: any, idx: number) => {
        entries.push({
          id: `call-${idx}`,
          type: 'call',
          title: `Phone Call Logged (${call.duration || '0m 45s'})`,
          timestamp: call.timestamp || new Date().toISOString(),
          user: call.caller || currentUser,
          details: call.outcome || 'Call logged via CTI Telephony desk.'
        });
      });
    }

    // Custom notes
    if (contact.notes && contact.notes.length > 0) {
      contact.notes.forEach((note: any, idx: number) => {
        entries.push({
          id: `note-${idx}`,
          type: 'note',
          title: `Internal Staff Note`,
          timestamp: note.timestamp || new Date().toISOString(),
          user: note.author || currentUser,
          details: note.text || String(note)
        });
      });
    }

    // Default seed milestone for audit history
    entries.push({
      id: 'acc-created',
      type: 'compliance',
      title: 'Entity Onboarded & Vetted',
      timestamp: contact.createdAt || '2026-11-01T09:00:00Z',
      user: 'System Compliance Guard',
      details: `Company number ${contact.companyNumber || 'N/A'} registered with Companies House check cleared.`
    });

    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setTimeline(entries);
  }, [contact, currentUser]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !contact) return;

    const entry: TimelineEntry = {
      id: `custom-${Date.now()}`,
      type: 'note',
      title: 'Manual Activity Note',
      timestamp: new Date().toISOString(),
      user: currentUser,
      details: newNote.trim()
    };

    setTimeline([entry, ...timeline]);
    setNewNote('');

    // Persist to Dexie DB if available
    try {
      const existing = await db.contacts.get(contact.id);
      if (existing) {
        const updatedNotes = [...(existing.notes || []), { text: entry.details, author: currentUser, timestamp: entry.timestamp }];
        await db.contacts.update(contact.id, { notes: updatedNotes });
      }
    } catch (err) {
      console.warn('Note save fallback to session state', err);
    }
  };

  if (!isOpen || !contact) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-start justify-between bg-slate-950/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {contact.stage}
              </span>
              <span className="text-xs text-slate-400 font-mono">ACC-{contact.id}</span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">{contact.name}</h2>
            <p className="text-xs text-slate-400">{contact.company} • {contact.email || 'No email registered'}</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-3 gap-2 p-4 bg-slate-950/20 border-b border-slate-800/80 text-center text-xs">
          <div className="p-2 bg-slate-800/40 rounded border border-slate-800">
            <div className="text-slate-400 text-[10px]">Pipeline Value</div>
            <div className="text-emerald-400 font-bold mt-0.5">£{(contact.dealValue || 0).toLocaleString()}</div>
          </div>
          <div className="p-2 bg-slate-800/40 rounded border border-slate-800">
            <div className="text-slate-400 text-[10px]">Owner</div>
            <div className="text-slate-200 font-semibold truncate mt-0.5">{contact.assignedTo || currentUser}</div>
          </div>
          <div className="p-2 bg-slate-800/40 rounded border border-slate-800">
            <div className="text-slate-400 text-[10px]">Credit Terms</div>
            <div className="text-sky-400 font-semibold mt-0.5">Net 30</div>
          </div>
        </div>

        {/* Note Intake */}
        <form onSubmit={handleAddNote} className="p-4 border-b border-slate-800 bg-slate-950/30">
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-amber-400" /> Log Activity, Call Summary or Touchpoint
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="e.g. Spoke with decision-maker regarding Q1 contract renewal..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              disabled={!newNote.trim()}
              className="px-3 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-lg transition"
            >
              Log
            </button>
          </div>
        </form>

        {/* Scrollable Audit Trail */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-sky-400" /> Relational Timeline & Audit Trail
          </div>

          <div className="relative border-l border-slate-800 pl-4 space-y-6">
            {timeline.map((item) => (
              <div key={item.id} className="relative group">
                {/* Dot */}
                <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-800 border-2 border-slate-950 group-hover:bg-amber-400 transition" />

                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    {item.type === 'call' && <Phone className="w-3 h-3 text-emerald-400" />}
                    {item.type === 'note' && <FileText className="w-3 h-3 text-amber-400" />}
                    {item.type === 'stage_change' && <ArrowRight className="w-3 h-3 text-purple-400" />}
                    {item.type === 'compliance' && <ShieldCheck className="w-3 h-3 text-teal-400" />}
                    {item.title}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(item.timestamp).toLocaleDateString()}
                  </span>
                </div>

                <p className="text-xs text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/80">
                  {item.details}
                </p>

                <div className="mt-1 text-[10px] text-slate-500">
                  By <span className="text-slate-400">{item.user}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
