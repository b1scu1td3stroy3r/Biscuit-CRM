'use client';

import React, { useState } from 'react';
import { Building, Plus, FileText, CheckCircle2, Clock, DollarSign, Upload, ShieldCheck, AlertCircle } from 'lucide-react';

interface Vendor {
  id: string;
  name: string;
  contact: string;
  email: string;
  vatNumber: string;
  status: 'Approved' | 'Pending Review' | 'Dormant';
  paymentTerms: string;
}

interface PurchaseOrder {
  id: string;
  vendorName: string;
  description: string;
  amount: number;
  status: 'Draft' | 'Approved' | 'Sent' | 'Delivered';
  createdAt: string;
  poNumber: string;
}

export default function ProcurementDesk({ currentEmployee }: { currentEmployee?: any }) {
  const [activeTab, setActiveTab] = useState<'vendors' | 'pos'>('pos');

  // Initial local state / defaults
  const [vendors, setVendors] = useState<Vendor[]>([
    { id: '1', name: 'Apex Packaging Ltd', contact: 'Mark Evans', email: 'orders@apexpkg.co.uk', vatNumber: 'GB 891 2341 02', status: 'Approved', paymentTerms: 'Net 30' },
    { id: '2', name: 'Global Logistics Hub', contact: 'Sarah Jenkins', email: 'accounts@globallogistics.com', vatNumber: 'GB 102 9982 44', status: 'Approved', paymentTerms: 'Net 14' },
    { id: '3', name: 'Raw Material Direct', contact: 'Liam Scott', email: 'sales@rawdirect.co.uk', vatNumber: 'GB 443 1120 99', status: 'Pending Review', paymentTerms: 'Pre-payment' },
  ]);

  const [pos, setPos] = useState<PurchaseOrder[]>([
    { id: 'po-1', poNumber: 'PO-2026-001', vendorName: 'Apex Packaging Ltd', description: '500x Corrugated Export Boxes', amount: 1450.00, status: 'Approved', createdAt: '2026-11-02' },
    { id: 'po-2', poNumber: 'PO-2026-002', vendorName: 'Global Logistics Hub', description: 'Pallet Freight Distribution (London Hub)', amount: 2300.00, status: 'Sent', createdAt: '2026-11-03' },
  ]);

  const [newVendor, setNewVendor] = useState({ name: '', contact: '', email: '', vatNumber: '', paymentTerms: 'Net 30' });
  const [newPO, setNewPO] = useState({ vendorName: '', description: '', amount: '' });
  const [showPOModal, setShowPOModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);

  const handleCreatePO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPO.vendorName || !newPO.amount) return;
    const poNum = `PO-2026-00${pos.length + 1}`;
    const entry: PurchaseOrder = {
      id: `po-${Date.now()}`,
      poNumber: poNum,
      vendorName: newPO.vendorName,
      description: newPO.description,
      amount: parseFloat(newPO.amount) || 0,
      status: 'Approved',
      createdAt: new Date().toISOString().split('T')[0],
    };
    setPos([entry, ...pos]);
    setNewPO({ vendorName: '', description: '', amount: '' });
    setShowPOModal(false);
  };

  const handleCreateVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendor.name) return;
    const entry: Vendor = {
      id: `ven-${Date.now()}`,
      name: newVendor.name,
      contact: newVendor.contact,
      email: newVendor.email,
      vatNumber: newVendor.vatNumber,
      status: 'Pending Review',
      paymentTerms: newVendor.paymentTerms,
    };
    setVendors([entry, ...vendors]);
    setNewVendor({ name: '', contact: '', email: '', vatNumber: '', paymentTerms: 'Net 30' });
    setShowVendorModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building className="w-5 h-5 text-indigo-400" /> Procurement, Vendors & Inventory POs
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage authorized suppliers, upload quote tenders, and issue approved purchase orders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowVendorModal(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            + Register Vendor
          </button>
          <button
            onClick={() => setShowPOModal(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition"
          >
            + Raise Purchase Order
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('pos')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === 'pos' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Purchase Orders ({pos.length})
        </button>
        <button
          onClick={() => setActiveTab('vendors')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === 'vendors' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Approved Vendors ({vendors.length})
        </button>
      </div>

      {/* Purchase Orders List */}
      {activeTab === 'pos' && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/60 uppercase font-mono text-[10px] text-slate-400">
              <tr>
                <th className="px-4 py-3">PO Number</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Line Description</th>
                <th className="px-4 py-3">Net Value</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {pos.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/30 transition">
                  <td className="px-4 py-3 font-mono font-bold text-indigo-300">{p.poNumber}</td>
                  <td className="px-4 py-3 font-medium text-white">{p.vendorName}</td>
                  <td className="px-4 py-3 text-slate-400">{p.description}</td>
                  <td className="px-4 py-3 font-bold text-white">£{p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      p.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500">{p.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Vendors List */}
      {activeTab === 'vendors' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {vendors.map((v) => (
            <div key={v.id} className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-white text-sm">{v.name}</h4>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  v.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-400'
                }`}>
                  {v.status}
                </span>
              </div>
              <div className="text-xs text-slate-400 space-y-1">
                <div><span className="text-slate-500">Contact:</span> {v.contact}</div>
                <div><span className="text-slate-500">Email:</span> {v.email}</div>
                <div><span className="text-slate-500">VAT:</span> {v.vatNumber}</div>
                <div><span className="text-slate-500">Terms:</span> {v.paymentTerms}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Raise PO */}
      {showPOModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Raise Official Purchase Order</h3>
            <form onSubmit={handleCreatePO} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Select Supplier / Vendor</label>
                <select
                  value={newPO.vendorName}
                  onChange={(e) => setNewPO({ ...newPO, vendorName: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  required
                >
                  <option value="">-- Choose Vendor --</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.name}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Line Item Description</label>
                <input
                  type="text"
                  placeholder="e.g. 500 units raw corrugated materials"
                  value={newPO.description}
                  onChange={(e) => setNewPO({ ...newPO, description: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  required
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Total Net Amount (£)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newPO.amount}
                  onChange={(e) => setNewPO({ ...newPO, amount: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPOModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-white"
                >
                  Authorize & Issue PO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Register Vendor */}
      {showVendorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Register New Supplier / Vendor</h3>
            <form onSubmit={handleCreateVendor} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Company / Vendor Name</label>
                <input
                  type="text"
                  value={newVendor.name}
                  onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={newVendor.contact}
                    onChange={(e) => setNewVendor({ ...newVendor, contact: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Email</label>
                  <input
                    type="email"
                    value={newVendor.email}
                    onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">VAT Number</label>
                  <input
                    type="text"
                    value={newVendor.vatNumber}
                    onChange={(e) => setNewVendor({ ...newVendor, vatNumber: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Payment Terms</label>
                  <select
                    value={newVendor.paymentTerms}
                    onChange={(e) => setNewVendor({ ...newVendor, paymentTerms: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="Net 14">Net 14 Days</option>
                    <option value="Net 30">Net 30 Days</option>
                    <option value="Net 60">Net 60 Days</option>
                    <option value="Pre-payment">Pre-payment Required</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVendorModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-white"
                >
                  Save Vendor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
