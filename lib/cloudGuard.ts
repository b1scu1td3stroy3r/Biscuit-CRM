export interface EmployeeSession {
  role?: string;
  division?: string;
  isSoleTrader?: boolean;
}

export function canAccessCloudAndDataSettings(user?: EmployeeSession | null): boolean {
  if (!user) return false;
  const isMD = user.role === 'Managing Director' || user.division === 'MD Division' || Boolean(user.isSoleTrader);
  const isIT = user.division === 'IT' || user.role === 'IT Admin' || user.role === 'IT Manager';
  return isMD || isIT;
}
