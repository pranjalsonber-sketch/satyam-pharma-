export interface StockAlertSettings {
  enabled: boolean;
  adminEmails: string[];
  criticalItemCountThreshold: number; // e.g. 2 or more items simultaneously
  criticalThresholdFormula: 'min_threshold' | 'fixed_low' | 'zero_stock';
  fixedThresholdValue: number;
  cooldownMinutes: number;
  lastAlertSentAt?: string;
  lastAlertItemIds?: string[];
  includeSupplierDetails: boolean;
  autoTriggerOnSale: boolean;
}

export interface CriticalItemAlertPayload {
  id: string;
  name: string;
  genericName?: string;
  salt?: string;
  currentStock: number;
  minThreshold: number;
  deficit: number;
  rate?: number;
  supplier?: string;
  type?: string;
  batchCount?: number;
}

export interface EmailAlertLog {
  id: string;
  timestamp: string;
  recipients: string[];
  subject: string;
  itemCount: number;
  items: CriticalItemAlertPayload[];
  status: 'delivered' | 'simulated' | 'failed';
  previewHtml: string;
  errorMessage?: string;
  triggeredBy?: string;
}

const SETTINGS_STORAGE_KEY = 'satyam_stock_email_alert_settings_v1';
const LOGS_STORAGE_KEY = 'satyam_stock_email_alert_logs_v1';

export const DEFAULT_STOCK_ALERT_SETTINGS: StockAlertSettings = {
  enabled: true,
  adminEmails: ['pranjalsonber@gmail.com', 'admin@satyampharmacy.com'],
  criticalItemCountThreshold: 2, // Multiple items: at least 2 items simultaneously
  criticalThresholdFormula: 'min_threshold',
  fixedThresholdValue: 5,
  cooldownMinutes: 30,
  includeSupplierDetails: true,
  autoTriggerOnSale: true,
};

export const getStockAlertSettings = (): StockAlertSettings => {
  if (typeof window === 'undefined') return DEFAULT_STOCK_ALERT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_STOCK_ALERT_SETTINGS;
    return { ...DEFAULT_STOCK_ALERT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    return DEFAULT_STOCK_ALERT_SETTINGS;
  }
};

export const saveStockAlertSettings = (settings: StockAlertSettings): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('stock-alert-settings-updated', { detail: settings }));
  } catch (e) {
    console.error('Error saving stock alert settings:', e);
  }
};

export const getEmailAlertLogs = (): EmailAlertLog[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOGS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
};

export const saveEmailAlertLog = (log: EmailAlertLog): void => {
  if (typeof window === 'undefined') return;
  try {
    const existing = getEmailAlertLogs();
    const updated = [log, ...existing].slice(0, 50); // keep last 50
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('stock-alert-logs-updated', { detail: updated }));
  } catch (e) {
    console.error('Error saving email alert log:', e);
  }
};

export const clearEmailAlertLogs = (): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LOGS_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('stock-alert-logs-updated', { detail: [] }));
  } catch (e) {
    console.error('Error clearing email alert logs:', e);
  }
};

/**
 * Checks if current inventory state meets the multi-item critical threshold
 * and whether the alert cooldown allows sending an email notification.
 */
export const evaluateCriticalStockItems = (
  medicines: Array<{
    id: string;
    name: string;
    genericName?: string;
    salt?: string;
    stockQuantity: number;
    minThreshold: number;
    rate?: number;
    supplier?: string;
    type?: string;
    batches?: any[];
  }>,
  settings: StockAlertSettings = getStockAlertSettings()
): {
  criticalItems: CriticalItemAlertPayload[];
  isMultiItemCritical: boolean;
  shouldSendAlert: boolean;
  cooldownRemainingMinutes: number;
  reason?: string;
} => {
  if (!settings.enabled) {
    return {
      criticalItems: [],
      isMultiItemCritical: false,
      shouldSendAlert: false,
      cooldownRemainingMinutes: 0,
      reason: 'Email alerts are disabled in settings',
    };
  }

  const criticalItems: CriticalItemAlertPayload[] = [];

  for (const med of medicines) {
    let isCritical = false;
    const minThreshold = med.minThreshold ?? 10;

    if (settings.criticalThresholdFormula === 'zero_stock') {
      isCritical = med.stockQuantity <= 0;
    } else if (settings.criticalThresholdFormula === 'fixed_low') {
      isCritical = med.stockQuantity <= settings.fixedThresholdValue;
    } else {
      // Default: min_threshold
      isCritical = med.stockQuantity <= minThreshold;
    }

    if (isCritical) {
      criticalItems.push({
        id: med.id,
        name: med.name,
        genericName: med.genericName,
        salt: med.salt,
        currentStock: med.stockQuantity,
        minThreshold: minThreshold,
        deficit: Math.max(0, minThreshold - med.stockQuantity),
        rate: med.rate,
        supplier: med.supplier,
        type: med.type,
        batchCount: med.batches?.length || 0,
      });
    }
  }

  const isMultiItemCritical = criticalItems.length >= settings.criticalItemCountThreshold;

  if (!isMultiItemCritical) {
    return {
      criticalItems,
      isMultiItemCritical: false,
      shouldSendAlert: false,
      cooldownRemainingMinutes: 0,
      reason: `Found ${criticalItems.length} critical items, threshold requires at least ${settings.criticalItemCountThreshold} simultaneous items.`,
    };
  }

  // Check Cooldown
  let cooldownRemainingMinutes = 0;
  let shouldSendAlert = true;
  let reason: string | undefined;

  if (settings.lastAlertSentAt) {
    const lastSentTime = new Date(settings.lastAlertSentAt).getTime();
    const now = Date.now();
    const elapsedMinutes = (now - lastSentTime) / (1000 * 60);

    if (elapsedMinutes < settings.cooldownMinutes) {
      cooldownRemainingMinutes = Math.ceil(settings.cooldownMinutes - elapsedMinutes);
      
      // Check if there are NEW critical items that weren't in the last alert
      const previousItemIds = new Set(settings.lastAlertItemIds || []);
      const hasNewCriticalItems = criticalItems.some(item => !previousItemIds.has(item.id));

      if (!hasNewCriticalItems) {
        shouldSendAlert = false;
        reason = `Alert cooldown active. Next alert allowed in ${cooldownRemainingMinutes} minutes.`;
      } else {
        reason = `Cooldown active, but new critical items detected (${criticalItems.length} items total).`;
      }
    }
  }

  return {
    criticalItems,
    isMultiItemCritical,
    shouldSendAlert,
    cooldownRemainingMinutes,
    reason,
  };
};

// ==================== MEDICINE EXPIRY EMAIL SETTINGS & EVALUATION ====================

export interface ExpiryAlertSettings {
  enabled: boolean;
  adminEmails: string[];
  alertDaysThreshold: number; // e.g. 60 or 90 days
  includeExpired: boolean;
  includeCritical: boolean; // <= 30 days
  includeUrgent: boolean;   // 31-60 days
  minFlaggedBatchesThreshold: number; // e.g. at least 1 or 2 batches to trigger alert
  cooldownMinutes: number; // e.g. 60 minutes
  lastAlertSentAt?: string;
  lastAlertBatchKeys?: string[];
}

export const DEFAULT_EXPIRY_ALERT_SETTINGS: ExpiryAlertSettings = {
  enabled: true,
  adminEmails: ['pranjalsonber@gmail.com', 'admin@satyampharmacy.com'],
  alertDaysThreshold: 60,
  includeExpired: true,
  includeCritical: true,
  includeUrgent: true,
  minFlaggedBatchesThreshold: 1,
  cooldownMinutes: 60,
};

const EXPIRY_SETTINGS_STORAGE_KEY = 'satyam_expiry_email_alert_settings_v1';
const EXPIRY_LOGS_STORAGE_KEY = 'satyam_expiry_email_alert_logs_v1';

export const getExpiryAlertSettings = (): ExpiryAlertSettings => {
  if (typeof window === 'undefined') return DEFAULT_EXPIRY_ALERT_SETTINGS;
  try {
    const raw = localStorage.getItem(EXPIRY_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_EXPIRY_ALERT_SETTINGS;
    return { ...DEFAULT_EXPIRY_ALERT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    return DEFAULT_EXPIRY_ALERT_SETTINGS;
  }
};

export const saveExpiryAlertSettings = (settings: ExpiryAlertSettings): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(EXPIRY_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('expiry-alert-settings-updated', { detail: settings }));
  } catch (e) {
    console.error('Error saving expiry alert settings:', e);
  }
};

export interface ExpiringBatchAlertPayload {
  medicineId: string;
  medicineName: string;
  genericName?: string;
  salt?: string;
  batchNumber: string;
  expiryDate: string;
  stockQuantity: number;
  rate: number;
  totalValue: number;
  daysLeft: number;
  supplier?: string;
}

export const evaluateExpiringItems = (
  medicines: any[],
  settings: ExpiryAlertSettings = DEFAULT_EXPIRY_ALERT_SETTINGS
): {
  expiringBatches: ExpiringBatchAlertPayload[];
  shouldSendAlert: boolean;
  cooldownRemainingMinutes: number;
  reason?: string;
} => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiringBatches: ExpiringBatchAlertPayload[] = [];

  medicines.forEach((med) => {
    const batches = med.batches && med.batches.length > 0
      ? med.batches
      : [{
          id: 'default',
          batchNumber: med.batchNumber || 'LOT-MAIN',
          expiryDate: med.expiryDate,
          quantity: med.stockQuantity
        }];

    batches.forEach((batch: any) => {
      if (!batch.expiryDate) return;
      const expDate = new Date(batch.expiryDate);
      if (isNaN(expDate.getTime())) return;
      expDate.setHours(0, 0, 0, 0);

      const diffTime = expDate.getTime() - today.getTime();
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const qty = Number(batch.quantity) || 0;
      if (qty <= 0) return; // ignore depleted batches

      const isExpired = daysLeft <= 0;
      const isCritical = daysLeft > 0 && daysLeft <= 30;
      const isUrgent = daysLeft > 30 && daysLeft <= (settings.alertDaysThreshold || 60);

      let eligible = false;
      if (isExpired && settings.includeExpired) eligible = true;
      else if (isCritical && settings.includeCritical) eligible = true;
      else if (isUrgent && settings.includeUrgent) eligible = true;

      if (eligible) {
        const rate = Number(med.rate) || 0;
        expiringBatches.push({
          medicineId: med.id,
          medicineName: med.name,
          genericName: med.genericName,
          salt: med.salt,
          batchNumber: batch.batchNumber || 'LOT-N/A',
          expiryDate: batch.expiryDate,
          stockQuantity: qty,
          rate,
          totalValue: qty * rate,
          daysLeft,
          supplier: med.supplier || med.distributor || 'Apollo Pharma Distributors',
        });
      }
    });
  });

  // Sort by daysLeft ascending (most expired/urgent first)
  expiringBatches.sort((a, b) => a.daysLeft - b.daysLeft);

  if (expiringBatches.length < (settings.minFlaggedBatchesThreshold || 1)) {
    return {
      expiringBatches,
      shouldSendAlert: false,
      cooldownRemainingMinutes: 0,
      reason: `Found ${expiringBatches.length} expiring batches, threshold requires at least ${settings.minFlaggedBatchesThreshold}.`,
    };
  }

  // Check cooldown
  let cooldownRemainingMinutes = 0;
  let shouldSendAlert = true;
  let reason: string | undefined;

  if (settings.lastAlertSentAt) {
    const lastSentTime = new Date(settings.lastAlertSentAt).getTime();
    const now = Date.now();
    const elapsedMinutes = (now - lastSentTime) / (1000 * 60);

    if (elapsedMinutes < (settings.cooldownMinutes || 60)) {
      cooldownRemainingMinutes = Math.ceil((settings.cooldownMinutes || 60) - elapsedMinutes);
      
      const currentKeys = expiringBatches.map(b => `${b.medicineId}-${b.batchNumber}`);
      const previousKeys = new Set(settings.lastAlertBatchKeys || []);
      const hasNewExpiringBatches = currentKeys.some(k => !previousKeys.has(k));

      if (!hasNewExpiringBatches) {
        shouldSendAlert = false;
        reason = `Expiry alert cooldown active. Next check in ${cooldownRemainingMinutes}m.`;
      } else {
        reason = `Cooldown active, but new near-expiry batches detected (${expiringBatches.length} batches total).`;
      }
    }
  }

  return {
    expiringBatches,
    shouldSendAlert,
    cooldownRemainingMinutes,
    reason,
  };
};

