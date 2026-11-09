import React, { useState, useEffect, useRef } from 'react';
import { 
  Database, 
  Download, 
  Upload, 
  RotateCcw, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  FileText, 
  Layers, 
  Calendar, 
  Clock, 
  User, 
  Package, 
  Users, 
  Sparkles, 
  Trash2, 
  RefreshCw, 
  ArrowRight,
  Info,
  Check,
  HardDrive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  createSystemStateBackup, 
  validateSnapshotData, 
  restoreSystemState, 
  getLocalRecoverySnapshots, 
  deleteLocalRecoverySnapshot,
  SystemStateSnapshot,
  RestoreOptions,
  RestoreResult
} from '../lib/systemBackup';
import { useAuth } from './AuthProvider';
import { useLanguage } from '../context/LanguageContext';
import { cn, formatCurrency } from '../lib/utils';
import { logAuditAction } from '../lib/auditLogger';

interface SystemBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'backup' | 'restore' | 'history';
}

const SystemBackupModal: React.FC<SystemBackupModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'backup'
}) => {
  const { user } = useAuth();
  const { t, tText } = useLanguage();
  const [activeTab, setActiveTab] = useState<'backup' | 'restore' | 'history'>(initialTab);

  // Backup State
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState<{ filename: string; countMed: number; countPat: number } | null>(null);
  const [backupNotes, setBackupNotes] = useState('');

  // Restore State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedSnapshot, setParsedSnapshot] = useState<SystemStateSnapshot | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<{ message: string; pct: number }>({ message: '', pct: 0 });
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);

  // Restore Options
  const [restoreInventory, setRestoreInventory] = useState(true);
  const [restorePatients, setRestorePatients] = useState(true);
  const [restoreWholesalers, setRestoreWholesalers] = useState(true);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');

  // Local Recovery History
  const [localSnapshots, setLocalSnapshots] = useState<SystemStateSnapshot[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalSnapshots(getLocalRecoverySnapshots());
      setBackupSuccess(null);
      setRestoreResult(null);
    }
  }, [isOpen]);

  const refreshHistory = () => {
    setLocalSnapshots(getLocalRecoverySnapshots());
  };

  // 1. One-Click Backup Trigger
  const handleTriggerBackup = async () => {
    setIsBackingUp(true);
    setBackupSuccess(null);
    try {
      const { snapshot, filename } = await createSystemStateBackup(user?.email || 'admin@satyam.com', backupNotes);
      setBackupSuccess({
        filename,
        countMed: snapshot.inventory.length,
        countPat: snapshot.patients.length,
      });
      refreshHistory();

      // Log disaster recovery backup audit
      logAuditAction({
        action: 'Disaster Recovery Backup Snapshot Created',
        category: 'system_backup',
        description: `Complete system backup created (${snapshot.inventory.length} medicines, ${snapshot.patients.length} patients) by ${user?.displayName || user?.email}`,
        module: 'settings',
        userEmail: user?.email,
        userName: user?.displayName,
        severity: 'info',
        details: {
          filename,
          medicinesCount: snapshot.inventory.length,
          patientsCount: snapshot.patients.length,
          notes: backupNotes
        }
      });
    } catch (err: any) {
      alert(`Backup failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  // 2. File Selection & Parsing for Restore
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loadJSONFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    loadJSONFile(file);
  };

  const loadJSONFile = (file: File) => {
    setSelectedFile(file);
    setParseError(null);
    setParsedSnapshot(null);
    setRestoreResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const { valid, error, snapshot } = validateSnapshotData(json);
        if (!valid || !snapshot) {
          setParseError(error || 'Invalid backup JSON file.');
        } else {
          setParsedSnapshot(snapshot);
        }
      } catch (err) {
        setParseError('Failed to parse JSON. File may be corrupted.');
      }
    };
    reader.onerror = () => {
      setParseError('Error reading file from disk.');
    };
    reader.readAsText(file);
  };

  // Select a local snapshot from history to stage for restoration
  const handleStageLocalSnapshot = (snap: SystemStateSnapshot) => {
    setParsedSnapshot(snap);
    setSelectedFile(null);
    setParseError(null);
    setRestoreResult(null);
    setActiveTab('restore');
  };

  // 3. Execute Restore
  const handleExecuteRestore = async () => {
    if (!parsedSnapshot) return;

    if (!restoreInventory && !restorePatients && !restoreWholesalers) {
      alert('Please select at least one data category to restore.');
      return;
    }

    const confirmMsg = `Are you sure you want to restore ${restoreInventory ? `${parsedSnapshot.inventory.length} medicines, ` : ''}${restorePatients ? `${parsedSnapshot.patients.length} patients` : ''}?\nMode: ${restoreMode === 'merge' ? 'Merge & Update (Safe)' : 'Full Replace'}`;
    if (!window.confirm(confirmMsg)) return;

    setIsRestoring(true);
    setRestoreProgress({ message: 'Initiating database synchronization...', pct: 5 });

    try {
      const options: RestoreOptions = {
        restoreInventory,
        restorePatients,
        restoreWholesalers,
        mode: restoreMode,
      };

      const result = await restoreSystemState(
        parsedSnapshot,
        options,
        user?.email || 'admin@satyam.com',
        (msg, pct) => {
          setRestoreProgress({ message: msg, pct });
        }
      );

      setRestoreResult(result);

      if (result.success) {
        logAuditAction({
          action: 'Disaster Recovery System State Restored',
          category: 'system_backup',
          description: `Disaster recovery restore executed (${result.medicinesRestored} medicines, ${result.patientsRestored} patients, ${result.wholesalersRestored} wholesalers, Mode: ${restoreMode.toUpperCase()}) by ${user?.displayName || user?.email}`,
          module: 'settings',
          userEmail: user?.email,
          userName: user?.displayName,
          severity: 'warning',
          details: {
            restoreMode,
            medicinesRestored: result.medicinesRestored,
            patientsRestored: result.patientsRestored,
            wholesalersRestored: result.wholesalersRestored
          }
        });
      }
    } catch (err: any) {
      setRestoreResult({
        success: false,
        medicinesRestored: 0,
        patientsRestored: 0,
        wholesalersRestored: 0,
        message: 'Disaster recovery failed during write execution.',
        error: err.message,
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDeleteSnapshot = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this local recovery point?')) {
      deleteLocalRecoverySnapshot(id);
      refreshHistory();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative flex flex-col w-full max-w-5xl max-h-[92vh] rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-slate-100"
      >
        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 p-5 bg-gradient-to-r from-blue-50/70 via-emerald-50/30 to-white dark:from-slate-900 dark:to-slate-900">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-emerald-600 text-white shadow-lg shadow-blue-500/25">
              <Database size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                  Local System State Backup & Recovery
                </h2>
                <span className="flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-300">
                  <ShieldCheck size={12} />
                  Fail-Safe Snapshots
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Create 1-click JSON snapshots of inventory and patient records for rapid disaster recovery during data sync errors.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 transition-all ml-1"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 px-5 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('backup')}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2",
              activeTab === 'backup'
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 border-blue-600 shadow-2xs"
                : "text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900"
            )}
          >
            <Download size={14} />
            <span>Create 1-Click Snapshot</span>
          </button>

          <button
            onClick={() => setActiveTab('restore')}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2",
              activeTab === 'restore'
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 border-blue-600 shadow-2xs"
                : "text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900"
            )}
          >
            <RotateCcw size={14} />
            <span>Restore & Sync Recovery</span>
            {parsedSnapshot && (
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2",
              activeTab === 'history'
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 border-blue-600 shadow-2xs"
                : "text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900"
            )}
          >
            <HardDrive size={14} />
            <span>Local Checkpoints ({localSnapshots.length})</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {/* TAB 1: CREATE SNAPSHOT */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              {/* Feature Highlights Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 p-4">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                    <Package size={16} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Inventory Catalog</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                    Exports all medicines, batch numbers, FEFO expiry dates, barcode mappings, and MRP rates.
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                    <Users size={16} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Patient Records</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                    Exports full patient contact profiles, known drug allergies, chronic conditions, and prescription history.
                  </p>
                </div>

                <div className="rounded-2xl border border-purple-100 dark:border-purple-900/40 bg-purple-50/50 dark:bg-purple-950/20 p-4">
                  <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                    <HardDrive size={16} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Dual Redundancy</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                    Saves JSON file to your device and stores a local recovery checkpoint in browser storage.
                  </p>
                </div>
              </div>

              {/* Action Banner */}
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-900 dark:to-slate-800/60 p-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                  <div className="space-y-2 max-w-xl">
                    <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                      Create Full System State Snapshot
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Click the button below to generate an atomic snapshot of current database state. The snapshot can be instantly re-imported at any time to recover from data sync errors or offline conflicts.
                    </p>

                    <div className="pt-2">
                      <input
                        type="text"
                        placeholder="Optional backup note (e.g., 'Pre-inventory audit checkpoint')"
                        value={backupNotes}
                        onChange={(e) => setBackupNotes(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col items-center sm:items-end gap-2">
                    <button
                      type="button"
                      onClick={handleTriggerBackup}
                      disabled={isBackingUp}
                      className="flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-600/30 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      {isBackingUp ? (
                        <>
                          <RefreshCw size={18} className="animate-spin" />
                          <span>Generating Snapshot...</span>
                        </>
                      ) : (
                        <>
                          <Download size={18} />
                          <span>Create Instant Snapshot</span>
                        </>
                      )}
                    </button>
                    <span className="text-[10px] font-bold text-slate-400">
                      JSON Format • Compatible with all ERP versions
                    </span>
                  </div>
                </div>
              </div>

              {/* Success Notification Banner */}
              <AnimatePresence>
                {backupSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="rounded-2xl border border-emerald-200 bg-emerald-50/90 dark:border-emerald-800/80 dark:bg-emerald-950/60 p-5 text-emerald-900 dark:text-emerald-200"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="p-2 rounded-xl bg-emerald-600 text-white shrink-0 mt-0.5">
                        <CheckCircle2 size={18} />
                      </div>
                      <div className="flex-1 space-y-1">
                        <h4 className="text-sm font-black">System Snapshot Created Successfully!</h4>
                        <p className="text-xs text-emerald-800 dark:text-emerald-300">
                          File downloaded: <strong className="font-mono">{backupSuccess.filename}</strong>
                        </p>
                        <div className="flex flex-wrap gap-4 pt-2 text-xs font-semibold">
                          <span className="flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-900/70 px-2.5 py-1 rounded-lg">
                            <Package size={13} /> {backupSuccess.countMed} Medicines Saved
                          </span>
                          <span className="flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-900/70 px-2.5 py-1 rounded-lg">
                            <Users size={13} /> {backupSuccess.countPat} Patients Saved
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* TAB 2: RESTORE & SYNC RECOVERY */}
          {activeTab === 'restore' && (
            <div className="space-y-6">
              {/* File Dropzone */}
              {!parsedSnapshot && (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-10 text-center transition-all hover:border-blue-500 hover:bg-blue-50/20 cursor-pointer"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform dark:bg-blue-950/60 dark:text-blue-400">
                    <Upload size={28} />
                  </div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">
                    Drop your System State JSON backup file here
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                    Or click to browse your computer for a previously exported <strong className="font-mono">system_state_backup_*.json</strong> file.
                  </p>
                </div>
              )}

              {/* Parse Error Display */}
              {parseError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                    <span>{parseError}</span>
                  </div>
                  <button
                    onClick={() => {
                      setParseError(null);
                      setSelectedFile(null);
                    }}
                    className="text-[10px] uppercase font-black hover:underline"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Parsed Snapshot Preview & Configuration */}
              {parsedSnapshot && (
                <div className="space-y-6">
                  {/* Metadata Header Box */}
                  <div className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/30 p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-200/60 dark:border-blue-900/60 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">
                            Backup File Loaded & Verified
                          </h4>
                          <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-800 dark:text-emerald-300">
                            Valid Schema
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Created on {parsedSnapshot.meta.generatedAt} • Generated by {parsedSnapshot.meta.userEmail || 'Admin'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setParsedSnapshot(null);
                          setSelectedFile(null);
                        }}
                        className="text-xs font-bold text-slate-500 hover:text-rose-600 transition-colors self-start sm:self-center"
                      >
                        Choose Different File
                      </button>
                    </div>

                    {/* Snapshot Contents Summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
                      <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-blue-100 dark:border-slate-800">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Medicines</span>
                        <p className="text-base font-black text-slate-900 dark:text-slate-100 mt-0.5">
                          {parsedSnapshot.inventory.length} items
                        </p>
                      </div>

                      <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-blue-100 dark:border-slate-800">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Patients</span>
                        <p className="text-base font-black text-slate-900 dark:text-slate-100 mt-0.5">
                          {parsedSnapshot.patients.length} records
                        </p>
                      </div>

                      <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-blue-100 dark:border-slate-800">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Wholesalers</span>
                        <p className="text-base font-black text-slate-900 dark:text-slate-100 mt-0.5">
                          {parsedSnapshot.wholesalers.length} suppliers
                        </p>
                      </div>

                      <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-blue-100 dark:border-slate-800">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Inventory Value</span>
                        <p className="text-base font-black text-slate-900 dark:text-slate-100 mt-0.5">
                          {formatCurrency(parsedSnapshot.meta.totalStockValue || 0)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Restore Options Settings */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                      Disaster Recovery Options
                    </h4>

                    {/* Checkbox Selectors */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label className={cn(
                        "flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all",
                        restoreInventory 
                          ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200" 
                          : "border-slate-200 dark:border-slate-800 text-slate-500"
                      )}>
                        <input
                          type="checkbox"
                          checked={restoreInventory}
                          onChange={(e) => setRestoreInventory(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-bold">Restore Inventory ({parsedSnapshot.inventory.length})</span>
                      </label>

                      <label className={cn(
                        "flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all",
                        restorePatients 
                          ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200" 
                          : "border-slate-200 dark:border-slate-800 text-slate-500"
                      )}>
                        <input
                          type="checkbox"
                          checked={restorePatients}
                          onChange={(e) => setRestorePatients(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-bold">Restore Patients ({parsedSnapshot.patients.length})</span>
                      </label>

                      <label className={cn(
                        "flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all",
                        restoreWholesalers 
                          ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200" 
                          : "border-slate-200 dark:border-slate-800 text-slate-500"
                      )}>
                        <input
                          type="checkbox"
                          checked={restoreWholesalers}
                          onChange={(e) => setRestoreWholesalers(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-bold">Restore Wholesalers ({parsedSnapshot.wholesalers.length})</span>
                      </label>
                    </div>

                    {/* Merge Mode Toggle */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">
                        Synchronization Mode
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setRestoreMode('merge')}
                          className={cn(
                            "flex flex-col items-start p-3.5 rounded-xl border text-left transition-all cursor-pointer",
                            restoreMode === 'merge'
                              ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200"
                              : "border-slate-200 dark:border-slate-800 text-slate-600"
                          )}
                        >
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            <CheckCircle2 size={14} className={restoreMode === 'merge' ? "text-emerald-600" : "text-slate-400"} />
                            <span>Safe Merge &amp; Upsert (Recommended)</span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                            Updates existing records with snapshot data while keeping newly created records intact.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRestoreMode('replace')}
                          className={cn(
                            "flex flex-col items-start p-3.5 rounded-xl border text-left transition-all cursor-pointer",
                            restoreMode === 'replace'
                              ? "border-amber-600 bg-amber-50/50 dark:bg-amber-950/30 text-amber-950 dark:text-amber-200"
                              : "border-slate-200 dark:border-slate-800 text-slate-600"
                          )}
                        >
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            <RotateCcw size={14} className={restoreMode === 'replace' ? "text-amber-600" : "text-slate-400"} />
                            <span>Clean Re-write / Replace</span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                            Overwrites existing document fields completely with the exact snapshot state.
                          </p>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar while executing */}
                  {isRestoring && (
                    <div className="rounded-2xl border border-blue-200 bg-blue-50/80 dark:border-blue-900 dark:bg-blue-950/50 p-5 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-blue-900 dark:text-blue-200">
                        <span>{restoreProgress.message}</span>
                        <span>{restoreProgress.pct}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-blue-200 dark:bg-blue-900 overflow-hidden">
                        <div
                          className="h-full bg-blue-600 transition-all duration-300"
                          style={{ width: `${restoreProgress.pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Result Banner */}
                  {restoreResult && (
                    <div className={cn(
                      "rounded-2xl p-5 border text-xs font-medium space-y-1",
                      restoreResult.success
                        ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200"
                        : "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200"
                    )}>
                      <div className="flex items-center gap-2 font-black text-sm">
                        {restoreResult.success ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                        <span>{restoreResult.message}</span>
                      </div>
                      {restoreResult.error && (
                        <p className="text-[11px] text-rose-700 dark:text-rose-300 font-mono mt-1">
                          {restoreResult.error}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Execute Button */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setParsedSnapshot(null)}
                      disabled={isRestoring}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-all"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={handleExecuteRestore}
                      disabled={isRestoring}
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-6 py-2.5 text-xs font-black text-white shadow-md shadow-blue-600/30 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw size={15} />
                      <span>{isRestoring ? 'Restoring Database...' : 'Execute Recovery & Sync'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LOCAL EMERGENCY CHECKPOINTS */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Emergency Recovery Snapshots in Local Storage
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Cached directly inside your browser so you can restore even if disconnected from the cloud.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={refreshHistory}
                  className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <RefreshCw size={12} />
                  <span>Refresh</span>
                </button>
              </div>

              {localSnapshots.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-8 text-center">
                  <HardDrive size={32} className="mx-auto text-slate-400 mb-2" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No local recovery checkpoints found.</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Click "Create 1-Click Snapshot" to generate an emergency checkpoint.
                  </p>
                  <button
                    onClick={() => setActiveTab('backup')}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-all"
                  >
                    <Download size={13} />
                    <span>Create Snapshot Now</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {localSnapshots.map((snap, idx) => (
                    <div
                      key={snap.meta.id || idx}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs hover:border-blue-300 dark:hover:border-blue-800 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 mt-0.5">
                          <Database size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              Snapshot: {snap.meta.generatedAt}
                            </p>
                            {idx === 0 && (
                              <span className="rounded-full bg-blue-100 dark:bg-blue-950 px-2 py-0.5 text-[9px] font-black uppercase text-blue-700 dark:text-blue-300">
                                Latest
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {snap.inventory.length} Medicines • {snap.patients.length} Patients • Valued at {formatCurrency(snap.meta.totalStockValue || 0)}
                          </p>
                          {snap.meta.notes && (
                            <p className="text-[10px] text-slate-400 italic mt-0.5">
                              "{snap.meta.notes}"
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleStageLocalSnapshot(snap)}
                          className="flex items-center gap-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/80 dark:hover:bg-blue-900 px-3 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-300 transition-all cursor-pointer"
                          title="Restore database using this local checkpoint"
                        >
                          <RotateCcw size={13} />
                          <span>Restore</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteSnapshot(snap.meta.id || '', e)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all"
                          title="Delete from local cache"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900 text-xs text-slate-500">
          <div className="flex items-center gap-2 font-medium">
            <span>Satyam Medical Store & Pharmacy</span>
            <span>•</span>
            <span>Local Disaster Recovery & Sync Protection</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
          >
            Close Window
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default SystemBackupModal;
