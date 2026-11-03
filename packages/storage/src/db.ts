import Dexie, { Table } from 'dexie';

export interface Contact {
  id?: number;
  name: string;
  company: string;
  crn?: string;
  email: string;
  phone?: string;
  stage: 'Lead' | 'Sales' | 'Procurement' | 'Logistics' | 'Customer Service';
  synced: boolean;
  updatedAt: string;
}

export interface ProjectTask {
  id?: number;
  title: string;
  companyName: string;
  startDate: string;
  endDate: string;
  progress: number;
  calendarEventId?: string;
  synced: boolean;
  updatedAt: string;
}

export interface StoredTemplate {
  id?: number;
  templateKey: string;
  category: 'Cold Outreach' | 'Objection Handling' | 'Procurement Followup' | 'Onboarding' | 'Custom';
  title: string;
  subject?: string;
  body: string;
  updatedAt: string;
}

export interface OutboxMutation {
  id?: number;
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  payload: any;
  timestamp: number;
}

export class BiscuitDatabase extends Dexie {
  contacts!: Table<Contact>;
  projects!: Table<ProjectTask>;
  templates!: Table<StoredTemplate>;
  outbox!: Table<OutboxMutation>;

  constructor() {
    super('BiscuitCRM_DB');
    this.version(3).stores({
      contacts: '++id, name, company, crn, stage, synced',
      projects: '++id, title, companyName, startDate, endDate, synced',
      templates: '++id, templateKey, category, title',
      outbox: '++id, type, table, timestamp',
    });
  }
}

export const db = new BiscuitDatabase();
