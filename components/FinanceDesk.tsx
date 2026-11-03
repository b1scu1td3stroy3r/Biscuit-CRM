'use client';

import React, { useState } from 'react';
import { 
  PoundSterling, FileText, CheckCircle2, Clock, Send, 
  Download, ArrowUpRight, ShieldCheck, Mail, AlertCircle, Building2
} from 'lucide-react';
import { Contact, db } from '../packages/storage/src/db';

interface FinanceDeskProps {
  contacts: Contact[];
  onContactUpdated: () => void;
  currentUser: string;
}

export default function FinanceDesk({ contacts, onContactUpdated, currentUser }: FinanceDeskProps) {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(contacts[0] || null);
  const [invoiceAmount, setInvoiceAmount] = useState<number>(3500);
  const [vatRate] = useState<number>(0.20);
  const [dueDate, setDueDate] = useState<string>('2026-11-30');
  const [paymentTerms, setPaymentTerms] = useState<string>('Net 30 Days');
  const [isUpdating, setIsUpdating] = useState(false);

  // Revenue pipeline projections
  const totalBilledValue = contacts.reduce((sum, c) => sum + (c.dealValue || 3500), 0);
  const vatTotal = totalBilledValue * vatRate;

  const handleUpdateInvoiceStatus = async (contactId: number, status: Contact['invoiceStatus']) => {
    setIsUpdating(true);
    try {
      const now = new Date().toISOString();
      await db.contacts.update(contactId, {
        invoiceStatus: status,
        dealValue: invoiceAmount,
        synced: false,
        updatedAt: now,
      });

      await db.outbox.add({
        type: 'UPDATE',
        table: 'contacts',
        payload: {
          id: contactId,
          invoiceStatus: status,
          dealValue: invoiceAmount,
          updatedAt: now,
        },
        timestamp: Date.now(),
      });

      onContactUpdated();
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSendInvoiceEmail = (contact: Contact) => {
    const total = invoiceAmount * (1 + vatRate);
    const subject = encodeURIComponent(`[INVOICE & BILLING SCHEDULE] ${contact.company || contact.name} [Ref: ${contact.accountNumber}]`);
    const body = encodeURIComponent(
      `Dear ${contact.name},\n\n` +
      `Please find detailed below the formal invoicing breakdown for account reference ${contact.accountNumber}.\n\n` +
      `INVOICE SUMMARY:\n` +
      `• Registered Entity: ${contact.company || contact.name}${contact.crn ? ` (CRN: ${contact.crn})` : ''}\n` +
      `• Billing Address: ${contact.billingAddress || 'On file'}\n` +
      `• Net Amount: £${invoiceAmount.toLocaleString()}\n` +
      `• UK VAT (20%): £${(invoiceAmount * vatRate).toLocaleString()}\n` +
      `• Gross Total Payable: £${total.toLocaleString()}\n` +
      `• Payment Terms: ${paymentTerms}\n` +
      `• Due Date: ${dueDate}\n\n` +
      `REMITTANCE INSTRUCTIONS:\n` +
      `Bank: Barclays Business UK\n` +
      `Sort Code: 20-00-00\n` +
      `Account: 88492011\n` +
      `Payment Reference: ${contact.accountNumber}\n\n` +
      `Kind regards,\n` +
      `Finance & Accounts Department\n` +
      `Biscuit CRM Operating Unit`
    );

    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(contact.email)}&su=${subject}&body=${body}`, '_blank');
  };

  return (
    <section className="space-y-6 mb-8">
      {/* Top Financial Projection Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Contracted Pipeline</span>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono">
            £{totalBilledValue.toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-500">Across {contacts.length} client accounts</p>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">UK Output VAT (20%)</span>
          <div className="text-2xl font-extrabold text-sky-400 font-mono">
            £{vatTotal.toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-500">HMRC liability ledger</p>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Procurement Invoicing</span>
          <div className="text-2xl font-extrabold text-purple-400 font-mono">
            {contacts.filter(c => c.stage === 'Procurement').length} Deals
          </div>
          <p className="text-[10px] text-slate-500">Awaiting PO signoff</p>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Active Retention Revenue</span>
          <div className="text-2xl font-extrabold text-amber-400 font-mono">
            {contacts.filter(c => c.stage === 'Customer Service').length} Retainers
          </div>
          <p className="text-[10px] text-slate-500">Stable customer revenue</p>
        </div>
      </div>

      {/* Main Invoicing Desk & Billing Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client Ledger & Status */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
                <PoundSterling className="w-4 h-4 text-emerald-400" /> Commercial Accounts & Invoicing Register
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Manage customer billing schedules and dispatch formal payment terms</p>
            </div>
            <span className="text-xs font-mono bg-slate-800 text-emerald-400 px-2.5 py-1 rounded-full border border-slate-700">
              {contacts.length} Accounts
            </span>
          </div>

          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-3">Account No</th>
                <th className="px-5 py-3">Customer & Entity</th>
                <th className="px-5 py-3">CRN</th>
                <th className="px-5 py-3">Pipeline Stage</th>
                <th className="px-5 py-3">Invoice Status</th>
                <th className="px-5 py-3 text-right">Dispatch Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {contacts.map((c) => (
                <tr 
                  key={c.id} 
                  onClick={() => setSelectedContact(c)}
                  className={`hover:bg-slate-800/30 cursor-pointer transition ${
                    selectedContact?.id === c.id ? 'bg-slate-800/40' : ''
                  }`}
                >
                  <td className="px-5 py-3.5 font-mono text-emerald-400 font-semibold text-xs">
                    {c.accountNumber}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-slate-100">{c.name}</div>
                    <div className="text-[11px] text-slate-400">{c.company || 'Private Account'}</div>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-400">
                    {c.crn ? `#${c.crn}` : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="px-2 py-0.5 text-[11px] rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {c.stage}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${
                      c.invoiceStatus === 'Paid'
                        ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                        : c.invoiceStatus === 'Issued'
                        ? 'border-sky-500/30 text-sky-400 bg-sky-500/10'
                        : 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                    }`}>
                      {c.invoiceStatus || 'Drafted'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSendInvoiceEmail(c);
                      }}
                      className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      <Mail className="w-3.5 h-3.5" /> Dispatch
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Invoice Drafter & Remittance Panel */}
        {selectedContact && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="pb-3 border-b border-slate-800">
                <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
                  {selectedContact.accountNumber}
                </span>
                <h4 className="text-base font-bold text-slate-100 mt-2">{selectedContact.name}</h4>
                <p className="text-xs text-slate-400">{selectedContact.company || 'Private Client'}</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Contract / Invoice Amount (Net GBP)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs text-slate-400">£</span>
                    <input
                      type="number"
                      value={invoiceAmount}
                      onChange={(e) => setInvoiceAmount(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Payment Terms</label>
                    <select
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="Net 30 Days">Net 30 Days</option>
                      <option value="Net 14 Days">Net 14 Days</option>
                      <option value="Due on Receipt">Due on Receipt</option>
                      <option value="50% Deposit">50% Deposit</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Due Date</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 font-mono focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Net Amount:</span>
                    <span className="font-mono text-slate-200">£{invoiceAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>UK VAT (20%):</span>
                    <span className="font-mono text-slate-200">£{(invoiceAmount * vatRate).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-100 pt-1.5 border-t border-slate-800">
                    <span>Total Remittance:</span>
                    <span className="font-mono text-emerald-400">£{(invoiceAmount * (1 + vatRate)).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => handleSendInvoiceEmail(selectedContact)}
                className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold transition"
              >
                <Mail className="w-3.5 h-3.5" /> Dispatch Invoice via Gmail
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => handleUpdateInvoiceStatus(selectedContact.id!, 'Issued')}
                  disabled={isUpdating}
                  className="flex-1 py-1.5 text-xs rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium transition"
                >
                  Mark Issued
                </button>
                <button
                  onClick={() => handleUpdateInvoiceStatus(selectedContact.id!, 'Paid')}
                  disabled={isUpdating}
                  className="flex-1 py-1.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition"
                >
                  Mark Paid
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
