'use client';

import React, { useState, useMemo } from 'react';
import { Mail, Send, Play, Plus, Trash2, Users, CheckCircle2, Clock, Sparkles } from 'lucide-react';

interface SequenceStep {
  id: string;
  dayOffset: number;
  subject: string;
  templateBody: string;
}

interface Sequence {
  id: string;
  name: string;
  targetStage: string;
  steps: SequenceStep[];
}

export default function MarketingCampaignDesk({ contacts = [] }: { contacts?: any[] }) {
  const [sequences, setSequences] = useState<Sequence[]>([
    {
      id: 'seq-inbound-lead',
      name: 'Inbound Qualified Lead Nurture',
      targetStage: 'Lead In',
      steps: [
        {
          id: 'step-1',
          dayOffset: 0,
          subject: 'Quick question regarding {{company}}',
          templateBody: 'Hi {{firstName}},\n\nI noticed {{company}} is scaling operations. Wanted to share how Biscuit provides enterprise CRM, WMS, and General Ledger capabilities with zero recurring cloud storage fees.\n\nDo you have 5 minutes this week?\n\nBest regards,\nBiscuit Commercial Team'
        },
        {
          id: 'step-2',
          dayOffset: 3,
          subject: 'Case study: Eliminating enterprise SaaS data taxes',
          templateBody: 'Hi {{firstName}},\n\nFollowing up on my note regarding {{company}}. We recently helped an organisation migrate away from HubSpot and Salesforce, saving £18,000/year in seat and contact storage limits.\n\nWorth exploring for your pipeline?\n\nBest regards,\nBiscuit Team'
        },
        {
          id: 'step-3',
          dayOffset: 7,
          subject: 'Permission to close file on {{company}}?',
          templateBody: 'Hi {{firstName}},\n\nI assume enterprise CRM & accounting consolidation is not a priority for {{company}} right now. If priorities change, our zero-knowledge workspace is always accessible.\n\nAll the best!'
        }
      ]
    }
  ]);

  const [activeSeqId, setActiveSeqId] = useState<string>('seq-inbound-lead');
  const [testContactId, setTestContactId] = useState<string>(contacts[0]?.id || '');
  const [previewStepIndex, setPreviewStepIndex] = useState<number>(0);

  const activeSeq = sequences.find(s => s.id === activeSeqId) || sequences[0];
  const activeStep = activeSeq?.steps[previewStepIndex] || activeSeq?.steps[0];
  const testContact = contacts.find(c => c.id === testContactId) || contacts[0] || {
    name: 'Sarah Connor',
    company: 'Cyberdyne Systems',
    dealValue: '45000',
    stage: 'Lead In',
    email: 'sarah@cyberdyne.example.com'
  };

  const resolvedPreview = useMemo(() => {
    if (!activeStep) return { subject: '', body: '' };
    const firstName = (testContact.name || 'Valued Partner').split(' ')[0];
    const company = testContact.company || 'your organisation';
    const dealValue = Number(testContact.dealValue || 0).toLocaleString('en-GB');
    const stage = testContact.stage || 'Discovery';

    const parse = (text: string) => {
      return text
        .replace(/\{\{firstName\}\}/g, firstName)
        .replace(/\{\{company\}\}/g, company)
        .replace(/\{\{dealValue\}\}/g, `£${dealValue}`)
        .replace(/\{\{stage\}\}/g, stage);
    };

    return {
      subject: parse(activeStep.subject),
      body: parse(activeStep.templateBody)
    };
  }, [activeStep, testContact]);

  const handleLaunchClientEmail = () => {
    if (!testContact.email) {
      alert('Selected contact has no valid email address.');
      return;
    }
    const mailto = `mailto:${encodeURIComponent(testContact.email)}?subject=${encodeURIComponent(resolvedPreview.subject)}&body=${encodeURIComponent(resolvedPreview.body)}`;
    window.open(mailto, '_blank');
  };

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-slate-100 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/20">
              <Mail className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-white">Campaign & Drip Cadence Engine</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            HubSpot-grade automated cadences with zero third-party marketing custody and client-side merge tags
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleLaunchClientEmail}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-rose-600/20 transition"
          >
            <Send className="w-3.5 h-3.5" />
            Dispatch Direct Email
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sequence List */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Active Cadences</h3>
            <span className="text-[10px] font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300">
              {sequences.length} Built
            </span>
          </div>

          <div className="space-y-2">
            {sequences.map(seq => (
              <button
                key={seq.id}
                type="button"
                onClick={() => { setActiveSeqId(seq.id); setPreviewStepIndex(0); }}
                className={`w-full text-left p-3 rounded-xl border transition ${
                  activeSeqId === seq.id
                    ? 'bg-rose-500/10 border-rose-500/30 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">{seq.name}</span>
                  <span className="text-[10px] font-mono text-rose-400">{seq.steps.length} Steps</span>
                </div>
                <span className="text-[11px] text-slate-500 block mt-1">Trigger: Stage = {seq.targetStage}</span>
              </button>
            ))}
          </div>

          {/* Merge Tag Reference Card */}
          <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2 mt-auto">
            <span className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" /> Supported Merge Tokens
            </span>
            <div className="grid grid-cols-2 gap-1 text-[11px] font-mono text-slate-400">
              <span>{'{{firstName}}'}</span>
              <span>{'{{company}}'}</span>
              <span>{'{{dealValue}}'}</span>
              <span>{'{{stage}}'}</span>
            </div>
          </div>
        </div>

        {/* Cadence Steps */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Cadence Schedule</h3>
            <span className="text-[10px] font-mono text-slate-400">Step {previewStepIndex + 1} of {activeSeq?.steps.length}</span>
          </div>

          <div className="space-y-3">
            {activeSeq?.steps.map((step, idx) => (
              <div
                key={step.id}
                onClick={() => setPreviewStepIndex(idx)}
                className={`p-3.5 rounded-xl border cursor-pointer transition ${
                  previewStepIndex === idx
                    ? 'bg-slate-900 border-rose-500/40 shadow-sm'
                    : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-rose-400" />
                    Day {step.dayOffset}: {step.dayOffset === 0 ? 'Immediate Trigger' : `Wait ${step.dayOffset} Days`}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">Step #{idx + 1}</span>
                </div>
                <p className="text-xs text-slate-400 truncate">{step.subject}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Live Vector Client Preview */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Resolved Live Preview</h3>
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={testContactId}
                onChange={(e) => setTestContactId(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-[11px] text-slate-300 rounded px-2 py-0.5"
              >
                {(contacts.length > 0 ? contacts : [testContact]).map(c => (
                  <option key={c.id || c.name} value={c.id || c.name}>
                    {c.name} ({c.company || 'Enterprise'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3 bg-slate-950 p-4 border border-slate-800 rounded-xl flex-1 flex flex-col">
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-500 block">Recipient</span>
              <p className="text-xs text-slate-300 font-mono">{testContact.email || 'no-email@example.com'}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-500 block">Subject</span>
              <p className="text-xs font-semibold text-slate-200">{resolvedPreview.subject}</p>
            </div>
            <div className="flex-1 border-t border-slate-800/80 pt-3">
              <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1">Body Payload</span>
              <pre className="text-xs font-sans text-slate-300 whitespace-pre-wrap leading-relaxed">
                {resolvedPreview.body}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
