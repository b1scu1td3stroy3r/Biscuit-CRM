import { DepartmentRole } from './db';

export interface EnterpriseStaffMember {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  sourceDepartment: string;
  assignedRole: DepartmentRole;
  hierarchyTier: 'Trainee' | 'Specialist' | 'Senior Specialist' | 'Team Leader' | 'Manager' | 'Managing Director';
}

/**
 * Heuristically map enterprise Directory job titles & departments to Biscuit CRM roles.
 */
export function classifyStaffRole(jobTitle: string = '', department: string = ''): {
  role: DepartmentRole;
  tier: EnterpriseStaffMember['hierarchyTier'];
} {
  const text = `${jobTitle} ${department}`.toLowerCase();

  // Tier classification
  let tier: EnterpriseStaffMember['hierarchyTier'] = 'Specialist';
  if (text.includes('managing director') || text.includes('chief executive') || text.includes('founder') || text.includes('owner') || text.includes('general manager')) {
    tier = 'Managing Director';
  } else if (text.includes('director') || text.includes('head of') || text.includes('manager') || text.includes('vp') || text.includes('lead')) {
    tier = 'Manager';
  } else if (text.includes('senior') || text.includes('principal')) {
    tier = 'Senior Specialist';
  } else if (text.includes('junior') || text.includes('trainee') || text.includes('intern') || text.includes('assistant')) {
    tier = 'Trainee';
  }

  // Role classification
  if (tier === 'Managing Director' || text.includes('executive')) {
    return { role: 'MD', tier: 'Managing Director' };
  }
  if (text.includes('support') || text.includes('customer') || text.includes('service') || text.includes('helpdesk')) {
    return { role: 'Customer Services', tier };
  }
  if (text.includes('warehouse') || text.includes('logistics') || text.includes('dispatch') || text.includes('operation') || text.includes('fulfillment')) {
    return { role: 'Operations', tier };
  }
  if (text.includes('procurement') || text.includes('purchasing') || text.includes('buyer') || text.includes('vendor') || text.includes('stock')) {
    return { role: 'Procurement', tier };
  }
  if (text.includes('finance') || text.includes('account') || text.includes('billing') || text.includes('credit control') || text.includes('treasury')) {
    return { role: 'Finance', tier };
  }
  if (text.includes('marketing') || text.includes('growth') || text.includes('campaign') || text.includes('seo') || text.includes('outreach')) {
    return { role: 'Marketing', tier };
  }
  if (text.includes('it') || text.includes('developer') || text.includes('software') || text.includes('systems') || text.includes('network') || text.includes('infra')) {
    return { role: 'IT', tier };
  }
  if (text.includes('hr') || text.includes('people') || text.includes('talent') || text.includes('recruitment')) {
    return { role: 'HR', tier };
  }

  // Default fallback is Sales & Commercial
  return { role: 'Sales', tier };
}

/**
 * Ingest staff members from Microsoft Graph (/v1.0/users)
 */
export async function fetchMicrosoftDirectory(msAccessToken: string): Promise<EnterpriseStaffMember[]> {
  try {
    const res = await fetch('https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName,jobTitle,department', {
      headers: { Authorization: `Bearer ${msAccessToken}` }
    });
    if (!res.ok) throw new Error(`Microsoft Graph directory request failed: ${res.statusText}`);
    const data = await res.json();
    const users = data.value || [];

    return users.map((u: any) => {
      const email = u.mail || u.userPrincipalName || '';
      const { role, tier } = classifyStaffRole(u.jobTitle || '', u.department || '');
      return {
        id: u.id || `ms-${Math.random().toString(36).substring(2, 9)}`,
        name: u.displayName || email.split('@')[0],
        email,
        jobTitle: u.jobTitle || 'Business User',
        sourceDepartment: u.department || 'General',
        assignedRole: role,
        hierarchyTier: tier
      };
    });
  } catch (err) {
    console.warn('Unable to query Microsoft Graph Directory:', err);
    return [];
  }
}

/**
 * Ingest staff members from Google Workspace Directory (Admin SDK)
 */
export async function fetchGoogleDirectory(googleAccessToken: string): Promise<EnterpriseStaffMember[]> {
  try {
    // Try Google Admin Directory API if authorized, else fall back to domain profile extraction
    const res = await fetch('https://admin.googleapis.com/admin/directory/v1/users?customer=my_customer&maxResults=50', {
      headers: { Authorization: `Bearer ${googleAccessToken}` }
    });
    if (!res.ok) {
      // If not Google Workspace Admin, retrieve the individual user info
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${googleAccessToken}` }
      });
      if (!profileRes.ok) return [];
      const user = await profileRes.json();
      return [{
        id: user.sub,
        name: user.name || 'Enterprise Admin',
        email: user.email || '',
        jobTitle: 'Managing Director / Owner',
        sourceDepartment: 'Executive',
        assignedRole: 'MD',
        hierarchyTier: 'Managing Director'
      }];
    }
    const data = await res.json();
    const users = data.users || [];

    return users.map((u: any) => {
      const email = u.primaryEmail || '';
      const title = u.organizations?.[0]?.title || '';
      const dept = u.organizations?.[0]?.department || '';
      const { role, tier } = classifyStaffRole(title, dept);
      return {
        id: u.id || `g-${Math.random().toString(36).substring(2, 9)}`,
        name: u.name?.fullName || email.split('@')[0],
        email,
        jobTitle: title || 'Team Member',
        sourceDepartment: dept || 'General',
        assignedRole: role,
        hierarchyTier: tier
      };
    });
  } catch (err) {
    console.warn('Unable to query Google Workspace Directory:', err);
    return [];
  }
}
