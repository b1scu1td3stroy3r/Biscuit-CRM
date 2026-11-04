'use client';

import React, { useState, useEffect } from 'react';
import { Cloud, ShieldCheck, Download, RefreshCw, AlertCircle, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { Contact, db } from '../packages/storage/src/db';
import { getMicrosoftSession, clearMicrosoftSession, exportContactsToExcel } from '../packages/storage/src/microsoftSync';

interface CloudAccountDeskProps {
  contacts: Contact[];
  onDataRefreshed: () => void;
}

export default function CloudAccountDesk({ contacts, onDataRefreshed }: CloudAccountDeskProps) {
  const [activeProvider, setActiveProvider] = useState<'google' | 'microsoft' | 'local'>('google');
  const [msSession, setMsSession] = useState(getMicrosoftSession());
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  useEffect(() => {
    const prov = (localStorage.getItem('biscuit_active_cloud_provider') as any) || 'google';
    setActiveProvider(prov);
  }, []);

  const handleConnectMicrosoft = () => {
    const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID || '';
    const redirectUri = window.location.origin;
    const scopes = encodeURIComponent('offline_access User.Read Files.ReadWrite.AppFolder Calendars.ReadWrite Mail.Send');
    
    // Microsoft identity authorization endpoint
    const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=${scopes}&prompt=select_account`;
    window.location.href = url;
  };

  const handleDisconnectMicrosoft = () => {
    clearMicrosoftSession();
    setMsSession(null);
    setActiveProvider('google');
  };

  const handleExportExcel = async () => {
    setSyncStatus('Generating clean Excel export (.xlsx compatible)...');
    await exportContactsToExcel(contacts);
    setTimeout(() => setSyncStatus(null), 3000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Cloud className="w-5 h-5 text-sky-400" />
            Cloud Storage & Office Suite Integration
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Link either Google Workspace or Microsoft 365 to handle zero-storage client backups, email dispatch, and calendar leave.
          </p>
        </div>

        {/* Export to Excel action button */}
        <button
          onClick={handleExportExcel}
          className="inline-flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3.5 py-2 rounded-xl text-xs font-semibold transition"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Export to Excel (.xlsx)
        </button>
      </div>

      {syncStatus && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          {syncStatus}
        </div>
      )}

      {/* Grid comparing Google vs Microsoft */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Google Workspace Card */}
        <div className={`p-4 rounded-xl border transition ${
          activeProvider === 'google' ? 'bg-slate-950 border-amber-500/50 shadow-sm' : 'bg-slate-950/40 border-slate-800'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-slate-200 text-sm">Google Workspace</span>
            {activeProvider === 'google' && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                Active Provider
              </span>
            )}
          </div>
          <ul className="text-xs text-slate-400 space-y-1.5 mb-4">
            <li>&bull; Backups stored in your private Google Drive App Folder</li>
            <li>&bull; Leave schedules synced to Google Calendar</li>
            <li>&bull; Exports format to Google Sheets</li>
          </ul>
          <button
            onClick={() => {
              setActiveProvider('google');
              localStorage.setItem('biscuit_active_cloud_provider', 'google');
            }}
            className="w-full text-xs font-bold py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          >
            {activeProvider === 'google' ? 'Connected & In Use' : 'Switch to Google Drive'}
          </button>
        </div>

        {/* Microsoft 365 Card */}
        <div className={`p-4 rounded-xl border transition ${
          activeProvider === 'microsoft' ? 'bg-slate-950 border-sky-500/50 shadow-sm' : 'bg-slate-950/40 border-slate-800'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-slate-200 text-sm">Microsoft 365 / Entra</span>
            {activeProvider === 'microsoft' && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/30">
                Active Provider
              </span>
            )}
          </div>
          <ul className="text-xs text-slate-400 space-y-1.5 mb-4">
            <li>&bull; Backups stored in Microsoft OneDrive App Folder</li>
            <li>&bull; Leave schedules synced to Outlook Calendar</li>
            <li>&bull; Direct formatting and export to Excel (.xlsx)</li>
          </ul>
          {msSession ? (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setActiveProvider('microsoft');
                  localStorage.setItem('biscuit_active_cloud_provider', 'microsoft');
                }}
                className="flex-1 text-xs font-bold py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 transition"
              >
                Use Microsoft
              </button>
              <button
                onClick={handleDisconnectMicrosoft}
                className="px-3 py-2 text-xs text-rose-400 hover:bg-rose-950/30 rounded-lg border border-rose-900/50"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectMicrosoft}
              className="w-full text-xs font-bold py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 transition"
            >
              Sign In with Microsoft
            </button>
          )}
        </div>
      </div>

      {/* Safety & Anti-Duplication Assurance Note */}
      <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1 text-slate-400">
          <strong className="text-slate-200">Safe Sync & Duplicate Protection:</strong>
          <p>
            When switching between Google and Microsoft, Biscuit performs a field-level merge matched on account number and business email. Records will not duplicate, and missing files on one service will never trigger local deletion.
          </p>
        </div>
      </div>
    </div>
  );
}
