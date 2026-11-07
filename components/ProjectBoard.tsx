'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../packages/storage/src/db';
import { 
  CheckCircle2, Clock, AlertTriangle, Plus, 
  Calendar, User, BarChart2, Filter, Layers, CheckSquare
} from 'lucide-react';

interface ProjectBoardProps {
  currentUser?: any;
}

export default function ProjectBoard({ currentUser }: ProjectBoardProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('All');
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDept, setNewTaskDept] = useState('Operations');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');

  // Hydrate tasks from Dexie IndexedDB
  const loadTasks = async () => {
    try {
      if ((db as any)?.tasks) {
        const loaded = await (db as any).tasks.toArray();
        setTasks(loaded || []);
      }
    } catch {
      setTasks([]);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const task = {
      id: `TSK-${Date.now().toString(36).toUpperCase()}`,
      projectId: newTaskDept.toLowerCase(),
      title: newTaskTitle.trim(),
      assignee: newTaskAssignee.trim() || (currentUser?.name || 'Unassigned'),
      status: 'Backlog',
      dueDate: newTaskDueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      priority: newTaskPriority,
      progress: 0,
      createdAt: new Date().toISOString()
    };

    if ((db as any)?.tasks) {
      await (db as any).tasks.put(task as any);
    }
    setTasks(prev => [...prev, task]);
    setNewTaskTitle('');
    setNewTaskAssignee('');
    setShowNewTaskModal(false);
  };

  const handleUpdateStatus = async (taskId: string, newStatus: string) => {
    const updated = tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t);
    setTasks(updated);
    if ((db as any)?.tasks) {
      const existing = await (db as any).tasks.get(taskId);
      if (existing) {
        await (db as any).tasks.put({ ...existing, status: newStatus } as any);
      }
    }
  };

  const filteredTasks = useMemo(() => {
    if (selectedDept === 'All') return tasks;
    return tasks.filter(t => t.projectId === selectedDept.toLowerCase() || t.department === selectedDept);
  }, [tasks, selectedDept]);

  const metrics = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter(t => t.status === 'Done').length;
    const inProgress = filteredTasks.filter(t => t.status === 'In Progress' || t.status === 'Review').length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, rate };
  }, [filteredTasks]);

  const lanes = ['Backlog', 'In Progress', 'Review', 'Done'];

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-slate-100 font-sans">
      {/* Top Header & Metrics Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-sky-500/10 text-sky-400 rounded-lg border border-sky-500/20">
              <Layers className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-white">Operations & Projects Workspace</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Universal milestone tracking, task burn-down, and cross-department collaboration
          </p>
        </div>

        <div className="flex items-center gap-3">
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
              <option value="Customer Success" className="bg-slate-900">Customer Success</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowNewTaskModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-sky-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            New Milestone / Task
          </button>
        </div>
      </div>

      {/* Monday-grade Pulse / Metrics Banner */}
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
          <span className="text-[11px] font-mono uppercase text-slate-400 tracking-wider">Completed</span>
          <p className="text-xl font-bold font-mono text-emerald-400 mt-1">{metrics.completed}</p>
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

      {/* Kanban Workflow Board */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
        {lanes.map((lane) => {
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
                {laneTasks.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-600 border border-dashed border-slate-800/50 rounded-xl">
                    No active tasks
                  </div>
                ) : (
                  laneTasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition shadow-sm space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[10px] font-mono text-slate-400">{task.id}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                          task.priority === 'Critical' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                          task.priority === 'High' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          'bg-slate-800 text-slate-300'
                        }`}>
                          {task.priority}
                        </span>
                      </div>

                      <p className="text-xs font-medium text-slate-100 leading-snug">{task.title}</p>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/60">
                        <span className="flex items-center gap-1 font-mono">
                          <User className="w-3 h-3 text-slate-500" />
                          {task.assignee}
                        </span>
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {task.dueDate}
                        </span>
                      </div>

                      {/* Quick Status Advance */}
                      <div className="flex items-center justify-end gap-1 pt-1">
                        {lane !== 'Done' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(task.id, lane === 'Backlog' ? 'In Progress' : lane === 'In Progress' ? 'Review' : 'Done')}
                            className="text-[10px] text-sky-400 hover:text-sky-300 font-medium px-2 py-0.5 rounded bg-sky-500/10 transition"
                          >
                            Advance →
                          </button>
                        )}
                        {lane === 'Done' && (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Settled
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* New Milestone / Task Modal */}
      {showNewTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form onSubmit={handleCreateTask} className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">Create New Project Milestone</h3>
            
            <div>
              <label className="text-xs text-slate-400 block mb-1">Task Title / Milestone</label>
              <input
                type="text"
                required
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="e.g. Conduct ISO 27001 internal audit"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Department</label>
                <select
                  value={newTaskDept}
                  onChange={(e) => setNewTaskDept(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                >
                  <option value="Operations">Operations</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Legal">Legal & Governance</option>
                  <option value="Customer Success">Customer Success</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Priority</label>
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-sky-500"
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
                <label className="text-xs text-slate-400 block mb-1">Assignee</label>
                <input
                  type="text"
                  value={newTaskAssignee}
                  onChange={(e) => setNewTaskAssignee(e.target.value)}
                  placeholder="e.g. Alex Taylor"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Target Due Date</label>
                <input
                  type="date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>
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
                Create Task
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
