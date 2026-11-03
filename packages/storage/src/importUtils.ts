import { Contact, EmployeeProfile, DepartmentRole, StaffHierarchyTier, db } from './db';

export interface ParseResult<T> {
  valid: T[];
  errors: string[];
}

// Simple RFC-4180 compliant CSV parser
export function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let field = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(field.trim());
      field = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      row.push(field.trim());
      if (row.length > 0 && row.some(cell => cell.length > 0)) {
        lines.push(row);
      }
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    lines.push(row);
  }

  return lines;
}

export function parseContactsCSV(csvText: string): ParseResult<Partial<Contact>> {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return { valid: [], errors: ['CSV contains no data rows.'] };

  const headers = rows[0].map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const valid: Partial<Contact>[] = [];
  const errors: string[] = [];

  const getIdx = (candidates: string[]) => headers.findIndex(h => candidates.includes(h));

  const nameIdx = getIdx(['name', 'contact', 'customer', 'fullname', 'contactname', 'leadname']);
  const companyIdx = getIdx(['company', 'organization', 'organisation', 'account', 'business', 'companyname']);
  const emailIdx = getIdx(['email', 'emailaddress', 'mail']);
  const phoneIdx = getIdx(['phone', 'phonenumber', 'telephone', 'mobile', 'tel']);
  const stageIdx = getIdx(['stage', 'pipelinestage', 'status', 'funnel']);
  const crnIdx = getIdx(['crn', 'companynumber', 'registrationnumber']);
  const dealValueIdx = getIdx(['dealvalue', 'value', 'amount', 'contractvalue', 'revenue']);
  const managerIdx = getIdx(['accountmanager', 'rep', 'owner', 'assignedto']);
  const billingIdx = getIdx(['billingaddress', 'address', 'billing']);

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const name = nameIdx !== -1 ? row[nameIdx] : '';
    const email = emailIdx !== -1 ? row[emailIdx] : '';

    if (!name && !email) {
      errors.push(`Row ${r + 1}: Skipped (Missing both Name and Email).`);
      continue;
    }

    let stage: Contact['stage'] = 'Lead';
    const rawStage = (stageIdx !== -1 ? row[stageIdx] : '').toLowerCase();
    if (rawStage.includes('prospect') || rawStage.includes('cold')) stage = 'Prospect';
    else if (rawStage.includes('sale') || rawStage.includes('demo') || rawStage.includes('negoti')) stage = 'Sales';
    else if (rawStage.includes('procure') || rawStage.includes('quote') || rawStage.includes('legal')) stage = 'Procurement';
    else if (rawStage.includes('logistic') || rawStage.includes('dispatch') || rawStage.includes('deliver')) stage = 'Logistics';
    else if (rawStage.includes('custom') || rawStage.includes('service') || rawStage.includes('retention') || rawStage.includes('active')) stage = 'Customer Service';
    else if (rawStage.includes('winback') || rawStage.includes('lost') || rawStage.includes('churn')) stage = 'Winback';

    const dealValueRaw = dealValueIdx !== -1 ? parseFloat(row[dealValueIdx]?.replace(/[^0-9.]/g, '') || '0') : 0;

    valid.push({
      name: name || email.split('@')[0],
      company: companyIdx !== -1 ? row[companyIdx] : '',
      email: email || `${(name || 'client').toLowerCase().replace(/\s+/g, '.')}@unknown.internal`,
      phone: phoneIdx !== -1 ? row[phoneIdx] : '',
      stage,
      crn: crnIdx !== -1 ? row[crnIdx] : '',
      dealValue: isNaN(dealValueRaw) ? 0 : dealValueRaw,
      accountManager: managerIdx !== -1 ? row[managerIdx] : '',
      billingAddress: billingIdx !== -1 ? row[billingIdx] : '',
    });
  }

  return { valid, errors };
}

export function parseStaffCSV(csvText: string): ParseResult<Partial<EmployeeProfile>> {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return { valid: [], errors: ['CSV contains no data rows.'] };

  const headers = rows[0].map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const valid: Partial<EmployeeProfile>[] = [];
  const errors: string[] = [];

  const getIdx = (candidates: string[]) => headers.findIndex(h => candidates.includes(h));

  const nameIdx = getIdx(['name', 'fullname', 'employee', 'staffname', 'member']);
  const roleIdx = getIdx(['role', 'jobtitle', 'title', 'position']);
  const deptIdx = getIdx(['department', 'dept', 'team']);
  const tierIdx = getIdx(['tier', 'level', 'seniority', 'hierarchy']);

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const name = nameIdx !== -1 ? row[nameIdx] : '';

    if (!name) {
      errors.push(`Row ${r + 1}: Skipped (Missing staff name).`);
      continue;
    }

    let department: DepartmentRole = 'Sales';
    const rawDept = (deptIdx !== -1 ? row[deptIdx] : '').toLowerCase();
    if (rawDept.includes('op')) department = 'Operations';
    else if (rawDept.includes('fin') || rawDept.includes('account')) department = 'Finance';
    else if (rawDept.includes('hr') || rawDept.includes('people')) department = 'HR';
    else if (rawDept.includes('market') || rawDept.includes('growth')) department = 'Marketing';
    else if (rawDept.includes('it') || rawDept.includes('tech') || rawDept.includes('dev')) department = 'IT';
    else if (rawDept.includes('md') || rawDept.includes('exec') || rawDept.includes('direct')) department = 'MD';

    let tier: StaffHierarchyTier = 'Staff';
    const rawTier = (tierIdx !== -1 ? row[tierIdx] : '').toLowerCase();
    if (rawTier.includes('lead')) tier = 'Team Leader';
    else if (rawTier.includes('manag')) tier = 'Manager';
    else if (rawTier.includes('direct') || rawTier.includes('vp') || rawTier.includes('c-level')) tier = 'Director';

    valid.push({
      name,
      role: roleIdx !== -1 && row[roleIdx] ? row[roleIdx] : `${department} Specialist`,
      department,
      tier,
      status: 'Active',
      xp: tier === 'Director' ? 1000 : tier === 'Manager' ? 750 : tier === 'Team Leader' ? 500 : 200,
      level: tier === 'Director' ? 5 : tier === 'Manager' ? 4 : tier === 'Team Leader' ? 3 : 2,
    });
  }

  return { valid, errors };
}
