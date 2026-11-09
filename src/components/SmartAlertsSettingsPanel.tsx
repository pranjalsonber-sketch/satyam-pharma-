import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  BellRing, 
  BellOff, 
  Volume2, 
  VolumeX, 
  ShieldAlert, 
  Clock, 
  Laptop, 
  Smartphone, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Sparkles, 
  Flame, 
  Layers,
  Send,
  Sliders,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  SmartAlertsConfig, 
  getSmartAlertsConfig, 
  saveSmartAlertsConfig, 
  DEFAULT_SMART_ALERTS_CONFIG,
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  dispatchSmartPushNotification,
  playSmartAlertChime
} from '../lib/smartAlerts';
import { getDeviceInfo, getTerminalName } from '../lib/deviceUtils';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from './AuthProvider';
import { logAuditAction } from '../lib/auditLogger';
import { cn } from '../lib/utils';

export const SmartAlertsSettingsPanel: React.FC = () => {
  const { t, tText, isHindi } = useLanguage();
  const { profile } = useAuth();
  const [config, setConfig] = useState<SmartAlertsConfig>(getSmartAlertsConfig());
  const [permission, setPermission] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default');
  const [testSentMsg, setTestSentMsg] = useState<string | null>(null);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  const deviceInfo = getDeviceInfo();
  const terminalName = getTerminalName();

  useEffect(() => {
    setPermission(getBrowserNotificationPermission());

    const handleUpdate = (e: any) => {
      if (e?.detail) {
        setConfig(e.detail);
      }
    };

    window.addEventListener('smart-alerts-config-updated', handleUpdate);
    return () => window.removeEventListener('smart-alerts-config-updated', handleUpdate);
  }, []);

  const updateConfig = (updater: Partial<SmartAlertsConfig>) => {
    const updated = { ...config, ...updater };
    setConfig(updated);
    saveSmartAlertsConfig(updated);

    logAuditAction({
      action: 'Smart Push & Audio Alerts Config Modified',
      category: 'system_config',
      description: `Notification preferences updated (Master: ${updated.enabled ? 'ON' : 'OFF'}, Sound: ${updated.soundEnabled ? 'ON' : 'OFF'}) by ${profile?.displayName || profile?.email}`,
      module: 'settings',
      userEmail: profile?.email,
      userName: profile?.displayName,
      userRole: profile?.role,
      userId: profile?.uid,
      severity: 'info',
      details: {
        enabled: updated.enabled,
        soundEnabled: updated.soundEnabled,
        lowStockAlerts: updated.lowStockAlerts,
        expiryAlerts: updated.expiryAlerts,
        expiryDaysThreshold: updated.expiryDaysThreshold
      }
    });
  };

  const handleToggleMaster = async () => {
    const newEnabled = !config.enabled;
    if (newEnabled && permission === 'default') {
      setIsRequestingPermission(true);
      const perm = await requestBrowserNotificationPermission();
      setPermission(perm);
      setIsRequestingPermission(false);
    }
    updateConfig({ enabled: newEnabled });
  };

  const handleRequestPermission = async () => {
    setIsRequestingPermission(true);
    const perm = await requestBrowserNotificationPermission();
    setPermission(perm);
    setIsRequestingPermission(false);
    if (perm === 'granted') {
      playSmartAlertChime();
      dispatchSmartPushNotification({
        title: '🔔 Browser Push Notifications Enabled',
        body: `Smart Alerts are now active for ${terminalName} on this device.`,
        type: 'test',
      });
    }
  };

  const handleSendTestPush = () => {
    const success = dispatchSmartPushNotification({
      title: '🚨 Smart Alert Test: Amoxicillin 500mg Low Stock',
      body: 'Current stock is 4 units (Threshold: 10). Shelf: Aisle B, Rack 2. Tap to review inventory.',
      type: 'test',
      medicineName: 'Amoxicillin 500mg',
      stockQuantity: 4,
      location: 'Aisle B, Rack 2'
    });

    if (success) {
      setTestSentMsg(
        isHindi
          ? 'परीक्षण पुश सूचना आपके डिवाइस पर भेजी गई!'
          : 'Test push notification dispatched to this device/session!'
      );
      setTimeout(() => setTestSentMsg(null), 4000);
    }
  };

  const handleResetDefaults = () => {
    setConfig(DEFAULT_SMART_ALERTS_CONFIG);
    saveSmartAlertsConfig(DEFAULT_SMART_ALERTS_CONFIG);
  };

  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white shadow-md shadow-amber-500/20">
            <BellRing size={22} className={cn(config.enabled && "animate-wiggle")} />
            {config.enabled && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900"></span>
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {tText('Smart Alerts (Device & Session Push Notifications)', 'स्मार्ट अलर्ट (इस डिवाइस और सत्र के लिए पुश सूचनाएं)')}
              </h2>
              <span className={cn(
                "rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider border",
                config.enabled
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                  : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
              )}>
                {config.enabled ? tText('Active on this Device', 'इस डिवाइस पर सक्रिय') : tText('Disabled', 'अक्षम')}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {tText(
                'Receive instant browser push alerts and audio notifications for expiring batches and stockouts exclusively on this terminal.',
                'केवल इस टर्मिनल पर समाप्त होने वाले बैच और कम स्टॉक के लिए तत्काल ब्राउज़र पुश और ऑडियो अलर्ट प्राप्त करें।'
              )}
            </p>
          </div>
        </div>

        {/* Master Toggle */}
        <div className="flex items-center gap-3 self-start sm:self-auto bg-slate-50 dark:bg-slate-800/80 p-2 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
          <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 pl-2">
            {config.enabled ? tText('Alerts ON', 'अलर्ट चालू') : tText('Alerts OFF', 'अलर्ट बंद')}
          </span>
          <button
            type="button"
            id="smart-alerts-master-toggle-btn"
            onClick={handleToggleMaster}
            className={cn(
              "relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden",
              config.enabled ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
            )}
            title={config.enabled ? "Disable smart alerts for this device" : "Enable smart alerts for this device"}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                config.enabled ? "translate-x-6" : "translate-x-0"
              )}
            />
          </button>
        </div>
      </div>

      {/* Device & Browser Status Context Strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        {/* Device Hardware Info */}
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3.5 border border-slate-200/60 dark:border-slate-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 shrink-0">
            {isMobile ? <Smartphone size={18} /> : <Laptop size={18} />}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{tText('Active Terminal', 'सक्रिय टर्मिनल')}</p>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate" title={deviceInfo}>
              {terminalName}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{deviceInfo}</p>
          </div>
        </div>

        {/* Browser Permission Status */}
        <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3.5 border border-slate-200/60 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg shrink-0",
              permission === 'granted'
                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                : permission === 'denied'
                ? "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                : "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
            )}>
              {permission === 'granted' ? (
                <CheckCircle2 size={18} />
              ) : permission === 'denied' ? (
                <BellOff size={18} />
              ) : (
                <AlertTriangle size={18} />
              )}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {tText('Browser Permission', 'ब्राउज़र अनुमति')}
              </p>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {permission === 'granted'
                  ? tText('Push Granted', 'पुश स्वीकृत')
                  : permission === 'denied'
                  ? tText('Blocked in Browser', 'ब्राउज़र में अवरुद्ध')
                  : permission === 'unsupported'
                  ? tText('In-App Only', 'केवल इन-ऐप')
                  : tText('Action Needed', 'अनुमति आवश्यक')}
              </p>
            </div>
          </div>

          {permission !== 'granted' && permission !== 'unsupported' && (
            <button
              type="button"
              id="request-push-permission-btn"
              onClick={handleRequestPermission}
              disabled={isRequestingPermission}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 px-2.5 py-1.5 text-[10px] font-bold text-white transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isRequestingPermission ? 'Requesting...' : tText('Allow Push', 'अनुमति दें')}
            </button>
          )}
        </div>

        {/* Device Isolation Notice */}
        <div className="flex items-center gap-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 p-3.5 border border-purple-200/60 dark:border-purple-900/40">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300 shrink-0">
            <ShieldAlert size={18} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300">
              {tText('Isolated Scope', 'डिवाइस-विशिष्ट')}
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight">
              {tText('Saved locally on this device. Does not disturb other staff sessions.', 'स्थानीय रूप से सहेजा गया। अन्य स्टाफ को प्रभावित नहीं करता।')}
            </p>
          </div>
        </div>
      </div>

      {/* Main Alert Rules & Toggles */}
      <div className={cn("grid gap-4 md:grid-cols-2 transition-opacity duration-200", !config.enabled && "opacity-60 pointer-events-none")}>
        {/* 1. Expiry Push Alert Configuration */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/90 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                <Clock size={16} />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 dark:text-slate-100">
                  {tText('Medicine Expiry Push Alerts', 'दवा एक्सपायरी पुश अलर्ट')}
                </h3>
                <p className="text-[10px] text-slate-500">
                  {tText('Notify this session when batches approach expiry', 'बैच समाप्ति तिथि निकट आने पर सूचित करें')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => updateConfig({ expiryAlerts: !config.expiryAlerts })}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden",
                config.expiryAlerts ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-700"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                  config.expiryAlerts ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>

          {config.expiryAlerts && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {tText('Expiry Lead Time Window', 'अलर्ट समय सीमा (दिन पहले)')}:
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[15, 30, 60, 90].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => updateConfig({ expiryDaysThreshold: days })}
                    className={cn(
                      "rounded-lg py-1.5 px-2 text-xs font-bold transition-all border cursor-pointer",
                      config.expiryDaysThreshold === days
                        ? "bg-amber-500 text-white border-amber-500 shadow-2xs"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                    )}
                  >
                    {days} {tText('Days', 'दिन')}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 italic">
                {tText(
                  `Alerts trigger for any medicine batch expiring within ${config.expiryDaysThreshold} days.`,
                  `अगले ${config.expiryDaysThreshold} दिनों में समाप्त होने वाली दवाओं पर अलर्ट मिलेगा।`
                )}
              </p>
            </div>
          )}
        </div>

        {/* 2. Low Stock & Out of Stock Push Alert Configuration */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/90 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                <Flame size={16} />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 dark:text-slate-100">
                  {tText('Low Stock & Stockout Alerts', 'कम स्टॉक व शून्य स्टॉक अलर्ट')}
                </h3>
                <p className="text-[10px] text-slate-500">
                  {tText('Notify when medicines fall below minimum threshold', 'सुरक्षा सीमा से कम होने पर तत्काल सूचना दें')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => updateConfig({ lowStockAlerts: !config.lowStockAlerts })}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden",
                config.lowStockAlerts ? "bg-rose-600" : "bg-slate-300 dark:bg-slate-700"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                  config.lowStockAlerts ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>

          {config.lowStockAlerts && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {tText('Stockout Sensitivity Mode', 'स्टॉक संवेदनशीलता स्तर')}:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateConfig({ criticalZeroStockOnly: false })}
                  className={cn(
                    "flex flex-col items-start rounded-xl p-2.5 text-left border transition-all cursor-pointer",
                    !config.criticalZeroStockOnly
                      ? "bg-rose-50 border-rose-300 text-rose-900 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-200"
                      : "bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                  )}
                >
                  <span className="text-[11px] font-bold">Standard Low Stock</span>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400">Triggers at item minThreshold (e.g. ≤ 10 units)</span>
                </button>

                <button
                  type="button"
                  onClick={() => updateConfig({ criticalZeroStockOnly: true })}
                  className={cn(
                    "flex flex-col items-start rounded-xl p-2.5 text-left border transition-all cursor-pointer",
                    config.criticalZeroStockOnly
                      ? "bg-rose-50 border-rose-300 text-rose-900 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-200"
                      : "bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                  )}
                >
                  <span className="text-[11px] font-bold">Zero Stockout Only</span>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400">Triggers exclusively when quantity hits 0</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 3. Audio Chime & In-App Banners */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/90 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                {config.soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 dark:text-slate-100">
                  {tText('Audible Alert Tone & Chime', 'ऑडियो अलर्ट टोन')}
                </h3>
                <p className="text-[10px] text-slate-500">
                  {tText('Play synthesized chime when a push alert triggers', 'अलर्ट आने पर सुखद सूचना बीप बजाएं')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const next = !config.soundEnabled;
                if (next) playSmartAlertChime();
                updateConfig({ soundEnabled: next });
              }}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden",
                config.soundEnabled ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                  config.soundEnabled ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {tText('In-App Floating Push Banner', 'इन-ऐप फ्लोटिंग पुश बैनर')}
              </p>
              <p className="text-[10px] text-slate-400">
                {tText('Displays interactive overlay if browser push is minimized', 'ब्राउज़र टैब सक्रिय रहने पर इंटरेक्टिव कार्ड दिखाएं')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateConfig({ inAppBannerEnabled: !config.inAppBannerEnabled })}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden",
                config.inAppBannerEnabled ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                  config.inAppBannerEnabled ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </div>

        {/* 4. Alert Throttling & Cooldown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/90 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
              <Sliders size={16} />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 dark:text-slate-100">
                {tText('Session Notification Cooldown', 'अलर्ट अंतराल (कूलडाउन)')}
              </h3>
              <p className="text-[10px] text-slate-500">
                {tText('Prevents repetitive notification spam on this device', 'डिवाइस पर अत्यधिक अलर्ट स्पैम रोकता है')}
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { min: 0, label: 'Instant' },
                { min: 15, label: '15 Mins' },
                { min: 30, label: '30 Mins' },
                { min: 60, label: '1 Hour' },
              ].map(({ min, label }) => (
                <button
                  key={min}
                  type="button"
                  onClick={() => updateConfig({ throttleCooldownMinutes: min })}
                  className={cn(
                    "rounded-lg py-1.5 px-2 text-xs font-bold transition-all border cursor-pointer",
                    config.throttleCooldownMinutes === min
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400">
              {config.throttleCooldownMinutes === 0
                ? tText('Notifications fire immediately on any stock change.', 'स्टॉक बदलते ही तुरंत अलर्ट भेजा जाएगा।')
                : tText(`Suppresses duplicate alerts for ${config.throttleCooldownMinutes} minutes per item.`, `प्रति आइटम ${config.throttleCooldownMinutes} मिनट तक दोहराव रोका जाएगा।`)}
            </p>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="test-smart-push-notification-btn"
            onClick={handleSendTestPush}
            className="flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white px-4 py-2 text-xs font-bold hover:bg-slate-800 dark:hover:bg-white transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <Send size={13} />
            <span>{tText('Send Test Push Notification', 'परीक्षण पुश अलर्ट भेजें')}</span>
          </button>

          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
          >
            <RefreshCw size={12} />
            <span>{tText('Reset Defaults', 'रीसेट करें')}</span>
          </button>
        </div>

        {testSentMsg && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300"
          >
            <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span>{testSentMsg}</span>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default SmartAlertsSettingsPanel;
