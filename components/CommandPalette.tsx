'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Building2, Calendar, BookOpen, LayoutGrid, Plus, ArrowRight } from 'lucide-react';
import { Contact } from '../packages/storage/src/db';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  onSelectView: (view: 'kanban' | 'table' | 'gantt' | 'templates') => void;
  onOpenNewContact: () => void;
  onOpenNewMilestone: () => void;
  onOpenNewTemplate: () => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  contacts,
  onSelectView,
  onOpenNewContact,
  onOpenNewMilestone,
  onOpenNewTemplate,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset query and selection whenever opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const filteredContacts = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        (c.crn && c.crn.includes(q))
    );
  }, [contacts, query]);

  const allActions = useMemo(() => {
    const list: Array<{
      id: string;
      label: string;
      sublabel?: string;
      icon: any;
      category: string;
      action: () => void;
    }> = [];

    // 1. Matched contacts prioritized first
    filteredContacts.forEach((c) => {
      list.push({
        id: `contact-${c.id}`,
        label: c.name,
        sublabel: `${c.company} ${c.crn ? `(#${c.crn})` : ''} • ${c.stage}`,
        icon: Building2,
        category: 'Contacts & Accounts',
        action: () => onSelectView('table'),
      });
    });

    // 2. Action Shortcuts
    const actions = [
      {
        id: 'act-lead',
        label: 'Create New Lead & CRN Intake',
        category: 'Quick Actions',
        icon: Plus,
        action: onOpenNewContact,
      },
      {
        id: 'act-milestone',
        label: 'Schedule Calendar Project Milestone',
        category: 'Quick Actions',
        icon: Calendar,
        action: onOpenNewMilestone,
      },
      {
        id: 'act-template',
        label: 'Create Custom Sales Battlecard',
        category: 'Quick Actions',
        icon: BookOpen,
        action: onOpenNewTemplate,
      },
      {
        id: 'nav-kanban',
        label: 'Jump to Pipeline Board',
        category: 'Switch Views',
        icon: LayoutGrid,
        action: () => onSelectView('kanban'),
      },
      {
        id: 'nav-gantt',
        label: 'Jump to Gantt & Milestones',
        category: 'Switch Views',
        icon: Calendar,
        action: () => onSelectView('gantt'),
      },
      {
        id: 'nav-templates',
        label: 'Jump to Template Vault',
        category: 'Switch Views',
        icon: BookOpen,
        action: () => onSelectView('templates'),
      },
    ];

    if (!query.trim()) {
      list.push(...actions);
    } else {
      const q = query.toLowerCase();
      const matched = actions.filter((a) => a.label.toLowerCase().includes(q));
      list.push(...matched);
    }

    return list;
  }, [filteredContacts, query, onOpenNewContact, onOpenNewMilestone, onOpenNewTemplate, onSelectView]);

  // Keyboard navigation: Arrows, Enter, Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1 < allActions.length ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : allActions.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (allActions[selectedIndex]) {
          allActions[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, allActions, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center pt-24 px-4"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 border-b border-slate-800">
          <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Search John Doe, Revolut, CRN, or jump to actions..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="w-full bg-transparent py-3.5 text-sm text-slate-100 focus:outline-none placeholder:text-slate-500"
            autoFocus
          />
          <kbd className="hidden sm:inline-block text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">ESC</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {allActions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No matching contacts or actions found.
            </div>
          ) : (
            allActions.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs cursor-pointer transition ${
                    isSelected ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-slate-950' : 'text-amber-400'}`} />
                    <div className="truncate">
                      <span>{item.label}</span>
                      {item.sublabel && (
                        <span className={`ml-2 text-[11px] font-normal ${isSelected ? 'text-slate-900' : 'text-slate-400'}`}>
                          {item.sublabel}
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && <ArrowRight className="w-3.5 h-3.5 shrink-0 text-slate-950 ml-2" />}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
