'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, Building2, User, Mail, Phone, PhoneCall, MapPin, Hash, CheckCircle2, 
  Clock, ArrowRight, ShieldCheck, FileText, Calendar, Plus, RefreshCw, AlertCircle
} from 'lucide-react';
import { Contact, db } from '../packages/storage/src/db';

interface DealDetailDrawerProps {
  contact: Contact | null;
  isOpen: boolean;
  onClose: () => void;
  onAdvanceStage: (contact: Contact) => void;
  onContactUpdated: () => void;
}

const STAGES = [
  'Prospect',
  'Lead',
  'Sales',
  'Procurement',
  'Logistics',
  'Customer Service',
  'Winback'
] as const;

export default function DealDetailDrawer({
  contact,
  isOpen,
  onClose,
  onAdvanceStage,
  onContactUpdated,
}: DealDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'milestones'>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Contact>>({});
  const [newNote, setNewNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (contact) {
      setFormData(contact);
    }
  }, [contact]);

  if (!isOpen || !contact) return null;

  const handleDial = (phoneNumber: string) => {
    const proto = localStorage.getItem('biscuit_crm_cti_protocol') || 'tel';
    const cleanNumber = phoneNumber.replace(/[^0-9+]/g, '');
    window.location.href = `${proto}:${cleanNumber}`;
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact.id) return;
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const updated = {
        ...formData,
        synced: false,
        updatedAt: now,
      };

      await db.contacts.update(contact.id, updated);
      await db.outbox.add({
        type: 'UPDATE',
        table: 'contacts',
        payload: { id: contact.id, ...updated },
        timestamp: Date.now(),
      });

      setIsEditing(false);
      onContactUpdated();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !contact.id) return;
    setIsSaving(true);

    try {
      const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
      const stampedNote = `\n[NOTE ${timestamp}]: ${newNote.trim()}`;
      const updatedNotes = `${contact.internalNotes || ''}${stampedNote}`;

      await db.contacts.update(contact.id, {
        internalNotes: updatedNotes,
        synced: false,
        updatedAt: new Date().toISOString(),
      });

      await db.outbox.add({
        type: 'UPDATE',
        table: 'contacts',
        payload: {
          id: contact.id,
          internalNotes: updatedNotes,
          updatedAt: new Date().toISOString(),
        },
        timestamp: Date.now(),
      });

      setNewNote('');
      setFormData({ ...formData, internalNotes: updatedNotes });
      onContactUpdated();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="p-6 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
                  {contact.accountNumber}
                </span>
                <h2 className="text-lg font-bold text-slate-100 mt-2">{contact.name}</h2>
                <p className="text-xs text-slate-400">{contact.company || 'Private Client'}</p>
              </div>

              <button 
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex border-b border-slate-800 bg-slate-900/50 px-6">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-3 text-xs font-semibold border-b-2 mr-6 transition ${
                  activeTab === 'overview'
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`py-3 text-xs font-semibold border-b-2 transition ${
                  activeTab === 'notes'
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Notes & Timeline
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(100vh-220px)] space-y-6">
              {activeTab === 'overview' && (
                <div>
                  {!isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                          Pipeline Stage
                        </span>
                        <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {contact.stage}
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                          Account Manager
                        </span>
                        <p className="text-xs text-slate-200">{contact.accountManager || 'Unassigned'}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                            Email
                          </span>
                          <a href={`mailto:${contact.email}`} className="text-xs text-indigo-400 hover:underline break-all">
                            {contact.email}
                          </a>
                        </div>
                        <div>
                          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                            Phone (Click to Dial)
                          </span>
                          {contact.phone ? (
                            <button
                              onClick={() => handleDial(contact.phone)}
                              className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-mono font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 rounded-lg transition"
                              title="Click to dial via 4Com / Softphone / VoIP"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                              {contact.phone}
                            </button>
                          ) : (
                            <p className="text-xs text-slate-400">—</p>
                          )}
                        </div>
                      </div>

                      {contact.crn && (
                        <div>
                          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                            Companies House CRN
                          </span>
                          <span className="text-xs font-mono text-slate-300 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                            #{contact.crn}
                          </span>
                        </div>
                      )}

                      <div>
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                          Billing Address
                        </span>
                        <p className="text-xs text-slate-400 whitespace-pre-wrap">{contact.billingAddress || '—'}</p>
                      </div>

                      <div>
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                          Shipping Address
                        </span>
                        <p className="text-xs text-slate-400 whitespace-pre-wrap">{contact.shippingAddress || '—'}</p>
                      </div>

                      <div className="pt-2">
                        <button
                          onClick={() => setIsEditing(true)}
                          className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                        >
                          Edit Details
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSaveContact} className="space-y-3.5">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Stage</label>
                        <select
                          value={formData.stage}
                          onChange={(e) => setFormData({ ...formData, stage: e.target.value as any })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
                        >
                          {STAGES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Contact Name</label>
                        <input
                          type="text"
                          value={formData.name || ''}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Company</label>
                        <input
                          type="text"
                          value={formData.company || ''}
                          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Email</label>
                        <input
                          type="email"
                          value={formData.email || ''}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Phone</label>
                        <input
                          type="text"
                          value={formData.phone || ''}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Account Manager</label>
                        <input
                          type="text"
                          value={formData.accountManager || ''}
                          onChange={(e) => setFormData({ ...formData, accountManager: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Billing Address</label>
                        <textarea
                          rows={2}
                          value={formData.billingAddress || ''}
                          onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Shipping Address</label>
                        <textarea
                          rows={2}
                          value={formData.shippingAddress || ''}
                          onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-100"
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsEditing(false)}
                          className="flex-1 py-1.5 text-xs text-slate-400 border border-slate-800 rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSaving}
                          className="flex-1 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg"
                        >
                          Save
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {activeTab === 'notes' && (
                <div className="space-y-4">
                  <form onSubmit={handleAddNote} className="space-y-2">
                    <textarea
                      rows={3}
                      placeholder="Type a new update, call note, or objection..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="submit"
                      disabled={isSaving || !newNote.trim()}
                      className="w-full py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition"
                    >
                      Post Account Note
                    </button>
                  </form>

                  <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs font-mono text-slate-300 max-h-80 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {contact.internalNotes || 'No notes logged yet. Use the field above to add notes.'}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-mono">
              Updated: {contact.updatedAt?.slice(0, 10)}
            </span>
            <button
              onClick={() => onAdvanceStage(contact)}
              className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition"
            >
              Advance Stage <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
