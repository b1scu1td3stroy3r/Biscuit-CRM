'use client';

import React, { useState, useMemo } from 'react';
import { ShoppingCart, ShieldAlert, CheckCircle2, X, FileText, Plus, Trash2 } from 'lucide-react';

interface CPQItem {
  id: string;
  name: string;
  basePrice: number;
  cost: number;
  qty: number;
  discountPct: number;
}

export default function CPQModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  const catalog = [
    { id: 'PROD-SVR', name: 'Biscuit Private Enterprise Appliance', basePrice: 4800, cost: 2200 },
    { id: 'PROD-SLA', name: '24/7 Mission-Critical SLA Support', basePrice: 1200, cost: 400 },
    { id: 'PROD-MIG', name: 'Zero-Knowledge Legacy Cloud Data Migration', basePrice: 2500, cost: 900 }
  ];

  const [items, setItems] = useState<CPQItem[]>([
    { id: 'PROD-SVR', name: 'Biscuit Private Enterprise Appliance', basePrice: 4800, cost: 2200, qty: 2, discountPct: 10 },
    { id: 'PROD-SLA', name: '24/7 Mission-Critical SLA Support', basePrice: 1200, cost: 400, qty: 2, discountPct: 10 }
  ]);

  const summary = useMemo(() => {
    let subtotal = 0;
    let totalCost = 0;

    items.forEach(item => {
      // Auto volume tier discount logic
      let dynamicDiscount = item.discountPct;
      if (item.qty >= 10) dynamicDiscount = Math.max(item.discountPct, 20);
      else if (item.qty >= 5) dynamicDiscount = Math.max(item.discountPct, 15);

      const discountedPrice = item.basePrice * (1 - dynamicDiscount / 100);
      subtotal += discountedPrice * item.qty;
      totalCost += item.cost * item.qty;
    });

    const marginGbp = subtotal - totalCost;
    const marginPct = subtotal > 0 ? (marginGbp / subtotal) * 100 : 0;
    const vat = subtotal * 0.20;
    const grandTotal = subtotal + vat;

    return { subtotal, totalCost, marginGbp, marginPct, vat, grandTotal };
  }, [items]);

  const handleAddItem = (prod: any) => {
    const existing = items.find(i => i.id === prod.id);
    if (existing) {
      setItems(items.map(i => i.id === prod.id ? { ...i, qty: i.qty + 1 } : i));
    } else {
      setItems([...items, { ...prod, qty: 1, discountPct: 0 }]);
    }
  };

  const handleRemove = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
              <ShoppingCart className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-white">Advanced CPQ & Deal Margin Engine</h2>
              <p className="text-xs text-slate-400">Salesforce CPQ-grade dynamic bundling, volume tiers, and margin protection</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Catalog Selector */}
        <div className="py-4 border-b border-slate-800 flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-mono text-slate-400 whitespace-nowrap">Add from Catalog:</span>
          {catalog.map(prod => (
            <button
              key={prod.id}
              type="button"
              onClick={() => handleAddItem(prod)}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 whitespace-nowrap transition"
            >
              <Plus className="w-3 h-3 text-sky-400" />
              {prod.name} (£{prod.basePrice})
            </button>
          ))}
        </div>

        {/* Configured Lines Table */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800 pb-2">
                <th className="pb-2">Product / Service</th>
                <th className="pb-2">Base Price</th>
                <th className="pb-2">Qty</th>
                <th className="pb-2">Discount %</th>
                <th className="pb-2 text-right">Line Total</th>
                <th className="pb-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {items.map(item => {
                const discounted = item.basePrice * (1 - item.discountPct / 100);
                return (
                  <tr key={item.id} className="text-slate-300">
                    <td className="py-3 font-semibold text-slate-200">{item.name}</td>
                    <td className="py-3">£{item.basePrice.toLocaleString()}</td>
                    <td className="py-3">
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => {
                          const v = parseInt(e.target.value) || 1;
                          setItems(items.map(i => i.id === item.id ? { ...i, qty: v } : i));
                        }}
                        className="w-16 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white focus:outline-none"
                      />
                    </td>
                    <td className="py-3">
                      <input
                        type="number"
                        min="0"
                        max="80"
                        value={item.discountPct}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          setItems(items.map(i => i.id === item.id ? { ...i, discountPct: v } : i));
                        }}
                        className="w-16 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white focus:outline-none"
                      />
                    </td>
                    <td className="py-3 text-right font-bold text-white">
                      £{(discounted * item.qty).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 text-center">
                      <button type="button" onClick={() => handleRemove(item.id)} className="text-rose-400 hover:text-rose-300">
                        <Trash2 className="w-4 h-4 mx-auto" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Real-Time CPQ Margin & Approval Guard */}
        <div className="pt-4 border-t border-slate-800 grid grid-cols-2 gap-4">
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5 font-mono text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Direct Cost Basis:</span>
              <span>£{summary.totalCost.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-slate-300 font-semibold">
              <span>Gross Margin (£):</span>
              <span>£{summary.marginGbp.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-800">
              <span className="text-slate-300">Net Profit Margin:</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                summary.marginPct >= 35 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                summary.marginPct >= 20 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}>
                {summary.marginPct.toFixed(1)}% {summary.marginPct < 20 ? '• GUARD VIOLATION' : '• APPROVED'}
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5 font-mono text-xs text-right">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal:</span>
              <span>£{summary.subtotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>VAT (20%):</span>
              <span>£{summary.vat.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-white font-bold text-sm pt-1 border-t border-slate-800">
              <span>Quote Total:</span>
              <span className="text-sky-400">£{summary.grandTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={summary.marginPct < 20}
            onClick={() => {
              alert(`Quote successfully generated! Grand Total: £${summary.grandTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`);
              onClose();
            }}
            className={`px-5 py-2 rounded-xl text-xs font-bold shadow-lg transition flex items-center gap-1.5 ${
              summary.marginPct >= 20
                ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/20'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <FileText className="w-4 h-4" />
            Issue Formal CPQ Quote
          </button>
        </div>
      </div>
    </div>
  );
}
