import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  Settings as SettingsIcon, 
  Newspaper, 
  Bell, 
  LogOut, 
  Moon, 
  Sun,
  Globe,
  Bot,
  Sparkles,
  Rocket,
  Compass,
  HelpCircle,
  FileText,
  History
} from 'lucide-react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from './lib/firebase';
import { Medicine, ReorderTargetPayload } from './types';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import POS from './components/POS';
import Wholesalers from './components/Wholesalers';
import Regulatory from './components/Regulatory';
import Patients from './components/Patients';
import AIAssistant from './components/AIAssistant';
import Settings from './components/Settings';
import MonthlyUpdateHub from './components/MonthlyUpdateHub';
import LoggedInMembersMonitor from './components/LoggedInMembersMonitor';
import ExpiryAuditReport from './components/ExpiryAuditReport';
import ActivityLogView from './components/ActivityLogView';
import OnboardingTour, { isFirstTimeUser } from './components/OnboardingTour';
import AutomatedStockAlertMonitor from './components/AutomatedStockAlertMonitor';
import AutomatedExpiryAlertMonitor from './components/AutomatedExpiryAlertMonitor';
import SmartAlertsSessionMonitor from './components/SmartAlertsSessionMonitor';
import StockEmailAlertSettingsPanel from './components/StockEmailAlertSettingsPanel';
import SalesReportModal from './components/SalesReportModal';
import SystemBackupModal from './components/SystemBackupModal';
import LanguageToggle from './components/LanguageToggle';
import ThemeSelector from './components/ThemeSelector';
import NetworkStatusToast from './components/NetworkStatusToast';
import BackupReminder from './components/BackupReminder';
import GlobalSearch from './components/GlobalSearch';
import SyncStatus from './components/SyncStatus';
import SyncConflictResolverModal from './components/SyncConflictResolverModal';
import MindRefreshmentWidget from './components/MindRefreshmentWidget';
import SplashScreen from './components/SplashScreen';
import { AppAccessLinkPortal } from './components/AppAccessLinkPortal';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { checkAndApplyMonthlyUpdate, getMonthlyUpdateConfig } from './lib/monthlyUpdates';

function MainApp() {
  const { user, profile, logout, loading, login, isSimulated, exitSimulation } = useAuth();
  const { theme, toggleTheme, currentAestheticConfig, aestheticTheme } = useTheme();
  const { language, setLanguage, t, isHindi, tText } = useLanguage();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [lowStockCount, setLowStockCount] = useState(0);
  const [installedVersion, setInstalledVersion] = useState(getMonthlyUpdateConfig().installedVersion);
  const [onlineMembersCount, setOnlineMembersCount] = useState(1);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isStockAlertModalOpen, setIsStockAlertModalOpen] = useState(false);
  const [isExpiryReportModalOpen, setIsExpiryReportModalOpen] = useState(false);
  const [isSalesReportModalOpen, setIsSalesReportModalOpen] = useState(false);
  const [isSystemBackupOpen, setIsSystemBackupOpen] = useState(false);
  const [isSyncConflictResolverOpen, setIsSyncConflictResolverOpen] = useState(false);
  const [reorderTarget, setReorderTarget] = useState<ReorderTargetPayload | null>(null);
  const [showSplash, setShowSplash] = useState(true);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'manager';
  const isWorkerOnly = profile?.role === 'clerk';

  const WORKER_ALLOWED_TABS = React.useMemo(
    () => new Set(['inventory', 'expiry_report', 'pos', 'ai']),
    []
  );

  const handleSafeTabSelect = React.useCallback(
    (targetTab: string) => {
      if (isWorkerOnly && !WORKER_ALLOWED_TABS.has(targetTab)) {
        setActiveTab('inventory');
        return;
      }
      setActiveTab(targetTab);
    },
    [isWorkerOnly, WORKER_ALLOWED_TABS]
  );

  // Navigation and reorder handler
  const handleReorderNavigate = (module: 'inventory' | 'pos', item: any) => {
    setIsExpiryReportModalOpen(false);
    setReorderTarget({
      medicineId: item.medicineId || item.id || '',
      medicineName: item.medicineName || item.name || '',
      batchNumber: item.batchNumber,
      expiryDate: item.expiryDate,
      rate: item.rate,
      stockQuantity: item.stockQuantity,
      supplier: item.supplier,
      module,
      timestamp: Date.now()
    });
    handleSafeTabSelect(module);
  };

  // Check if first-time user and prompt onboarding tour
  useEffect(() => {
    if (user && isFirstTimeUser()) {
      const timer = setTimeout(() => {
        setIsOnboardingOpen(true);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [user]);

  // Listen for global events
  useEffect(() => {
    const handleOpenTour = () => setIsOnboardingOpen(true);
    const handleOpenStockAlerts = () => {
      if (!isWorkerOnly) setIsStockAlertModalOpen(true);
    };
    const handleOpenExpiryReport = () => setIsExpiryReportModalOpen(true);
    const handleOpenSalesReport = () => {
      if (!isWorkerOnly) setIsSalesReportModalOpen(true);
    };
    const handleOpenSystemBackup = () => {
      if (!isWorkerOnly) setIsSystemBackupOpen(true);
    };
    const handleOpenSyncConflictResolver = () => setIsSyncConflictResolverOpen(true);
    const handleOpenActivityLogs = () => {
      if (!isWorkerOnly) setActiveTab('activity_logs');
    };
    
    const handleNavigateTab = (e: any) => {
      const requestedTab = e?.detail?.tab || e?.detail?.module;
      if (requestedTab) {
        if (e.detail.medicineId || e.detail.medicineName) {
          setReorderTarget({
            medicineId: e.detail.medicineId || '',
            medicineName: e.detail.medicineName || '',
            batchNumber: e.detail.batchNumber,
            expiryDate: e.detail.expiryDate,
            rate: e.detail.rate,
            stockQuantity: e.detail.stockQuantity,
            supplier: e.detail.supplier,
            module: requestedTab,
            timestamp: Date.now()
          });
        }
        setIsExpiryReportModalOpen(false);
        handleSafeTabSelect(requestedTab);
      }
    };

    const handleProcureReorder = (e: any) => {
      const detail = e?.detail;
      if (detail && (detail.module || detail.tab)) {
        const targetModule = (detail.module || detail.tab) as 'inventory' | 'pos';
        setReorderTarget({
          medicineId: detail.medicineId || '',
          medicineName: detail.medicineName || '',
          batchNumber: detail.batchNumber,
          expiryDate: detail.expiryDate,
          rate: detail.rate,
          stockQuantity: detail.stockQuantity,
          supplier: detail.supplier,
          module: targetModule,
          timestamp: Date.now()
        });
        setIsExpiryReportModalOpen(false);
        handleSafeTabSelect(targetModule);
      }
    };

    window.addEventListener('open-onboarding-tour', handleOpenTour);
    window.addEventListener('open-stock-email-alerts', handleOpenStockAlerts);
    window.addEventListener('open-expiry-report', handleOpenExpiryReport);
    window.addEventListener('open-sales-report', handleOpenSalesReport);
    window.addEventListener('open-system-backup', handleOpenSystemBackup);
    window.addEventListener('open-sync-conflict-resolver', handleOpenSyncConflictResolver);
    window.addEventListener('trigger-backup-reminder', handleOpenSystemBackup);
    window.addEventListener('open-activity-logs', handleOpenActivityLogs);
    window.addEventListener('navigate-tab', handleNavigateTab);
    window.addEventListener('navigate-to-module', handleNavigateTab);
    window.addEventListener('procure-reorder-medicine', handleProcureReorder);

    return () => {
      window.removeEventListener('open-onboarding-tour', handleOpenTour);
      window.removeEventListener('open-stock-email-alerts', handleOpenStockAlerts);
      window.removeEventListener('open-expiry-report', handleOpenExpiryReport);
      window.removeEventListener('open-sales-report', handleOpenSalesReport);
      window.removeEventListener('open-system-backup', handleOpenSystemBackup);
      window.removeEventListener('open-sync-conflict-resolver', handleOpenSyncConflictResolver);
      window.removeEventListener('trigger-backup-reminder', handleOpenSystemBackup);
      window.removeEventListener('open-activity-logs', handleOpenActivityLogs);
      window.removeEventListener('navigate-tab', handleNavigateTab);
      window.removeEventListener('navigate-to-module', handleNavigateTab);
      window.removeEventListener('procure-reorder-medicine', handleProcureReorder);
    };
  }, [isWorkerOnly, handleSafeTabSelect]);

  const allTabs = React.useMemo(() => [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard, adminOnly: true },
    { id: 'inventory', label: t('inventory'), icon: Package, badge: lowStockCount },
    { id: 'expiry_report', label: t('expiryReport90D'), icon: FileText },
    { id: 'pos', label: t('pos'), icon: ShoppingCart },
    { id: 'activity_logs', label: t('activityLog'), icon: History, adminOnly: true },
    { id: 'monthly_updates', label: t('monthlyInnovations'), icon: Sparkles, adminOnly: true },
    { id: 'members', label: t('staffLogins'), icon: Users, adminOnly: true },
    { id: 'wholesalers', label: t('wholesalers'), icon: Users, adminOnly: true },
    { id: 'patients', label: t('patients'), icon: Users, adminOnly: true },
    { id: 'ai', label: t('aiAssistant'), icon: Bot },
    { id: 'regulatory', label: t('regulatory'), icon: Newspaper, adminOnly: true },
    { id: 'settings', label: t('settings'), icon: SettingsIcon, persistent: true, adminOnly: true },
  ], [t, lowStockCount]);

  // Real-time listener for online logged-in members count
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      let count = 0;
      snapshot.forEach(docSnap => {
        if (docSnap.data().isOnline) count++;
      });
      setOnlineMembersCount(Math.max(1, count));
    }, (error) => {
      console.warn("Online members listener note (offline/reconnecting):", error.message);
      setOnlineMembersCount(1);
    });

    return () => unsub();
  }, []);

  // Automated Monthly Software Update check on startup
  useEffect(() => {
    const result = checkAndApplyMonthlyUpdate(false);
    setInstalledVersion(getMonthlyUpdateConfig().installedVersion);

    const handleUpdate = () => {
      setInstalledVersion(getMonthlyUpdateConfig().installedVersion);
    };
    window.addEventListener('monthly-update-applied', handleUpdate);
    window.addEventListener('monthly-settings-updated', handleUpdate);
    return () => {
      window.removeEventListener('monthly-update-applied', handleUpdate);
      window.removeEventListener('monthly-settings-updated', handleUpdate);
    };
  }, []);

  // Security: Reset active tab to Inventory (Stock & Expiry) if user is a Worker and tab is Owner-only
  useEffect(() => {
    const currentTab = allTabs.find(t => t.id === activeTab);
    if (currentTab?.adminOnly && !isAdmin) {
      setActiveTab('inventory');
    }
  }, [isAdmin, activeTab, allTabs]);

  useEffect(() => {
    // Real-time listener for low stock items
    const q = query(collection(db, 'inventory'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Medicine));
      const count = items.filter(item => item.stockQuantity <= (item.minThreshold || 10)).length;
      setLowStockCount(count);
    }, (error) => {
      console.warn("Low stock count listener note (offline/reconnecting):", error.message);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center dark:bg-slate-950">
        {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} duration={2200} />}
        <motion.div 
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: showSplash ? 2.1 : 0, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-10 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-600 p-3.5 text-white shadow-xl shadow-sky-500/25">
              <svg 
                className="h-full w-full text-white" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="3.2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </div>
          </div>
          <h1 className="mb-2 text-2xl font-bold tracking-tighter text-slate-900 dark:text-white">
            SATYAM ERP
          </h1>
          <p className="mb-10 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Professional Pharmacy Suite</p>
          <button
            onClick={login}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-slate-900 px-6 py-4 text-xs font-bold uppercase tracking-widest text-white shadow-lg transition-all hover:bg-slate-800 active:scale-95 dark:bg-blue-600 cursor-pointer"
          >
            <Users size={18} />
            Access Terminal
          </button>
          <AppAccessLinkPortal variant="login-card" />
          <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
            <p className="text-[10px] font-medium text-slate-400">Strictly for authorized medical staff only.</p>
          </div>
        </motion.div>
      </div>
    );
  }

  const tabs = allTabs.filter(tab => !tab.adminOnly || isAdmin);

  return (
    <>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} duration={2200} />}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ 
          duration: 0.6, 
          delay: showSplash ? 2.1 : 0, 
          ease: "easeOut" 
        }}
        className={cn(
          "min-h-screen transition-colors duration-300", 
          theme === 'midnight' 
            ? "midnight-theme dark bg-[#050811] text-slate-100" 
            : theme === 'dark' 
              ? "dark bg-slate-950 text-white" 
              : "bg-slate-50 text-slate-900"
        )}
      >
      <div className="flex h-screen overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className={cn(
          "hidden w-64 shrink-0 flex-col border-r text-white md:flex transition-colors",
          theme === 'midnight' ? "bg-[#03060f] border-slate-850" : "bg-slate-900 border-slate-800"
        )}>
          <div className="border-b border-slate-800 p-5 flex items-center gap-3">
            <div 
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-md p-2 transition-all duration-300"
              style={{
                backgroundColor: currentAestheticConfig.primaryColor,
                boxShadow: `0 4px 14px ${currentAestheticConfig.glowColor}`
              }}
            >
              <svg 
                className="h-full w-full text-white" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="3.2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-base font-bold tracking-tight text-white truncate">
                {t('satyamErp')}
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 truncate">{t('tagline')}</p>
            </div>
          </div>
          
          {/* Role Access Scope Indicator in Sidebar */}
          <div className="mx-4 mt-3 rounded-xl border border-slate-800 bg-slate-800/60 px-3 py-2">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
              <span className="text-slate-400">Access Level</span>
              <span className={cn(
                "font-black",
                isWorkerOnly ? "text-amber-400" : "text-emerald-400"
              )}>
                {isWorkerOnly ? "Worker (Clerk)" : "Owner (Admin)"}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-slate-400 truncate">
              {isWorkerOnly
                ? "Inventory · POS · Expiry Report"
                : "All Modules & Settings Unlocked"}
            </p>
          </div>
          
          <nav className="flex-1 space-y-1 overflow-y-auto p-4">
            <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {isWorkerOnly
                ? tText('Stock, POS & Expiry', 'स्टॉक, पीओएस और एक्सपायरी')
                : t('overview')}
            </div>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => handleSafeTabSelect(tab.id)}
                  whileHover={{ scale: 1.02, x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 450, damping: 28 }}
                  style={isActive ? { 
                    backgroundColor: currentAestheticConfig.primaryColor,
                    boxShadow: `0 6px 18px -2px ${currentAestheticConfig.glowColor}`
                  } : {}}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl p-2.5 text-sm font-medium transition-all cursor-pointer",
                    isActive 
                      ? "text-white font-bold shadow-lg" 
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  <tab.icon size={18} className={cn("transition-transform", isActive ? "scale-110 text-white" : "group-hover:scale-110")} />
                  <span className="flex-1 text-left">{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <motion.span 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-lg"
                    >
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </motion.span>
                  )}
                </motion.button>
              );
            })}
            
            <div className="mt-8 mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {isWorkerOnly ? tText('Display & Help', 'डिस्प्ले और सहायता') : t('settings')}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between px-2.5 py-1.5 text-sm text-slate-400">
                <span className="flex items-center gap-2 text-xs"><Globe size={16} /> {t('language')}</span>
                <LanguageToggle variant="pill" />
              </div>
              <motion.button 
                onClick={toggleTheme}
                whileHover={{ scale: 1.025, x: 2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 450, damping: 28 }}
                className="flex w-full items-center justify-between px-2.5 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-3">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={theme}
                      initial={{ rotate: -90, opacity: 0, scale: 0.7 }}
                      animate={{ rotate: 0, opacity: 1, scale: 1 }}
                      exit={{ rotate: 90, opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.25 }}
                      className="inline-flex items-center justify-center"
                    >
                      {theme === 'midnight' ? (
                        <Sparkles size={18} className="text-emerald-400" />
                      ) : theme === 'dark' ? (
                        <Sun size={18} className="text-amber-400" />
                      ) : (
                        <Moon size={18} className="text-blue-400" />
                      )}
                    </motion.span>
                  </AnimatePresence>
                  {t('theme')}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider">
                  {theme === 'midnight' ? 'Midnight' : (theme === 'dark' ? t('light') : t('dark'))}
                </span>
              </motion.button>
              {!isWorkerOnly && (
                <motion.button 
                  onClick={() => handleSafeTabSelect('settings')}
                  whileHover={{ scale: 1.025, x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 450, damping: 28 }}
                  style={activeTab === 'settings' ? { 
                    backgroundColor: currentAestheticConfig.primaryColor,
                    boxShadow: `0 6px 18px -2px ${currentAestheticConfig.glowColor}`
                  } : {}}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl p-2.5 text-sm font-medium transition-all cursor-pointer",
                    activeTab === 'settings' 
                      ? "text-white font-bold shadow-lg" 
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  <SettingsIcon size={18} />
                  <span className="flex-1 text-left">{t('systemSettings')}</span>
                </motion.button>
              )}
              <motion.button 
                onClick={() => setIsOnboardingOpen(true)}
                whileHover={{ scale: 1.025, x: 2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 450, damping: 28 }}
                className="flex w-full items-center gap-3 rounded-lg p-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              >
                <Compass size={18} className="text-indigo-400" />
                <span className="flex-1 text-left">{tText('Getting Started Tour', 'शुरुआती टूर')}</span>
              </motion.button>
            </div>
          </nav>

          <div className="m-3 mt-auto">
            <MindRefreshmentWidget />
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3 md:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-emerald-600 p-1.5 text-white shadow-sm">
                <svg 
                  className="h-full w-full text-white" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="3.2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
              </div>
              <h2 className="text-base font-bold tracking-tight">{t('satyamErp')}</h2>
            </div>

            <GlobalSearch onNavigate={(tab) => handleSafeTabSelect(tab)} />

            <div className="flex items-center gap-3 sm:gap-4">
              {/* Daily Thought & Mind Refreshment Top Header Pill */}
              <MindRefreshmentWidget variant="header-pill" className="hidden xl:flex" />

              {/* App Access & Live Link Portal Button with Redirect Confirmation */}
              <AppAccessLinkPortal
                variant="header-button"
                onOpenMembersModal={() => {
                  if (isAdmin) {
                    handleSafeTabSelect('members');
                  } else {
                    setIsMembersModalOpen(true);
                  }
                }}
              />

              {/* Getting Started Guide / Tour Launcher */}
              <button
                type="button"
                onClick={() => setIsOnboardingOpen(true)}
                className="hidden sm:flex items-center gap-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/60 px-3 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-all cursor-pointer shadow-2xs"
                title={tText('Interactive Getting Started Walkthrough', 'सिस्टम गाइड व शुरुआती टूर')}
              >
                <Compass size={13} className="text-indigo-600 dark:text-indigo-400 animate-spin-slow" />
                <span className="text-[11px] font-black">{tText('App Tour', 'गाइड टूर')}</span>
              </button>

              {/* Language Switcher Toggle in Top Header */}
              <div className="flex items-center">
                <LanguageToggle variant="pill" className="hidden sm:inline-flex" />
                <LanguageToggle variant="compact" className="sm:hidden flex" />
              </div>

              {/* Logged-In Members Live Indicator for Admin / Owners */}
              {!isWorkerOnly && (
                <button
                  type="button"
                  onClick={() => {
                    if (isAdmin) {
                      handleSafeTabSelect('members');
                    } else {
                      setIsMembersModalOpen(true);
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/60 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-all cursor-pointer shadow-2xs"
                  title={t('activeStaffTitle')}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[11px] font-black">{onlineMembersCount} {t('onlineMembers')}</span>
                </button>
              )}

              {/* Monthly Auto-Update Status Indicator for Admin / Owners */}
              {!isWorkerOnly && (
                <button
                  type="button"
                  onClick={() => handleSafeTabSelect('monthly_updates')}
                  className="hidden lg:flex items-center gap-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/60 px-3 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition-all cursor-pointer shadow-2xs"
                  title={t('viewMonthlyUpdates')}
                >
                  <Sparkles size={13} className="text-amber-500 animate-pulse" />
                  <span className="text-[11px] font-black">{installedVersion} {t('monthlyOtaActive')}</span>
                </button>
              )}

              <div className="hidden xl:block">
                <SyncStatus />
              </div>

              {/* Aesthetic Palette Popover Switcher */}
              <ThemeSelector variant="header-popover" />

              <motion.button 
                onClick={toggleTheme} 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 transition-all cursor-pointer shadow-2xs border overflow-hidden",
                  theme === 'midnight' 
                    ? "bg-slate-900 border-indigo-500/40 text-emerald-400 hover:bg-slate-850" 
                    : theme === 'dark' 
                      ? "bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700" 
                      : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                )}
                title={
                  theme === 'midnight' 
                    ? 'Midnight High-Contrast (Click for Light Mode)' 
                    : theme === 'dark' 
                      ? 'Dark Mode (Click for Midnight Mode)' 
                      : 'Light Mode (Click for Dark Mode)'
                }
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={theme}
                    initial={{ rotate: -90, opacity: 0, scale: 0.7 }}
                    animate={{ rotate: 0, opacity: 1, scale: 1 }}
                    exit={{ rotate: 90, opacity: 0, scale: 0.7 }}
                    transition={{ duration: 0.22 }}
                    className="flex items-center gap-1.5"
                  >
                    {theme === 'midnight' ? (
                      <>
                        <Sparkles size={14} className="text-emerald-400 animate-pulse" />
                        <span className="hidden sm:inline text-[10px] font-black uppercase text-emerald-400">Midnight</span>
                      </>
                    ) : theme === 'dark' ? (
                      <>
                        <Moon size={14} className="text-blue-400" />
                        <span className="hidden sm:inline text-[10px] font-black uppercase text-slate-300">Dark</span>
                      </>
                    ) : (
                      <>
                        <Sun size={14} className="text-amber-500" />
                        <span className="hidden sm:inline text-[10px] font-black uppercase text-slate-600">Light</span>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              </motion.button>
              <div className="relative">
                <Bell size={20} className="text-slate-500" />
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold">3</span>
              </div>
              <div className="hidden flex-col items-end md:flex">
                <p className="text-xs font-bold">{profile?.displayName || user.displayName || 'Pharmacist'}</p>
                <p className={cn(
                  "text-[10px] uppercase font-black tracking-widest",
                  isWorkerOnly ? "text-amber-600 dark:text-amber-400" : "text-purple-600 dark:text-purple-400"
                )}>
                  {isWorkerOnly ? '📦 Worker (Stock & Expiry)' : '👑 Owner (Full Access)'}
                </p>
              </div>
              <div className="h-9 w-9 sm:h-10 sm:w-10 overflow-hidden rounded-full border border-slate-200 bg-blue-500 shadow-inner">
                <img src={user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user.displayName}`} alt="User" />
              </div>
              <button onClick={logout} className="rounded-full p-2 text-slate-400 hover:text-red-500 transition-colors" title={t('logout')}>
                <LogOut size={20} />
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto bg-slate-50 p-6 dark:bg-slate-950">
            <div className="mx-auto max-w-7xl">
              {isSimulated && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900 shadow-xs dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-amber-600 px-2 py-0.5 text-[10px] font-black uppercase text-white">
                      {isWorkerOnly ? 'Worker Access Mode' : 'Owner Access Mode'}
                    </span>
                    <span>
                      Previewing as <strong>{profile?.displayName}</strong> ({profile?.email}) —{' '}
                      {isWorkerOnly
                        ? 'Restricted ONLY to Stock, Expiry & Counter (Financials, Wholesalers & Owner tabs hidden).'
                        : 'Full Owner Access to all modules.'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (exitSimulation) exitSimulation();
                      setActiveTab('members');
                    }}
                    className="rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-black text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 cursor-pointer"
                  >
                    Return to Owner Account
                  </button>
                </div>
              )}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === 'dashboard' && !isWorkerOnly && <Dashboard onNavigate={(tab) => handleSafeTabSelect(tab)} />}
                  {(activeTab === 'inventory' || (isWorkerOnly && !WORKER_ALLOWED_TABS.has(activeTab))) && <Inventory reorderTarget={reorderTarget} />}
                  {activeTab === 'expiry_report' && <ExpiryAuditReport onNavigateToReorder={handleReorderNavigate} />}
                  {activeTab === 'pos' && <POS reorderTarget={reorderTarget} />}
                  {activeTab === 'activity_logs' && !isWorkerOnly && <ActivityLogView />}
                  {activeTab === 'monthly_updates' && !isWorkerOnly && <MonthlyUpdateHub onNavigate={(tab) => handleSafeTabSelect(tab)} />}
                  {activeTab === 'members' && !isWorkerOnly && <LoggedInMembersMonitor />}
                  {activeTab === 'wholesalers' && !isWorkerOnly && <Wholesalers />}
                  {activeTab === 'patients' && !isWorkerOnly && <Patients />}
                  {activeTab === 'ai' && <AIAssistant onNavigate={(tab) => handleSafeTabSelect(tab)} />}
                  {activeTab === 'regulatory' && !isWorkerOnly && <Regulatory />}
                  {activeTab === 'settings' && !isWorkerOnly && <Settings />}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>

      {/* Logged In Members Modal */}
      {isMembersModalOpen && (
        <LoggedInMembersMonitor isModal onClose={() => setIsMembersModalOpen(false)} />
      )}

      {/* 90-Day Expiry Audit Report Modal */}
      {isExpiryReportModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="relative w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-3xl bg-white dark:bg-slate-900 shadow-2xl">
            <ExpiryAuditReport 
              isModal 
              onClose={() => setIsExpiryReportModalOpen(false)} 
              onNavigateToReorder={handleReorderNavigate}
            />
          </div>
        </div>
      )}

      {/* Sales & Revenue Report Modal with PDF Export */}
      {isSalesReportModalOpen && (
        <SalesReportModal 
          isOpen={isSalesReportModalOpen} 
          onClose={() => setIsSalesReportModalOpen(false)} 
        />
      )}

      {/* Local System State Backup & Disaster Recovery Modal */}
      {isSystemBackupOpen && (
        <SystemBackupModal
          isOpen={isSystemBackupOpen}
          onClose={() => setIsSystemBackupOpen(false)}
        />
      )}

      {/* Offline POS Sync Conflict Resolution & Review Hub */}
      {isSyncConflictResolverOpen && (
        <SyncConflictResolverModal
          isOpen={isSyncConflictResolverOpen}
          onClose={() => setIsSyncConflictResolverOpen(false)}
        />
      )}

      {/* Stock Email Alerts Settings Modal for Admin */}
      {isStockAlertModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="relative w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-3xl bg-white dark:bg-slate-900 shadow-2xl">
            <StockEmailAlertSettingsPanel isModal onClose={() => setIsStockAlertModalOpen(false)} />
          </div>
        </div>
      )}

      {/* Automated Real-time Critical Stock Email Notification Engine */}
      <AutomatedStockAlertMonitor />

      {/* Automated Real-time Batch Expiry Email Notification Engine */}
      <AutomatedExpiryAlertMonitor />

      {/* Device & Session-Specific Smart Alerts Push Notification Engine */}
      <SmartAlertsSessionMonitor />

      {/* Lightweight Getting Started Onboarding Walkthrough */}
      {isOnboardingOpen && (
        <OnboardingTour 
          isOpen={isOnboardingOpen}
          onClose={() => setIsOnboardingOpen(false)}
          onNavigateTab={(tabId) => setActiveTab(tabId)}
          currentActiveTab={activeTab}
        />
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 z-40 w-full border-t bg-white px-2 py-1 shadow-2xl dark:border-slate-800 dark:bg-slate-900 md:hidden">
        <div className="flex justify-around">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: "spring", stiffness: 450, damping: 25 }}
                style={isActive ? { color: currentAestheticConfig.primaryColor } : {}}
                className={cn(
                  "flex flex-col items-center rounded-xl p-2 transition-colors relative cursor-pointer",
                  isActive 
                    ? "font-bold bg-slate-100 dark:bg-slate-800/80" 
                    : "text-zinc-400"
                )}
              >
                <div className="relative">
                  <tab.icon size={22} />
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
                      {tab.badge > 9 ? '9+' : tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium mt-1 truncate max-w-[60px]">{tab.label}</span>
              </motion.button>
            );
          })}
        </div>
      </nav>
      <NetworkStatusToast />
      <BackupReminder />
    </motion.div>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
