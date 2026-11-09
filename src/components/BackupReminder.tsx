import React, { useState, useEffect } from 'react';
import { Download, ShieldCheck, X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cn } from '../lib/utils';

const BACKUP_KEY = 'last_backup_timestamp';
const REMINDER_DAYS = 7;

const BackupReminder: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    // Keep timestamp updated and ensure reminder modal never automatically interrupts or blocks on app start
    localStorage.setItem(BACKUP_KEY, Date.now().toString());
    setShowModal(false);

    const handleTrigger = () => setShowModal(true);
    window.addEventListener('trigger-backup-reminder', handleTrigger);
    return () => window.removeEventListener('trigger-backup-reminder', handleTrigger);
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const collections = ['inventory', 'patients', 'wholesalers', 'sales'];
      const backupData: Record<string, any[]> = {};

      for (const collName of collections) {
        try {
          const querySnapshot = await getDocs(collection(db, collName));
          backupData[collName] = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        } catch (e) {
          console.warn(`Could not export collection ${collName}:`, e);
          backupData[collName] = [];
        }
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pharmacy_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      localStorage.setItem(BACKUP_KEY, Date.now().toString());
      setShowModal(false);
    } catch (error) {
      console.error("Backup failed:", error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <AnimatePresence>
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-zinc-900"
          >
            {/* Header Accent */}
            <div className="h-2 w-full bg-blue-600" />
            
            <div className="p-8">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-900/20">
                <ShieldCheck size={32} />
              </div>

              <h2 className="mb-2 text-2xl font-bold tracking-tight">Security Backup Recommended</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                It has been over {REMINDER_DAYS} days since your last local safety backup. Export your database state now to ensure data redundancy.
              </p>

              <div className="mt-8 flex flex-col gap-3">
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 font-bold text-white shadow-lg transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50"
                >
                  {exporting ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <Download size={20} />
                      <span>Export Database (JSON)</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-full rounded-xl py-3 text-xs font-bold uppercase tracking-widest text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Remind me later
                </button>
              </div>

              <div className="mt-6 flex items-center gap-2 rounded-xl bg-orange-50 p-4 text-[10px] text-orange-700 dark:bg-orange-900/20 dark:text-orange-400">
                <AlertTriangle size={14} className="shrink-0" />
                <p className="font-bold leading-tight">
                  This export contains sensitive patient and inventory data. Store it securely in an encrypted local drive.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X size={20} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default BackupReminder;
