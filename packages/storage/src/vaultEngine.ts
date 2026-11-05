import { Contact } from './db';

export interface VaultDiscoveryResult {
  provider: 'google' | 'microsoft';
  vaultId: string;
  vaultName: string;
  foundExistingDatabase: boolean;
  contactsDiscovered: Contact[];
}

/**
 * Scan Google Drive for Biscuit CRM database or customer export files
 */
export async function discoverGoogleVault(accessToken: string): Promise<VaultDiscoveryResult> {
  // 1. Locate or create workspace folder
  const folderQuery = encodeURIComponent("name = 'Biscuit CRM Vault' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
  let folderRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${folderQuery}&fields=files(id, name)`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  let folderData = await folderRes.json();
  let folderId = folderData.files?.[0]?.id;

  if (!folderId) {
    const createFolder = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Biscuit CRM Vault',
        mimeType: 'application/vnd.google-apps.folder'
      })
    });
    const folderJson = await createFolder.json();
    folderId = folderJson.id;
  }

  // 2. Search for biscuit_data.json or customer CSV inside the vault folder
  const fileQuery = encodeURIComponent(`'${folderId}' in parents and (name = 'biscuit_data.json' or mimeType = 'text/csv') and trashed = false`);
  const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${fileQuery}&fields=files(id, name, mimeType)`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const fileData = await fileRes.json();
  const existingFiles = fileData.files || [];

  let contacts: Contact[] = [];
  let foundDb = false;

  for (const file of existingFiles) {
    if (file.name === 'biscuit_data.json') {
      foundDb = true;
      const download = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (download.ok) {
        try {
          const parsed = await download.json();
          if (Array.isArray(parsed.contacts)) {
            contacts = parsed.contacts;
          }
        } catch (e) {
          console.warn('Could not parse existing biscuit_data.json', e);
        }
      }
      break;
    }
  }

  return {
    provider: 'google',
    vaultId: folderId,
    vaultName: 'Biscuit CRM Vault (Google Drive)',
    foundExistingDatabase: foundDb,
    contactsDiscovered: contacts
  };
}

/**
 * Scan Microsoft OneDrive for Biscuit CRM database or customer export files
 */
export async function discoverMicrosoftVault(accessToken: string): Promise<VaultDiscoveryResult> {
  const MS_GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
  let folderId = '';
  let contacts: Contact[] = [];
  let foundDb = false;

  try {
    // 1. Check or create Biscuit CRM Vault in OneDrive root
    const checkRes = await fetch(`${MS_GRAPH_BASE}/me/drive/root:/Biscuit_CRM_Vault`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (checkRes.ok) {
      const data = await checkRes.json();
      folderId = data.id;
    } else {
      const createRes = await fetch(`${MS_GRAPH_BASE}/me/drive/root/children`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Biscuit_CRM_Vault',
          folder: {},
          '@microsoft.graph.conflictBehavior': 'rename'
        })
      });
      if (createRes.ok) {
        const createData = await createRes.json();
        folderId = createData.id;
      }
    }

    // 2. Check for existing biscuit_data.json
    if (folderId) {
      const dbRes = await fetch(`${MS_GRAPH_BASE}/me/drive/items/${folderId}:/biscuit_data.json:/content`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (dbRes.ok) {
        foundDb = true;
        const parsed = await dbRes.json();
        if (Array.isArray(parsed.contacts)) {
          contacts = parsed.contacts;
        }
      }
    }
  } catch (err) {
    console.warn('Error discovering Microsoft Vault:', err);
  }

  return {
    provider: 'microsoft',
    vaultId: folderId || 'ms-vault',
    vaultName: 'Biscuit CRM Vault (Microsoft OneDrive)',
    foundExistingDatabase: foundDb,
    contactsDiscovered: contacts
  };
}
