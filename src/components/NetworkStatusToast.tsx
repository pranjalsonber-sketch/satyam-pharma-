import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, X, Layers, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { getOfflineQueueStats } from '../lib/offlinePosStore';

const NetworkStatusToast: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showToast, setShowToast] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      setShowToast(true);
      try {
        const stats = await getOfflineQueueStats();
        setPendingCount(stats.pendingCount);
        if (stats.pendingCount === 0) {
          setTimeout(() => setShowToast(false), 3500);
        }
      } catch (e) {
        setTimeout(() => setShowToast(false), 3500);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowToast(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {showToast && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-8 left-1/2 z-[120] -translate-x-1/2 w-auto max-w-[92vw]"
        >
          <div className={cn(
            "flex flex-wrap sm:flex-nowrap items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl backdrop-blur-md transition-colors border",
            isOnline 
              ? "bg-green-50/95 border-green-300 text-green-900 dark:bg-green-950/90 dark:border-green-800 dark:text-green-100" 
              : "bg-red-50/95 border-red-300 text-red-900 dark:bg-red-950/90 dark:border-red-800 dark:text-red-100"
          )}>
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full shrink-0",
              isOnline ? "bg-green-600 text-white" : "bg-red-600 text-white"
            )}>
              {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
            </div>
            
            <div className="flex flex-col pr-2">
              <span className="text-xs font-black uppercase tracking-wider">
                {isOnline ? "Connection Restored" : "Connection Lost • Offline POS Active"}
              </span>
              <p className="text-[11px] font-medium opacity-90">
                {isOnline 
                  ? (pendingCount > 0 
                      ? `${pendingCount} offline sales pending merge to cloud database.`
                      : "Cloud database connected in real-time.")
                  : "All checkout bills are safely saved to local IndexedDB."}
              </p>
            </div>

            {isOnline && pendingCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setShowToast(false);
                  window.dispatchEvent(new CustomEvent('open-sync-conflict-resolver'));
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-700 hover:bg-green-800 text-white text-xs font-black shadow-sm cursor-pointer whitespace-nowrap active:scale-95 transition-all"
              >
                <Layers size={13} />
                <span>Review & Merge ({pendingCount})</span>
              </button>
            )}

            <button 
              type="button"
              onClick={() => setShowToast(false)}
              className="ml-auto rounded-lg p-1.5 hover:bg-black/10 dark:hover:bg-white/10 text-current cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NetworkStatusToast;
