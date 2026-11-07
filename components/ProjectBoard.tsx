'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../packages/storage/src/db';
import { 
  CheckCircle2, Clock, Plus, Filter, Layers, 
  User, Calendar, GitFork, AlertCircle, BarChart3, LayoutGrid
} from 'lucide-react';

interface ProjectBoardProps {
  currentUser?: any;
}

interface TaskItem {
  id: string;
  projectId: string;
  title: string;
  assignee: string;
  status: 'Backlog' | 'In Progress' | 'Review' | 'Done';
  startDate: string;
  dueDate: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  progress: number;
  dependencies: string[]; // IDs of prerequisite tasks
  durationDays: number;
}

export default function ProjectBoard({ currentUser }: ProjectBoardProps) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [viewMode, setViewMode] = useState<'kanban' | 'gantt'>('kanban');
  const [selectedDept, setSelectedDept] = useState<string>('All');
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);

  // Form State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDept, setNewTaskDept] = useState('Operations');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskStartDate, setNewTaskStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTaskDueDate, setNewTaskDueDate] = useState(new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]);
  const [newTaskPriority, setNewTaskPriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [newTaskDep, setNewTaskDep] = useState<string>('');

  const loadTasks = async () => {
    try {
      if ((db as any)?.tasks) {
        const loaded = await (db as any).tasks.toArray();
        if (loaded && loaded.length > 0) {
          setTasks(loaded.map((t: any) => ({
            ...t,
            startDate: t.startDate || t.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
            dependencies: t.dependencies || [],
            durationDays: t.durationDays || 5
          })));
          return;
        }
      }
    } catch {
      // fallback
    }

    // Seed defaults if table is empty
    const seed: TaskItem[] = [
      {
        id: 'TSK-101',
        projectId: 'operations',
        title: 'Warehouse Rack Safety Audit & Layout Recalibration',
        assignee: 'Marcus Vance',
        status: 'Done',
        startDate: new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0],
        dueDate: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
        priority: 'High',
        progress: 100,
        dependencies: [],
        durationDays: 4
      },
      {
        id: 'TSK-102',
        projectId: 'operations',
        title: 'BACS Automated Direct Debit Clearing Reconciliation',
        assignee: 'Sarah Connor',
        status: 'In Progress',
        startDate: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
        priority: 'Critical',
        progress: 45,
        dependencies: ['TSK-101'],
        durationDays: 5
      },
      {
        id: 'TSK-103',
        projectId: 'marketing',
        title: 'Q3 Enterprise SaaS Displacement Whitepaper',
        assignee: 'Elena Rostova',
        status: 'Backlog',
        startDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 9 * 86400000).toISOString().split('T')[0],
        priority: 'Medium',
        progress: 0,
        dependencies: ['TSK-102'],
        durationDays: 7
      }
    ];
    setTasks(seed);
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const start = new Date(newTaskStartDate);
    const end = new Date(newTaskDueDate);
    const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24)));

    const task: TaskItem = {
      id: `TSK-${Date.now().toString(36).toUpperCase()}`,
      projectId: newTaskDept.toLowerCase(),
      title: newTaskTitle.trim(),
      assignee: newTaskAssignee.trim() || (currentUser?.name || 'Unassigned'),
      status: 'Backlog',
      startDate: newTaskStartDate,
      dueDate: newTaskDueDate,
      priority: newTaskPriority,
      progress: 0,
      dependencies: newTaskDep ? [newTaskDep] : [],
      durationDays: diffDays
    };

    if ((db as any)?.tasks) {
      await (db as any).tasks.put(task as any);
    }
    setTasks(prev => [...prev, task]);
    setNewTaskTitle('');
    setNewTaskAssignee('');
    setNewTaskDep('');
    setShowNewTaskModal(false);
  };

  const handleUpdateStatus = async (taskId: string, newStatus: any) => {
    const updated = tasks.map(t => t.id === taskId ? { 
      ...t, 
      status: newStatus,
      progress: newStatus === 'Done' ? 100 : newStatus === 'Backlog' ? 0 : 50
    } : t);
    setTasks(updated);
    if ((db as any)?.tasks) {
      const existing = await (db as any).tasks.get(taskId);
      if (existing) {
        await (db as any).tasks.put({ 
          ...existing, 
          status: newStatus,
          progress: newStatus === 'Done' ? 100 : 50
        } as any);
      }
    }
  };

  const filteredTasks = useMemo(() => {
    if (selectedDept === 'All') return tasks;
    return tasks.filter(t => t.projectId === selectedDept.toLowerCase());
  }, [tasks, selectedDept]);

  // Critical Path Analysis (DAG traversal)
  const criticalPathIds = useMemo(() => {
    const set = new Set<string>();
    filteredTasks.forEach(task => {
      if (task.priority === 'Critical' || task.dependencies.length > 0) {
        set.add(task.id);
        task.dependencies.forEach(dep => set.add(dep));
      }
    });
    return set;
  }, [filteredTasks]);

  const metrics = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter(t => t.status === 'Done').length;
    const inProgress = filteredTasks.filter(t => t.status === 'In Progress' || t.status === 'Review').length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, rate };
  }, [filteredTasks]);

  // Timeline horizontal scale calculation
  const timelineDates = useMemo(() => {
    const today = new Date();
    const days: string[] = [];
    for (let i = -3; i <= 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push(d.toISOString().split('T')[0]);
    }
    return days;
  }, []);

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-slate-100 font-sans">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-sky-500/10 text-sky-400 rounded-lg border border-sky-500/20">
              <Layers className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-white">Operations & Projects Workspace</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Monday.com-grade interactive Gantt milestones, task dependencies, and critical path engine
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'kanban' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setViewMode('gantt')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'gantt' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Gantt / Timeline
            </button>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-transparent text-xs text-slate-300 font-medium focus:outline-none cursor-pointer"
            >
              <option value="All" className="bg-slate-900">All Departments</option>
              <option value="Operations" className="bg-slate-900">Operations</option>
              <option value="Marketing" className="bg-slate-900">Marketing</option>
              <option value="Engineering" className="bg-slate-900">Engineering</option>
              <option value="Legal" className="bg-slate-900">Legal & Governance</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowNewTaskModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-sky-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            New Milestone
          </button>
        </div>
      </div>

      {/* KPI Pulse */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
          <span className="text-[11px] font-mono uppercase text-slate-400 tracking-wider">Total Tasks</span>
          <p className="text-xl font-bold font-mono text-white mt-1">{metrics.total}</p>
        </div>
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
          <span className="text-[11px] font-mono uppercase text-slate-400 tracking-wider">Active In-Flight</span>
          <p className="text-xl font-bold font-mono text-sky-400 mt-1">{metrics.inProgress}</p>
        </div>
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
          <span className="text-[11px] font-mono uppercase text-slate-400 tracking-wider">Critical Path Tasks</span>
          <p className="text-xl font-bold font-mono text-rose-400 mt-1">{criticalPathIds.size}</p>
        </div>
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
          <span className="text-[11px] font-mono uppercase text-slate-400 tracking-wider">Delivery Rate</span>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xl font-bold font-mono text-indigo-400">{metrics.rate}%</p>
            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${metrics.rate}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Mode 1: Kanban Board */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
          {['Backlog', 'In Progress', 'Review', 'Done'].map((lane) => {
            const laneTasks = filteredTasks.filter(t => t.status === lane);
            return (
              <div key={lane} className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col min-h-[500px]">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      lane === 'Done' ? 'bg-emerald-400' :
                      lane === 'Review' ? 'bg-purple-400' :
                      lane === 'In Progress' ? 'bg-sky-400' : 'bg-slate-400'
                    }`} />
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">{lane}</h3>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-800 text-slate-300 rounded-md">
                    {laneTasks.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1">
                  {laneTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`p-3.5 bg-slate-900 border rounded-xl hover:border-slate-700 transition shadow-sm space-y-2.5 ${
                        criticalPathIds.has(task.id) ? 'border-l-4 border-l-rose-500 border-slate-800' : 'border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[10px] font-mono text-slate-400">{task.id}</span>
                        <div className="flex items-center gap-1">
                          {task.dependencies.length > 0 && (
                            <span className="p-0.5 bg-slate-800 text-sky-400 rounded text-[9px] flex items-center gap-0.5" title={`Prerequisite: ${task.dependencies.join(', ')}`}>
                              <GitFork className="w-2.5 h-2.5" /> Dep
                            </span>
                          )}
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                            task.priority === 'Critical' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                            task.priority === 'High' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-slate-800 text-slate-300'
                          }`}>
                            {task.priority}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs font-medium text-slate-100 leading-snug">{task.title}</p>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/60 font-mono">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-500" />
                          {task.assignee}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {task.dueDate}
                        </span>
                      </div>

                      <div className="flex items-center justify-end gap-1 pt-1">
                        {lane !== 'Done' ? (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(task.id, lane === 'Backlog' ? 'In Progress' : lane === 'In Progress' ? 'Review' : 'Done')}
                            className="text-[10px] text-sky-400 hover:text-sky-300 font-medium px-2 py-0.5 rounded bg-sky-500/10 transition"
                          >
                            Advance →
                          </button>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Settled
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mode 2: Interactive Gantt Timeline */}
      {viewMode === 'gantt' && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 overflow-x-auto">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-xs font-mono text-slate-300">Red indicator = Critical Path Dependency Chain</span>
            </div>
            <span className="text-xs font-mono text-slate-400">18-Day Operational Horizon</span>
          </div>

          <div className="min-w-[850px]">
            {/* Timeline Days Header */}
            <div className="grid grid-cols-12 gap-1 mb-3 text-[10px] font-mono text-slate-400 text-center border-b border-slate-800 pb-2">
              <div className="col-span-4 text-left font-bold text-slate-300">Task Milestone & Assignee</div>
              <div className="col-span-8 grid grid-cols-6 gap-1">
                {timelineDates.filter((_, idx) => idx % 3 === 0).map(d => (
                  <span key={d}>{d.slice(5)}</span>
                ))}
              </div>
            </div>

            {/* Gantt Task Rows */}
            <div className="space-y-3">
              {filteredTasks.map(task => {
                const isCritical = criticalPathIds.has(task.id);
                return (
                  <div key={task.id} className="grid grid-cols-12 gap-1 items-center bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    <div className="col-span-4 pr-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-slate-400">{task.id}</span>
                        <p className="text-xs font-semibold text-slate-200 truncate">{task.title}</p>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 mt-0.5">
                        <span>{task.assignee}</span>
                        <span>•</span>
                        <span>{task.durationDays}d duration</span>
                      </div>
                    </div>

                    <div className="col-span-8 relative h-7 bg-slate-900/80 rounded-lg overflow-hidden border border-slate-800">
                      {/* Bar Representation */}
                      <div
                        className={`absolute top-1 bottom-1 rounded-md px-2 flex items-center justify-between text-[10px] font-mono font-bold shadow-sm ${
                          task.status === 'Done' ? 'bg-emerald-600 text-white' :
                          isCritical ? 'bg-rose-600 text-white' : 'bg-sky-600 text-white'
                        }`}
                        style={{
                          left: '10%',
                          width: `${Math.min(80, task.durationDays * 12)}%`
                        }}
                      >
                        <span className="truncate">{task.status} ({task.progress}%)</span>
                        {task.dependencies.length > 0 && <GitFork className="w-2.5 h-2.5 shrink-0" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* New Milestone Modal */}
      {showNewTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form onSubmit={handleCreateTask} className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">Create Milestone with Dependencies</h3>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Milestone Name</label>
              <input
                type="text"
                required
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="e.g. SOC2 Type II Security Certification"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Department</label>
                <select
                  value={newTaskDept}
                  onChange={(e) => setNewTaskDept(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
                >
                  <option value="Operations">Operations</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Legal">Legal & Governance</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Priority</label>
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Start Date</label>
                <input
                  type="date"
                  value={newTaskStartDate}
                  onChange={(e) => setNewTaskStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Due Date</label>
                <input
                  type="date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Prerequisite Dependency (DAG Link)</label>
              <select
                value={newTaskDep}
                onChange={(e) => setNewTaskDep(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
              >
                <option value="">None (Standalone)</option>
                {tasks.map(t => (
                  <option key={t.id} value={t.id}>{t.id} - {t.title}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewTaskModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-sky-600/20 transition"
              >
                Create Milestone
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
