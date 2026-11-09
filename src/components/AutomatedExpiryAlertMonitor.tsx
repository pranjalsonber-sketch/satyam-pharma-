import React, { useEffect, useRef } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Medicine } from '../types';
import { 
  getExpiryAlertSettings, 
  saveExpiryAlertSettings, 
  evaluateExpiringItems,
  ExpiringBatchAlertPayload
} from '../lib/emailAlertSettings';
import { useAuth } from './AuthProvider';

export const AutomatedExpiryAlertMonitor: React.FC = () => {
  const { profile } = useAuth();
  const isEvaluatingRef = useRef(false);
  const lastAttemptTimeRef = useRef(0);

  useEffect(() => {
    // Listen to real-time inventory updates for batch expiry checks
    const q = query(collection(db, 'inventory'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const medicines: Medicine[] = [];
      snapshot.forEach((doc) => {
        medicines.push({ id: doc.id, ...doc.data() } as Medicine);
      });

      await checkAndDispatchExpiryAlert(medicines, 'Real-time Batch Expiry Tracker');
    }, (error) => {
      console.warn('[Expiry Alert Monitor] Snapshot error:', error);
    });

    // Custom event listener for manual triggers (e.g. from Expiry Audit report)
    const handleExplicitTrigger = async (e: any) => {
      const items = e?.detail?.items;
      const triggeredBy = e?.detail?.triggeredBy || 'Manual Expiry Audit Trigger';
      if (items && Array.isArray(items)) {
        await dispatchDirectExpiryAlert(items, triggeredBy);
      }
    };

    window.addEventListener('trigger-expiry-alert-dispatch', handleExplicitTrigger);

    return () => {
      unsubscribe();
      window.removeEventListener('trigger-expiry-alert-dispatch', handleExplicitTrigger);
    };
  }, []);

  const dispatchDirectExpiryAlert = async (items: ExpiringBatchAlertPayload[], triggeredBy: string) => {
    const settings = getExpiryAlertSettings();
    try {
      const response = await fetch('/api/notifications/expiry-alert-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: settings.adminEmails,
          items,
          triggeredBy,
          storeName: 'Satyam Medical Store & Pharmacy',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update last sent time and keys
        const batchKeys = items.map(it => `${it.medicineId}-${it.batchNumber}`);
        saveExpiryAlertSettings({
          ...settings,
          lastAlertSentAt: new Date().toISOString(),
          lastAlertBatchKeys: batchKeys
        });
        console.log('[Expiry Alert Monitor] Dispatched email successfully:', data.messageId);
      }
    } catch (err) {
      console.error('[Expiry Alert Monitor] Error dispatching email:', err);
    }
  };

  const checkAndDispatchExpiryAlert = async (medicines: Medicine[], triggerSource: string) => {
    if (isEvaluatingRef.current) return;

    // Minimum 30-second throttle between client evaluation attempts
    const now = Date.now();
    if (now - lastAttemptTimeRef.current < 30000) return;

    const settings = getExpiryAlertSettings();
    if (!settings.enabled) return;

    const evaluation = evaluateExpiringItems(medicines, settings);

    if (evaluation.shouldSendAlert && evaluation.expiringBatches.length >= (settings.minFlaggedBatchesThreshold || 1)) {
      try {
        isEvaluatingRef.current = true;
        lastAttemptTimeRef.current = now;

        console.log(
          `[Expiry Alert Monitor] Triggering automated email alert for ${evaluation.expiringBatches.length} expiring batches...`
        );

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        try {
          const response = await fetch('/api/notifications/expiry-alert-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              recipients: settings.adminEmails,
              items: evaluation.expiringBatches,
              triggeredBy: triggerSource,
              storeName: 'Satyam Medical Store & Pharmacy',
            }),
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            const batchKeys = evaluation.expiringBatches.map(it => `${it.medicineId}-${it.batchNumber}`);
            saveExpiryAlertSettings({
              ...settings,
              lastAlertSentAt: new Date().toISOString(),
              lastAlertBatchKeys: batchKeys
            });
            console.log('[Expiry Alert Monitor] Automated email dispatch completed:', data.status);
          }
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          console.warn('[Expiry Alert Monitor] Dispatch timed out or failed quietly:', fetchErr);
        }
      } catch (err) {
        console.warn('[Expiry Alert Monitor] Failed to evaluate/dispatch expiry alert:', err);
      } finally {
        isEvaluatingRef.current = false;
      }
    }
  };

  return null; // Headless background monitor
};

export default AutomatedExpiryAlertMonitor;
