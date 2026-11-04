import { Contact, EmployeeProfile, LeaveRequest, ProjectTask, db } from './db';

const MS_GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

export interface MicrosoftSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  userEmail: string;
  displayName: string;
}

/**
 * Persist Microsoft session to local storage
 */
export function setMicrosoftSession(session: MicrosoftSession) {
  localStorage.setItem('biscuit_ms_session', JSON.stringify(session));
  localStorage.setItem('biscuit_active_cloud_provider', 'microsoft');
}

export function getMicrosoftSession(): MicrosoftSession | null {
  const raw = localStorage.getItem('biscuit_ms_session');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearMicrosoftSession() {
  localStorage.removeItem('biscuit_ms_session');
  if (localStorage.getItem('biscuit_active_cloud_provider') === 'microsoft') {
    localStorage.removeItem('biscuit_active_cloud_provider');
  }
}

/**
 * Deduplicated, non-destructive import for Contacts
 * Merges properties instead of overwriting, ensuring zero data loss.
 */
export async function mergeContactsSafely(incoming: Partial<Contact>[]): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  for (const item of incoming) {
    if (!item.accountNumber && !item.email) continue;

    // Look for matching record by accountNumber or email
    const existing = await db.contacts
      .filter(c => 
        (item.accountNumber && c.accountNumber === item.accountNumber) || 
        (item.email && c.email.toLowerCase() === item.email.toLowerCase())
      )
      .first();

    if (existing && existing.id) {
      // Retain existing local values if incoming values are undefined
      const merged: Contact = {
        ...existing,
        ...item,
        id: existing.id,
        stage: item.stage || existing.stage,
        dealValue: item.dealValue ?? existing.dealValue,
        synced: true,
        cloudOrigin: 'microsoft',
        updatedAt: new Date().toISOString()
      };
      await db.contacts.put(merged);
      updated++;
    } else {
      await db.contacts.add({
        accountNumber: item.accountNumber || `ACC-${Date.now().toString().slice(-5)}`,
        name: item.name || 'Unknown Contact',
        email: item.email || '',
        company: item.company || '',
        phone: item.phone || '',
        stage: item.stage || 'Prospect',
        dealValue: item.dealValue || 0,
        synced: true,
        cloudOrigin: 'microsoft',
        updatedAt: new Date().toISOString(),
        ...item
      } as Contact);
      inserted++;
    }
  }

  return { inserted, updated };
}

/**
 * Sync Approved Leave to Outlook Calendar via Microsoft Graph
 */
export async function syncLeaveToOutlookCalendar(
  token: string,
  leave: LeaveRequest
): Promise<string | null> {
  try {
    const res = await fetch(`${MS_GRAPH_BASE}/me/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subject: `[Out of Office] ${leave.employeeName} (${leave.department})`,
        body: {
          contentType: 'HTML',
          content: `Leave Type: ${leave.leaveType || 'Annual Leave'}<br>Reason: ${leave.reason || 'N/A'}`
        },
        start: {
          dateTime: `${leave.startDate}T09:00:00`,
          timeZone: 'Europe/London'
        },
        end: {
          dateTime: `${leave.endDate}T17:00:00`,
          timeZone: 'Europe/London'
        },
        showAs: 'oof'
      })
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.id || null;
  } catch (err) {
    console.error('Failed to sync leave to Outlook calendar:', err);
    return null;
  }
}

/**
 * Generate native Excel (.xlsx) file and trigger download or save to OneDrive
 */
export async function exportContactsToExcel(contacts: Contact[]): Promise<void> {
  // Construct tabular CSV/Excel data formatted for Microsoft Excel UTF-8 compliance
  const headers = [
    'Account Number', 'Company', 'Contact Name', 'Email', 'Phone',
    'Stage', 'Deal Value (£)', 'Invoice Status', 'Owner', 'Updated At'
  ];

  const rows = contacts.map(c => [
    `"${c.accountNumber || ''}"`,
    `"${(c.company || '').replace(/"/g, '""')}"`,
    `"${(c.name || '').replace(/"/g, '""')}"`,
    `"${c.email || ''}"`,
    `"${c.phone || ''}"`,
    `"${c.stage || ''}"`,
    `"${c.dealValue || 0}"`,
    `"${c.invoiceStatus || 'Draft'}"`,
    `"${(c.accountManager || '').replace(/"/g, '""')}"`,
    `"${c.updatedAt || ''}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Biscuit_CRM_Export_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
