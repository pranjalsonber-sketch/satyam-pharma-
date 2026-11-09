import React, { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Medicine } from '../types';
import { 
  getSmartAlertsConfig, 
  evaluateSmartAlerts, 
  dispatchSmartPushNotification, 
  SmartPushPayload,
  SmartAlertsConfig
} from '../lib/smartAlerts';
import { useLanguage } from '../context/LanguageContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BellRing, 
  Flame, 
  Clock, 
  X, 
  ArrowRight, 
  MapPin, 
  Package, 
  AlertTriangle 
} from 'lucide-react';
import { cn } from '../lib/utils';

export const SmartAlertsSessionMonitor: React.FC = () => {
  const { tText } = useLanguage();
  const [activeBanner, setActiveBanner] = useState<SmartPushPayload | null>(null);
  const notifiedCacheRef = useRef<Map<string, number>>(new Map());
  const initialSyncRef = useRef<boolean>(true);

  useEffect(() => {
    // 1. Listen for in-app banner dispatches
    const handleInAppBanner = (e: any) => {
      if (e?.detail) {
        setActiveBanner(e.detail);
        // Auto-dismiss in-app banner after 8 seconds
        setTimeout(() => {
          setActiveBanner((curr) => (curr === e.detail ? null : curr));
        }, 8000);
      }
    };

    window.addEventListener('smart-alert-in-app-banner', handleInAppBanner);

    // 2. Real-time Firestore Inventory Monitor for Device Push Alerts
    const q = query(collection(db, 'inventory'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const config = getSmartAlertsConfig();
      if (!config.enabled) return;

      const medicines: Medicine[] = [];
      snapshot.forEach((doc) => {
        medicines.push({ id: doc.id, ...doc.data() } as Medicine);
      });

      // Avoid blasting alerts on the very first mount if the app just loaded
      if (initialSyncRef.current) {
        initialSyncRef.current = false;
        // Pre-populate cache for existing items so we only notify on fresh events or cooldown expiry
        const now = Date.now();
        const { expiringItems, lowStockItems } = evaluateSmartAlerts(medicines, config);
        expiringItems.forEach((it) => {
          notifiedCacheRef.current.set(`exp-${it.medicine.id}-${it.batchNumber}`, now);
        });
        lowStockItems.forEach((it) => {
          notifiedCacheRef.current.set(`stock-${it.medicine.id}`, now);
        });
        return;
      }

      checkAndDispatchSessionAlerts(medicines, config);
    }, (error) => {
      console.warn('[Smart Alerts Monitor] Inventory subscription notice:', error.message);
    });

    return () => {
      window.removeEventListener('smart-alert-in-app-banner', handleInAppBanner);
      unsubscribe();
    };
  }, []);

  const checkAndDispatchSessionAlerts = (medicines: Medicine[], config: SmartAlertsConfig) => {
    if (!config.enabled) return;

    const now = Date.now();
    const cooldownMs = (config.throttleCooldownMinutes || 30) * 60 * 1000;
    const { expiringItems, lowStockItems } = evaluateSmartAlerts(medicines, config);

    // 1. Process Low Stock Alerts
    if (config.lowStockAlerts) {
      for (const item of lowStockItems) {
        const key = `stock-${item.medicine.id}`;
        const lastSent = notifiedCacheRef.current.get(key) || 0;

        if (now - lastSent >= cooldownMs) {
          notifiedCacheRef.current.set(key, now);
          const isZero = item.stock <= 0;
          const loc = item.medicine.location 
            ? `${item.medicine.location.aisle || ''} ${item.medicine.location.rack || ''}`.trim()
            : 'General Stock';

          dispatchSmartPushNotification({
            title: isZero 
              ? `🚨 Out of Stock: ${item.medicine.name}` 
              : `⚠️ Low Stock Alert: ${item.medicine.name}`,
            body: isZero 
              ? `Stock depleted (0 units remaining). Location: ${loc || 'Warehouse'}. Tap to reorder.`
              : `Only ${item.stock} units left (Min threshold: ${item.threshold}). Location: ${loc || 'Warehouse'}.`,
            type: isZero ? 'critical' : 'low_stock',
            medicineId: item.medicine.id,
            medicineName: item.medicine.name,
            stockQuantity: item.stock,
            location: loc,
            tag: `stock-${item.medicine.id}`,
          });

          // Break to avoid sending multiple push notifications simultaneously in one snapshot
          break;
        }
      }
    }

    // 2. Process Expiry Alerts
    if (config.expiryAlerts) {
      for (const item of expiringItems) {
        const key = `exp-${item.medicine.id}-${item.batchNumber}`;
        const lastSent = notifiedCacheRef.current.get(key) || 0;

        if (now - lastSent >= cooldownMs) {
          notifiedCacheRef.current.set(key, now);
          const isCritical = item.daysLeft <= 7;
          const loc = item.medicine.location 
            ? `${item.medicine.location.aisle || ''} ${item.medicine.location.rack || ''}`.trim()
            : 'Shelf Stock';

          dispatchSmartPushNotification({
            title: isCritical 
              ? `⏰ Critical Expiry Alert: ${item.medicine.name}`
              : `⏳ Approaching Expiry: ${item.medicine.name}`,
            body: `Batch ${item.batchNumber} expires in ${item.daysLeft} days (${item.expiryDate}). Shelf: ${loc}.`,
            type: 'expiry',
            medicineId: item.medicine.id,
            medicineName: item.medicine.name,
            batchNumber: item.batchNumber,
            daysRemaining: item.daysLeft,
            location: loc,
            tag: `exp-${item.medicine.id}-${item.batchNumber}`,
          });

          break;
        }
      }
    }
  };

  const handleNavigateToMedicine = () => {
    if (activeBanner?.medicineName) {
      window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'inventory' } }));
    }
    setActiveBanner(null);
  };

  return (
    <AnimatePresence>
      {activeBanner && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed top-4 right-4 z-50 max-w-sm w-full shadow-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md overflow-hidden"
        >
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl shrink-0 shadow-sm",
                activeBanner.type === 'expiry'
                  ? "bg-amber-500 text-white"
                  : activeBanner.type === 'critical'
                  ? "bg-rose-600 text-white"
                  : "bg-orange-500 text-white"
              )}>
                {activeBanner.type === 'expiry' ? (
                  <Clock size={20} />
                ) : (
                  <Flame size={20} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Smart Alert • This Device
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveBanner(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                  {activeBanner.title}
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-snug">
                  {activeBanner.body}
                </p>

                {activeBanner.location && (
                  <div className="flex items-center gap-1 mt-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                    <MapPin size={11} className="text-blue-500" />
                    <span>{activeBanner.location}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">Live Device Monitor</span>
              <button
                type="button"
                onClick={handleNavigateToMedicine}
                className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                <span>{tText('Open in Inventory', 'इन्वेंटरी में देखें')}</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>

          <div className="h-1 bg-gradient-to-r from-amber-500 via-rose-500 to-blue-500 animate-pulse" />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SmartAlertsSessionMonitor;
