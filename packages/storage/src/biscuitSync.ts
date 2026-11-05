import { Contact } from './db';

let syncTimeout: any = null;
let isSyncing = false;

export interface SyncPayload {
  contacts: Contact[];
  lastSyncedAt: string;
  schemaVersion: number;
}

/**
 * Commits current workspace records back to Google Drive or OneDrive
 */
export async function pushToEnterpriseCloud(
  provider: 'google' | 'microsoft',
  accessToken: string,
  vaultFolderId: string,
  contacts: Contact[]
): Promise<boolean> {
  const payload: SyncPayload = {
    contacts,
    lastSyncedAt: new Date().toISOString(),
    schemaVersion: 1
  };
  const jsonContent = JSON.stringify(payload, null, 2);

  try {
    if (provider === 'google') {
      // 1. Locate file id if it exists
      const query = encodeURIComponent(`'${vaultFolderId}' in parents and name = 'biscuit_data.json' and trashed = false`);
      const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await searchRes.json();
      const existingFileId = data.files?.[0]?.id;

      if (existingFileId) {
        // Update existing file content
        await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: jsonContent
        });
      } else {
        // Multipart creation
        const boundary = '-------314159265358979323846';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelim = `\r\n--${boundary}--`;
        const metadata = JSON.stringify({
          name: 'biscuit_data.json',
          parents: [vaultFolderId],
          mimeType: 'application/json'
        });
        const multipartBody = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${metadata}${delimiter}Content-Type: application/json\r\n\r\n${jsonContent}${closeDelim}`;

        await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: multipartBody
        });
      }
      return true;
    }

    if (provider === 'microsoft') {
      const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${vaultFolderId}:/biscuit_data.json:/content`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: jsonContent
      });
      return res.ok;
    }
  } catch (err) {
    console.error('Biscuit Sync Error:', err);
    return false;
  }

  return false;
}

/**
 * Debounced Biscuit Sync: auto-pushes state after 2.5 seconds of idle
 */
export function scheduleBiscuitSync(
  provider: 'google' | 'microsoft',
  accessToken: string,
  vaultFolderId: string,
  contacts: Contact[],
  onStatusChange?: (status: 'idle' | 'syncing' | 'saved') => void
) {
  if (syncTimeout) clearTimeout(syncTimeout);
  if (onStatusChange) onStatusChange('syncing');

  syncTimeout = setTimeout(async () => {
    if (isSyncing) return;
    isSyncing = true;
    const ok = await pushToEnterpriseCloud(provider, accessToken, vaultFolderId, contacts);
    isSyncing = false;
    if (onStatusChange) onStatusChange(ok ? 'saved' : 'idle');
  }, 2500);
}
