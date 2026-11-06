'use client';

import { parseBankCSV, ParsedTransaction } from '../packages/storage/src/bankParser';
import React, { useState, useEffect, useMemo } from 'react';
import {
  PoundSterling,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Send,
  ExternalLink,
  Mail,
  Plus,
  AlertCircle,
  RefreshCw,
  Key,
  CreditCard,
  PhoneCall,
  Copy,
  Check,
  ShieldAlert,
  ShieldCheck,
  Building2,
  HeartHandshake,
  Search,
  Filter,
  Users,
  Download,
  Printer,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  TrendingUp,
  Truck,
  Ban,
  FileText,
  X,
  Landmark,
} from 'lucide-react';
import { Contact, EmployeeProfile, db, GiftAidClaim, IndustryModulesConfig } from '../packages/storage/src/db';

export type TimeframeFilter = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'last_year';
export type LedgerFilter = 'all' | 'incomings' | 'outgoings';

interface FinanceDeskProps {
  contacts: Contact[];
  onContactUpdated: () => void;
  currentUser: string;
  employees?: EmployeeProfile[];
}

export interface CreditNote {
  id: string;
  creditNoteNumber: string;
  contactId: number;
  customerName: string;
  accountNumber: string;
  amount: number;
  reason: string;
  issuedAt: string;
  issuedBy: string;
}

export interface FinancialTransaction {
  id: string;
  type: 'incoming' | 'outgoing';
  category: 'Customer Settlement' | 'Payroll' | 'Shipping Courier' | 'Supplier Payable' | 'Credit Note Adjustment';
  reference: string;
  counterparty: string;
  grossAmount: number;
  vatAmount: number;
  netAmount: number;
  status: 'Settled' | 'Pending' | 'On Hold';
  paymentMethod: 'Stripe Card' | 'BACS / Direct Debit' | 'Bank Transfer' | 'Direct Payroll' | 'Credit Offset';
  timestamp: string;
}

export default function FinanceDesk({
  contacts,
  onContactUpdated,
  currentUser,
  employees = []
}: FinanceDeskProps) {
  // Navigation & View Filters
    // Zero-Knowledge Bank Feed & Reconciliation State
  const [bankFileLoading, setBankFileLoading] = useState(false);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [reconciledCount, setReconciledCount] = useState(0);

  const handleBankFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBankFileLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseBankCSV(text);
        setParsedTransactions(parsed);
      } catch (err) {
        console.error("Failed to parse bank file:", err);
      } finally {
        setBankFileLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const handleReconcileLine = async (tx: ParsedTransaction, idx: number) => {
    try {
      await db.bankLines.add({
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        status: 'RECONCILED'
      });
      await db.journalEntries.add({
        entryDate: tx.date,
        reference: `RECON-${Date.now().toString().slice(-6)}`,
        memo: tx.description,
        debitAccount: tx.type === 'CREDIT' ? '1200 Bank Current Account' : '5000 Cost of Sales / Expense',
        creditAccount: tx.type === 'CREDIT' ? '4000 Sales Revenue' : '1200 Bank Current Account',
        amount: tx.amount,
        reconciled: true,
        createdAt: new Date().toISOString()
      });
      setReconciledCount(prev => prev + 1);
      setParsedTransactions(prev => prev.filter((_, i) => i !== idx));
    } catch (err) {
      console.error("Reconciliation commit error:", err);
    }
  };

  const [activeTab, setActiveTab] = useState<'dashboard' | 'credit_control' | 'payments' | 'payables' | 'payroll' | 'reconciliation' | 'ledger' | 'tax_hmrc' | 'gift_aid'>('dashboard');
  const [isGiftAidEnabled, setIsGiftAidEnabled] = useState(false);
  const [giftAidClaims, setGiftAidClaims] = useState<GiftAidClaim[]>([]);
  const [isNewGiftAidModalOpen, setIsNewGiftAidModalOpen] = useState(false);
  const [newDonation, setNewDonation] = useState({
    donorName: '',
    donorAddress: '14 Orchard Way, Oxford',
    donorPostcode: 'OX2 6NN',
    donationAmount: 200,
    donationDate: new Date().toISOString().slice(0, 10),
    declarationConfirmed: true
  });
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('month');
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // HMRC & Tax Compliance State
  const [taxQuarter, setTaxQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');
  const [hmrcSettings, setHmrcSettings] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('biscuit_crm_hmrc_settings');
        if (saved) return JSON.parse(saved);
      } catch (err) {
        console.warn('Failed to load HMRC settings', err);
      }
    }
    return {
      vrn: '',
      payeRef: '',
      utr: '',
      accountingScheme: 'Standard Accrual' as 'Standard Accrual' | 'Cash Accounting',
    };
  });

          const userRoleStr = typeof currentUser === 'string' 
    ? currentUser 
    : (currentUser as any)?.role || (currentUser as any)?.name || '';

  const canEditTax = userRoleStr === 'Managing Director' || 
    userRoleStr.toLowerCase().includes('finance') || 
    (typeof currentUser === 'object' && (currentUser as any)?.department === 'Finance');

  const handleSaveHmrcSettings = (updates: Partial<typeof hmrcSettings>) => {
    const next = { ...hmrcSettings, ...updates };
    setHmrcSettings(next);
    localStorage.setItem('biscuit_crm_hmrc_settings', JSON.stringify(next));
  };

  // Stripe Configuration
  const [stripeKey, setStripeKey] = useState('');
  const [isKeySaved, setIsKeySaved] = useState(false);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // MOTO Phone Terminal Modal
  const [phonePaymentContact, setPhonePaymentContact] = useState<Contact | null>(null);
  const [cardForm, setCardForm] = useState({
    cardNumber: '',
    expMonth: '',
    expYear: '',
    cvc: '',
    amount: ''
  });
  const [isCharging, setIsCharging] = useState(false);
  const [chargeError, setChargeError] = useState<string | null>(null);
  const [chargeSuccess, setChargeSuccess] = useState(false);

  // Credit Note Modal State
  const [creditNoteContact, setCreditNoteContact] = useState<Contact | null>(null);
  const [creditNoteAmount, setCreditNoteAmount] = useState('');
  const [creditNoteReason, setCreditNoteReason] = useState('Goodwill / Damaged packaging');

  // Companies House Check State
  const [chQuery, setChQuery] = useState('');
  const [chResults, setChResults] = useState<any[]>([]);
  const [chLoading, setChLoading] = useState(false);
  const [chSelectedContact, setChSelectedContact] = useState<Contact | null>(null);

  // Payroll Disbursement Modal State
  const [payrollModalEmployee, setPayrollModalEmployee] = useState<EmployeeProfile | null>(null);
  const [payrollAmount, setPayrollAmount] = useState('');
  const [payrollType, setPayrollType] = useState<'Monthly Salary' | 'Commission Bonus' | 'Expense Reimbursement'>('Monthly Salary');

  // Manual Outgoing Expense Modal State
  const [isOutgoingModalOpen, setIsOutgoingModalOpen] = useState(false);
  const [outgoingForm, setOutgoingForm] = useState({
    payee: '',
    category: 'Supplier Payable' as 'Supplier Payable' | 'Shipping Courier',
    amount: '',
    reference: '',
    method: 'Bank Transfer' as 'Bank Transfer' | 'BACS / Direct Debit'
  });

  // Supplier Invoices & Payables State
  const [payingTransaction, setPayingTransaction] = useState<FinancialTransaction | null>(null);
  const [payMethod, setPayMethod] = useState<'Bank Transfer' | 'Corporate Card'>('Bank Transfer');
  const [cardDetails, setCardDetails] = useState({
    cardLast4: '4192',
    cardHolder: '',
    authCode: ''
  });
  const [bankDetails, setBankDetails] = useState({
    sortCode: '20-45-77',
    accountNumber: '88392019',
    remittanceRef: ''
  });
  const [isNewInvoiceModalOpen, setIsNewInvoiceModalOpen] = useState(false);
  const [newInvoiceForm, setNewInvoiceForm] = useState({
    vendorName: '',
    invoiceNumber: '',
    poReference: '',
    netAmount: '',
    paymentTerms: 'Net 30'
  });

  // Local Storage Ledger & Credit Notes
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('biscuit_crm_financial_transactions');
        if (saved) return JSON.parse(saved);
      } catch (err) {
        console.warn('Failed to load transactions', err);
      }
    }
    return [];
  });

  const [creditNotes, setCreditNotes] = useState<CreditNote[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('biscuit_crm_credit_notes');
        if (saved) return JSON.parse(saved);
      } catch (err) {
        console.warn('Failed to load credit notes', err);
      }
    }
    return [];
  });

  // Sync state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('biscuit_crm_financial_transactions', JSON.stringify(transactions));
    } catch (err) {
      console.warn('Failed to persist transactions', err);
    }
  }, [transactions]);

  useEffect(() => {
    try {
      localStorage.setItem('biscuit_crm_credit_notes', JSON.stringify(creditNotes));
    } catch (err) {
      console.warn('Failed to persist credit notes', err);
    }
  }, [creditNotes]);

  // Load Stripe Key & Courier Shipping Costs
  useEffect(() => {
    const savedKey = localStorage.getItem('biscuit_crm_stripe_secret_key');
    if (savedKey) {
      setStripeKey(savedKey);
      setIsKeySaved(true);
    }

    // Pull shipping costs from Operations Desk if not yet synchronized
    try {
      const shippingDeductions = JSON.parse(localStorage.getItem('biscuit_crm_daily_shipping_costs') || '[]');
      if (shippingDeductions.length > 0) {
        setTransactions(prev => {
          const existingRefs = new Set(prev.map(t => t.reference));
          const newEntries: FinancialTransaction[] = [];
          for (const item of shippingDeductions) {
            const ref = `SHIP-${item.orderNumber}`;
            if (!existingRefs.has(ref)) {
              newEntries.push({
                id: `TX-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                type: 'outgoing',
                category: 'Shipping Courier',
                reference: ref,
                counterparty: `${item.carrier} (${item.customer || 'Dispatch'})`,
                grossAmount: Number(item.amount) || 0,
                vatAmount: (Number(item.amount) || 0) * 0.2,
                netAmount: (Number(item.amount) || 0) * 0.8,
                status: 'Settled',
                paymentMethod: 'Bank Transfer',
                timestamp: item.timestamp || new Date().toISOString()
              });
            }
          }
          return newEntries.length > 0 ? [...prev, ...newEntries] : prev;
        });
      }
    } catch (err) {
      console.warn('Failed to sync shipping deductions', err);
    }
  }, []);

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('biscuit_crm_stripe_secret_key', stripeKey.trim());
    setIsKeySaved(true);
    alert('Stripe Secret Key saved locally.');
  };

  // Helper to record a transaction in ledger
  const recordTransaction = (tx: Omit<FinancialTransaction, 'id'>) => {
    const newTx: FinancialTransaction = {
      ...tx,
      id: `TX-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
    };
    setTransactions(prev => [newTx, ...prev]);
  };

  // Timeframe calculation filter
  const isWithinTimeframe = (timestampStr: string, tf: TimeframeFilter) => {
    const date = new Date(timestampStr);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (tf === 'day') {
      return date >= startOfToday;
    }
    if (tf === 'week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return date >= oneWeekAgo;
    }
    if (tf === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return date >= startOfMonth;
    }
    if (tf === 'quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const startOfQuarter = new Date(now.getFullYear(), currentQuarter * 3, 1);
      return date >= startOfQuarter;
    }
    if (tf === 'year') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return date >= startOfYear;
    }
    if (tf === 'last_year') {
      const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
      const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
      return date >= startOfLastYear && date <= endOfLastYear;
    }
    return true;
  };

  // Aggregate Metrics based on timeframe
  const metrics = useMemo(() => {
    // 1. Incomings: Contacts Paid or manual ledger entries
    const paidContacts = contacts.filter(c => {
      if (c.invoiceStatus !== 'Paid') return false;
      const refDate = c.updatedAt || c.invoiceDate || new Date().toISOString();
      return isWithinTimeframe(refDate, timeframe);
    });

    const contactIntake = paidContacts.reduce((sum, c) => sum + (Number(c.dealValue) || 0), 0);

    // 2. Extra Incomings from ledger
    const ledgerIncomings = transactions
      .filter(t => t.type === 'incoming' && t.status === 'Settled' && isWithinTimeframe(t.timestamp, timeframe))
      .reduce((sum, t) => sum + t.grossAmount, 0);

    const totalIntake = contactIntake + ledgerIncomings;

    // 3. Outgoings: Ledger outgoings in timeframe (Payroll, Courier, Suppliers)
    const ledgerOutgoings = transactions
      .filter(t => t.type === 'outgoing' && t.status === 'Settled' && isWithinTimeframe(t.timestamp, timeframe))
      .reduce((sum, t) => sum + t.grossAmount, 0);

    // 4. Shipping deductions logged directly
    let shippingCosts = 0;
    try {
      const shippingDeductions = JSON.parse(localStorage.getItem('biscuit_crm_daily_shipping_costs') || '[]');
      shippingCosts = shippingDeductions
        .filter((s: any) => isWithinTimeframe(s.timestamp, timeframe))
        .reduce((sum: number, s: any) => sum + (Number(s.amount) || 0), 0);
    } catch {
      shippingCosts = 0;
    }

    const totalOutgoings = ledgerOutgoings;
    const netRevenue = Math.max(0, totalIntake - shippingCosts);
    const operatingProfit = totalIntake - totalOutgoings;

    return {
      intake: totalIntake,
      outgoings: totalOutgoings,
      netRevenue,
      operatingProfit,
      shippingCosts
    };
  }, [contacts, transactions, timeframe]);

  // Credit Control: Update Terms, Limits, and Holds
  const handleUpdateCreditStatus = async (
    contact: Contact,
    updates: {
      creditLimit?: number;
      creditTerms?: 'Upfront / Pro-Forma Only' | 'Net 14' | 'Net 30' | 'Net 60';
      creditHold?: boolean;
      upfrontOnly?: boolean;
    }
  ) => {
    if (!contact.id) return;
    await db.contacts.update(contact.id, {
      ...updates,
      updatedAt: new Date().toISOString()
    });

    await db.auditLogs.add({
      timestamp: new Date().toISOString(),
      actor: currentUser,
      action: 'CREDIT_TERMS_ADJUSTED',
      entityId: contact.accountNumber,
      details: `Credit settings amended: ${JSON.stringify(updates)}`
    });

    onContactUpdated();
  };

  // Run Companies House Insolvency / Status Check
  const handleSearchCompaniesHouse = async (query: string) => {
    if (!query.trim()) return;
    setChLoading(true);
    setChResults([]);

    try {
      const res = await fetch(`/api/companies-house?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      setChResults(data.items || []);
    } catch (err) {
      alert('Failed to query Companies House API.');
    } finally {
      setChLoading(false);
    }
  };

  const handleVerifyWithCompaniesHouse = async (contact: Contact, company: any) => {
    if (!contact.id) return;
    const isInsolvent =
      company.company_status?.toLowerCase().includes('dissolved') ||
      company.company_status?.toLowerCase().includes('liquidation') ||
      company.company_status?.toLowerCase().includes('insolvent');

    await db.contacts.update(contact.id, {
      crn: company.company_number,
      companyHouseStatus: company.company_status,
      companyVerifiedAt: new Date().toISOString(),
      creditHold: isInsolvent ? true : contact.creditHold,
      upfrontOnly: isInsolvent ? true : contact.upfrontOnly,
      updatedAt: new Date().toISOString()
    });

    await db.newsFeed.add({
      title: `Companies House Check: ${company.title}`,
      content: `Verification confirmed CRN ${company.company_number} (${company.company_status}). ${
        isInsolvent ? '⚠️ WARNING: Company flagged for insolvency/liquidation. Account placed on credit hold.' : 'Corporate profile clean.'
      }`,
      category: 'Credit Control',
      department: 'Finance',
      actor: currentUser,
      badgeColor: isInsolvent ? 'border-rose-500/40 text-rose-400 bg-rose-500/10' : 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10',
      createdAt: new Date().toISOString()
    });

    setChSelectedContact(null);
    setChResults([]);
    onContactUpdated();
    alert(`✅ Companies House verification recorded for ${contact.company || contact.name}.`);
  };

  // Raise Credit Note
  const handleRaiseCreditNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditNoteContact || !creditNoteContact.id) return;
    const amt = parseFloat(creditNoteAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid credit note amount.');
      return;
    }

    const crnNumber = `CRN-${Math.floor(1000 + Math.random() * 9000)}`;
    const newCreditNote: CreditNote = {
      id: `CRN-${Date.now()}`,
      creditNoteNumber: crnNumber,
      contactId: creditNoteContact.id,
      customerName: creditNoteContact.company || creditNoteContact.name,
      accountNumber: creditNoteContact.accountNumber,
      amount: amt,
      reason: creditNoteReason,
      issuedAt: new Date().toISOString(),
      issuedBy: currentUser
    };

    setCreditNotes(prev => [newCreditNote, ...prev]);

    // Deduct amount from dealValue or record as credit adjustment
    const updatedValue = Math.max(0, (Number(creditNoteContact.dealValue) || 0) - amt);
    await db.contacts.update(creditNoteContact.id, {
      dealValue: updatedValue,
      updatedAt: new Date().toISOString()
    });

    // Record in ledger
    recordTransaction({
      type: 'outgoing',
      category: 'Credit Note Adjustment',
      reference: crnNumber,
      counterparty: creditNoteContact.company || creditNoteContact.name,
      grossAmount: amt,
      vatAmount: amt * 0.2,
      netAmount: amt * 0.8,
      status: 'Settled',
      paymentMethod: 'Credit Offset',
      timestamp: new Date().toISOString()
    });

    await db.newsFeed.add({
      title: `Credit Note Issued: ${crnNumber} (£${amt.toFixed(2)})`,
      content: `Finance issued credit note to ${creditNoteContact.company || creditNoteContact.name} [Ref: ${creditNoteContact.accountNumber}]. Reason: ${creditNoteReason}.`,
      category: 'Credit Note',
      department: 'Finance',
      actor: currentUser,
      badgeColor: 'border-amber-500/30 text-amber-300 bg-amber-500/10',
      createdAt: new Date().toISOString()
    });

    setCreditNoteContact(null);
    setCreditNoteAmount('');
    onContactUpdated();
    alert(`✅ Credit note ${crnNumber} issued successfully for £${amt.toFixed(2)}.`);
  };

  // Disburse Payroll Run
  const handleDisbursePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payrollModalEmployee) return;
    const amt = parseFloat(payrollAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid disbursement amount.');
      return;
    }

    const payRef = `PAY-${payrollModalEmployee.name.split(' ')[0].toUpperCase()}-${new Date().getMonth() + 1}`;
    recordTransaction({
      type: 'outgoing',
      category: 'Payroll',
      reference: payRef,
      counterparty: `${payrollModalEmployee.name} (${payrollModalEmployee.department} - ${payrollModalEmployee.role})`,
      grossAmount: amt,
      vatAmount: 0,
      netAmount: amt,
      status: 'Settled',
      paymentMethod: 'Direct Payroll',
      timestamp: new Date().toISOString()
    });

    await db.newsFeed.add({
      title: `Payroll Disbursed: ${payrollModalEmployee.name}`,
      content: `Disbursed £${amt.toLocaleString()} (${payrollType}) to ${payrollModalEmployee.name} [${payrollModalEmployee.department}].`,
      category: 'Payroll',
      department: 'Finance',
      actor: currentUser,
      badgeColor: 'border-indigo-500/30 text-indigo-300 bg-indigo-500/10',
      createdAt: new Date().toISOString()
    });

    setPayrollModalEmployee(null);
    setPayrollAmount('');
    alert(`✅ Payroll payment of £${amt.toFixed(2)} completed for ${payrollModalEmployee.name}.`);
  };

  // Record Manual Outgoing (Supplier bill / expense)
  const handleRecordOutgoing = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(outgoingForm.amount);
    if (isNaN(amt) || amt <= 0 || !outgoingForm.payee.trim()) {
      alert('Please provide a payee and valid amount.');
      return;
    }

    recordTransaction({
      type: 'outgoing',
      category: outgoingForm.category,
      reference: outgoingForm.reference || `OUT-${Math.floor(1000 + Math.random() * 9000)}`,
      counterparty: outgoingForm.payee,
      grossAmount: amt,
      vatAmount: amt * 0.2,
      netAmount: amt * 0.8,
      status: 'Settled',
      paymentMethod: outgoingForm.method,
      timestamp: new Date().toISOString()
    });

    setIsOutgoingModalOpen(false);
    setOutgoingForm({
      payee: '',
      category: 'Supplier Payable',
      amount: '',
      reference: '',
      method: 'Bank Transfer'
    });
    alert('✅ Outgoing expense recorded in ledger.');
  };

  // Mark invoice settled via direct BACS or Bank Transfer
  // Settle a Pending Supplier Payable / Invoice
  const handleSettleSupplierInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingTransaction) return;

    const methodUsed = payMethod === 'Corporate Card' ? 'Corporate Card' : 'Bank Transfer';
    const refCode = payMethod === 'Corporate Card' 
      ? `CARD-${cardDetails.authCode || Math.floor(1000 + Math.random() * 9000)}` 
      : (bankDetails.remittanceRef || `BACS-${payingTransaction.reference}`);

    // Update transaction to Settled
    setTransactions(prev => prev.map(t => {
      if (t.id === payingTransaction.id) {
        return {
          ...t,
          status: 'Settled',
          paymentMethod: methodUsed as any,
          reference: `${t.reference} (${refCode})`,
          timestamp: new Date().toISOString()
        };
      }
      return t;
    }));

    // Post to Newsfeed
    try {
      await db.newsFeed.add({
        title: `INVOICE PAID: ${payingTransaction.counterparty}`,
        content: `Finance disbursed £${payingTransaction.grossAmount.toFixed(2)} via ${methodUsed} [Ref: ${refCode}] for supplier bill ${payingTransaction.reference}.`,
        category: 'Invoice Settlement',
        department: 'Finance',
        actor: currentUser,
        badgeColor: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10',
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn(err);
    }

    setPayingTransaction(null);
    alert(`✅ Invoice settled: £${payingTransaction.grossAmount.toFixed(2)} paid to ${payingTransaction.counterparty} via ${methodUsed}.`);
  };

  // Add Manual Received Supplier Invoice
  const handleAddReceivedInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const net = parseFloat(newInvoiceForm.netAmount);
    if (isNaN(net) || net <= 0 || !newInvoiceForm.vendorName) {
      alert('Please provide a valid vendor and amount.');
      return;
    }

    const vat = net * 0.20;
    const gross = net + vat;
    const invRef = newInvoiceForm.invoiceNumber || `INV-${Math.floor(1000 + Math.random() * 9000)}`;

    recordTransaction({
      type: 'outgoing',
      category: 'Supplier Payable',
      reference: `${invRef} [PO: ${newInvoiceForm.poReference || 'Direct'}]`,
      counterparty: newInvoiceForm.vendorName,
      grossAmount: gross,
      vatAmount: vat,
      netAmount: net,
      status: 'Pending',
      paymentMethod: 'Bank Transfer',
      timestamp: new Date().toISOString()
    });

    setIsNewInvoiceModalOpen(false);
    setNewInvoiceForm({
      vendorName: '',
      invoiceNumber: '',
      poReference: '',
      netAmount: '',
      paymentTerms: 'Net 30'
    });
    alert('✅ Supplier invoice received and queued for payment.');
  };

  const handleMarkDirectSettled = async (contact: Contact) => {
    if (!contact.id) return;
    const amt = Number(contact.dealValue) || 0;

    await db.contacts.update(contact.id, {
      invoiceStatus: 'Paid',
      paymentMethod: 'BACS / Bank Transfer',
      updatedAt: new Date().toISOString()
    });

    recordTransaction({
      type: 'incoming',
      category: 'Customer Settlement',
      reference: contact.invoiceNumber || `INV-${contact.accountNumber}`,
      counterparty: contact.company || contact.name,
      grossAmount: amt,
      vatAmount: amt * 0.2,
      netAmount: amt * 0.8,
      status: 'Settled',
      paymentMethod: 'BACS / Direct Debit',
      timestamp: new Date().toISOString()
    });

    await db.newsFeed.add({
      title: `Invoice Settled: ${contact.company || contact.name}`,
      content: `Finance marked £${amt.toLocaleString()} paid in full via BACS Direct Debit for ${contact.name}.`,
      category: 'Invoice Paid',
      department: 'Finance',
      actor: currentUser,
      badgeColor: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10',
      createdAt: new Date().toISOString()
    });

    onContactUpdated();
  };

  // Export HMRC MTD 9-Box VAT Return
  const handleExportMtdReturn = (boxValues: any) => {
    const csvRows = [
      ['HMRC MAKING TAX DIGITAL (MTD) - 9-BOX VAT RETURN'],
      ['VAT Registration Number (VRN)', hmrcSettings.vrn],
      ['Accounting Scheme', hmrcSettings.accountingScheme],
      ['Tax Quarter', `${taxQuarter} (${timeframe.toUpperCase()})`],
      ['Generated By', currentUser],
      ['Timestamp', new Date().toISOString()],
      ['', ''],
      ['Box', 'Description', 'Amount (£)'],
      ['Box 1', 'VAT due on sales and other outputs', boxValues.box1.toFixed(2)],
      ['Box 2', 'VAT due on acquisitions from other EC member states', boxValues.box2.toFixed(2)],
      ['Box 3', 'Total VAT due (Box 1 + Box 2)', boxValues.box3.toFixed(2)],
      ['Box 4', 'VAT reclaimed on purchases and all other inputs', boxValues.box4.toFixed(2)],
      ['Box 5', 'Net VAT to be paid to HMRC or reclaimed (Box 3 - Box 4)', boxValues.box5.toFixed(2)],
      ['Box 6', 'Total value of sales excluding VAT', boxValues.box6.toFixed(2)],
      ['Box 7', 'Total value of purchases excluding VAT', boxValues.box7.toFixed(2)],
      ['Box 8', 'Total value of supplies to other EC member states', boxValues.box8.toFixed(2)],
      ['Box 9', 'Total value of acquisitions from other EC member states', boxValues.box9.toFixed(2)]
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map(r => r.join(',')).join('\n');
    const encoded = encodeURI(csvContent);
    const a = document.createElement('a');
    a.href = encoded;
    a.download = `HMRC_MTD_VAT_Return_${taxQuarter}_${new Date().toISOString().substring(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Generate Audit & Financial Report Export
  const handleGenerateAuditReport = () => {
    const reportData = [
      ['Report Type', `Financial Audit & Cash Flow Report (${timeframe.toUpperCase()})`],
      ['Generated By', currentUser],
      ['Timestamp', new Date().toISOString()],
      ['', ''],
      ['SUMMARY METRICS', ''],
      ['Gross Intake (Receivables)', `£${metrics.intake.toFixed(2)}`],
      ['Total Outgoings (Overheads & Payroll)', `£${metrics.outgoings.toFixed(2)}`],
      ['Carrier Shipping Deductions', `£${metrics.shippingCosts.toFixed(2)}`],
      ['Net Settled Revenue', `£${metrics.netRevenue.toFixed(2)}`],
      ['Net Operating Profit', `£${metrics.operatingProfit.toFixed(2)}`],
      ['', ''],
      ['TRANSACTION LEDGER BREAKDOWN', ''],
      ['Date', 'Type', 'Category', 'Reference', 'Counterparty', 'Gross (£)', '20% VAT (£)', 'Net (£)', 'Payment Method', 'Status']
    ];

    const filteredTx = transactions.filter(t => isWithinTimeframe(t.timestamp, timeframe));
    filteredTx.forEach(t => {
      reportData.push([
        t.timestamp.substring(0, 10),
        t.type.toUpperCase(),
        t.category,
        t.reference,
        `"${t.counterparty.replace(/"/g, '""')}"`,
        t.grossAmount.toFixed(2),
        t.vatAmount.toFixed(2),
        t.netAmount.toFixed(2),
        t.paymentMethod,
        t.status
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + reportData.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BiscuitCRM_Financial_Audit_${timeframe}_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered contacts and ledger transactions
  const filteredContacts = contacts.filter(c => {
    const term = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      (c.company && c.company.toLowerCase().includes(term)) ||
      c.accountNumber.toLowerCase().includes(term)
    );
  });

  const displayTransactions = transactions.filter(t => {
    if (!isWithinTimeframe(t.timestamp, timeframe)) return false;
    if (ledgerFilter === 'incomings') return t.type === 'incoming';
    if (ledgerFilter === 'outgoings') return t.type === 'outgoing';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Stripe Key Bar */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <PoundSterling className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              Financial Operations, Credit Control & Treasury Desk
              {isKeySaved && (
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Stripe Live
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Multi-timeframe cash audits, Companies House insolvency vetting, payroll disburser & credit terms governance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <form onSubmit={handleSaveKey} className="flex items-center gap-2">
            <input
              type="password"
              placeholder="Stripe Secret Key (sk_live_...)"
              value={stripeKey}
              onChange={(e) => setStripeKey(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono w-56 focus:outline-none focus:border-purple-400"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition"
            >
              Save Key
            </button>
          </form>

          <button
            onClick={handleGenerateAuditReport}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold inline-flex items-center gap-1.5 shadow transition"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" /> Export Audit Report
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs & Timeframe Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-3">
        {/* Desk View Switcher */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'dashboard', label: 'Financial Dashboard', icon: TrendingUp },
            { id: 'credit_control', label: 'Credit Control & Terms', icon: ShieldCheck },
            { id: 'payments', label: 'Receive Incomings', icon: ArrowDownLeft },
            { id: 'payables', label: 'Received Invoices & Payables', icon: ArrowUpRight },
            { id: 'payroll', label: 'Staff Payroll & Outgoings', icon: Users },
            { id: 'ledger', label: 'Granular Audit Ledger', icon: FileSpreadsheet },
            { id: 'tax_hmrc', label: 'Tax & HMRC (MTD)', icon: Building2 },
            ...(isGiftAidEnabled ? [{ id: 'gift_aid', label: 'Gift Aid (HMRC 25%)', icon: HeartHandshake }] : [])
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                  active
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Multi-Timeframe Filter Pill */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <Calendar className="w-3.5 h-3.5 text-slate-500 ml-2" />
          {[
            { id: 'day', label: 'Day (Today)' },
            { id: 'week', label: 'Week' },
            { id: 'month', label: 'Month' },
            { id: 'quarter', label: 'Quarter' },
            { id: 'year', label: 'Year' },
            { id: 'last_year', label: 'Last Year' }
          ].map(tf => (
            <button
              key={tf.id}
              onClick={() => setTimeframe(tf.id as TimeframeFilter)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                timeframe === tf.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards: Dynamic across Day / Week / Month / Quarter / Year / Last Year */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Gross Intake */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Gross Incomings (Intake)</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            £{metrics.intake.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500">Sales settlements captured in {timeframe.replace('_', ' ')}</p>
        </div>

        {/* Total Outgoings */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Outgoings & Payroll</span>
            <ArrowUpRight className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400 font-mono">
            £{metrics.outgoings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>Disbursements + suppliers</span>
            {metrics.shippingCosts > 0 && (
              <span className="text-amber-400 text-[10px] font-mono">
                Inc. £{metrics.shippingCosts.toFixed(2)} courier
              </span>
            )}
          </p>
        </div>

        {/* Net Revenue */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Net Settled Revenue</span>
            <DollarSign className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-sky-400 font-mono">
            £{metrics.netRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500">Gross intake minus carrier logistics fees</p>
        </div>

        {/* Net Operating Profit */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Net Operating Margin</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className={`text-2xl font-black font-mono ${metrics.operatingProfit >= 0 ? 'text-purple-300' : 'text-rose-400'}`}>
            £{metrics.operatingProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500">Intake minus total outgoings</p>
        </div>
      </div>

      {/* VIEW 1: DASHBOARD OVERVIEW */}
      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions & Compliance */}
          <div className="lg:col-span-1 space-y-4">
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" /> Credit Exposure & Holds Summary
              </h4>
              <div className="space-y-2.5 text-xs text-slate-300">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span>Accounts on Credit Hold</span>
                  <span className="font-bold text-rose-400 font-mono">
                    {contacts.filter(c => c.creditHold).length} Accounts
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span>Upfront Payment Only</span>
                  <span className="font-bold text-amber-400 font-mono">
                    {contacts.filter(c => c.upfrontOnly).length} Accounts
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span>Credit Notes Raised</span>
                  <span className="font-bold text-indigo-400 font-mono">
                    {creditNotes.length} Issued (£{creditNotes.reduce((s, c) => s + c.amount, 0).toFixed(2)})
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setIsOutgoingModalOpen(true)}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition"
                >
                  <Plus className="w-4 h-4" /> Record Outgoing / Supplier Payable
                </button>
              </div>
            </div>
          </div>

          {/* Recent Financial Stream */}
          <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" /> Recent Treasury Movements ({timeframe})
              </h4>
              <button
                onClick={() => setActiveTab('ledger')}
                className="text-xs font-semibold text-purple-400 hover:text-purple-300"
              >
                View Full Ledger &rarr;
              </button>
            </div>

            <div className="divide-y divide-slate-800">
              {displayTransactions.slice(0, 5).map(tx => (
                <div key={tx.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className={`p-2 rounded-lg border ${
                      tx.type === 'incoming'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}>
                      {tx.type === 'incoming' ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                    </span>
                    <div>
                      <div className="font-bold text-white">{tx.counterparty}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{tx.reference} &bull; {tx.category}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold font-mono ${tx.type === 'incoming' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {tx.type === 'incoming' ? '+' : '-'}£{tx.grossAmount.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-500">{tx.timestamp.substring(0, 10)}</div>
                  </div>
                </div>
              ))}
              {displayTransactions.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-500">
                  No treasury movements logged in this timeframe ({timeframe}).
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: CREDIT CONTROL & COMPANIES HOUSE STATUS */}
      {activeTab === 'credit_control' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search company, account ref, or contact..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-400"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Account Ref</th>
                  <th className="py-3 px-4">Company & CRN</th>
                  <th className="py-3 px-4">Companies House Status</th>
                  <th className="py-3 px-4">Credit Terms</th>
                  <th className="py-3 px-4">Credit Limit / Balance</th>
                  <th className="py-3 px-4">Account Hold</th>
                  <th className="py-3 px-4 text-right">Credit Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                {filteredContacts.map(contact => {
                  const dealVal = Number(contact.dealValue) || 0;
                  const limit = Number(contact.creditLimit) || 0;
                  const isOverLimit = limit > 0 && dealVal > limit;

                  return (
                    <tr key={contact.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-bold text-purple-300 align-middle">
                        {contact.accountNumber}
                      </td>
                      <td className="py-3 px-4 align-middle">
                        <div className="font-bold text-white">{contact.company || contact.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          CRN: {contact.crn || 'Unregistered / Sole Trader'}
                        </div>
                      </td>
                      <td className="py-3 px-4 align-middle">
                        {contact.companyHouseStatus ? (
                          <div className="space-y-0.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              contact.companyHouseStatus.toLowerCase().includes('active')
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            }`}>
                              {contact.companyHouseStatus.toUpperCase()}
                            </span>
                            <div className="text-[9px] text-slate-500">
                              Checked {contact.companyVerifiedAt ? contact.companyVerifiedAt.substring(0, 10) : 'Recently'}
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setChSelectedContact(contact);
                              setChQuery(contact.company || contact.name);
                              handleSearchCompaniesHouse(contact.company || contact.name);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20 font-bold text-[10px] inline-flex items-center gap-1 transition"
                          >
                            <Building2 className="w-3 h-3" /> Check CH & Insolvency
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-4 align-middle">
                        <select
                          value={contact.creditTerms || 'Net 30'}
                          onChange={(e) => handleUpdateCreditStatus(contact, { creditTerms: e.target.value as any })}
                          className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-purple-400"
                        >
                          <option value="Upfront / Pro-Forma Only">Upfront / Pro-Forma</option>
                          <option value="Net 14">Net 14 Days</option>
                          <option value="Net 30">Net 30 Days</option>
                          <option value="Net 60">Net 60 Days</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 align-middle">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400">Limit:</span>
                          <input
                            type="number"
                            defaultValue={contact.creditLimit || 5000}
                            onBlur={(e) => handleUpdateCreditStatus(contact, { creditLimit: parseFloat(e.target.value) || 0 })}
                            className="w-20 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-slate-200 font-mono"
                          />
                        </div>
                        <div className={`text-[10px] font-mono mt-0.5 ${isOverLimit ? 'text-rose-400 font-bold' : 'text-slate-500'}`}>
                          Bal: £{dealVal.toLocaleString()} {isOverLimit && '(Exceeds Limit!)'}
                        </div>
                      </td>
                      <td className="py-3 px-4 align-middle">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleUpdateCreditStatus(contact, { creditHold: !contact.creditHold })}
                            className={`px-2 py-1 rounded text-[10px] font-bold border transition ${
                              contact.creditHold
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                            }`}
                          >
                            {contact.creditHold ? 'ON HOLD (Blocked)' : 'Good Standing'}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 align-middle">
                        <button
                          onClick={() => setCreditNoteContact(contact)}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-[11px] inline-flex items-center gap-1 transition"
                          title="Raise Credit Note"
                        >
                          <FileText className="w-3 h-3" /> Issue Credit Note
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: RECEIVE PAYMENTS (INCOMINGS) */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Invoice / Account</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Deal Value (£)</th>
                  <th className="py-3 px-4">20% Output VAT</th>
                  <th className="py-3 px-4">Gross Due</th>
                  <th className="py-3 px-4">Invoice Status</th>
                  <th className="py-3 px-4 text-right">Payment Capture</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                {filteredContacts.map(contact => {
                  const dealVal = Number(contact.dealValue) || 0;
                  const vat = dealVal * 0.2;
                  const gross = dealVal + vat;

                  return (
                    <tr key={contact.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-bold text-purple-300">
                        {contact.invoiceNumber || `INV-${contact.accountNumber}`}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{contact.company || contact.name}</div>
                        <div className="text-[10px] text-slate-400">{contact.email}</div>
                      </td>
                      <td className="py-3 px-4 font-mono">£{dealVal.toLocaleString()}</td>
                      <td className="py-3 px-4 font-mono text-slate-400">£{vat.toLocaleString()}</td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">£{gross.toLocaleString()}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          contact.invoiceStatus === 'Paid'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : contact.invoiceStatus === 'Issued'
                            ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}>
                          {contact.invoiceStatus || 'Draft'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {contact.invoiceStatus !== 'Paid' ? (
                          <>
                            <button
                              onClick={() => handleMarkDirectSettled(contact)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] inline-flex items-center gap-1 transition"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Direct BACS Paid
                            </button>
                            <button
                              onClick={() => {
                                setPhonePaymentContact(contact);
                                setCardForm(prev => ({ ...prev, amount: gross.toString() }));
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] inline-flex items-center gap-1 transition"
                            >
                              <PhoneCall className="w-3.5 h-3.5" /> Virtual MOTO Card
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-emerald-400 font-semibold inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Settled in Full
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

            {/* VIEW: RECEIVED SUPPLIER INVOICES & PAYABLES */}
      {activeTab === 'payables' && (() => {
        const supplierPayables = transactions.filter(t => t.category === 'Supplier Payable' || t.category === 'Shipping Courier');
        const pendingPayables = supplierPayables.filter(t => t.status === 'Pending');
        const settledPayables = supplierPayables.filter(t => t.status === 'Settled');

        return (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-rose-400" /> Received Supplier Invoices & Payables Desk
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manage received vendor invoices, execute BACS or Corporate Card disbursements, and reconcile PO commitments.
                </p>
              </div>
              <button
                onClick={() => setIsNewInvoiceModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow transition"
              >
                <Plus className="w-4 h-4" /> Log Received Supplier Invoice
              </button>
            </div>

            {/* Quick Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-xs">Pending Supplier Bills</span>
                <div className="text-2xl font-black text-amber-400 font-mono">
                  {pendingPayables.length} Invoices
                </div>
                <p className="text-[11px] text-slate-500">
                  Total Outstanding: £{pendingPayables.reduce((s, p) => s + p.grossAmount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-xs">Settled Supplier Invoices</span>
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  {settledPayables.length} Paid
                </div>
                <p className="text-[11px] text-slate-500">
                  Disbursed: £{settledPayables.reduce((s, p) => s + p.grossAmount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-xs">Reclaimable Input VAT</span>
                <div className="text-2xl font-black text-indigo-400 font-mono">
                  £{supplierPayables.reduce((s, p) => s + p.vatAmount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <p className="text-[11px] text-slate-500">Credited against HMRC VAT return</p>
              </div>
            </div>

            {/* Invoices Awaiting Payment Table */}
            <div className="space-y-3">
              <h5 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Invoices Awaiting Payment Clearance ({pendingPayables.length})
              </h5>

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Invoice / PO Ref</th>
                      <th className="py-3 px-4">Supplier / Payee</th>
                      <th className="py-3 px-4 text-right">Net (£)</th>
                      <th className="py-3 px-4 text-right">20% VAT (£)</th>
                      <th className="py-3 px-4 text-right">Gross Due (£)</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4">Received Date</th>
                      <th className="py-3 px-4 text-right">Payment Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/60 font-mono">
                    {pendingPayables.map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-bold text-purple-300">{tx.reference}</td>
                        <td className="py-3 px-4 font-sans font-bold text-white">{tx.counterparty}</td>
                        <td className="py-3 px-4 text-right text-slate-200">£{tx.netAmount.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-slate-400">£{tx.vatAmount.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-black text-rose-400">£{tx.grossAmount.toFixed(2)}</td>
                        <td className="py-3 px-4 text-center font-sans">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-amber-500/20 text-amber-300 border-amber-500/30">
                            Awaiting Payment
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-sans">{tx.timestamp.substring(0, 10)}</td>
                        <td className="py-3 px-4 text-right space-x-2 font-sans">
                          <button
                            onClick={() => {
                              setPayingTransaction(tx);
                              setPayMethod('Bank Transfer');
                              setBankDetails({
                                sortCode: '20-45-77',
                                accountNumber: '88392019',
                                remittanceRef: `BACS-${tx.reference.substring(0, 12)}`
                              });
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] inline-flex items-center gap-1 shadow transition"
                          >
                            <Building2 className="w-3 h-3" /> Pay Invoice
                          </button>
                        </td>
                      </tr>
                    ))}
                    {pendingPayables.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                          All received supplier invoices have been cleared and paid.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Settled Supplier Invoices History */}
            <div className="space-y-3 pt-4">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Settled Supplier Payments ({settledPayables.length})
              </h5>

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Payment Date</th>
                      <th className="py-3 px-4">Invoice / PO Ref</th>
                      <th className="py-3 px-4">Supplier</th>
                      <th className="py-3 px-4">Method</th>
                      <th className="py-3 px-4 text-right">Gross Paid</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/60 font-mono">
                    {settledPayables.map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 text-slate-400 font-sans">{tx.timestamp.substring(0, 10)}</td>
                        <td className="py-3 px-4 font-bold text-slate-200">{tx.reference}</td>
                        <td className="py-3 px-4 font-sans font-semibold text-white">{tx.counterparty}</td>
                        <td className="py-3 px-4 font-sans text-slate-300">{tx.paymentMethod}</td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-400">£{tx.grossAmount.toFixed(2)}</td>
                        <td className="py-3 px-4 text-center font-sans">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                            Paid & Reconciled
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* VIEW 4: STAFF PAYROLL & DISBURSEMENTS */}
      {activeTab === 'payroll' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" /> Active Employee Roster & Payroll Disburser
            </h4>
            <span className="text-xs text-slate-400">
              {employees.length} Employees registered in Roster
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Department & Role</th>
                  <th className="py-3 px-4">Tier / Level</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Payroll Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                {employees.map(emp => (
                  <tr key={emp.id || emp.name} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-bold text-white">
                      {emp.name}
                      <div className="text-[10px] text-slate-400 font-normal">{emp.email || 'Direct Staff'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-200">{emp.department}</span>
                      <div className="text-[10px] text-slate-400">{emp.role}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-purple-300">
                      Level {emp.level} ({emp.tier})
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        emp.status === 'Active'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setPayrollModalEmployee(emp);
                          setPayrollAmount('2500.00');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] inline-flex items-center gap-1.5 shadow transition"
                      >
                        <PoundSterling className="w-3.5 h-3.5" /> Disburse Payment
                      </button>
                    </td>
                  </tr>
                ))}
                {employees.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No employees currently loaded in roster. Visit the Employee Hub to register staff.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 5: GRANULAR AUDIT LEDGER */}
      {activeTab === 'reconciliation' && (
        <div className="space-y-6">
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-xs">BYOD Zero-Knowledge</span>
                <h3 className="text-sm font-bold text-white">Client-Side Bank Feed & Reconciliation Desk</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Upload your bank statement (.csv or .ofx). Transactions parse strictly in browser memory without sending data to an external server.
              </p>
            </div>
            <label className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer transition flex items-center gap-2 shadow-lg shadow-emerald-950/40">
              <Landmark className="w-4 h-4" />
              <span>{bankFileLoading ? 'Parsing in Memory...' : 'Upload Bank Statement'}</span>
              <input type="file" accept=".csv,.ofx,.qif,.txt" onChange={handleBankFileUpload} className="hidden" />
            </label>
          </div>

          {parsedTransactions.length > 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">
                  Unmatched In-Memory Transactions ({parsedTransactions.length})
                </span>
                <span className="text-xs text-emerald-400 font-medium">Reconciled in this session: {reconciledCount}</span>
              </div>
              <div className="divide-y divide-slate-800/60 max-h-[500px] overflow-y-auto">
                {parsedTransactions.map((tx, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition text-xs">
                    <div className="space-y-1">
                      <div className="font-semibold text-white">{tx.description}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{tx.date}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`font-mono font-bold ${tx.type === 'CREDIT' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {tx.type === 'CREDIT' ? '+' : '-'}£{tx.amount.toFixed(2)}
                      </span>
                      <button
                        onClick={() => handleReconcileLine(tx, idx)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-[11px] font-semibold transition flex items-center gap-1"
                      >
                        Match & Post Ledger
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center border-2 border-dashed border-slate-800 rounded-2xl">
              <Landmark className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No active bank statement loaded.</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Upload a bank statement export to reconcile debits and credits.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold">Ledger Filter:</span>
              {(['all', 'incomings', 'outgoings'] as LedgerFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setLedgerFilter(f)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition capitalize ${
                    ledgerFilter === f
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="text-xs text-slate-400">
              Showing {displayTransactions.length} transaction entries for {timeframe.replace('_', ' ')}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Ref Code</th>
                  <th className="py-3 px-4">Type & Category</th>
                  <th className="py-3 px-4">Counterparty / Payee</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4 text-right">Gross Amount</th>
                  <th className="py-3 px-4 text-right">20% VAT</th>
                  <th className="py-3 px-4 text-right">Net Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                {displayTransactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono text-slate-400">{tx.timestamp.substring(0, 10)}</td>
                    <td className="py-3 px-4 font-mono font-bold text-purple-300">{tx.reference}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border mr-1.5 ${
                        tx.type === 'incoming'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      }`}>
                        {tx.type.toUpperCase()}
                      </span>
                      <span className="text-slate-300">{tx.category}</span>
                    </td>
                    <td className="py-3 px-4 font-bold text-white">{tx.counterparty}</td>
                    <td className="py-3 px-4 text-slate-400">{tx.paymentMethod}</td>
                    <td className={`py-3 px-4 font-mono font-bold text-right ${tx.type === 'incoming' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {tx.type === 'incoming' ? '+' : '-'}£{tx.grossAmount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-mono text-right text-slate-400">£{tx.vatAmount.toFixed(2)}</td>
                    <td className="py-3 px-4 font-mono text-right font-semibold text-slate-200">£{tx.netAmount.toFixed(2)}</td>
                  </tr>
                ))}
                {displayTransactions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No transactions recorded under this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 6: TAX, VAT & HMRC COMPLIANCE SUITE */}
      {activeTab === 'tax_hmrc' && (() => {
        // Compute 9-Box MTD VAT Return
        const outputSales = contacts.filter(c => c.invoiceStatus === 'Paid');
        const box6_netSales = outputSales.reduce((s, c) => s + (Number(c.dealValue) || 0), 0);
        const box1_vatDue = box6_netSales * 0.2;
        const box2_acquisitions = 0;
        const box3_totalVatDue = box1_vatDue + box2_acquisitions;

        // Reclaimable input VAT from purchases (shipping fees, supplier bills)
        const relevantPurchases = transactions.filter(t => t.type === 'outgoing' && t.category !== 'Payroll');
        const box7_netPurchases = relevantPurchases.reduce((s, t) => s + t.netAmount, 0) + (metrics.shippingCosts * 0.8);
        const box4_vatReclaimed = (relevantPurchases.reduce((s, t) => s + t.vatAmount, 0)) + (metrics.shippingCosts * 0.2);
        const box5_netVatPayable = box3_totalVatDue - box4_vatReclaimed;

        const boxValues = {
          box1: box1_vatDue,
          box2: box2_acquisitions,
          box3: box3_totalVatDue,
          box4: box4_vatReclaimed,
          box5: box5_netVatPayable,
          box6: box6_netSales,
          box7: box7_netPurchases,
          box8: 0,
          box9: 0
        };

        // PAYE & NIC Calculations
        const payrollTransactions = transactions.filter(t => t.category === 'Payroll');
        const totalGrossPayroll = payrollTransactions.reduce((s, t) => s + t.grossAmount, 0);
        const payeIncomeTaxEstimate = totalGrossPayroll * 0.20; // 20% basic rate
        const employeeNic = totalGrossPayroll * 0.08;          // 8% Class 1 primary
        const employerNic = totalGrossPayroll * 0.138;         // 13.8% Class 1 secondary
        const totalP30DueToHmrc = payeIncomeTaxEstimate + employeeNic + employerNic;

        // Corporation Tax Forecaster
        const taxableTradingProfit = Math.max(0, metrics.operatingProfit);
        const ctRate = taxableTradingProfit <= 50000 ? 0.19 : 0.25;
        const corporationTaxProvision = taxableTradingProfit * ctRate;

        return (
          <div className="space-y-6">
            {/* HMRC Credentials & Statutory Identifiers */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-purple-400" /> HMRC Statutory Registrations & Credentials
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    HMRC Making Tax Digital (MTD) Gateway credentials and VAT accounting configuration.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={taxQuarter}
                    onChange={(e) => setTaxQuarter(e.target.value as any)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-bold focus:outline-none focus:border-purple-400"
                  >
                    <option value="Q1">VAT Quarter 1 (Jan - Mar)</option>
                    <option value="Q2">VAT Quarter 2 (Apr - Jun)</option>
                    <option value="Q3">VAT Quarter 3 (Jul - Sep)</option>
                    <option value="Q4">VAT Quarter 4 (Oct - Dec)</option>
                  </select>
                  <button
                    onClick={() => handleExportMtdReturn(boxValues)}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow transition"
                  >
                    <Download className="w-3.5 h-3.5" /> Export MTD 9-Box Return (CSV)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <label className="text-[10px] uppercase font-bold text-slate-500 block">VAT Registration Number (VRN)</label>
                  <input
                    type="text"
                    value={hmrcSettings.vrn}
                    onChange={(e) => handleSaveHmrcSettings({ vrn: e.target.value })}
                    disabled={!canEditTax} className={`mt-1 bg-transparent text-xs font-mono font-bold text-white w-full focus:outline-none ${!canEditTax ? "cursor-not-allowed opacity-60" : ""}`}
                  />
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <label className="text-[10px] uppercase font-bold text-slate-500 block">PAYE Employer Ref</label>
                  <input
                    type="text"
                    value={hmrcSettings.payeRef}
                    onChange={(e) => handleSaveHmrcSettings({ payeRef: e.target.value })}
                    disabled={!canEditTax} className={`mt-1 bg-transparent text-xs font-mono font-bold text-white w-full focus:outline-none ${!canEditTax ? "cursor-not-allowed opacity-60" : ""}`}
                  />
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <label className="text-[10px] uppercase font-bold text-slate-500 block">Corporation Tax UTR</label>
                  <input
                    type="text"
                    value={hmrcSettings.utr}
                    onChange={(e) => handleSaveHmrcSettings({ utr: e.target.value })}
                    disabled={!canEditTax} className={`mt-1 bg-transparent text-xs font-mono font-bold text-white w-full focus:outline-none ${!canEditTax ? "cursor-not-allowed opacity-60" : ""}`}
                  />
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <label className="text-[10px] uppercase font-bold text-slate-500 block">VAT Scheme</label>
                  <select
                    value={hmrcSettings.accountingScheme}
                    onChange={(e) => handleSaveHmrcSettings({ accountingScheme: e.target.value as any })}
                    className="mt-1 bg-transparent text-xs font-semibold text-white w-full focus:outline-none cursor-pointer"
                  >
                    <option value="Standard Accrual" className="bg-slate-900">Standard Accrual</option>
                    <option value="Cash Accounting" className="bg-slate-900">Cash Accounting Scheme</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Statutory Overview KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* VAT Box 5 */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Net VAT Due to HMRC (Box 5)</span>
                  <PoundSterling className="w-4 h-4 text-emerald-400" />
                </div>
                <div className={`text-2xl font-black font-mono ${box5_netVatPayable >= 0 ? 'text-emerald-400' : 'text-sky-400'}`}>
                  £{box5_netVatPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-[11px] text-slate-500">
                  {box5_netVatPayable >= 0 ? 'Payment due to HMRC for period' : 'Reclaimable refund from HMRC'}
                </p>
              </div>

              {/* PAYE / P30 Monthly Liability */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>PAYE & NIC Monthly Due (P30)</span>
                  <Users className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl font-black text-purple-400 font-mono">
                  £{totalP30DueToHmrc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-[11px] text-slate-500">Due by 19th/22nd of calendar month</p>
              </div>

              {/* Corporation Tax Reserve */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Corporation Tax (CT600 Provision)</span>
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-black text-amber-400 font-mono">
                  £{corporationTaxProvision.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-[11px] text-slate-500">
                  Estimated at {(ctRate * 100).toFixed(0)}% on £{taxableTradingProfit.toLocaleString()} profit
                </p>
              </div>
            </div>

            {/* MTD 9-BOX RETURN TABLE */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-indigo-400" /> Making Tax Digital (MTD) Statutory 9-Box VAT Return
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Official 9-box computation auto-reconciled against sales ledgers and operational outgoings.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                  MTD Schema Ready
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 w-24">Box No.</th>
                      <th className="py-3 px-4">Statutory Description</th>
                      <th className="py-3 px-4 text-right w-44">Calculated Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/60 font-mono">
                    <tr className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-bold text-purple-300">Box 1</td>
                      <td className="py-3 px-4 font-sans text-slate-200">VAT due in the period on sales and other outputs</td>
                      <td className="py-3 px-4 text-right text-emerald-400 font-bold">£{boxValues.box1.toFixed(2)}</td>
                    </tr>
                    <tr className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-bold text-purple-300">Box 2</td>
                      <td className="py-3 px-4 font-sans text-slate-200">VAT due in the period on acquisitions from other EC member states</td>
                      <td className="py-3 px-4 text-right text-slate-400">£{boxValues.box2.toFixed(2)}</td>
                    </tr>
                    <tr className="hover:bg-slate-800/40 bg-slate-950/40">
                      <td className="py-3 px-4 font-bold text-purple-300">Box 3</td>
                      <td className="py-3 px-4 font-sans font-bold text-white">Total VAT due (sum of Box 1 and Box 2)</td>
                      <td className="py-3 px-4 text-right text-emerald-400 font-bold">£{boxValues.box3.toFixed(2)}</td>
                    </tr>
                    <tr className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-bold text-purple-300">Box 4</td>
                      <td className="py-3 px-4 font-sans text-slate-200">VAT reclaimed in the period on purchases and other inputs (including dispatch courier fees)</td>
                      <td className="py-3 px-4 text-right text-rose-400 font-bold">£{boxValues.box4.toFixed(2)}</td>
                    </tr>
                    <tr className="hover:bg-slate-800/40 bg-purple-950/20 border-y border-purple-500/30">
                      <td className="py-3.5 px-4 font-bold text-purple-300">Box 5</td>
                      <td className="py-3.5 px-4 font-sans font-bold text-white">Net VAT to be paid to HMRC or reclaimed by you (Box 3 minus Box 4)</td>
                      <td className="py-3.5 px-4 text-right font-black text-sm text-purple-200">£{boxValues.box5.toFixed(2)}</td>
                    </tr>
                    <tr className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-bold text-purple-300">Box 6</td>
                      <td className="py-3 px-4 font-sans text-slate-200">Total value of sales and all other outputs excluding any VAT</td>
                      <td className="py-3 px-4 text-right text-slate-200">£{boxValues.box6.toFixed(2)}</td>
                    </tr>
                    <tr className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-bold text-purple-300">Box 7</td>
                      <td className="py-3 px-4 font-sans text-slate-200">Total value of purchases and all other inputs excluding any VAT</td>
                      <td className="py-3 px-4 text-right text-slate-200">£{boxValues.box7.toFixed(2)}</td>
                    </tr>
                    <tr className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-bold text-purple-300">Box 8</td>
                      <td className="py-3 px-4 font-sans text-slate-200">Total value of all supplies of goods and related services excluding any VAT to other EC member states</td>
                      <td className="py-3 px-4 text-right text-slate-400">£{boxValues.box8.toFixed(2)}</td>
                    </tr>
                    <tr className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-bold text-purple-300">Box 9</td>
                      <td className="py-3 px-4 font-sans text-slate-200">Total value of all acquisitions of goods and related services excluding any VAT from other EC member states</td>
                      <td className="py-3 px-4 text-right text-slate-400">£{boxValues.box9.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* PAYE RTI & CORP TAX AUDIT SCHEDULE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* PAYE Real Time Information (RTI) Schedule */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" /> PAYE & National Insurance RTI Schedule
                </h4>
                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span>Gross Salaries Disbursed</span>
                    <span className="font-mono font-bold text-white">£{totalGrossPayroll.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span>PAYE Income Tax Deductions (20% Basic)</span>
                    <span className="font-mono text-purple-300 font-bold">£{payeIncomeTaxEstimate.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span>Employee Class 1 Primary NIC (8%)</span>
                    <span className="font-mono text-indigo-300 font-bold">£{employeeNic.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span>Employer Class 1 Secondary NIC (13.8%)</span>
                    <span className="font-mono text-amber-300 font-bold">£{employerNic.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-950/20 border border-purple-500/30">
                    <span className="font-bold text-purple-200">Total P30 Remittance Due to HMRC</span>
                    <span className="font-mono font-black text-purple-300">£{totalP30DueToHmrc.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Corporation Tax Provision Breakdown */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-400" /> Corporation Tax (CT600) Provision Forecaster
                </h4>
                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span>Total Operating Intake</span>
                    <span className="font-mono font-bold text-emerald-400">£{metrics.intake.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span>Allowable Trading Expenses & Overheads</span>
                    <span className="font-mono text-rose-400 font-bold">£{metrics.outgoings.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span>Net Taxable Trading Profit</span>
                    <span className="font-mono font-bold text-white">£{taxableTradingProfit.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span>Applicable Tax Bracket</span>
                    <span className="font-bold text-amber-300">
                      {taxableTradingProfit <= 50000 ? '19% Small Profits Rate' : '25% Main Corporation Rate'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/30">
                    <span className="font-bold text-amber-200">Required Corporation Tax Cash Reserve</span>
                    <span className="font-mono font-black text-amber-300">£{corporationTaxProvision.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* VIEW 7: CHARITY & NON-PROFIT GIFT AID 25% TAX RECLAIM DESK */}
      {activeTab === 'gift_aid' && isGiftAidEnabled && (() => {
        const totalDonations = giftAidClaims.reduce((acc, c) => acc + (Number(c.donationAmount) || 0), 0);
        const totalReclaimable = giftAidClaims.reduce((acc, c) => acc + (Number(c.claimAmount) || 0), 0);
        const pendingClaims = giftAidClaims.filter(c => c.status === 'Pending Submission');
        const pendingAmount = pendingClaims.reduce((acc, c) => acc + (Number(c.claimAmount) || 0), 0);
        const settledAmount = giftAidClaims.filter(c => c.status === 'Reclaimed & Settled').reduce((acc, c) => acc + (Number(c.claimAmount) || 0), 0);

        const handleDownloadHMRCSpreadsheet = () => {
          const headers = ['Donor Name', 'Donor Address', 'Postcode', 'Donation Date', 'Donation Amount (GBP)', 'Gift Aid Reclaim 25% (GBP)', 'Status', 'Declaration Confirmed'];
          const rows = giftAidClaims.map(c => [
            `"${c.donorName}"`,
            `"${c.donorAddress}"`,
            `"${c.donorPostcode}"`,
            c.donationDate,
            c.donationAmount.toFixed(2),
            c.claimAmount.toFixed(2),
            c.status,
            c.declarationConfirmed ? 'YES' : 'NO'
          ]);
          const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
          const encodedUri = encodeURI(csvContent);
          const link = document.createElement('a');
          link.setAttribute('href', encodedUri);
          link.setAttribute('download', `HMRC_Gift_Aid_Schedule_${new Date().toISOString().slice(0, 10)}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        };

        return (
          <div className="space-y-6">
            {/* Header & KPI Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium">Total Qualifying Gifts</span>
                <p className="text-2xl font-black text-white mt-1">£{totalDonations.toFixed(2)}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{giftAidClaims.length} verified donor gifts</p>
              </div>

              <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30">
                <span className="text-xs text-emerald-400 font-medium">Total 25% HMRC Reclaim</span>
                <p className="text-2xl font-black text-emerald-300 mt-1">£{totalReclaimable.toFixed(2)}</p>
                <p className="text-[11px] text-emerald-500/80 mt-0.5">+25p per £1 on eligible donations</p>
              </div>

              <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-500/30">
                <span className="text-xs text-amber-400 font-medium">Pending HMRC Submission</span>
                <p className="text-2xl font-black text-amber-300 mt-1">£{pendingAmount.toFixed(2)}</p>
                <p className="text-[11px] text-amber-500/80 mt-0.5">{pendingClaims.length} ready for batch claim</p>
              </div>

              <div className="p-5 rounded-2xl bg-indigo-950/20 border border-indigo-500/30">
                <span className="text-xs text-indigo-400 font-medium">Reclaimed & Banked</span>
                <p className="text-2xl font-black text-indigo-300 mt-1">£{settledAmount.toFixed(2)}</p>
                <p className="text-[11px] text-indigo-500/80 mt-0.5">Cleared funds received from HMRC</p>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                  <HeartHandshake className="w-4 h-4 text-rose-400" /> HMRC Charities Online Reclaim Schedule
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Statutory Gift Aid register compliant with UK Charities Act & HMRC declaration rules.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleDownloadHMRCSpreadsheet}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 transition"
                >
                  <Download className="w-3.5 h-3.5" /> Export HMRC Schedule (CSV)
                </button>
                <button
                  type="button"
                  onClick={() => setIsNewGiftAidModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-2 transition shadow"
                >
                  <Plus className="w-3.5 h-3.5" /> Log Donor Gift
                </button>
              </div>
            </div>

            {/* Claims Table */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase font-mono text-[10px]">
                    <th className="py-3 px-4">Donor Name & Address</th>
                    <th className="py-3 px-4">Postcode</th>
                    <th className="py-3 px-4">Donation Date</th>
                    <th className="py-3 px-4 text-right">Donation Value</th>
                    <th className="py-3 px-4 text-right">25% HMRC Reclaim</th>
                    <th className="py-3 px-4">Batch Reference</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {giftAidClaims.map(claim => (
                    <tr key={claim.id || claim.donorName} className="hover:bg-slate-800/30 transition">
                      <td className="py-3.5 px-4 font-sans">
                        <span className="font-bold text-slate-200 block">{claim.donorName}</span>
                        <span className="text-[11px] text-slate-500">{claim.donorAddress}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 uppercase">{claim.donorPostcode}</td>
                      <td className="py-3.5 px-4 text-slate-400">{claim.donationDate}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-white">£{claim.donationAmount.toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-400">+£{claim.claimAmount.toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">{claim.hmrcBatchReference || 'UNBATCHED'}</td>
                      <td className="py-3.5 px-4 font-sans">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          claim.status === 'Reclaimed & Settled'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : claim.status === 'Submitted to HMRC'
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}>
                          {claim.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-sans">
                        {claim.status === 'Pending Submission' && (
                          <button
                            type="button"
                            onClick={async () => {
                              const batchRef = `HMRC-GA-${new Date().getFullYear()}-B0${Math.floor(Math.random() * 80 + 10)}`;
                              await db.giftAidClaims.update(claim.id!, {
                                status: 'Submitted to HMRC',
                                hmrcBatchReference: batchRef
                              });
                              const updated = await db.giftAidClaims.toArray();
                              setGiftAidClaims(updated);
                            }}
                            className="text-[11px] text-amber-400 hover:text-amber-300 font-medium hover:underline"
                          >
                            Mark Submitted
                          </button>
                        )}
                        {claim.status === 'Submitted to HMRC' && (
                          <button
                            type="button"
                            onClick={async () => {
                              await db.giftAidClaims.update(claim.id!, {
                                status: 'Reclaimed & Settled'
                              });
                              const updated = await db.giftAidClaims.toArray();
                              setGiftAidClaims(updated);
                            }}
                            className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium hover:underline"
                          >
                            Mark Settled
                          </button>
                        )}
                        {claim.status === 'Reclaimed & Settled' && (
                          <span className="text-[11px] text-slate-500">Completed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal: Log New Donor Gift */}
            {isNewGiftAidModalOpen && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <h4 className="font-bold text-white text-sm flex items-center gap-2">
                      <HeartHandshake className="w-4 h-4 text-rose-400" /> Log Donor Gift & Gift Aid Declaration
                    </h4>
                    <button onClick={() => setIsNewGiftAidModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Donor Full Name</label>
                      <input
                        type="text"
                        value={newDonation.donorName}
                        onChange={(e) => setNewDonation({ ...newDonation, donorName: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Donor House Address</label>
                      <input
                        type="text"
                        value={newDonation.donorAddress}
                        onChange={(e) => setNewDonation({ ...newDonation, donorAddress: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-100"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">UK Postcode</label>
                        <input
                          type="text"
                          value={newDonation.donorPostcode}
                          onChange={(e) => setNewDonation({ ...newDonation, donorPostcode: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 uppercase font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Gift Amount (£)</label>
                        <input
                          type="number"
                          value={newDonation.donationAmount}
                          onChange={(e) => setNewDonation({ ...newDonation, donationAmount: Number(e.target.value) || 0 })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 font-mono font-bold"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Donation Date</label>
                      <input
                        type="date"
                        value={newDonation.donationDate}
                        onChange={(e) => setNewDonation({ ...newDonation, donationDate: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-100"
                      />
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Reclaimable Tax (25%):</span>
                        <span className="font-mono font-bold text-emerald-400">+£{(newDonation.donationAmount * 0.25).toFixed(2)}</span>
                      </div>
                      <label className="flex items-start gap-2 text-[11px] text-slate-300 cursor-pointer pt-1 border-t border-slate-800">
                        <input
                          type="checkbox"
                          checked={newDonation.declarationConfirmed}
                          onChange={(e) => setNewDonation({ ...newDonation, declarationConfirmed: e.target.checked })}
                          className="mt-0.5 w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-500"
                        />
                        <span>Donor has confirmed they are a UK taxpayer paying sufficient Income/Capital Gains Tax.</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsNewGiftAidModalOpen(false)}
                      className="flex-1 py-2 text-xs text-slate-400 border border-slate-800 rounded-lg hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const claimAmt = newDonation.donationAmount * 0.25;
                        const claimRecord: Omit<GiftAidClaim, 'id'> = {
                          donorName: newDonation.donorName,
                          donorAddress: newDonation.donorAddress,
                          donorPostcode: newDonation.donorPostcode,
                          donationAmount: newDonation.donationAmount,
                          claimAmount: claimAmt,
                          donationDate: newDonation.donationDate,
                          declarationConfirmed: newDonation.declarationConfirmed,
                          status: 'Pending Submission',
                          createdAt: new Date().toISOString()
                        };
                        await db.giftAidClaims.add(claimRecord as any);
                        const updated = await db.giftAidClaims.toArray();
                        setGiftAidClaims(updated);
                        setIsNewGiftAidModalOpen(false);
                      }}
                      className="flex-1 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition shadow"
                    >
                      Save Donor Gift
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* MODAL: PAY SUPPLIER INVOICE (CARD OR BANK TRANSFER) */}
      {payingTransaction && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-400" /> Disburse Supplier Invoice Payment
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Paying <span className="text-white font-bold">{payingTransaction.counterparty}</span> &bull; {payingTransaction.reference}
                </p>
              </div>
              <button onClick={() => setPayingTransaction(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPayMethod('Bank Transfer')}
                className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition ${
                  payMethod === 'Bank Transfer'
                    ? 'bg-purple-600/20 border-purple-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Building2 className="w-4 h-4 text-purple-400" />
                <div>
                  <div className="text-xs font-bold">Bank Transfer / BACS</div>
                  <div className="text-[10px] text-slate-400">Faster Payments remitted</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPayMethod('Corporate Card')}
                className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition ${
                  payMethod === 'Corporate Card'
                    ? 'bg-purple-600/20 border-purple-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="text-xs font-bold">Corporate Card</div>
                  <div className="text-[10px] text-slate-400">Visa / Mastercard debit</div>
                </div>
              </button>
            </div>

            <form onSubmit={handleSettleSupplierInvoice} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Net Payable Amount:</span>
                  <span className="font-mono text-white">£{payingTransaction.netAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>20% Input VAT:</span>
                  <span className="font-mono text-slate-300">£{payingTransaction.vatAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-slate-800 text-white">
                  <span>Total Gross Disbursement:</span>
                  <span className="font-mono text-emerald-400 text-sm">£{payingTransaction.grossAmount.toFixed(2)}</span>
                </div>
              </div>

              {payMethod === 'Bank Transfer' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Supplier Sort Code</label>
                      <input
                        type="text"
                        required
                        value={bankDetails.sortCode}
                        onChange={(e) => setBankDetails({ ...bankDetails, sortCode: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-purple-400 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Account Number</label>
                      <input
                        type="text"
                        required
                        value={bankDetails.accountNumber}
                        onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-purple-400 text-center"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Remittance Reference</label>
                    <input
                      type="text"
                      placeholder="e.g. BACS-PO-2026-003"
                      value={bankDetails.remittanceRef}
                      onChange={(e) => setBankDetails({ ...bankDetails, remittanceRef: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-purple-400"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Corporate Cardholder</label>
                    <input
                      type="text"
                      disabled
                      value={cardDetails.cardHolder}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 font-mono cursor-not-allowed"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Card Ending In</label>
                      <input
                        type="text"
                        disabled
                        value={`•••• •••• •••• ${cardDetails.cardLast4}`}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 font-mono cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Bank Auth Code (Optional)</label>
                      <input
                        type="text"
                        placeholder="AUTH-9281"
                        value={cardDetails.authCode}
                        onChange={(e) => setCardDetails({ ...cardDetails, authCode: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-purple-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingTransaction(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow"
                >
                  <CheckCircle2 className="w-4 h-4" /> Authorize & Clear £{payingTransaction.grossAmount.toFixed(2)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LOG RECEIVED SUPPLIER INVOICE */}
      {isNewInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-400" /> Log Received Supplier Invoice
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Record supplier PDF bill to queue for Finance settlement and VAT reclaim.
                </p>
              </div>
              <button onClick={() => setIsNewInvoiceModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddReceivedInvoice} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Supplier / Vendor Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Supplier Name Ltd"
                  value={newInvoiceForm.vendorName}
                  onChange={(e) => setNewInvoiceForm({ ...newInvoiceForm, vendorName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Supplier Invoice No.</label>
                  <input
                    type="text"
                    required
                    placeholder="INV-94812"
                    value={newInvoiceForm.invoiceNumber}
                    onChange={(e) => setNewInvoiceForm({ ...newInvoiceForm, invoiceNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-purple-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Matching PO Number</label>
                  <input
                    type="text"
                    placeholder="PO-2026-003"
                    value={newInvoiceForm.poReference}
                    onChange={(e) => setNewInvoiceForm({ ...newInvoiceForm, poReference: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Net Invoice Amount (£)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="e.g. 1400.00"
                  value={newInvoiceForm.netAmount}
                  onChange={(e) => setNewInvoiceForm({ ...newInvoiceForm, netAmount: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono flex justify-between">
                <span className="text-slate-400">Total with 20% VAT:</span>
                <span className="text-emerald-400 font-bold">
                  £{((parseFloat(newInvoiceForm.netAmount) || 0) * 1.2).toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewInvoiceModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow"
                >
                  Queue for Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1: COMPANIES HOUSE LOOKUP & INSOLVENCY CHECK */}
      {chSelectedContact && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-400" />
                  Companies House Insolvency & Registry Verification
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Auditing corporate credentials for {chSelectedContact.company || chSelectedContact.name}
                </p>
              </div>
              <button
                onClick={() => setChSelectedContact(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search registered company name..."
                value={chQuery}
                onChange={(e) => setChQuery(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-purple-400"
              />
              <button
                onClick={() => handleSearchCompaniesHouse(chQuery)}
                disabled={chLoading}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
              >
                {chLoading ? 'Searching...' : 'Search CH'}
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {chResults.map((company, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white text-xs">{company.title}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      CRN: {company.company_number} &bull; Status: {company.company_status}
                    </div>
                    <div className="text-[10px] text-slate-500">{company.address_snippet}</div>
                  </div>
                  <button
                    onClick={() => handleVerifyWithCompaniesHouse(chSelectedContact, company)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px]"
                  >
                    Verify & Stamp
                  </button>
                </div>
              ))}
              {chResults.length === 0 && !chLoading && (
                <div className="py-6 text-center text-xs text-slate-500">
                  Search a registered company name to verify existence and check for liquidation or insolvency markers.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ISSUE CREDIT NOTE */}
      {creditNoteContact && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" /> Issue Credit Note
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Account: {creditNoteContact.accountNumber} &bull; {creditNoteContact.company || creditNoteContact.name}
                </p>
              </div>
              <button onClick={() => setCreditNoteContact(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRaiseCreditNote} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Credit Note Amount (£)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="e.g. 150.00"
                  value={creditNoteAmount}
                  onChange={(e) => setCreditNoteAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Reason for Credit Note</label>
                <select
                  value={creditNoteReason}
                  onChange={(e) => setCreditNoteReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-400"
                >
                  <option value="Goodwill / Damaged packaging">Goodwill / Damaged packaging</option>
                  <option value="Pricing / Tariff dispute">Pricing / Tariff dispute</option>
                  <option value="Returned stock / cancellation">Returned stock / cancellation</option>
                  <option value="Service disruption SLA credit">Service disruption SLA credit</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreditNoteContact(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs"
                >
                  Confirm & Issue Credit Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: STAFF PAYROLL RUN */}
      {payrollModalEmployee && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <PoundSterling className="w-5 h-5 text-indigo-400" /> Disburse Staff Payment
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Payee: {payrollModalEmployee.name} ({payrollModalEmployee.department})
                </p>
              </div>
              <button onClick={() => setPayrollModalEmployee(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDisbursePayroll} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Disbursement Type</label>
                <select
                  value={payrollType}
                  onChange={(e) => setPayrollType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-400"
                >
                  <option value="Monthly Salary">Monthly Salary</option>
                  <option value="Commission Bonus">Commission Bonus</option>
                  <option value="Expense Reimbursement">Expense Reimbursement</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Disbursement Amount (£)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={payrollAmount}
                  onChange={(e) => setPayrollAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPayrollModalEmployee(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
                >
                  Authorize Disbursement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: RECORD OUTGOING BILL */}
      {isOutgoingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ArrowUpRight className="w-5 h-5 text-rose-400" /> Record Outgoing / Supplier Payable
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Deducts from gross revenue and enters in audit ledger.
                </p>
              </div>
              <button onClick={() => setIsOutgoingModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordOutgoing} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Payee / Supplier</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Packaging Supply Co."
                  value={outgoingForm.payee}
                  onChange={(e) => setOutgoingForm({ ...outgoingForm, payee: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Amount (£)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 450.00"
                  value={outgoingForm.amount}
                  onChange={(e) => setOutgoingForm({ ...outgoingForm, amount: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Payment Method</label>
                <select
                  value={outgoingForm.method}
                  onChange={(e) => setOutgoingForm({ ...outgoingForm, method: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-400"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="BACS / Direct Debit">BACS Direct Debit</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOutgoingModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
                >
                  Record Outgoing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: MOTO VIRTUAL PHONE TERMINAL */}
      {phonePaymentContact && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <PhoneCall className="w-5 h-5 text-purple-400" /> Over-the-Phone (MOTO) Virtual Terminal
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Capturing payment for {phonePaymentContact.company || phonePaymentContact.name}
                </p>
              </div>
              <button onClick={() => setPhonePaymentContact(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
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

                await db.contacts.update(phonePaymentContact.id!, {
                  invoiceStatus: 'Paid',
                  paymentMethod: 'Stripe Card',
                  updatedAt: new Date().toISOString(),
                });

                recordTransaction({
                  type: 'incoming',
                  category: 'Customer Settlement',
                  reference: `MOTO-${phonePaymentContact.accountNumber}`,
                  counterparty: phonePaymentContact.company || phonePaymentContact.name,
                  grossAmount: Number(cardForm.amount),
                  vatAmount: Number(cardForm.amount) * 0.2,
                  netAmount: Number(cardForm.amount) * 0.8,
                  status: 'Settled',
                  paymentMethod: 'Stripe Card',
                  timestamp: new Date().toISOString()
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
            }} className="space-y-4">
              {chargeError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  {chargeError}
                </div>
              )}
              {chargeSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
                  Payment successfully authorized and captured.
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Total Charge (£)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={cardForm.amount}
                  onChange={(e) => setCardForm({ ...cardForm, amount: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Card Number</label>
                <input
                  type="text"
                  required
                  placeholder="4242 •••• •••• 4242"
                  value={cardForm.cardNumber}
                  onChange={(e) => setCardForm({ ...cardForm, cardNumber: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">MM</label>
                  <input
                    type="text"
                    required
                    placeholder="12"
                    value={cardForm.expMonth}
                    onChange={(e) => setCardForm({ ...cardForm, expMonth: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white font-mono text-center"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">YY</label>
                  <input
                    type="text"
                    required
                    placeholder="28"
                    value={cardForm.expYear}
                    onChange={(e) => setCardForm({ ...cardForm, expYear: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white font-mono text-center"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">CVC</label>
                  <input
                    type="password"
                    required
                    placeholder="•••"
                    value={cardForm.cvc}
                    onChange={(e) => setCardForm({ ...cardForm, cvc: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white font-mono text-center"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPhonePaymentContact(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCharging}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
                >
                  {isCharging ? 'Authorizing...' : 'Process MOTO Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
