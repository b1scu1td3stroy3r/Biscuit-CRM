"use client";

import React, { useState, useEffect } from "react";
import { Package, Search, X, CheckCircle, AlertTriangle, Layers, ArrowUpRight, Upload, Plus } from "lucide-react";
import { db, InventoryItem } from "../packages/storage/src/db";

export default function LiveStockHUDModal({
  isOpen,
  onClose,
  currentUser,
  currentDepartment = "General"
}: {

  isOpen: boolean;
  onClose: () => void;
  currentUser?: any;
  currentDepartment?: string;
}) {
    const userRoleStr = typeof currentUser === 'string'
    ? currentUser
    : (currentUser as any)?.role || (currentUser as any)?.name || (typeof window !== 'undefined' ? localStorage.getItem('biscuit_crm_user_role') || 'Managing Director' : 'Managing Director');

  const canImportStock = [
    'Managing Director',
    'Operations Manager',
    'IT Manager',
    'Procurement Manager'
  ].includes(userRoleStr);
  const [stockItems, setStockItems] = useState<InventoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isImporting, setIsImporting] = useState(false);

  // Load from client-side Dexie IndexedDB
  const refreshStock = async () => {
    try {
      const items = await db.inventory.toArray();
      setStockItems(items);
    } catch (err) {
      console.warn("Could not load inventory items from IndexedDB:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshStock();
    }
  }, [isOpen]);

  // Zero-Knowledge In-Memory CSV Stock Importer
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.trim().split(/\r?\n/);
        if (lines.length < 2) return;

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
        const skuIdx = headers.findIndex(h => h.includes('sku') || h.includes('code'));
        const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('title') || h.includes('desc'));
        const catIdx = headers.findIndex(h => h.includes('cat'));
        const onHandIdx = headers.findIndex(h => h.includes('hand') || h.includes('qty') || h.includes('stock'));
        const reservedIdx = headers.findIndex(h => h.includes('reserve'));
        const binIdx = headers.findIndex(h => h.includes('bin') || h.includes('location'));
        const priceIdx = headers.findIndex(h => h.includes('price') || h.includes('unit'));

        const newItems: InventoryItem[] = [];

        for (let i = 1; i < lines.length; i++) {
          const rawLine = lines[i].trim();
          if (!rawLine) continue;
          const cols = rawLine.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^["']|["']$/g, '').trim());

          const sku = cols[skuIdx] || `SKU-${Date.now()}-${i}`;
          const name = cols[nameIdx] || 'Unlabeled Stock Item';
          const category = cols[catIdx] || 'General';
          const onHand = onHandIdx !== -1 ? parseInt(cols[onHandIdx], 10) || 0 : 0;
          const reserved = reservedIdx !== -1 ? parseInt(cols[reservedIdx], 10) || 0 : 0;
          const binLocation = cols[binIdx] || 'UNASSIGNED';
          const unitPrice = priceIdx !== -1 ? parseFloat(cols[priceIdx]) || 0 : 0;
          const availableToSell = Math.max(0, onHand - reserved);
          const status = availableToSell <= 50 ? (availableToSell <= 10 ? 'Critical' : 'Low Stock') : 'Healthy';

          newItems.push({
            sku,
            name,
            category,
            binLocation,
            onHand,
            reserved,
            availableToSell,
            unitPrice,
            status,
            updatedAt: new Date().toISOString()
          });
        }

        if (newItems.length > 0) {
          await db.inventory.bulkAdd(newItems);
          await refreshStock();
        }
      } catch (err) {
        console.error("Failed to parse stock CSV:", err);
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  const categories = ["all", ...Array.from(new Set(stockItems.map(s => s.category).filter(Boolean)))];

  const filtered = stockItems.filter(item => {
    const matchesQ =
      item.sku.toLowerCase().includes(query.toLowerCase()) ||
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      item.binLocation.toLowerCase().includes(query.toLowerCase());
    const matchesCat = categoryFilter === "all" || item.category === categoryFilter;
    return matchesQ && matchesCat;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between gap-4 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Live Central Stock & Warehouse HUD</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Local-First IndexedDB
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Departmental inventory visibility for Sales, Support, Management & Procurement.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canImportStock && (
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold border border-indigo-500/30 transition shadow-sm">
                <Upload className="w-3.5 h-3.5 text-indigo-400" />
                <span>{isImporting ? 'Importing...' : 'Import Stock CSV'}</span>
                <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
              </label>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-slate-800/60 bg-slate-900/30 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search SKU, item name, or bin location..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition capitalize whitespace-nowrap ${
                  categoryFilter === cat
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Stock Catalog Table */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Package className="w-10 h-10 text-slate-600 mx-auto" />
              <div>
                <p className="text-sm font-semibold text-slate-300">No Inventory Items Found</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  This instance is running in Bring-Your-Own-Data mode. Import your company catalog via CSV or log incoming goods via the WMS Desk.
                </p>
              </div>
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-[11px] uppercase font-semibold text-slate-400 border-b border-slate-800 sticky top-0 backdrop-blur-sm">
                <tr>
                  <th className="py-3 px-4">SKU / Item</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Bin Location</th>
                  <th className="py-3 px-4 text-right">On Hand</th>
                  <th className="py-3 px-4 text-right">Reserved</th>
                  <th className="py-3 px-4 text-right">Available to Sell</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filtered.map((item) => (
                  <tr key={item.sku} className="hover:bg-slate-900/40 transition">
                    <td className="py-3 px-4 font-sans">
                      <div className="font-semibold text-white">{item.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{item.sku}</div>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-400">{item.category}</td>
                    <td className="py-3 px-4 text-indigo-400">{item.binLocation}</td>
                    <td className="py-3 px-4 text-right text-slate-200">{item.onHand.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-amber-400">{item.reserved.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-400">
                      {item.availableToSell.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          item.status === "Healthy"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : item.status === "Low Stock"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/50 flex items-center justify-between text-xs text-slate-500">
          <span>Viewing as {currentDepartment} • Total Catalog: {filtered.length} items</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition"
          >
            Close HUD
          </button>
        </div>
      </div>
    </div>
  );
}
