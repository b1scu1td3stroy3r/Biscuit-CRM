import { db } from './db';

const AUDIT_SHEET_NAME = 'Audit_Ledger.xlsx';
const STORAGE_KEY_AUDIT_ID = 'biscuit_crm_audit_sheet_id';

export interface AuditRecord {
  timestamp: string;
  actor: string;
  action: 'CREATE_CONTACT' | 'UPDATE_STAGE' | 'SCHEDULE_MILESTONE' | 'CREATE_TEMPLATE';
  entityId: string;
  details: string;
}

export async function logAuditEvent(accessToken: string, folderId: string, record: AuditRecord) {
  let auditSheetId = localStorage.getItem(STORAGE_KEY_AUDIT_ID);

  if (!auditSheetId) {
    // 1. Create Audit_Ledger spreadsheet if it doesn't exist
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: 'Biscuit_CRM_Audit_Ledger',
        },
        sheets: [
          {
            properties: {
              title: 'Immutable_Audit_Log',
              gridProperties: { rowCount: 500, columnCount: 6 },
            },
          },
        ],
      }),
    });

    if (!createRes.ok) return;

    const data = await createRes.json();
    auditSheetId = data.spreadsheetId;
    localStorage.setItem(STORAGE_KEY_AUDIT_ID, auditSheetId as string);

    // Initialise headers
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${auditSheetId}/values/Immutable_Audit_Log!A1:E1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: 'Immutable_Audit_Log!A1:E1',
          majorDimension: 'ROWS',
          values: [['Timestamp (UTC)', 'Actor / Rep', 'Action Type', 'Entity ID', 'Operational Delta / Audit Details']],
        }),
      }
    );

    // Attempt to file into Biscuit_CRM folder
    if (folderId && auditSheetId) {
      try {
        await fetch(`https://www.googleapis.com/drive/v3/files/${auditSheetId}?addParents=${folderId}&fields=id,parents`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch (err) {
        console.warn('Could not move audit sheet into folder:', err);
      }
    }
  }

  // 2. Append immutable record to next free row
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${auditSheetId}/values/Immutable_Audit_Log!A:E:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: 'Immutable_Audit_Log!A:E',
        majorDimension: 'ROWS',
        values: [[record.timestamp, record.actor, record.action, record.entityId, record.details]],
      }),
    }
  );
}
