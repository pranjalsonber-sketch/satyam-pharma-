import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Users, 
  Settings2, 
  ShieldAlert, 
  FileText, 
  Eye, 
  RefreshCw, 
  Plus, 
  X, 
  Check, 
  AlertCircle,
  ExternalLink,
  PackageCheck,
  Server,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  StockAlertSettings, 
  EmailAlertLog, 
  getStockAlertSettings, 
  saveStockAlertSettings, 
  getEmailAlertLogs, 
  saveEmailAlertLog, 
  clearEmailAlertLogs,
  evaluateCriticalStockItems,
  CriticalItemAlertPayload
} from '../lib/emailAlertSettings';
import { collection, getDocs, query, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Medicine } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from './AuthProvider';
import { logAuditAction } from '../lib/auditLogger';
import { cn } from '../lib/utils';

export const StockEmailAlertSettingsPanel: React.FC<{ isModal?: boolean; onClose?: () => void }> = ({
  isModal = false,
  onClose
}) => {
  const { t, tText, isHindi } = useLanguage();
  const { profile, user } = useAuth();
  
  const [settings, setSettings] = useState<StockAlertSettings>(getStockAlertSettings());
  const [logs, setLogs] = useState<EmailAlertLog[]>(getEmailAlertLogs());
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; previewHtml?: string } | null>(null);
  const [selectedPreviewLog, setSelectedPreviewLog] = useState<EmailAlertLog | null>(null);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [emailInputError, setEmailInputError] = useState('');
  const [saveToast, setSaveToast] = useState(false);
  const [smtpConfig, setSmtpConfig] = useState<{ 
    isSmtpConfigured: boolean; 
    gatewayMode: string; 
    senderEmail: string;
    smtpHost?: string | null;
  } | null>(null);

  // Load Inventory from Firestore to compute current critical radar
  const fetchInventory = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(query(collection(db, 'inventory')));
      const list: Medicine[] = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Medicine);
      });
      setMedicines(list);
    } catch (e) {
      console.warn('Error fetching inventory for stock alert monitor:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();

    // Check backend email config
    fetch('/api/notifications/email-config')
      .then(res => res.json())
      .then(data => setSmtpConfig(data))
      .catch(() => {});

    const handleLogsUpdate = (e: any) => {
      if (e?.detail) setLogs(e.detail);
    };
    window.addEventListener('stock-alert-logs-updated', handleLogsUpdate);
    return () => window.removeEventListener('stock-alert-logs-updated', handleLogsUpdate);
  }, []);

  const updateSettingField = <K extends keyof StockAlertSettings>(field: K, value: StockAlertSettings[K]) => {
    const updated = { ...settings, [field]: value };
    setSettings(updated);
    saveStockAlertSettings(updated);
    showSavedNotification();

    logAuditAction({
      action: 'Stock Email Alerts Config Modified',
      category: 'system_config',
      description: `Automated stock alert email settings updated (${String(field)} changed) by ${profile?.displayName || profile?.email}`,
      module: 'settings',
      userEmail: profile?.email,
      userName: profile?.displayName,
      userRole: profile?.role,
      userId: profile?.uid,
      severity: 'info',
      details: {
        fieldChanged: field,
        newValue: value
      }
    });
  };

  const showSavedNotification = () => {
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  const handleAddEmail = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const email = newEmailInput.trim().toLowerCase();
    setEmailInputError('');

    if (!email) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailInputError(tText('Please enter a valid email address.', 'कृपया एक मान्य ईमेल पता दर्ज करें।'));
      return;
    }

    if (settings.adminEmails.includes(email)) {
      setEmailInputError(tText('This email is already in the recipient list.', 'यह ईमेल पहले से सूची में मौजूद है।'));
      return;
    }

    const updated = {
      ...settings,
      adminEmails: [...settings.adminEmails, email]
    };
    setSettings(updated);
    saveStockAlertSettings(updated);
    setNewEmailInput('');
    showSavedNotification();

    logAuditAction({
      action: 'Stock Email Recipient Added',
      category: 'system_config',
      description: `Alert email recipient [${email}] added by ${profile?.displayName || profile?.email}`,
      module: 'settings',
      userEmail: profile?.email,
      userName: profile?.displayName,
      userRole: profile?.role,
      userId: profile?.uid,
      severity: 'info',
      details: {
        addedEmail: email,
        totalRecipients: updated.adminEmails.length
      }
    });
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    if (settings.adminEmails.length <= 1) {
      setEmailInputError(tText('At least one admin email recipient is required.', 'कम से कम एक एडमिन ईमेल पता आवश्यक है।'));
      return;
    }
    const updated = {
      ...settings,
      adminEmails: settings.adminEmails.filter(e => e !== emailToRemove)
    };
    setSettings(updated);
    saveStockAlertSettings(updated);
    showSavedNotification();

    logAuditAction({
      action: 'Stock Email Recipient Removed',
      category: 'system_config',
      description: `Alert email recipient [${emailToRemove}] removed by ${profile?.displayName || profile?.email}`,
      module: 'settings',
      userEmail: profile?.email,
      userName: profile?.displayName,
      userRole: profile?.role,
      userId: profile?.uid,
      severity: 'info',
      details: {
        removedEmail: emailToRemove,
        remainingRecipients: updated.adminEmails.length
      }
    });
  };

  const handleAddCurrentAdminEmail = () => {
    const adminEmail = profile?.email || user?.email;
    if (adminEmail && !settings.adminEmails.includes(adminEmail)) {
      const updated = {
        ...settings,
        adminEmails: [...settings.adminEmails, adminEmail]
      };
      setSettings(updated);
      saveStockAlertSettings(updated);
      showSavedNotification();
    }
  };

  // Evaluate current critical items
  const evaluation = evaluateCriticalStockItems(medicines, settings);

  // Send Test / Immediate Alert
  const handleSendTestAlert = async () => {
    try {
      setIsSendingTest(true);
      setTestResult(null);

      // Gather items to include in alert: use actual critical items or fallback to sample items if all stock is healthy
      let alertItems: CriticalItemAlertPayload[] = evaluation.criticalItems;
      
      if (alertItems.length === 0) {
        // Prepare demo test critical items so the admin can test delivery and inspect email formatting
        alertItems = [
          {
            id: 'test-item-1',
            name: 'Paracetamol 650mg Tablets',
            genericName: 'Paracetamol IP',
            salt: 'Acetaminophen 650mg',
            currentStock: 2,
            minThreshold: 20,
            deficit: 18,
            rate: 28.5,
            supplier: 'Apex Healthcare Distributors',
            type: 'tablet'
          },
          {
            id: 'test-item-2',
            name: 'Augmentin 625 Duo',
            genericName: 'Amoxicillin + Potassium Clavulanate',
            salt: 'Amoxicillin (500mg) + Clavulanic Acid (125mg)',
            currentStock: 0,
            minThreshold: 15,
            deficit: 15,
            rate: 180.0,
            supplier: 'MedPlus Pharma Wholesalers',
            type: 'tablet'
          },
          {
            id: 'test-item-3',
            name: 'Pantocid DSR Capsule',
            genericName: 'Pantoprazole + Domperidone SR',
            salt: 'Pantoprazole 40mg + Domperidone 30mg',
            currentStock: 4,
            minThreshold: 25,
            deficit: 21,
            rate: 145.0,
            supplier: 'LifeCare Distributors',
            type: 'capsule'
          }
        ];
      }

      const response = await fetch('/api/notifications/critical-stock-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: settings.adminEmails,
          items: alertItems,
          triggeredBy: `Manual Admin Test (${profile?.displayName || 'Admin Pharmacist'})`,
          storeName: 'Satyam Medical Store & Pharmacy'
        })
      });

      const resultData = await response.json();

      if (response.ok && resultData.success) {
        const newLog: EmailAlertLog = {
          id: resultData.messageId || `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          recipients: settings.adminEmails,
          subject: resultData.subject,
          itemCount: alertItems.length,
          items: alertItems,
          status: resultData.status || 'delivered',
          previewHtml: resultData.previewHtml,
          triggeredBy: `Admin Test (${profile?.displayName || 'Administrator'})`
        };

        saveEmailAlertLog(newLog);

        // Record in Firestore system activity logs
        try {
          await addDoc(collection(db, 'activity_logs'), {
            action: 'Email Stock Alert Dispatched',
            description: `Automated critical stock email alert sent for ${alertItems.length} items to: ${settings.adminEmails.join(', ')}`,
            timestamp: new Date().toISOString(),
            userEmail: profile?.email || user?.email || 'admin',
            type: 'system'
          });
        } catch (err) {
          // Ignore activity log error
        }

        // Update settings cooldown state
        const updatedSettings: StockAlertSettings = {
          ...settings,
          lastAlertSentAt: new Date().toISOString(),
          lastAlertItemIds: alertItems.map(i => i.id)
        };
        setSettings(updatedSettings);
        saveStockAlertSettings(updatedSettings);

        setTestResult({
          success: true,
          message: tText(
            `Automated email alert dispatched successfully to ${settings.adminEmails.join(', ')} (${resultData.status === 'delivered' ? 'Production SMTP' : 'Simulated Gateway'})`,
            `सफलतापूर्वक ${settings.adminEmails.join(', ')} को ईमेल अलर्ट भेजा गया।`
          ),
          previewHtml: resultData.previewHtml
        });
      } else {
        setTestResult({
          success: false,
          message: resultData.error || tText('Failed to dispatch email alert.', 'ईमेल अलर्ट भेजने में विफलता।')
        });
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e.message || 'Network error dispatching alert.'
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className={cn("space-y-6", isModal && "p-6 bg-white dark:bg-slate-900 rounded-3xl max-h-[88vh] overflow-y-auto")}>
      {/* Header with Status Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-md shadow-rose-600/20">
            <Mail size={22} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                {tText('Automated Critical Stock Email Notification System', 'स्वचालित क्रिटिकल स्टॉक ईमेल नोटिफिकेशन')}
              </h2>
              <span className={cn(
                "rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider border",
                settings.enabled
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                  : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400"
              )}>
                {settings.enabled ? tText('Active & Monitoring', 'सक्रिय व निगरानी चालू') : tText('Disabled', 'अक्षम')}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {tText(
                'Automatically dispatches executive email alerts to administrators when multiple medicines drop below safety thresholds simultaneously.',
                'जब एक साथ कई दवाओं का स्टॉक सुरक्षित सीमा से नीचे गिरता है, तो एडमिन को तुरंत ईमेल अलर्ट भेजता है।'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {saveToast && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 animate-fade-in">
              <Check size={14} />
              {tText('Saved', 'सहेजा गया')}
            </span>
          )}
          {isModal && onClose && (
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Main Settings Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Configuration Controls */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Master Enable/Disable Toggle Box */}
          <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-5">
            <div>
              <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                {tText('Enable Automated Email Stock Alerts', 'स्वचालित ईमेल स्टॉक अलर्ट सक्षम करें')}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {tText(
                  'When enabled, the system continuously evaluates stock after every sale and inventory update.',
                  'सक्षम होने पर, प्रणाली हर बिक्री और इन्वेंटरी अपडेट के बाद स्टॉक की जांच करती है।'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateSettingField('enabled', !settings.enabled)}
              className={cn(
                "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden",
                settings.enabled ? "bg-rose-600" : "bg-slate-300 dark:bg-slate-700"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                  settings.enabled ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>

          {/* Admin Email Recipients List */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
                  <Users size={14} className="text-blue-600" />
                  {tText('Admin Notification Recipients', 'एडमिन ईमेल प्राप्तकर्ता')}
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {tText('All critical stock alerts will be delivered simultaneously to these addresses.', 'सभी क्रिटिकल स्टॉक अलर्ट इन सभी ईमेल पतों पर भेजे जाएंगे।')}
                </p>
              </div>

              {(profile?.email || user?.email) && !settings.adminEmails.includes(profile?.email || user?.email || '') && (
                <button
                  type="button"
                  onClick={handleAddCurrentAdminEmail}
                  className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <Plus size={12} />
                  <span>{tText('Add My Email', 'मेरा ईमेल जोड़ें')}</span>
                </button>
              )}
            </div>

            {/* Email Pills */}
            <div className="flex flex-wrap gap-2 pt-1">
              {settings.adminEmails.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/70 px-3 py-1.5 text-xs font-bold text-blue-800 dark:text-blue-300 shadow-2xs"
                >
                  <Mail size={12} className="text-blue-600 dark:text-blue-400" />
                  <span>{email}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveEmail(email)}
                    className="ml-1 rounded-md p-0.5 text-blue-400 hover:bg-blue-200 hover:text-blue-900 dark:hover:bg-blue-800 transition-colors"
                    title={tText('Remove recipient', 'हटाएं')}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>

            {/* Add New Email Input */}
            <form onSubmit={handleAddEmail} className="flex gap-2 pt-2">
              <input
                type="email"
                placeholder="e.g. director@satyampharmacy.com"
                value={newEmailInput}
                onChange={(e) => {
                  setNewEmailInput(e.target.value);
                  setEmailInputError('');
                }}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
              >
                <Plus size={14} />
                <span>{tText('Add Email', 'ईमेल जोड़ें')}</span>
              </button>
            </form>
            {emailInputError && (
              <p className="text-[11px] font-bold text-rose-500">{emailInputError}</p>
            )}
          </div>

          {/* Multi-Item Threshold & Trigger Conditions */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-5">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-rose-600" />
              {tText('Multi-Item Trigger Rules & Thresholds', 'मल्टी-आइटम ट्रिगर नियम व थ्रेशोल्ड')}
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Simultaneous Critical Item Count Threshold */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {tText('Simultaneous Items Threshold:', 'एक साथ क्रिटिकल होने वाली दवाओं की संख्या:')}
                </label>
                <select
                  value={settings.criticalItemCountThreshold}
                  onChange={(e) => updateSettingField('criticalItemCountThreshold', Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                >
                  <option value={2}>{tText('2 or more items simultaneously (Recommended)', '2 या अधिक दवाएं एक साथ (अनुशंसित)')}</option>
                  <option value={3}>{tText('3 or more items simultaneously', '3 या अधिक दवाएं एक साथ')}</option>
                  <option value={5}>{tText('5 or more items simultaneously', '5 या अधिक दवाएं एक साथ')}</option>
                  <option value={10}>{tText('10 or more items simultaneously', '10 या अधिक दवाएं एक साथ')}</option>
                </select>
                <p className="text-[10px] text-slate-500">
                  {tText('Alert is triggered only when this number of medicines are critically low at the same time.', 'अलर्ट तभी भेजा जाएगा जब इतनी दवाएं एक साथ कम होंगी।')}
                </p>
              </div>

              {/* Critical Calculation Formula */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {tText('Critical Definition Rule:', 'क्रिटिकल स्टॉक की परिभाषा:')}
                </label>
                <select
                  value={settings.criticalThresholdFormula}
                  onChange={(e) => updateSettingField('criticalThresholdFormula', e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                >
                  <option value="min_threshold">{tText('Below Item Min Safe Threshold (minThreshold)', 'उत्पाद के न्यूनतम सुरक्षित थ्रेशोल्ड से नीचे')}</option>
                  <option value="fixed_low">{tText(`Fixed Low Stock (≤ ${settings.fixedThresholdValue} units)`, `निश्चित कम स्टॉक (≤ ${settings.fixedThresholdValue} यूनिट)`)}</option>
                  <option value="zero_stock">{tText('Zero Stock Only (0 units / Out of Stock)', 'केवल शून्य स्टॉक (0 यूनिट / समाप्त)')}</option>
                </select>
                <p className="text-[10px] text-slate-500">
                  {tText('Determines when an individual medicine is classified as critical.', 'यह तय करता है कि किसी दवा को कब क्रिटिकल माना जाए।')}
                </p>
              </div>

              {/* Alert Cooldown Window */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Clock size={12} className="text-amber-500" />
                  {tText('Notification Cooldown Window:', 'ईमेल भेजने का अंतराल (कूलडाउन):')}
                </label>
                <select
                  value={settings.cooldownMinutes}
                  onChange={(e) => updateSettingField('cooldownMinutes', Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                >
                  <option value={15}>{tText('15 Minutes', '15 मिनट')}</option>
                  <option value={30}>{tText('30 Minutes (Recommended)', '30 मिनट (अनुशंसित)')}</option>
                  <option value={60}>{tText('1 Hour', '1 घंटा')}</option>
                  <option value={360}>{tText('6 Hours', '6 घंटे')}</option>
                  <option value={1440}>{tText('24 Hours (Daily Digest)', '24 घंटे (दैनिक डाइजेस्ट)')}</option>
                </select>
                <p className="text-[10px] text-slate-500">
                  {tText('Prevents duplicate emails when rapid sales occur.', 'लगातार बिक्री होने पर बार-बार ईमेल आने से रोकता है।')}
                </p>
              </div>

              {/* Wholesaler info inclusion */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {tText('Distributor Restock Mapping:', 'थोक विक्रेता (सप्लायर) विवरण:')}
                </label>
                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={settings.includeSupplierDetails}
                      onChange={(e) => updateSettingField('includeSupplierDetails', e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-medium">{tText('Include Distributor Names & Est. Rates in Email Table', 'ईमेल में सप्लायर व अनुमानित खरीद दर शामिल करें')}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Live Radar & Test Dispatch */}
        <div className="space-y-6">
          {/* Live Critical Stock Radar */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
                <Zap size={14} className="text-amber-500" />
                {tText('Live Stock Alert Radar', 'लाइव स्टॉक रडार')}
              </h3>
              <button
                type="button"
                onClick={fetchInventory}
                disabled={loading}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                title={tText('Refresh radar', 'रिफ्रेश करें')}
              >
                <RefreshCw size={14} className={cn(loading && "animate-spin")} />
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-100 dark:border-slate-750 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{tText('Critical Items Currently:', 'वर्तमान में क्रिटिकल दवाएं:')}</span>
                <span className={cn(
                  "text-base font-black px-2 py-0.5 rounded-lg",
                  evaluation.criticalItems.length >= settings.criticalItemCountThreshold
                    ? "bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300"
                    : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                )}>
                  {evaluation.criticalItems.length} {tText('items', 'दवाएं')}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] border-t border-slate-200/60 dark:border-slate-700 pt-2 text-slate-500">
                <span>{tText('Simultaneous Threshold:', 'ट्रिगर थ्रेशोल्ड:')}</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">≥ {settings.criticalItemCountThreshold} {tText('items', 'दवाएं')}</span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>{tText('Trigger Status:', 'अलर्ट स्थिति:')}</span>
                <span className={cn(
                  "font-bold",
                  evaluation.isMultiItemCritical ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                )}>
                  {evaluation.isMultiItemCritical ? tText('🚨 Multi-Item Threshold Reached', '🚨 थ्रेशोल्ड पूरा हुआ') : tText('✅ Stock Safe / Below Trigger Count', '✅ सामान्य')}
                </span>
              </div>

              {/* Items List Preview */}
              {evaluation.criticalItems.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-700">
                  <p className="text-[10px] font-black uppercase text-slate-400">{tText('Active Critical Items:', 'सक्रिय क्रिटिकल दवाएं:')}</p>
                  <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                    {evaluation.criticalItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-[11px] py-0.5">
                        <span className="truncate font-medium text-slate-700 dark:text-slate-300 max-w-[140px]">{item.name}</span>
                        <span className="text-rose-600 font-bold shrink-0">{item.currentStock} / {item.minThreshold}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Test Email Dispatch Action */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleSendTestAlert}
                disabled={isSendingTest}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-xs font-black text-white hover:bg-rose-700 transition-all shadow-md hover:shadow-rose-600/25 active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isSendingTest ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>{tText('Dispatching Email Alert...', 'ईमेल अलर्ट भेजा जा रहा है...')}</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>{tText('Dispatch Alert Email & Preview', 'अलर्ट ईमेल भेजें व प्रीव्यू देखें')}</span>
                  </>
                )}
              </button>
              <p className="text-[10px] text-center text-slate-400 leading-snug">
                {tText('Dispatches full HTML email to configured admin addresses and generates preview.', 'एडमिन ईमेल पर पूरा HTML अलर्ट भेजता है और प्रीव्यू दिखाता है।')}
              </p>
            </div>

            {/* Test Result Message & Preview Trigger */}
            {testResult && (
              <div className={cn(
                "rounded-xl p-3.5 text-xs font-medium space-y-2",
                testResult.success 
                  ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800" 
                  : "bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200 border border-rose-200 dark:border-rose-800"
              )}>
                <div className="flex items-start gap-2">
                  {testResult.success ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" /> : <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />}
                  <div className="flex-1 leading-snug">{testResult.message}</div>
                </div>

                {testResult.previewHtml && (
                  <button
                    type="button"
                    onClick={() => setSelectedPreviewLog({
                      id: 'test-preview',
                      timestamp: new Date().toISOString(),
                      recipients: settings.adminEmails,
                      subject: '🚨 URGENT: Critical Stock Alert (Live Preview)',
                      itemCount: evaluation.criticalItems.length || 3,
                      items: evaluation.criticalItems,
                      status: 'delivered',
                      previewHtml: testResult.previewHtml!
                    })}
                    className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    <Eye size={12} />
                    <span>{tText('Open Full Email HTML Preview', 'पूरा ईमेल HTML प्रीव्यू खोलें')}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Gateway Status Badge */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between text-slate-500">
              <span className="flex items-center gap-1.5">
                <Server size={12} />
                {tText('Email Gateway Status:', 'ईमेल गेटवे:')}
              </span>
              <span className="font-black text-slate-700 dark:text-slate-300">
                {smtpConfig?.isSmtpConfigured ? 'Direct SMTP Server' : 'Satyam Cloud Relay'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              {smtpConfig?.isSmtpConfigured
                ? `Active Host: ${smtpConfig.smtpHost}`
                : tText('All alerts are safely formatted, tracked in audit feed, and delivered via cloud dispatch.', 'सभी अलर्ट ऑडिट फीड में ट्रैक होते हैं और क्लाउड डिस्पैच से भेजे जाते हैं।')}
            </p>
          </div>
        </div>
      </div>

      {/* Alert Audit Trail Feed */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
              <FileText size={14} className="text-blue-600" />
              {tText('Stock Alert Email Dispatch History & Audit Trail', 'ईमेल अलर्ट इतिहास व ऑडिट ट्रेल')}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {tText('Record of critical stock alerts sent to administrators.', 'एडमिन को भेजे गए क्रिटिकल स्टॉक ईमेल का रिकॉर्ड।')}
            </p>
          </div>

          {logs.length > 0 && (
            <button
              type="button"
              onClick={clearEmailAlertLogs}
              className="text-[11px] font-bold text-slate-400 hover:text-rose-600 transition-colors"
            >
              {tText('Clear History', 'इतिहास साफ करें')}
            </button>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-400">
            <Mail size={24} className="mx-auto mb-2 opacity-40 text-slate-400" />
            <p>{tText('No email alerts have been dispatched yet.', 'अभी तक कोई ईमेल अलर्ट नहीं भेजा गया है।')}</p>
            <p className="text-[10px] text-slate-400 mt-1">{tText('When multiple items drop below threshold, dispatched emails will appear here.', 'जब कई दवाओं का स्टॉक कम होगा, तो भेजे गए ईमेल यहां दिखेंगे।')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
            {logs.map((log) => (
              <div key={log.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {log.subject}
                    </span>
                    <span className="rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 px-2 py-0.5 text-[9px] font-black uppercase">
                      {log.itemCount} {tText('Items Critical', 'दवाएं क्रिटिकल')}
                    </span>
                    <span className="rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 text-[9px] font-bold">
                      {log.status === 'delivered' ? 'Delivered' : 'Cloud Dispatched'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-3 flex-wrap">
                    <span><strong>To:</strong> {log.recipients.join(', ')}</span>
                    <span><strong>Date:</strong> {new Date(log.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    {log.triggeredBy && <span><strong>Trigger:</strong> {log.triggeredBy}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedPreviewLog(log)}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Eye size={12} />
                    <span>{tText('View Email Preview', 'प्रीव्यू देखें')}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* HTML Email Preview Modal */}
      <AnimatePresence>
        {selectedPreviewLog && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 text-white">
                    <Mail size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      {selectedPreviewLog.subject}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Sent to: {selectedPreviewLog.recipients.join(', ')} • {new Date(selectedPreviewLog.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedPreviewLog(null)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Iframe for safe HTML rendering */}
              <div className="flex-1 p-4 bg-slate-100 dark:bg-slate-950 overflow-auto min-h-[500px]">
                <iframe
                  title="Email Preview"
                  srcDoc={selectedPreviewLog.previewHtml}
                  className="w-full h-[540px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white shadow-inner"
                />
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-6 py-3.5 bg-slate-50 dark:bg-slate-800/40">
                <span className="text-[11px] text-slate-500 font-medium">
                  {tText('This is the exact responsive HTML template received in admin inboxes.', 'यह वही ईमेल टेम्प्लेट है जो एडमिन के इनबॉक्स में प्राप्त होता है।')}
                </span>
                <button
                  onClick={() => setSelectedPreviewLog(null)}
                  className="rounded-xl bg-slate-900 dark:bg-slate-100 px-4 py-2 text-xs font-bold text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
                >
                  {tText('Close Preview', 'प्रीव्यू बंद करें')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StockEmailAlertSettingsPanel;
