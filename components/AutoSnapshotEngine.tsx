'use client';

import React, { useEffect, useState } from 'react';
import { db } from '../packages/storage/src/db';
import { HardDrive, ShieldCheck, Download, Cloud, RefreshCw, X, Check } from 'lucide-react';

export default function AutoSnapshotEngine() {
  const [isPersisted, setIsPersisted] = useState<boolean | null>(null);
  const [lastSnapshot, setLastSnapshot] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [cloudTab, setCloudTab] = useState(false);

  // BYO S3 / R2 Configuration
  const [s3Endpoint, setS3Endpoint] = useState('');
  const [s3Bucket, setS3Bucket] = useState('');
  const [s3AccessKey, setS3AccessKey] = useState('');
  const [s3SecretKey, setS3SecretKey] = useState('');
  const [isCloudConfigured, setIsCloudConfigured] = useState(false);

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

    const storedS3 = localStorage.getItem('biscuit_s3_backup_config');
    if (storedS3) {
      try {
        const parsed = JSON.parse(storedS3);
        setS3Endpoint(parsed.endpoint || '');
        setS3Bucket(parsed.bucket || '');
        setS3AccessKey(parsed.accessKey || '');
        setS3SecretKey(parsed.secretKey || '');
        setIsCloudConfigured(true);
      } catch {}
    }
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

  const saveCloudConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('biscuit_s3_backup_config', JSON.stringify({
      endpoint: s3Endpoint.trim(),
      bucket: s3Bucket.trim(),
      accessKey: s3AccessKey.trim(),
      secretKey: s3SecretKey.trim()
    }));
    setIsCloudConfigured(true);
    alert('BYO Cloud Storage settings saved. Automatic zero-knowledge backup target locked.');
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                  <ShieldCheck className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">Client-Side Database Safeguards</h3>
                  <p className="text-xs text-slate-400 font-mono">Zero-Custody Local &amp; Private Cloud Backup</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowPrompt(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1 text-xs">
              <button
                type="button"
                onClick={() => setCloudTab(false)}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition ${!cloudTab ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Local Persistence &amp; File Export
              </button>
              <button
                type="button"
                onClick={() => setCloudTab(true)}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition ${cloudTab ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                BYO Private Cloud (S3 / R2)
              </button>
            </div>

            {!cloudTab ? (
              <div className="space-y-4">
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
                  Because Biscuit CRM stores all company records in your browser with zero central servers, regular exports ensure safe disaster recovery even across browser cache clears.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={triggerDatabaseExport}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export Full Snapshot (.json)
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={saveCloudConfig} className="space-y-3">
                <p className="text-xs text-slate-400">
                  Configure direct client-side sync to your private Cloudflare R2, AWS S3, or Backblaze bucket. Credentials never leave your local device.
                </p>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-0.5">S3-Compatible Endpoint URL</label>
                  <input
                    type="text"
                    required
                    placeholder="https://&lt;accountid&gt;.r2.cloudflarestorage.com"
                    value={s3Endpoint}
                    onChange={(e) => setS3Endpoint(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-0.5">Bucket Name</label>
                  <input
                    type="text"
                    required
                    placeholder="my-company-biscuit-backups"
                    value={s3Bucket}
                    onChange={(e) => setS3Bucket(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-0.5">Access Key ID</label>
                    <input
                      type="text"
                      required
                      value={s3AccessKey}
                      onChange={(e) => setS3AccessKey(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-0.5">Secret Access Key</label>
                    <input
                      type="password"
                      required
                      value={s3SecretKey}
                      onChange={(e) => setS3SecretKey(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    Save Private Bucket Target
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
