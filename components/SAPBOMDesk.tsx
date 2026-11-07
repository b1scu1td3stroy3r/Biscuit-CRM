'use client';

import React, { useState, useEffect } from 'react';
import { db } from '../packages/storage/src/db';
import { Cpu, AlertTriangle, Plus, CheckCircle2, Factory, PackageOpen } from 'lucide-react';

export default function SAPBOMDesk() {
  const [boms, setBoms] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  
  // New BOM form
  const [parentSku, setParentSku] = useState('');
  const [componentSku, setComponentSku] = useState('');
  const [qtyRequired, setQtyRequired] = useState('1');
  const [leadTimeDays, setLeadTimeDays] = useState('7');

  const loadData = async () => {
    try {
      if ((db as any)?.billOfMaterials) {
        const loadedBoms = await (db as any).billOfMaterials.toArray();
        setBoms(loadedBoms || []);
      }
      if ((db as any)?.inventory) {
        const loadedInv = await (db as any).inventory.toArray();
        setInventory(loadedInv || []);
      }
    } catch {
      setBoms([]);
      setInventory([]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateBOM = async (e: React.FormEvent) => {
    e.preventDefault();
    const entry = {
      id: `BOM-${Date.now().toString(36).toUpperCase()}`,
      parentSku: parentSku.trim(),
      componentSku: componentSku.trim(),
      quantityRequired: parseInt(qtyRequired) || 1,
      leadTimeDays: parseInt(leadTimeDays) || 7
    };

    if ((db as any)?.billOfMaterials) {
      await (db as any).billOfMaterials.put(entry);
    }
    setBoms(prev => [...prev, entry]);
    setShowModal(false);
    setParentSku('');
    setComponentSku('');
    setQtyRequired('1');
  };

  // Automated MRP Shortage Engine (SAP Parity)
  const mrpShortages = boms.map(bom => {
    const componentItem = inventory.find(i => (i.sku || i.id) === bom.componentSku);
    const onHand = componentItem ? Number(componentItem.onHand || 0) : 0;
    const isShortage = onHand < bom.quantityRequired;
    return {
      ...bom,
      onHand,
      shortageUnits: isShortage ? bom.quantityRequired - onHand : 0,
      isShortage
    };
  });

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-slate-100 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-orange-500/10 text-orange-400 rounded-lg border border-orange-500/20">
              <Factory className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-white">SAP Bill of Materials (BOM) & MRP Engine</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manufacturing assembly recipes, component lead times, and automated procurement shortage alerts
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-orange-600/20 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Define BOM Recipe
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
          <span className="text-[10px] font-mono uppercase text-slate-400">Configured Assemblies</span>
          <p className="text-xl font-bold font-mono text-white mt-1">{new Set(boms.map(b => b.parentSku)).size}</p>
        </div>
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
          <span className="text-[10px] font-mono uppercase text-slate-400">Total Component Dependencies</span>
          <p className="text-xl font-bold font-mono text-orange-400 mt-1">{boms.length}</p>
        </div>
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
          <span className="text-[10px] font-mono uppercase text-slate-400">MRP Component Shortages</span>
          <p className="text-xl font-bold font-mono text-rose-400 mt-1">
            {mrpShortages.filter(m => m.isShortage).length}
          </p>
        </div>
      </div>

      {/* BOM Table */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="text-slate-400 border-b border-slate-800 bg-slate-900/80">
              <th className="p-3.5">Recipe ID</th>
              <th className="p-3.5">Parent SKU / Product</th>
              <th className="p-3.5">Required Component SKU</th>
              <th className="p-3.5">Qty / Unit</th>
              <th className="p-3.5">Current Stock On Hand</th>
              <th className="p-3.5">Supplier Lead Time</th>
              <th className="p-3.5 text-center">MRP Production Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {mrpShortages.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-600">
                  No Bill of Materials recipes configured. Click 'Define BOM Recipe' to add component dependencies.
                </td>
              </tr>
            ) : (
              mrpShortages.map(m => (
                <tr key={m.id} className="text-slate-300 hover:bg-slate-900/30">
                  <td className="p-3.5 font-bold text-white">{m.id}</td>
                  <td className="p-3.5 font-semibold text-orange-400">{m.parentSku}</td>
                  <td className="p-3.5 text-slate-200">{m.componentSku}</td>
                  <td className="p-3.5 font-bold">{m.quantityRequired}</td>
                  <td className="p-3.5 text-slate-400">{m.onHand} units</td>
                  <td className="p-3.5">{m.leadTimeDays} Days</td>
                  <td className="p-3.5 text-center">
                    {m.isShortage ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <AlertTriangle className="w-3 h-3" /> Shortage ({m.shortageUnits} units required)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" /> Fully Provisioned
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form onSubmit={handleCreateBOM} className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">Define Bill of Materials (BOM) Recipe</h3>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Parent Finished SKU</label>
              <input
                type="text"
                required
                value={parentSku}
                onChange={(e) => setParentSku(e.target.value)}
                placeholder="e.g. FIN-RACK-01"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Required Raw Component SKU</label>
              <input
                type="text"
                required
                value={componentSku}
                onChange={(e) => setComponentSku(e.target.value)}
                placeholder="e.g. COMP-BOLT-M8"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Quantity per Unit</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={qtyRequired}
                  onChange={(e) => setQtyRequired(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Supplier Lead Time (Days)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-orange-600/20 transition"
              >
                Save Recipe
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
