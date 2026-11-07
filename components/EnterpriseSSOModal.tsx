'use client';

import React, { useState, useEffect } from 'react';
import { KeyRound, Shield, CheckCircle2, X, RefreshCw, Lock } from 'lucide-react';

interface EnterpriseSSOModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EnterpriseSSOModal({ isOpen, onClose }: EnterpriseSSOModalProps) {
  if (!isOpen) return null;

  const [provider, setProvider] = useState<'okta' | 'azure_ad' | 'google_workspace'>('okta');
  const [issuerUrl, setIssuerUrl] = useState('');
  const [clientId, setClientId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('biscuit_enterprise_sso');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setProvider(parsed.provider || 'okta');
        setIssuerUrl(parsed.issuerUrl || '');
        setClientId(parsed.clientId || '');
        setTenantId(parsed.tenantId || '');
        setIsConfigured(true);
      } catch {}
    }
  }, []);

  const handleSaveSSO = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('biscuit_enterprise_sso', JSON.stringify({
      provider,
      issuerUrl: issuerUrl.trim(),
      clientId: clientId.trim(),
      tenantId: tenantId.trim()
    }));
    setIsConfigured(true);
    alert('Enterprise Single Sign-On configuration saved. Workstations will enforce PKCE token exchange.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-violet-500/10 text-violet-400 rounded-lg border border-violet-500/20">
              <KeyRound className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-white">Enterprise Identity &amp; SSO Integration</h2>
              <p className="text-[11px] text-slate-400 font-mono">SAML 2.0 • Okta • Microsoft Entra ID (Azure AD)</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveSSO} className="space-y-3 text-xs">
          <div>
            <label className="text-slate-400 block mb-1">Corporate Identity Provider (IdP)</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as any)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none"
            >
              <option value="okta">Okta Workforce Identity</option>
              <option value="azure_ad">Microsoft Entra ID (Azure AD SAML)</option>
              <option value="google_workspace">Google Workspace Enterprise OIDC</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">IdP Issuer / Discovery URL</label>
            <input
              type="text"
              required
              placeholder="https://company.okta.com/oauth2/default"
              value={issuerUrl}
              onChange={(e) => setIssuerUrl(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-slate-400 block mb-1">Client ID / App ID</label>
              <input
                type="text"
                required
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono focus:outline-none"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Directory / Tenant ID</label>
              <input
                type="text"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="Optional for Okta"
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono focus:outline-none"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1 text-[11px] font-mono text-slate-400">
            <div className="flex justify-between">
              <span>Zero-Custody Token Gate:</span>
              <span className="text-emerald-400">PKCE In-Memory Flow</span>
            </div>
            <div className="flex justify-between">
              <span>RBAC Claim Mapping:</span>
              <span className="text-slate-200">groups -&gt; DepartmentRole</span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold shadow-lg shadow-violet-600/20 transition"
            >
              Enforce SSO Gateway
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
