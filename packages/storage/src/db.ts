import Dexie, { Table } from 'dexie';

export type DepartmentRole = 'Sales' | 'Operations' | 'Finance' | 'HR' | 'Marketing' | 'IT' | 'MD';
export type StaffHierarchyTier = 'Staff' | 'Team Leader' | 'Director';
export type OrgStructureType = 'Linear' | 'Hierarchical' | 'Matrix';
export type ClearanceLevel = 1 | 2 | 3 | 4 | 5; // 1: IC, 2: Team Lead, 3: Dept Head, 4: Director, 5: Executive/MD

export interface CustomPrivileges {
  canViewTeamPipelines?: boolean;
  canViewFinancials?: boolean;
  canApproveLeave?: boolean;
  canAuditActivity?: boolean;
  canReallocateAccounts?: boolean;
}

export interface EmployeeProfile {
  id?: number;
  name: string;
  email?: string;
  role: string;
  department: DepartmentRole;
  tier: StaffHierarchyTier;
  status: 'Active' | 'On Leave' | 'Dormant';
  xp: number;
  level: number;
  dealsClosed: number;
  handoverActive: boolean;

  // Organizational Topology & Hierarchy
  clearanceLevel?: ClearanceLevel;
  primaryManagerId?: number;         // Hierarchical direct report
  matrixManagerIds?: number[];       // Matrix dotted-line managers
  assignedProjectIds?: string[];     // Matrix project allocations
  customPrivileges?: CustomPrivileges;
}

export interface WhiteboardNote {
  id?: number;
  title?: string;
  author: string;
  department?: DepartmentRole;
  content: string;
  createdAt: string;
  color?: string;
}

export interface LeaveRequest {
  id?: number;
  employeeName: string;
  employeeId?: number;
  department: DepartmentRole;
  leaveType?: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Declined';
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface CompanySetting {
  id?: string;
  key: string;
  value: any;
  updatedAt: string;
}

export interface Contact {
  id?: number;
  accountNumber: string;
  name: string;
  company?: string;
  crn?: string;
  email: string;
  phone?: string;
  accountManager?: string;
  ownerId?: number;                  // Direct linkage to EmployeeProfile.id
  secondaryAssigneeIds?: number[];   // Matrix co-management
  billingAddress?: string;
  shippingAddress?: string;
  stage: 'Prospect' | 'Lead' | 'Sales' | 'Procurement' | 'Logistics' | 'Customer Service' | 'Winback';
  dealValue?: number;
  synced?: boolean;
  updatedAt?: string;
  internalNotes?: string;
  mailchimpStatus?: 'Synced' | 'Pending' | 'Excluded';
}

export interface ProjectTask {
  id?: number;
  title: string;
  companyName: string;
  startDate: string;
  endDate: string;
  progress: number;
  googleCalendarEventId?: string;
}

export interface StoredTemplate {
  id?: number;
  category: string;
  title: string;
  subject: string;
  body: string;
  lastUsed?: string;
}

export interface AuditRecord {
  id?: number;
  timestamp: string;
  actor: string;
  action: string;
  entityId: string;
  details: string;
  synced?: boolean;
}

export interface OutboxItem {
  id?: number;
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  payload: any;
  timestamp: number;
}

export interface NewsItem {
  id?: number;
  title: string;
  content: string;
  category: string;
  department: DepartmentRole | 'Company-Wide';
  actor: string;
  badgeColor?: string;
  createdAt: string;
  reactions?: Record<string, number>;
}

export interface CallLog {
  id?: number;
  contactId: number;
  contactName: string;
  companyName?: string;
  phoneNumber: string;
  callerName: string;
  direction: 'Outbound' | 'Inbound';
  durationSeconds: number;
  outcome: 'Spoke with DM' | 'Left Voicemail' | 'Gatekeeper Block' | 'Busy / No Answer' | 'Wrong Number';
  notes: string;
  timestamp: string;
}

export class BiscuitDB extends Dexie {
  contacts!: Table<Contact, number>;
  projects!: Table<ProjectTask, number>;
  templates!: Table<StoredTemplate, number>;
  auditLogs!: Table<AuditRecord, number>;
  employees!: Table<EmployeeProfile, number>;
  outbox!: Table<OutboxItem, number>;
  newsFeed!: Table<NewsItem, number>;
  leaveRequests!: Table<LeaveRequest, number>;
  holidays!: Table<LeaveRequest, number>;
  callLogs!: Table<CallLog, number>;
  whiteboardNotes!: Table<WhiteboardNote, number>;
  settings!: Table<CompanySetting, string>;

  constructor() {
    super('biscuit_crm_db');
    this.version(4).stores({
      contacts: '++id, accountNumber, email, stage, synced, updatedAt, ownerId',
      projects: '++id, title, companyName, startDate, endDate',
      templates: '++id, category, title',
      auditLogs: '++id, timestamp, actor, action, synced',
      employees: '++id, name, department, status, role, clearanceLevel, primaryManagerId',
      outbox: '++id, type, table, timestamp',
      newsFeed: '++id, category, department, createdAt',
      leaveRequests: '++id, employeeName, department, status, startDate',
      holidays: '++id, employeeName, department, status, startDate',
      callLogs: '++id, contactId, phoneNumber, callerName, timestamp',
      whiteboardNotes: '++id, author, department, createdAt',
      settings: 'key, updatedAt'
    });
  }
}

export const db = new BiscuitDB();
