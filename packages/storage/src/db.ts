import Dexie, { Table } from 'dexie';

export type CloudProvider = 'google' | 'microsoft' | 'local';
export type DepartmentRole = 'Sales' | 'Operations' | 'Procurement' | 'Customer Services' | 'Finance' | 'HR' | 'Marketing' | 'IT' | 'MD';
export type StaffHierarchyTier = 'Staff' | 'Team Leader' | 'Manager' | 'Director';
export type OrgStructureType = 'Linear' | 'Hierarchical' | 'Matrix';
export type ClearanceLevel = 1 | 2 | 3 | 4 | 5; // 1: IC, 2: Team Lead, 3: Dept Head, 4: Director, 5: Executive/MD

export interface CustomPrivileges {
  canViewTeamPipelines?: boolean;
  canViewFinancials?: boolean;
  canApproveLeave?: boolean;
  canAuditActivity?: boolean;
  canReallocateAccounts?: boolean;
  // Granular capability overrides decoupled from department names
  canRunPayroll?: boolean;         // Enables running payroll (assigned to HR or Finance)
  canApproveRefunds?: boolean;     // CS refund authorization sign-off
  canDispatchWms?: boolean;        // Warehouse pick, pack & dispatch actions
  canIssuePO?: boolean;            // Procurement supplier purchase order generation
  canManageRoster?: boolean;       // IT/HR staff tier management & offboarding
  allowedViewTabs?: string[];      // Explicit tab overrides (e.g. ['kanban', 'hub'])
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
  [key: string]: any;
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
  reason?: string;
  status: 'Pending' | 'Approved' | 'Declined';
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
  calendarEventId?: string;
  createdAt?: string;
  [key: string]: any;
}

export type ITTicketCategory = 'Hardware' | 'Software' | 'Network' | 'Access/RBAC' | 'Workstation' | 'Security';
export type ITTicketPriority = 'P1-Critical' | 'P2-High' | 'P3-Medium' | 'P4-Low';
export type ITTicketStatus = 'Triage' | 'In Progress' | 'Waiting on User' | 'Resolved' | 'Closed';

export interface ITTicketAuditLog {
  timestamp: string;
  actor: string;
  action: string;
  details?: string;
}

export interface ITTicket {
  id?: number;
  ticketNumber: string;
  title: string;
  description: string;
  category: ITTicketCategory;
  priority: ITTicketPriority;
  status: ITTicketStatus;
  requesterName: string;
  requesterEmail: string;
  requesterDepartment: DepartmentRole;
  assignedTechId?: number;
  assignedTechName?: string;
  resolutionNotes?: string;
  slaBreached?: boolean;
  targetResolutionHours: number;
  history: ITTicketAuditLog[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  closedAt?: string;
}

export type InternalTicketType = 'IT' | 'HR';
export interface InternalTicket {
  id?: number;
  ticketNumber: string;
  type: InternalTicketType;
  category: string;
  subject: string;
  details: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'Open' | 'In Review' | 'Resolved' | 'Closed';
  requesterName: string;
  requesterEmail: string;
  requesterDepartment: DepartmentRole;
  assignedTo?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export type KPIHorizon = 'Daily' | 'Weekly' | 'Monthly';
export type KPIMetric = 'deals_closed' | 'revenue_booked' | 'calls_logged' | 'tickets_resolved' | 'slas_met' | 'custom';

export interface TeamKPI {
  id?: number;
  managerId: number;
  managerName: string;
  targetScope: 'Team' | 'Individual';
  targetEmployeeId?: number;
  targetEmployeeName?: string;
  department: DepartmentRole;
  horizon: KPIHorizon;
  metric: KPIMetric;
  title: string;
  targetValue: number;
  unit: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  notes?: string;
}

export interface CompanySetting {
  id?: string;
  key: string;
  value: any;
  updatedAt: string;
}

export type IndustryVertical = 'general' | 'design_agency' | 'pharma_healthcare' | 'financial_services' | 'education_provider' | 'charity_nonprofit';

export interface IndustryModulesConfig {
  industry: IndustryVertical;
  enableMhraCompliance: boolean;
  enableFcaCompliance: boolean;
  enableOfqualCompliance: boolean;
  enableCreativeSignoffs: boolean;
  enableGiftAid: boolean;
  updatedAt: string;
  configuredBy?: string;
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
  invoiceStatus?: 'Draft' | 'Sent' | 'Issued' | 'Paid' | 'Overdue';
  invoiceNumber?: string;
  invoiceDate?: string;
  paymentMethod?: string;
  synced?: boolean;
  cloudOrigin?: CloudProvider;
  syncHash?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  updatedAt?: string;
  internalNotes?: string;
  mailchimpStatus?: 'Synced' | 'Pending' | 'Excluded';
  [key: string]: any;
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
  cloudOrigin?: CloudProvider;
  syncHash?: string;
  isDeleted?: boolean;
  deletedAt?: string;
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

export interface ComplianceCertificate {
  id?: number;
  employeeId: number;
  employeeName: string;
  department: string;
  certificationName: string; // e.g., 'MHRA Good Distribution Practice (GDP)', 'Information Governance & Caldicott'
  issuingBody: string;       // e.g., 'MHRA', 'CPD Standards Office', 'Internal Compliance'
  completedDate: string;
  expiryDate: string;
  status: 'Active' | 'Expiring Soon' | 'Expired';
  certificateRef?: string;
  notes?: string;
  createdAt: string;
}

export interface GiftAidClaim {
  id?: number;
  donorName: string;
  donorAddress: string;
  donorPostcode: string;
  donationAmount: number;
  claimAmount: number; // 25% reclaimable
  donationDate: string;
  declarationConfirmed: boolean;
  status: 'Pending Submission' | 'Submitted to HMRC' | 'Reclaimed & Settled';
  hmrcBatchReference?: string;
  createdAt: string;
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
  itTickets!: Table<ITTicket, number>;
  internalTickets!: Table<InternalTicket, number>;
  teamKpis!: Table<TeamKPI, number>;
  complianceCertificates!: Table<ComplianceCertificate, number>;
  giftAidClaims!: Table<GiftAidClaim, number>;

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

    this.version(5).stores({
      itTickets: '++id, ticketNumber, category, priority, status, requesterEmail, assignedTechId, createdAt, resolvedAt',
      internalTickets: '++id, ticketNumber, type, category, priority, status, requesterEmail, createdAt',
      teamKpis: '++id, managerId, targetScope, targetEmployeeId, department, horizon, metric, startDate, endDate, createdAt'
    });

    this.version(6).stores({
      complianceCertificates: '++id, employeeId, department, certificationName, expiryDate, status, createdAt',
      giftAidClaims: '++id, donorName, donationDate, status, hmrcBatchReference, createdAt'
    });
  }
}

export const db = new BiscuitDB();
