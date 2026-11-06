"use client";

import React, { useState } from "react";
import { Package, Search, X, CheckCircle, AlertTriangle, Layers, ArrowUpRight } from "lucide-react";

export interface StockItemHUD {
  sku: string;
  name: string;
  category: string;
  onHand: number;
  reserved: number;
  binLocation: string;
  unitPrice: number;
}

const DEFAULT_STOCK_CATALOG: StockItemHUD[] = [
  { sku: "SKU-BC-001", name: "Artisan Butter Shortbread 250g", category: "Biscuits", onHand: 1420, reserved: 380, binLocation: "A-01-04", unitPrice: 3.40 },
  { sku: "SKU-BC-002", name: "Dark Chocolate Ginger Snaps 200g", category: "Biscuits", onHand: 850, reserved: 210, binLocation: "A-02-11", unitPrice: 3.85 },
  { sku: "SKU-BC-003", name: "Highland Oatcakes (Gluten Free) 300g", category: "Biscuits", onHand: 2400, reserved: 900, binLocation: "B-04-02", unitPrice: 2.95 },
  { sku: "SKU-BC-004", name: "Clotted Cream Fudge Assortment 400g", category: "Confectionery", onHand: 620, reserved: 140, binLocation: "C-01-08", unitPrice: 5.50 },
  { sku: "SKU-PKG-010", name: "Eco Corrugated Outer Carton (Pack of 50)", category: "Packaging", onHand: 3100, reserved: 850, binLocation: "P-03-01", unitPrice: 18.20 },
  { sku: "SKU-ING-044", name: "Scottish Farmhouse Creamery Butter (25kg)", category: "Ingredients", onHand: 95, reserved: 40, binLocation: "COLD-02", unitPrice: 145.00 },
  { sku: "SKU-ING-082", name: "Fairtrade Golden Caster Sugar (20kg)", category: "Ingredients", onHand: 180, reserved: 65, binLocation: "DRY-01", unitPrice: 48.00 },
];

export default function LiveStockHUDModal({
  isOpen,
  onClose,
  currentDepartment = "General"
}: {
  isOpen: boolean;
  onClose: () => void;
  currentDepartment?: string;
}) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  if (!isOpen) return null;

  const categories = ["all", ...Array.from(new Set(DEFAULT_STOCK_CATALOG.map(s => s.category)))];

  const filtered = DEFAULT_STOCK_CATALOG.filter(item => {
    const matchesQ = 
      item.sku.toLowerCase().includes(query.toLowerCase()) ||
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      item.binLocation.toLowerCase().includes(query.toLowerCase());
    const matchesCat = categoryFilter === "all" || item.category === categoryFilter;
    return matchesQ && matchesCat;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Live Central Stock & Warehouse HUD</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Real-Time WMS Synced
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Cross-department inventory availability for Sales, Customer Services, Management & Procurement.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/40 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search SKU, item name, or bin location..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                  categoryFilter === cat
                    ? "bg-purple-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Inventory Table */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/40">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">SKU / Item</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Bin Location</th>
                  <th className="py-3 px-3 text-right">On Hand</th>
                  <th className="py-3 px-3 text-right">Reserved</th>
                  <th className="py-3 px-3 text-right">Available to Sell</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {filtered.map(item => {
                  const available = Math.max(0, item.onHand - item.reserved);
                  const isLow = available < 100;
                  return (
                    <tr key={item.sku} className="hover:bg-slate-900/50 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{item.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{item.sku}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-300">{item.category}</td>
                      <td className="py-3 px-3 font-mono text-purple-300">{item.binLocation}</td>
                      <td className="py-3 px-3 text-right font-medium text-slate-300">{item.onHand.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right font-medium text-amber-400">{item.reserved.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-400 text-sm">
                        {available.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {available === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Healthy
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-500">
                      No matching stock items found for &ldquo;{query}&rdquo;
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between text-xs text-slate-400">
          <span>Viewing as {currentDepartment} &bull; Total Catalog: {DEFAULT_STOCK_CATALOG.length} items</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition"
          >
            Close HUD
          </button>
        </div>
      </div>
    </div>
  );
}
