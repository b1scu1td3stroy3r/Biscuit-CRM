'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  db, 
  ITTicket, 
  ITTicketStatus, 
  ITTicketPriority, 
  ITTicketCategory, 
  EmployeeProfile,
  DepartmentRole,
  IndustryModulesConfig,
  IndustryVertical
} from '../packages/storage/src/db';
import { 
  LifeBuoy, 
  Plus, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  FileText, 
  Download, 
  Calendar, 
  ShieldCheck, 
  UserCheck, 
  ArrowRight,
  TrendingUp,
  BarChart3,
  RefreshCw,
  X
} from 'lucide-react';

interface ITHelpdeskProps {
  currentProfile: EmployeeProfile | null;
  onAwardXP?: (amount: number, reason: string) => void;
}

type AuditHorizon = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'ytd';

export default function ITHelpdesk({ currentProfile, onAwardXP }: ITHelpdeskProps) {
  const [activeTab, setActiveTab] = useState<'kanban' | 'audits' | 'governance'>('kanban');
  const [industryConfig, setIndustryConfig] = useState<IndustryModulesConfig>({
    industry: 'general',
    enableMhraCompliance: false,
    enableFcaCompliance: false,
    enableOfqualCompliance: false,
    enableCreativeSignoffs: false,
    enableGiftAid: false,
    updatedAt: new Date().toISOString(),
    configuredBy: currentProfile?.name || 'IT Administrator'
  });
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    async function loadIndustryConfig() {
      try {
        const setting = await db.settings.get('biscuit_industry_modules');
        if (setting?.value) {
          setIndustryConfig(setting.value as IndustryModulesConfig);
        }
      } catch (err) {
        console.error('Failed to load industry config:', err);
      }
    }
    loadIndustryConfig();
  }, []);
  const [tickets, setTickets] = useState<ITTicket[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [auditHorizon, setAuditHorizon] = useState<AuditHorizon>('monthly');

  // Modals / Drawers
  const [selectedTicket, setSelectedTicket] = useState<ITTicket | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);

  // New Ticket Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCat, setNewCat] = useState<ITTicketCategory>('Hardware');
  const [newPriority, setNewPriority] = useState<ITTicketPriority>('P3-Medium');
  const [newReqName, setNewReqName] = useState('');
  const [newReqEmail, setNewReqEmail] = useState('');
  const [newReqDept, setNewReqDept] = useState<DepartmentRole>('Sales');

  const loadData = async () => {
    const [allTickets, allEmps] = await Promise.all([
      db.itTickets.toArray(),
      db.employees.toArray()
    ]);
    setTickets(allTickets);
    setEmployees(allEmps);
  };

  useEffect(() => {
    loadData();
  }, []);

  const itStaff = useMemo(() => {
    return employees.filter(e => e.department === 'IT' || e.role?.toLowerCase().includes('it') || e.clearanceLevel === 5);
  }, [employees]);

  // Handle Quick Claim
  const handleClaimTicket = async (ticket: ITTicket) => {
    if (!currentProfile) return;
    const now = new Date().toISOString();
    const updatedHistory = [
      ...(ticket.history || []),
      {
        timestamp: now,
        actor: currentProfile.name || 'IT Technician',
        action: 'Claimed Ticket',
        details: `Assigned to ${currentProfile.name}`
      }
    ];

    const updated: ITTicket = {
      ...ticket,
      assignedTechId: currentProfile.id,
      assignedTechName: currentProfile.name,
      status: ticket.status === 'Triage' ? 'In Progress' : ticket.status,
      history: updatedHistory,
      updatedAt: now
    };

    await db.itTickets.put(updated);
    if (onAwardXP) onAwardXP(15, `Claimed IT Ticket #${ticket.ticketNumber}`);
    await loadData();
    if (selectedTicket?.id === ticket.id) setSelectedTicket(updated);
  };

  // Handle Stage Advancement
  const handleUpdateStatus = async (ticket: ITTicket, nextStatus: ITTicketStatus) => {
    const now = new Date().toISOString();
    const isResolving = nextStatus === 'Resolved' || nextStatus === 'Closed';
    
    // SLA check
    const createdTime = new Date(ticket.createdAt).getTime();
    const diffHours = (new Date(now).getTime() - createdTime) / (1000 * 60 * 60);
    const slaBreached = diffHours > ticket.targetResolutionHours;

    const updatedHistory = [
      ...(ticket.history || []),
      {
        timestamp: now,
        actor: currentProfile?.name || 'IT Staff',
        action: `Moved status to ${nextStatus}`,
        details: isResolving && resolutionNotes ? `Resolution: ${resolutionNotes}` : undefined
      }
    ];

    const updated: ITTicket = {
      ...ticket,
      status: nextStatus,
      resolutionNotes: isResolving && resolutionNotes ? resolutionNotes : ticket.resolutionNotes,
      resolvedAt: isResolving ? (ticket.resolvedAt || now) : ticket.resolvedAt,
      closedAt: nextStatus === 'Closed' ? now : ticket.closedAt,
      slaBreached: isResolving ? slaBreached : ticket.slaBreached,
      history: updatedHistory,
      updatedAt: now
    };

    await db.itTickets.put(updated);
    if (isResolving && onAwardXP) {
      onAwardXP(30, `Resolved IT Ticket #${ticket.ticketNumber}`);
    }
    setResolutionNotes('');
    await loadData();
    if (selectedTicket?.id === ticket.id) setSelectedTicket(updated);
  };

  // Create Ticket Directly
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const count = await db.itTickets.count();
    const ticketNumber = `IT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    const now = new Date().toISOString();

    const targetHoursMap: Record<ITTicketPriority, number> = {
      'P1-Critical': 4,
      'P2-High': 12,
      'P3-Medium': 48,
      'P4-Low': 96
    };

    const newTicket: ITTicket = {
      ticketNumber,
      title: newTitle,
      description: newDesc,
      category: newCat,
      priority: newPriority,
      status: 'Triage',
      requesterName: newReqName || currentProfile?.name || 'Authorized Staff',
      requesterEmail: newReqEmail || currentProfile?.email || 'staff@internal.corp',
      requesterDepartment: newReqDept,
      targetResolutionHours: targetHoursMap[newPriority],
      history: [
        {
          timestamp: now,
          actor: currentProfile?.name || 'System Intake',
          action: 'Ticket Created',
          details: `Logged under ${newCat} [${newPriority}]`
        }
      ],
      createdAt: now,
      updatedAt: now
    };

    await db.itTickets.add(newTicket);
    if (onAwardXP) onAwardXP(20, `Logged IT Incident ${ticketNumber}`);

    // Reset Form
    setNewTitle('');
    setNewDesc('');
    setIsNewTicketModalOpen(false);
    await loadData();
  };

  // Filtered Kanban Pipeline
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchesSearch = 
        t.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.requesterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.assignedTechName && t.assignedTechName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCat = selectedCategory === 'all' || t.category === selectedCategory;
      const matchesPri = selectedPriority === 'all' || t.priority === selectedPriority;

      return matchesSearch && matchesCat && matchesPri;
    });
  }, [tickets, searchQuery, selectedCategory, selectedPriority]);

  // Multi-Horizon Audit Filtering
  const auditedTickets = useMemo(() => {
    const now = new Date();
    return tickets.filter(t => {
      const ticketDate = new Date(t.createdAt);
      if (auditHorizon === 'daily') {
        return ticketDate.toDateString() === now.toDateString();
      }
      if (auditHorizon === 'weekly') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return ticketDate >= weekAgo;
      }
      if (auditHorizon === 'monthly') {
        return ticketDate.getMonth() === now.getMonth() && ticketDate.getFullYear() === now.getFullYear();
      }
      if (auditHorizon === 'quarterly') {
        const curQuarter = Math.floor(now.getMonth() / 3);
        const ticketQuarter = Math.floor(ticketDate.getMonth() / 3);
        return curQuarter === ticketQuarter && ticketDate.getFullYear() === now.getFullYear();
      }
      if (auditHorizon === 'yearly') {
        return ticketDate.getFullYear() === now.getFullYear();
      }
      if (auditHorizon === 'ytd') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return ticketDate >= startOfYear && ticketDate <= now;
      }
      return true;
    });
  }, [tickets, auditHorizon]);

  // Metrics Calculation
  const auditMetrics = useMemo(() => {
    const total = auditedTickets.length;
    const resolved = auditedTickets.filter(t => t.status === 'Resolved' || t.status === 'Closed');
    const breached = auditedTickets.filter(t => t.slaBreached);
    
    // Mean Time to Resolution (MTTR)
    let totalResolveHours = 0;
    resolved.forEach(t => {
      if (t.resolvedAt) {
        const hours = (new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60);
        totalResolveHours += Math.max(0, hours);
      }
    });
    const mttr = resolved.length > 0 ? (totalResolveHours / resolved.length).toFixed(1) : '0.0';
    const slaCompliance = total > 0 ? (((total - breached.length) / total) * 100).toFixed(1) : '100.0';

    return { total, resolvedCount: resolved.length, breachedCount: breached.length, mttr, slaCompliance };
  }, [auditedTickets]);

  // Export Audit CSV
  const exportAuditCSV = () => {
    const headers = ['Ticket Number', 'Title', 'Category', 'Priority', 'Status', 'Requester', 'Dept', 'Technician', 'Created At', 'Resolved At', 'SLA Breached'];
    const rows = auditedTickets.map(t => [
      `"${t.ticketNumber}"`,
      `"${t.title.replace(/"/g, '""')}"`,
      `"${t.category}"`,
      `"${t.priority}"`,
      `"${t.status}"`,
      `"${t.requesterName}"`,
      `"${t.requesterDepartment}"`,
      `"${t.assignedTechName || 'Unassigned'}"`,
      `"${t.createdAt}"`,
      `"${t.resolvedAt || '—'}"`,
      `"${t.slaBreached ? 'YES' : 'NO'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `IT_Audit_Report_${auditHorizon.toUpperCase()}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPriorityBadge = (pri: ITTicketPriority) => {
    switch (pri) {
      case 'P1-Critical':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> P1 Critical</span>;
      case 'P2-High':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">P2 High</span>;
      case 'P3-Medium':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/20 text-sky-400 border border-sky-500/30">P3 Medium</span>;
      case 'P4-Low':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">P4 Low</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Sub-Nav */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <LifeBuoy className="w-5 h-5 text-indigo-400" />
            IT Operations & Incident Helpdesk
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Enterprise incident triage, technician Kanban pipeline, and compliance SLA audit reporting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('kanban')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${activeTab === 'kanban' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <LifeBuoy className="w-3.5 h-3.5" /> Technician Pipeline
            </button>
            <button
              onClick={() => setActiveTab('audits')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${activeTab === 'audits' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Multi-Horizon Audits
            </button>
            <button
              onClick={() => setActiveTab('governance')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${activeTab === 'governance' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Statutory Governance
            </button>
          </div>

          <button
            onClick={() => setIsNewTicketModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Log Incident
          </button>
        </div>
      </div>

      {/* TAB 1: KANBAN PIPELINE */}
      {activeTab === 'kanban' && (
        <div className="space-y-5">
          {/* Quick Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search ticket #, issue description, requester, technician..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Categories</option>
              <option value="Hardware">Hardware</option>
              <option value="Software">Software</option>
              <option value="Network">Network</option>
              <option value="Access/RBAC">Access / RBAC</option>
              <option value="Workstation">Workstation</option>
              <option value="Security">Security</option>
            </select>

            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Priorities</option>
              <option value="P1-Critical">P1 Critical</option>
              <option value="P2-High">P2 High</option>
              <option value="P3-Medium">P3 Medium</option>
              <option value="P4-Low">P4 Low</option>
            </select>

            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('all'); setSelectedPriority('all'); }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Reset Filters"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 4-Stage Kanban Columns */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {(['Triage', 'In Progress', 'Waiting on User', 'Resolved'] as ITTicketStatus[]).map((stage) => {
              const stageTickets = filteredTickets.filter(t => t.status === stage);

              const stageColors: Record<ITTicketStatus, { border: string; badge: string }> = {
                'Triage': { border: 'border-amber-500/30', badge: 'bg-amber-500/20 text-amber-300' },
                'In Progress': { border: 'border-sky-500/30', badge: 'bg-sky-500/20 text-sky-300' },
                'Waiting on User': { border: 'border-purple-500/30', badge: 'bg-purple-500/20 text-purple-300' },
                'Resolved': { border: 'border-emerald-500/30', badge: 'bg-emerald-500/20 text-emerald-300' },
                'Closed': { border: 'border-slate-700', badge: 'bg-slate-800 text-slate-400' }
              };

              return (
                <div key={stage} className={`bg-slate-900/70 border ${stageColors[stage].border} rounded-2xl p-4 flex flex-col h-[700px]`}>
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-200 tracking-wide uppercase">{stage}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${stageColors[stage].badge}`}>
                        {stageTickets.length}
                      </span>
                    </div>
                  </div>

                  {/* Card List */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {stageTickets.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTicket(t)}
                        className="bg-slate-950 border border-slate-800/90 hover:border-indigo-500/60 p-3.5 rounded-xl cursor-pointer transition shadow-md hover:shadow-indigo-500/10 space-y-2.5 group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-slate-400">{t.ticketNumber}</span>
                          {getPriorityBadge(t.priority)}
                        </div>

                        <h4 className="text-xs font-bold text-slate-100 group-hover:text-indigo-300 transition line-clamp-2">
                          {t.title}
                        </h4>

                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="truncate">{t.requesterName}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-900 border border-slate-800 font-mono">
                            {t.category}
                          </span>
                        </div>

                        {/* Card Footer: Tech & Quick Actions */}
                        <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[10px]">
                          <span className="text-slate-500 flex items-center gap-1 font-mono">
                            <UserCheck className="w-3 h-3 text-slate-400" />
                            {t.assignedTechName || 'Unassigned'}
                          </span>

                          {!t.assignedTechName && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleClaimTicket(t); }}
                              className="px-2 py-0.5 rounded bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white font-semibold transition"
                            >
                              Claim
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {stageTickets.length === 0 && (
                      <div className="h-40 flex items-center justify-center text-slate-600 text-xs italic">
                        No tickets in this stage
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: MULTI-HORIZON AUDITS & REPORTING */}
      {activeTab === 'audits' && (
        <div className="space-y-6">
          {/* Horizon Selection Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              {(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'ytd'] as AuditHorizon[]).map((hz) => (
                <button
                  key={hz}
                  onClick={() => setAuditHorizon(hz)}
                  className={`px-3 py-1.5 rounded-lg capitalize font-semibold transition ${auditHorizon === hz ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {hz === 'ytd' ? 'Year to Date' : hz}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={exportAuditCSV}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition border border-slate-700 shadow"
              >
                <Download className="w-3.5 h-3.5" /> Export Audit CSV
              </button>
            </div>
          </div>

          {/* Metric KPI Widgets */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Volume Logged</span>
              <div className="text-2xl font-black text-white">{auditMetrics.total}</div>
              <p className="text-[10px] text-slate-500">Tickets received in {auditHorizon.toUpperCase()}</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Resolved Tickets</span>
              <div className="text-2xl font-black text-emerald-400">{auditMetrics.resolvedCount}</div>
              <p className="text-[10px] text-slate-500">Successfully closed out</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">SLA Compliance Rate</span>
              <div className="text-2xl font-black text-indigo-400">{auditMetrics.slaCompliance}%</div>
              <p className="text-[10px] text-slate-500">{auditMetrics.breachedCount} SLA breaches flagged</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Mean Time to Resolve (MTTR)</span>
              <div className="text-2xl font-black text-amber-400">{auditMetrics.mttr} hrs</div>
              <p className="text-[10px] text-slate-500">Average resolution latency</p>
            </div>
          </div>

          {/* Detailed Audit Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Statutory & Compliance Ticket Audit Trail ({auditedTickets.length})
              </h3>
              <span className="text-xs text-slate-400 font-mono">Horizon: {auditHorizon.toUpperCase()}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Ticket</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Requester</th>
                    <th className="py-3 px-4">Technician</th>
                    <th className="py-3 px-4">Logged At</th>
                    <th className="py-3 px-4">Resolved At</th>
                    <th className="py-3 px-4 text-center">SLA Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
                  {auditedTickets.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-bold text-slate-200">{t.ticketNumber}</td>
                      <td className="py-3 px-4 font-sans text-slate-300">{t.category}</td>
                      <td className="py-3 px-4">{getPriorityBadge(t.priority)}</td>
                      <td className="py-3 px-4 font-sans text-slate-300">
                        {t.requesterName} <span className="text-[10px] text-slate-500">({t.requesterDepartment})</span>
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-300">{t.assignedTechName || '—'}</td>
                      <td className="py-3 px-4 text-slate-400">{t.createdAt.slice(0, 16).replace('T', ' ')}</td>
                      <td className="py-3 px-4 text-slate-400">{t.resolvedAt ? t.resolvedAt.slice(0, 16).replace('T', ' ') : '—'}</td>
                      <td className="py-3 px-4 text-center">
                        {t.slaBreached ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            BREACHED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            IN SLA
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        <button
                          onClick={() => setSelectedTicket(t)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px] transition"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                  {auditedTickets.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500 font-sans italic">
                        No tickets recorded within the selected {auditHorizon} timeframe.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STATUTORY GOVERNANCE & SECTOR POLICIES */}
      {activeTab === 'governance' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                  Statutory Industry Scoping & Regulatory Policies
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Activate sector-specific compliance rules, statutory audit workflows, and specialized account profiles.
                </p>
              </div>
              <button
                onClick={async () => {
                  try {
                    await db.settings.put({
                      key: 'biscuit_industry_modules',
                      value: industryConfig,
                      updatedAt: new Date().toISOString()
                    });
                    setSaveStatus('Industry policies saved successfully.');
                    setTimeout(() => setSaveStatus(null), 3500);
                  } catch (e: any) {
                    setSaveStatus(`Failed to save: ${e?.message || 'Unknown error'}`);
                  }
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 transition flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Save Governance Config
              </button>
            </div>

            {saveStatus && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl font-medium">
                {saveStatus}
              </div>
            )}

            {/* Vertical Selector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <label className="text-xs font-bold text-slate-200 block">Primary Enterprise Vertical</label>
                <select
                  value={industryConfig.industry}
                  onChange={(e) => setIndustryConfig({ ...industryConfig, industry: e.target.value as any })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="general">Standard Commercial B2B / General Enterprise</option>
                  <option value="construction">Construction & Building Contracting (CIS Regulated)</option>
                  <option value="insurance">Insurance Underwriting, Broking & Policy Schedules</option>
                  <option value="veterinary">Veterinary Surgery & Animal Care Practice</option>
                  <option value="museums_sports">Museums, Heritage Galleries & Sports Clubs</option>
                  <option value="pharma_healthcare">Pharmaceutical, MHRA & Healthcare Supply</option>
                  <option value="financial_services">Financial Services, FCA Audited & Credit</option>
                  <option value="charity_nonprofit">Charity, Foundation & Non-Profit (Gift Aid)</option>
                  <option value="design_agency">Creative, Digital & Design Agency</option>
                  <option value="education_provider">Education, Training & Ofqual Provider</option>
                </select>
                <p className="text-[11px] text-slate-500">
                  Select your primary sector to configure default workflow templates and account validation schemes.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <span className="text-xs font-bold text-slate-200 block">Compliance Audit Stamp</span>
                <p className="text-[11px] text-slate-400">
                  Last Updated: <span className="font-mono text-slate-300">{industryConfig.updatedAt.slice(0, 16).replace('T', ' ')}</span>
                </p>
                <p className="text-[11px] text-slate-400">
                  Configured By: <span className="text-indigo-400 font-semibold">{industryConfig.configuredBy || 'IT Lead'}</span>
                </p>
                <p className="text-[11px] text-slate-500 pt-1">
                  Changes made here take immediate effect for all users across customer services, sales, and billing desks.
                </p>
              </div>
            </div>

            {/* Statutory Compliance Feature Toggles */}
            <div className="pt-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Sector Compliance Modules & Rules</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Construction CIS */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">Construction Industry Scheme (CIS)</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Enforce HMRC CIS tax deduction rates (20% standard / 30% unverified) and monthly subcontractor returns on billing.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!industryConfig.enableCisTax}
                    onChange={(e) => setIndustryConfig({ ...industryConfig, enableCisTax: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 mt-1 cursor-pointer"
                  />
                </div>

                {/* Veterinary Clinical Records */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">Veterinary Patient Records</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Enable pet/animal clinical profiles with microchip numbers, breed registries, and vaccination schedule tracking.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!industryConfig.enableVeterinaryRecords}
                    onChange={(e) => setIndustryConfig({ ...industryConfig, enableVeterinaryRecords: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 mt-1 cursor-pointer"
                  />
                </div>

                {/* Insurance Policy Schedules */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">Insurance Underwriting & Policy Schedules</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Activate policy schedules, premium payment horizons, underwriting notes, and automated annual renewal notices.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!industryConfig.enableInsuranceSchedules}
                    onChange={(e) => setIndustryConfig({ ...industryConfig, enableInsuranceSchedules: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 mt-1 cursor-pointer"
                  />
                </div>

                {/* Museums & Sports Clubs */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">Museums & Sports Memberships</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Enable season tickets, member tier perks, recurring patron renewal badges, and gift-aid entry passes.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!industryConfig.enableSportsMuseumMemberships}
                    onChange={(e) => setIndustryConfig({ ...industryConfig, enableSportsMuseumMemberships: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 mt-1 cursor-pointer"
                  />
                </div>

                {/* Pharma MHRA */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">Pharma MHRA & Cold-Chain Audit</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Batch tracking, temperature-controlled release checks, and certified QP sign-off gates.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={industryConfig.enableMhraCompliance}
                    onChange={(e) => setIndustryConfig({ ...industryConfig, enableMhraCompliance: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 mt-1 cursor-pointer"
                  />
                </div>

                {/* Charity Gift Aid */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">Charity & Non-Profit Gift Aid (25%)</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Enable donor declaration logs, HMRC 25% reclaim batch exports, and eligible gift auditing.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={industryConfig.enableGiftAid}
                    onChange={(e) => setIndustryConfig({ ...industryConfig, enableGiftAid: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 mt-1 cursor-pointer"
                  />
                </div>

                {/* Creative Agency Signoffs */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">Design Agency Multi-Stage Sign-Off</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Client milestone approval checklists, proofing feedback cycles, and copyright handover deeds.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={industryConfig.enableCreativeSignoffs}
                    onChange={(e) => setIndustryConfig({ ...industryConfig, enableCreativeSignoffs: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 mt-1 cursor-pointer"
                  />
                </div>

                {/* Financial Services FCA */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">FCA Suitability & Insolvency Checks</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Mandatory credit risk grading, AML verifications, and regulatory capital compliance logging.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={industryConfig.enableFcaCompliance}
                    onChange={(e) => setIndustryConfig({ ...industryConfig, enableFcaCompliance: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 mt-1 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Details & Resolution Drawer */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-end p-0">
          <div className="bg-slate-900 border-l border-slate-800 h-full w-full max-w-xl p-6 shadow-2xl flex flex-col justify-between overflow-y-auto">
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <span className="text-xs font-mono font-bold text-indigo-400">{selectedTicket.ticketNumber}</span>
                  <h3 className="text-lg font-bold text-slate-100 mt-0.5">{selectedTicket.title}</h3>
                </div>
                <button onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-white p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status & Assignment Pills */}
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 block mb-0.5">Status</span>
                  <span className="font-bold text-slate-200">{selectedTicket.status}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">Priority</span>
                  <div>{getPriorityBadge(selectedTicket.priority)}</div>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">Assigned Technician</span>
                  <span className="font-bold text-slate-200">{selectedTicket.assignedTechName || 'Unassigned'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">Target SLA</span>
                  <span className="font-mono text-slate-300">{selectedTicket.targetResolutionHours} hours</span>
                </div>
              </div>

              {/* Requester Info */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs space-y-1">
                <span className="text-slate-400 font-semibold block">Requester Information:</span>
                <p className="text-slate-200 font-bold">{selectedTicket.requesterName} &bull; <span className="font-mono text-slate-400">{selectedTicket.requesterEmail}</span></p>
                <p className="text-slate-500">Department: {selectedTicket.requesterDepartment}</p>
              </div>

              {/* Problem Description */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-400">Incident Details:</span>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {selectedTicket.description}
                </div>
              </div>

              {/* Resolution Notes Input */}
              {selectedTicket.status !== 'Resolved' && selectedTicket.status !== 'Closed' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Technician Resolution Notes:</label>
                  <textarea
                    rows={3}
                    placeholder="Document root cause, diagnostic tests, hardware swaps, or fix deployed..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {/* Past Audit Logs */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" /> Lifecycle Audit History
                </span>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {(selectedTicket.history || []).map((h, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-950/70 border border-slate-800/60 rounded-lg text-[11px] space-y-0.5">
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="font-bold text-slate-300">{h.action}</span>
                        <span className="font-mono text-[10px] text-slate-500">{h.timestamp.slice(0, 16).replace('T', ' ')}</span>
                      </div>
                      <p className="text-slate-400">Actor: <span className="text-slate-300">{h.actor}</span></p>
                      {h.details && <p className="text-slate-500 italic mt-0.5">{h.details}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pipeline Stage Movement Actions */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Close Drawer
              </button>

              <div className="flex items-center gap-2">
                {selectedTicket.status === 'Triage' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedTicket, 'In Progress')}
                    className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow"
                  >
                    Start Investigation <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {selectedTicket.status === 'In Progress' && (
                  <>
                    <button
                      onClick={() => handleUpdateStatus(selectedTicket, 'Waiting on User')}
                      className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow"
                    >
                      Wait on User/Vendor
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedTicket, 'Resolved')}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Mark Resolved
                    </button>
                  </>
                )}

                {selectedTicket.status === 'Waiting on User' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedTicket, 'In Progress')}
                    className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow"
                  >
                    Resume Investigation
                  </button>
                )}

                {selectedTicket.status === 'Resolved' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedTicket, 'Closed')}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs shadow"
                  >
                    Archive & Close
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Ticket Modal */}
      {isNewTicketModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2">
              <LifeBuoy className="w-4 h-4 text-emerald-400" /> Log Incident / IT Work Order
            </h3>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Issue Summary / Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dual monitor HDMI docking failure or VPN handshake timeout"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Category</label>
                  <select
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value as ITTicketCategory)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Hardware">Hardware</option>
                    <option value="Software">Software</option>
                    <option value="Network">Network</option>
                    <option value="Access/RBAC">Access / RBAC</option>
                    <option value="Workstation">Workstation</option>
                    <option value="Security">Security</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as ITTicketPriority)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="P1-Critical">P1 Critical (4h SLA)</option>
                    <option value="P2-High">P2 High (12h SLA)</option>
                    <option value="P3-Medium">P3 Medium (48h SLA)</option>
                    <option value="P4-Low">P4 Low (96h SLA)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Requester Name</label>
                  <input
                    type="text"
                    placeholder="Staff Name"
                    value={newReqName}
                    onChange={(e) => setNewReqName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Requester Email</label>
                  <input
                    type="email"
                    placeholder="user@corp.internal"
                    value={newReqEmail}
                    onChange={(e) => setNewReqEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Department</label>
                  <select
                    value={newReqDept}
                    onChange={(e) => setNewReqDept(e.target.value as DepartmentRole)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Sales">Sales</option>
                    <option value="Finance">Finance</option>
                    <option value="Operations">Operations</option>
                    <option value="Customer Services">Customer Services</option>
                    <option value="Procurement">Procurement</option>
                    <option value="IT">IT</option>
                    <option value="MD">Executive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Diagnostic Details & Steps to Reproduce</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detail error codes, machine asset tags, network SSID, or software version..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewTicketModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition"
                >
                  Dispatch to IT Pipeline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
