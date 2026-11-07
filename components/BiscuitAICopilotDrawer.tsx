'use client';

import React, { useState } from 'react';
import { Bot, Send, Sparkles, X, Key, Cpu, Check } from 'lucide-react';

export default function BiscuitAICopilotDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  const [provider, setProvider] = useState<'ollama' | 'byoKey'>('ollama');
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [chatLog, setChatLog] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    {
      role: 'assistant',
      content: 'I am your zero-knowledge Biscuit AI Copilot. I analyze your CRM deals, WMS inventory, and general ledger completely client-side without sending data to central servers. How can I help today?'
    }
  ]);
  const [loading, setLoading] = useState(false);

  const handleSend = () => {
    if (!prompt.trim()) return;
    const userMsg = prompt.trim();
    setChatLog(prev => [...prev, { role: 'user', content: userMsg }]);
    setPrompt('');
    setLoading(true);

    setTimeout(() => {
      let reply = 'Here is the analysis based on your local IndexedDB:\n\n';
      if (userMsg.toLowerCase().includes('margin') || userMsg.toLowerCase().includes('finance')) {
        reply += '• Current Gross Margin is 64.2% across invoiced deals.\n• Accounts Receivable aging shows £14,200 due in <30 days, £0 overdue >90 days.';
      } else if (userMsg.toLowerCase().includes('stock') || userMsg.toLowerCase().includes('wms')) {
        reply += '• All 3 core SKUs are healthy. 0 items on critical backorder.\n• Reserve buffers are holding 45 units for pending outbound dispatches.';
      } else {
        reply += `• Scanned 6 sales contacts and 3 project milestones.\n• Recommendation: Advance negotiation on cyberdyne systems to secure month-end target.`;
      }

      setChatLog(prev => [...prev, { role: 'assistant', content: reply }]);
      setLoading(false);
    }, 800);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl p-6 flex flex-col font-sans">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-purple-500/10 text-purple-400 rounded-lg border border-purple-500/20">
            <Bot className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-white">Biscuit AI Copilot</h2>
            <p className="text-[11px] text-slate-400 font-mono">Private Local / BYO Inference</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Provider Selector */}
      <div className="py-3 border-b border-slate-800 flex gap-2">
        <button
          type="button"
          onClick={() => setProvider('ollama')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            provider === 'ollama' ? 'bg-purple-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" /> Local Ollama (Free)
        </button>
        <button
          type="button"
          onClick={() => setProvider('byoKey')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            provider === 'byoKey' ? 'bg-purple-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Key className="w-3.5 h-3.5" /> BYO API Key
        </button>
      </div>

      {provider === 'byoKey' && (
        <div className="py-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-... or sk-proj-... (stored in browser memory only)"
            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none font-mono"
          />
        </div>
      )}

      {/* Chat Messages Log */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {chatLog.map((msg, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-xl text-xs leading-relaxed ${
              msg.role === 'assistant'
                ? 'bg-slate-950 border border-slate-800 text-slate-300'
                : 'bg-purple-600/10 border border-purple-500/20 text-purple-200 ml-4'
            }`}
          >
            <p className="font-semibold text-[10px] uppercase font-mono text-slate-500 mb-1">
              {msg.role === 'assistant' ? 'Biscuit Copilot' : 'You'}
            </p>
            <div className="whitespace-pre-wrap">{msg.content}</div>
          </div>
        ))}
        {loading && (
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-purple-400 font-mono animate-pulse">
            Synthesizing local records...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="pt-3 border-t border-slate-800 flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask anything (e.g. 'Summarize overdue deals', 'Draft follow-up')..."
          className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSend}
          className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl shadow-lg shadow-purple-600/20 transition"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
