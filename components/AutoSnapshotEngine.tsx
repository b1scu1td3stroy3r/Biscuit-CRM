'use client';

import React, { useEffect, useState } from 'react';
import { db } from '../packages/storage/src/db';
import { HardDrive, ShieldCheck, Download, AlertCircle, RefreshCw } from 'lucide-react';

export default function AutoSnapshotEngine() {
  const [isPersisted, setIsPersisted] = useState<boolean | null>(null);
  const [lastSnapshot, setLastSnapshot] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    async function checkPersistence() {
      if (typeof window !== 'undefined' && navigator.storage && navigator.storage.persisted) {
        const persisted = await navigator.storage.persisted();
        setIsPersisted(persisted);
        if (!persisted && navigator.storage.persist) {
          const granted = await navigator.storage.persist();
          setIsPersisted(granted);
        }
      }
    }
    checkPersistence();

    const storedLast = localStorage.getItem('biscuit_last_snapshot');
    if (storedLast) setLastSnapshot(storedLast);

    const handleBeforeUnload = () => {
      localStorage.setItem('biscuit_last_session_exit', new Date().toISOString());
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const triggerDatabaseExport = async () => {
    try {
      const dump: Record<string, any[]> = {};
      const tableNames = db.tables.map(t => t.name);

      for (const name of tableNames) {
        dump[name] = await db.table(name).toArray();
      }

      const backupPayload = {
        meta: {
          app: 'Biscuit CRM',
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          recordCounts: Object.fromEntries(Object.entries(dump).map(([k, v]) => [k, v.length]))
        },
        data: dump
      };

      const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `biscuit_secure_snapshot_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);

      const now = new Date().toLocaleString();
      localStorage.setItem('biscuit_last_snapshot', now);
      setLastSnapshot(now);
      setShowPrompt(false);
    } catch (err) {
      alert('Failed to export local database snapshot.');
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowPrompt(true)}
          title="Zero-Knowledge Local Storage Status"
          className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg text-[11px] font-mono text-slate-300 transition"
        >
          <HardDrive className={`w-3.5 h-3.5 ${isPersisted ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span>{isPersisted ? 'Storage Locked' : 'Persistent Storage'}</span>
        </button>
      </div>

      {showPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                <ShieldCheck className="w-6 h-6" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-white">Client-Side Database Safeguard</h3>
                <p className="text-xs text-slate-400">Zero-custody storage integrity & export</p>
              </div>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-300">
                <span>Browser Storage Status:</span>
                <span className={isPersisted ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                  {isPersisted ? 'Persistent (Eviction Immune)' : 'Standard'}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Last Exported Snapshot:</span>
                <span className="text-slate-400">{lastSnapshot || 'Never'}</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Because Biscuit CRM stores all company records exclusively in your browser without central servers, regular snapshots protect against accidental browser cache clearance.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPrompt(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
              <button
                type="button"
                onClick={triggerDatabaseExport}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition"
              >
                <Download className="w-3.5 h-3.5" />
                Export Full Snapshot (.json)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
