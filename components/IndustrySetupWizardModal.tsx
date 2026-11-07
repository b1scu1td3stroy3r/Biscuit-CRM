'use client';

import React, { useState } from 'react';
import { db } from '../packages/storage/src/db';
import { Heart, Hammer, Pill, ShoppingBag, Briefcase, Check, Sparkles, X } from 'lucide-react';

interface IndustrySetupWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyProfile: (profileKey: string) => void;
}

export default function IndustrySetupWizardModal({ isOpen, onClose, onApplyProfile }: IndustrySetupWizardModalProps) {
  const [selectedProfile, setSelectedProfile] = useState<string>('charity');

  if (!isOpen) return null;

  const profiles = [
    {
      id: 'charity',
      name: 'Charity & Voluntary Non-Profit',
      icon: Heart,
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
      description: 'Enables 25% HMRC Gift Aid tax recovery, voluntary grant tracking, and zero-vat donor receipts.'
    },
    {
      id: 'construction',
      name: 'Construction, Trade & Contracting',
      icon: Hammer,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      description: 'Activates CIS 20%/30% contractor tax deductions, plant hire reservations, and stage sign-offs.'
    },
    {
      id: 'pharma',
      name: 'Healthcare, Clinic & Life Sciences',
      icon: Pill,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      description: 'MHRA regulatory training matrix, batch tracking, and controlled inventory compliance audits.'
    },
    {
      id: 'distribution',
      name: 'Wholesale, Distribution & Retail WMS',
      icon: ShoppingBag,
      color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
      description: 'Global 4-stage warehouse fulfillment, bin allocation, and automated backorder reservation locks.'
    },
    {
      id: 'services',
      name: 'Professional Practice & Corporate Services',
      icon: Briefcase,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      description: 'Double-entry general ledger, 90-day AR aging, vector PDF billing, and sales run-rate pacing.'
    }
  ];

  const handleApply = async () => {
    try {
      if (db?.settings) {
        await db.settings.put({
          key: 'industryProfile',
          profile: selectedProfile,
          updatedAt: new Date().toISOString()
        } as any);
      }
    } catch {
      // fallback
    }
    onApplyProfile(selectedProfile);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-sky-500/10 text-sky-400 rounded-lg border border-sky-500/20">
              <Sparkles className="w-5 h-5" />
            </span>
            <h2 className="text-base font-bold text-white">Select Your Business Sector Preset</h2>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Biscuit adapts its compliance desks, tax deductions, and WMS state machines instantly. You can adjust this configuration at any time without data loss.
        </p>

        <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
          {profiles.map(p => {
            const Icon = p.icon;
            const isSelected = selectedProfile === p.id;
            return (
              <div
                key={p.id}
                onClick={() => setSelectedProfile(p.id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3.5 ${
                  isSelected
                    ? 'bg-slate-800/80 border-sky-500 ring-1 ring-sky-500/50'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <span className={`p-2 rounded-lg border ${p.color}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-200">{p.name}</h4>
                    {isSelected && <Check className="w-4 h-4 text-sky-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">{p.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-sky-600/20 transition"
          >
            Activate Persona Preset
          </button>
        </div>
      </div>
    </div>
  );
}
