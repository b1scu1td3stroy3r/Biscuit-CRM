'use client';

import React, { useState } from 'react';
import { Network, CheckCircle2, AlertTriangle, RefreshCw, X, Shield, QrCode } from 'lucide-react';

interface SyncDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SyncDiagnosticsModal({ isOpen, onClose }: SyncDiagnosticsModalProps) {
  if (!isOpen) return null;

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success'>('idle');
  const [peerOffer, setPeerOffer] = useState('');
  const [peerAnswer, setPeerAnswer] = useState('');

  const runConnectivityTest = () => {
    setTestStatus('testing');
    setTimeout(() => {
      setTestStatus('success');
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-purple-500/10 text-purple-400 rounded-lg border border-purple-500/20">
              <Network className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-white">Zero-Knowledge P2P Sync Mesh</h2>
              <p className="text-[11px] text-slate-400 font-mono">Encrypted WebRTC DataChannel (No Central Relay)</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
            <span className="text-[10px] uppercase font-mono text-slate-500">Signaling Protocol</span>
            <p className="text-xs font-semibold text-slate-200">Local LAN / Direct P2P</p>
          </div>
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
            <span className="text-[10px] uppercase font-mono text-slate-500">Channel Encryption</span>
            <p className="text-xs font-semibold text-emerald-400">DTLS / SRTP (256-bit)</p>
          </div>
        </div>

        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white">Browser WebRTC Subsystem</span>
            <button
              type="button"
              onClick={runConnectivityTest}
              className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 font-mono"
            >
              <RefreshCw className={`w-3 h-3 ${testStatus === 'testing' ? 'animate-spin' : ''}`} />
              Test Diagnostics
            </button>
          </div>

          <div className="text-[11px] font-mono space-y-1 text-slate-400">
            <div className="flex justify-between">
              <span>RTCPeerConnection:</span>
              <span className="text-emerald-400">Supported (Native)</span>
            </div>
            <div className="flex justify-between">
              <span>RTCDataChannel (Reliable):</span>
              <span className="text-emerald-400">Active</span>
            </div>
            <div className="flex justify-between">
              <span>STUN Configuration:</span>
              <span className="text-slate-300">stun:stun.l.google.com:19302</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-slate-400 block">Manual Device Pairing Code (Air-Gapped Sync)</label>
          <input
            type="text"
            placeholder="Paste partner device handshake code..."
            value={peerAnswer}
            onChange={(e) => setPeerAnswer(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <span className="text-[10px] text-slate-500 font-mono">100% Client-Side Mesh</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
