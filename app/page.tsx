'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Zap, Database, Building2, Calendar, 
  FileText, CheckCircle2, Loader2, FolderCheck, Plus, Search, RefreshCw, ExternalLink
} from 'lucide-react';
import { db, Contact } from '../packages/storage/src/db';
import { syncOutboxToGoogleSheets } from '../packages/storage/src/sheetsSync';

declare global {
  interface Window {
    google?: any;
    gapi?: any;
  }
}

export default function Dashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('ready');
  const [folderId] = useState<string>('1WK1GE6vGTuS1KGCC607Jdkcc6464YaST');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedSheetId, setLastSyncedSheetId] = useState<string | null>(null);

  // Modal & Search state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Form state
  const [newContact, setNewContact] = useState({
    name: '',
    company: '',
    crn: '',
    email: '',
    phone: '',
    stage: 'Lead' as const,
  });

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/spreadsheets',
  ].join(' ');

  const loadContacts = async () => {
    const list = await db.contacts.toArray();
    setContacts(list);
  };

  useEffect(() => {
    loadContacts();
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
      setLastSyncedSheetId(res.sheetId);
      await loadContacts();
    } catch (err) {
      console.error(err);
      alert('Sync failed. Please check browser console.');
    } finally {
      setIsSyncing(false);
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
    await loadContacts();
  };

  const hasUnsynced = contacts.some(c => !c.synced);

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <header className="flex items-center justify-between border-b border-slate-800 pb-6 mb-10">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <span>🍪</span> Biscuit CRM
          </h1>
          <p className="text-sm text-slate-400 mt-1">Zero-Storage Business Operating System</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            System Live
          </span>
        </div>
      </header>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-3 mb-2 text-amber-400 font-semibold">
            <Database className="w-5 h-5" /> Storage Cost
          </div>
          <p className="text-2xl font-bold">£0 / mo</p>
          <p className="text-xs text-slate-400 mt-1">Runs 100% on personal Google Drive</p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-3 mb-2 text-indigo-400 font-semibold">
            <Zap className="w-5 h-5" /> Outbox Engine
          </div>
          <p className="text-2xl font-bold">Dexie IndexedDB</p>
          <p className="text-xs text-slate-400 mt-1">{contacts.length} Records in local browser storage</p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-3 mb-2 text-emerald-400 font-semibold">
            <ShieldCheck className="w-5 h-5" /> Data Sovereignty
          </div>
          <p className="text-2xl font-bold">GDPR / Zero Cloud</p>
          <p className="text-xs text-slate-400 mt-1">Direct HTTPS browser-to-Google link</p>
        </div>
      </section>

      {/* Sync Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-100">Authenticated & Synced</h3>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <FolderCheck className="w-3.5 h-3.5 text-emerald-400" />
              Drive Root Folder ID: <code className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">{folderId}</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasUnsynced && (
            <button
              onClick={handleSyncToSheets}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              Flush Outbox to Drive
            </button>
          )}

          {lastSyncedSheetId && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${lastSyncedSheetId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:underline"
            >
              Open Sheet <ExternalLink className="w-3 h-3" />
            </a>
          )}

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2.5 rounded-lg text-sm transition shadow-lg shadow-amber-500/10"
          >
            <Plus className="w-4 h-4" /> Add Lead & UK CRN
          </button>
        </div>
      </div>

      {/* Table */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-slate-200">Active Pipeline Records</h2>
          <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full">{contacts.length} Contacts</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-3">Contact</th>
                <th className="px-6 py-3">Company & CRN</th>
                <th className="px-6 py-3">Stage</th>
                <th className="px-6 py-3">Outbox Sync</th>
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
                        <CheckCircle2 className="w-3.5 h-3.5" /> Synced to Sheets
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                        IndexedDB Ready
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal */}
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
