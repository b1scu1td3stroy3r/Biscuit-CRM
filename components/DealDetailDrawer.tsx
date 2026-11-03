'use client';

import React, { useEffect, useState } from 'react';
import { 
  X, Building2, Mail, Phone, Calendar, History, Briefcase, 
  CheckCircle2, Clock, ShieldCheck, ArrowRight, ExternalLink,
  UserCheck, MapPin, FileEdit, Save, Check
} from 'lucide-react';
import { Contact, ProjectTask, db } from '../packages/storage/src/db';

interface DealDetailDrawerProps {
  contact: Contact | null;
  isOpen: boolean;
  onClose: () => void;
  onAdvanceStage?: (contact: Contact) => void;
  onContactUpdated?: () => void;
}

export default function DealDetailDrawer({
  contact,
  isOpen,
  onClose,
  onAdvanceStage,
  onContactUpdated,
}: DealDetailDrawerProps) {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [relatedTasks, setRelatedTasks] = useState<ProjectTask[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'history' | 'deals'>('overview');
  
  // Editable fields
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    crn: '',
    email: '',
    phone: '',
    accountManager: '',
    billingAddress: '',
    shippingAddress: '',
    internalNotes: '',
  });

  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (!contact) return;

    setFormData({
      name: contact.name || '',
      company: contact.company || '',
      crn: contact.crn || '',
      email: contact.email || '',
      phone: contact.phone || '',
      accountManager: contact.accountManager || 'Unassigned',
      billingAddress: contact.billingAddress || '',
      shippingAddress: contact.shippingAddress || '',
      internalNotes: contact.internalNotes || '',
    });

    const fetchDetails = async () => {
      try {
        const rawDb = db as any;
        const auditTable = rawDb.auditLogs || rawDb.audit;
        if (auditTable && typeof auditTable.toArray === 'function') {
          const allAudits = await auditTable.toArray();
          const entityId = `Contact_${contact.id}`;
          const logs = allAudits.filter(
            (a: any) => a.entityId === entityId || (a.details && a.details.includes(contact.name))
          );
          setAuditLogs(logs.reverse());
        }
      } catch (e) {
        console.warn('Audit logs skipped:', e);
      }

      try {
        if (db.projects && typeof db.projects.toArray === 'function') {
          const allTasks = await db.projects.toArray();
          const matchingTasks = allTasks.filter(
            (t) => t.companyName?.toLowerCase() === contact.company?.toLowerCase()
          );
          setRelatedTasks(matchingTasks);
        }
      } catch (e) {
        console.warn('Projects fetch skipped:', e);
      }
    };

    fetchDetails();
  }, [contact]);

  const handleSaveChanges = async () => {
    if (!contact?.id) return;
    const now = new Date().toISOString();

    await db.contacts.update(contact.id, {
      ...formData,
      synced: false,
      updatedAt: now,
    });

    await db.outbox.add({
      type: 'UPDATE',
      table: 'contacts',
      payload: { id: contact.id, ...formData, updatedAt: now },
      timestamp: Date.now(),
    });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    if (onContactUpdated) onContactUpdated();
  };

  if (!isOpen || !contact) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-slate-950 border-l border-slate-800 shadow-2xl flex flex-col justify-between">
          
          {/* Header */}
          <div className="p-6 border-b border-slate-800/80 bg-slate-900/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-lg">
                  {formData.name.charAt(0) || 'C'}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-100">{formData.name}</h2>
                  <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <Building2 className="w-3.5 h-3.5 text-sky-400" />
                    <span>{formData.company}</span>
                    {formData.crn && (
                      <span className="font-mono text-sky-400 text-[10px] bg-sky-950/40 border border-sky-900/40 px-1.5 py-0.5 rounded">
                        CRN: {formData.crn}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 mt-6 border-b border-slate-800/60 pb-1">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                  activeTab === 'overview' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Account Details
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                  activeTab === 'notes' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Internal Notes {formData.internalNotes ? '•' : ''}
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                  activeTab === 'history' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Deal & Stage History ({auditLogs.length})
              </button>
              <button
                onClick={() => setActiveTab('deals')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                  activeTab === 'deals' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Milestones ({relatedTasks.length})
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Tab 1: Account Overview & Editable Fields */}
            {activeTab === 'overview' && (
              <div className="space-y-5">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1">
                      Current Stage
                    </span>
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/30">
                      {contact.stage}
                    </span>
                  </div>
                  {onAdvanceStage && (
                    <button
                      onClick={() => onAdvanceStage(contact)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition"
                    >
                      Advance Stage <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Account Manager Assignment */}
                <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-2">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-amber-400" /> Account Manager
                  </label>
                  <input
                    type="text"
                    value={formData.accountManager}
                    placeholder="e.g. Sarah Jenkins (Senior AE)"
                    onChange={(e) => setFormData({ ...formData, accountManager: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Contact Information Fields */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
                    Direct Contact Channels
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Full Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Company</label>
                      <input
                        type="text"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={formData.phone}
                        placeholder="+44 20 7946 0912"
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Addresses */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-sky-400" /> Operational Addresses
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Billing Address</label>
                      <textarea
                        rows={2}
                        value={formData.billingAddress}
                        placeholder="e.g. 100 Liverpool St, London EC2M 2AT"
                        onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Shipping / Fulfilment Address</label>
                      <textarea
                        rows={2}
                        value={formData.shippingAddress}
                        placeholder="e.g. Unit 4, Gateway Logistics Park, Milton Keynes"
                        onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Internal Notes */}
            {activeTab === 'notes' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <FileEdit className="w-3.5 h-3.5 text-amber-400" /> Confidential Team Notes
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">Persists to Local IndexedDB & Sheets</span>
                </div>

                <textarea
                  rows={14}
                  value={formData.internalNotes}
                  placeholder="Record commercial requirements, stakeholder nuances, payment terms, or custom delivery specifications here..."
                  onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-xs font-sans text-slate-200 leading-relaxed focus:outline-none focus:border-amber-400"
                />
              </div>
            )}

            {/* Tab 3: History & Audit */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-indigo-400" /> Stage Transitions & Audit Trail
                </h3>

                {auditLogs.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl space-y-2">
                    <ShieldCheck className="w-6 h-6 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-400 font-medium">Record Active</p>
                    <p className="text-[11px] text-slate-600">
                      Created on {contact.updatedAt.slice(0, 10)}.
                    </p>
                  </div>
                ) : (
                  <div className="relative border-l border-slate-800 ml-3 space-y-6">
                    {auditLogs.map((log, index) => (
                      <div key={index} className="relative pl-6">
                        <span className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-slate-900 border-2 border-amber-400" />
                        <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-200">{log.action}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{log.timestamp?.slice(0, 19)}</span>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">{log.details}</p>
                          <div className="text-[10px] text-indigo-400 font-mono pt-1">Actor: {log.actor}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Milestones */}
            {activeTab === 'deals' && (
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-amber-400" /> Connected Delivery Milestones
                </h3>

                {relatedTasks.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl space-y-2">
                    <Clock className="w-6 h-6 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-400 font-medium">No linked delivery milestones</p>
                    <p className="text-[11px] text-slate-600">
                      Create milestone timelines in the Gantt & Milestones view for {formData.company}.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {relatedTasks.map((t) => (
                      <div key={t.id} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-slate-200">{t.title}</h4>
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            {t.progress}% Complete
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {t.startDate} to {t.endDate}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer with Save Changes */}
          <div className="p-5 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
            >
              Close
            </button>
            <button
              onClick={handleSaveChanges}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition shadow-md shadow-amber-500/10"
            >
              {isSaved ? (
                <>
                  <Check className="w-3.5 h-3.5 text-slate-950" /> Saved!
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" /> Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
