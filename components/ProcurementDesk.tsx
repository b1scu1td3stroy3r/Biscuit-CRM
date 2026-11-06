'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../packages/storage/src/db';
import {
  Building,
  Plus,
  FileText,
  CheckCircle2,
  Clock,
  DollarSign,
  Upload,
  ShieldCheck,
  AlertCircle,
  Search,
  Filter,
  Download,
  Calendar,
  Layers,
  ArrowRight,
  TrendingDown,
  Building2,
  Check,
  X,
  FileSpreadsheet,
  Mail,
  Send
} from 'lucide-react';

export type TimeframeFilter = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'ytd';

export interface Vendor {
  id: string;
  name: string;
  contact: string;
  email: string;
  vatNumber: string;
  status: 'Approved' | 'Pending Review' | 'Dormant';
  paymentTerms: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorName: string;
  item: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  status: 'Draft' | 'Approved' | 'Sent' | 'Received' | 'Cancelled';
  createdAt: string;
  approvedBy?: string;
  paymentType?: 'Finance Invoice' | 'Card Upfront';
  isPaidUpfront?: boolean;
}

export interface StockItem {
  id: string;
  sku: string;
  item: string;
  category: string;
  onHand: number;
  reserved: number;
  available: number;
  reorderLevel: number;
  location: string;
  lastRestocked: string;
}

export interface VendorQuote {
  id: string;
  quoteRef: string;
  vendorName: string;
  item: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  leadTimeDays: number;
  validUntil: string;
  status: 'Received' | 'Accepted' | 'Declined';
  createdAt: string;
}

export default function ProcurementDesk({ currentEmployee }: { currentEmployee?: any }) {
  const [activeTab, setActiveTab] = useState<'pos' | 'quotes' | 'vendors' | 'stock' | 'audit'>('pos');
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('month');

  // Filters
  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>('all');
  const [itemSearchTerm, setItemSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Live Stock & Goods Inwards State
  const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null);
  const [receivedQty, setReceivedQty] = useState<number>(0);
  const [stockLocation, setStockLocation] = useState<string>('Bay 1 - Rack A');

  const [inventory, setInventory] = useState<StockItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('biscuit_crm_inventory');
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.warn(e);
      }
    }
    return [
      { id: 'stk-1', sku: 'BOX-EXP-500', item: 'Corrugated Boxes', category: 'Packaging', onHand: 450, reserved: 50, available: 400, reorderLevel: 100, location: 'Bay 2 - Rack B', lastRestocked: '2026-11-02' },
      { id: 'stk-2', sku: 'STRP-HD-100', item: 'Reinforced Strapping Bands', category: 'Consumables', onHand: 800, reserved: 120, available: 680, reorderLevel: 200, location: 'Bay 1 - Shelf 4', lastRestocked: '2026-11-04' },
      { id: 'stk-3', sku: 'CRTE-WTR-200', item: 'Heavy Duty Weatherproof Crates', category: 'Storage', onHand: 60, reserved: 15, available: 45, reorderLevel: 25, location: 'Bay 3 - Pallet Rack 1', lastRestocked: '2026-10-28' },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('biscuit_crm_inventory', JSON.stringify(inventory));
    } catch (e) {
      console.warn(e);
    }
  }, [inventory]);

  // Modals
  const [showPOModal, setShowPOModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  // PO Email Dispatch Modal State
  const [emailModalPO, setEmailModalPO] = useState<{
    po: PurchaseOrder;
    vendorEmail: string;
    quoteRef?: string;
    leadTimeDays?: number;
  } | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  // Initial local state / persistent storage
  const [vendors, setVendors] = useState<Vendor[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('biscuit_crm_procurement_vendors');
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.warn(e);
      }
    }
    return [];
  });

  const [pos, setPos] = useState<PurchaseOrder[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('biscuit_crm_procurement_pos');
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.warn(e);
      }
    }
    return [];
  });

  const [quotes, setQuotes] = useState<VendorQuote[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('biscuit_crm_procurement_quotes');
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.warn(e);
      }
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('biscuit_crm_procurement_vendors', JSON.stringify(vendors));
    } catch (e) {
      console.warn(e);
    }
  }, [vendors]);

  useEffect(() => {
    try {
      localStorage.setItem('biscuit_crm_procurement_pos', JSON.stringify(pos));
    } catch (e) {
      console.warn(e);
    }
  }, [pos]);

  useEffect(() => {
    try {
      localStorage.setItem('biscuit_crm_procurement_quotes', JSON.stringify(quotes));
    } catch (e) {
      console.warn(e);
    }
  }, [quotes]);

  // Form states
  const [newVendor, setNewVendor] = useState({ name: '', contact: '', email: '', vatNumber: '', paymentTerms: 'Net 30' });
  const [newPO, setNewPO] = useState({ vendorName: '', item: '', description: '', quantity: 1, unitPrice: 0, paymentType: 'Finance Invoice' as 'Finance Invoice' | 'Card Upfront' });
  const [newQuote, setNewQuote] = useState({ vendorName: '', quoteRef: '', item: '', quantity: 100, unitPrice: 0, leadTimeDays: 3, validUntil: '' });

  // Timeframe validation helper
  const isWithinTimeframe = (dateStr: string, tf: TimeframeFilter) => {
    const date = new Date(dateStr);
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
    if (tf === 'ytd') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return date >= startOfYear && date <= now;
    }
    return true;
  };

  // Filtered datasets
  const filteredPOs = useMemo(() => {
    return pos.filter(po => {
      if (!isWithinTimeframe(po.createdAt, timeframe)) return false;
      if (selectedVendorFilter !== 'all' && po.vendorName !== selectedVendorFilter) return false;
      if (statusFilter !== 'all' && po.status !== statusFilter) return false;
      if (itemSearchTerm) {
        const term = itemSearchTerm.toLowerCase();
        const matchItem = po.item?.toLowerCase().includes(term);
        const matchDesc = po.description?.toLowerCase().includes(term);
        const matchPO = po.poNumber.toLowerCase().includes(term);
        if (!matchItem && !matchDesc && !matchPO) return false;
      }
      return true;
    });
  }, [pos, timeframe, selectedVendorFilter, statusFilter, itemSearchTerm]);

  const filteredQuotes = useMemo(() => {
    return quotes.filter(q => {
      if (!isWithinTimeframe(q.createdAt, timeframe)) return false;
      if (selectedVendorFilter !== 'all' && q.vendorName !== selectedVendorFilter) return false;
      if (itemSearchTerm) {
        const term = itemSearchTerm.toLowerCase();
        const matchItem = q.item?.toLowerCase().includes(term);
        const matchRef = q.quoteRef.toLowerCase().includes(term);
        if (!matchItem && !matchRef) return false;
      }
      return true;
    });
  }, [quotes, timeframe, selectedVendorFilter, itemSearchTerm]);

  // Aggregate metrics
  const totalPOSpend = filteredPOs.reduce((sum, p) => sum + p.amount, 0);
  const totalQuotesValue = filteredQuotes.reduce((sum, q) => sum + q.totalAmount, 0);
  const activeVendorsCount = new Set(filteredPOs.map(p => p.vendorName)).size;

  // Handlers
  const handleCreatePO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPO.vendorName || !newPO.item) return;
    const poNum = `PO-2026-00${pos.length + 1}`;
    const calculatedAmount = Number(newPO.quantity) * Number(newPO.unitPrice);
    const isCard = newPO.paymentType === 'Card Upfront';
    const entry: PurchaseOrder = {
      id: `po-${Date.now()}`,
      poNumber: poNum,
      vendorName: newPO.vendorName,
      item: newPO.item,
      description: newPO.description || `${newPO.quantity}x ${newPO.item}`,
      quantity: Number(newPO.quantity) || 1,
      unitPrice: Number(newPO.unitPrice) || 0,
      amount: calculatedAmount,
      status: 'Approved',
      createdAt: new Date().toISOString().substring(0, 10),
      approvedBy: currentEmployee?.name || 'Authorized Procurement Officer',
      paymentType: newPO.paymentType,
      isPaidUpfront: isCard
    };

    // If paid upfront via card, log immediate settled outgoing
    if (isCard) {
      try {
        const existingTx = JSON.parse(localStorage.getItem('biscuit_crm_financial_transactions') || '[]');
        const vat = calculatedAmount * 0.2;
        existingTx.unshift({
          id: `TX-${Date.now()}`,
          type: 'outgoing',
          category: 'Supplier Payable',
          reference: `${poNum} (Corporate Card Upfront)`,
          counterparty: newPO.vendorName,
          grossAmount: calculatedAmount + vat,
          vatAmount: vat,
          netAmount: calculatedAmount,
          status: 'Settled',
          paymentMethod: 'Corporate Card',
          timestamp: new Date().toISOString()
        });
        localStorage.setItem('biscuit_crm_financial_transactions', JSON.stringify(existingTx));
      } catch (err) {
        console.warn(err);
      }
    }

    setPos([entry, ...pos]);
    setShowPOModal(false);
    setNewPO({ vendorName: '', item: '', description: '', quantity: 1, unitPrice: 0, paymentType: 'Finance Invoice' });
  };

  const handleCreateQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuote.vendorName || !newQuote.item) return;
    const ref = newQuote.quoteRef || `Q-${Math.floor(1000 + Math.random() * 9000)}`;
    const total = Number(newQuote.quantity) * Number(newQuote.unitPrice);
    const entry: VendorQuote = {
      id: `q-${Date.now()}`,
      quoteRef: ref,
      vendorName: newQuote.vendorName,
      item: newQuote.item,
      quantity: Number(newQuote.quantity) || 1,
      unitPrice: Number(newQuote.unitPrice) || 0,
      totalAmount: total,
      leadTimeDays: Number(newQuote.leadTimeDays) || 3,
      validUntil: newQuote.validUntil || '2026-12-31',
      status: 'Received',
      createdAt: new Date().toISOString().substring(0, 10)
    };
    setQuotes([entry, ...quotes]);
    setShowQuoteModal(false);
    setNewQuote({ vendorName: '', quoteRef: '', item: '', quantity: 100, unitPrice: 0, leadTimeDays: 3, validUntil: '' });
  };

  const handleConvertQuoteToPO = (quote: VendorQuote) => {
    const poNum = `PO-2026-00${pos.length + 1}`;
    const newPOEntry: PurchaseOrder = {
      id: `po-${Date.now()}`,
      poNumber: poNum,
      vendorName: quote.vendorName,
      item: quote.item,
      description: `Fulfilled from Quote ${quote.quoteRef}: ${quote.quantity}x ${quote.item}`,
      quantity: quote.quantity,
      unitPrice: quote.unitPrice,
      amount: quote.totalAmount,
      status: 'Approved',
      createdAt: new Date().toISOString().substring(0, 10),
      approvedBy: currentEmployee?.name || 'Authorized Procurement Officer'
    };

    setPos([newPOEntry, ...pos]);
    setQuotes(quotes.map(q => q.id === quote.id ? { ...q, status: 'Accepted' } : q));

    const vendorObj = vendors.find(v => v.name.toLowerCase() === quote.vendorName.toLowerCase());
    const recipientEmail = vendorObj?.email || 'orders@supplier.co.uk';

    const vat = quote.totalAmount * 0.2;
    const gross = quote.totalAmount + vat;

    const defaultSubject = `Official Purchase Order: ${poNum} - Biscuit Logistics [Ref: ${quote.quoteRef}]`;
    const defaultBody = `Dear ${vendorObj?.contact || quote.vendorName} Sales Team,

Please accept this official Purchase Order based on your accepted quotation tender ${quote.quoteRef}.

--------------------------------------------------
PURCHASE ORDER DETAILS
--------------------------------------------------
PO Number:        ${poNum}
Quote Reference:  ${quote.quoteRef}
Supplier:         ${quote.vendorName}
Date of Order:    ${new Date().toISOString().substring(0, 10)}
Authorised By:    ${currentEmployee?.name || 'Authorized Procurement Officer'} (Managing Director / Procurement)

ORDERED SPECIFICATIONS:
- Item / Description: ${quote.item}
- Quantity:            ${quote.quantity} units
- Quoted Unit Price:   £${quote.unitPrice.toFixed(2)}
- Net Subtotal:        £${quote.totalAmount.toFixed(2)}
- 20% UK VAT:          £${vat.toFixed(2)}
- Total Gross Due:     £${gross.toFixed(2)}
- Agreed Lead Time:    ${quote.leadTimeDays} business days

DELIVERY LOCATION & BOOKING:
Biscuit Central Depot
Goods Inwards Bay 3
Leeds, West Yorkshire

--------------------------------------------------
INVOICE SUBMISSION INSTRUCTIONS (MANDATORY FORMAT)
--------------------------------------------------
To ensure prompt processing and automated 3-way matching, please submit your tax invoice adhering to the following criteria:

1. Submission Email: Send PDF invoices to: invoices@biscuitcrm.co.uk
2. Subject Line: Must state: [INVOICE] - [Supplier Name] - PO Reference: ${poNum}
3. Mandatory Invoice Elements:
   • Official Purchase Order Number clearly printed: ${poNum}
   • Supplier Legal Name, Registered Address & UK VAT Number
   • Itemized Description matching PO lines: "${quote.item}"
   • Net Subtotal, 20% VAT Breakdown & Total Gross matching agreed quote £${gross.toFixed(2)}
   • Bank Remittance Details: Bank Name, Sort Code, Account Number (or IBAN/BIC)
   • Settlement Terms: As agreed (${vendorObj?.paymentTerms || 'Net 30'})

Note: Invoices received without a valid Purchase Order number or with mismatched quantities will be rejected back to accounts payable.

Please confirm receipt of this purchase order and advise estimated delivery dispatch date.

Kind regards,
${currentEmployee?.name || 'Authorized Procurement Officer'}
Procurement & Supply Chain Operations
Biscuit CRM`;

    setEmailSubject(defaultSubject);
    setEmailBody(defaultBody);
    setEmailModalPO({
      po: newPOEntry,
      vendorEmail: recipientEmail,
      quoteRef: quote.quoteRef,
      leadTimeDays: quote.leadTimeDays
    });
  };

  const handleTransmitAndArchivePO = async () => {
    if (!emailModalPO) return;
    const { po } = emailModalPO;

    // 1. Update PO status to Sent
    setPos(pos.map(p => p.id === po.id ? { ...p, status: 'Sent' } : p));

    // 2. Queue Pending Supplier Payable in Finance Ledger
    try {
      const existingTx = JSON.parse(localStorage.getItem('biscuit_crm_financial_transactions') || '[]');
      const vat = po.amount * 0.20;
      const gross = po.amount + vat;
      const newPayable = {
        id: `TX-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: 'outgoing',
        category: 'Supplier Payable',
        reference: po.poNumber,
        counterparty: po.vendorName,
        grossAmount: gross,
        vatAmount: vat,
        netAmount: po.amount,
        status: 'Pending',
        paymentMethod: 'Bank Transfer',
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('biscuit_crm_financial_transactions', JSON.stringify([newPayable, ...existingTx]));
    } catch (err) {
      console.warn('Failed to queue finance payable', err);
    }

    // 3. Post Finance To-Do Action in Newsfeed
    try {
      await db.newsFeed.add({
        title: `ACTION REQUIRED: Supplier Payable ${po.poNumber}`,
        content: `Procurement dispatched PO ${po.poNumber} to ${po.vendorName} (£${po.amount.toFixed(2)} Net + £${(po.amount * 0.2).toFixed(2)} VAT). Awaiting supplier invoice & settlement clearance.`,
        category: 'Finance To-Do',
        department: 'Finance',
        actor: currentEmployee?.name || 'Authorized Procurement Officer',
        badgeColor: 'border-amber-500/40 text-amber-300 bg-amber-500/10',
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Failed to post newsfeed action', err);
    }

    setEmailModalPO(null);
    setActiveTab('audit');
    alert(`✅ Purchase Order ${po.poNumber} transmitted and queued as a pending action for the Finance team.`);
  };

  const handleConfirmGoodsIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingPO) return;

    // 1. Update PO Status to Received
    setPos(pos.map(p => p.id === receivingPO.id ? { ...p, status: 'Received' } : p));

    const existingMatch = inventory.find(
      i => i.item.toLowerCase() === receivingPO.item.toLowerCase() ||
           receivingPO.item.toLowerCase().includes(i.item.toLowerCase())
    );

    // 2. Update or Create Stock Item
    let assignedSku = '';
    let targetBay = stockLocation;

    setInventory(prev => {
      if (existingMatch) {
        assignedSku = existingMatch.sku;
        targetBay = stockLocation || existingMatch.location;
        return prev.map(item => item.id === existingMatch.id ? {
          ...item,
          onHand: item.onHand + receivedQty,
          available: item.available + receivedQty,
          lastRestocked: new Date().toISOString().substring(0, 10),
          location: targetBay
        } : item);
      } else {
        assignedSku = `SKU-${receivingPO.item.substring(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
        const newStock: StockItem = {
          id: `stk-${Date.now()}`,
          sku: assignedSku,
          item: receivingPO.item,
          category: 'Warehouse Stock',
          onHand: receivedQty,
          reserved: 0,
          available: receivedQty,
          reorderLevel: 25,
          location: targetBay || 'Bay 1 - Rack A',
          lastRestocked: new Date().toISOString().substring(0, 10)
        };
        return [newStock, ...prev];
      }
    });

    // 3. Audit in Newsfeed for Sales and CS visibility
    try {
      await db.newsFeed.add({
        title: `GOODS RECEIVED: +${receivedQty} units of ${receivingPO.item}`,
        content: `Warehouse Goods In completed receipt of PO ${receivingPO.poNumber} from ${receivingPO.vendorName}. Available stock incremented in ${stockLocation}. Sales and CS pipelines updated.`,
        category: 'Goods In',
        department: 'Operations',
        actor: currentEmployee?.name || 'Authorized Procurement Officer',
        badgeColor: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10',
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn(err);
    }

    setReceivingPO(null);
    alert(`✅ Goods In recorded: +${receivedQty} units added to live stock.`);
  };

  const handleRegisterVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendor.name) return;
    const entry: Vendor = {
      id: String(vendors.length + 1),
      ...newVendor,
      status: 'Approved'
    };
    setVendors([...vendors, entry]);
    setShowVendorModal(false);
    setNewVendor({ name: '', contact: '', email: '', vatNumber: '', paymentTerms: 'Net 30' });
  };

  // Generate Procurement Audit Report (.CSV)
  const handleExportProcurementReport = () => {
    const reportData = [
      ['PROCUREMENT & VENDOR AUDIT REPORT'],
      ['Timeframe Horizon', timeframe.toUpperCase()],
      ['Generated By', currentEmployee?.name || 'Authorized Procurement Officer'],
      ['Generated At', new Date().toISOString()],
      ['Vendor Filter', selectedVendorFilter],
      ['Status Filter', statusFilter],
      ['', ''],
      ['AUDIT SUMMARY', ''],
      ['Total Purchase Orders Issued', filteredPOs.length],
      ['Total Committed Spend (£)', `£${totalPOSpend.toFixed(2)}`],
      ['Total Received Quotes', filteredQuotes.length],
      ['Quotes Pipeline Value (£)', `£${totalQuotesValue.toFixed(2)}`],
      ['', ''],
      ['PURCHASE ORDER AUDIT LOG', ''],
      ['Date', 'PO Number', 'Vendor', 'Item / Spec', 'Quantity', 'Unit Price (£)', 'Net Amount (£)', '20% VAT (£)', 'Gross Amount (£)', 'Status', 'Authorized By']
    ];

    filteredPOs.forEach(p => {
      const net = p.amount;
      const vat = net * 0.20;
      const gross = net + vat;
      reportData.push([
        p.createdAt,
        p.poNumber,
        `"${p.vendorName.replace(/"/g, '""')}"`,
        `"${p.item.replace(/"/g, '""')}"`,
        p.quantity,
        p.unitPrice.toFixed(2),
        net.toFixed(2),
        vat.toFixed(2),
        gross.toFixed(2),
        p.status,
        p.approvedBy || 'Automated'
      ]);
    });

    reportData.push(['', '']);
    reportData.push(['RECEIVED QUOTES TENDER COMPARISON', '']);
    reportData.push(['Received Date', 'Quote Ref', 'Vendor', 'Item', 'Quantity', 'Unit Price (£)', 'Total Value (£)', 'Lead Time (Days)', 'Valid Until', 'Status']);

    filteredQuotes.forEach(q => {
      reportData.push([
        q.createdAt,
        q.quoteRef,
        `"${q.vendorName.replace(/"/g, '""')}"`,
        `"${q.item.replace(/"/g, '""')}"`,
        q.quantity,
        q.unitPrice.toFixed(2),
        q.totalAmount.toFixed(2),
        q.leadTimeDays,
        q.validUntil,
        q.status
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + reportData.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BiscuitCRM_Procurement_Audit_${timeframe}_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Audit Actions */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Building2 className="w-5 h-5"/>
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              Procurement, Vendor Management & Inventory POs
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                Audit Active
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Multi-timeframe PO expenditure audits, received quote tenders, unit-price comparisons & supplier governance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportProcurementReport}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold inline-flex items-center gap-1.5 shadow transition"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400"/> Export Audit Report
          </button>
          <button
            onClick={() => setShowQuoteModal(true)}
            className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition shadow"
          >
            <Plus className="w-3.5 h-3.5"/> Log Received Quote
          </button>
          <button
            onClick={() => setShowVendorModal(true)}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold inline-flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5"/> Register Vendor
          </button>
          <button
            onClick={() => setShowPOModal(true)}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow transition"
          >
            <Plus className="w-3.5 h-3.5"/> Raise Purchase Order
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs & Multi-Timeframe Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-3">
        {/* Sub-Tab Navigation */}
        <div className="flex items-center gap-1.5">
          {[
            { id: 'pos', label: `Purchase Orders (${filteredPOs.length})`, icon: FileText },
            { id: 'quotes', label: `Received Quotes (${filteredQuotes.length})`, icon: FileSpreadsheet },
            { id: 'vendors', label: `Approved Vendors (${vendors.length})`, icon: Building },
            { id: 'stock', label: `Live Stock Levels (${inventory.length})`, icon: Layers },
            { id: 'audit', label: 'Spend Audit Trail', icon: ShieldCheck }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                  active
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5"/>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Multi-Timeframe Filter Pill: Day, Week, Month, Quarter, Year, YTD */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <Calendar className="w-3.5 h-3.5 text-slate-500 ml-2"/>
          {[
            { id: 'day', label: 'Day (Today)' },
            { id: 'week', label: 'Week' },
            { id: 'month', label: 'Month' },
            { id: 'quarter', label: 'Quarter' },
            { id: 'year', label: 'Year' },
            { id: 'ytd', label: 'YTD' }
          ].map(tf => (
            <button
              key={tf.id}
              onClick={() => setTimeframe(tf.id as TimeframeFilter)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                timeframe === tf.id
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Aggregate KPI Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Committed PO Spend</span>
            <DollarSign className="w-4 h-4 text-rose-400"/>
          </div>
          <div className="text-2xl font-black text-rose-400 font-mono">
            £{totalPOSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500">
            {filteredPOs.length} POs issued in {timeframe.toUpperCase()}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Received Quotes Tender</span>
            <Layers className="w-4 h-4 text-amber-400"/>
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">
            £{totalQuotesValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500">
            {filteredQuotes.length} quotes actively evaluated
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Active Suppliers Audited</span>
            <Building className="w-4 h-4 text-sky-400"/>
          </div>
          <div className="text-2xl font-black text-sky-400 font-mono">
            {activeVendorsCount} Vendors
          </div>
          <p className="text-[11px] text-slate-500">Across {vendors.length} registered partners</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Avg Order Commitment</span>
            <TrendingDown className="w-4 h-4 text-emerald-400"/>
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            £{(filteredPOs.length > 0 ? totalPOSpend / filteredPOs.length : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500">Average transaction size</p>
        </div>
      </div>

      {/* Advanced Filter Ribbon (Vendor Filter, Item Search & Status Selector) */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1">
          {/* Item / Part Number / Keyword Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5"/>
            <input
              type="text"
              placeholder="Filter by item, spec or description..."
              value={itemSearchTerm}
              onChange={(e) => setItemSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          {/* Vendor Filter Dropdown */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500"/>
            <select
              value={selectedVendorFilter}
              onChange={(e) => setSelectedVendorFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Vendors ({vendors.length})</option>
              {vendors.map(v => (
                <option key={v.id} value={v.name}>{v.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter Dropdown */}
          {activeTab === 'pos' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="Approved">Approved</option>
              <option value="Sent">Sent</option>
              <option value="Received">Received</option>
              <option value="Draft">Draft</option>
            </select>
          )}
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Showing {activeTab === 'pos' ? filteredPOs.length : filteredQuotes.length} matching entries
        </div>
      </div>

      {/* VIEW 1: PURCHASE ORDERS */}
      {activeTab === 'pos' && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Vendor</th>
                <th className="py-3 px-4">Item & Line Description</th>
                <th className="py-3 px-4 text-center">Qty</th>
                <th className="py-3 px-4 text-right">Unit Price</th>
                <th className="py-3 px-4 text-right">Net Value</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Issued Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
              {filteredPOs.map(po => (
                <tr key={po.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4 font-mono font-bold text-indigo-400">{po.poNumber}</td>
                  <td className="py-3 px-4 font-semibold text-white">{po.vendorName}</td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-200">{po.item}</div>
                    <div className="text-[10px] text-slate-400">{po.description}</div>
                  </td>
                  <td className="py-3 px-4 text-center font-mono">{po.quantity}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-400">£{po.unitPrice?.toFixed(2) || '-'}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-100">£{po.amount.toFixed(2)}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      po.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                      po.status === 'Sent' ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' :
                      po.status === 'Received' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                      'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400">{po.createdAt}</td>
                  <td className="py-3 px-4 text-right">
                    {po.status === 'Approved' && (
                      <button
                        onClick={() => {
                          setPos(pos.map(p => p.id === po.id ? { ...p, status: 'Sent' } : p));
                          alert(`Marked ${po.poNumber} as Sent to ${po.vendorName}`);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-bold transition"
                      >
                        Transmit &rarr;
                      </button>
                    )}
                    {po.status === 'Sent' && (
                      <button
                        onClick={() => {
                          setReceivingPO(po);
                          setReceivedQty(po.quantity);
                        }}
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition inline-flex items-center gap-1 shadow"
                      >
                        <Check className="w-3 h-3"/> Receive Goods
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredPOs.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No purchase orders match the current filter and timeframe ({timeframe}).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* VIEW 2: RECEIVED QUOTES & TENDER COMPARISON */}
      {activeTab === 'quotes' && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Quote Ref</th>
                <th className="py-3 px-4">Vendor</th>
                <th className="py-3 px-4">Item Spec</th>
                <th className="py-3 px-4 text-center">Quantity</th>
                <th className="py-3 px-4 text-right">Unit Price</th>
                <th className="py-3 px-4 text-right">Total Tender (£)</th>
                <th className="py-3 px-4 text-center">Lead Time</th>
                <th className="py-3 px-4">Valid Until</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Tender Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
              {filteredQuotes.map(q => (
                <tr key={q.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4 font-mono font-bold text-amber-400">{q.quoteRef}</td>
                  <td className="py-3 px-4 font-semibold text-white">{q.vendorName}</td>
                  <td className="py-3 px-4 font-bold text-slate-200">{q.item}</td>
                  <td className="py-3 px-4 text-center font-mono">{q.quantity}</td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-400 font-bold">£{q.unitPrice.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-white">£{q.totalAmount.toFixed(2)}</td>
                  <td className="py-3 px-4 text-center font-mono">{q.leadTimeDays} days</td>
                  <td className="py-3 px-4 font-mono text-slate-400">{q.validUntil}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      q.status === 'Accepted' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                      q.status === 'Declined' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                      'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}>
                      {q.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {q.status === 'Received' && (
                      <button
                        onClick={() => handleConvertQuoteToPO(q)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] inline-flex items-center gap-1 shadow transition"
                      >
                        <Check className="w-3 h-3"/> Convert to PO
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredQuotes.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    No supplier quotes recorded for this timeframe ({timeframe}).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* VIEW 3: APPROVED VENDORS */}
      {activeTab === 'vendors' && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Vendor Name</th>
                <th className="py-3 px-4">Contact Person</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4 font-mono">VAT Number</th>
                <th className="py-3 px-4">Terms</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
              {vendors.map(v => (
                <tr key={v.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4 font-bold text-white">{v.name}</td>
                  <td className="py-3 px-4 text-slate-300">{v.contact}</td>
                  <td className="py-3 px-4 text-slate-400">{v.email}</td>
                  <td className="py-3 px-4 font-mono text-purple-300">{v.vatNumber}</td>
                  <td className="py-3 px-4 font-mono text-slate-300">{v.paymentTerms}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      v.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                      v.status === 'Pending Review' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                      'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {v.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

            {/* VIEW: LIVE STOCK LEVELS & GOODS IN AUDIT */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400"/> Centralized Warehouse Stock & Inventory Ledger
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time stock levels synchronized across Procurement, Sales quotes, and Customer Services support cases.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Total Units On Hand: {inventory.reduce((s, i) => s + i.onHand, 0).toLocaleString()}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">SKU Code</th>
                  <th className="py-3 px-4">Item & Description</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Location Bay</th>
                  <th className="py-3 px-4 text-right">Physical On Hand</th>
                  <th className="py-3 px-4 text-right">Reserved (Sales)</th>
                  <th className="py-3 px-4 text-right">Available to Sell</th>
                  <th className="py-3 px-4 text-center">Stock Health</th>
                  <th className="py-3 px-4 text-right">Last Restocked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/60 font-mono">
                {inventory.map(item => {
                  const isLow = item.available <= item.reorderLevel;
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 text-indigo-400 font-bold">{item.sku}</td>
                      <td className="py-3 px-4 font-sans font-bold text-white">{item.item}</td>
                      <td className="py-3 px-4 font-sans text-slate-400">{item.category}</td>
                      <td className="py-3 px-4 text-slate-300">{item.location}</td>
                      <td className="py-3 px-4 text-right text-slate-200 font-bold">{item.onHand.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-amber-400">{item.reserved.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-emerald-400 font-black text-sm">{item.available.toLocaleString()}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          isLow
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        }`}>
                          {isLow ? 'LOW STOCK' : 'IN STOCK'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500 font-sans">{item.lastRestocked}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 4: SPEND AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400"/> Statutory Procurement Audit Trail
            </h4>
            <span className="text-xs font-mono text-slate-400">
              Audit Period: {timeframe.toUpperCase()}
            </span>
          </div>

          <div className="space-y-3">
            {filteredPOs.map(p => (
              <div key={p.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <FileText className="w-4 h-4"/>
                  </div>
                  <div>
                    <div className="font-bold text-white flex items-center gap-2">
                      {p.poNumber} &bull; {p.vendorName}
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded font-mono">
                        {p.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Line: {p.quantity}x {p.item} (£{p.unitPrice} / unit) &bull; Authorized by {p.approvedBy || 'Management'}
                    </div>
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="font-bold text-white">£{p.amount.toFixed(2)}</div>
                  <div className="text-[10px] text-slate-500">{p.createdAt}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: RAISE PURCHASE ORDER */}
      {showPOModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-indigo-400"/> Raise Authorized Purchase Order
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Directly commitments inventory to warehouse receiving.</p>
              </div>
              <button onClick={() => setShowPOModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <form onSubmit={handleCreatePO} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Approved Vendor</label>
                <select
                  required
                  value={newPO.vendorName}
                  onChange={(e) => setNewPO({ ...newPO, vendorName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Choose Vendor --</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.name}>{v.name} ({v.paymentTerms})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Item Title / Category</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Export Shipping Cartons"
                  value={newPO.item}
                  onChange={(e) => setNewPO({ ...newPO, item: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newPO.quantity}
                    onChange={(e) => setNewPO({ ...newPO, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Unit Price (£)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newPO.unitPrice}
                    onChange={(e) => setNewPO({ ...newPO, unitPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Procurement Payment Terms</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewPO({ ...newPO, paymentType: 'Finance Invoice' })}
                    className={`p-2 rounded-xl border text-left text-xs font-bold transition ${
                      newPO.paymentType === 'Finance Invoice'
                        ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div>Finance Receives &amp; Pays</div>
                    <div className="text-[10px] font-normal text-slate-500">Invoice credit terms</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPO({ ...newPO, paymentType: 'Card Upfront' })}
                    className={`p-2 rounded-xl border text-left text-xs font-bold transition ${
                      newPO.paymentType === 'Card Upfront'
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div>Procurement Card Upfront</div>
                    <div className="text-[10px] font-normal text-slate-500">Immediate settlement</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Detailed Specifications</label>
                <input
                  type="text"
                  placeholder="Optional specifications or delivery bay instructions"
                  value={newPO.description}
                  onChange={(e) => setNewPO({ ...newPO, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between text-xs font-mono">
                <span className="text-slate-400">Total Net Commitment:</span>
                <span className="text-white font-bold">£{(Number(newPO.quantity) * Number(newPO.unitPrice)).toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPOModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
                >
                  Issue Purchase Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: LOG RECEIVED QUOTE */}
      {showQuoteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-amber-400"/> Log Supplier Quote Tender
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Record received quotes for pricing audit comparison.</p>
              </div>
              <button onClick={() => setShowQuoteModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <form onSubmit={handleCreateQuote} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Supplier / Vendor</label>
                <select
                  required
                  value={newQuote.vendorName}
                  onChange={(e) => setNewQuote({ ...newQuote, vendorName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Choose Vendor --</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.name}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Quote Reference</label>
                  <input
                    type="text"
                    placeholder="e.g. Q-9481"
                    value={newQuote.quoteRef}
                    onChange={(e) => setNewQuote({ ...newQuote, quoteRef: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Item Spec</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Wooden Pallets"
                    value={newQuote.item}
                    onChange={(e) => setNewQuote({ ...newQuote, item: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newQuote.quantity}
                    onChange={(e) => setNewQuote({ ...newQuote, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Unit Price (£)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newQuote.unitPrice}
                    onChange={(e) => setNewQuote({ ...newQuote, unitPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Lead Time (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={newQuote.leadTimeDays}
                    onChange={(e) => setNewQuote({ ...newQuote, leadTimeDays: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Valid Until Date</label>
                  <input
                    type="date"
                    value={newQuote.validUntil}
                    onChange={(e) => setNewQuote({ ...newQuote, validUntil: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between text-xs font-mono">
                <span className="text-slate-400">Total Tender Value:</span>
                <span className="text-amber-400 font-bold">£{(Number(newQuote.quantity) * Number(newQuote.unitPrice)).toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuoteModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs"
                >
                  Save Quote Tender
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: REGISTER VENDOR */}
      {showVendorModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Building className="w-4 h-4 text-indigo-400"/> Onboard Authorized Supplier
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Register vendor details and payment settlement terms.</p>
              </div>
              <button onClick={() => setShowVendorModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <form onSubmit={handleRegisterVendor} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Northern Pallets Ltd"
                  value={newVendor.name}
                  onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Contact Name</label>
                  <input
                    type="text"
                    placeholder="e.g. David Brown"
                    value={newVendor.contact}
                    onChange={(e) => setNewVendor({ ...newVendor, contact: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="orders@vendor.co.uk"
                    value={newVendor.email}
                    onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">VAT Reg Number</label>
                  <input
                    type="text"
                    placeholder="GB 998 1029 44"
                    value={newVendor.vatNumber}
                    onChange={(e) => setNewVendor({ ...newVendor, vatNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Payment Terms</label>
                  <select
                    value={newVendor.paymentTerms}
                    onChange={(e) => setNewVendor({ ...newVendor, paymentTerms: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Pre-payment">Pre-payment</option>
                    <option value="Net 14">Net 14 Days</option>
                    <option value="Net 30">Net 30 Days</option>
                    <option value="Net 60">Net 60 Days</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVendorModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
                >
                  Register Vendor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: PURCHASE ORDER EMAIL POPUP & AUDIT ARCHIVE */}
      {emailModalPO && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Mail className="w-5 h-5 text-indigo-400"/> Dispatch Purchase Order to Supplier
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Confirm email transmission for <span className="text-indigo-400 font-mono font-bold">{emailModalPO.po.poNumber}</span> & archive to audit trail.
                </p>
              </div>
              <button onClick={() => setEmailModalPO(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Vendor Recipient</label>
                  <input
                    type="text"
                    disabled
                    value={`${emailModalPO.po.vendorName} (${emailModalPO.vendorEmail})`}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-400 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Total Authorized Value</label>
                  <input
                    type="text"
                    disabled
                    value={`£${emailModalPO.po.amount.toFixed(2)} Net (£${(emailModalPO.po.amount * 1.2).toFixed(2)} Gross)`}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-emerald-400 font-mono font-bold cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Subject Line</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Body & Purchase Specifications</label>
                <textarea
                  rows={9}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono leading-relaxed"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400"/> Archiving to Spend Audit Trail upon transmission
                </span>
                <span className="font-mono text-purple-300 font-bold">
                  Ref: {emailModalPO.quoteRef || 'Direct Tender'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <a
                href={`mailto:${emailModalPO.vendorEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs inline-flex items-center gap-1.5 transition"
              >
                <Send className="w-3.5 h-3.5 text-sky-400"/> Open in Email App (mailto)
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEmailModalPO(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleTransmitAndArchivePO}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow transition"
                >
                  <CheckCircle2 className="w-4 h-4"/> Transmit & Archive for Audit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* MODAL 5: GOODS INWARDS RECEIVING & STOCK INCREMENT */}
      {receivingPO && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400"/> Goods Inwards Receiving Dock
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Receiving stock against <span className="text-indigo-400 font-mono font-bold">{receivingPO.poNumber}</span> from {receivingPO.vendorName}.
                </p>
              </div>
              <button onClick={() => setReceivingPO(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5"/>
              </button>
            </div>

            {(() => {
              const match = inventory.find(i => 
                receivingPO && (i.item.toLowerCase() === receivingPO.item.toLowerCase() || 
                receivingPO.item.toLowerCase().includes(i.item.toLowerCase()))
              );
              return (
                <div className={`p-3 rounded-xl border text-xs mb-2 ${
                  match 
                    ? 'bg-sky-950/40 border-sky-500/40 text-sky-200' 
                    : 'bg-purple-950/40 border-purple-500/40 text-purple-200'
                }`}>
                  {match ? (
                    <div>
                      <span className="font-bold">📦 Existing Stock Type Found:</span> SKU <span className="font-mono font-bold">{match.sku}</span> is currently stored in <span className="font-bold underline">{match.location}</span>. Storing here will increment active count from {match.onHand} to {match.onHand + receivedQty}.
                    </div>
                  ) : (
                    <div>
                      <span className="font-bold">✨ Brand New Stock Type:</span> System will generate a new SKU ID and create an active warehouse record. Assign an initial bay below.
                    </div>
                  )}
                </div>
              );
            })()}

            <form onSubmit={handleConfirmGoodsIn} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Item Title</label>
                <input
                  type="text"
                  disabled
                  value={receivingPO.item}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-bold cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Ordered Quantity</label>
                  <input
                    type="text"
                    disabled
                    value={`${receivingPO.quantity} units`}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-400 font-mono cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Accepted Inwards Qty</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={receivedQty}
                    onChange={(e) => setReceivedQty(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Assign Warehouse Bin / Bay Location</label>
                <select
                  value={stockLocation}
                  onChange={(e) => setStockLocation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Bay 1 - Rack A">Bay 1 - Rack A (Fast Picking)</option>
                  <option value="Bay 2 - Rack B">Bay 2 - Rack B (Export Packaging)</option>
                  <option value="Bay 3 - Pallet Rack 1">Bay 3 - Pallet Rack 1 (Heavy Bulk)</option>
                  <option value="Bay 4 - Quarantine / Inspec">Bay 4 - Quarantine / Inspection</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between text-xs font-mono">
                <span className="text-emerald-300">New Physical Addition:</span>
                <span className="text-emerald-400 font-black">+{receivedQty} Units into Live Stock</span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReceivingPO(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow transition"
                >
                  <CheckCircle2 className="w-4 h-4"/> Confirm Stock Ingest & Increment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
