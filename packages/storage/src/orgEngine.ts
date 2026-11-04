import { EmployeeProfile, OrgStructureType, ClearanceLevel, Contact, db } from './db';

export const CLEARANCE_LABELS: Record<ClearanceLevel, { title: string; badge: string }> = {
  1: { title: 'Individual Contributor', badge: 'bg-slate-800 text-slate-300 border-slate-700' },
  2: { title: 'Team Lead', badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  3: { title: 'Head of Department', badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
  4: { title: 'Divisional VP / Director', badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  5: { title: 'Executive / Managing Director', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
};

/**
 * Resolves all employee IDs whose records are visible to the active user
 * according to the active organizational topology.
 */
export function resolveSubordinateIds(
  activeUser: EmployeeProfile,
  roster: EmployeeProfile[],
  structure: OrgStructureType
): number[] {
  if (!activeUser.id) return [];

  // Executive / Clearance 5 has omniscient visibility across the firm
  if ((activeUser.clearanceLevel || 1) >= 5 || activeUser.role === 'Managing Director') {
    return roster.map(e => e.id!).filter(Boolean);
  }

  // 1. LINEAR STRUCTURE (Flat / Functional)
  if (structure === 'Linear') {
    // If user has Lead or higher clearance, they see everyone in their department
    if ((activeUser.clearanceLevel || 1) >= 2) {
      return roster
        .filter(e => e.department === activeUser.department)
        .map(e => e.id!)
        .filter(Boolean);
    }
    // Individual contributor sees only their own accounts
    return [activeUser.id];
  }

  // 2. HIERARCHICAL STRUCTURE (Parent-child tree recursion)
  if (structure === 'Hierarchical') {
    const visibleIds = new Set<number>([activeUser.id]);
    const queue: number[] = [activeUser.id];

    while (queue.length > 0) {
      const parentId = queue.shift()!;
      const directReports = roster.filter(e => e.primaryManagerId === parentId);
      for (const report of directReports) {
        if (report.id && !visibleIds.has(report.id)) {
          visibleIds.add(report.id);
          queue.push(report.id);
        }
      }
    }
    return Array.from(visibleIds);
  }

  // 3. MATRIX STRUCTURE (Functional Manager + Project / Dotted-Line Managers)
  if (structure === 'Matrix') {
    const visibleIds = new Set<number>([activeUser.id]);

    for (const member of roster) {
      if (!member.id) continue;
      // Is primary direct report
      const isDirectReport = member.primaryManagerId === activeUser.id;
      // Is matrix dotted-line report
      const isMatrixReport = (member.matrixManagerIds || []).includes(activeUser.id);
      // Shares a project where activeUser is Lead or higher
      const sharesProject = member.assignedProjectIds?.some(p => 
        activeUser.assignedProjectIds?.includes(p)
      );

      if (isDirectReport || isMatrixReport || ((activeUser.clearanceLevel || 1) >= 2 && sharesProject)) {
        visibleIds.add(member.id);
      }
    }
    return Array.from(visibleIds);
  }

  return [activeUser.id];
}

/**
 * Filter contacts list according to user's permissions and organizational topology.
 */
export function scopeContactsByOrg(
  contacts: Contact[],
  activeUser: EmployeeProfile | null,
  roster: EmployeeProfile[],
  structure: OrgStructureType
): Contact[] {
  if (!activeUser) return contacts;

  // Clearance 5 sees all
  if ((activeUser.clearanceLevel || 1) >= 5 || activeUser.role === 'Managing Director') {
    return contacts;
  }

  const allowedEmployeeIds = resolveSubordinateIds(activeUser, roster, structure);
  const allowedNames = roster
    .filter(e => e.id && allowedEmployeeIds.includes(e.id))
    .map(e => e.name.toLowerCase());

  return contacts.filter(c => {
    // Check by ownerId
    if (c.ownerId && allowedEmployeeIds.includes(c.ownerId)) return true;
    // Check secondary matrix assignees
    if (c.secondaryAssigneeIds?.some(id => allowedEmployeeIds.includes(id))) return true;
    // Fallback match on accountManager string
    if (c.accountManager && allowedNames.includes(c.accountManager.toLowerCase())) return true;
    return false;
  });
}
