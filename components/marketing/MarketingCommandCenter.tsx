// components/marketing/MarketingCommandCenter.tsx
import React, { useState } from 'react';

export function MarketingCommandCenter() {
  const [campaigns] = useState([
    { id: 'CAMP-01', name: 'Q1 Enterprise Outbound', channel: 'LinkedIn Ads', spend: 2400, pipelineGenerated: 42000, roi: '1,650%' },
    { id: 'CAMP-02', name: 'Local-First Whitepaper SEO', channel: 'Organic Search', spend: 400, pipelineGenerated: 18500, roi: '4,525%' },
  ]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <span className="text-xs text-slate-400">Total Marketing Spend (MTD)</span>
          <h2 className="text-2xl font-bold text-slate-100 mt-1">£2,800.00</h2>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <span className="text-xs text-slate-400">Total Pipeline Influenced</span>
          <h2 className="text-2xl font-bold text-emerald-400 mt-1">£60,500.00</h2>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <span className="text-xs text-slate-400">Blended Channel ROI</span>
          <h2 className="text-2xl font-bold text-indigo-400 mt-1">2,060%</h2>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Active Campaign Attribution Matrix</h3>
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="border-b border-slate-800 text-xs text-slate-400 uppercase">
            <tr>
              <th className="pb-3">Campaign Name</th>
              <th className="pb-3">Channel</th>
              <th className="pb-3">Ad Spend</th>
              <th className="pb-3">Pipeline Generated</th>
              <th className="pb-3">ROI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {campaigns.map((c) => (
              <tr key={c.id} className="hover:bg-slate-950/50">
                <td className="py-3 font-medium text-white">{c.name}</td>
                <td className="py-3 text-slate-400">{c.channel}</td>
                <td className="py-3">£{c.spend.toLocaleString()}</td>
                <td className="py-3 text-emerald-400">£{c.pipelineGenerated.toLocaleString()}</td>
                <td className="py-3 font-semibold text-indigo-400">{c.roi}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}