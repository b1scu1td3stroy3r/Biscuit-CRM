'use client';

import React, { useState } from 'react';
import { db } from '../packages/storage/src/db';
import { UploadCloud, CheckCircle2, X, FileSpreadsheet, ArrowRight, Table } from 'lucide-react';

interface UniversalCSVOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UniversalCSVOnboardingModal({ isOpen, onClose }: UniversalCSVOnboardingModalProps) {
  if (!isOpen) return null;

  const [step, setStep] = useState<'upload' | 'mapping' | 'complete'>('upload');
  const [targetTable, setTargetTable] = useState<'contacts' | 'inventory' | 'journalEntries'>('contacts');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [importedCount, setImportedCount] = useState(0);

  const tableFields = {
    contacts: ['name', 'email', 'phone', 'company', 'status', 'value'],
    inventory: ['sku', 'name', 'onHand', 'unitCost', 'location'],
    journalEntries: ['accountCode', 'description', 'debit', 'credit', 'reference']
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length < 2) {
        alert('CSV file must have a header row and at least one data row.');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
      const rows = lines.slice(1).map(line => line.split(',').map(v => v.trim().replace(/^["']|["']$/g, '')));

      setCsvHeaders(headers);
      setCsvRows(rows);

      // Auto-map matching field names
      const initialMap: Record<string, string> = {};
      tableFields[targetTable].forEach(field => {
        const matched = headers.find(h => h.toLowerCase().includes(field.toLowerCase()));
        if (matched) initialMap[field] = matched;
      });
      setColumnMap(initialMap);
      setStep('mapping');
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    try {
      const parsedRecords = csvRows.map((row, idx) => {
        const record: Record<string, any> = {
          id: `IMP-${Date.now().toString(36)}-${idx}`,
          createdAt: new Date().toISOString()
        };

        tableFields[targetTable].forEach(field => {
          const mappedHeader = columnMap[field];
          if (mappedHeader) {
            const colIdx = csvHeaders.indexOf(mappedHeader);
            let val: any = row[colIdx] || '';
            if (['value', 'onHand', 'unitCost', 'debit', 'credit'].includes(field)) {
              val = parseFloat(val) || 0;
            }
            record[field] = val;
          }
        });
        return record;
      });

      const table = db.table(targetTable);
      await table.bulkPut(parsedRecords);

      setImportedCount(parsedRecords.length);
      setStep('complete');
    } catch (err) {
      alert('Error importing data into database.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-white">Universal CSV Onboarding Wizard</h2>
              <p className="text-[11px] text-slate-400 font-mono">Map legacy QuickBooks, Xero, or Salesforce exports</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'upload' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Select Destination System Table</label>
              <select
                value={targetTable}
                onChange={(e) => setTargetTable(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
              >
                <option value="contacts">CRM Customer Pipeline & Accounts (Salesforce / HubSpot)</option>
                <option value="inventory">WMS Warehouse Stock Catalog (SAP / NetSuite)</option>
                <option value="journalEntries">General Ledger Opening Balances (QuickBooks / Xero)</option>
              </select>
            </div>

            <div className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-2xl p-8 text-center space-y-3 cursor-pointer">
              <UploadCloud className="w-8 h-8 text-slate-400 mx-auto" />
              <div>
                <p className="text-xs font-semibold text-slate-200">Choose CSV file or drag and drop</p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">Compatible with any standard delimited table</p>
              </div>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Match the CSV column headers from your exported file to Biscuit's database schema:
            </p>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
              {tableFields[targetTable].map(field => (
                <div key={field} className="flex items-center justify-between p-2 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-slate-300 font-semibold">{field}</span>
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                    <select
                      value={columnMap[field] || ''}
                      onChange={(e) => setColumnMap({ ...columnMap, [field]: e.target.value })}
                      className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="">-- Ignore Field --</option>
                      {csvHeaders.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition flex items-center gap-1.5"
              >
                <Table className="w-3.5 h-3.5" />
                Import {csvRows.length} Rows
              </button>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="space-y-4 py-4 text-center">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Import Complete</h3>
              <p className="text-xs text-slate-400 mt-1">
                Successfully imported <strong className="text-emerald-400 font-mono">{importedCount}</strong> records into <code className="text-slate-300 font-mono">db.{targetTable}</code>.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
              >
                Close & View Records
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
