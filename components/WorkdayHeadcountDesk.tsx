'use client';

import React, { useState, useMemo } from 'react';
import { Users, TrendingUp, AlertCircle, DollarSign, Plus, Trash2 } from 'lucide-react';

interface HeadcountPlan {
  id: string;
  role: string;
  department: string;
  baseSalary: number;
  count: number;
}

export default function WorkdayHeadcountDesk() {
  const [plans, setPlans] = useState<HeadcountPlan[]>([]);
  const [role, setRole] = useState('');
  const [dept, setDept] = useState('Engineering');
  const [salary, setSalary] = useState('');
  const [count, setCount] = useState('1');

  const handleAddRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!role.trim() || !salary) return;
    const plan: HeadcountPlan = {
      id: `HC-${Date.now().toString(36).toUpperCase()}`,
      role: role.trim(),
      department: dept,
      baseSalary: parseFloat(salary) || 0,
      count: parseInt(count) || 1
    };
    setPlans(prev => [...prev, plan]);
    setRole('');
    setSalary('');
    setCount('1');
  };

  const metrics = useMemo(() => {
    let totalGrossSalary = 0;
    let totalEmployees = 0;

    plans.forEach(p => {
      totalGrossSalary += p.baseSalary * p.count;
      totalEmployees += p.count;
    });

    // UK Statutory On-Costs: Employer NI (13.8% above £9,100 threshold) + 3% Pension
    const employerNIC = Math.max(0, (totalGrossSalary - (totalEmployees * 9100)) * 0.138);
    const pensionContributions = totalGrossSalary * 0.03;
    const totalAnnualCost = totalGrossSalary + employerNIC + pensionContributions;
    const monthlyBurn = totalAnnualCost / 12;

    return { totalGrossSalary, totalEmployees, employerNIC, pensionContributions, totalAnnualCost, monthlyBurn };
  }, [plans]);

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-slate-100 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-white">Workday Headcount Runway & Payroll Burn Simulator</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Simulate future headcount expansions, statutory Employer NIC (13.8%), and workplace pensions against cash runway
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
          <span className="text-[10px] font-mono uppercase text-slate-400">Planned Headcount</span>
          <p className="text-xl font-bold font-mono text-white mt-1">{metrics.totalEmployees}</p>
        </div>
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
          <span className="text-[10px] font-mono uppercase text-slate-400">Total Base Salary</span>
          <p className="text-xl font-bold font-mono text-blue-400 mt-1">
            £{metrics.totalGrossSalary.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
          <span className="text-[10px] font-mono uppercase text-slate-400">Statutory On-Costs (NI+Pension)</span>
          <p className="text-xl font-bold font-mono text-amber-400 mt-1">
            £{(metrics.employerNIC + metrics.pensionContributions).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
          <span className="text-[10px] font-mono uppercase text-slate-400">Monthly Payroll Burn Rate</span>
          <p className="text-xl font-bold font-mono text-rose-400 mt-1">
            £{metrics.monthlyBurn.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Form */}
        <form onSubmit={handleAddRole} className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Simulate New Hire Position</h3>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Role Title</label>
            <input
              type="text"
              required
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Senior Full-Stack Engineer"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Department</label>
              <select
                value={dept}
                onChange={(e) => setDept(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
              >
                <option value="Engineering">Engineering</option>
                <option value="Sales">Sales</option>
                <option value="Operations">Operations</option>
                <option value="Marketing">Marketing</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Headcount Qty</label>
              <input
                type="number"
                min="1"
                required
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Annual Base Salary (£)</label>
            <input
              type="number"
              required
              step="1000"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              placeholder="e.g. 65000"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add to Hiring Plan
          </button>
        </form>

        {/* List */}
        <div className="md:col-span-2 bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden flex flex-col">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800 bg-slate-900/80">
                <th className="p-3.5">Position</th>
                <th className="p-3.5">Dept</th>
                <th className="p-3.5">Count</th>
                <th className="p-3.5">Base Salary</th>
                <th className="p-3.5">Total Burden</th>
                <th className="p-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {plans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-600">
                    No hiring plans active. Simulate headcount growth to project statutory payroll burn.
                  </td>
                </tr>
              ) : (
                plans.map(p => {
                  const burden = (p.baseSalary * 1.168) * p.count;
                  return (
                    <tr key={p.id} className="text-slate-300 hover:bg-slate-900/30">
                      <td className="p-3.5 font-bold text-white">{p.role}</td>
                      <td className="p-3.5 text-slate-400">{p.department}</td>
                      <td className="p-3.5 font-bold text-blue-400">{p.count}</td>
                      <td className="p-3.5">£{p.baseSalary.toLocaleString()}</td>
                      <td className="p-3.5 font-bold text-slate-100">£{burden.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => setPlans(plans.filter(item => item.id !== p.id))}
                          className="text-rose-400 hover:text-rose-300"
                        >
                          <Trash2 className="w-4 h-4 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
