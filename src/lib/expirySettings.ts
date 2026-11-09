export interface ExpirySettings {
  alertsEnabled: boolean;
  thresholdDays: number;
  criticalDays: number;
}

export const DEFAULT_EXPIRY_SETTINGS: ExpirySettings = {
  alertsEnabled: true,
  thresholdDays: 30,
  criticalDays: 7,
};

export const getExpirySettings = (): ExpirySettings => {
  try {
    const saved = localStorage.getItem('satyam_expiry_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        alertsEnabled: typeof parsed.alertsEnabled === 'boolean' ? parsed.alertsEnabled : true,
        thresholdDays: Math.max(1, Number(parsed.thresholdDays) || 30),
        criticalDays: Math.max(1, Number(parsed.criticalDays) || 7),
      };
    }
  } catch (e) {
    console.error('Error reading expiry settings:', e);
  }
  return DEFAULT_EXPIRY_SETTINGS;
};

export const saveExpirySettings = (settings: ExpirySettings): void => {
  try {
    localStorage.setItem('satyam_expiry_settings', JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('expiry-settings-updated', { detail: settings }));
  } catch (e) {
    console.error('Error saving expiry settings:', e);
  }
};
