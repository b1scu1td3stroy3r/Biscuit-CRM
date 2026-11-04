"use client";

import React, { useState, useEffect } from "react";
import { 
  Headphones, 
  PhoneIncoming, 
  PhoneCall, 
  PhoneOff, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Package, 
  Truck, 
  FileText, 
  Mail, 
  User, 
  Search, 
  ShieldAlert, 
  Plus, 
  Send,
  Zap
} from "lucide-react";

export interface ServiceTicket {
  id: string;
  ticketNumber: string;
  customerName: string;
  company: string;
  accountRef: string;
  type: "Complaint" | "Delivery Delay" | "Damaged Item" | "Invoice Query" | "General";
  priority: "Urgent" | "High" | "Normal";
  status: "Open" | "In Investigation" | "Resolved";
  description: string;
  openedAt: string;
  assignedTo: string;
}

export interface CustomerOrderSummary {
  orderId: string;
  accountRef: string;
  customerName: string;
  stage: "Active Sales" | "Logistics (Dispatched)" | "Delivered" | "Retention / CS";
  carrier: string;
  trackingNumber: string;
  estimatedDelivery: string;
  items: string;
  total: number;
}

export default function CustomerServicesDesk({ 
  currentEmployee,
  onAwardXp 
}: { 
  currentEmployee?: any;
  onAwardXp?: (amount: number, reason: string) => void;
}) {
  const [activeSubTab, setActiveSubTab] = useState<"calls" | "tickets" | "orders">("calls");

  // Inbound Call Simulator State
  const [incomingCall, setIncomingCall] = useState<boolean>(true);
  const [activeCallTimer, setActiveCallTimer] = useState<number>(0);
  const [ringTimeSeconds, setRingTimeSeconds] = useState<number>(4);
  const [isCallConnected, setIsCallConnected] = useState<boolean>(false);
  const [callNotes, setCallNotes] = useState<string>("");

  // Screen Pop Target Account
  const [activeAccount, setActiveAccount] = useState<{
    name: string;
    company: string;
    accountRef: string;
    phone: string;
    email: string;
    tier: string;
    slaHoursRemaining: number;
  }>({
    name: "Alice Smith",
    company: "Acme Technologies",
    accountRef: "ACC-10001",
    phone: "+44 20 7946 0192",
    email: "alice@company.co.uk",
    tier: "Enterprise Key Account",
    slaHoursRemaining: 3.5
  });

  // Service Tickets
  const [tickets, setTickets] = useState<ServiceTicket[]>([
    {
      id: "TKT-101",
      ticketNumber: "TKT-101",
      customerName: "Alice Smith",
      company: "Acme Technologies",
      accountRef: "ACC-10001",
      type: "Delivery Delay",
      priority: "Urgent",
      status: "Open",
      description: "Shipment scheduled for 10:00 AM delivery not yet arrived at Leeds depot.",
      openedAt: "Today, 14:15",
      assignedTo: "Managing Director"
    },
    {
      id: "TKT-102",
      ticketNumber: "TKT-102",
      customerName: "Bob Jenkins",
      company: "Starlight Media",
      accountRef: "ACC-10002",
      type: "Complaint",
      priority: "High",
      status: "In Investigation",
      description: "Damaged packing seals on batch pallet PLT-EUR-WOOD.",
      openedAt: "Today, 11:30",
      assignedTo: "Managing Director"
    }
  ]);

  // Order & Logistics Pipeline Lookups
  const [orders] = useState<CustomerOrderSummary[]>([
    {
      orderId: "ORD-9481",
      accountRef: "ACC-10001",
      customerName: "Acme Technologies",
      stage: "Logistics (Dispatched)",
      carrier: "DPD Express Freight",
      trackingNumber: "DPD-UK-8849102",
      estimatedDelivery: "Today by 17:30",
      items: "500x Export Cartons, 2x Pallets",
      total: 1450.00
    },
    {
      orderId: "ORD-9482",
      accountRef: "ACC-10002",
      customerName: "Starlight Media",
      stage: "Active Sales",
      carrier: "Royal Mail Tracked 24",
      trackingNumber: "Pending Dispatch SLA",
      estimatedDelivery: "Tomorrow Morning",
      items: "50x Heavy Duty Crates",
      total: 420.00
    }
  ]);

  // Ring timer simulation
  useEffect(() => {
    let interval: any;
    if (incomingCall && !isCallConnected) {
      interval = setInterval(() => {
        setRingTimeSeconds(prev => prev + 1);
      }, 1000);
    } else if (isCallConnected) {
      interval = setInterval(() => {
        setActiveCallTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [incomingCall, isCallConnected]);

  // Answer Call handler
  const handleAnswerCall = () => {
    setIsCallConnected(true);
    setIncomingCall(false);

    // Gamification: Speed to answer reward
    if (ringTimeSeconds <= 8 && onAwardXp) {
      onAwardXp(35, "⚡ Lightning Fast Call Answer (< 8s SLA target)");
    } else if (onAwardXp) {
      onAwardXp(15, "Inbound Call Answered");
    }
  };

  const handleEndCall = () => {
    setIsCallConnected(false);
    setActiveCallTimer(0);
    setIncomingCall(false);
    if (onAwardXp && callNotes.trim().length > 10) {
      onAwardXp(20, "Detailed Call Interaction Logged");
    }
    alert("Call logged and account history updated.");
    setCallNotes("");
  };

  const handleResolveTicket = (ticketId: string) => {
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: "Resolved" } : t));
    if (onAwardXp) {
      onAwardXp(25, "Customer Service Ticket Resolved");
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
      {/* Header and Sub-tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Headphones className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">Customer Services & Support Desk</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Inbound call screen-pops, SLA ticket resolution, order logistics tracking & account logging.
              </p>
            </div>
          </div>
        </div>

        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveSubTab("calls")}
            className={`px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              activeSubTab === "calls" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5" /> Call Pop & Telephony
          </button>
          <button
            onClick={() => setActiveSubTab("tickets")}
            className={`px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              activeSubTab === "tickets" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" /> Support Tickets ({tickets.filter(t => t.status !== "Resolved").length})
          </button>
          <button
            onClick={() => setActiveSubTab("orders")}
            className={`px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              activeSubTab === "orders" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
            }`}
          >
            <Truck className="w-3.5 h-3.5" /> Order & Dispatch Tracker
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: INBOUND CALL & SCREEN POP */}
      {activeSubTab === "calls" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Call Controls & Live Alert */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 flex items-center gap-2">
              <PhoneIncoming className="w-4 h-4 text-teal-400" /> Inbound Telephony Gate
            </h3>

            {incomingCall && !isCallConnected ? (
              <div className="p-4 rounded-xl border border-teal-500/40 bg-teal-500/10 space-y-3 animate-pulse">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-300 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-ping"></span> Inbound Call Ringing
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-400">{ringTimeSeconds}s</span>
                </div>
                <div>
                  <p className="text-base font-bold text-white">{activeAccount.company}</p>
                  <p className="text-xs text-slate-300">{activeAccount.name} • {activeAccount.phone}</p>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={handleAnswerCall}
                    className="flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 transition"
                  >
                    <PhoneCall className="w-4 h-4" /> Answer (<span className="text-[10px] text-slate-900 font-black">+35 XP Speed Bonus</span>)
                  </button>
                </div>
              </div>
            ) : isCallConnected ? (
              <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> Call In Progress
                  </span>
                  <span className="text-sm font-mono font-black text-white">
                    {Math.floor(activeCallTimer / 60)}:{(activeCallTimer % 60).toString().padStart(2, "0")}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{activeAccount.company}</p>
                  <p className="text-xs text-slate-300">{activeAccount.name}</p>
                </div>
                <button
                  onClick={handleEndCall}
                  className="w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <PhoneOff className="w-4 h-4" /> End & Save Log (+20 XP)
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 text-center py-8">
                <PhoneIncoming className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Lines Ready. Waiting for next customer dial...</p>
                <button
                  onClick={() => { setIncomingCall(true); setRingTimeSeconds(2); }}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700"
                >
                  Simulate Inbound Call
                </button>
              </div>
            )}

            {/* SLA Response Metric */}
            <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg text-xs space-y-2">
              <div className="flex justify-between text-slate-400">
                <span>Avg Answer Speed:</span>
                <span className="font-bold text-emerald-400 font-mono">4.2s (Target &lt;10s)</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>First Contact Resolution:</span>
                <span className="font-bold text-indigo-400 font-mono">92.4%</span>
              </div>
            </div>
          </div>

          {/* Right: Instant Screen-Pop Account Profile & Call Notes */}
          <div className="lg:col-span-2 bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-bold">
                  Screen-Pop Active Account
                </span>
                <h3 className="text-lg font-bold text-white mt-1 flex items-center gap-2">
                  {activeAccount.company} <span className="text-xs font-normal text-slate-400">({activeAccount.accountRef})</span>
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {activeAccount.tier}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <p className="text-slate-400">Primary Contact</p>
                <p className="font-bold text-white mt-0.5">{activeAccount.name}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <p className="text-slate-400">Phone</p>
                <p className="font-mono text-indigo-300 mt-0.5">{activeAccount.phone}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <p className="text-slate-400">Email</p>
                <p className="font-mono text-indigo-300 mt-0.5">{activeAccount.email}</p>
              </div>
            </div>

            {/* Note & Email Logging */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-400" /> Log Call Interaction & Email Memo
              </label>
              <textarea
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                rows={3}
                placeholder="Enter customer inquiry notes, dispatch status given, complaint details, or promised follow-up actions..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    if (callNotes.trim()) {
                      alert(`Sent confirmation summary to ${activeAccount.email}`);
                      if (onAwardXp) onAwardXp(15, "Customer Email Summary Dispatched");
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
                >
                  <Mail className="w-3.5 h-3.5 text-sky-400" /> Email Customer Summary (+15 XP)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: SERVICE & COMPLAINT TICKETS */}
      {activeSubTab === "tickets" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400">
              Active Support & Complaint Tickets
            </h3>
            <button
              onClick={() => {
                const newTkt: ServiceTicket = {
                  id: `TKT-${Math.floor(100 + Math.random() * 900)}`,
                  ticketNumber: `TKT-${Math.floor(100 + Math.random() * 900)}`,
                  customerName: "Alice Smith",
                  company: "Acme Technologies",
                  accountRef: "ACC-10001",
                  type: "General",
                  priority: "Normal",
                  status: "Open",
                  description: "Customer requested expedited tracking update on dispatched freight.",
                  openedAt: "Just now",
                  assignedTo: currentEmployee?.name || "Managing Director"
                };
                setTickets([newTkt, ...tickets]);
              }}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Log New Support Case
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Ticket</th>
                  <th className="py-3 px-4">Account / Company</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Issue Description</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                {tickets.map(ticket => (
                  <tr key={ticket.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-300">{ticket.ticketNumber}</td>
                    <td className="py-3 px-4 font-medium text-white">
                      <div>{ticket.company}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{ticket.customerName}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-200">{ticket.type}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        ticket.priority === "Urgent" ? "bg-rose-500/20 text-rose-300 border-rose-500/30" :
                        ticket.priority === "High" ? "bg-amber-500/20 text-amber-300 border-amber-500/30" :
                        "bg-slate-800 text-slate-300 border-slate-700"
                      }`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-300">{ticket.description}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        ticket.status === "Resolved" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" :
                        "bg-sky-500/20 text-sky-300 border-sky-500/30"
                      }`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {ticket.status !== "Resolved" ? (
                        <button
                          onClick={() => handleResolveTicket(ticket.id)}
                          className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] inline-flex items-center gap-1 transition shadow"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Resolve (+25 XP)
                        </button>
                      ) : (
                        <span className="text-[11px] text-emerald-400 font-semibold">Closed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: ORDER & LOGISTICS TRACKING */}
      {activeSubTab === "orders" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400">
              Cross-Pipeline Order & Delivery SLA Status
            </h3>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Customer Account</th>
                  <th className="py-3 px-4">Pipeline Stage</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Carrier / Tracking</th>
                  <th className="py-3 px-4">Est. Delivery</th>
                  <th className="py-3 px-4 text-right">Order Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                {orders.map(ord => (
                  <tr key={ord.orderId} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-300">{ord.orderId}</td>
                    <td className="py-3 px-4 font-medium text-white">{ord.customerName}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        ord.stage.includes("Logistics") ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" :
                        ord.stage.includes("Active Sales") ? "bg-sky-500/20 text-sky-300 border-sky-500/30" :
                        "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      }`}>
                        {ord.stage}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{ord.items}</td>
                    <td className="py-3 px-4 font-mono">
                      <div>{ord.carrier}</div>
                      <div className="text-[10px] text-teal-400">{ord.trackingNumber}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-amber-300">{ord.estimatedDelivery}</td>
                    <td className="py-3 px-4 font-bold text-white text-right">£{ord.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
