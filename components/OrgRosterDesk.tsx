'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Shield, Crown, Laptop, Briefcase, HeartHandshake, 
  Megaphone, Wrench, PoundSterling, Shuffle, ArrowRight, CheckCircle2,
  AlertTriangle, GitFork, Network, Layers, ChevronRight, Check
} from 'lucide-react';
import { db, EmployeeProfile, DepartmentRole, OrgStructureType, ClearanceLevel, Contact } from '../packages/storage/src/db';
import { CLEARANCE_LABELS } from '../packages/storage/src/orgEngine';

interface OrgRosterDeskProps {
  currentRepName: string;
  userRole: DepartmentRole;
  contacts: Contact[];
  onDataChanged: () => void;
}

export default function OrgRosterDesk({ currentRepName, userRole, contacts, onDataChanged }: OrgRosterDeskProps) {
  const [roster, setRoster] = useState<EmployeeProfile[]>([]);
  const [orgStructure, setOrgStructure] = useState<OrgStructureType>('Hierarchical');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeProfile | null>(null);

  // Modal / Form state for new hire
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newHire, setNewHire] = useState({
    name: '',
    email: '',
    role: 'Commercial Account Executive',
    department: 'Sales' as DepartmentRole,
    tier: 'Staff' as 'Staff' | 'Director',
    clearanceLevel: 1 as ClearanceLevel,
    primaryManagerId: undefined as number | undefined,
  });

  const loadOrgData = async () => {
    const list = await db.employees.toArray();
    setRoster(list);

    const setting = await db.settings.get('biscuit_org_structure');
    if (setting?.value) {
      setOrgStructure(setting.value as OrgStructureType);
    }
  };

  useEffect(() => {
    loadOrgData();
  }, []);

  const handleUpdateStructure = async (structure: OrgStructureType) => {
    setOrgStructure(structure);
    await db.settings.put({
      key: 'biscuit_org_structure',
      value: structure,
      updatedAt: new Date().toISOString(),
    });
    onDataChanged();
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHire.name.trim()) return;

    await db.employees.add({
      ...newHire,
      status: 'Active',
      xp: 100,
      level: 1,
      dealsClosed: 0,
      handoverActive: false,
      matrixManagerIds: [],
    });

    setIsNewModalOpen(false);
    setNewHire({
      name: '',
      email: '',
      role: 'Commercial Account Executive',
      department: 'Sales',
      tier: 'Staff',
      clearanceLevel: 1,
      primaryManagerId: undefined,
    });
    await loadOrgData();
    onDataChanged();
  };

  const handleUpdateEmployee = async (emp: EmployeeProfile) => {
    if (!emp.id) return;
    await db.employees.put(emp);
    setSelectedEmployee(emp);
    await loadOrgData();
    onDataChanged();
  };

  const potentialManagers = roster.filter(e => (e.clearanceLevel || 1) >= 2);

  return (
    <div className="space-y-6">
      {/* Top Banner & Structure Selector */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-sky-400" />
            <h2 className="text-base font-bold text-slate-100">Enterprise Organizational Topology & RBAC</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure how authority, pipeline visibility, and performance rollups cascade across the company.
          </p>
        </div>

        {/* Structure Selector Buttons */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => handleUpdateStructure('Linear')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              orgStructure === 'Linear'
                ? 'bg-sky-500 text-slate-950 shadow font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Linear (Flat)
          </button>
          <button
            onClick={() => handleUpdateStructure('Hierarchical')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              orgStructure === 'Hierarchical'
                ? 'bg-amber-500 text-slate-950 shadow font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <GitFork className="w-3.5 h-3.5" /> Hierarchical
          </button>
          <button
            onClick={() => handleUpdateStructure('Matrix')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              orgStructure === 'Matrix'
                ? 'bg-purple-500 text-slate-950 shadow font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Network className="w-3.5 h-3.5" /> Matrix
          </button>
        </div>
      </div>

      {/* Structure Mode Description Banner */}
      <div className="px-4 py-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>
            Active Topology: <strong className="text-slate-200">{orgStructure} Model</strong>.
            {orgStructure === 'Linear' && ' Department leads view all department deals; individual reps view only their assigned deals.'}
            {orgStructure === 'Hierarchical' && ' Authority cascades down parent-child reporting trees. Managers see their entire subordinate tree.'}
            {orgStructure === 'Matrix' && ' Dual reporting enabled. Functional Heads and Dotted-Line Project Leads share joint visibility.'}
          </span>
        </div>
        <button
          onClick={() => setIsNewModalOpen(true)}
          className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3 py-1.5 rounded-lg font-bold text-xs transition"
        >
          <UserPlus className="w-3.5 h-3.5" /> Add Staff Member
        </button>
      </div>

      {/* Main Roster Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Employee Roster */}
        <div className="lg:col-span-2 space-y-3">
          {roster.map((emp) => {
            const clearance = CLEARANCE_LABELS[emp.clearanceLevel || 1];
            const primaryManager = roster.find(m => m.id === emp.primaryManagerId);
            const isSelected = selectedEmployee?.id === emp.id;

            return (
              <div
                key={emp.id}
                onClick={() => setSelectedEmployee(emp)}
                className={`p-4 rounded-xl border transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-slate-900 border-amber-500/70 shadow-md'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200 text-sm">
                    {emp.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100 text-sm">{emp.name}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${clearance.badge}`}>
                        Lv.{emp.clearanceLevel || 1} {clearance.title}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                      <span>{emp.role}</span>
                      <span>&bull;</span>
                      <span className="text-amber-400">{emp.department}</span>
                      {primaryManager && (
                        <>
                          <span>&bull;</span>
                          <span className="text-slate-500">Reports to: <strong className="text-slate-300">{primaryManager.name}</strong></span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-1 rounded">
                    {emp.xp} XP
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Col: Topology & Privilege Inspector */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
          {selectedEmployee ? (
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-bold text-slate-100 text-sm">{selectedEmployee.name}</h3>
                  <p className="text-xs text-slate-400">{selectedEmployee.role}</p>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                  ID: #{selectedEmployee.id}
                </span>
              </div>

              {/* Clearance Level Slider */}
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-semibold text-slate-300">Security Clearance Level</label>
                  <span className="text-amber-400 font-mono font-bold">
                    Level {selectedEmployee.clearanceLevel || 1}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={selectedEmployee.clearanceLevel || 1}
                  onChange={(e) => handleUpdateEmployee({
                    ...selectedEmployee,
                    clearanceLevel: Number(e.target.value) as ClearanceLevel,
                  })}
                  className="w-full accent-amber-500"
                />
                <p className="text-[11px] text-slate-400">
                  {CLEARANCE_LABELS[selectedEmployee.clearanceLevel || 1].title}
                </p>
              </div>

              {/* Primary Manager Assignment (Hierarchical & Matrix) */}
              {(orgStructure === 'Hierarchical' || orgStructure === 'Matrix') && (
                <div className="mt-4">
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Primary Direct Manager
                  </label>
                  <select
                    value={selectedEmployee.primaryManagerId || ''}
                    onChange={(e) => handleUpdateEmployee({
                      ...selectedEmployee,
                      primaryManagerId: e.target.value ? Number(e.target.value) : undefined,
                    })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">None (Top-Level / Managing Director)</option>
                    {potentialManagers
                      .filter(m => m.id !== selectedEmployee.id)
                      .map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role} - Lv.{m.clearanceLevel || 1})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Matrix Dotted-Line Managers */}
              {orgStructure === 'Matrix' && (
                <div className="mt-4">
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Matrix Cross-Functional Lead (Dotted-Line)
                  </label>
                  <select
                    value={(selectedEmployee.matrixManagerIds || [])[0] || ''}
                    onChange={(e) => {
                      const id = e.target.value ? Number(e.target.value) : null;
                      handleUpdateEmployee({
                        ...selectedEmployee,
                        matrixManagerIds: id ? [id] : [],
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="">No Secondary Matrix Manager</option>
                    {potentialManagers
                      .filter(m => m.id !== selectedEmployee.id && m.id !== selectedEmployee.primaryManagerId)
                      .map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.department} Project Lead)
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Granular Permission Toggles */}
              <div className="mt-5 pt-4 border-t border-slate-800 space-y-2.5">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Granular RBAC Privileges</h4>
                
                {[
                  { key: 'canViewTeamPipelines', label: 'View Subordinate Team Pipeline' },
                  { key: 'canViewFinancials', label: 'View Deal Values & Invoicing Remittance' },
                  { key: 'canApproveLeave', label: 'Approve Departmental Holiday Requests' },
                  { key: 'canAuditActivity', label: 'Inspect Subordinate CTI Call Logs' },
                  { key: 'canReallocateAccounts', label: 'Reallocate Deals on Dormancy' },
                ].map((priv) => {
                  const isChecked = Boolean(selectedEmployee.customPrivileges?.[priv.key as keyof typeof selectedEmployee.customPrivileges]);

                  return (
                    <label key={priv.key} className="flex items-center justify-between text-xs text-slate-300 cursor-pointer p-1.5 rounded hover:bg-slate-950">
                      <span>{priv.label}</span>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const updated = {
                            ...(selectedEmployee.customPrivileges || {}),
                            [priv.key]: e.target.checked,
                          };
                          handleUpdateEmployee({
                            ...selectedEmployee,
                            customPrivileges: updated,
                          });
                        }}
                        className="rounded border-slate-700 text-amber-500 focus:ring-0"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs">
              Select an employee from the roster to inspect and configure their reporting lines, clearance, and access privileges.
            </div>
          )}
        </div>
      </div>

      {/* New Employee Intake Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-400" /> Enroll New Staff Member
            </h3>
            <form onSubmit={handleCreateEmployee} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rachel Bennett"
                  value={newHire.name}
                  onChange={(e) => setNewHire({ ...newHire, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-100"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Department</label>
                  <select
                    value={newHire.department}
                    onChange={(e) => setNewHire({ ...newHire, department: e.target.value as DepartmentRole })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
                  >
                    {(['Sales', 'Operations', 'Finance', 'HR', 'Marketing', 'IT'] as DepartmentRole[]).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Clearance Level</label>
                  <select
                    value={newHire.clearanceLevel}
                    onChange={(e) => setNewHire({ ...newHire, clearanceLevel: Number(e.target.value) as ClearanceLevel })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
                  >
                    <option value={1}>Lv.1 Individual Contributor</option>
                    <option value={2}>Lv.2 Team Lead</option>
                    <option value={3}>Lv.3 Head of Department</option>
                    <option value={4}>Lv.4 Division Director</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Official Job Title</label>
                <input
                  type="text"
                  placeholder="e.g. Senior Business Development Exec"
                  value={newHire.role}
                  onChange={(e) => setNewHire({ ...newHire, role: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Primary Manager</label>
                <select
                  value={newHire.primaryManagerId || ''}
                  onChange={(e) => setNewHire({ ...newHire, primaryManagerId: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
                >
                  <option value="">None (Reports to MD)</option>
                  {potentialManagers.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs"
                >
                  Enroll Staff Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
