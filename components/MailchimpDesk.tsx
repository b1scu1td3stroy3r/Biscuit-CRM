'use client';

import React, { useState, useEffect } from 'react';
import { 
  Megaphone, Send, CheckCircle2, AlertCircle, RefreshCw, 
  ExternalLink, Users, Key, Target, Sparkles
} from 'lucide-react';
import { Contact, db } from '../packages/storage/src/db';

interface MailchimpDeskProps {
  contacts: Contact[];
  onDataChanged: () => void;
  onAwardXP: (amount: number, reason: string) => void;
}

export default function MailchimpDesk({ contacts, onDataChanged, onAwardXP }: MailchimpDeskProps) {
  const [apiKey, setApiKey] = useState('');
  const [audienceId, setAudienceId] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [batchSyncing, setBatchSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const savedKey = localStorage.getItem('biscuit_crm_mailchimp_key');
    const savedList = localStorage.getItem('biscuit_crm_mailchimp_list');
    if (savedKey) setApiKey(savedKey);
    if (savedList) setAudienceId(savedList);
    if (savedKey && savedList) setIsConfigured(true);
  }, []);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('biscuit_crm_mailchimp_key', apiKey.trim());
    localStorage.setItem('biscuit_crm_mailchimp_list', audienceId.trim());
    setIsConfigured(true);
    setStatusMessage('Mailchimp configuration saved locally.');
  };

  const handleSyncContact = async (contact: Contact) => {
    if (!contact.id || !apiKey || !audienceId) return;
    setSyncingId(contact.id);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/mailchimp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          audienceId: audienceId.trim(),
          contact,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to sync');

      await db.contacts.update(contact.id, {
        mailchimpStatus: 'Synced',
        updatedAt: new Date().toISOString(),
      });

      onAwardXP(20, `Synced ${contact.name} to Mailchimp Audience`);
      setStatusMessage(`Synced ${contact.name} to Mailchimp audience successfully.`);
      onDataChanged();
    } catch (err: any) {
      alert(`Mailchimp Sync Error: ${err.message}`);
    } finally {
      setSyncingId(null);
    }
  };

  const handleBatchSyncAllProspects = async () => {
    const targets = contacts.filter(c => (c.stage === 'Prospect' || c.stage === 'Lead') && c.mailchimpStatus !== 'Synced');
    if (targets.length === 0) {
      alert('All prospects and inbound leads are already synced to Mailchimp.');
      return;
    }

    setBatchSyncing(true);
    let count = 0;

    for (const c of targets) {
      if (c.id) {
        try {
          await fetch('/api/mailchimp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey: apiKey.trim(),
              audienceId: audienceId.trim(),
              contact: c,
            }),
          });
          await db.contacts.update(c.id, { mailchimpStatus: 'Synced' });
          count++;
        } catch (e) {
          console.warn('Batch item skipped:', e);
        }
      }
    }

    setBatchSyncing(false);
    onAwardXP(count * 15, `Batch synced ${count} prospects to Mailchimp`);
    setStatusMessage(`Batch sync complete: ${count} contacts subscribed to Mailchimp audience.`);
    onDataChanged();
  };

  return (
    <section className="space-y-6">
      {/* Configuration Box */}
      <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Mailchimp Marketing Audience Connector</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Zero platform storage &bull; Stored securely in your browser session &bull; Subscribes prospects to drip email sequences
              </p>
            </div>
          </div>
          {isConfigured && (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" /> API Connected
            </span>
          )}
        </div>

        <form onSubmit={handleSaveConfig} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Mailchimp API Key</label>
            <input
              type="password"
              placeholder="e.g. 847291a...-us19"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono"
              required
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Audience / List ID</label>
            <input
              type="text"
              placeholder="e.g. 5e91ba02"
              value={audienceId}
              onChange={(e) => setAudienceId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono"
              required
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition"
            >
              Save Credentials
            </button>
          </div>
        </form>

        {statusMessage && (
          <div className="text-xs text-emerald-300 font-mono bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20">
            {statusMessage}
          </div>
        )}
      </div>

      {/* Sync Table & Action Bar */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h4 className="font-semibold text-slate-100 text-sm">Prospects & Leads Ready for Campaign Sync</h4>
            <p className="text-xs text-slate-400 mt-0.5">Push contacts into Mailchimp lists with custom demographic tags</p>
          </div>

          <button
            onClick={handleBatchSyncAllProspects}
            disabled={!isConfigured || batchSyncing}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-bold transition shadow"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${batchSyncing ? 'animate-spin' : ''}`} /> Batch Sync All Unsynced Prospects
          </button>
        </div>

        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-900/80 text-xs uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-5 py-3">Account No</th>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Company</th>
              <th className="px-5 py-3">Email Address</th>
              <th className="px-5 py-3">Stage</th>
              <th className="px-5 py-3">Mailchimp Sync</th>
              <th className="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {contacts.map((c) => (
              <tr key={c.id} className="hover:bg-slate-800/30 transition">
                <td className="px-5 py-3.5 font-mono text-emerald-400 font-semibold text-xs">{c.accountNumber}</td>
                <td className="px-5 py-3.5 font-semibold text-slate-100">{c.name}</td>
                <td className="px-5 py-3.5 text-xs text-slate-400">{c.company || '—'}</td>
                <td className="px-5 py-3.5 text-xs text-slate-300">{c.email}</td>
                <td className="px-5 py-3.5">
                  <span className="px-2 py-0.5 text-[11px] rounded bg-slate-800 text-slate-300 border border-slate-700">{c.stage}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                    c.mailchimpStatus === 'Synced'
                      ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                      : 'border-slate-700 text-slate-400 bg-slate-800'
                  }`}>
                    {c.mailchimpStatus || 'Not Synced'}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    onClick={() => handleSyncContact(c)}
                    disabled={!isConfigured || syncingId === c.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-semibold text-xs transition"
                  >
                    {syncingId === c.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Sync Member
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
