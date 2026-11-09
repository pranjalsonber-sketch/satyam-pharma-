import { Medicine } from '../types';
import { getDeviceInfo, getTerminalName } from './deviceUtils';

export interface SmartAlertsConfig {
  enabled: boolean;                 // Master toggle for device/session push alerts
  expiryAlerts: boolean;            // Push notifications for expiring batches
  expiryDaysThreshold: number;      // Days before expiry to trigger alert (e.g. 30, 60, 90)
  lowStockAlerts: boolean;          // Push notifications for low and out-of-stock items
  criticalZeroStockOnly: boolean;   // If true, only 0 stock items; if false, items <= minThreshold
  soundEnabled: boolean;            // Play audio alert chime
  inAppBannerEnabled: boolean;      // Show in-app floating push banner
  throttleCooldownMinutes: number;  // Cooldown in minutes to avoid notification spam (e.g. 15, 30, 60)
  deviceId: string;                 // Local unique device identifier
  lastNotifiedAt?: string;          // ISO timestamp of last alert
  lastNotifiedKeys?: string[];      // Tracking keys (e.g. 'stock-med123', 'exp-med456-batch1')
}

export const DEFAULT_SMART_ALERTS_CONFIG: SmartAlertsConfig = {
  enabled: true,
  expiryAlerts: true,
  expiryDaysThreshold: 30,
  lowStockAlerts: true,
  criticalZeroStockOnly: false,
  soundEnabled: true,
  inAppBannerEnabled: true,
  throttleCooldownMinutes: 30,
  deviceId: 'device-session-default',
};

const STORAGE_KEY = 'satyam_device_smart_alerts_v1';

/**
 * Generates or retrieves the unique device/session ID
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = localStorage.getItem('satyam_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      localStorage.setItem('satyam_device_id', id);
    }
    return id;
  } catch {
    return 'session_' + Date.now();
  }
}

/**
 * Retrieve device-specific Smart Alerts configuration
 */
export function getSmartAlertsConfig(): SmartAlertsConfig {
  if (typeof window === 'undefined') return DEFAULT_SMART_ALERTS_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const deviceId = getOrCreateDeviceId();

    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
        expiryAlerts: typeof parsed.expiryAlerts === 'boolean' ? parsed.expiryAlerts : true,
        expiryDaysThreshold: Number(parsed.expiryDaysThreshold) || 30,
        lowStockAlerts: typeof parsed.lowStockAlerts === 'boolean' ? parsed.lowStockAlerts : true,
        criticalZeroStockOnly: typeof parsed.criticalZeroStockOnly === 'boolean' ? parsed.criticalZeroStockOnly : false,
        soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
        inAppBannerEnabled: typeof parsed.inAppBannerEnabled === 'boolean' ? parsed.inAppBannerEnabled : true,
        throttleCooldownMinutes: Number(parsed.throttleCooldownMinutes) || 30,
        deviceId,
        lastNotifiedAt: parsed.lastNotifiedAt,
        lastNotifiedKeys: Array.isArray(parsed.lastNotifiedKeys) ? parsed.lastNotifiedKeys : [],
      };
    }
    return { ...DEFAULT_SMART_ALERTS_CONFIG, deviceId };
  } catch (e) {
    console.warn('[Smart Alerts] Error loading device config:', e);
    return DEFAULT_SMART_ALERTS_CONFIG;
  }
}

/**
 * Save device-specific Smart Alerts configuration
 */
export function saveSmartAlertsConfig(config: SmartAlertsConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('smart-alerts-config-updated', { detail: config }));
  } catch (e) {
    console.error('[Smart Alerts] Error saving device config:', e);
  }
}

/**
 * Check browser notification support and current permission status
 */
export function getBrowserNotificationPermission(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Request browser notification permission
 */
export async function requestBrowserNotificationPermission(): Promise<'granted' | 'denied' | 'default' | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (e) {
    console.warn('[Smart Alerts] Error requesting notification permission:', e);
    return 'denied';
  }
}

/**
 * Professional synthesized Smart Alert audio chime
 */
export function playSmartAlertChime(volume = 0.28) {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return;
    const ctx = new AudioCtxClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    // Ascending dual alert bell (E5 659.25Hz -> B5 987.77Hz)
    const tones = [
      { freq: 659.25, start: 0, dur: 0.14 },
      { freq: 987.77, start: 0.10, dur: 0.28 },
    ];

    tones.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);

      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(volume, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + dur);
    });
  } catch (e) {
    console.warn('[Smart Alerts] Audio chime notice:', e);
  }
}

export interface SmartPushPayload {
  title: string;
  body: string;
  type: 'expiry' | 'low_stock' | 'critical' | 'test';
  medicineId?: string;
  medicineName?: string;
  batchNumber?: string;
  stockQuantity?: number;
  daysRemaining?: number;
  location?: string;
  tag?: string;
}

/**
 * Dispatches a smart push notification on this device/session
 */
export function dispatchSmartPushNotification(payload: SmartPushPayload): boolean {
  if (typeof window === 'undefined') return false;
  const config = getSmartAlertsConfig();

  if (!config.enabled && payload.type !== 'test') {
    return false;
  }

  // Check specific type toggle
  if (payload.type === 'expiry' && !config.expiryAlerts) return false;
  if ((payload.type === 'low_stock' || payload.type === 'critical') && !config.lowStockAlerts) return false;

  // 1. Play audible chime if enabled
  if (config.soundEnabled) {
    playSmartAlertChime();
  }

  // 2. Dispatch browser system notification if granted
  const permission = getBrowserNotificationPermission();
  if (permission === 'granted') {
    try {
      const notification = new Notification(payload.title, {
        body: payload.body,
        icon: '/favicon.ico',
        tag: payload.tag || `satyam-smart-alert-${payload.type}-${Date.now()}`,
        badge: '/favicon.ico',
        requireInteraction: payload.type === 'critical' || payload.type === 'expiry',
      });

      notification.onclick = () => {
        window.focus();
        if (payload.medicineName) {
          window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'inventory' } }));
        }
      };
    } catch (e) {
      console.warn('[Smart Alerts] System notification display note:', e);
    }
  }

  // 3. Dispatch in-app interactive push banner
  if (config.inAppBannerEnabled || permission !== 'granted') {
    window.dispatchEvent(new CustomEvent('smart-alert-in-app-banner', { detail: payload }));
  }

  return true;
}

/**
 * Evaluates medicines to detect alerts for the current device session
 */
export function evaluateSmartAlerts(
  medicines: Medicine[],
  config: SmartAlertsConfig
): {
  expiringItems: { medicine: Medicine; batchNumber: string; daysLeft: number; expiryDate: string }[];
  lowStockItems: { medicine: Medicine; stock: number; threshold: number }[];
} {
  const expiringItems: { medicine: Medicine; batchNumber: string; daysLeft: number; expiryDate: string }[] = [];
  const lowStockItems: { medicine: Medicine; stock: number; threshold: number }[] = [];

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  medicines.forEach((med) => {
    // 1. Evaluate Low Stock
    if (config.lowStockAlerts) {
      const threshold = med.minThreshold || 10;
      if (config.criticalZeroStockOnly) {
        if (med.stockQuantity <= 0) {
          lowStockItems.push({ medicine: med, stock: med.stockQuantity, threshold });
        }
      } else {
        if (med.stockQuantity <= threshold) {
          lowStockItems.push({ medicine: med, stock: med.stockQuantity, threshold });
        }
      }
    }

    // 2. Evaluate Expiry
    if (config.expiryAlerts) {
      if (med.batches && med.batches.length > 0) {
        med.batches.forEach((batch) => {
          if (batch.expiryDate && (batch.quantity === undefined || batch.quantity > 0)) {
            const exp = new Date(batch.expiryDate);
            const startOfExp = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());
            const daysLeft = Math.ceil((startOfExp.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));

            if (daysLeft <= config.expiryDaysThreshold) {
              expiringItems.push({
                medicine: med,
                batchNumber: batch.batchNumber,
                daysLeft,
                expiryDate: batch.expiryDate,
              });
            }
          }
        });
      } else if (med.expiryDate) {
        const exp = new Date(med.expiryDate);
        const startOfExp = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());
        const daysLeft = Math.ceil((startOfExp.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));

        if (daysLeft <= config.expiryDaysThreshold) {
          expiringItems.push({
            medicine: med,
            batchNumber: med.batchNumber || 'Default',
            daysLeft,
            expiryDate: med.expiryDate,
          });
        }
      }
    }
  });

  return { expiringItems, lowStockItems };
}
