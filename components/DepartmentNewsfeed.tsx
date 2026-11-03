'use client';

import React, { useState, useEffect } from 'react';
import { 
  Bell, Sparkles, Award, PoundSterling, Briefcase, HeartHandshake, 
  Send, Plus, Flame, Megaphone, Baby, CheckCircle2, Filter
} from 'lucide-react';
import { db, NewsItem, DepartmentRole } from '../packages/storage/src/db';

interface DepartmentNewsfeedProps {
  currentDepartment: DepartmentRole;
  currentUser: string;
  onAwardXP: (amount: number, reason: string) => void;
}

export default function DepartmentNewsfeed({
  currentDepartment,
  currentUser,
  onAwardXP,
}: DepartmentNewsfeedProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [filterMode, setFilterMode] = useState<'department' | 'all'>('department');
  const [isPosting, setIsPosting] = useState(false);
  const [postForm, setPostForm] = useState({
    title: '',
    content: '',
    category: 'Announcement' as NewsItem['category'],
    isCompanyWide: true,
  });

  const loadNews = async () => {
    await db.newsFeed.where('title').startsWith('David Miller').delete();
    await db.newsFeed.where('title').startsWith('£14,400').delete();
    await db.newsFeed.where('title').startsWith('Team Announcement: Maternity').delete();
    await db.newsFeed.where('title').startsWith('Deal Closed: £8,500').delete();
    const items = await db.newsFeed.toArray();
    setNews(items.reverse());
  };

  useEffect(() => {
    loadNews();
  }, [currentDepartment]);

  const handlePostNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postForm.title.trim()) return;

    const payload: NewsItem = {
      title: postForm.title.trim(),
      content: postForm.content.trim(),
      category: postForm.category,
      department: postForm.isCompanyWide ? 'Company-Wide' : currentDepartment,
      actor: currentUser,
      createdAt: new Date().toISOString(),
      badgeColor: postForm.category === 'Level Up' ? 'border-amber-500/30 text-amber-300 bg-amber-500/10' :
                  postForm.category === 'Invoice Paid' ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10' :
                  postForm.category === 'Deal Closed' ? 'border-sky-500/30 text-sky-300 bg-sky-500/10' :
                  postForm.category === 'Maternity / Leave' ? 'border-purple-500/30 text-purple-300 bg-purple-500/10' :
                  'border-slate-700 text-slate-300 bg-slate-800',
    };

    await db.newsFeed.add(payload);
    onAwardXP(15, `Broadcasted update: ${payload.title}`);
    setPostForm({ title: '', content: '', category: 'Announcement', isCompanyWide: true });
    setIsPosting(false);
    await loadNews();
  };

  const filteredNews = news.filter((item) => {
    if (filterMode === 'all' || currentDepartment === 'MD') return true;
    return item.department === 'Company-Wide' || item.department === currentDepartment;
  });

  const getCategoryIcon = (category: NewsItem['category']) => {
    switch (category) {
      case 'Level Up':
        return <Flame className="w-4 h-4 text-amber-400" />;
      case 'Invoice Paid':
        return <PoundSterling className="w-4 h-4 text-emerald-400" />;
      case 'Deal Closed':
        return <Briefcase className="w-4 h-4 text-sky-400" />;
      case 'Maternity / Leave':
        return <Baby className="w-4 h-4 text-purple-400" />;
      case 'Promotion':
        return <Award className="w-4 h-4 text-amber-400" />;
      default:
        return <Megaphone className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4 mb-8 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              Department & Company Activity Newsfeed
              <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                Live Stream
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Showing key updates for {currentDepartment === 'MD' ? 'All Executive Divisions' : `${currentDepartment} & Company-Wide`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setFilterMode('department')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                filterMode === 'department' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {currentDepartment} & General
            </button>
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                filterMode === 'all' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Company-Wide
            </button>
          </div>

          <button
            onClick={() => setIsPosting(!isPosting)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold transition"
          >
            <Plus className="w-3.5 h-3.5" />
            {isPosting ? 'Close Form' : 'Post Update'}
          </button>
        </div>
      </div>

      {isPosting && (
        <form onSubmit={handlePostNews} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <div className="md:col-span-2">
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Headline</label>
              <input
                type="text"
                placeholder="e.g. Approved Q1 marketing initiative or team promotion"
                value={postForm.title}
                onChange={(e) => setPostForm({ ...postForm, title: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Category</label>
              <select
                value={postForm.category}
                onChange={(e) => setPostForm({ ...postForm, category: e.target.value as any })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
              >
                <option value="Announcement">General Announcement</option>
                <option value="Level Up">Level Up / XP Milestone</option>
                <option value="Promotion">Staff Promotion</option>
                <option value="Deal Closed">Commercial Deal Won</option>
                <option value="Invoice Paid">Invoice Paid & Settled</option>
                <option value="Maternity / Leave">Maternity / Extended Leave</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Context / Details</label>
            <textarea
              rows={2}
              placeholder="Additional details, scope, or notes for the team..."
              value={postForm.content}
              onChange={(e) => setPostForm({ ...postForm, content: e.target.value })}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={postForm.isCompanyWide}
                onChange={(e) => setPostForm({ ...postForm, isCompanyWide: e.target.checked })}
                className="rounded border-slate-700 bg-slate-900 text-amber-500"
              />
              <span>Broadcast Company-Wide</span>
            </label>

            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
            >
              <Send className="w-3.5 h-3.5" /> Broadcast News (+15 XP)
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 max-h-72 overflow-y-auto pr-1">
        {filteredNews.map((item) => (
          <div
            key={item.id}
            className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-950/60 flex flex-col justify-between hover:border-slate-700 transition"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-[10px] font-semibold font-mono text-slate-400 uppercase">
                  {getCategoryIcon(item.category)}
                  {item.category}
                </span>
                <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border ${item.badgeColor || 'border-slate-800 text-slate-400'}`}>
                  {item.department}
                </span>
              </div>
              <h4 className="font-semibold text-xs text-slate-100 leading-snug">{item.title}</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">{item.content}</p>
            </div>

            <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-800/60 text-[10px] text-slate-500 font-mono">
              <span>By {item.actor}</span>
              <span>{item.createdAt.slice(0, 10)}</span>
            </div>
          </div>
        ))}

        {filteredNews.length === 0 && (
          <div className="col-span-full py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl space-y-1">
            <p className="font-semibold text-slate-400">Workspace Activity Stream Ready</p>
            <p className="text-[11px]">Real company milestones (deals closed, settled invoices, promotions, level-ups) will appear here live as your team works.</p>
          </div>
        )}
      </div>
    </div>
  );
}
