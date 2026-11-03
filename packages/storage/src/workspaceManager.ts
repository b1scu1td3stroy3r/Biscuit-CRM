/**
 * Dynamic Multi-Tenant Workspace Provisioner
 * Ensures each business or sole trader persists ONLY to their own Google account.
 */

export interface UserWorkspaceConfig {
  userEmail: string;
  userName: string;
  domain: string;
  isPersonalAccount: boolean;
  driveFolderId: string;
}

export async function resolveUserWorkspace(token: string): Promise<UserWorkspaceConfig> {
  // 1. Fetch user identity from Google UserInfo endpoint
  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!userRes.ok) {
    throw new Error('Failed to retrieve user identity from Google OAuth.');
  }

  const userInfo = await userRes.json();
  const userEmail: string = userInfo.email || '';
  const userName: string = userInfo.name || userEmail.split('@')[0];
  const domain = userEmail.split('@')[1] || '';
  const isPersonalAccount = domain === 'gmail.com' || domain === 'googlemail.com';

  // 2. Check local cache first
  const cacheKey = `biscuit_workspace_${userEmail}`;
  const cachedFolder = localStorage.getItem(cacheKey);
  if (cachedFolder) {
    return {
      userEmail,
      userName,
      domain,
      isPersonalAccount,
      driveFolderId: cachedFolder,
    };
  }

  // 3. Search user's own Drive for existing "Biscuit CRM Workspace" folder
  const query = encodeURIComponent("name = 'Biscuit CRM Workspace' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id, name)`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  let folderId = '';
  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      folderId = searchData.files[0].id;
    }
  }

  // 4. If folder does not exist in their Drive, create it privately for them
  if (!folderId) {
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Biscuit CRM Workspace',
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (!createRes.ok) {
      throw new Error('Failed to create private workspace folder in user Google Drive.');
    }

    const created = await createRes.json();
    folderId = created.id;
  }

  localStorage.setItem(cacheKey, folderId);

  return {
    userEmail,
    userName,
    domain,
    isPersonalAccount,
    driveFolderId: folderId,
  };
}
