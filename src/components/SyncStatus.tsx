import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCcw, AlertTriangle, Layers, ShieldCheck } from 'lucide-react';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { getOfflineQueueStats, diagnoseAllPendingConflicts } from '../lib/offlinePosStore';

const SyncStatus: React.FC = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState(0);
  const [hasConflicts, setHasConflicts] = useState(false);

  const checkPendingQueue = async () => {
    try {
      const stats = await getOfflineQueueStats();
      setPendingCount(stats.pendingCount);
      if (stats.pendingCount > 0 && navigator.onLine) {
        const analyses = await diagnoseAllPendingConflicts();
        setHasConflicts(analyses.some(a => a.hasConflicts));
      } else {
        setHasConflicts(false);
      }
    } catch (e) {
      // IndexedDB fallback
    }
  };

  useEffect(() => {
    checkPendingQueue();

    // Listen to network status
    const handleOnline = () => {
      setIsOnline(true);
      checkPendingQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
      checkPendingQueue();
    };
    const handleSalesUpdated = () => {
      checkPendingQueue();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-sales-updated', handleSalesUpdated);
    window.addEventListener('offline-sync-completed', handleSalesUpdated);

    // Monitor Firestore sync status via metadata
    const q = query(collection(db, 'inventory'), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setIsSyncing(snapshot.metadata.hasPendingWrites);
    }, (error) => {
      console.warn("Sync monitor note (offline mode active):", error.message);
    });

    const interval = setInterval(checkPendingQueue, 20000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-sales-updated', handleSalesUpdated);
      window.removeEventListener('offline-sync-completed', handleSalesUpdated);
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  const handleClick = () => {
    if (pendingCount > 0) {
      window.dispatchEvent(new CustomEvent('open-sync-conflict-resolver'));
    } else {
      window.dispatchEvent(new CustomEvent('open-system-backup'));
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={
        pendingCount > 0
          ? `${pendingCount} offline POS transactions pending merge. Click to review & resolve sync conflicts.`
          : 'Click to view Cloud Sync Status, Create 1-Click Snapshot, or Restore Database'
      }
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all cursor-pointer shadow-2xs border",
        pendingCount > 0 && hasConflicts
          ? "bg-rose-50 border-rose-300 dark:bg-rose-950/60 dark:border-rose-800 text-rose-800 dark:text-rose-200 animate-pulse hover:bg-rose-100"
          : pendingCount > 0
            ? "bg-amber-50 border-amber-300 dark:bg-amber-950/60 dark:border-amber-800 text-amber-800 dark:text-amber-200 hover:bg-amber-100"
            : "bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 text-slate-700 dark:text-slate-300"
      )}
    >
      <div className="relative">
        <AnimatePresence mode="wait">
          {isSyncing ? (
            <motion.div
              key="syncing"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <RefreshCcw size={14} className="text-blue-500 animate-spin" />
            </motion.div>
          ) : pendingCount > 0 ? (
            <motion.div
              key="pending-warning"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              {hasConflicts ? (
                <AlertTriangle size={14} className="text-rose-600" />
              ) : (
                <Layers size={14} className="text-amber-600" />
              )}
            </motion.div>
          ) : isOnline ? (
            <motion.div
              key="synced"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <Cloud size={14} className="text-emerald-500" />
            </motion.div>
          ) : (
            <motion.div
              key="offline"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <CloudOff size={14} className="text-slate-400" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pulsing indicator for active sync or conflicts */}
        {isSyncing ? (
          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-blue-500 animate-ping" />
        ) : pendingCount > 0 ? (
          <span className={cn(
            "absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full animate-ping",
            hasConflicts ? "bg-rose-500" : "bg-amber-500"
          )} />
        ) : null}
      </div>

      <span className={cn(
        "text-[10px] font-black uppercase tracking-widest",
        pendingCount > 0 && hasConflicts
          ? "text-rose-700 dark:text-rose-300"
          : pendingCount > 0
            ? "text-amber-700 dark:text-amber-300"
            : isSyncing
              ? "text-blue-600"
              : isOnline
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-slate-400"
      )}>
        {isSyncing
          ? "Syncing..."
          : pendingCount > 0
            ? `${pendingCount} Offline • Merge`
            : isOnline
              ? "Cloud Synced"
              : "Offline"}
      </span>
    </button>
  );
};

export default SyncStatus;
