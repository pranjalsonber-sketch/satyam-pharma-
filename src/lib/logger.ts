import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import { ActivityLog } from '../types';

export interface LogActivityOptions {
  action: string;
  description: string;
  type?: ActivityLog['type'];
  module?: 'pos' | 'inventory' | 'patients' | 'wholesalers' | 'regulatory' | 'settings' | 'auth' | string;
  userEmail?: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  details?: Record<string, any>;
  severity?: 'info' | 'success' | 'warning' | 'danger';
  ipAddress?: string;
}

/**
 * Recursively strips undefined values so that Firestore addDoc does not throw
 * "Unsupported field value: undefined" errors.
 */
export function cleanForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as any;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(item => (item === undefined ? null : cleanForFirestore(item))) as any;
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      result[key] = cleanForFirestore(value);
    }
  }
  return result as T;
}

export const logActivity = async (
  actionOrOptions: string | LogActivityOptions, 
  description?: string, 
  type?: ActivityLog['type'],
  userEmail?: string,
  extra?: {
    module?: string;
    userId?: string;
    userName?: string;
    userRole?: string;
    details?: Record<string, any>;
    severity?: 'info' | 'success' | 'warning' | 'danger';
    ipAddress?: string;
  }
) => {
  try {
    let payload: Record<string, any>;

    if (typeof actionOrOptions === 'object') {
      const opts = actionOrOptions;
      // Derive inferred module if not provided
      let inferredModule = opts.module;
      if (!inferredModule) {
        if (opts.type === 'sale') inferredModule = 'pos';
        else if (opts.type === 'inventory') inferredModule = 'inventory';
        else if (opts.type === 'patient') inferredModule = 'patients';
        else if (opts.type === 'wholesaler') inferredModule = 'wholesalers';
        else inferredModule = 'system';
      }

      payload = {
        action: opts.action,
        description: opts.description,
        type: opts.type || (inferredModule === 'pos' ? 'sale' : 'inventory'),
        module: inferredModule,
        userEmail: opts.userEmail || 'admin@satyampharma.com',
        userName: opts.userName || (opts.userEmail ? opts.userEmail.split('@')[0] : 'System Staff'),
        userRole: opts.userRole || 'admin',
        timestamp: new Date().toISOString(),
        details: opts.details || {},
        severity: opts.severity || (opts.action.toLowerCase().includes('delete') ? 'danger' : 'info')
      };

      if (opts.userId !== undefined) payload.userId = opts.userId;
      if (opts.ipAddress !== undefined) payload.ipAddress = opts.ipAddress;
    } else {
      let inferredModule = extra?.module;
      if (!inferredModule) {
        if (type === 'sale') inferredModule = 'pos';
        else if (type === 'inventory') inferredModule = 'inventory';
        else if (type === 'patient') inferredModule = 'patients';
        else if (type === 'wholesaler') inferredModule = 'wholesalers';
        else inferredModule = 'system';
      }

      payload = {
        action: actionOrOptions,
        description: description || '',
        type: type || 'system',
        module: inferredModule,
        userEmail: userEmail || 'system',
        userName: extra?.userName || (userEmail ? userEmail.split('@')[0] : 'System Staff'),
        userRole: extra?.userRole || 'admin',
        timestamp: new Date().toISOString(),
        details: extra?.details || {},
        severity: extra?.severity || (actionOrOptions.toLowerCase().includes('delete') ? 'danger' : 'info')
      };

      if (extra?.userId !== undefined) payload.userId = extra.userId;
      if (extra?.ipAddress !== undefined) payload.ipAddress = extra.ipAddress;
    }

    const cleanedPayload = cleanForFirestore(payload);
    await addDoc(collection(db, 'activity_logs'), cleanedPayload);
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};

