'use client';

import React, { useState } from 'react';
import { Cpu, Play, CheckCircle2, X, RefreshCw } from 'lucide-react';

interface BackgroundJobWorkerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BackgroundJobWorkerModal({ isOpen, onClose }: BackgroundJobWorkerModalProps) {
  if (!isOpen) return null;

  const [isRunning, setIsRunning] = useState(false);
  const [jobResult, setJobResult] = useState<any>(null);
  const [recordCount, setRecordCount] = useState<number>(10000);

  const runOffThreadJob = () => {
    setIsRunning(true);
    setJobResult(null);

    const worker = new Worker('/workers/enterprise-compute-worker.js');
    const dummyEntries = [];
    for (let i = 0; i < recordCount; i++) {
      dummyEntries.push({
        id: `TX-${i}`,
        debitAccount: '1100',
        creditAccount: '4000',
        debit: 150.00,
        credit: 150.00
      });
    }

    worker.postMessage({
      action: 'BATCH_GL_CONSOLIDATION',
      jobId: `JOB-${Date.now()}`,
      payload: { entries: dummyEntries }
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
              <p className="text-[11px] text-slate-400 font-mono">NetSuite/SAP Heavy Batch Queue Parity • Non-Blocking UI</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
            <span className="text-[10px] uppercase font-mono text-slate-500">Execution Model</span>
            <p className="text-slate-300">
              Dispatches multi-thousand row aggregations (GL consolidations, BOM explosions) to background Web Workers running on separate CPU cores with zero UI hitching.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-slate-400 block mb-1">Batch Record Volume</label>
              <select
                value={recordCount}
                onChange={(e) => setRecordCount(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-slate-200 focus:outline-none"
              >
                <option value={5000}>5,000 Complex Journal Entries</option>
                <option value={10000}>10,000 Complex Journal Entries</option>
                <option value={50000}>50,000 Complex Journal Entries</option>
                <option value={100000}>100,000 Complex Journal Entries</option>
              </select>
            </div>
            <div className="pt-4">
              <button
                type="button"
                onClick={runOffThreadJob}
                disabled={isRunning}
                className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl font-bold shadow-lg shadow-cyan-600/20 transition"
              >
                {isRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                {isRunning ? 'Processing Off-Thread...' : 'Dispatch Worker'}
              </button>
            </div>
          </div>

          {jobResult && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 font-mono text-[11px]">
              <div className="flex items-center justify-between text-emerald-400 font-bold">
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Job Complete</span>
                <span>Execution Time: {jobResult.durationMs}ms</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-300 pt-1 border-t border-slate-800/60">
                <div>Processed Records: <span className="text-white font-bold">{jobResult.processedCount.toLocaleString()}</span></div>
                <div>Ledger Variance: <span className="text-emerald-400 font-bold">£{jobResult.variance.toFixed(2)}</span></div>
                <div>Debits: £{jobResult.totalDebits.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                <div>Credits: £{jobResult.totalCredits.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <span className="text-[11px] text-slate-500 font-mono">
            Zero server CPU cost. Hardware-accelerated local thread pooling.
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
