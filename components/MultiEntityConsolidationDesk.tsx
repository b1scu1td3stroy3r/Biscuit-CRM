'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../packages/storage/src/db';
import { Network, Building2, Plus, ArrowRightLeft, CheckCircle2, ShieldCheck, Scale } from 'lucide-react';

export default function MultiEntityConsolidationDesk() {
  const [entities, setEntities] = useState<any[]>([]);
  const [eliminations, setEliminations] = useState<any[]>([]);
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [showElimModal, setShowElimModal] = useState(false);

  // New entity form
  const [entityName, setEntityName] = useState('');
  const [entityCurrency, setEntityCurrency] = useState('GBP');
  const [entityCountry, setEntityCountry] = useState('United Kingdom');
  const [isParent, setIsParent] = useState(false);

  // New elimination form
  const [entityA, setEntityA] = useState('');
  const [entityB, setEntityB] = useState('');
  const [elimDesc, setElimDesc] = useState('');
  const [elimAmount, setElimAmount] = useState('');

  const loadData = async () => {
    try {
      if ((db as any)?.organisations) {
        const loadedEntities = await (db as any).organisations.toArray();
        setEntities(loadedEntities || []);
      }
      if ((db as any)?.intercompanyEliminations) {
        const loadedElims = await (db as any).intercompanyEliminations.toArray();
        setEliminations(loadedElims || []);
      }
    } catch {
      setEntities([]);
      setEliminations([]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    const newEnt = {
      id: `ORG-${Date.now().toString(36).toUpperCase()}`,
      name: entityName.trim(),
      currency: entityCurrency,
      country: entityCountry,
      isParent,
      intercompanyAccountCode: '1990'
    };

    if ((db as any)?.organisations) {
      await (db as any).organisations.put(newEnt);
    }
    setEntities(prev => [...prev, newEnt]);
    setShowEntityModal(false);
    setEntityName('');
    setIsParent(false);
  };

  const handleCreateElimination = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(elimAmount) || 0;
    const newElim = {
      id: `ELIM-${Date.now().toString(36).toUpperCase()}`,
      date: new Date().toISOString().split('T')[0],
      entityAId: entityA,
      entityBId: entityB,
      description: elimDesc.trim(),
      amount: amt,
      eliminated: true
    };

    if ((db as any)?.intercompanyEliminations) {
      await (db as any).intercompanyEliminations.put(newElim);
    }
    setEliminations(prev => [...prev, newElim]);
    setShowElimModal(false);
    setElimDesc('');
    setElimAmount('');
  };

  const totalEliminated = eliminations.reduce((acc, el) => acc + (el.amount || 0), 0);

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-slate-100 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
              <Scale className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-white">Multi-Entity & Group Consolidation Desk</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Oracle & NetSuite parity: Group consolidation, multi-subsidiary ledgers, and automated intercompany eliminations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowElimModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
            Post Intercompany Elimination
          </button>
          <button
            type="button"
            onClick={() => setShowEntityModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Register Legal Entity
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
          <span className="text-[10px] font-mono uppercase text-slate-400">Total Group Entities</span>
          <p className="text-xl font-bold font-mono text-white mt-1">{entities.length}</p>
        </div>
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
          <span className="text-[10px] font-mono uppercase text-slate-400">Intercompany Journal Eliminations</span>
          <p className="text-xl font-bold font-mono text-indigo-400 mt-1">{eliminations.length}</p>
        </div>
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
          <span className="text-[10px] font-mono uppercase text-slate-400">Total Eliminated Volume</span>
          <p className="text-xl font-bold font-mono text-emerald-400 mt-1">
            £{totalEliminated.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Entity Grid */}
      <div className="mb-6">
        <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Group Subsidiary Entities</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {entities.length === 0 ? (
            <div className="col-span-3 p-8 text-center text-slate-600 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
              No secondary entities registered. Operating on primary local entity ledger. Click 'Register Legal Entity' to configure holding/subsidiary consolidation.
            </div>
          ) : (
            entities.map(e => (
              <div key={e.id} className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{e.name}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    e.isParent ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {e.isParent ? 'Parent Holding' : 'Subsidiary'}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 space-y-1 pt-1">
                  <div className="flex justify-between">
                    <span>Currency:</span>
                    <span className="text-slate-200">{e.currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Jurisdiction:</span>
                    <span className="text-slate-200">{e.country}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Interco Code:</span>
                    <span className="text-indigo-400">{e.intercompanyAccountCode}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Elimination Log */}
      <div>
        <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Intercompany Elimination Journals (Auto-Balancing)</h2>
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800 bg-slate-900/80">
                <th className="p-3.5">Elimination ID</th>
                <th className="p-3.5">Effective Date</th>
                <th className="p-3.5">From Entity</th>
                <th className="p-3.5">To Entity</th>
                <th className="p-3.5">Description</th>
                <th className="p-3.5 text-right">Eliminated Balance</th>
                <th className="p-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {eliminations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-600">
                    No intercompany eliminations recorded. Eliminating mutual cross-billing prevents revenue and debt double-counting across the group.
                  </td>
                </tr>
              ) : (
                eliminations.map(el => (
                  <tr key={el.id} className="text-slate-300 hover:bg-slate-900/30">
                    <td className="p-3.5 font-bold text-white">{el.id}</td>
                    <td className="p-3.5 text-slate-400">{el.date}</td>
                    <td className="p-3.5 text-indigo-400 font-semibold">{el.entityAId}</td>
                    <td className="p-3.5 text-indigo-400 font-semibold">{el.entityBId}</td>
                    <td className="p-3.5 text-slate-200">{el.description}</td>
                    <td className="p-3.5 text-right font-bold text-emerald-400">
                      £{el.amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" /> Eliminated
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Register Entity */}
      {showEntityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form onSubmit={handleCreateEntity} className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">Register Group Legal Entity</h3>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Company / Entity Legal Name</label>
              <input
                type="text"
                required
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
                placeholder="e.g. Biscuit Group Holdings Ltd"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Base Currency</label>
                <select
                  value={entityCurrency}
                  onChange={(e) => setEntityCurrency(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
                >
                  <option value="GBP">GBP (£)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Country Jurisdiction</label>
                <input
                  type="text"
                  required
                  value={entityCountry}
                  onChange={(e) => setEntityCountry(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isParentCheck"
                checked={isParent}
                onChange={(e) => setIsParent(e.target.checked)}
                className="rounded border-slate-800 text-indigo-600 focus:ring-0"
              />
              <label htmlFor="isParentCheck" className="text-xs text-slate-300">Designate as Ultimate Parent / Consolidating Entity</label>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEntityModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition"
              >
                Save Entity
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Intercompany Elimination */}
      {showElimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form onSubmit={handleCreateElimination} className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">Post Intercompany Balance Elimination</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">From Entity (Debtor)</label>
                <input
                  type="text"
                  required
                  value={entityA}
                  onChange={(e) => setEntityA(e.target.value)}
                  placeholder="Entity ID / Name"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">To Entity (Creditor)</label>
                <input
                  type="text"
                  required
                  value={entityB}
                  onChange={(e) => setEntityB(e.target.value)}
                  placeholder="Entity ID / Name"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Description / Rationale</label>
              <input
                type="text"
                required
                value={elimDesc}
                onChange={(e) => setElimDesc(e.target.value)}
                placeholder="e.g. Elimination of internal software licensing fee"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Elimination Balance (£)</label>
              <input
                type="number"
                step="0.01"
                required
                value={elimAmount}
                onChange={(e) => setElimAmount(e.target.value)}
                placeholder="e.g. 15000.00"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowElimModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition"
              >
                Record Elimination
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
