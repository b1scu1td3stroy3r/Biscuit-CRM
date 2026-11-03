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

export interface OutboxMutation {
  id?: number;
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  payload: any;
  timestamp: number;
}

export class BiscuitDatabase extends Dexie {
  contacts!: Table<Contact>;
  outbox!: Table<OutboxMutation>;

  constructor() {
    super('BiscuitCRM_DB');
    this.version(1).stores({
      contacts: '++id, name, company, crn, stage, synced',
      outbox: '++id, type, table, timestamp',
    });
  }
}

export const db = new BiscuitDatabase();
