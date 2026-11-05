"use client";

import React, { useState } from "react";
import { 
  ShieldCheck, 
  Database, 
  Users, 
  Layers, 
  CheckCircle2, 
  ArrowRight, 
  Building2, 
  Laptop, 
  Sparkles, 
  Lock,
  RefreshCw
} from "lucide-react";
import { 
  fetchMicrosoftDirectory, 
  fetchGoogleDirectory, 
  EnterpriseStaffMember 
} from "../packages/storage/src/directoryEngine";
import { 
  discoverGoogleVault, 
  discoverMicrosoftVault, 
  VaultDiscoveryResult 
} from "../packages/storage/src/vaultEngine";

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: {
    roster: EnterpriseStaffMember[];
    vault: VaultDiscoveryResult | null;
  }) => void;
}

export default function OnboardingWizard({ isOpen, onClose, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<'google' | 'microsoft' | null>(null);
  const [discoveredRoster, setDiscoveredRoster] = useState<EnterpriseStaffMember[]>([]);
  const [vaultInfo, setVaultInfo] = useState<VaultDiscoveryResult | null>(null);

  if (!isOpen) return null;

  const handleConnectIdentity = async (selectedProvider: 'google' | 'microsoft') => {
    setLoading(true);
    setProvider(selectedProvider);

    try {
      const token = localStorage.getItem(
        selectedProvider === 'google' ? 'biscuit_crm_google_token' : 'biscuit_crm_ms_token'
      ) || '';

      // Track A: Discover staff roster via Workplace / Microsoft Graph
      let staff: EnterpriseStaffMember[] = [];
      if (selectedProvider === 'microsoft') {
        staff = await fetchMicrosoftDirectory(token);
      } else {
        staff = await fetchGoogleDirectory(token);
      }
      setDiscoveredRoster(staff);

      // Track B: Discover or provision Zero-Knowledge Cloud Vault
      let vault: VaultDiscoveryResult;
      if (selectedProvider === 'microsoft') {
        vault = await discoverMicrosoftVault(token);
      } else {
        vault = await discoverGoogleVault(token);
      }
      setVaultInfo(vault);

      setStep(2);
    } catch (err) {
      console.error('Onboarding ingestion failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    onComplete({
      roster: discoveredRoster,
      vault: vaultInfo
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl p-8 shadow-2xl space-y-6 relative overflow-hidden">
        
        {/* Glow Accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black">
              🍪
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Enterprise Onboarding & BYODB Setup
              </h2>
              <p className="text-xs text-slate-400">
                Zero-Knowledge Architecture: Biscuit never hosts your company database.
              </p>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono">
            Step {step} of 3
          </span>
        </div>

        {/* STEP 1: Connect Identity & Storage */}
        {step === 1 && (
          <div className="space-y-6 py-2">
            <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-5 space-y-2">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Select Your Company's Primary Cloud Ecosystem
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Connect your IT or Managing Director account. Biscuit will detect your company drive and synchronize your staff roster automatically.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleConnectIdentity('google')}
                disabled={loading}
                className="flex flex-col items-start p-5 rounded-2xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 hover:border-amber-500/60 transition group text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-3">
                  <Laptop className="w-5 h-5 text-red-400" />
                </div>
                <div className="text-sm font-bold text-white group-hover:text-amber-400 transition">
                  Google Workspace
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Google Drive Storage + Workspace Directory Ingestion
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleConnectIdentity('microsoft')}
                disabled={loading}
                className="flex flex-col items-start p-5 rounded-2xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 hover:border-sky-500/60 transition group text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mb-3">
                  <Building2 className="w-5 h-5 text-sky-400" />
                </div>
                <div className="text-sm font-bold text-white group-hover:text-sky-400 transition">
                  Microsoft 365
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  OneDrive / SharePoint + Entra ID Directory Ingestion
                </p>
              </button>
            </div>

            {loading && (
              <div className="flex items-center justify-center gap-2 text-xs text-amber-400 pt-2 animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin" /> Ingesting enterprise directory & scanning company drive...
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Roster & RBAC Verification */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="bg-slate-800/50 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-medium">Discovered Personnel</span>
                <div className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-teal-400" />
                  {discoveredRoster.length > 0 ? `${discoveredRoster.length} Team Members Found` : 'Single Operator (Managing Director)'}
                </div>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400">
                Auto-Role Classified
              </span>
            </div>

            <div className="max-h-48 overflow-y-auto divide-y divide-slate-800 border border-slate-800 rounded-xl bg-slate-950/40">
              {discoveredRoster.length > 0 ? (
                discoveredRoster.map((user, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-200">{user.name}</div>
                      <div className="text-slate-400">{user.email} • {user.jobTitle}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md font-mono text-[10px] bg-slate-800 text-amber-400 border border-slate-700">
                      {user.assignedRole} ({user.hierarchyTier})
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-slate-400">
                  Sole trader detected. All administrative and operational permissions will default to Managing Director.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition"
              >
                Proceed to Pipeline & Vault Setup <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Zero-Knowledge Vault & Pipeline Launch */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="bg-slate-800/50 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    {vaultInfo?.vaultName || 'Company Cloud Vault'}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {vaultInfo?.foundExistingDatabase 
                      ? 'Existing customer database discovered and ready for pipeline sync.' 
                      : 'Vault initialized. Ready to sync customer pipeline with zero server persistence.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                  <span className="text-slate-500 block">Contacts Discovered</span>
                  <span className="text-base font-bold text-white">
                    {vaultInfo?.contactsDiscovered.length || 0}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                  <span className="text-slate-500 block">Server Persistence</span>
                  <span className="text-base font-bold text-emerald-400 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> Zero (Client-Side)
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-200/90 leading-relaxed">
              <strong>Seamless Operation:</strong> When your staff make changes, records are saved locally and synced directly to your company's private cloud drive via the debounced Biscuit Sync engine.
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleFinish}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition"
              >
                <Sparkles className="w-4 h-4" /> Complete Onboarding & Open Biscuit CRM
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
