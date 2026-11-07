'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Phone, PhoneCall, PhoneIncoming, PhoneOff, Clock, User, 
  Building2, CheckCircle2, AlertCircle, Play, Square, ExternalLink, Zap
} from 'lucide-react';
import { Contact, db } from '../packages/storage/src/db';

interface TelephonyDeskProps {
  contacts: Contact[];
  onOpenContact: (contact: Contact) => void;
  onAwardXP: (amount: number, reason: string) => void;
  currentUser: string;
}

export default function TelephonyDesk({
  contacts,
  onOpenContact,
  onAwardXP,
  currentUser,
}: TelephonyDeskProps) {
  const [ctiProtocol, setCtiProtocol] = useState<'tel' | 'callto' | 'sip'>('tel');
  const [activeCallContact, setActiveCallContact] = useState<Contact | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [callOutcome, setCallOutcome] = useState<'Connected' | 'Voicemail' | 'Busy / No Answer' | 'Gatekeeper'>('Connected');
  const [callNotes, setCallNotes] = useState('');
  
  const [inboundCall, setInboundCall] = useState<{
    callerNumber: string;
    contact?: Contact;
  } | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const savedProto = localStorage.getItem('biscuit_crm_cti_protocol') as any;
    if (savedProto) setCtiProtocol(savedProto);
  }, []);

  useEffect(() => {
    if (isCalling) {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isCalling]);

  const handleStartOutboundCall = (contact: Contact) => {
    setActiveCallContact(contact);
    setCallDuration(0);
    setCallNotes('');
    setIsCalling(true);

    const sanitizedPhone = contact.phone.replace(/[^0-9+]/g, '');
    window.location.href = `${ctiProtocol}:${sanitizedPhone}`;
  };

  const handleEndCall = async () => {
    if (!activeCallContact || !activeCallContact.id) {
      setIsCalling(false);
      return;
    }

    setIsCalling(false);
    const dateStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const noteEntry = `\n[CTI CALL ${dateStr} - ${callDuration}s]: Outcome: ${callOutcome} (Dialer: ${currentUser}). Nuances: ${callNotes || 'No extra notes'}`;
    const updatedNotes = `${activeCallContact.internalNotes || ''}${noteEntry}`;

    await db.contacts.update(activeCallContact.id, {
      internalNotes: updatedNotes,
      lastCallDuration: callDuration,
      lastCallTimestamp: new Date().toISOString(),
      synced: false,
      updatedAt: new Date().toISOString(),
    });

    await db.outbox.add({
      type: 'UPDATE',
      table: 'contacts',
      payload: {
        id: activeCallContact.id,
        internalNotes: updatedNotes,
        lastCallDuration: callDuration,
        lastCallTimestamp: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      timestamp: Date.now(),
    });

    onAwardXP(25, `Completed CTI call with ${activeCallContact.name}`);
    setActiveCallContact(null);
  };

  const handleSimulateInboundCall = () => {
    if (contacts.length > 0) {
      const target = contacts[Math.floor(Math.random() * contacts.length)];
      setInboundCall({
        callerNumber: target.phone || '+44 20 7946 0912',
        contact: target,
      });
    } else {
      const fallbackTarget: Contact = {
        accountNumber: 'ACC-SIMULATED',
        name: 'Inbound Test Caller',
        company: 'Apex Telecom',
        crn: '12849501',
        email: 'inbound@test.com',
        phone: '+44 20 7946 0912',
        stage: 'Lead',
        synced: true,
        updatedAt: new Date().toISOString(),
      };
      setInboundCall({
        callerNumber: fallbackTarget.phone,
        contact: fallbackTarget,
      });
    }
  };

  const handleAnswerAndScreenPop = () => {
    if (inboundCall?.contact) {
      onOpenContact(inboundCall.contact);
      setActiveCallContact(inboundCall.contact);
      setIsCalling(true);
      setCallDuration(0);
      onAwardXP(20, `Answered CTI inbound call from ${inboundCall.contact.name}`);
    }
    setInboundCall(null);
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Live Inbound Call Screen-Pop Toast */}
      {inboundCall && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border-2 border-indigo-500 shadow-2xl flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-indigo-500 text-white animate-bounce">
              <PhoneIncoming className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                Incoming CTI Screen-Pop &bull; 4Com / VoIP Ringing...
              </span>
              <h4 className="text-base font-bold text-white">
                {inboundCall.contact?.name || 'Inbound Caller'} ({inboundCall.contact?.company || 'Direct'})
              </h4>
              <p className="text-xs text-slate-300 font-mono">
                {inboundCall.callerNumber} &bull; Account: {inboundCall.contact?.accountNumber}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setInboundCall(null)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white bg-slate-800"
            >
              Ignore
            </button>
            <button
              onClick={handleAnswerAndScreenPop}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow"
            >
              <PhoneCall className="w-4 h-4" /> Answer & Screen-Pop
            </button>
          </div>
        </div>
      )}

      {/* Active Call Console */}
      {isCalling && activeCallContact && (
        <div className="p-5 rounded-2xl bg-slate-900 border border-emerald-500/40 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <PhoneCall className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-emerald-400 uppercase font-semibold">Active Call Connected</span>
                <h3 className="text-sm font-bold text-slate-100">{activeCallContact.name} ({activeCallContact.company || 'Retail'})</h3>
                <p className="text-xs text-slate-400 font-mono">{activeCallContact.phone}</p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xl font-mono font-extrabold text-emerald-400">{formatTimer(callDuration)}</div>
              <span className="text-[10px] text-slate-500 font-mono">Call Timer</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Call Disposition / Outcome</label>
              <select
                value={callOutcome}
                onChange={(e) => setCallOutcome(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
              >
                <option value="Connected">Connected & Spoke with Decision Maker</option>
                <option value="Voicemail">Left Voicemail</option>
                <option value="Gatekeeper">Stopped at Gatekeeper / Reception</option>
                <option value="Busy / No Answer">Busy / No Answer</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Key Discussion Notes</label>
              <input
                type="text"
                placeholder="e.g. Discussed pricing for Q1, follow up via email..."
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              onClick={handleEndCall}
              className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold px-4 py-2 rounded-lg text-xs transition"
            >
              <PhoneOff className="w-3.5 h-3.5" /> End Call & Stamp Notes (+25 XP)
            </button>
          </div>
        </div>
      )}

      {/* CTI Dialing Configuration */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
            <Phone className="w-4 h-4 text-sky-400" /> CTI Telephony & Click-to-Dial Integrations
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Works natively with 4Com HiHi CTI, Jiminny, Teams, and standard VoIP softphone protocols
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300">
            <span>Protocol:</span>
            <select
              value={ctiProtocol}
              onChange={(e) => {
                setCtiProtocol(e.target.value as any);
                localStorage.setItem('biscuit_crm_cti_protocol', e.target.value);
              }}
              className="bg-transparent text-sky-400 font-mono font-semibold focus:outline-none"
            >
              <option value="tel">tel: (Default Softphone / Mobile)</option>
              <option value="callto">callto: (VoIP / Skype / 4Com)</option>
              <option value="sip">sip: (Direct PBX / Jiminny CTI)</option>
            </select>
          </div>

          
        </div>
      </div>

      {/* Directory with 1-Click Dialing */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
          <h4 className="font-semibold text-slate-200 text-sm">Direct Click-to-Dial Directory</h4>
          <span className="text-xs text-slate-400">{contacts.length} Reachable Accounts</span>
        </div>

        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-900/80 text-xs uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-5 py-3">Customer Account</th>
              <th className="px-5 py-3">Phone Number</th>
              <th className="px-5 py-3">Stage</th>
              <th className="px-5 py-3">Last Call Log</th>
              <th className="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {contacts.map((c) => (
              <tr key={c.id} className="hover:bg-slate-800/30 transition">
                <td className="px-5 py-3.5">
                  <div className="font-semibold text-slate-100">{c.name}</div>
                  <div className="text-[11px] text-slate-400">{c.company || 'Private'} &bull; <span className="font-mono text-emerald-400">{c.accountNumber}</span></div>
                </td>
                <td className="px-5 py-3.5 font-mono text-xs text-sky-400">
                  {c.phone || 'No phone recorded'}
                </td>
                <td className="px-5 py-3.5">
                  <span className="px-2 py-0.5 text-[11px] rounded bg-slate-800 text-slate-300 border border-slate-700">{c.stage}</span>
                </td>
                <td className="px-5 py-3.5 text-xs text-slate-400 font-mono">
                  {c.lastCallDuration ? `${c.lastCallDuration}s (${c.lastCallTimestamp?.slice(0, 10)})` : 'Never called'}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    onClick={() => handleStartOutboundCall(c)}
                    disabled={!c.phone}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold text-xs transition"
                  >
                    <Phone className="w-3.5 h-3.5" /> Click to Dial
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
