import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Download, 
  RotateCcw, 
  ShieldCheck, 
  CheckCircle2, 
  HardDrive, 
  Package, 
  Users, 
  Clock, 
  RefreshCw, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { createSystemStateBackup, getLocalRecoverySnapshots } from '../lib/systemBackup';
import { useAuth } from './AuthProvider';
import { useLanguage } from '../context/LanguageContext';
import { cn, formatCurrency } from '../lib/utils';
import SystemBackupModal from './SystemBackupModal';

const SystemBackupPanel: React.FC = () => {
  const { user } = useAuth();
  const { t, tText } = useLanguage();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialTab, setModalInitialTab] = useState<'backup' | 'restore' | 'history'>('backup');
  const [isQuickBackingUp, setIsQuickBackingUp] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const [stats, setStats] = useState({
    medicinesCount: 0,
    patientsCount: 0,
    totalStockUnits: 0,
    totalStockValue: 0,
  });

  const [localCheckpointsCount, setLocalCheckpointsCount] = useState(0);

  useEffect(() => {
    // Read last backup timestamp from localStorage
    const savedTime = localStorage.getItem('last_backup_timestamp');
    if (savedTime) {
      const dt = new Date(parseInt(savedTime));
      setLastBackupTime(isNaN(dt.getTime()) ? null : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
    }

    setLocalCheckpointsCount(getLocalRecoverySnapshots().length);

    // Subscribe to inventory metrics
    const unsubInv = onSnapshot(query(collection(db, 'inventory')), (snap) => {
      let units = 0;
      let val = 0;
      snap.docs.forEach(d => {
        const data = d.data();
        const u = Number(data.stockQuantity) || 0;
        const r = Number(data.rate) || 0;
        units += u;
        val += u * r;
      });
      setStats(prev => ({
        ...prev,
        medicinesCount: snap.docs.length,
        totalStockUnits: units,
        totalStockValue: val,
      }));
    });

    // Subscribe to patients count
    const unsubPat = onSnapshot(query(collection(db, 'patients')), (snap) => {
      setStats(prev => ({
        ...prev,
        patientsCount: snap.docs.length,
      }));
    });

    return () => {
      unsubInv();
      unsubPat();
    };
  }, []);

  const handleQuickBackup = async () => {
    setIsQuickBackingUp(true);
    setSuccessBanner(null);
    try {
      const { filename } = await createSystemStateBackup(user?.email || 'admin@satyam.com', 'One-click quick settings backup');
      const now = new Date();
      setLastBackupTime(now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
      setLocalCheckpointsCount(getLocalRecoverySnapshots().length);
      setSuccessBanner(`Backup saved: ${filename}`);
      setTimeout(() => setSuccessBanner(null), 6000);
    } catch (err: any) {
      alert(`Backup failed: ${err.message}`);
    } finally {
      setIsQuickBackingUp(false);
    }
  };

  const handleOpenRestoreModal = () => {
    setModalInitialTab('restore');
    setIsModalOpen(true);
  };

  const handleOpenFullModal = () => {
    setModalInitialTab('backup');
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-emerald-600 text-white shadow-md shadow-blue-500/20">
            <Database size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
                1-Click System State Backup & Recovery
              </h2>
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 text-[10px] font-black text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Sync Fail-Safe
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Creates JSON snapshot of inventory, batches, and patient records with dual storage (device download + local browser cache).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenRestoreModal}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-all cursor-pointer shadow-2xs"
          >
            <RotateCcw size={14} className="text-blue-600 dark:text-blue-400" />
            <span>Restore / Recover</span>
          </button>

          <button
            type="button"
            onClick={handleQuickBackup}
            disabled={isQuickBackingUp}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 px-4 py-2 text-xs font-black text-white shadow-md shadow-blue-600/25 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {isQuickBackingUp ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Download size={14} />
                <span>1-Click Backup</span>
              </>
            )}
          </button>
        </div>
      </div>

      {successBanner && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/50 p-3 text-xs text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-bold">{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-[10px] font-bold text-emerald-700 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Snapshot Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200/60 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
            <Package size={12} /> Live Inventory
          </span>
          <p className="text-sm font-black text-slate-900 dark:text-slate-100 mt-1">
            {stats.medicinesCount} Medicines
          </p>
          <p className="text-[10px] text-slate-500">{stats.totalStockUnits} total units in stock</p>
        </div>

        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200/60 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
            <Users size={12} /> Patient Profiles
          </span>
          <p className="text-sm font-black text-slate-900 dark:text-slate-100 mt-1">
            {stats.patientsCount} Patients
          </p>
          <p className="text-[10px] text-slate-500">Contact &amp; clinical history</p>
        </div>

        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200/60 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
            <Clock size={12} /> Last Backup
          </span>
          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-1 truncate" title={lastBackupTime || 'Never'}>
            {lastBackupTime || 'Never'}
          </p>
          <p className="text-[10px] text-slate-500">
            {lastBackupTime ? 'Active protection' : 'Recommendation: backup now'}
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200/60 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
            <HardDrive size={12} /> Local Checkpoints
          </span>
          <p className="text-sm font-black text-slate-900 dark:text-slate-100 mt-1">
            {localCheckpointsCount} Saved
          </p>
          <button
            type="button"
            onClick={handleOpenFullModal}
            className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 mt-0.5"
          >
            <span>Manage Snapshots</span>
            <ArrowRight size={10} />
          </button>
        </div>
      </div>

      {/* Embedded Modal */}
      {isModalOpen && (
        <SystemBackupModal
          isOpen={isModalOpen}
          initialTab={modalInitialTab}
          onClose={() => {
            setIsModalOpen(false);
            setLocalCheckpointsCount(getLocalRecoverySnapshots().length);
          }}
        />
      )}
    </div>
  );
};

export default SystemBackupPanel;
