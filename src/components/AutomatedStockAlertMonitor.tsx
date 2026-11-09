import React, { useEffect, useRef } from 'react';
import { collection, onSnapshot, query, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Medicine } from '../types';
import { 
  getStockAlertSettings, 
  saveStockAlertSettings, 
  saveEmailAlertLog, 
  evaluateCriticalStockItems,
  EmailAlertLog
} from '../lib/emailAlertSettings';
import { useAuth } from './AuthProvider';

export const AutomatedStockAlertMonitor: React.FC = () => {
  const { profile, user } = useAuth();
  const isEvaluatingRef = useRef(false);
  const initialLoadRef = useRef(true);
  const lastAttemptTimeRef = useRef(0);

  useEffect(() => {
    // Listen to real-time changes on inventory collection
    const q = query(collection(db, 'inventory'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const medicines: Medicine[] = [];
      snapshot.forEach((doc) => {
        medicines.push({ id: doc.id, ...doc.data() } as Medicine);
      });

      // Avoid triggering immediately on first cold boot if not needed, or evaluate smoothly
      if (initialLoadRef.current) {
        initialLoadRef.current = false;
        // Still evaluate on load to check if active stock is critical
      }

      await checkAndDispatchStockAlert(medicines, 'Real-time Inventory Level Trigger');
    }, (error) => {
      console.warn('[Stock Alert Monitor] Snapshot error:', error);
    });

    // Custom event listener for manual or post-sale triggers
    const handleExplicitTrigger = async (e: any) => {
      const triggeredBy = e?.detail?.triggeredBy || 'Post-Sale Stock Deduction';
      // Fetch latest from state or query
    };

    window.addEventListener('trigger-stock-alert-evaluation', handleExplicitTrigger);

    return () => {
      unsubscribe();
      window.removeEventListener('trigger-stock-alert-evaluation', handleExplicitTrigger);
    };
  }, []);

  const checkAndDispatchStockAlert = async (medicines: Medicine[], triggerSource: string) => {
    if (isEvaluatingRef.current) return;

    // Check throttle (at least 30 seconds between automated evaluation network attempts)
    const now = Date.now();
    if (now - lastAttemptTimeRef.current < 30000) return;

    const settings = getStockAlertSettings();

    if (!settings.enabled) return;

    const evaluation = evaluateCriticalStockItems(medicines, settings);

    if (evaluation.shouldSendAlert && evaluation.criticalItems.length >= settings.criticalItemCountThreshold) {
      try {
        isEvaluatingRef.current = true;
        lastAttemptTimeRef.current = now;

        console.log(
          `[Stock Alert Monitor] Triggering automated email alert for ${evaluation.criticalItems.length} critical medicines...`
        );

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        try {
          const response = await fetch('/api/notifications/critical-stock-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              recipients: settings.adminEmails,
              items: evaluation.criticalItems,
              triggeredBy: triggerSource,
              storeName: 'Satyam Medical Store & Pharmacy',
            }),
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              const newLog: EmailAlertLog = {
                id: data.messageId || `auto-alert-${Date.now()}`,
                timestamp: new Date().toISOString(),
                recipients: settings.adminEmails,
                subject: data.subject,
                itemCount: evaluation.criticalItems.length,
                items: evaluation.criticalItems,
                status: data.status || 'delivered',
                previewHtml: data.previewHtml,
                triggeredBy: triggerSource,
              };

              saveEmailAlertLog(newLog);

              // Update cooldown and tracked item IDs
              const updatedSettings = {
                ...settings,
                lastAlertSentAt: new Date().toISOString(),
                lastAlertItemIds: evaluation.criticalItems.map((i) => i.id),
              };
              saveStockAlertSettings(updatedSettings);

              // Record in Firestore system activity logs
              try {
                await addDoc(collection(db, 'activity_logs'), {
                  action: 'Automated Stock Alert Dispatched',
                  description: `Critical stock email sent to ${settings.adminEmails.join(', ')} for ${evaluation.criticalItems.length} items (${evaluation.criticalItems.map(i => i.name).slice(0, 3).join(', ')}${evaluation.criticalItems.length > 3 ? '...' : ''}).`,
                  timestamp: new Date().toISOString(),
                  userEmail: profile?.email || user?.email || 'system-monitor',
                  type: 'system',
                });
              } catch (err) {
                // Ignore activity log error
              }
            }
          }
        } catch (fetchErr: any) {
          clearTimeout(timeoutId);
          console.warn('[Stock Alert Monitor] Notice: Auto-dispatch network notice:', fetchErr?.message || fetchErr);

          // In offline mode or fetch error, save a local fallback log and update cooldown so we don't spam
          const offlineLog: EmailAlertLog = {
            id: `offline-alert-${Date.now()}`,
            timestamp: new Date().toISOString(),
            recipients: settings.adminEmails,
            subject: `🚨 URGENT: Critical Stock Alert - ${evaluation.criticalItems.length} Medicines [Simulated Audit]`,
            itemCount: evaluation.criticalItems.length,
            items: evaluation.criticalItems,
            status: 'simulated',
            previewHtml: `<p>Logged during offline/simulated mode for ${evaluation.criticalItems.length} critical items.</p>`,
            triggeredBy: `${triggerSource} (Offline Fallback)`,
          };
          saveEmailAlertLog(offlineLog);

          const updatedSettings = {
            ...settings,
            lastAlertSentAt: new Date().toISOString(),
            lastAlertItemIds: evaluation.criticalItems.map((i) => i.id),
          };
          saveStockAlertSettings(updatedSettings);
        }
      } catch (err) {
        console.warn('[Stock Alert Monitor] Notice:', err);
      } finally {
        isEvaluatingRef.current = false;
      }
    }
  };

  return null; // Silent background worker
};

export default AutomatedStockAlertMonitor;
