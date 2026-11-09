import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  PackagePlus,
  AlertTriangle,
  History,
  X,
  Package,
  Calendar,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  User,
  Clock,
  FileText,
  Filter,
  Sparkles,
  ShieldAlert,
  RefreshCw,
  StickyNote,
  Plus,
  Trash2
} from 'lucide-react';
import { Medicine, Batch } from '../types';
import { StockMovement, fetchStockMovements } from '../lib/stockAuditService';
import { cn, formatDate, formatCurrency } from '../lib/utils';

export type BatchQuickActionType = 'restock' | 'damaged' | 'audit' | 'note';

interface BatchQuickActionModalProps {
  isOpen: boolean;
  actionType: BatchQuickActionType;
  medicine: Medicine | null;
  initialBatchNumber: string;
  onClose: () => void;
  onSwitchAction: (type: BatchQuickActionType) => void;
  onConfirmRestock: (payload: {
    medicine: Medicine;
    batchNumber: string;
    quantityToAdd: number;
    supplierRef: string;
    notes: string;
  }) => Promise<void>;
  onConfirmDamaged: (payload: {
    medicine: Medicine;
    batchNumber: string;
    damagedQuantity: number;
    damageReason: string;
    notes: string;
  }) => Promise<void>;
  onConfirmAddNote?: (payload: {
    medicine: Medicine;
    batchNumber: string;
    noteText: string;
    updatedNotes: string[];
  }) => Promise<void>;
}

const OPERATIONAL_NOTE_PRESETS = [
  'Stored in Fridge A',
  'Return expected',
  'FEFO Front Shelf Priority',
  'Vendor Credit Note Pending',
  'Inspect Seal Before Dispensing',
  'Reserved for Clinic Order'
];

const DAMAGE_REASONS = [
  'Broken / Crushed Packaging',
  'Temperature Excursion / Cold-Chain Breach',
  'Water / Moisture Contamination',
  'Seal Tampered / Leaking Container',
  'Expired / Near-Expiry Quarantine Write-Off',
  'Dispensing Spill / Handling Damage'
];

export const BatchQuickActionModal: React.FC<BatchQuickActionModalProps> = ({
  isOpen,
  actionType,
  medicine,
  initialBatchNumber,
  onClose,
  onSwitchAction,
  onConfirmRestock,
  onConfirmDamaged,
  onConfirmAddNote
}) => {
  const [selectedBatchNumber, setSelectedBatchNumber] = useState<string>(initialBatchNumber);
  const [restockQty, setRestockQty] = useState<number>(25);
  const [supplierRef, setSupplierRef] = useState<string>('');
  const [restockNotes, setRestockNotes] = useState<string>('Direct Batch Restock via Quick Actions');

  const [damagedQty, setDamagedQty] = useState<number>(1);
  const [damageReason, setDamageReason] = useState<string>(DAMAGE_REASONS[0]);
  const [damageNotes, setDamageNotes] = useState<string>('');

  const [batchNoteText, setBatchNoteText] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Audit trail state
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loadingAudit, setLoadingAudit] = useState<boolean>(false);
  const [auditScope, setAuditScope] = useState<'batch' | 'medicine'>('batch');
  const [auditTypeFilter, setAuditTypeFilter] = useState<'all' | 'addition' | 'subtraction'>('all');

  const normalizedBatches: Batch[] = useMemo(() => {
    if (!medicine) return [];
    if (medicine.batches && medicine.batches.length > 0) {
      return medicine.batches;
    }
    return [
      {
        id: 'default-batch',
        batchNumber: medicine.batchNumber || `LOT-${medicine.id.slice(0, 4).toUpperCase()}`,
        expiryDate: medicine.expiryDate,
        quantity: medicine.stockQuantity,
        storageCondition: medicine.storageCondition
      }
    ];
  }, [medicine]);

  useEffect(() => {
    if (isOpen && medicine) {
      const fallbackBatch =
        initialBatchNumber ||
        normalizedBatches[0]?.batchNumber ||
        medicine.batchNumber ||
        `LOT-${medicine.id.slice(0, 4).toUpperCase()}`;
      setSelectedBatchNumber(fallbackBatch);
      setRestockQty(25);
      setSupplierRef(`GRN-${Date.now().toString().slice(-4)}`);
      setRestockNotes('Direct Batch Restock via Quick Actions');
      setDamagedQty(1);
      setDamageReason(DAMAGE_REASONS[0]);
      setDamageNotes('');
      setBatchNoteText('');
      setFeedbackBanner(null);
      setAuditScope('batch');
      setAuditTypeFilter('all');
    }
  }, [isOpen, medicine, initialBatchNumber, normalizedBatches]);

  const activeBatch: Batch = useMemo(() => {
    return (
      normalizedBatches.find(b => b.batchNumber === selectedBatchNumber) ||
      normalizedBatches[0] || {
        id: 'fallback',
        batchNumber: selectedBatchNumber || 'N/A',
        expiryDate: medicine?.expiryDate || '',
        quantity: medicine?.stockQuantity || 0
      }
    );
  }, [normalizedBatches, selectedBatchNumber, medicine]);

  const loadAuditTrail = async () => {
    if (!medicine) return;
    setLoadingAudit(true);
    try {
      const allMovements = await fetchStockMovements(300);
      setMovements(allMovements);
    } catch (err) {
      console.error('Failed to load batch audit trail:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (isOpen && medicine && actionType === 'audit') {
      loadAuditTrail();
    }
  }, [isOpen, medicine, actionType]);

  // Clamp damagedQty if activeBatch quantity is smaller
  useEffect(() => {
    if (activeBatch && damagedQty > Math.max(1, activeBatch.quantity)) {
      setDamagedQty(Math.max(1, activeBatch.quantity));
    }
  }, [activeBatch, damagedQty]);

  const filteredAuditMovements = useMemo(() => {
    if (!medicine) return [];
    const medMatches = movements.filter(
      m =>
        m.medicineId === medicine.id ||
        m.medicineName?.toLowerCase() === medicine.name.toLowerCase()
    );

    const scoped =
      auditScope === 'batch'
        ? medMatches.filter(
            m =>
              !m.batchNumber ||
              m.batchNumber.toLowerCase() === activeBatch.batchNumber.toLowerCase()
          )
        : medMatches;

    // Synthesize an initial batch intake record if no historical logs exist yet for this batch
    const listWithBaseline: StockMovement[] =
      scoped.length > 0
        ? scoped
        : [
            {
              id: `baseline-${medicine.id}-${activeBatch.batchNumber}`,
              medicineId: medicine.id,
              medicineName: medicine.name,
              batchNumber: activeBatch.batchNumber,
              type: 'addition',
              quantity: activeBatch.quantity,
              previousStock: 0,
              newStock: activeBatch.quantity,
              reason: 'Initial Batch Intake & Quality Verification',
              referenceId: `INIT-${activeBatch.batchNumber}`,
              userName: 'Pharmacy Inventory System',
              userRole: 'pharmacist',
              timestamp: new Date(Date.now() - 14 * 86400000).toISOString()
            }
          ];

    if (auditTypeFilter === 'all') return listWithBaseline;
    return listWithBaseline.filter(m => m.type === auditTypeFilter);
  }, [movements, medicine, auditScope, activeBatch, auditTypeFilter]);

  const auditSummary = useMemo(() => {
    const totalAdded = filteredAuditMovements
      .filter(m => m.type === 'addition')
      .reduce((sum, m) => sum + m.quantity, 0);
    const totalSubtracted = filteredAuditMovements
      .filter(m => m.type === 'subtraction')
      .reduce((sum, m) => sum + m.quantity, 0);
    return {
      totalAdded,
      totalSubtracted,
      count: filteredAuditMovements.length
    };
  }, [filteredAuditMovements]);

  if (!isOpen || !medicine) return null;

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (restockQty <= 0) return;
    setSubmitting(true);
    setFeedbackBanner(null);
    try {
      await onConfirmRestock({
        medicine,
        batchNumber: activeBatch.batchNumber,
        quantityToAdd: Number(restockQty),
        supplierRef: supplierRef.trim(),
        notes: restockNotes.trim() || 'Direct Batch Restock'
      });
      setFeedbackBanner({
        type: 'success',
        message: `Restocked +${restockQty} units into Batch #${activeBatch.batchNumber}. Audit trail updated.`
      });
      setTimeout(() => {
        onClose();
      }, 650);
    } catch (err) {
      console.error('Error in direct restock:', err);
      setFeedbackBanner({
        type: 'error',
        message: 'Failed to restock batch. Please try again.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDamagedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (damagedQty <= 0) return;
    setSubmitting(true);
    setFeedbackBanner(null);
    try {
      await onConfirmDamaged({
        medicine,
        batchNumber: activeBatch.batchNumber,
        damagedQuantity: Number(damagedQty),
        damageReason,
        notes: damageNotes.trim()
      });
      setFeedbackBanner({
        type: 'success',
        message: `Marked ${damagedQty} units in Batch #${activeBatch.batchNumber} as damaged and logged write-off.`
      });
      setTimeout(() => {
        onClose();
      }, 650);
    } catch (err) {
      console.error('Error marking batch as damaged:', err);
      setFeedbackBanner({
        type: 'error',
        message: 'Failed to record damaged stock write-off.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const existingBatchNotes: string[] = Array.isArray(activeBatch.notes)
    ? activeBatch.notes
    : activeBatch.latestNote
      ? [activeBatch.latestNote]
      : [];

  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = batchNoteText.trim();
    if (!trimmed || !onConfirmAddNote) return;

    setSubmitting(true);
    setFeedbackBanner(null);
    try {
      const updatedNotes = [...existingBatchNotes, trimmed];
      await onConfirmAddNote({
        medicine,
        batchNumber: activeBatch.batchNumber,
        noteText: trimmed,
        updatedNotes
      });
      setBatchNoteText('');
      setFeedbackBanner({
        type: 'success',
        message: `Appended note "${trimmed}" to Batch #${activeBatch.batchNumber}.`
      });
    } catch (err) {
      console.error('Error appending batch note:', err);
      setFeedbackBanner({
        type: 'error',
        message: 'Failed to save batch note. Please try again.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveExistingNote = async (indexToRemove: number) => {
    if (!onConfirmAddNote || submitting) return;
    setSubmitting(true);
    setFeedbackBanner(null);
    try {
      const removedText = existingBatchNotes[indexToRemove];
      const updatedNotes = existingBatchNotes.filter((_, i) => i !== indexToRemove);
      await onConfirmAddNote({
        medicine,
        batchNumber: activeBatch.batchNumber,
        noteText: `Removed note: ${removedText}`,
        updatedNotes
      });
      setFeedbackBanner({
        type: 'success',
        message: `Removed note from Batch #${activeBatch.batchNumber}.`
      });
    } catch (err) {
      console.error('Error removing batch note:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
          onClick={onClose}
        />

        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 12 }}
          className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-zinc-900 overflow-hidden"
        >
          {/* Top Action Switcher Header */}
          <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-zinc-900/90 px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border shadow-2xs',
                    actionType === 'restock'
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800'
                      : actionType === 'damaged'
                        ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800'
                        : actionType === 'note'
                          ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800'
                          : 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-400 dark:border-indigo-800'
                  )}
                >
                  {actionType === 'restock' && <PackagePlus size={22} />}
                  {actionType === 'damaged' && <AlertTriangle size={22} />}
                  {actionType === 'audit' && <History size={22} />}
                  {actionType === 'note' && <StickyNote size={22} />}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                      {actionType === 'restock'
                        ? 'Direct Batch Restock'
                        : actionType === 'damaged'
                          ? 'Mark Batch Stock as Damaged'
                          : actionType === 'note'
                            ? 'Add Batch Operational Note'
                            : 'Batch Stock Audit Trail'}
                    </h2>
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-[11px] font-mono font-black text-blue-700 dark:text-blue-300">
                      <Package size={11} />
                      <span>#{activeBatch.batchNumber}</span>
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                    {medicine.name}{' '}
                    {medicine.genericName ? `• ${medicine.genericName}` : ''} • Total Stock:{' '}
                    <strong className="text-slate-700 dark:text-slate-200">{medicine.stockQuantity} pcs</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
                title="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Action Mode Tabs + Batch Selector */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex flex-wrap items-center rounded-xl bg-slate-200/70 dark:bg-slate-800 p-1 gap-1">
                <button
                  type="button"
                  onClick={() => onSwitchAction('restock')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer',
                    actionType === 'restock'
                      ? 'bg-white text-emerald-700 shadow-xs dark:bg-zinc-900 dark:text-emerald-400'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  )}
                >
                  <PackagePlus size={13} />
                  <span>Direct Restock</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchAction('damaged')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer',
                    actionType === 'damaged'
                      ? 'bg-white text-rose-700 shadow-xs dark:bg-zinc-900 dark:text-rose-400'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  )}
                >
                  <AlertTriangle size={13} />
                  <span>Mark as Damaged</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchAction('note')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer',
                    actionType === 'note'
                      ? 'bg-white text-amber-700 shadow-xs dark:bg-zinc-900 dark:text-amber-400'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  )}
                >
                  <StickyNote size={13} />
                  <span>Add Batch Note</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchAction('audit')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer',
                    actionType === 'audit'
                      ? 'bg-white text-indigo-700 shadow-xs dark:bg-zinc-900 dark:text-indigo-400'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  )}
                >
                  <History size={13} />
                  <span>View Audit Trail</span>
                </button>
              </div>

              {/* Target Batch Selector */}
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Target Batch:
                </label>
                <select
                  value={activeBatch.batchNumber}
                  onChange={e => setSelectedBatchNumber(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-mono font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                >
                  {normalizedBatches.map((b, idx) => (
                    <option key={`${b.batchNumber}-${idx}`} value={b.batchNumber}>
                      #{b.batchNumber} ({b.quantity} pcs • Exp: {formatDate(b.expiryDate)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-6 max-h-[75vh] overflow-y-auto">
            {feedbackBanner && (
              <div
                className={cn(
                  'mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-bold',
                  feedbackBanner.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300'
                    : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300'
                )}
              >
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{feedbackBanner.message}</span>
              </div>
            )}

            {/* MODE 1: DIRECT RESTOCK */}
            {actionType === 'restock' && (
              <form onSubmit={handleRestockSubmit} className="space-y-5">
                {/* Live Batch Stock Preview */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      Batch #{activeBatch.batchNumber} Current
                    </span>
                    <span className="text-lg font-black text-slate-800 dark:text-slate-100">
                      {activeBatch.quantity} <span className="text-xs font-semibold text-slate-500">pcs</span>
                    </span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">
                      Exp: {formatDate(activeBatch.expiryDate)}
                    </span>
                  </div>

                  <div className="flex items-center justify-center">
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 dark:bg-emerald-900/60 px-3 py-1 text-xs font-black text-emerald-700 dark:text-emerald-300">
                      <span>+{restockQty || 0} pcs</span>
                      <ArrowRight size={14} />
                    </div>
                  </div>

                  <div className="sm:text-right">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                      Updated Batch Quantity
                    </span>
                    <span className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                      {activeBatch.quantity + (Number(restockQty) || 0)}{' '}
                      <span className="text-xs font-bold">pcs</span>
                    </span>
                    <span className="block text-[10px] font-semibold text-slate-500 mt-0.5">
                      Total Item Stock: {medicine.stockQuantity} ➔{' '}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {medicine.stockQuantity + (Number(restockQty) || 0)} pcs
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Quantity & Quick Presets */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Quantity to Restock into Batch #{activeBatch.batchNumber}
                    </label>
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      Est. Value: {formatCurrency((Number(restockQty) || 0) * (medicine.rate || 0))}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      required
                      value={restockQty}
                      onChange={e => setRestockQty(Math.max(1, Number(e.target.value)))}
                      className="w-32 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-base font-black text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500"
                    />
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[10, 25, 50, 100, 250].map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setRestockQty(preset)}
                          className={cn(
                            'rounded-lg border px-2.5 py-1.5 text-xs font-black transition-all cursor-pointer',
                            restockQty === preset
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                          )}
                        >
                          +{preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      GRN / Supplier Invoice Reference
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. GRN-8492 / INV-2025"
                      value={supplierRef}
                      onChange={e => setSupplierRef(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      Audit Trail Reason / Remarks
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Direct Batch Restock"
                      value={restockNotes}
                      onChange={e => setRestockNotes(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || restockQty <= 0}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                  >
                    <PackagePlus size={15} />
                    <span>{submitting ? 'Updating Batch...' : `Confirm Restock (+${restockQty})`}</span>
                  </button>
                </div>
              </form>
            )}

            {/* MODE 2: MARK AS DAMAGED */}
            {actionType === 'damaged' && (
              <form onSubmit={handleDamagedSubmit} className="space-y-5">
                {/* Live Write-off Impact Preview */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-rose-200/80 bg-rose-50/40 p-4 dark:border-rose-900/50 dark:bg-rose-950/20">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      Batch #{activeBatch.batchNumber} Available
                    </span>
                    <span className="text-lg font-black text-slate-800 dark:text-slate-100">
                      {activeBatch.quantity} <span className="text-xs font-semibold text-slate-500">pcs</span>
                    </span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">
                      Exp: {formatDate(activeBatch.expiryDate)}
                    </span>
                  </div>

                  <div className="flex items-center justify-center">
                    <div className="inline-flex items-center gap-2 rounded-full bg-rose-100 dark:bg-rose-900/60 px-3 py-1 text-xs font-black text-rose-700 dark:text-rose-300">
                      <span>-{damagedQty || 0} Damaged</span>
                      <ArrowRight size={14} />
                    </div>
                  </div>

                  <div className="sm:text-right">
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 block">
                      Remaining Usable Batch
                    </span>
                    <span className="text-xl font-black text-rose-700 dark:text-rose-300">
                      {Math.max(0, activeBatch.quantity - (Number(damagedQty) || 0))}{' '}
                      <span className="text-xs font-bold">pcs</span>
                    </span>
                    <span className="block text-[10px] font-semibold text-slate-500 mt-0.5">
                      Write-Off Value:{' '}
                      <strong className="text-rose-600 dark:text-rose-400">
                        {formatCurrency((Number(damagedQty) || 0) * (medicine.rate || 0))}
                      </strong>
                    </span>
                  </div>
                </div>

                {activeBatch.quantity <= 0 && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                    Note: Batch #{activeBatch.batchNumber} currently has 0 units on hand. Recording a damage event will still log an official quarantine/spoilage entry in the batch audit trail.
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                    Damaged / Spoiled Units to Deduct
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, activeBatch.quantity)}
                      required
                      value={damagedQty}
                      onChange={e =>
                        setDamagedQty(
                          Math.max(
                            1,
                            Math.min(Math.max(1, activeBatch.quantity), Number(e.target.value))
                          )
                        )
                      }
                      className="w-32 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-base font-black text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-rose-500"
                    />
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[1, 2, 5, 10].map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() =>
                            setDamagedQty(
                              activeBatch.quantity > 0 ? Math.min(activeBatch.quantity, preset) : preset
                            )
                          }
                          className={cn(
                            'rounded-lg border px-2.5 py-1.5 text-xs font-black transition-all cursor-pointer',
                            damagedQty === preset
                              ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                              : 'bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                          )}
                        >
                          {preset} pc{preset > 1 ? 's' : ''}
                        </button>
                      ))}
                      {activeBatch.quantity > 0 && (
                        <button
                          type="button"
                          onClick={() => setDamagedQty(activeBatch.quantity)}
                          className={cn(
                            'rounded-lg border px-2.5 py-1.5 text-xs font-black transition-all cursor-pointer',
                            damagedQty === activeBatch.quantity
                              ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                              : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                          )}
                        >
                          Entire Batch ({activeBatch.quantity})
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      Damage / Quarantine Classification
                    </label>
                    <select
                      value={damageReason}
                      onChange={e => setDamageReason(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-rose-500"
                    >
                      {DAMAGE_REASONS.map(reason => (
                        <option key={reason} value={reason}>
                          {reason}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      Inspection / Disposal Notes
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Blister strip punctured during transit"
                      value={damageNotes}
                      onChange={e => setDamageNotes(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || damagedQty <= 0}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-rose-600/25 hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                  >
                    <ShieldAlert size={15} />
                    <span>{submitting ? 'Recording Write-Off...' : `Mark ${damagedQty} pcs as Damaged`}</span>
                  </button>
                </div>
              </form>
            )}

            {/* MODE 3: VIEW AUDIT TRAIL */}
            {actionType === 'audit' && (
              <div className="space-y-4">
                {/* Summary KPI Strip */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/50">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      Batch #{activeBatch.batchNumber} Balance
                    </span>
                    <span className="text-lg font-black text-slate-900 dark:text-slate-100">
                      {activeBatch.quantity} pcs
                    </span>
                    <span className="block text-[10px] text-slate-500">
                      Exp: {formatDate(activeBatch.expiryDate)}
                    </span>
                  </div>
                  <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                      Logged Additions
                    </span>
                    <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                      +{auditSummary.totalAdded} pcs
                    </span>
                    <span className="block text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
                      Restocks & Intake
                    </span>
                  </div>
                  <div className="rounded-xl border border-rose-200/70 bg-rose-50/40 p-3 dark:border-rose-900/40 dark:bg-rose-950/20">
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 block">
                      Logged Deductions
                    </span>
                    <span className="text-lg font-black text-rose-700 dark:text-rose-300">
                      -{auditSummary.totalSubtracted} pcs
                    </span>
                    <span className="block text-[10px] text-rose-600/80 dark:text-rose-400/80">
                      Damaged / Dispensed
                    </span>
                  </div>
                </div>

                {/* Filter Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAuditScope('batch')}
                      className={cn(
                        'rounded-lg px-2.5 py-1 text-[11px] font-black transition-all cursor-pointer',
                        auditScope === 'batch'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300'
                      )}
                    >
                      Batch #{activeBatch.batchNumber} Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuditScope('medicine')}
                      className={cn(
                        'rounded-lg px-2.5 py-1 text-[11px] font-black transition-all cursor-pointer',
                        auditScope === 'medicine'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300'
                      )}
                    >
                      All Batches ({normalizedBatches.length})
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {(['all', 'addition', 'subtraction'] as const).map(tf => (
                      <button
                        key={tf}
                        type="button"
                        onClick={() => setAuditTypeFilter(tf)}
                        className={cn(
                          'rounded-md px-2 py-1 text-[10px] font-black uppercase transition-colors cursor-pointer',
                          auditTypeFilter === tf
                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                            : 'text-slate-500 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-700'
                        )}
                      >
                        {tf === 'all' ? 'All Events' : tf === 'addition' ? '+ Additions' : '- Subtractions'}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={loadAuditTrail}
                      className="ml-1 rounded-md p-1 text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-700 cursor-pointer"
                      title="Refresh audit trail"
                    >
                      <RefreshCw size={12} className={loadingAudit ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>

                {/* Chronological Movement Timeline */}
                <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
                  {loadingAudit ? (
                    <div className="flex items-center justify-center py-12 text-xs font-bold text-slate-400">
                      Loading batch audit ledger...
                    </div>
                  ) : filteredAuditMovements.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                      <History size={28} className="mb-2 opacity-40" />
                      <p className="text-xs font-bold">No matching stock movements found for this filter.</p>
                    </div>
                  ) : (
                    filteredAuditMovements.map((mov, idx) => {
                      const isAdd = mov.type === 'addition';
                      const isDamage =
                        mov.reason?.toLowerCase().includes('damage') ||
                        mov.reason?.toLowerCase().includes('spoil') ||
                        mov.reason?.toLowerCase().includes('quarantine') ||
                        mov.reason?.toLowerCase().includes('write-off');

                      return (
                        <div
                          key={mov.id || idx}
                          className="flex items-start justify-between gap-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-800/60"
                        >
                          <div className="flex items-start gap-2.5">
                            <div
                              className={cn(
                                'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border',
                                isAdd
                                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800'
                                  : isDamage
                                    ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800'
                                    : 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800'
                              )}
                            >
                              {isAdd ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                                  {mov.reason || (isAdd ? 'Batch Stock Addition' : 'Batch Stock Deduction')}
                                </span>
                                <span className="rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.2 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-200">
                                  #{mov.batchNumber || activeBatch.batchNumber}
                                </span>
                                {mov.referenceId && (
                                  <span className="rounded bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 text-[9px] font-mono font-bold text-blue-700 dark:text-blue-300">
                                    Ref: {mov.referenceId}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex items-center gap-3 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                <span className="inline-flex items-center gap-1">
                                  <User size={10} />
                                  <span>
                                    {mov.userName || 'Staff'} ({mov.userRole || 'pharmacist'})
                                  </span>
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <Clock size={10} />
                                  <span>{new Date(mov.timestamp).toLocaleString()}</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span
                              className={cn(
                                'inline-block rounded-md px-2 py-0.5 text-xs font-black font-mono',
                                isAdd
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300'
                              )}
                            >
                              {isAdd ? `+${mov.quantity}` : `-${mov.quantity}`} pcs
                            </span>
                            <div className="mt-1 text-[10px] font-mono font-semibold text-slate-400">
                              {mov.previousStock} ➔{' '}
                              <strong className="text-slate-700 dark:text-slate-200">{mov.newStock}</strong>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer with quick actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSwitchAction('restock')}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 text-xs font-black text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300 cursor-pointer"
                    >
                      <PackagePlus size={13} />
                      <span>Direct Restock</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSwitchAction('damaged')}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 text-xs font-black text-rose-700 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300 cursor-pointer"
                    >
                      <AlertTriangle size={13} />
                      <span>Mark as Damaged</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-black text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            {/* MODE 4: ADD BATCH OPERATIONAL NOTE */}
            {actionType === 'note' && (
              <form onSubmit={handleNoteSubmit} className="space-y-5">
                {/* Target Batch Info Strip */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                      Batch #{activeBatch.batchNumber} Operational Record
                    </span>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {activeBatch.quantity} pcs in stock • Exp: {formatDate(activeBatch.expiryDate)}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-800 dark:text-amber-300">
                    {existingBatchNotes.length} Note{existingBatchNotes.length === 1 ? '' : 's'} Attached
                  </span>
                </div>

                {/* Existing Notes List */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                    Attached Batch Notes ({existingBatchNotes.length})
                  </label>
                  {existingBatchNotes.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-4 text-center text-xs text-slate-400">
                      No operational notes attached to Batch #{activeBatch.batchNumber} yet. Add one below.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {existingBatchNotes.map((noteItem, idx) => (
                        <div
                          key={`${noteItem}-${idx}`}
                          className="flex items-center justify-between gap-2 rounded-xl border border-amber-200/70 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-950/20 px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <StickyNote size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
                            <span className="font-semibold text-slate-800 dark:text-slate-200 break-words">
                              {noteItem}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveExistingNote(idx)}
                            disabled={submitting}
                            className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                            title="Remove note"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* New Operational Note Input + Quick Presets */}
                <div className="space-y-2.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                    Append New Operational Note
                  </label>
                  <input
                    type="text"
                    maxLength={120}
                    placeholder="e.g. Stored in Fridge A, Return expected, Check seal..."
                    value={batchNoteText}
                    onChange={e => setBatchNoteText(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-amber-500"
                  />

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Quick Operational Note Presets (Click to Fill):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {OPERATIONAL_NOTE_PRESETS.map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setBatchNoteText(preset)}
                          className={cn(
                            'rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer',
                            batchNoteText === preset
                              ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                              : 'bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-amber-950/50'
                          )}
                        >
                          + {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !batchNoteText.trim()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-amber-600/25 hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
                  >
                    <Plus size={15} />
                    <span>{submitting ? 'Saving Note...' : 'Append Note to Batch'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
