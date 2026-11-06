import React, { useState, useEffect, useMemo } from 'react';
import { db, CallLog, TeamKPI } from '../packages/storage/src/db';
import { 
  TrendingUp, 
  PhoneCall, 
  Target, 
  Calendar, 
  Users, 
  Clock, 
  Flame, 
  AlertCircle, 
  CheckCircle2 
} from 'lucide-react';

interface SalesPacingHUDProps {
  currentUser: string;
  department: string;
  contacts: any[];
}

export function SalesPacingHUD({ currentUser, department, contacts }: SalesPacingHUDProps) {
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [salesKpi, setSalesKpi] = useState<TeamKPI | null>(null);
  const [targetDealsOverride, setTargetDealsOverride] = useState<number>(10);
  const [targetRevenueOverride, setTargetRevenueOverride] = useState<number>(25000);

  useEffect(() => {
    async function loadData() {
      try {
        const logs = await db.callLogs.toArray();
        setCallLogs(logs);

        const kpis = await db.teamKpis.toArray();
        const relevantKpi = kpis.find(k => 
          k.department === 'Sales' && 
          k.horizon === 'Monthly' && 
          (k.targetScope === 'Team' || k.targetEmployeeName === currentUser)
        );
        if (relevantKpi) {
          setSalesKpi(relevantKpi);
          if (relevantKpi.metric === 'deals_closed') {
            setTargetDealsOverride(relevantKpi.targetValue);
          } else if (relevantKpi.metric === 'revenue_booked') {
            setTargetRevenueOverride(relevantKpi.targetValue);
          }
        }
      } catch (err) {
        console.error('Failed to load Sales Pacing HUD metrics:', err);
      }
    }
    loadData();
  }, [currentUser]);

  // Working days calculations
  const { workingDaysLeft, totalWorkingDaysInMonth, workingDaysElapsed } = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

    let totalWorking = 0;
    let elapsedWorking = 0;
    let remainingWorking = 0;

    for (let day = 1; day <= lastDayOfMonth; day++) {
      const d = new Date(year, month, day);
      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      if (!isWeekend) {
        totalWorking++;
        if (day < today.getDate()) {
          elapsedWorking++;
        } else {
          remainingWorking++;
        }
      }
    }

    return {
      workingDaysLeft: Math.max(1, remainingWorking),
      totalWorkingDaysInMonth: Math.max(1, totalWorking),
      workingDaysElapsed: elapsedWorking
    };
  }, []);

  // Filter contacts converted/closed this month
  const closedDealsThisMonth = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return contacts.filter(c => {
      const isClosed = c.stage === 'Sales' || c.status === 'Won' || c.status === 'Active Customer';
      if (!isClosed) return false;
      const d = c.updatedAt ? new Date(c.updatedAt) : new Date(c.createdAt || Date.now());
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });
  }, [contacts]);

  const dealsClosedCount = closedDealsThisMonth.length;
  const revenueBookedTotal = closedDealsThisMonth.reduce((acc, c) => acc + (Number(c.dealValue) || 0), 0);

  // Call analytics
  const { outboundDials, dmSpoken, avgTalkDurationSec } = useMemo(() => {
    const outbounds = callLogs.filter(l => l.direction === 'Outbound');
    const dms = outbounds.filter(l => l.outcome === 'Spoke with DM');
    const totalDuration = outbounds.reduce((acc, l) => acc + (l.durationSeconds || 0), 0);
    const avgSec = outbounds.length > 0 ? Math.round(totalDuration / outbounds.length) : 0;

    return {
      outboundDials: outbounds.length,
      dmSpoken: dms.length,
      avgTalkDurationSec: avgSec
    };
  }, [callLogs]);

  // Pacing calculations
  const dealsRemaining = Math.max(0, targetDealsOverride - dealsClosedCount);
  const requiredDealsPerDay = (dealsRemaining / workingDaysLeft).toFixed(1);
  const currentDealsRunRate = workingDaysElapsed > 0 ? (dealsClosedCount / workingDaysElapsed).toFixed(1) : dealsClosedCount.toFixed(1);

  const dialsToCloseRatio = dealsClosedCount > 0 
    ? (outboundDials / dealsClosedCount).toFixed(1) 
    : (outboundDials > 0 ? outboundDials.toString() : '—');

  const dmContactRate = outboundDials > 0 
    ? Math.round((dmSpoken / outboundDials) * 100) 
    : 0;

  const isPacingBehind = Number(currentDealsRunRate) < Number(requiredDealsPerDay) && dealsRemaining > 0;

  return (
    <div className="mb-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              Sales Pacing & Daily Run-Rate Engine
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                isPacingBehind 
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}>
                {isPacingBehind ? 'Pacing Behind Target' : 'Pacing On Track'}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Live run-rate metrics benchmarked against working days remaining in current billing cycle.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 flex items-center gap-1 font-mono">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <strong className="text-slate-200">{workingDaysLeft}</strong> working days left
          </span>
          <span className="text-slate-600">&bull;</span>
          <span className="text-slate-400 font-mono">
            Elapsed: <strong className="text-slate-200">{workingDaysElapsed}</strong> / {totalWorkingDaysInMonth}d
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3">
        {/* Metric 1: Deals Closed vs Target */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
          <span className="text-[11px] text-slate-400 block mb-0.5 flex items-center gap-1">
            <Target className="w-3 h-3 text-indigo-400" /> Month Closed
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold text-white font-mono">{dealsClosedCount}</span>
            <span className="text-[11px] text-slate-500 font-mono">/ {targetDealsOverride} deals</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            {dealsRemaining === 0 ? 'Goal Reached!' : `${dealsRemaining} remaining to quota`}
          </span>
        </div>

        {/* Metric 2: Required Daily Run-Rate */}
        <div className={`p-3 rounded-xl border ${
          isPacingBehind 
            ? 'bg-amber-950/20 border-amber-500/30' 
            : 'bg-slate-950 border-slate-800/80'
        }`}>
          <span className="text-[11px] text-slate-400 block mb-0.5 flex items-center gap-1">
            <Flame className="w-3 h-3 text-amber-400" /> Required Pace
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-bold text-amber-400 font-mono">{requiredDealsPerDay}</span>
            <span className="text-[11px] text-slate-400 font-mono">deals / day</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Current pace: <strong className="text-slate-300 font-mono">{currentDealsRunRate}</strong>/day
          </span>
        </div>

        {/* Metric 3: Outbound Dials Logged */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
          <span className="text-[11px] text-slate-400 block mb-0.5 flex items-center gap-1">
            <PhoneCall className="w-3 h-3 text-sky-400" /> Outbound Dials
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold text-sky-400 font-mono">{outboundDials}</span>
            <span className="text-[11px] text-slate-500 font-mono">dials</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Avg talk: <strong className="text-slate-300 font-mono">{avgTalkDurationSec}s</strong>
          </span>
        </div>

        {/* Metric 4: Decision Makers Spoken */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
          <span className="text-[11px] text-slate-400 block mb-0.5 flex items-center gap-1">
            <Users className="w-3 h-3 text-emerald-400" /> DM Reached
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold text-emerald-400 font-mono">{dmSpoken}</span>
            <span className="text-[11px] text-emerald-400/80 font-mono font-semibold">({dmContactRate}%)</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Gatekeeper connect rate
          </span>
        </div>

        {/* Metric 5: Dials-to-Close Ratio */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
          <span className="text-[11px] text-slate-400 block mb-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3 text-purple-400" /> Dials-to-Close
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-bold text-purple-400 font-mono">{dialsToCloseRatio}</span>
            <span className="text-[11px] text-slate-500 font-mono">: 1</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Effort per conversion
          </span>
        </div>

        {/* Metric 6: Revenue Run-Rate */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
          <span className="text-[11px] text-slate-400 block mb-0.5 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-teal-400" /> Revenue Pacing
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-bold text-teal-400 font-mono">£{revenueBookedTotal.toLocaleString()}</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Quota: <strong className="text-slate-300 font-mono">£{targetRevenueOverride.toLocaleString()}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
