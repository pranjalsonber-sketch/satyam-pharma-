import { logActivity, LogActivityOptions } from './logger';
import { UserRole } from '../types';

export type AuditCategory = 
  | 'role_change' 
  | 'margin_view' 
  | 'financial_export' 
  | 'system_config' 
  | 'security_event' 
  | 'system_backup';

export interface AuditActionOptions {
  action: string;
  category: AuditCategory;
  description: string;
  module?: 'pos' | 'inventory' | 'patients' | 'wholesalers' | 'regulatory' | 'settings' | 'auth' | 'system';
  userEmail?: string;
  userId?: string;
  userName?: string;
  userRole?: UserRole | string;
  details?: Record<string, any>;
  severity?: 'info' | 'success' | 'warning' | 'danger';
  ipAddress?: string;
}

/**
 * Record a high-priority system audit log for sensitive operations
 * (e.g. role edits, viewing profit margins, modifying alert thresholds, disaster recovery).
 */
export const logAuditAction = async (options: AuditActionOptions) => {
  try {
    const details = {
      ...(options.details || {}),
      auditCategory: options.category,
      isSystemAudit: true,
      loggedAt: new Date().toISOString()
    };

    // Default severity mapping based on category if not explicitly provided
    let severity = options.severity;
    if (!severity) {
      if (options.category === 'role_change' || options.category === 'security_event' || options.category === 'system_backup') {
        severity = 'warning';
      } else if (options.category === 'margin_view' || options.category === 'financial_export') {
        severity = 'info';
      } else {
        severity = 'info';
      }
    }

    const payload: LogActivityOptions = {
      action: options.action,
      description: options.description,
      type: 'auth', // 'auth' / 'system' will register as administrative audit
      module: options.module || (options.category === 'role_change' || options.category === 'security_event' ? 'auth' : 'settings'),
      userEmail: options.userEmail,
      userName: options.userName,
      userRole: options.userRole,
      details,
      severity
    };

    if (options.userId !== undefined) payload.userId = options.userId;
    if (options.ipAddress !== undefined) payload.ipAddress = options.ipAddress;

    await logActivity(payload);
  } catch (error) {
    console.error('Failed to log audit action:', error);
  }
};
