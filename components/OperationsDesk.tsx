"use client";

import React, { useState, useEffect } from "react";
import { 
  Wrench, 
  Package, 
  Truck, 
  CheckCircle2, 
  Barcode, 
  Printer, 
  Clock, 
  Box, 
  ArrowRight,
  ShieldCheck
} from "lucide-react";

interface DispatchOrder {
  id: string;
  orderNumber: string;
  customer: string;
  destination: string;
  items: string;
  units: number;
  weightKg: number;
  carrier: "DPD Express" | "Royal Mail 24" | "Freightliner";
  trackingCode: string;
  status: "Ready for Picking" | "Packed" | "Dispatched";
}

export default function OperationsDesk({ 
  onAwardXp,
  onDispatchOrder
}: { 
  onAwardXp?: (amount: number, reason: string) => void;
  onDispatchOrder?: (orderId: string) => void;
}) {
  const DEFAULT_DISPATCH_ORDERS: DispatchOrder[] = [
    {
      id: "DSP-1001",
      orderNumber: "ORD-9481",
      customer: "Acme Technologies",
      destination: "Leeds Depot (LS1 4DY)",
      items: "Export Shipping Cartons",
      units: 25,
      weightKg: 42.5,
      carrier: "DPD Express",
      trackingCode: "DPD-9948102-GB",
      status: "Ready for Picking"
    },
    {
      id: "DSP-1002",
      orderNumber: "ORD-9482",
      customer: "Starlight Media",
      destination: "London Hub (EC2A 1NT)",
      items: "Heavy Duty Crates",
      units: 15,
      weightKg: 28.0,
      carrier: "Royal Mail 24",
      trackingCode: "RM-2094811-GB",
      status: "Packed"
    }
  ];

  const [orders, setOrders] = useState<DispatchOrder[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("biscuit_crm_dispatch_orders");
        if (saved) return JSON.parse(saved);
      } catch (err) {
        console.warn("Failed to read dispatch orders from localStorage", err);
      }
    }
    return DEFAULT_DISPATCH_ORDERS;
  });

  useEffect(() => {
    try {
      localStorage.setItem("biscuit_crm_dispatch_orders", JSON.stringify(orders));
    } catch (err) {
      console.warn("Failed to persist dispatch orders to localStorage", err);
    }
  }, [orders]);

  const handleAdvanceStatus = (id: string) => {
    setOrders(prev => prev.map(ord => {
      if (ord.id !== id) return ord;
      if (ord.status === "Ready for Picking") {
        if (onAwardXp) onAwardXp(15, "Order Picked & Palletized (+15 XP)");
        return { ...ord, status: "Packed" };
      }
      if (ord.status === "Packed") {
        if (onAwardXp) onAwardXp(30, "Carrier Manifest Signed & Dispatched (+30 XP)");
        if (onDispatchOrder) onDispatchOrder(ord.orderNumber);
        return { ...ord, status: "Dispatched" };
      }
      return ord;
    }));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Wrench className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">Operations & Fulfillment Dispatch Desk</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live picking manifest, package verification, shipping label generator & courier handover.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            {orders.filter(o => o.status !== "Dispatched").length} Active in Queue
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="text-slate-400 text-xs flex items-center justify-between">
            <span>Picking Stage</span>
            <Box className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {orders.filter(o => o.status === "Ready for Picking").length}
          </div>
          <p className="text-[11px] text-slate-500">Reserved stock awaiting packaging</p>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="text-slate-400 text-xs flex items-center justify-between">
            <span>Packed & Labelled</span>
            <Barcode className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {orders.filter(o => o.status === "Packed").length}
          </div>
          <p className="text-[11px] text-slate-500">Courier barcode generated</p>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="text-slate-400 text-xs flex items-center justify-between">
            <span>Dispatched Today</span>
            <Truck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {orders.filter(o => o.status === "Dispatched").length}
          </div>
          <p className="text-[11px] text-emerald-400/80 font-medium">Physical inventory deducted</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-3 px-4">Order Ref</th>
              <th className="py-3 px-4">Customer & Destination</th>
              <th className="py-3 px-4">Items / Units</th>
              <th className="py-3 px-4">Carrier & Tracking</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Fulfillment Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
            {orders.map(order => (
              <tr key={order.id} className="hover:bg-slate-800/40 transition">
                <td className="py-3 px-4 font-mono font-bold text-purple-300">{order.orderNumber}</td>
                <td className="py-3 px-4">
                  <div className="font-bold text-white">{order.customer}</div>
                  <div className="text-[10px] text-slate-400">{order.destination}</div>
                </td>
                <td className="py-3 px-4">
                  <div>{order.items}</div>
                  <div className="text-[10px] text-indigo-400 font-mono">{order.units} units ({order.weightKg} kg)</div>
                </td>
                <td className="py-3 px-4">
                  <div className="font-semibold text-slate-200">{order.carrier}</div>
                  <div className="text-[10px] font-mono text-teal-400">{order.trackingCode}</div>
                </td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    order.status === "Dispatched" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" :
                    order.status === "Packed" ? "bg-sky-500/20 text-sky-300 border-sky-500/30" :
                    "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  }`}>
                    {order.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-right space-x-2">
                  <button
                    onClick={() => alert(`🖨️ Printing shipping label & manifest for ${order.orderNumber} (${order.carrier})`)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                    title="Print Label"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                  {order.status !== "Dispatched" ? (
                    <button
                      onClick={() => handleAdvanceStatus(order.id)}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] inline-flex items-center gap-1.5 shadow transition"
                    >
                      {order.status === "Ready for Picking" ? (
                        <>Pack & Label <ArrowRight className="w-3 h-3" /></>
                      ) : (
                        <>Confirm Dispatch (+30 XP) <CheckCircle2 className="w-3 h-3 text-emerald-300" /></>
                      )}
                    </button>
                  ) : (
                    <span className="text-[11px] text-emerald-400 font-semibold inline-flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Dispatched
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
