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
  ShieldCheck,
  MapPin,
  PoundSterling,
  CheckSquare,
  Square,
  AlertTriangle,
  X
} from "lucide-react";

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  location: string;
  status: "Reserved" | "Picked" | "Packaged" | "Dispatched";
}

export interface DispatchOrder {
  id: string;
  orderNumber: string;
  customer: string;
  destination: string;
  weightKg: number;
  carrier: "DPD Express" | "Royal Mail 24" | "Freightliner";
  trackingCode: string;
  status: "Ready for Picking" | "Picked" | "Packaged" | "Dispatched";
  shippingCost?: number;
  items: OrderItem[];
}

export default function OperationsDesk({
  onAwardXp,
  onDispatchOrder
}: {
  onAwardXp?: (amount: number, reason: string) => void;
  onDispatchOrder?: (orderId: string) => void;
}) {
  const DEFAULT_DISPATCH_ORDERS: DispatchOrder[] = [];

  const [orders, setOrders] = useState<DispatchOrder[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("biscuit_crm_dispatch_orders");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Check if stored data uses the legacy string format for items
            const isLegacy = parsed.some(ord => typeof ord.items === "string" || !Array.isArray(ord.items));
            if (!isLegacy) {
              return parsed;
            }
          }
        }
      } catch (err) {
        console.warn("Failed to read dispatch orders from localStorage", err);
      }
    }
    return DEFAULT_DISPATCH_ORDERS;
  });

  // Modal State for Address Verification & Shipping Cost
  const [activeModalOrder, setActiveModalOrder] = useState<DispatchOrder | null>(null);
  const [modalMode, setModalMode] = useState<"print" | "dispatch">("dispatch");
  const [confirmedAddress, setConfirmedAddress] = useState("");
  const [shippingCostInput, setShippingCostInput] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem("biscuit_crm_dispatch_orders", JSON.stringify(orders));
    } catch (err) {
      console.warn("Failed to persist dispatch orders to localStorage", err);
    }
  }, [orders]);

  // Toggle item picking status
  const handleToggleItemPick = (orderId: string, itemId: string) => {
    setOrders(prev =>
      prev.map(ord => {
        if (ord.id !== orderId) return ord;
        const updatedItems = ord.items.map(item => {
          if (item.id !== itemId) return item;
          const nextStatus = item.status === "Reserved" ? ("Picked" as const) : ("Reserved" as const);
          return { ...item, status: nextStatus };
        });
        return { ...ord, items: updatedItems };
      })
    );
  };

  const openFulfillmentModal = (order: DispatchOrder, mode: "print" | "dispatch") => {
    setActiveModalOrder(order);
    setModalMode(mode);
    setConfirmedAddress(order.destination);
    setShippingCostInput(order.shippingCost ? order.shippingCost.toString() : "");
  };

  const handleConfirmModalAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalOrder) return;

    const parsedCost = parseFloat(shippingCostInput);
    if (isNaN(parsedCost) || parsedCost < 0) {
      alert("Please enter a valid shipping price (e.g. 12.50).");
      return;
    }

    if (!confirmedAddress.trim()) {
      alert("Please confirm the shipping address.");
      return;
    }

    // Deduct shipping fee from daily revenue record in localStorage
    try {
      const existingCosts = JSON.parse(localStorage.getItem("biscuit_crm_daily_shipping_costs") || "[]");
      existingCosts.push({
        orderNumber: activeModalOrder.orderNumber,
        customer: activeModalOrder.customer,
        carrier: activeModalOrder.carrier,
        amount: parsedCost,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem("biscuit_crm_daily_shipping_costs", JSON.stringify(existingCosts));
      window.dispatchEvent(new Event("shipping_fee_updated"));
    } catch (err) {
      console.warn("Failed to deduct shipping cost from daily revenue", err);
    }

    if (modalMode === "print") {
      setOrders(prev =>
        prev.map(ord =>
          ord.id === activeModalOrder.id
            ? { ...ord, destination: confirmedAddress, shippingCost: parsedCost }
            : ord
        )
      );
      alert(`🖨️ Shipping Label Generated!

Carrier: ${activeModalOrder.carrier}
Tracking: ${activeModalOrder.trackingCode}
Address: ${confirmedAddress}
Shipping Cost: £${parsedCost.toFixed(2)} (Deducted from daily revenue)`);
      setActiveModalOrder(null);
      return;
    }

    // Modal Mode is Dispatch: Mark dispatched, award XP, and deplete inventory
    setOrders(prev =>
      prev.map(ord => {
        if (ord.id !== activeModalOrder.id) return ord;
        // Mark all items as Shipped / Depleted from active warehouse inventory
        const depletedItems = ord.items.map(item => ({ ...item, status: "Dispatched" as const }));
        return {
          ...ord,
          status: "Dispatched",
          destination: confirmedAddress,
          shippingCost: parsedCost,
          items: depletedItems
        };
      })
    );

    if (onAwardXp) onAwardXp(30, "Carrier Handover Complete & Shipping Fee Logged (+30 XP)");
    if (onDispatchOrder) onDispatchOrder(activeModalOrder.orderNumber);

    alert(`✅ Order ${activeModalOrder.orderNumber} Dispatched!

• Shipping Cost: £${parsedCost.toFixed(2)} deducted from revenue.
• Items permanently depleted from active inventory.`);
    setActiveModalOrder(null);
  };

  const handleAdvanceToPacked = (order: DispatchOrder) => {
    const unpicked = order.items.filter(i => i.status !== "Picked");
    if (unpicked.length > 0) {
      alert(`⚠️ Cannot pack order! ${unpicked.length} item(s) are still at "Reserved" status. Please pick all warehouse locations first.`);
      return;
    }
    setOrders(prev =>
      prev.map(ord =>
        ord.id === order.id ? { ...ord, status: "Packaged" } : ord
      )
    );
    if (onAwardXp) onAwardXp(15, "Order Picked & Palletized (+15 XP)");
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Wrench className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">Operations & Fulfillment Dispatch Desk</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Item-level picking manifests, warehouse bin tracking, mandatory shipping fee deductions & courier handover.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            {orders.filter(o => o.status !== "Dispatched").length} Active in Queue
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="text-slate-400 text-xs flex items-center justify-between">
            <span>Picking Stage</span>
            <Box className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {orders.filter(o => o.status === "Ready for Picking").length}
          </div>
          <p className="text-[11px] text-slate-500">Reserved stock awaiting warehouse picking</p>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="text-slate-400 text-xs flex items-center justify-between">
            <span>Packed & Labelled</span>
            <Barcode className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {orders.filter(o => o.status === "Packaged").length}
          </div>
          <p className="text-[11px] text-slate-500">Items picked; awaiting shipping fee & dispatch</p>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="text-slate-400 text-xs flex items-center justify-between">
            <span>Dispatched Today</span>
            <Truck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {orders.filter(o => o.status === "Dispatched").length}
          </div>
          <p className="text-[11px] text-emerald-400/80 font-medium">Physical inventory depleted from system</p>
        </div>
      </div>

      {/* Orders Manifest Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-3 px-4">Order Ref</th>
              <th className="py-3 px-4">Customer & Destination</th>
              <th className="py-3 px-4">Picking Manifest & Bin Locations</th>
              <th className="py-3 px-4">Carrier & Tracking</th>
              <th className="py-3 px-4">Status & Shipping Cost</th>
              <th className="py-3 px-4 text-right">Fulfillment Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
            {orders.map(order => {
              const safeItems = Array.isArray(order.items) ? order.items : [];
              const allItemsPicked = safeItems.length > 0 && safeItems.every(i => i.status === "Picked" || i.status === "Dispatched");
              return (
                <tr key={order.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4 font-mono font-bold text-purple-300 align-top">
                    {order.orderNumber}
                  </td>
                  <td className="py-3 px-4 align-top">
                    <div className="font-bold text-white">{order.customer}</div>
                    <div className="text-[11px] text-slate-400 flex items-start gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                      <span>{order.destination}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 align-top">
                    <div className="space-y-2">
                      {safeItems.map(item => (
                        <div
                          key={item.id}
                          className={`p-2 rounded-lg border text-[11px] transition ${
                            item.status === "Dispatched"
                              ? "bg-slate-950/40 border-slate-800 text-slate-500 opacity-60"
                              : item.status === "Picked"
                              ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
                              : "bg-slate-950 border-amber-500/30 text-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-200">
                              {item.quantity}x {item.name}
                            </span>
                            {order.status === "Ready for Picking" ? (
                              <button
                                onClick={() => handleToggleItemPick(order.id, item.id)}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition ${
                                  item.status === "Picked"
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                    : "bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20"
                                }`}
                              >
                                {item.status === "Picked" ? (
                                  <>
                                    <CheckSquare className="w-3 h-3 text-emerald-400" /> Picked
                                  </>
                                ) : (
                                  <>
                                    <Square className="w-3 h-3" /> Reserved (Pick Item)
                                  </>
                                )}
                              </button>
                            ) : (
                              <span
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                  item.status === "Dispatched"
                                    ? "bg-slate-800 text-slate-400 line-through"
                                    : "bg-emerald-500/20 text-emerald-300"
                                }`}
                              >
                                {item.status === "Dispatched" ? "Depleted" : "Picked"}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-amber-400/90 font-mono mt-1 flex items-center gap-1">
                            <Box className="w-3 h-3" /> Location: {item.location}
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 align-top">
                    <div className="font-semibold text-slate-200">{order.carrier}</div>
                    <div className="text-[10px] font-mono text-teal-400">{order.trackingCode}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-1">{order.weightKg} kg total</div>
                  </td>
                  <td className="py-3 px-4 align-top">
                    <div className="space-y-1">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                          order.status === "Dispatched"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : order.status === "Packaged"
                            ? "bg-sky-500/20 text-sky-300 border-sky-500/30"
                            : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                        }`}
                      >
                        {order.status}
                      </span>
                      {order.shippingCost !== undefined ? (
                        <div className="text-[11px] font-mono text-emerald-400 font-bold flex items-center gap-0.5">
                          <span>Shipping: £{order.shippingCost.toFixed(2)}</span>
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-500 italic">Fee pending</div>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right space-x-2 align-top">
                    <button
                      onClick={() => openFulfillmentModal(order, "print")}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                      title="Print Shipping Label & Confirm Cost"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    {order.status === "Ready for Picking" ? (
                      <button
                        onClick={() => handleAdvanceToPacked(order)}
                        disabled={!allItemsPicked}
                        className={`px-3 py-1.5 rounded-lg font-bold text-[11px] inline-flex items-center gap-1.5 shadow transition ${
                          allItemsPicked
                            ? "bg-purple-600 hover:bg-purple-500 text-white cursor-pointer"
                            : "bg-slate-800 text-slate-500 cursor-not-allowed opacity-60 border border-slate-700"
                        }`}
                      >
                        Pack & Label <ArrowRight className="w-3 h-3" />
                      </button>
                    ) : order.status === "Packaged" ? (
                      <button
                        onClick={() => openFulfillmentModal(order, "dispatch")}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] inline-flex items-center gap-1.5 shadow transition"
                      >
                        Confirm Dispatch (+30 XP) <CheckCircle2 className="w-3 h-3 text-emerald-200" />
                      </button>
                    ) : (
                      <span className="text-[11px] text-emerald-400 font-semibold inline-flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Dispatched
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mandatory Address Verification & Shipping Cost Entry Modal */}
      {activeModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Truck className="w-5 h-5 text-purple-400" />
                  {modalMode === "dispatch" ? "Confirm Dispatch & Courier Handover" : "Shipping Label Generator"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Order {activeModalOrder.orderNumber} &bull; {activeModalOrder.customer}
                </p>
              </div>
              <button
                onClick={() => setActiveModalOrder(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmModalAction} className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-200/90 leading-relaxed">
                  Financial Control: Entering the shipping price will automatically deduct this courier expense from today's net settled revenue. Confirm that destination coordinates match the packing slip.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Confirm Destination Address
                </label>
                <textarea
                  value={confirmedAddress}
                  onChange={(e) => setConfirmedAddress(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-purple-400 resize-none font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Carrier Service
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`${activeModalOrder.carrier} (${activeModalOrder.trackingCode})`}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Shipping Cost (£ Mandatory)
                  </label>
                  <div className="relative">
                    <PoundSterling className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 14.50"
                      value={shippingCostInput}
                      onChange={(e) => setShippingCostInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-400 font-mono font-bold"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveModalOrder(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 shadow transition flex items-center gap-1.5"
                >
                  {modalMode === "dispatch" ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" /> Complete Handover & Deduct Fee
                    </>
                  ) : (
                    <>
                      <Printer className="w-4 h-4" /> Print Label & Log Cost
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
