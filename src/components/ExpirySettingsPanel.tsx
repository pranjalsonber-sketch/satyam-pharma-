import React, { useState, useEffect } from 'react';
import { AlertTriangle, Bell, Clock, ShieldAlert, Check, X, Sliders, Info, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from './AuthProvider';
import { getExpirySettings, saveExpirySettings, ExpirySettings } from '../lib/expirySettings';
import { cn } from '../lib/utils';
import { logAuditAction } from '../lib/auditLogger';

interface ExpirySettingsPanelProps {
  onClose?: () => void;
  isModal?: boolean;
}

export const ExpirySettingsPanel: React.FC<ExpirySettingsPanelProps> = ({ onClose, isModal = false }) => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [settings, setSettings] = useState<ExpirySettings>(getExpirySettings());
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setSettings(getExpirySettings());
  }, []);

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isAdmin) return;

    saveExpirySettings(settings);
    setSavedSuccess(true);

    // Log configuration modification audit
    logAuditAction({
      action: 'Expiry Alert Configuration Modified',
      category: 'system_config',
      description: `Expiry threshold windows updated (Alerts: ${settings.alertsEnabled ? 'ON' : 'OFF'}, Threshold: ${settings.thresholdDays} days, Critical: ${settings.criticalDays} days) by ${profile?.displayName || profile?.email}`,
      module: 'settings',
      userEmail: profile?.email,
      userName: profile?.displayName,
      userRole: profile?.role,
      userId: profile?.uid,
      severity: 'info',
      details: {
        alertsEnabled: settings.alertsEnabled,
        thresholdDays: settings.thresholdDays,
        criticalDays: settings.criticalDays
      }
    });

    setTimeout(() => {
      setSavedSuccess(false);
      if (onClose) onClose();
    }, 1200);
  };

  const content = (
    <div className="space-y-6">
      {/* Header info / Admin Notice */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
            <Sliders size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Upcoming Expiries Widget Settings</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Configure automated alerts, notification threshold windows, and critical urgency levels.
            </p>
          </div>
        </div>

        {/* Role badge */}
        <div className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider border",
          isAdmin 
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400"
            : "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400"
        )}>
          {isAdmin ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
          <span>{isAdmin ? 'Admin Mode' : 'Read-Only (Clerk)'}</span>
        </div>
      </div>

      {!isAdmin && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <Info size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs">
            You are currently logged in with a <strong>Clerk</strong> role. Only <strong>Administrators</strong> can modify expiry threshold settings.
          </p>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Toggle Alerts */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Bell size={16} className={settings.alertsEnabled ? "text-amber-500" : "text-slate-400"} />
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Enable Upcoming Expiries Alerts
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Show/hide warning badges and the Expiries widget alerts on the dashboard.
            </p>
          </div>

          <button
            type="button"
            disabled={!isAdmin}
            onClick={() => setSettings(s => ({ ...s, alertsEnabled: !s.alertsEnabled }))}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
              settings.alertsEnabled ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-700"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                settings.alertsEnabled ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
        </div>

        {/* Custom Notification Threshold Days */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Clock size={15} className="text-blue-500" />
              <span>Expiry Notification Threshold (Days):</span>
            </label>
            <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-extrabold text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Within {settings.thresholdDays} Days
            </span>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Define how far in advance medications and batches should be flagged for upcoming expiration (Default: 30 days).
          </p>

          <div className="flex items-center gap-3">
            <input
              type="range"
              min={5}
              max={180}
              step={5}
              disabled={!isAdmin}
              value={settings.thresholdDays}
              onChange={(e) => setSettings(s => ({ ...s, thresholdDays: Number(e.target.value) }))}
              className="w-full accent-blue-600 disabled:opacity-50 cursor-pointer"
            />
            <input
              type="number"
              min={1}
              max={365}
              disabled={!isAdmin}
              value={settings.thresholdDays}
              onChange={(e) => setSettings(s => ({ ...s, thresholdDays: Math.max(1, Number(e.target.value) || 1) }))}
              className="w-20 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 text-center outline-none focus:border-blue-500"
            />
          </div>

          {/* Quick Threshold Presets */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] uppercase font-extrabold text-slate-400 mr-1">Quick Presets:</span>
            {[15, 30, 45, 60, 90, 120].map((days) => (
              <button
                key={days}
                type="button"
                disabled={!isAdmin}
                onClick={() => setSettings(s => ({ ...s, thresholdDays: days }))}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-bold border transition-all cursor-pointer disabled:opacity-50",
                  settings.thresholdDays === days
                    ? "border-blue-600 bg-blue-600 text-white shadow-2xs"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                )}
              >
                {days} Days
              </button>
            ))}
          </div>
        </div>

        {/* Custom Critical Threshold Days */}
        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <AlertTriangle size={15} className="text-rose-500" />
              <span>Critical Urgency Threshold (Days):</span>
            </label>
            <span className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-extrabold text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              ≤ {settings.criticalDays} Days Left
            </span>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Define the threshold for marking expiring items as <strong>Critical High Alert</strong> (Default: ≤ 7 days).
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            {[3, 5, 7, 10, 14, 21].map((days) => (
              <button
                key={days}
                type="button"
                disabled={!isAdmin}
                onClick={() => setSettings(s => ({ ...s, criticalDays: days }))}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-bold border transition-all cursor-pointer disabled:opacity-50",
                  settings.criticalDays === days
                    ? "border-rose-600 bg-rose-600 text-white shadow-2xs"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                )}
              >
                ≤ {days} Days
              </button>
            ))}
          </div>
        </div>

        {/* Save & Action Buttons */}
        {isAdmin && (
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              className={cn(
                "flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white transition-all shadow-md cursor-pointer active:scale-95",
                savedSuccess ? "bg-emerald-600" : "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {savedSuccess ? (
                <>
                  <Check size={16} />
                  <span>Settings Saved!</span>
                </>
              ) : (
                <>
                  <Sliders size={16} />
                  <span>Apply & Save Settings</span>
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 relative"
        >
          {onClose && (
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          )}
          {content}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {content}
    </div>
  );
};
