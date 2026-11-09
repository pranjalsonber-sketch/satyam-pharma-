import React, { useState, useMemo } from 'react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLanguage } from '../context/LanguageContext';
import { Medicine } from '../types';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { logActivity } from '../lib/logger';
import { useAuth } from './AuthProvider';
import {
  X,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  Calendar,
  Package,
  IndianRupee,
  CheckCircle2,
  Info,
  Layers,
  FileText
} from 'lucide-react';
import { motion } from 'motion/react';

interface BulkDeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMedicines: Medicine[];
  onRemoveItemFromBatch?: (id: string) => void;
  onSuccess: () => void;
}

type DeletionReason =
  | 'expired_disposal'
  | 'deprecated_delist'
  | 'damaged_scrap'
  | 'duplicate_cleanup'
  | 'inventory_audit';

const DELETION_REASONS: { id: DeletionReason; label: string; desc: string; icon: string }[] = [
  {
    id: 'expired_disposal',
    label: 'Expired Stock / Bio-medical Waste Disposal',
    desc: 'Expired shelf-life medication sent for certified incineration or wholesaler return.',
    icon: '☣️'
  },
  {
    id: 'deprecated_delist',
    label: 'Deprecated / Discontinued Drug Record',
    desc: 'Delisting banned, phased out, or discontinued formulation SKUs.',
    icon: '🚫'
  },
  {
    id: 'damaged_scrap',
    label: 'Damaged / Contaminated Stock Write-off',
    desc: 'Broken packaging, seal tampering, or moisture-spoiled medication.',
    icon: '⚠️'
  },
  {
    id: 'duplicate_cleanup',
    label: 'Duplicate / Erroneous SKU Cleanup',
    desc: 'Removal of accidentally duplicated entries or faulty test records.',
    icon: '🧹'
  },
  {
    id: 'inventory_audit',
    label: 'Physical Audit Reconciliation',
    desc: 'Zero-stock items cleared following comprehensive inventory audit.',
    icon: '📋'
  }
];

export const BulkDeleteConfirmationModal: React.FC<BulkDeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  selectedMedicines,
  onRemoveItemFromBatch,
  onSuccess
}) => {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [confirmationInput, setConfirmationInput] = useState('');
  const [reason, setReason] = useState<DeletionReason>('expired_disposal');
  const [pharmacistRemarks, setPharmacistRemarks] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionSuccess, setDeletionSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const now = new Date();

  // Categorize selected medicines
  const { expiredItems, zeroStockItems, activeInStockItems, totalUnits, totalValuation } = useMemo(() => {
    let expired: Medicine[] = [];
    let zeroStock: Medicine[] = [];
    let active: Medicine[] = [];
    let units = 0;
    let valuation = 0;

    selectedMedicines.forEach(med => {
      const expDate = new Date(med.expiryDate);
      const isExp = expDate < now;
      const isZero = med.stockQuantity <= 0;

      if (isExp) {
        expired.push(med);
      } else if (isZero) {
        zeroStock.push(med);
      } else {
        active.push(med);
      }

      units += med.stockQuantity || 0;
      valuation += (med.stockQuantity || 0) * (med.rate || 0);
    });

    return {
      expiredItems: expired,
      zeroStockItems: zeroStock,
      activeInStockItems: active,
      totalUnits: units,
      totalValuation: valuation
    };
  }, [selectedMedicines, now]);

  const isConfirmed = confirmationInput.trim().toUpperCase() === 'DELETE';

  const handleDeleteRecords = async () => {
    if (!isConfirmed) return;
    if (selectedMedicines.length === 0) return;

    try {
      setIsDeleting(true);
      setErrorMessage(null);

      const deletedNames: string[] = [];
      const reasonLabel = DELETION_REASONS.find(r => r.id === reason)?.label || reason;

      // Delete documents in Firestore
      for (const med of selectedMedicines) {
        deletedNames.push(med.name);
        const docRef = doc(db, 'inventory', med.id);
        await deleteDoc(docRef);
      }

      // Log secure activity
      const logDetails = `Permanently deleted ${selectedMedicines.length} medication records (${deletedNames.slice(0, 4).join(', ')}${deletedNames.length > 4 ? ` +${deletedNames.length - 4} more` : ''}). Reason: ${reasonLabel}. Units written off: ${totalUnits}, Value written off: ₹${totalValuation.toFixed(2)}${pharmacistRemarks ? ` | Remarks: ${pharmacistRemarks}` : ''}`;
      
      await logActivity({
        action: 'Bulk Medication Deletion',
        description: logDetails,
        type: 'inventory',
        module: 'inventory',
        userEmail: profile?.email || 'admin@satyampharma.com',
        userId: profile?.uid,
        userName: profile?.displayName || profile?.email?.split('@')[0] || 'Staff',
        userRole: profile?.role || 'admin',
        severity: 'danger',
        details: {
          deletedCount: selectedMedicines.length,
          reason: reasonLabel,
          unitsWrittenOff: totalUnits,
          valuationWrittenOff: totalValuation,
          remarks: pharmacistRemarks || '',
          deletedItems: deletedNames
        }
      });

      setDeletionSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 900);
    } catch (err) {
      console.error('Error during bulk deletion:', err);
      setErrorMessage('Failed to delete records. Please check permissions or network connectivity and try again.');
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-xs"
        onClick={onClose}
      />

      {/* Modal Card */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="relative flex flex-col w-full max-w-3xl max-h-[92vh] rounded-3xl border border-rose-200 bg-white dark:border-rose-950 dark:bg-slate-900 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rose-100 dark:border-rose-950/60 px-6 py-4 bg-rose-50/80 dark:bg-rose-950/30">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-md shadow-rose-600/30">
              <ShieldAlert size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight text-rose-950 dark:text-rose-200">
                  {t('secureBulkDeleteTitle') || 'Permanent Bulk Record Deletion'}
                </h2>
                <span className="rounded-full bg-rose-200/80 dark:bg-rose-900/80 px-2.5 py-0.5 text-[10px] font-black text-rose-900 dark:text-rose-200">
                  {selectedMedicines.length} {selectedMedicines.length === 1 ? 'Record' : 'Records'}
                </span>
              </div>
              <p className="text-xs text-rose-700/80 dark:text-rose-300/80 mt-0.5">
                {t('bulkDeleteDesc') || 'Permanently remove expired, zero-stock, or deprecated medication records from pharmacy database.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-500 hover:bg-rose-100 hover:text-rose-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Classification Stats Cards */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <div className="rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-950/20 p-3 flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400">
                  Expired Items
                </span>
                <span className="text-sm">🔴</span>
              </div>
              <span className="text-lg font-black text-rose-950 dark:text-rose-200 mt-1">
                {expiredItems.length}
              </span>
              <span className="text-[10px] text-rose-600/80 dark:text-rose-400/80">Past shelf life</span>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3 flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Zero Stock
                </span>
                <span className="text-sm">⚪</span>
              </div>
              <span className="text-lg font-black text-slate-900 dark:text-white mt-1">
                {zeroStockItems.length}
              </span>
              <span className="text-[10px] text-slate-500">0 units in stock</span>
            </div>

            <div className="rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 p-3 flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Active In-Stock
                </span>
                <span className="text-sm">⚠️</span>
              </div>
              <span className="text-lg font-black text-amber-950 dark:text-amber-200 mt-1">
                {activeInStockItems.length}
              </span>
              <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80">
                {activeInStockItems.length > 0 ? 'Requires caution' : 'None selected'}
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3 flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Value Write-off
                </span>
                <span className="text-sm">₹</span>
              </div>
              <span className="text-lg font-black text-slate-900 dark:text-white mt-1">
                {formatCurrency(totalValuation)}
              </span>
              <span className="text-[10px] text-slate-500">{totalUnits} total units</span>
            </div>
          </div>

          {/* Active Stock Warning Banner */}
          {activeInStockItems.length > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40 p-4">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-amber-900 dark:text-amber-200">
                  Attention: {activeInStockItems.length} active, non-expired medication {activeInStockItems.length === 1 ? 'record' : 'records'} will also be permanently deleted!
                </p>
                <p className="text-amber-700 dark:text-amber-300/90">
                  These medicines still have valid shelf life and positive stock quantity. If you only intended to delete expired or zero-stock records, remove them from the list below before confirming.
                </p>
              </div>
            </div>
          )}

          {/* Itemized Deletion Review List */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={15} className="text-slate-500" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Medication Records to be Removed ({selectedMedicines.length})
                </span>
              </div>
              <span className="text-[11px] text-slate-400">Review items carefully</span>
            </div>

            <div className="max-h-52 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100 dark:divide-slate-800">
              {selectedMedicines.map((med) => {
                const isExp = new Date(med.expiryDate) < now;
                const isZero = med.stockQuantity <= 0;

                return (
                  <div
                    key={med.id}
                    className="flex items-center justify-between pt-2 first:pt-0 gap-3 group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="text-xs shrink-0">
                        {isExp ? '🔴' : isZero ? '⚪' : '⚠️'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">
                            {med.name}
                          </span>
                          <span className="rounded bg-slate-200 dark:bg-slate-800 px-1.5 py-0.2 text-[9px] font-black uppercase text-slate-600 dark:text-slate-400 shrink-0">
                            {med.type}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span>Stock: <strong>{med.stockQuantity}</strong></span>
                          <span>•</span>
                          <span className={isExp ? 'text-rose-600 font-bold' : ''}>
                            Expiry: {formatDate(med.expiryDate)} {isExp ? '(Expired)' : ''}
                          </span>
                          <span>•</span>
                          <span>Val: {formatCurrency(med.stockQuantity * med.rate)}</span>
                        </div>
                      </div>
                    </div>

                    {onRemoveItemFromBatch && selectedMedicines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onRemoveItemFromBatch(med.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 transition-colors"
                        title="Remove from this deletion list"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reason for Deletion */}
          <div className="space-y-2.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <FileText size={13} className="text-rose-600" />
              <span>Disposal & Regulatory Deletion Reason (Required for Audit Log)</span>
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {DELETION_REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setReason(r.id)}
                  className={cn(
                    "flex flex-col text-left p-2.5 rounded-xl border transition-all cursor-pointer",
                    reason === r.id
                      ? "border-rose-600 bg-rose-50/70 dark:border-rose-600 dark:bg-rose-950/40 shadow-2xs"
                      : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{r.icon}</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{r.label}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Pharmacist Remarks */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Optional Pharmacist Notes / Disposal Certificate Reference / Wholesaler Return No.
            </label>
            <input
              type="text"
              value={pharmacistRemarks}
              onChange={(e) => setPharmacistRemarks(e.target.value)}
              placeholder="e.g. Incineration Batch #4092, Verified by Dr. Sharma, Expired stock cleared from Rack B"
              className="w-full rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-rose-500 outline-none"
            />
          </div>

          {/* Secure Verification Text Entry */}
          <div className="rounded-2xl border border-rose-300 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-rose-600" />
              <label className="text-xs font-black uppercase tracking-wider text-rose-950 dark:text-rose-300">
                Security Confirmation: Type <span className="underline decoration-2 decoration-rose-600">DELETE</span> to Proceed
              </label>
            </div>
            <p className="text-[11px] text-rose-700/90 dark:text-rose-400">
              This action cannot be undone. All selected medication documents, batch logs, and linked SKU records will be permanently expunged from the database.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                id="bulk-delete-confirm-input"
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder="Type DELETE here"
                className="flex-1 rounded-xl border border-rose-300 bg-white dark:border-rose-800 dark:bg-slate-900 px-3.5 py-2 text-xs font-black tracking-widest uppercase text-rose-950 dark:text-rose-100 placeholder:normal-case placeholder:font-normal focus:border-rose-600 outline-none"
              />
              <button
                type="button"
                onClick={() => setConfirmationInput('DELETE')}
                className="rounded-xl border border-rose-200 bg-white dark:border-slate-800 dark:bg-slate-800 px-3 py-2 text-[10px] font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-50 cursor-pointer"
              >
                Auto Fill
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-xl bg-red-100 dark:bg-red-950/60 p-3 text-xs text-red-700 dark:text-red-300">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {t('cancel') || 'Cancel'}
          </button>

          <button
            type="button"
            id="confirm-permanent-bulk-delete-btn"
            onClick={handleDeleteRecords}
            disabled={!isConfirmed || isDeleting || deletionSuccess || selectedMedicines.length === 0}
            className="flex items-center gap-2 rounded-xl bg-rose-600 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-rose-600/30 hover:bg-rose-700 active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
          >
            {deletionSuccess ? (
              <>
                <CheckCircle2 size={16} className="text-emerald-300" />
                <span>Records Deleted!</span>
              </>
            ) : isDeleting ? (
              <>
                <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Deleting Records...</span>
              </>
            ) : (
              <>
                <Trash2 size={16} />
                <span>Permanently Delete ({selectedMedicines.length})</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default BulkDeleteConfirmationModal;
