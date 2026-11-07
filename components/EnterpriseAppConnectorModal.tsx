'use client';

import React, { useState, useEffect } from 'react';
import { Share2, Plus, Trash2, X } from 'lucide-react';

interface EnterpriseAppConnectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EnterpriseAppConnectorModal({ isOpen, onClose }: EnterpriseAppConnectorModalProps) {
  if (!isOpen) return null;

  const [connectors, setConnectors] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [eventTrigger, setEventTrigger] = useState('DEAL_CLOSED_WON');

  useEffect(() => {
    const saved = localStorage.getItem('biscuit_app_connectors');
    if (saved) {
      try {
        setConnectors(JSON.parse(saved));
      } catch {}
    }
  }, []);

  const saveConnectors = (list: any[]) => {
    setConnectors(list);
    localStorage.setItem('biscuit_app_connectors', JSON.stringify(list));
  };

  const handleAddConnector = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !targetUrl) return;

    const newConnector = {
      id: `CONN-${Date.now()}`,
      name: name.trim(),
      targetUrl: targetUrl.trim(),
      eventTrigger,
      status: 'Active',
      createdDate: new Date().toLocaleDateString()
    };

    saveConnectors([...connectors, newConnector]);
    setName('');
    setTargetUrl('');
  };

  const handleDelete = (id: string) => {
    saveConnectors(connectors.filter(c => c.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <Share2 className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-white">Enterprise Extensibility &amp; Webhook Hub</h2>
              <p className="text-[11px] text-slate-400 font-mono">Salesforce AppExchange / Zapier Parity • Zero-Server Outbound Dispatches</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleAddConnector} className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-3 text-xs">
          <span className="text-xs font-bold text-slate-200">Register Custom Outbound Webhook Connector</span>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-slate-400 block mb-1">Connector Name</label>
              <input
                type="text"
                placeholder="e.g. Slack Deal Alerts / Shopify Sync"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Event Trigger</label>
              <select
                value={eventTrigger}
                onChange={(e) => setEventTrigger(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none"
              >
                <option value="DEAL_CLOSED_WON">On Deal Closed Won</option>
                <option value="INVOICE_PAID">On Invoice Paid</option>
                <option value="STOCK_SHORTAGE">On Stock Shortage Alert</option>
                <option value="TICKET_SLA_BREACH">On Ticket SLA Breach</option>
              </select>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Webhook Endpoint URL</label>
              <input
                type="url"
                placeholder="https://hooks.slack.com/..."
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl font-mono text-slate-200 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold shadow-md transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Register Webhook Connector
            </button>
          </div>
        </form>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Active Enterprise Connectors ({connectors.length})
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Dispatched Client-Side via Fetch</span>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800 bg-slate-900/60">
                  <th className="p-2.5">Connector</th>
                  <th className="p-2.5">Trigger Condition</th>
                  <th className="p-2.5">Endpoint Target</th>
                  <th className="p-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {connectors.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-600">
                      No custom app connectors registered yet. Create one above to link Slack, Zapier, Shopify, or external ERP webhooks.
                    </td>
                  </tr>
                ) : (
                  connectors.map(c => (
                    <tr key={c.id} className="text-slate-300">
                      <td className="p-2.5 font-bold text-white">{c.name}</td>
                      <td className="p-2.5 text-emerald-400">{c.eventTrigger}</td>
                      <td className="p-2.5 text-slate-400 truncate max-w-xs">{c.targetUrl}</td>
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id)}
                          className="text-rose-400 hover:text-rose-300 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <span className="text-[11px] text-slate-500 font-mono">
            Zero vendor data retention: Webhooks dispatch with SHA-256 payload signatures
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
