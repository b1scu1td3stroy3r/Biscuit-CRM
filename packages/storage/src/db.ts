import Dexie, { Table } from 'dexie';

export type DepartmentRole = 'Sales' | 'Operations' | 'HR' | 'Marketing' | 'IT' | 'Finance' | 'MD';
export type StaffHierarchyTier = 'Staff' | 'Team Leader' | 'Manager' | 'Director';

export interface Contact {
  id?: number;
  accountNumber: string;
  name: string;
  company: string;
  crn: string;
  email: string;
  phone: string;
  stage: 'Prospect' | 'Lead' | 'Sales' | 'Procurement' | 'Logistics' | 'Customer Service' | 'Winback';
  dealValue?: number;
  invoiceStatus?: 'Pending' | 'Drafted' | 'Issued' | 'Paid';
  mailchimpStatus?: 'Synced' | 'Pending' | 'Not Synced';
  lastCallDuration?: number;
  lastCallTimestamp?: string;
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
  assignee?: string;
  department?: DepartmentRole;
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

export interface WhiteboardNote {
  id?: number;
  title: string;
  content: string;
  color: 'amber' | 'sky' | 'emerald' | 'purple' | 'rose';
  author: string;
  createdAt: string;
}

export interface LeaveRequest {
  id?: number;
  employeeName: string;
  department: DepartmentRole;
  leaveType: 'Annual Leave' | 'Sick Leave' | 'Compassionate' | 'Training' | 'Maternity / Paternity';
  startDate: string;
  endDate: string;
  days: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedBy?: string;
  notes?: string;
  calendarEventId?: string;
  createdAt: string;
}

export interface EmployeeProfile {
  id?: number;
  name: string;
  role: string;
  department: DepartmentRole;
  tier: StaffHierarchyTier;
  status: 'Active' | 'Dormant';
  xp: number;
  level: number;
  dealsClosed: number;
  handoverActive: boolean;
  handoverTo?: string;
  handoverNotes?: string;
}

export interface NewsItem {
  id?: number;
  title: string;
  content: string;
  category: 'Level Up' | 'Promotion' | 'Invoice Paid' | 'Deal Closed' | 'Maternity / Leave' | 'Announcement';
  department: DepartmentRole | 'Company-Wide';
  actor: string;
  badgeColor?: string;
  reactions?: Record<string, number>;
  createdAt: string;
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
  action: 'CREATE_CONTACT' | 'UPDATE_STAGE' | 'SCHEDULE_MILESTONE' | 'CREATE_TEMPLATE';
  entityId: string;
  details: string;
}

export class BiscuitDatabase extends Dexie {
  contacts!: Table<Contact, number>;
  projects!: Table<ProjectTask, number>;
  templates!: Table<StoredTemplate, number>;
  whiteboardNotes!: Table<WhiteboardNote, number>;
  leaveRequests!: Table<LeaveRequest, number>;
  employees!: Table<EmployeeProfile, number>;
  newsFeed!: Table<NewsItem, number>;
  outbox!: Table<OutboxMutation, number>;
  auditLogs!: Table<AuditRecord, number>;

  constructor() {
    super('BiscuitDatabase');
    this.version(12).stores({
      contacts: '++id, accountNumber, name, company, crn, stage, accountManager, invoiceStatus, mailchimpStatus, phone, synced, updatedAt',
      projects: '++id, title, companyName, assignee, department, synced, updatedAt',
      templates: '++id, templateKey, category, updatedAt',
      whiteboardNotes: '++id, author, color, createdAt',
      leaveRequests: '++id, employeeName, department, status, startDate, endDate',
      employees: '++id, name, department, tier, status, xp, level',
      newsFeed: '++id, category, department, actor, createdAt',
      outbox: '++id, type, table, timestamp',
      auditLogs: '++id, timestamp, actor, action, entityId',
    });
  }
}

export const db = new BiscuitDatabase();
