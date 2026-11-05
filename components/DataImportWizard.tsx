'use client';

import React, { useState } from 'react';
import { 
  Upload, FileSpreadsheet, Users, UserCheck, CheckCircle2, 
  AlertCircle, Download, Database, ShieldCheck, ArrowRight, Loader2, Sparkles, RefreshCw
} from 'lucide-react';
import { db, Contact, EmployeeProfile } from '../packages/storage/src/db';
import { parseContactsCSV, parseStaffCSV } from '../packages/storage/src/importUtils';

interface DataImportWizardProps {
  onImportComplete: () => void;
  currentUser: string;
}

export default function DataImportWizard({ onImportComplete, currentUser }: DataImportWizardProps) {
  const [activeTrack, setActiveTrack] = useState<'contacts' | 'staff'>('contacts');
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [parsedContacts, setParsedContacts] = useState<Partial<Contact>[]>([]);
  const [parsedStaff, setParsedStaff] = useState<Partial<EmployeeProfile>[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportSummary(null);
    setParseErrors([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setFileContent(text);

      if (activeTrack === 'contacts') {
        const res = parseContactsCSV(text);
        setParsedContacts(res.valid);
        setParseErrors(res.errors);
      } else {
        const res = parseStaffCSV(text);
        setParsedStaff(res.valid);
        setParseErrors(res.errors);
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    if (activeTrack === 'contacts') {
      const sampleCSV = 
`Contact Name,Company,Email,Phone,Pipeline Stage,CRN,Deal Value,Account Manager,Billing Address
"Alice Smith","Acme Technologies","alice@acme.com","+44 20 7946 0111","Sales","12345678","5000","${currentUser}","100 High Street, London"
"Primary Contact","Client Enterprise","contact@client-enterprise.co.uk","+44 20 7946 0222","Lead","87654321","3200","${currentUser}","42 Park Lane, Manchester"
"Claire Watson","Vanguard Retail","claire@vanguard.org","+44 20 7946 0333","Prospect","","12000","${currentUser}","12 Commercial Rd, Leeds"`;
      
      const blob = new Blob([sampleCSV], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'biscuit_crm_customers_leads_template.csv';
      a.click();
    } else {
      const sampleCSV = 
`Full Name,Job Title,Department,Hierarchy Tier
"Alex Smith","Commercial Executive","Sales","Staff"
"Team Leader","Commercial Lead","Sales","Team Leader"
"Liam Hughes","Fulfillment Director","Operations","Manager"
"Elena Rostova","Head of Accounts","Finance","Staff"
"Mark Thompson","IT Support Engineer","IT","Staff"`;

      const blob = new Blob([sampleCSV], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'biscuit_crm_staff_roster_template.csv';
      a.click();
    }
  };

  const handleCommitImport = async () => {
    setIsProcessing(true);
    const now = new Date().toISOString();

    try {
      if (activeTrack === 'contacts') {
        let importedCount = 0;
        const currentCount = await db.contacts.count();

        for (let i = 0; i < parsedContacts.length; i++) {
          const item = parsedContacts[i];
          const accNumber = `ACC-${10001 + currentCount + i}`;

          const contactPayload: Contact = {
            accountNumber: accNumber,
            name: item.name || 'Unnamed Client',
            company: item.company || '',
            crn: item.crn || '',
            email: item.email || '',
            phone: item.phone || '',
            stage: item.stage || 'Lead',
            dealValue: item.dealValue || 0,
            accountManager: item.accountManager || currentUser,
            billingAddress: item.billingAddress || '',
            shippingAddress: '',
            internalNotes: `[MIGRATION ${now.slice(0, 10)}]: Imported via Biscuit CRM CSV Onboarding Wizard.`,
            synced: false,
            updatedAt: now,
          };

          const id = await db.contacts.add(contactPayload);

          await db.outbox.add({
            type: 'INSERT',
            table: 'contacts',
            payload: { ...contactPayload, id },
            timestamp: Date.now(),
          });

          importedCount++;
        }

        setImportSummary(`Successfully imported ${importedCount} customer/lead accounts into the pipeline.`);
        setParsedContacts([]);
      } else {
        let importedStaffCount = 0;

        for (const item of parsedStaff) {
          const staffPayload: EmployeeProfile = {
            name: item.name || 'Staff Member',
            role: item.role || 'Specialist',
            department: item.department || 'Sales',
            tier: item.tier || 'Staff',
            status: 'Active',
            xp: item.xp || 200,
            level: item.level || 2,
            dealsClosed: 0,
            handoverActive: false,
          };

          await db.employees.add(staffPayload);
          importedStaffCount++;
        }

        setImportSummary(`Successfully enrolled ${importedStaffCount} personnel into the organization directory.`);
        setParsedStaff([]);
      }

      setFileName('');
      setFileContent('');
      onImportComplete();
    } catch (err: any) {
      alert(`Import failed: ${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <section className="space-y-6 mb-8">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Upload className="w-5 h-5" />
            </span>
            <h2 className="font-bold text-slate-100 text-base">New Business Onboarding & CRM Migration Desk</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Migrate from HubSpot, Salesforce, Pipedrive, or Excel. 100% Client-Side Ingestion &bull; Zero Server Storage &bull; Instant Drive Sync
          </p>
        </div>

        <button
          onClick={handleDownloadTemplate}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
        >
          <Download className="w-3.5 h-3.5 text-amber-400" /> Download Sample CSV Template
        </button>
      </div>

      {/* Migration Track Selector */}
      <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
        <button
          onClick={() => {
            setActiveTrack('contacts');
            setParsedContacts([]);
            setParsedStaff([]);
            setFileName('');
          }}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition ${
            activeTrack === 'contacts' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" /> 1. Upload Customers & Leads (Pipeline Data)
        </button>
        <button
          onClick={() => {
            setActiveTrack('staff');
            setParsedContacts([]);
            setParsedStaff([]);
            setFileName('');
          }}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition ${
            activeTrack === 'staff' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" /> 2. Upload Staff Roster & Hierarchy (Org Structure)
        </button>
      </div>

      {/* Drag & Drop File Upload Area */}
      <div className="p-8 border-2 border-dashed border-slate-800 hover:border-amber-500/60 rounded-2xl bg-slate-900/40 text-center transition flex flex-col items-center justify-center space-y-3">
        <div className="p-4 rounded-full bg-slate-950 border border-slate-800 text-amber-400">
          <Upload className="w-6 h-6" />
        </div>
        <div>
          <h4 className="font-semibold text-slate-200 text-sm">
            {fileName ? `Loaded: ${fileName}` : `Choose your ${activeTrack === 'contacts' ? 'Customer / Lead' : 'Staff Roster'} CSV`}
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">UTF-8 Encoded CSV or export file from any external CRM</p>
        </div>

        <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition shadow">
          <span>Select CSV File</span>
          <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
        </label>
      </div>

      {/* Import Result Notification */}
      {importSummary && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2 font-mono">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{importSummary}</span>
        </div>
      )}

      {/* Parser Warnings / Errors */}
      {parseErrors.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 space-y-1">
          <div className="font-bold flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> Parser Warnings ({parseErrors.length})</div>
          <ul className="list-disc pl-5 font-mono text-[11px] space-y-0.5 max-h-24 overflow-y-auto">
            {parseErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview Table: Customers */}
      {activeTrack === 'contacts' && parsedContacts.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-100 text-sm">Preview: {parsedContacts.length} Customer Records Detected</h4>
              <p className="text-xs text-slate-400 mt-0.5">Verify column alignments before saving to local database and Drive</p>
            </div>
            <button
              onClick={handleCommitImport}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Commit & Ingest {parsedContacts.length} Accounts
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2">Company</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Phone</th>
                  <th className="px-4 py-2">Stage</th>
                  <th className="px-4 py-2">CRN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {parsedContacts.slice(0, 20).map((c, i) => (
                  <tr key={i} className="hover:bg-slate-800/20">
                    <td className="px-4 py-2 font-semibold text-slate-100">{c.name}</td>
                    <td className="px-4 py-2">{c.company || '—'}</td>
                    <td className="px-4 py-2 text-slate-400">{c.email}</td>
                    <td className="px-4 py-2 font-mono text-sky-400">{c.phone || '—'}</td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-amber-300 border border-slate-700">
                        {c.stage}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-slate-400">{c.crn || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsedContacts.length > 20 && (
            <p className="text-[11px] text-slate-500 text-center font-mono">+ {parsedContacts.length - 20} more rows ready for batch import</p>
          )}
        </div>
      )}

      {/* Preview Table: Staff Roster */}
      {activeTrack === 'staff' && parsedStaff.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-100 text-sm">Preview: {parsedStaff.length} Staff Profiles Detected</h4>
              <p className="text-xs text-slate-400 mt-0.5">Staff calibrate automatically on the 10-level ladder; Leaders on the 5-level ladder</p>
            </div>
            <button
              onClick={handleCommitImport}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Enroll {parsedStaff.length} Team Members
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-2">Staff Member</th>
                  <th className="px-4 py-2">Job Title</th>
                  <th className="px-4 py-2">Department</th>
                  <th className="px-4 py-2">Tier</th>
                  <th className="px-4 py-2">Initial Rank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {parsedStaff.map((s, i) => (
                  <tr key={i} className="hover:bg-slate-800/20">
                    <td className="px-4 py-2 font-semibold text-slate-100">{s.name}</td>
                    <td className="px-4 py-2 text-slate-300">{s.role}</td>
                    <td className="px-4 py-2 font-medium text-indigo-400">{s.department}</td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                        {s.tier}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-amber-400 font-bold">
                      Lv.{s.level} ({s.tier === 'Staff' ? '10-Lvl System' : '5-Lvl System'})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
