import Dexie, { Table } from 'dexie';

export interface Contact {
  id?: number;
  accountNumber: string;
  name: string;
  company: string;
  crn: string;
  email: string;
  phone: string;
  stage: 'Lead' | 'Sales' | 'Procurement' | 'Logistics' | 'Customer Service';
  accountManager?: string;
  billingAddress?: string;
  shippingAddress?: string;
  internalNotes?: string;
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
  category: 'Cold Outreach' | 'Follow Up' | 'Legal & Invoicing' | 'Custom';
  title: string;
  subject: string;
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

export interface AuditRecord {
  id?: number;
  timestamp: string;
  actor: string;
  action: string;
  entityId: string;
  details: string;
}

export class BiscuitDatabase extends Dexie {
  contacts!: Table<Contact, number>;
  projects!: Table<ProjectTask, number>;
  templates!: Table<StoredTemplate, number>;
  outbox!: Table<OutboxMutation, number>;
  auditLogs!: Table<AuditRecord, number>;

  constructor() {
    super('BiscuitDatabase');
    this.version(3).stores({
      contacts: '++id, accountNumber, name, company, crn, stage, synced, updatedAt',
      projects: '++id, title, companyName, synced, updatedAt',
      templates: '++id, templateKey, category, updatedAt',
      outbox: '++id, type, table, timestamp',
      auditLogs: '++id, timestamp, actor, action, entityId',
    });
  }
}

export const db = new BiscuitDatabase();
