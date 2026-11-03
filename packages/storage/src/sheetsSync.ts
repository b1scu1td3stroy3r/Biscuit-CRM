import { db } from './db';

const STORAGE_KEY_SHEET_ID = 'biscuit_crm_pipeline_sheet_id';

export async function pullContactsFromGoogleSheet(accessToken: string, folderId: string) {
  let sheetId = localStorage.getItem(STORAGE_KEY_SHEET_ID);

  // If not yet stored on this origin, prompt once for the existing Sheet ID or query Drive
  if (!sheetId) {
    try {
      const query = encodeURIComponent(`name = 'Biscuit_CRM_Pipeline_Master' and trashed = false`);
      const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        sheetId = searchData.files[0].id;
      }
    } catch (e) {
      console.warn('Drive search restricted:', e);
    }

    if (!sheetId) {
      const manualId = window.prompt(
        'Paste your Biscuit_CRM_Pipeline_Master Google Sheet ID (from the sheet URL between /d/ and /edit):'
      );
      if (!manualId || !manualId.trim()) {
        return { importedCount: 0, sheetId: null };
      }
      sheetId = manualId.trim();
    }
    localStorage.setItem(STORAGE_KEY_SHEET_ID, sheetId as string);
  }

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Contacts!A2:H?majorDimension=ROWS`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    // If the ID was invalid or expired from storage, clear it so user can re-enter
    localStorage.removeItem(STORAGE_KEY_SHEET_ID);
    throw new Error('Failed to fetch rows from spreadsheet. Check ID or permissions.');
  }

  const data = await res.json();
  const rows = data.values || [];
  let importedCount = 0;

  for (const r of rows) {
    if (!r[1]) continue;
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

  return { importedCount, sheetId };
}

export async function syncOutboxToGoogleSheets(accessToken: string, folderId?: string) {
  const pendingMutations = await db.outbox.toArray();
  const contacts = await db.contacts.toArray();

  if (contacts.length === 0) {
    return { syncedCount: 0, sheetId: null };
  }

  let sheetId = localStorage.getItem(STORAGE_KEY_SHEET_ID);

  if (!sheetId) {
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: { title: 'Biscuit_CRM_Pipeline_Master' },
        sheets: [{ properties: { title: 'Contacts', gridProperties: { rowCount: 100, columnCount: 10 } } }],
      }),
    });

    if (!createRes.ok) {
      const errData = await createRes.json();
      throw new Error(errData.error?.message || 'Failed to create Google Sheet');
    }

    const createdSheet = await createRes.json();
    sheetId = createdSheet.spreadsheetId;
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

  await db.contacts.toCollection().modify({ synced: true });
  await db.outbox.clear();

  return { syncedCount: pendingMutations.length, sheetId };
}
