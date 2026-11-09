// components/it/DepartmentStudio.tsx
import React, { useState } from 'react';

export function DepartmentStudio() {
  const [departmentOwnership, setDepartmentOwnership] = useState(() => {
    const saved = localStorage.getItem('biscuit_dept_ownership');
    return saved ? JSON.parse(saved) : {
      payroll: 'Finance',
      statutoryFiling: 'Finance',
      leadScoring: 'Marketing'
    };
  });

  const handleToggleOwnership = (module: string, currentOwner: string) => {
    const newOwner = currentOwner === 'Finance' ? 'HR' : 'Finance';
    const updated = { ...departmentOwnership, [module]: newOwner };
    setDepartmentOwnership(updated);
    localStorage.setItem('biscuit_dept_ownership', JSON.stringify(updated));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100">
      <h3 className="text-lg font-semibold mb-2">Departmental Module Studio</h3>
      <p className="text-sm text-slate-400 mb-6">Configure cross-department ownership and functional tool routing for your corporate layout.</p>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-slate-950 rounded-lg border border-slate-800">
          <div>
            <h4 className="font-medium">Payroll & Salary Run Management</h4>
            <p className="text-xs text-slate-400">Currently owned by: <span className="text-amber-400 font-semibold">{departmentOwnership.payroll}</span></p>
          </div>
          <button 
            onClick={() => handleToggleOwnership('payroll', departmentOwnership.payroll)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
          >
            Reassign to {departmentOwnership.payroll === 'Finance' ? 'HR' : 'Finance'}
          </button>
        </div>
      </div>
    </div>
  );
}