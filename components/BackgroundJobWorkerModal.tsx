'use client';

import React, { useState } from 'react';
import { db } from '../packages/storage/src/db';
import { Cpu, Play, CheckCircle2, X, RefreshCw, AlertCircle } from 'lucide-react';

interface BackgroundJobWorkerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BackgroundJobWorkerModal({ isOpen, onClose }: BackgroundJobWorkerModalProps) {
  if (!isOpen) return null;

  const [isRunning, setIsRunning] = useState(false);
  const [jobResult, setJobResult] = useState<any>(null);
  const [emptyWarning, setEmptyWarning] = useState(false);

  const runOffThreadJob = async () => {
    setIsRunning(true);
    setJobResult(null);
    setEmptyWarning(false);

    try {
      const realEntries = await (db as any).journalEntries.toArray();

      if (!realEntries || realEntries.length === 0) {
        setIsRunning(false);
        setEmptyWarning(true);
        return;
      }

      const worker = new Worker('/workers/enterprise-compute-worker.js');

      worker.postMessage({
        action: 'BATCH_GL_CONSOLIDATION',
        jobId: `JOB-${Date.now()}`,
        payload: { entries: realEntries }
      });

      worker.onmessage = (e) => {
        setJobResult(e.data.result);
        setIsRunning(false);
        worker.terminate();
      };

      worker.onerror = () => {
        setIsRunning(false);
        worker.terminate();
      };
    } catch {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20">
              <Cpu className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-white">Dedicated Off-Thread Compute Worker</h2>
              <p className="text-[11px] text-slate-400 font-mono">Real-Time Dexie Ledger Aggregation • Zero Synthetic Data</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
            <span className="text-[10px] uppercase font-mono text-slate-500">Live Operating Mode</span>
            <p className="text-slate-300">
              Dispatches your actual recorded ledger entries from IndexedDB (<code className="text-cyan-400">db.journalEntries</code>) to an isolated background thread, maintaining full UI responsiveness during consolidation runs.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={runOffThreadJob}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl font-bold shadow-lg shadow-cyan-600/20 transition"
            >
              {isRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {isRunning ? 'Processing Ledger...' : 'Execute Live Consolidation'}
            </button>
          </div>

          {emptyWarning && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 text-amber-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>No live journal entries found in <code className="font-mono">db.journalEntries</code>. Record invoices or import transactions first.</span>
            </div>
          )}

          {jobResult && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 font-mono text-[11px]">
              <div className="flex items-center justify-between text-emerald-400 font-bold">
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Consolidation Completed</span>
                <span>Execution Time: {jobResult.durationMs}ms</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-300 pt-1 border-t border-slate-800/60">
                <div>Live Ledger Records: <span className="text-white font-bold">{jobResult.processedCount.toLocaleString()}</span></div>
                <div>Balance Variance: <span className="text-emerald-400 font-bold">£{jobResult.variance.toFixed(2)}</span></div>
                <div>Total Debits: £{jobResult.totalDebits.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                <div>Total Credits: £{jobResult.totalCredits.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <span className="text-[11px] text-slate-500 font-mono">
            Zero synthetic rows. Hardware-backed background worker.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
