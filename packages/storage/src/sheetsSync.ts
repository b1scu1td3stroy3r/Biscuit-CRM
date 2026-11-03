import { db } from './db';

const STORAGE_KEY_SHEET_ID = 'biscuit_crm_pipeline_sheet_id';
const DEFAULT_MASTER_SHEET_ID = '14BchRnN5ah4Q6opNG3wvmaAbZ15XgjTc-Nw58AuKQl';

export async function pullContactsFromGoogleSheet(accessToken: string, folderId: string) {
  let sheetId = localStorage.getItem(STORAGE_KEY_SHEET_ID) || DEFAULT_MASTER_SHEET_ID;

  // 1. Fetch metadata to get the actual name of the first sheet tab
  let metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  // If 404/403 with cached sheetId, fallback to DEFAULT_MASTER_SHEET_ID
  if (!metaRes.ok && sheetId !== DEFAULT_MASTER_SHEET_ID) {
    sheetId = DEFAULT_MASTER_SHEET_ID;
    metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
  }

  if (!metaRes.ok) {
    const err = await metaRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to access spreadsheet (Status: ${metaRes.status})`);
  }

  const metaData = await metaRes.json();
  const firstSheetTitle = metaData.sheets?.[0]?.properties?.title || 'Sheet1';

  // 2. Read rows from row 2 onwards using the discovered tab name
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(firstSheetTitle)}!A2:H?majorDimension=ROWS`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to read rows from sheet "${firstSheetTitle}"`);
  }

  const data = await res.json();
  const rows = data.values || [];
  let importedCount = 0;

  for (const r of rows) {
    if (!r[1]) continue; // Skip empty rows
    const email = r[4] || '';
    const existing = await db.contacts.where('email').equals(email).first();
    if (!existing) {
      await db.contacts.add({
        name: r[1],
        company: r[2] || '',
        crn: r[3] || '',
        email: email,
        phone: r[5] || '',
        stage: (r[6] as any) || 'Lead',
        synced: true,
        updatedAt: r[7] || new Date().toISOString(),
      });
      importedCount++;
    }
  }

  localStorage.setItem(STORAGE_KEY_SHEET_ID, sheetId);
  return { importedCount, sheetId, totalRows: rows.length };
}

export async function syncOutboxToGoogleSheets(accessToken: string, folderId?: string) {
  const pendingMutations = await db.outbox.toArray();
  const contacts = await db.contacts.toArray();

  if (contacts.length === 0) {
    return { syncedCount: 0, sheetId: null };
  }

  let sheetId = localStorage.getItem(STORAGE_KEY_SHEET_ID) || DEFAULT_MASTER_SHEET_ID;

  // Verify sheet exists or fetch its active tab
  let metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  let sheetTitle = 'Sheet1';
  if (metaRes.ok) {
    const metaData = await metaRes.json();
    sheetTitle = metaData.sheets?.[0]?.properties?.title || 'Sheet1';
  } else {
    // If not found, create one
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: { title: 'Biscuit_CRM_Pipeline_Master' },
        sheets: [{ properties: { title: 'Sheet1', gridProperties: { rowCount: 100, columnCount: 10 } } }],
      }),
    });

    if (!createRes.ok) {
      const errData = await createRes.json();
      throw new Error(errData.error?.message || 'Failed to create Google Sheet');
    }

    const createdSheet = await createRes.json();
    sheetId = createdSheet.spreadsheetId;
    sheetTitle = 'Sheet1';
    localStorage.setItem(STORAGE_KEY_SHEET_ID, sheetId as string);

    if (folderId && sheetId) {
      try {
        await fetch(`https://www.googleapis.com/drive/v3/files/${sheetId}?addParents=${folderId}&fields=id,parents`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch (e) {
        console.warn('Could not move file to folder:', e);
      }
    }
  }

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

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetTitle)}!A1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: `${sheetTitle}!A1`,
        majorDimension: 'ROWS',
        values: rows,
      }),
    }
  );

  if (!updateRes.ok) {
    const errData = await updateRes.json();
    throw new Error(errData.error?.message || 'Failed to update Google Sheet rows');
  }

  await db.contacts.toCollection().modify({ synced: true });
  await db.outbox.clear();

  return { syncedCount: pendingMutations.length, sheetId };
}
