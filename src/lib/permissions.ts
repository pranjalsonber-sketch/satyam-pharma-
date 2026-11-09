import { UserProfile, UserRole } from '../types';

/**
 * Checks if the current user profile has master administrator privileges.
 */
export function isAdmin(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.email === 'pranjalsonber@gmail.com') return true;
  return profile.role === 'admin';
}

/**
 * Checks if the user is a manager or admin (authorized for pricing, margins, wholesale terms).
 */
export function isManager(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  if (isAdmin(profile)) return true;
  return profile.role === 'manager';
}

/**
 * Checks if the user is a clerk/staff member with restricted privacy permissions.
 */
export function isClerk(profile: UserProfile | null | undefined): boolean {
  if (!profile) return true;
  if (isAdmin(profile) || isManager(profile)) return false;
  return profile.role === 'clerk';
}

/**
 * Checks if the user is authorized to view sensitive business financials
 * (e.g. inventory total valuation, profit margins, supplier purchase rates, pending wholesale bills).
 */
export function canViewFinancials(profile: UserProfile | null | undefined): boolean {
  return isManager(profile);
}

/**
 * Checks if the user is authorized to view confidential wholesaler vendor agreements,
 * supplier contact lists, and discount margins.
 */
export function canViewSuppliers(profile: UserProfile | null | undefined): boolean {
  return isManager(profile);
}

/**
 * Checks if the user is authorized to view member login audit logs and active session IPs.
 */
export function canViewAuditLogs(profile: UserProfile | null | undefined): boolean {
  return isAdmin(profile);
}

/**
 * Checks if the user can execute bulk data deletion or system restore/backups.
 */
export function canManageSystem(profile: UserProfile | null | undefined): boolean {
  return isAdmin(profile);
}

/**
 * Returns a masked representation (e.g. '••••••') if the user is unauthorized,
 * otherwise returns the original value or formatted representation.
 */
export function maskSensitiveValue(
  originalFormattedValue: string | number,
  isAuthorized: boolean,
  maskText: string = '••••••'
): string {
  if (isAuthorized) {
    return String(originalFormattedValue);
  }
  return maskText;
}
