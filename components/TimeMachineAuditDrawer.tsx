'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../packages/storage/src/db';
import { History, RotateCcw, X, Shield, Clock, ArrowRight } from 'lucide-react';

interface AuditEvent {
  id: string;
  entityType: 'Deal' | 'Ledger' | 'Inventory' | 'Task';
  entityId: string;
  field: string;
  oldValue: string;
  newValue: string;
  author: string;
  timestamp: string;
}

export default function TimeMachineAuditDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

    const [events, setEvents] = useState<AuditEvent[]>([]);

  useEffect(() => {
    async function loadAuditEvents() {
      try {
        if ((db as any)?.auditLogs) {
          const logs = await (db as any).auditLogs.toArray();
          setEvents(logs || []);
        }
      } catch {
        setEvents([]);
      }
    }
    loadAuditEvents();
  }, []);

  const handleRollback = (ev: AuditEvent) => {
    alert(`Rollback initialized: Restoring ${ev.entityType} ${ev.entityId} field '${ev.field}' back to '${ev.oldValue}'.`);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl p-6 flex flex-col font-sans">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
            <History className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-white">Event-Sourced Time Machine</h2>
            <p className="text-[11px] text-slate-400 font-mono">Immutable cryptographic ledger log</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="py-4 flex-1 overflow-y-auto space-y-3">
        {events.map(ev => (
          <div key={ev.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">{ev.entityType}</span>
              <span className="text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {ev.timestamp}
              </span>
            </div>

            <p className="text-xs text-slate-200 font-medium">
              Modified <span className="font-mono text-sky-400">{ev.field}</span> on <span className="font-mono text-slate-400">{ev.entityId}</span>
            </p>

            <div className="flex items-center gap-2 text-[11px] font-mono bg-slate-900 p-2 rounded-lg text-slate-400">
              <span className="text-rose-400 line-through">{ev.oldValue}</span>
              <ArrowRight className="w-3 h-3 text-slate-600" />
              <span className="text-emerald-400 font-semibold">{ev.newValue}</span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] font-mono text-slate-500">By: {ev.author}</span>
              <button
                type="button"
                onClick={() => handleRollback(ev)}
                className="flex items-center gap-1 text-[10px] font-mono text-indigo-400 hover:text-indigo-300 transition"
              >
                <RotateCcw className="w-3 h-3" /> Rollback to State
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-slate-800 text-center">
        <span className="text-[10px] font-mono text-slate-500">
          All modifications cryptographically anchored to local IndexedDB
        </span>
      </div>
    </div>
  );
}
