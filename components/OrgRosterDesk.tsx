'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, UserCheck, UserX, ShieldAlert, Award, ArrowRightLeft, 
  CheckCircle2, Plus, Edit2, Shuffle, AlertTriangle, Crown, Sparkles, Check, X
} from 'lucide-react';
import { db, EmployeeProfile, DepartmentRole, StaffHierarchyTier, Contact, LeaveRequest } from '../packages/storage/src/db';

interface OrgRosterDeskProps {
  currentRepName: string;
  userRole: DepartmentRole;
  contacts: Contact[];
  onDataChanged: () => void;
}

export function getRankDetails(emp: { tier: StaffHierarchyTier; level: number; xp: number }) {
  const isLeaderOrAbove = emp.tier !== 'Staff';

  if (isLeaderOrAbove) {
    // 5-Level Leadership Hierarchy
    const lvl = Math.min(5, Math.max(1, emp.level || 1));
    const titles = [
      'Frontline Lead',
      'Operations Captain',
      'Department Head',
      'Executive Champion',
      'Grandmaster Director'
    ];
    return {
      title: titles[lvl - 1],
      maxLevels: 5,
      isLeadership: true,
      badge: 'border-purple-500/30 text-purple-300 bg-purple-500/10'
    };
  }

  // 10-Level Staff System
  const lvl = Math.min(10, Math.max(1, emp.level || 1));
  const staffTitles = [
    'Apprentice Associate',
    'Junior Specialist',
    'Core Practitioner',
    'Advanced Operator',
    'Senior Specialist',
    'Staff Anchor',
    'Master Practitioner',
    'Department Vanguard',
    'Principal Specialist',
    'Apex Elite'
  ];
  return {
    title: staffTitles[lvl - 1],
    maxLevels: 10,
    isLeadership: false,
    badge: 'border-amber-500/30 text-amber-300 bg-amber-500/10'
  };
}

export default function OrgRosterDesk({ currentRepName, userRole, contacts, onDataChanged }: OrgRosterDeskProps) {
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [editingEmp, setEditingEmp] = useState<EmployeeProfile | null>(null);
  const [targetDormant, setTargetDormant] = useState<EmployeeProfile | null>(null);
  const [redistributionSummary, setRedistributionSummary] = useState<string | null>(null);

  const [newEmpForm, setNewEmpForm] = useState({
    name: '',
    role: 'Specialist',
    department: 'Sales' as DepartmentRole,
    tier: 'Staff' as StaffHierarchyTier,
  });

  const loadRoster = async () => {
    let list = await db.employees.toArray();
    if (list.length === 0) {
      const initialSeed: EmployeeProfile[] = [
        { name: 'Sarah Jenkins', role: 'Sales Lead', department: 'Sales', tier: 'Team Leader', status: 'Active', xp: 685, level: 3, dealsClosed: 4, handoverActive: false },
        { name: 'David Miller', role: 'Commercial Executive', department: 'Sales', tier: 'Staff', status: 'Active', xp: 420, level: 3, dealsClosed: 2, handoverActive: false },
        { name: 'Liam Hughes', role: 'Operations Lead', department: 'Operations', tier: 'Manager', status: 'Active', xp: 810, level: 4, dealsClosed: 0, handoverActive: false },
        { name: 'Elena Rostova', role: 'Billing Specialist', department: 'Finance', tier: 'Staff', status: 'Active', xp: 350, level: 2, dealsClosed: 0, handoverActive: false },
        { name: 'Marcus Vance', role: 'Managing Director', department: 'MD', tier: 'Director', status: 'Active', xp: 1250, level: 5, dealsClosed: 12, handoverActive: false },
      ];
      for (const emp of initialSeed) {
        await db.employees.add(emp);
      }
      list = await db.employees.toArray();
    }
    setEmployees(list);
  };

  useEffect(() => {
    loadRoster();
  }, []);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpForm.name) return;

    await db.employees.add({
      name: newEmpForm.name,
      role: newEmpForm.role,
      department: newEmpForm.department,
      tier: newEmpForm.tier,
      status: 'Active',
      xp: 100,
      level: 1,
      dealsClosed: 0,
      handoverActive: false,
    });

    setNewEmpForm({ name: '', role: 'Specialist', department: 'Sales', tier: 'Staff' });
    await loadRoster();
    onDataChanged();
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp || !editingEmp.id) return;

    // Recompute level based on updated tier
    const isLeadership = editingEmp.tier !== 'Staff';
    const computedLevel = isLeadership
      ? Math.min(5, Math.floor(editingEmp.xp / 250) + 1)
      : Math.min(10, Math.floor(editingEmp.xp / 200) + 1);

    await db.employees.update(editingEmp.id, {
      role: editingEmp.role,
      department: editingEmp.department,
      tier: editingEmp.tier,
      status: editingEmp.status,
      level: computedLevel,
    });

    setEditingEmp(null);
    await loadRoster();
    onDataChanged();
  };

  const handleConfirmDormancy = async () => {
    if (!targetDormant || !targetDormant.id) return;

    await db.employees.update(targetDormant.id, {
      status: 'Dormant',
    });

    const colleagues = employees.filter(
      (e) => e.id !== targetDormant.id && e.department === targetDormant.department && e.status === 'Active'
    );

    const assignedDeals = contacts.filter(
      (c) => c.accountManager && c.accountManager.toLowerCase().includes(targetDormant.name.toLowerCase())
    );

    let reallocatedCount = 0;
    const summaryLog: string[] = [];

    if (colleagues.length > 0 && assignedDeals.length > 0) {
      for (const deal of assignedDeals) {
        const randomIndex = Math.floor(Math.random() * colleagues.length);
        const recipient = colleagues[randomIndex];

        const noteUpdate = `${deal.internalNotes || ''}\n[REALLOCATION]: Staff member ${targetDormant.name} marked Dormant. Workload distributed to ${recipient.name} at random.`;

        await db.contacts.update(deal.id!, {
          accountManager: recipient.name,
          internalNotes: noteUpdate,
          synced: false,
          updatedAt: new Date().toISOString(),
        });

        await db.outbox.add({
          type: 'UPDATE',
          table: 'contacts',
          payload: {
            id: deal.id,
            accountManager: recipient.name,
            internalNotes: noteUpdate,
            updatedAt: new Date().toISOString(),
          },
          timestamp: Date.now(),
        });

        // Award peer +25 XP
        const step = recipient.tier === 'Staff' ? 200 : 250;
        const maxLvl = recipient.tier === 'Staff' ? 10 : 5;
        const newXP = recipient.xp + 25;
        const newLvl = Math.min(maxLvl, Math.floor(newXP / step) + 1);

        await db.employees.update(recipient.id!, {
          xp: newXP,
          level: newLvl,
        });

        reallocatedCount++;
        summaryLog.push(`• ${deal.name} [${deal.accountNumber}] -> Assigned to ${recipient.name} (+25 XP)`);
      }
    }

    setRedistributionSummary(
      reallocatedCount > 0
        ? `Marked ${targetDormant.name} as Dormant. ${reallocatedCount} accounts re-allocated randomly across ${colleagues.length} ${targetDormant.department} peers:\n\n${summaryLog.join('\n')}`
        : `Marked ${targetDormant.name} as Dormant. No accounts required re-distribution.`
    );

    setTargetDormant(null);
    await loadRoster();
    onDataChanged();
  };

  return (
    <section className="space-y-6 mb-8">
      <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-slate-100 text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-400" /> Organization Roster, Role Assignment & Workload Offboarding
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            10-level XP ladder for staff &bull; 5-level tier for leaders/managers &bull; Random workload re-allocation on dormancy
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20 px-3 py-1 rounded-full">
            {employees.filter(e => e.status === 'Active').length} Active Personnel
          </span>
          <span className="text-xs font-mono bg-slate-800 text-slate-400 px-3 py-1 rounded-full">
            {employees.filter(e => e.status === 'Dormant').length} Dormant
          </span>
        </div>
      </div>

      {redistributionSummary && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 space-y-2">
          <div className="flex items-center justify-between font-bold text-emerald-400">
            <span className="flex items-center gap-2"><Shuffle className="w-4 h-4" /> Workload Redistribution Audit Complete</span>
            <button onClick={() => setRedistributionSummary(null)} className="text-slate-400 hover:text-slate-200">✕</button>
          </div>
          <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-slate-300">
            {redistributionSummary}
          </pre>
        </div>
      )}

      {/* Target Dormant Confirmation Modal */}
      {targetDormant && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-bold text-base text-slate-100">Offboard & Set Dormant</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to mark <strong>{targetDormant.name}</strong> as Dormant? Their open deals will be automatically and randomly distributed to active colleagues in the <strong>{targetDormant.department}</strong> department.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setTargetDormant(null)}
                className="px-4 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDormancy}
                className="bg-rose-600 hover:bg-rose-500 text-white font-semibold px-4 py-1.5 rounded-lg text-xs transition"
              >
                Confirm Offboarding & Redistribute
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-semibold text-slate-200 text-sm">Personnel Directory</h3>
            <span className="text-xs text-slate-400">5-Lvl Leaders &bull; 10-Lvl Staff</span>
          </div>

          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-3">Staff Member</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Hierarchy Tier</th>
                <th className="px-5 py-3">Progression Rank</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {employees.map((emp) => {
                const rank = getRankDetails(emp);
                return (
                  <tr key={emp.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                        <span>{emp.name}</span>
                        {emp.tier === 'Director' && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                      </div>
                      <div className="text-[11px] text-slate-400">{emp.role}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-medium text-slate-300">{emp.department}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                        emp.tier === 'Director' ? 'border-amber-500/30 text-amber-300 bg-amber-500/10' :
                        emp.tier === 'Manager' ? 'border-purple-500/30 text-purple-300 bg-purple-500/10' :
                        emp.tier === 'Team Leader' ? 'border-sky-500/30 text-sky-300 bg-sky-500/10' :
                        'border-slate-700 text-slate-300 bg-slate-800'
                      }`}>
                        {emp.tier}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-xs font-mono font-bold text-amber-400">
                        Lv.{emp.level}/{rank.maxLevels} ({emp.xp} XP)
                      </div>
                      <div className="text-[10px] text-slate-400">{rank.title}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      {emp.status === 'Active' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-rose-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Dormant
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-1.5">
                      <button
                        onClick={() => setEditingEmp(emp)}
                        className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition"
                        title="Promote or change role"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {emp.status === 'Active' && emp.name !== 'Marcus Vance' && (
                        <button
                          onClick={() => setTargetDormant(emp)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                          title="Offboard / Set dormant & reassign"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Edit or Enroll Form */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
          <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-400" />
            {editingEmp ? `Promote / Edit: ${editingEmp.name}` : 'Enroll New Team Member'}
          </h3>

          {!editingEmp ? (
            <form onSubmit={handleCreateEmployee} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Jessica Taylor"
                  value={newEmpForm.name}
                  onChange={(e) => setNewEmpForm({ ...newEmpForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Job Title</label>
                <input
                  type="text"
                  placeholder="e.g. Operations Coordinator"
                  value={newEmpForm.role}
                  onChange={(e) => setNewEmpForm({ ...newEmpForm, role: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Department</label>
                  <select
                    value={newEmpForm.department}
                    onChange={(e) => setNewEmpForm({ ...newEmpForm, department: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
                  >
                    <option value="Sales">Sales</option>
                    <option value="Operations">Operations</option>
                    <option value="Finance">Finance</option>
                    <option value="HR">HR</option>
                    <option value="Marketing">Marketing</option>
                    <option value="IT">IT</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Hierarchy Tier</label>
                  <select
                    value={newEmpForm.tier}
                    onChange={(e) => setNewEmpForm({ ...newEmpForm, tier: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
                  >
                    <option value="Staff">Staff (10 Levels)</option>
                    <option value="Team Leader">Team Leader (5 Levels)</option>
                    <option value="Manager">Manager (5 Levels)</option>
                    <option value="Director">Director (5 Levels)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition"
              >
                Enroll Personnel
              </button>
            </form>
          ) : (
            <form onSubmit={handleUpdateEmployee} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Job Title</label>
                <input
                  type="text"
                  value={editingEmp.role}
                  onChange={(e) => setEditingEmp({ ...editingEmp, role: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Department</label>
                  <select
                    value={editingEmp.department}
                    onChange={(e) => setEditingEmp({ ...editingEmp, department: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
                  >
                    <option value="Sales">Sales</option>
                    <option value="Operations">Operations</option>
                    <option value="Finance">Finance</option>
                    <option value="HR">HR</option>
                    <option value="Marketing">Marketing</option>
                    <option value="IT">IT</option>
                    <option value="MD">MD</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Hierarchy Tier</label>
                  <select
                    value={editingEmp.tier}
                    onChange={(e) => setEditingEmp({ ...editingEmp, tier: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
                  >
                    <option value="Staff">Staff (10 Levels)</option>
                    <option value="Team Leader">Team Leader (5 Levels)</option>
                    <option value="Manager">Manager (5 Levels)</option>
                    <option value="Director">Director (5 Levels)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingEmp(null)}
                  className="flex-1 py-1.5 text-xs text-slate-400 border border-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg"
                >
                  Save Promotion
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
