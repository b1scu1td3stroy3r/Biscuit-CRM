'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  db, 
  TeamKPI, 
  KPIHorizon, 
  KPIMetric, 
  EmployeeProfile, 
  DepartmentRole 
} from '../packages/storage/src/db';
import { 
  Target, 
  Users, 
  User, 
  Plus, 
  TrendingUp, 
  Calendar, 
  CheckCircle2, 
  Award, 
  BarChart, 
  Clock, 
  Trash2,
  X
} from 'lucide-react';

interface ManagementHubProps {
  currentProfile: EmployeeProfile | null;
  onAwardXP?: (amount: number, reason: string) => void;
}

export default function ManagementHub({
  currentProfile,
  onAwardXP
}: ManagementHubProps) {
  const isMD = currentProfile?.clearanceLevel === 5 || (currentProfile?.role && currentProfile.role.toLowerCase().includes('director')) || (currentProfile?.department === 'MD');
  const [selectedDept, setSelectedDept] = useState<string>(currentProfile?.department || 'Sales');
  const [targetTeam, setTargetTeam] = useState<string>('All Teams');
  const [kpis, setKpis] = useState<TeamKPI[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [activeHorizon, setActiveHorizon] = useState<KPIHorizon>('Daily');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [targetScope, setTargetScope] = useState<'Team' | 'Individual'>('Team');
  const [targetEmployeeId, setTargetEmployeeId] = useState<number | undefined>(undefined);
  const [metric, setMetric] = useState<KPIMetric>('deals_closed');
  const [targetValue, setTargetValue] = useState<number>(5);
  const [unit, setUnit] = useState<string>('deals');
  const [notes, setNotes] = useState('');

  // Performance Tracking Counters
  const [achievements, setAchievements] = useState<Record<string, number>>({});

  const loadData = async () => {
    const [allKpis, allEmps, allContacts, allCalls, allTickets] = await Promise.all([
      db.teamKpis.toArray(),
      db.employees.toArray(),
      db.contacts.toArray(),
      db.callLogs.toArray(),
      db.itTickets.toArray()
    ]);

    setKpis(allKpis);
    setEmployees(allEmps);

    // Compute achievements
    const dealsClosed = allContacts.filter(c => c.stage === 'Customer Service' || c.stage === 'Logistics').length;
    const callsMade = allCalls.length;
    const ticketsResolved = allTickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length;

    setAchievements({
      deals_closed: dealsClosed,
      calls_logged: callsMade,
      tickets_resolved: ticketsResolved,
      revenue_booked: dealsClosed * 1250 // synthetic average deal metric
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter Subordinates
  const directReports = useMemo(() => {
    if (!currentProfile) return [];
    if (currentProfile.clearanceLevel === 5 || currentProfile.role === 'Managing Director') {
      return employees.filter(e => e.id !== currentProfile.id);
    }
    return employees.filter(e => e.primaryManagerId === currentProfile.id || e.department === currentProfile.department);
  }, [employees, currentProfile]);

  const handleCreateKPI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !currentProfile) return;

    const now = new Date();
    const startDate = now.toISOString();
    const end = new Date();
    if (activeHorizon === 'Daily') end.setDate(end.getDate() + 1);
    if (activeHorizon === 'Weekly') end.setDate(end.getDate() + 7);
    if (activeHorizon === 'Monthly') end.setMonth(end.getMonth() + 1);

    const targetEmp = employees.find(e => e.id === Number(targetEmployeeId));

    const newKpi: TeamKPI = {
      managerId: currentProfile.id || 1,
      managerName: currentProfile.name || 'Supervisor',
      targetScope,
      targetEmployeeId: targetScope === 'Individual' ? Number(targetEmployeeId) : undefined,
      targetEmployeeName: targetScope === 'Individual' ? targetEmp?.name : undefined,
      department: currentProfile.department || 'Sales',
      horizon: activeHorizon,
      metric,
      title,
      targetValue: Number(targetValue),
      unit,
      startDate,
      endDate: end.toISOString(),
      createdAt: startDate,
      notes
    };

    await db.teamKpis.add(newKpi);
    if (onAwardXP) onAwardXP(25, `Established ${activeHorizon} KPI for ${targetScope}`);

    setTitle('');
    setIsModalOpen(false);
    await loadData();
  };

  const handleDeleteKPI = async (id?: number) => {
    if (!id) return;
    await db.teamKpis.delete(id);
    await loadData();
  };

  const filteredKpis = useMemo(() => {
    return kpis.filter(k => k.horizon === activeHorizon);
  }, [kpis, activeHorizon]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <Target className="w-5 h-5 text-amber-400" />
            Supervisor Command & Team Performance Hub
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Establish team and individual quotas across Daily, Weekly, and Monthly operational horizons.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            {(['Daily', 'Weekly', 'Monthly'] as KPIHorizon[]).map((hz) => (
              <button
                key={hz}
                onClick={() => setActiveHorizon(hz)}
                className={`px-3.5 py-1.5 rounded-lg transition ${activeHorizon === hz ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {hz} Targets
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Define KPI Target
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {filteredKpis.map((kpi) => {
          const current = achievements[kpi.metric] || 0;
          const percentage = Math.min(100, Math.round((current / kpi.targetValue) * 100));
          const isComplete = percentage >= 100;

          return (
            <div key={kpi.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300 uppercase tracking-wide">
                    {kpi.targetScope}: {kpi.targetScope === 'Individual' ? kpi.targetEmployeeName : kpi.department}
                  </span>
                  <button onClick={() => handleDeleteKPI(kpi.id)} className="text-slate-500 hover:text-rose-400 transition">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <h3 className="text-sm font-bold text-slate-100">{kpi.title}</h3>
                {kpi.notes && <p className="text-xs text-slate-400 line-clamp-2">{kpi.notes}</p>}
              </div>

              {/* Progress Bar & Numerical Target */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Current Pacing</span>
                  <span className="font-mono font-bold text-slate-200">
                    {current} / {kpi.targetValue} {kpi.unit} ({percentage}%)
                  </span>
                </div>

                <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-500 ${isComplete ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500 font-mono">
                  <span>Horizon: {kpi.horizon}</span>
                  <span>Supervisor: {kpi.managerName}</span>
                </div>
              </div>
            </div>
          );
        })}

        {filteredKpis.length === 0 && (
          <div className="col-span-3 bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-xs">
            No {activeHorizon} KPI targets established for your team yet. Click "Define KPI Target" above to assign daily, weekly, or monthly goals.
          </div>
        )}
      </div>

      {/* KPI Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-400" /> Define {activeHorizon} KPI Target
            </h3>

            <form onSubmit={handleCreateKPI} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Target Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Daily Outbound Deal Conversions"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Scope Hierarchy: 3 Balanced Columns */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Department</label>
                  {isMD ? (
                    <select
                      value={selectedDept}
                      onChange={(e) => setSelectedDept(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                    >
                      <option value="Sales">Sales & Commercial</option>
                      <option value="Operations">Operations & Logistics</option>
                      <option value="Procurement">Procurement</option>
                      <option value="Finance">Finance & Billing</option>
                      <option value="IT">IT Infrastructure</option>
                      <option value="Customer Service">Customer Service</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      disabled
                      value={currentProfile?.department || 'General'}
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-400"
                    />
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Team / Squad</label>
                  <select
                    value={targetTeam}
                    onChange={(e) => setTargetTeam(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                  >
                    <option value="All Teams">All Squads</option>
                    <option value="Inbound Squad">Inbound / Triage</option>
                    <option value="Outbound Specialists">Outbound Specialists</option>
                    <option value="Senior Tier">Senior Tier</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Assignment Scope</label>
                  <select
                    value={targetScope}
                    onChange={(e) => setTargetScope(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                  >
                    <option value="Team">Team / Department</option>
                    <option value="Individual">Direct Report</option>
                  </select>
                </div>
              </div>

              {targetScope === 'Individual' && (
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Select Colleague</label>
                  <select
                    value={targetEmployeeId}
                    onChange={(e) => setTargetEmployeeId(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                  >
                    <option value="">Select Colleague</option>
                    {directReports.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Tracked Metric</label>
                  <select
                    value={metric}
                    onChange={(e) => setMetric(e.target.value as KPIMetric)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                  >
                    <option value="deals_closed">Deals Closed</option>
                    <option value="calls_logged">Phone Calls Logged</option>
                    <option value="tickets_resolved">IT Tickets Resolved</option>
                    <option value="revenue_booked">Revenue Booked (£)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Target Qty</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={targetValue}
                    onChange={(e) => setTargetValue(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 font-mono text-center focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Supervisor Coaching Notes</label>
                <textarea
                  rows={2}
                  placeholder="Provide context, encouragement, or specific focus areas..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow transition"
                >
                  Lock Target
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
