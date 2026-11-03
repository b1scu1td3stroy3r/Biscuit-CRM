import { Contact, AuditRecord } from './db';

function escapeCSV(field: any): string {
  if (field === null || field === undefined) return '""';
  const str = String(field);
  return `"${str.replace(/"/g, '""')}"`;
}

function downloadBlob(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportPipelineToCSV(contacts: Contact[]) {
  const headers = [
    'Account Number',
    'Customer Name',
    'Company',
    'CRN',
    'Email',
    'Phone',
    'Lifecycle Stage',
    'Account Manager',
    'Billing Address',
    'Shipping Address',
    'Internal Notes',
    'Last Updated'
  ];

  const rows = contacts.map(c => [
    escapeCSV(c.accountNumber),
    escapeCSV(c.name),
    escapeCSV(c.company || ''),
    escapeCSV(c.crn || ''),
    escapeCSV(c.email),
    escapeCSV(c.phone || ''),
    escapeCSV(c.stage),
    escapeCSV(c.accountManager || ''),
    escapeCSV(c.billingAddress || ''),
    escapeCSV(c.shippingAddress || ''),
    escapeCSV(c.internalNotes || ''),
    escapeCSV(c.updatedAt)
  ].join(','));

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const filename = `biscuit_crm_pipeline_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadBlob(csvContent, filename);
}

export function exportAuditLogsToCSV(logs: AuditRecord[]) {
  const headers = [
    'Timestamp',
    'Actor',
    'Action Type',
    'Entity Reference',
    'Audit Description / Details'
  ];

  const rows = logs.map(l => [
    escapeCSV(l.timestamp),
    escapeCSV(l.actor),
    escapeCSV(l.action),
    escapeCSV(l.entityId),
    escapeCSV(l.details)
  ].join(','));

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const filename = `biscuit_crm_audit_trail_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadBlob(csvContent, filename);
}
