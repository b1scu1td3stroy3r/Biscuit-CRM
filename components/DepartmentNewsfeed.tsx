'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, Sparkles, Award, PoundSterling, Briefcase, HeartHandshake, 
  Send, Plus, Flame, Megaphone, Baby, CheckCircle2, ChevronLeft, ChevronRight,
  Smile, Rocket, Heart, ThumbsUp
} from 'lucide-react';
import { db, NewsItem, DepartmentRole } from '../packages/storage/src/db';

interface DepartmentNewsfeedProps {
  currentDepartment: DepartmentRole;
  currentUser: string;
  onAwardXP: (amount: number, reason: string) => void;
}

const EMOJI_OPTIONS = [
  { emoji: '🔥', label: 'Fire' },
  { emoji: '🚀', label: 'Rocket' },
  { emoji: '👏', label: 'Applause' },
  { emoji: '🍪', label: 'Biscuit' },
  { emoji: '❤️', label: 'Love' },
];

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

  const scrollRef = useRef<HTMLDivElement>(null);

  const cleanupOldItemsAndLoad = async () => {
    // 24-hour midnight boundary: Wipe events prior to today's midnight (00:00:00)
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const todayMidnightISO = todayMidnight.toISOString();

    const allItems = await db.newsFeed.toArray();
    for (const item of allItems) {
      if (item.createdAt < todayMidnightISO && item.id) {
        await db.newsFeed.delete(item.id);
      }
    }

    const currentDayItems = await db.newsFeed.toArray();
    setNews(currentDayItems.reverse());
  };

  useEffect(() => {
    cleanupOldItemsAndLoad();
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
      reactions: {},
      badgeColor: postForm.category === 'Level Up' ? 'border-amber-500/30 text-amber-300 bg-amber-500/10' :
                  postForm.category === 'Invoice Paid' ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10' :
                  postForm.category === 'Deal Closed' ? 'border-sky-500/30 text-sky-300 bg-sky-500/10' :
                  postForm.category === 'Maternity / Leave' ? 'border-purple-500/30 text-purple-300 bg-purple-500/10' :
                  'border-slate-700 text-slate-300 bg-slate-800',
    };

    await db.newsFeed.add(payload);
    onAwardXP(15, `Broadcasted team achievement: ${payload.title}`);
    setPostForm({ title: '', content: '', category: 'Announcement', isCompanyWide: true });
    setIsPosting(false);
    await cleanupOldItemsAndLoad();
  };

  const handleAddReaction = async (item: NewsItem, emoji: string) => {
    if (!item.id) return;
    const currentReactions = { ...(item.reactions || {}) };
    currentReactions[emoji] = (currentReactions[emoji] || 0) + 1;

    await db.newsFeed.update(item.id, { reactions: currentReactions });
    onAwardXP(5, `Cheered colleague update with ${emoji}`);
    await cleanupOldItemsAndLoad();
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const offset = direction === 'left' ? -380 : 380;
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const filteredNews = news.filter((item) => {
    if (filterMode === 'all' || currentDepartment === 'MD') return true;
    return item.department === 'Company-Wide' || item.department === currentDepartment;
  });

  const getCategoryIcon = (category: NewsItem['category']) => {
    switch (category) {
      case 'Level Up':
        return <Flame className="w-3.5 h-3.5 text-amber-400" />;
      case 'Invoice Paid':
        return <PoundSterling className="w-3.5 h-3.5 text-emerald-400" />;
      case 'Deal Closed':
        return <Briefcase className="w-3.5 h-3.5 text-sky-400" />;
      case 'Maternity / Leave':
        return <Baby className="w-3.5 h-3.5 text-purple-400" />;
      case 'Promotion':
        return <Award className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 mb-6 shadow-sm space-y-3">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 text-amber-400 border border-amber-500/30">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-100 text-sm">
                Daily Motivation & Team Ticker
              </h3>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                Refreshes Daily at Midnight
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Today's wins, milestones, and encouraging cheers across {currentDepartment === 'MD' ? 'All Divisions' : currentDepartment}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Scroll Navigation Chevrons */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => scroll('left')}
              className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
              title="Scroll left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
              title="Scroll right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setFilterMode('department')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                filterMode === 'department' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {currentDepartment}
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
            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold transition"
          >
            <Plus className="w-3.5 h-3.5" />
            {isPosting ? 'Close' : 'Cheer Team'}
          </button>
        </div>
      </div>

      {/* Manual Cheer / Broadcast Post Form */}
      {isPosting && (
        <form onSubmit={handlePostNews} className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="Give a shoutout or announce a win (e.g. Great job team closing 3 deals today!)"
                value={postForm.title}
                onChange={(e) => setPostForm({ ...postForm, title: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                required
              />
            </div>
            <div>
              <select
                value={postForm.category}
                onChange={(e) => setPostForm({ ...postForm, category: e.target.value as any })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
              >
                <option value="Announcement">Positive Shoutout</option>
                <option value="Deal Closed">Commercial Deal Won</option>
                <option value="Level Up">XP Milestone Reached</option>
                <option value="Promotion">Promotion Celebration</option>
                <option value="Invoice Paid">Invoice Paid / Cash In</option>
                <option value="Maternity / Leave">Team Welcome / Well Wishes</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={postForm.isCompanyWide}
                onChange={(e) => setPostForm({ ...postForm, isCompanyWide: e.target.checked })}
                className="rounded border-slate-700 bg-slate-900 text-amber-500"
              />
              <span>Share across whole company</span>
            </label>

            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
            >
              <Send className="w-3.5 h-3.5" /> Post Cheer (+15 XP)
            </button>
          </div>
        </form>
      )}

      {/* LINEAR HORIZONTAL CAROUSEL */}
      <div 
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {filteredNews.map((item) => {
          const reactions = item.reactions || {};

          return (
            <div
              key={item.id}
              className="min-w-[320px] max-w-[360px] flex-shrink-0 snap-start p-3.5 rounded-xl border border-slate-800/90 bg-slate-950/70 hover:border-amber-500/40 transition flex flex-col justify-between space-y-2.5 shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/60 mb-2">
                  <span className="flex items-center gap-1 text-[10px] font-semibold font-mono text-slate-300">
                    {getCategoryIcon(item.category)}
                    <span>{item.category}</span>
                  </span>
                  <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border ${item.badgeColor || 'border-slate-800 text-slate-400'}`}>
                    {item.department}
                  </span>
                </div>

                <h4 className="font-semibold text-xs text-slate-100 leading-snug">{item.title}</h4>
                {item.content && (
                  <p className="text-[11px] text-slate-400 leading-relaxed mt-1 line-clamp-2">{item.content}</p>
                )}
              </div>

              {/* Reaction Emojis & Stamp */}
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                {/* Emoji Pickers */}
                <div className="flex items-center gap-1">
                  {EMOJI_OPTIONS.map(({ emoji }) => {
                    const count = reactions[emoji] || 0;
                    return (
                      <button
                        key={emoji}
                        onClick={() => handleAddReaction(item, emoji)}
                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] transition ${
                          count > 0
                            ? 'bg-amber-500/15 border border-amber-500/30 text-amber-200'
                            : 'hover:bg-slate-800 border border-transparent text-slate-400'
                        }`}
                        title={`React with ${emoji} (+5 XP)`}
                      >
                        <span>{emoji}</span>
                        {count > 0 && <span className="font-mono text-[9px] font-bold ml-0.5">{count}</span>}
                      </button>
                    );
                  })}
                </div>

                <span className="text-[10px] text-slate-500 font-mono">
                  {item.actor}
                </span>
              </div>
            </div>
          );
        })}

        {filteredNews.length === 0 && (
          <div className="w-full py-4 text-center text-xs text-slate-400 border border-dashed border-slate-800/80 rounded-xl flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Today's slate is fresh for {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}. As your team works, deals won, invoices paid, and shoutouts will glide along here!</span>
          </div>
        )}
      </div>
    </div>
  );
}
