'use client';

import React, { useState, useEffect } from 'react';
import { Zap, CheckCircle2, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  title: string;
  description: string;
  timestamp: string;
}

export default function LiveActivityToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    // Global listener for enterprise workflow triggers
    const handleWorkflowEvent = (e: CustomEvent) => {
      const { title, description } = e.detail;
      const newToast: ToastMessage = {
        id: `toast-${Date.now()}-${Math.random()}`,
        title,
        description,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };

      setToasts(prev => [newToast, ...prev].slice(0, 4));

      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== newToast.id));
      }, 5000);
    };

    window.addEventListener('biscuit-crm-activity' as any, handleWorkflowEvent);
    return () => window.removeEventListener('biscuit-crm-activity' as any, handleWorkflowEvent);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="pointer-events-auto bg-slate-900/95 border border-amber-500/40 text-white p-3.5 rounded-xl shadow-2xl backdrop-blur-md flex items-start gap-3 animate-in slide-in-from-bottom-3 duration-200"
        >
          <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg shrink-0 mt-0.5">
            <Zap className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-amber-300">{toast.title}</h4>
              <span className="text-[10px] text-slate-500 font-mono">{toast.timestamp}</span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5 leading-snug">{toast.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
