import React, { useState, useEffect } from 'react';
import { Shield, User, Save, Bell, Globe, Moon, Sun, Lock, Sparkles, Rocket, RefreshCw, CheckCircle2, ArrowRight, Compass, History, ShieldAlert } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthProvider';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { UserRole } from '../types';
import { ExpirySettingsPanel } from './ExpirySettingsPanel';
import { LoggedInMembersMonitor } from './LoggedInMembersMonitor';
import StockEmailAlertSettingsPanel from './StockEmailAlertSettingsPanel';
import SystemBackupPanel from './SystemBackupPanel';
import LanguageToggle from './LanguageToggle';
import ThemeSelector from './ThemeSelector';
import SmartAlertsSettingsPanel from './SmartAlertsSettingsPanel';
import { logAuditAction } from '../lib/auditLogger';
import { 
  getMonthlyUpdateConfig, 
  saveMonthlyUpdateConfig, 
  checkAndApplyMonthlyUpdate, 
  getInstalledRelease, 
  MonthlyUpdateConfig 
} from '../lib/monthlyUpdates';
import MonthlyUpdateHub from './MonthlyUpdateHub';

const Settings: React.FC = () => {
  const { profile } = useAuth();
  const { t, tText, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateConfig, setUpdateConfig] = useState<MonthlyUpdateConfig>(getMonthlyUpdateConfig());
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);
  const [isHubModalOpen, setIsHubModalOpen] = useState(false);

  useEffect(() => {
    const handleSettingsUpdate = (e: any) => {
      if (e?.detail) setUpdateConfig(e.detail);
    };
    window.addEventListener('monthly-settings-updated', handleSettingsUpdate);
    return () => window.removeEventListener('monthly-settings-updated', handleSettingsUpdate);
  }, []);

  const handleToggleAutoUpdate = () => {
    const updated = { ...updateConfig, autoUpdateEnabled: !updateConfig.autoUpdateEnabled };
    setUpdateConfig(updated);
    saveMonthlyUpdateConfig(updated);
    
    // Log sensitive system config change
    logAuditAction({
      action: 'Auto-Update Configuration Changed',
      category: 'system_config',
      description: `Automated OTA monthly software updates ${updated.autoUpdateEnabled ? 'Enabled' : 'Disabled'} by ${profile?.displayName || profile?.email || 'Admin'}`,
      module: 'settings',
      userEmail: profile?.email,
      userName: profile?.displayName,
      userRole: profile?.role,
      userId: profile?.uid,
      severity: 'info',
      details: {
        autoUpdateEnabled: updated.autoUpdateEnabled,
        installedVersion: updated.installedVersion
      }
    });
  };

  const handleCheckUpdate = () => {
    setIsCheckingUpdate(true);
    setUpdateMsg(null);
    setTimeout(() => {
      const res = checkAndApplyMonthlyUpdate(false);
      setIsCheckingUpdate(false);
      setUpdateConfig(getMonthlyUpdateConfig());
      setUpdateMsg(res.message);

      logAuditAction({
        action: 'Manual System Update Check Triggered',
        category: 'system_config',
        description: `Manual update check executed: ${res.message}`,
        module: 'settings',
        userEmail: profile?.email,
        userName: profile?.displayName,
        userRole: profile?.role,
        userId: profile?.uid,
        details: { updateResult: res }
      });
    }, 1000);
  };

  const handleRoleToggle = async (newRole: UserRole) => {
    if (!profile) return;
    const oldRole = profile.role;
    setIsUpdating(true);
    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, { role: newRole });
      
      // Log sensitive role modification in System Audit Trail
      await logAuditAction({
        action: 'Account Access Privilege / Role Modified',
        category: 'role_change',
        description: `User role for ${profile.displayName || profile.email} updated from [${oldRole?.toUpperCase() || 'UNKNOWN'}] to [${newRole.toUpperCase()}]`,
        module: 'settings',
        userEmail: profile.email,
        userName: profile.displayName,
        userRole: newRole,
        userId: profile.uid,
        severity: 'warning',
        details: {
          targetUid: profile.uid,
          targetEmail: profile.email,
          previousRole: oldRole,
          newRole: newRole,
          modifiedBy: profile.email
        }
      });
      // The listener in AuthProvider will pick this up
    } catch (error) {
      console.error("Error updating role:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight">{t('systemSettings')}</h1>
        <p className="text-slate-500">{t('settingsSaved') ? (language === 'hi' ? 'अपनी भाषा, अनुमतियां और प्राथमिकताएं प्रबंधित करें' : 'Configure your system preferences, language, and user permissions') : ''}</p>
      </div>

      {/* Language & Localization Setting Card */}
      <LanguageToggle variant="card" />

      {/* High-Contrast Midnight & Night Shift Theme Settings */}
      <ThemeSelector variant="card" />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Access Control Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30">
                <Shield size={20} />
              </div>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-tight">{t('role')} &amp; {t('complianceStatus')}</h2>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('registeredAccounts')}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t('role')}</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleRoleToggle('admin')}
                  disabled={isUpdating}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border p-4 transition-all active:scale-95 cursor-pointer",
                    profile?.role === 'admin' 
                      ? "border-blue-600 bg-blue-50 text-blue-600 dark:bg-blue-900/20" 
                      : "border-slate-100 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-800/50"
                  )}
                >
                  <Shield size={24} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">{t('admin')}</span>
                </button>
                <button
                  onClick={() => handleRoleToggle('clerk')}
                  disabled={isUpdating}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border p-4 transition-all active:scale-95 cursor-pointer",
                    profile?.role === 'clerk' 
                      ? "border-blue-600 bg-blue-50 text-blue-600 dark:bg-blue-900/20" 
                      : "border-slate-100 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-800/50"
                  )}
                >
                  <User size={24} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">{t('clerk')}</span>
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
              <div className="flex gap-3">
                <Lock size={16} className="text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-300">RBAC Policy & Audit</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {profile?.role === 'admin' 
                      ? (language === 'hi' ? 'प्रशासक के पास इन्वेंटरी, रिपोर्ट, बिलिंग और सेटिंग्स तक पूर्ण पहुंच है।' : 'Admins have full access to inventory, reports, patients, and system settings.') 
                      : (language === 'hi' ? 'सेल्स क्लर्क केवल बिक्री केंद्र (POS) और बुनियादी डैशबोर्ड तक सीमित हैं।' : 'Clerks are restricted to Point of Sale (POS) and basic dashboard viewing only.')}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Access to System Audit Trail */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-activity-logs'));
                }}
                className="w-full flex items-center justify-between gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold text-white hover:bg-slate-800 transition-all dark:bg-blue-600 dark:hover:bg-blue-700 active:scale-98 shadow-xs cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldAlert size={16} className="text-amber-400" />
                  <div className="text-left">
                    <div className="text-[11px] font-black uppercase tracking-wider">{tText('Review System Audit Logs', 'सिस्टम ऑडिट लॉग्स देखें')}</div>
                    <div className="text-[10px] text-slate-300 dark:text-blue-100 font-normal">
                      {tText('Track role edits, profit margins & config changes', 'भूमिका बदलाव, लाभ मार्जिन व सिस्टम बदलावों का ऑडिट')}
                    </div>
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-300" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Preferences Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-900/30">
                <Globe size={20} />
              </div>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-tight">{t('language')} &amp; {t('theme')}</h2>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Localization &amp; Display</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold">{t('language')}</p>
                <p className="text-[10px] text-slate-500">{language === 'hi' ? 'हिन्दी या English चुनें' : 'Choose your preferred language'}</p>
              </div>
              <LanguageToggle variant="pill" />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold">{t('theme')}</p>
                <p className="text-[10px] text-slate-500">{language === 'hi' ? 'डे-लाइट, क्लासिक डार्क या मिडनाइट चुनें' : 'Select Day, Dark, or Midnight theme'}</p>
              </div>
              <ThemeSelector variant="compact" />
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
              <div>
                <p className="text-xs font-bold">{tText('Getting Started Walkthrough', 'शुरुआती सिस्टम टूर')}</p>
                <p className="text-[10px] text-slate-500">{language === 'hi' ? 'पीओएस, इन्वेंटरी और एआई सहायक की 1 मिनट की इंटरएक्टिव गाइड' : '1-minute interactive walkthrough highlighting POS, Inventory & AI'}</p>
              </div>
              <button 
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open-onboarding-tour'))}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[10px] font-bold text-white transition-all hover:bg-indigo-700 shadow-sm active:scale-95 cursor-pointer"
              >
                <Compass size={12} />
                <span>{tText('Launch Tour', 'टूर शुरू करें')}</span>
              </button>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
              <div>
                <p className="text-xs font-bold">{t('backupAndData')}</p>
                <p className="text-[10px] text-slate-500">{language === 'hi' ? 'इन्वेंटरी, बिक्री और मरीजों के डेटा का 1-क्लिक सुरक्षित स्नैपशॉट' : '1-Click local system state snapshot & disaster recovery'}</p>
              </div>
              <button 
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open-system-backup'))}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-[10px] font-bold text-white transition-all hover:bg-blue-700 shadow-sm active:scale-95 cursor-pointer"
              >
                <span>{t('backupNow')}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Smart Alerts (Device & Session Push Notifications) Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.11 }}
        className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-gradient-to-br from-amber-50/40 via-white to-rose-50/20 p-6 shadow-sm dark:bg-slate-900"
      >
        <SmartAlertsSettingsPanel />
      </motion.div>

      {/* 1-Click System State Backup & Disaster Recovery Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-gradient-to-br from-blue-50/40 via-white to-emerald-50/20 p-6 shadow-sm dark:bg-slate-900"
      >
        <SystemBackupPanel />
      </motion.div>

      {/* Automated Monthly Updates & Innovation Engine Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-gradient-to-br from-blue-50/50 via-white to-indigo-50/30 p-6 shadow-sm dark:bg-slate-900"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
              <Sparkles size={20} className="text-amber-300 animate-spin" style={{ animationDuration: '6s' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Automated Monthly Software Updates & Innovation Engine
                </h2>
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 text-[10px] font-black text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {updateConfig.installedVersion} Active
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Automatically deploys new ERP features, seasonal medicine demand packs, and high-margin business ideas every month.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleCheckUpdate}
              disabled={isCheckingUpdate}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
            >
              <RefreshCw size={13} className={cn(isCheckingUpdate && "animate-spin")} />
              <span>{isCheckingUpdate ? "Checking..." : "Check Updates"}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsHubModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-all shadow-sm cursor-pointer active:scale-95"
            >
              <Rocket size={14} />
              <span>Open Monthly Hub</span>
            </button>
          </div>
        </div>

        {updateMsg && (
          <div className="my-4 rounded-xl bg-blue-50 dark:bg-blue-950/50 p-3 text-xs text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span>{updateMsg}</span>
            </div>
            <button onClick={() => setUpdateMsg(null)} className="text-[10px] font-bold text-blue-600 hover:underline">Dismiss</button>
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-3 pt-5">
          <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200/60 dark:border-slate-800">
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Automatic Monthly Updates</p>
              <p className="text-[10px] text-slate-500">Auto-applies on 1st of every month</p>
            </div>
            <button
              type="button"
              onClick={handleToggleAutoUpdate}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden",
                updateConfig.autoUpdateEnabled ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                  updateConfig.autoUpdateEnabled ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200/60 dark:border-slate-800">
            <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Release Channel</p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {updateConfig.updateChannel === 'stable' ? "Stable Enterprise (Recommended)" : "Innovation Preview"}
            </p>
            <span className="inline-block mt-2 rounded-md bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 text-[9px] font-black text-blue-700 dark:text-blue-300">
              Verified Production Ready
            </span>
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200/60 dark:border-slate-800">
            <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Adopted Business Strategies</p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {updateConfig.adoptedIdeaIds.length} strategies active in your pharmacy
            </p>
            <button
              onClick={() => setIsHubModalOpen(true)}
              className="mt-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>View Business Action Plans</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Modal for Monthly Update Hub */}
      {isHubModalOpen && (
        <MonthlyUpdateHub isModal onClose={() => setIsHubModalOpen(false)} />
      )}

      {/* Automated Critical Stock Email Alerts Configuration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.17 }}
        className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-gradient-to-br from-rose-50/40 via-white to-orange-50/20 p-6 shadow-sm dark:bg-slate-900"
      >
        <StockEmailAlertSettingsPanel />
      </motion.div>

      {/* Logged-In Members & Staff Session Monitor */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
      >
        <LoggedInMembersMonitor />
      </motion.div>

      {/* Upcoming Expiries Configuration Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <ExpirySettingsPanel />
      </motion.div>
    </div>
  );
};

export default Settings;
