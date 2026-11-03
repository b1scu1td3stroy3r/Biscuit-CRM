'use client';

import React, { useState, useEffect } from 'react';
import { 
  PoundSterling, FileSpreadsheet, CheckCircle2, Clock, Send, 
  ExternalLink, Mail, Plus, AlertCircle, RefreshCw, Key, CreditCard, PhoneCall, Copy, Check
} from 'lucide-react';
import { Contact, db } from '../packages/storage/src/db';

interface FinanceDeskProps {
  contacts: Contact[];
  onContactUpdated: () => void;
  currentUser: string;
}

export default function FinanceDesk({ contacts, onContactUpdated, currentUser }: FinanceDeskProps) {
  const [stripeKey, setStripeKey] = useState('');
  const [isKeySaved, setIsKeySaved] = useState(false);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Over-the-phone (MOTO) modal state
  const [phonePaymentContact, setPhonePaymentContact] = useState<Contact | null>(null);
  const [cardForm, setCardForm] = useState({
    cardNumber: '',
    expMonth: '',
    expYear: '',
    cvc: '',
    amount: '',
  });
  const [isCharging, setIsCharging] = useState(false);
  const [chargeError, setChargeError] = useState<string | null>(null);
  const [chargeSuccess, setChargeSuccess] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('biscuit_crm_stripe_secret_key');
    if (saved) {
      setStripeKey(saved);
      setIsKeySaved(true);
    }
  }, []);

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('biscuit_crm_stripe_secret_key', stripeKey.trim());
    setIsKeySaved(true);
    alert('Stripe Secret Key saved locally.');
  };

  const handleUpdateStatus = async (contact: Contact, newStatus: Contact['invoiceStatus']) => {
    if (!contact.id) return;

    if (newStatus === 'Paid') {
      await db.newsFeed.add({
        title: `Invoice Settled: ${contact.company || contact.name} paid in full`,
        content: `Finance logged settlement of £${Number(contact.dealValue || 0).toLocaleString()} for ${contact.name} [Ref: ${contact.accountNumber}].`,
        category: 'Invoice Paid',
        department: 'Finance',
        actor: currentUser,
        badgeColor: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10',
        createdAt: new Date().toISOString(),
      });
    }

    await db.contacts.update(contact.id, {
      invoiceStatus: newStatus,
      updatedAt: new Date().toISOString(),
    });

    onContactUpdated();
  };

  // 1. Generate Stripe Hosted Payment Link (Cards + BACS Direct Debit)
  const handleGeneratePaymentLink = async (contact: Contact) => {
    if (!contact.id) return;
    if (!stripeKey) {
      alert('Please enter and save your Stripe Secret Key at the top of the Finance Desk first.');
      return;
    }

    const amount = Number(contact.dealValue) || 100;
    setGeneratingId(contact.id);

    try {
      const res = await fetch('/api/stripe/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: stripeKey.trim(),
          contact,
          amount,
          description: `Invoice for ${contact.company || contact.name} [${contact.accountNumber}]`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create payment link.');

      await db.contacts.update(contact.id, {
        paymentLinkUrl: data.url,
        invoiceStatus: 'Issued',
        updatedAt: new Date().toISOString(),
      });

      onContactUpdated();
    } catch (err: any) {
      alert(`Stripe Error: ${err.message}`);
    } finally {
      setGeneratingId(null);
    }
  };

  // 2. Open Gmail with Invoice & Payment Link pre-filled
  const handleEmailPaymentLink = (contact: Contact) => {
    const grossValue = Number(contact.dealValue || 0) * 1.2;
    const recipient = encodeURIComponent(contact.email);
    const subject = encodeURIComponent(`Invoice & Payment Request: ${contact.company || contact.name} [${contact.accountNumber}]`);
    const body = encodeURIComponent(
      `Dear ${contact.name},\n\n` +
      `Please find details of your invoice for ${contact.company || 'your account'}.\n\n` +
      `INVOICE SUMMARY:\n` +
      `• Account Reference: ${contact.accountNumber}\n` +
      `• Subtotal: £${Number(contact.dealValue || 0).toLocaleString()}\n` +
      `• VAT (20%): £${(Number(contact.dealValue || 0) * 0.2).toLocaleString()}\n` +
      `• Total Due: £${grossValue.toLocaleString()}\n\n` +
      `PAYMENT OPTIONS:\n` +
      `You can settle this invoice securely online by Credit/Debit Card or UK BACS Direct Debit via the following link:\n` +
      `${contact.paymentLinkUrl || '(Payment link generating...)'}\n\n` +
      `Thank you for your business.\n\n` +
      `Finance Department\n` +
      `${currentUser}`
    );

    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${recipient}&su=${subject}&body=${body}`, '_blank');
  };

  // 3. Process Over-the-Phone MOTO Payment
  const handleExecutePhonePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phonePaymentContact || !phonePaymentContact.id) return;
    setIsCharging(true);
    setChargeError(null);

    try {
      const res = await fetch('/api/stripe/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: stripeKey.trim(),
          contact: phonePaymentContact,
          amount: Number(cardForm.amount),
          cardNumber: cardForm.cardNumber,
          expMonth: cardForm.expMonth,
          expYear: cardForm.expYear,
          cvc: cardForm.cvc,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment declined.');

      await db.contacts.update(phonePaymentContact.id, {
        invoiceStatus: 'Paid',
        paymentMethodUsed: 'card',
        stripePaymentIntentId: data.paymentIntentId,
        updatedAt: new Date().toISOString(),
      });

      await db.newsFeed.add({
        title: `Over-the-Phone Payment: £${Number(cardForm.amount).toLocaleString()} collected`,
        content: `${currentUser} successfully captured phone payment from ${phonePaymentContact.name} (${phonePaymentContact.company || 'Direct'}).`,
        category: 'Invoice Paid',
        department: 'Finance',
        actor: currentUser,
        badgeColor: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10',
        createdAt: new Date().toISOString(),
      });

      setChargeSuccess(true);
      setTimeout(() => {
        setPhonePaymentContact(null);
        setChargeSuccess(false);
        onContactUpdated();
      }, 1500);
    } catch (err: any) {
      setChargeError(err.message || 'Payment failed.');
    } finally {
      setIsCharging(false);
    }
  };

  const totalPipelineValue = contacts.reduce((sum, c) => sum + (Number(c.dealValue) || 0), 0);
  const totalSettled = contacts
    .filter(c => c.invoiceStatus === 'Paid')
    .reduce((sum, c) => sum + (Number(c.dealValue) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Stripe Credentials Bar */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              Stripe Payments & UK BACS Direct Debit Desk
              {isKeySaved && (
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Live Ready
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Enter your Stripe Secret Key to generate Card & BACS payment links and process phone orders.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveKey} className="flex items-center gap-2 w-full md:w-auto">
          <input
            type="password"
            placeholder="sk_live_... or sk_test_..."
            value={stripeKey}
            onChange={(e) => setStripeKey(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono w-60 focus:outline-none focus:border-purple-400"
            required
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition"
          >
            Save Key
          </button>
        </form>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Total Pipeline Bookings</span>
          <div className="text-xl font-bold font-mono text-slate-100">£{totalPipelineValue.toLocaleString()}</div>
          <span className="text-[10px] text-slate-500">+ £{(totalPipelineValue * 0.2).toLocaleString()} Output VAT</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Paid & Settled Revenue</span>
          <div className="text-xl font-bold font-mono text-emerald-400">£{totalSettled.toLocaleString()}</div>
          <span className="text-[10px] text-emerald-500/80">Funds captured via Card, BACS, or Bank</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Pending Invoice Collection</span>
          <div className="text-xl font-bold font-mono text-amber-400">£{(totalPipelineValue - totalSettled).toLocaleString()}</div>
          <span className="text-[10px] text-amber-500/80">Awaiting payment link settlement</span>
        </div>
      </div>

      {/* Invoicing & Payments Ledger */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h4 className="font-semibold text-slate-100 text-sm">Customer Orders & Invoices</h4>
            <p className="text-xs text-slate-400">Send hosted Card/BACS checkout links or take payments over the phone</p>
          </div>
          <span className="text-xs font-mono text-slate-400">{contacts.length} Accounts Monitored</span>
        </div>

        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-900/80 text-xs uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-5 py-3">Account No</th>
              <th className="px-5 py-3">Customer / Company</th>
              <th className="px-5 py-3">Contract Value</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Online Link (Card & BACS)</th>
              <th className="px-5 py-3 text-right">Phone Terminal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {contacts.map((c) => {
              const value = Number(c.dealValue) || 0;
              const gross = value * 1.2;

              return (
                <tr key={c.id} className="hover:bg-slate-800/30 transition">
                  <td className="px-5 py-3.5 font-mono text-emerald-400 font-semibold text-xs">
                    {c.accountNumber}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-slate-100">{c.name}</div>
                    <div className="text-[11px] text-slate-400">{c.company || 'Private'} &bull; {c.email}</div>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs">
                    <div className="font-semibold text-slate-200">£{value.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-500">Gross: £{gross.toLocaleString()}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <select
                      value={c.invoiceStatus || 'Drafted'}
                      onChange={(e) => handleUpdateStatus(c, e.target.value as any)}
                      className={`text-xs font-semibold px-2 py-1 rounded border bg-slate-950 ${
                        c.invoiceStatus === 'Paid'
                          ? 'border-emerald-500/40 text-emerald-400'
                          : c.invoiceStatus === 'Issued'
                          ? 'border-sky-500/40 text-sky-400'
                          : 'border-slate-700 text-slate-400'
                      }`}
                    >
                      <option value="Drafted">Drafted</option>
                      <option value="Issued">Issued</option>
                      <option value="Paid">Paid</option>
                    </select>
                  </td>
                  <td className="px-5 py-3.5">
                    {c.paymentLinkUrl ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleEmailPaymentLink(c)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition"
                          title="Open pre-filled Gmail draft with payment link"
                        >
                          <Mail className="w-3 h-3" /> Email Link
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(c.paymentLinkUrl!);
                            setCopiedId(c.id!);
                            setTimeout(() => setCopiedId(null), 2000);
                          }}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                          title="Copy payment URL"
                        >
                          {copiedId === c.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <a
                          href={c.paymentLinkUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
                          title="Open Checkout"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleGeneratePaymentLink(c)}
                        disabled={generatingId === c.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold transition"
                      >
                        {generatingId === c.id ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <CreditCard className="w-3 h-3" />
                        )}
                        Generate Card/BACS Link
                      </button>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => {
                        setPhonePaymentContact(c);
                        setCardForm({
                          cardNumber: '',
                          expMonth: '',
                          expYear: '',
                          cvc: '',
                          amount: String(gross || 100),
                        });
                        setChargeError(null);
                        setChargeSuccess(false);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition"
                    >
                      <PhoneCall className="w-3.5 h-3.5" /> Take Card on Call
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Over-the-Phone (MOTO) Virtual Terminal Modal */}
      {phonePaymentContact && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-400" /> Virtual Terminal: Phone Payment
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Collecting payment from {phonePaymentContact.name} ({phonePaymentContact.company || 'Direct'})
                </p>
              </div>
              <button
                onClick={() => setPhonePaymentContact(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {chargeError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{chargeError}</span>
              </div>
            )}

            {chargeSuccess ? (
              <div className="p-6 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-100 text-sm">Payment Captured Successfully!</h4>
                <p className="text-xs text-slate-400">Invoice marked as Paid and broadcast to company newsfeed.</p>
              </div>
            ) : (
              <form onSubmit={handleExecutePhonePayment} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Amount to Charge (£ GBP)</label>
                  <input
                    type="number"
                    value={cardForm.amount}
                    onChange={(e) => setCardForm({ ...cardForm, amount: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-emerald-400 font-bold focus:outline-none focus:border-emerald-400"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">16-Digit Card Number</label>
                  <input
                    type="text"
                    placeholder="4242 •••• •••• 4242"
                    value={cardForm.cardNumber}
                    onChange={(e) => setCardForm({ ...cardForm, cardNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:border-emerald-400"
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Exp Month</label>
                    <input
                      type="text"
                      placeholder="MM"
                      maxLength={2}
                      value={cardForm.expMonth}
                      onChange={(e) => setCardForm({ ...cardForm, expMonth: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100 text-center"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Exp Year</label>
                    <input
                      type="text"
                      placeholder="YYYY"
                      maxLength={4}
                      value={cardForm.expYear}
                      onChange={(e) => setCardForm({ ...cardForm, expYear: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100 text-center"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">CVC</label>
                    <input
                      type="password"
                      placeholder="•••"
                      maxLength={4}
                      value={cardForm.cvc}
                      onChange={(e) => setCardForm({ ...cardForm, cvc: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100 text-center"
                      required
                    />
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPhonePaymentContact(null)}
                    className="flex-1 py-2 rounded-lg text-xs text-slate-400 hover:text-white border border-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCharging}
                    className="flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow flex items-center justify-center gap-1.5"
                  >
                    {isCharging ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
                    Confirm & Charge (£{cardForm.amount})
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
