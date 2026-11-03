import { db } from './db';

const STORAGE_KEY_SHEET_ID = 'biscuit_crm_pipeline_sheet_id';

export async function syncOutboxToGoogleSheets(accessToken: string, folderId?: string) {
  const pendingMutations = await db.outbox.toArray();
  const contacts = await db.contacts.toArray();

  if (contacts.length === 0) {
    return { syncedCount: 0, sheetId: null };
  }

  // 1. Get existing Sheet ID from local cache or create a fresh one directly via Sheets API
  let sheetId = localStorage.getItem(STORAGE_KEY_SHEET_ID);

  if (!sheetId) {
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: 'Biscuit_CRM_Pipeline_Master',
        },
        sheets: [
          {
            properties: {
              title: 'Contacts',
              gridProperties: { rowCount: 100, columnCount: 10 },
            },
          },
        ],
      }),
    });

    if (!createRes.ok) {
      const errData = await createRes.json();
      throw new Error(errData.error?.message || 'Failed to create Google Sheet');
    }

    const createdSheet = await createRes.json();
    sheetId = createdSheet.spreadsheetId;
    localStorage.setItem(STORAGE_KEY_SHEET_ID, sheetId as string);

    // If folderId is present, attempt to organize it into Biscuit_CRM folder non-blockingly
    if (folderId && sheetId) {
      try {
        await fetch(`https://www.googleapis.com/drive/v3/files/${sheetId}?addParents=${folderId}&fields=id,parents`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch (e) {
        console.warn('Could not move file to folder, sheet remains in root Drive:', e);
      }
    }
  }

  // 2. Format contacts into spreadsheet table rows
  const rows = [
    ['Contact ID', 'Contact Name', 'Company Name', 'CRN', 'Email', 'Phone', 'Lifecycle Stage', 'Updated Timestamp'],
    ...contacts.map((c) => [
      c.id ?? '',
      c.name,
      c.company || '',
      c.crn || '',
      c.email,
      c.phone || '',
      c.stage,
      c.updatedAt,
    ]),
  ];

  // 3. Populate Contacts tab
  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Contacts!A1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: 'Contacts!A1',
        majorDimension: 'ROWS',
        values: rows,
      }),
    }
  );

  if (!updateRes.ok) {
    const errData = await updateRes.json();
    throw new Error(errData.error?.message || 'Failed to update Google Sheet rows');
  }

  // 4. Mark Dexie IndexedDB records as synced and purge outbox
  await db.contacts.toCollection().modify({ synced: true });
  await db.outbox.clear();

  return { syncedCount: pendingMutations.length, sheetId };
}
