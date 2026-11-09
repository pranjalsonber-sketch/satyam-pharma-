import React, { useState, useMemo } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLanguage } from '../context/LanguageContext';
import { Medicine } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { logActivity } from '../lib/logger';
import { useAuth } from './AuthProvider';
import {
  X,
  Sliders,
  TrendingUp,
  TrendingDown,
  Package,
  IndianRupee,
  Layers,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Search,
  Plus,
  Trash2,
  ArrowRight,
  ShieldCheck,
  ClipboardCheck,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BulkStockAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  allMedicines: Medicine[];
  initialSelectedIds?: string[];
  onSuccess: () => void;
}

interface ItemDraft {
  medicineId: string;
  originalStock: number;
  newStock: number;
  originalRate: number;
  newRate: number;
  originalThreshold: number;
  newThreshold: number;
}

type AdjustmentReason = 
  | 'physical_audit'
  | 'price_revision'
  | 'bulk_shipment'
  | 'damaged_writeoff'
  | 'promotional_discount'
  | 'operational_correction';

const REASONS: { id: AdjustmentReason; label: string; icon: string; desc: string }[] = [
  { id: 'physical_audit', label: 'Physical Audit / Reconciliation', icon: '📋', desc: 'Routine inventory verification & discrepancy alignment' },
  { id: 'price_revision', label: 'Supplier / MRP Price Revision', icon: '🏷️', desc: 'Manufacturer rate change or updated sale price' },
  { id: 'bulk_shipment', label: 'Bulk Shipment Restock', icon: '📦', desc: 'Direct stock replenishment from purchase invoice' },
  { id: 'damaged_writeoff', label: 'Damaged / Discarded Write-off', icon: '⚠️', desc: 'Breakage, moisture leakage or spoiled units removed' },
  { id: 'promotional_discount', label: 'Promotional / Clearance Markdown', icon: '🎯', desc: 'Discounted sale pricing for fast rotation' },
  { id: 'operational_correction', label: 'Operational Correction', icon: '🔄', desc: 'General administrative stock correction' }
];

export const BulkStockAdjustModal: React.FC<BulkStockAdjustModalProps> = ({
  isOpen,
  onClose,
  allMedicines,
  initialSelectedIds = [],
  onSuccess
}) => {
  const { t } = useLanguage();
  const { profile } = useAuth();

  // Selected item IDs in the modal
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (initialSelectedIds.length > 0) return initialSelectedIds;
    // Default to first 5 items if none specified, or empty
    return allMedicines.slice(0, 5).map(m => m.id);
  });

  // Search input to add more items
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);

  // Draft changes per medicine
  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>(() => {
    const initial: Record<string, ItemDraft> = {};
    allMedicines.forEach(m => {
      initial[m.id] = {
        medicineId: m.id,
        originalStock: m.stockQuantity,
        newStock: m.stockQuantity,
        originalRate: m.rate,
        newRate: m.rate,
        originalThreshold: m.minThreshold || 10,
        newThreshold: m.minThreshold || 10
      };
    });
    return initial;
  });

  // Global batch rule settings
  const [globalPriceAction, setGlobalPriceAction] = useState<'none' | 'percent_inc' | 'percent_dec' | 'flat_inc' | 'flat_dec' | 'fixed'>('none');
  const [globalPriceVal, setGlobalPriceVal] = useState<number>(5);

  const [globalStockAction, setGlobalStockAction] = useState<'none' | 'add_qty' | 'deduct_qty' | 'set_fixed' | 'percent_qty'>('none');
  const [globalStockVal, setGlobalStockVal] = useState<number>(10);

  const [globalThresholdVal, setGlobalThresholdVal] = useState<number | ''>('');

  // Reason and notes
  const [reason, setReason] = useState<AdjustmentReason>('physical_audit');
  const [auditNotes, setAuditNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync drafts if selectedIds changes or medicines update
  const selectedMedicines = useMemo(() => {
    return allMedicines.filter(m => selectedIds.includes(m.id));
  }, [allMedicines, selectedIds]);

  // Unselected medicines for the search picker
  const availableToAdd = useMemo(() => {
    if (!searchQuery.trim()) return allMedicines.filter(m => !selectedIds.includes(m.id)).slice(0, 8);
    const q = searchQuery.toLowerCase();
    return allMedicines.filter(m => 
      !selectedIds.includes(m.id) &&
      (m.name.toLowerCase().includes(q) || 
       m.genericName?.toLowerCase().includes(q) ||
       m.salt?.toLowerCase().includes(q) ||
       m.barcode?.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [allMedicines, selectedIds, searchQuery]);

  // Update a single draft property
  const handleUpdateDraft = (medicineId: string, field: keyof ItemDraft, value: number) => {
    setDrafts(prev => {
      const current = prev[medicineId] || {
        medicineId,
        originalStock: 0,
        newStock: 0,
        originalRate: 0,
        newRate: 0,
        originalThreshold: 10,
        newThreshold: 10
      };

      let sanitized = value;
      if (field === 'newStock' || field === 'newThreshold') {
        sanitized = Math.max(0, Math.round(value));
      } else if (field === 'newRate') {
        sanitized = Math.max(0, Number(Number(value).toFixed(2)));
      }

      return {
        ...prev,
        [medicineId]: {
          ...current,
          [field]: sanitized
        }
      };
    });
  };

  // Add delta to stock
  const handleAddStockDelta = (medicineId: string, delta: number) => {
    const current = drafts[medicineId]?.newStock ?? 0;
    handleUpdateDraft(medicineId, 'newStock', Math.max(0, current + delta));
  };

  // Add % to price
  const handleAddPricePercent = (medicineId: string, percentDelta: number) => {
    const original = drafts[medicineId]?.originalRate ?? 0;
    const current = drafts[medicineId]?.newRate ?? original;
    const newPrice = Math.max(0, current * (1 + percentDelta / 100));
    handleUpdateDraft(medicineId, 'newRate', Number(newPrice.toFixed(2)));
  };

  // Reset single item
  const handleResetItem = (medicineId: string) => {
    const med = allMedicines.find(m => m.id === medicineId);
    if (!med) return;
    setDrafts(prev => ({
      ...prev,
      [medicineId]: {
        medicineId,
        originalStock: med.stockQuantity,
        newStock: med.stockQuantity,
        originalRate: med.rate,
        newRate: med.rate,
        originalThreshold: med.minThreshold || 10,
        newThreshold: med.minThreshold || 10
      }
    }));
  };

  // Reset all selected items
  const handleResetAll = () => {
    setDrafts(prev => {
      const next = { ...prev };
      selectedMedicines.forEach(med => {
        next[med.id] = {
          medicineId: med.id,
          originalStock: med.stockQuantity,
          newStock: med.stockQuantity,
          originalRate: med.rate,
          newRate: med.rate,
          originalThreshold: med.minThreshold || 10,
          newThreshold: med.minThreshold || 10
        };
      });
      return next;
    });
  };

  // Apply Global Rule to all selected items
  const handleApplyGlobalRules = () => {
    setDrafts(prev => {
      const next = { ...prev };
      selectedMedicines.forEach(med => {
        const draft = next[med.id] || {
          medicineId: med.id,
          originalStock: med.stockQuantity,
          newStock: med.stockQuantity,
          originalRate: med.rate,
          newRate: med.rate,
          originalThreshold: med.minThreshold || 10,
          newThreshold: med.minThreshold || 10
        };

        let newStock = draft.newStock;
        let newRate = draft.newRate;
        let newThreshold = draft.newThreshold;

        // Stock rule
        if (globalStockAction === 'add_qty') {
          newStock = Math.max(0, draft.newStock + (globalStockVal || 0));
        } else if (globalStockAction === 'deduct_qty') {
          newStock = Math.max(0, draft.newStock - (globalStockVal || 0));
        } else if (globalStockAction === 'set_fixed') {
          newStock = Math.max(0, globalStockVal || 0);
        } else if (globalStockAction === 'percent_qty') {
          newStock = Math.max(0, Math.round(draft.newStock * (1 + (globalStockVal || 0) / 100)));
        }

        // Price rule
        if (globalPriceAction === 'percent_inc') {
          newRate = Number((draft.newRate * (1 + (globalPriceVal || 0) / 100)).toFixed(2));
        } else if (globalPriceAction === 'percent_dec') {
          newRate = Math.max(0, Number((draft.newRate * (1 - (globalPriceVal || 0) / 100)).toFixed(2)));
        } else if (globalPriceAction === 'flat_inc') {
          newRate = Number((draft.newRate + (globalPriceVal || 0)).toFixed(2));
        } else if (globalPriceAction === 'flat_dec') {
          newRate = Math.max(0, Number((draft.newRate - (globalPriceVal || 0)).toFixed(2)));
        } else if (globalPriceAction === 'fixed') {
          newRate = Math.max(0, Number((globalPriceVal || 0).toFixed(2)));
        }

        // Threshold rule
        if (typeof globalThresholdVal === 'number' && globalThresholdVal >= 0) {
          newThreshold = globalThresholdVal;
        }

        next[med.id] = {
          ...draft,
          newStock,
          newRate,
          newThreshold
        };
      });
      return next;
    });
  };

  // Add medicine to selection
  const handleAddMedicine = (med: Medicine) => {
    if (!selectedIds.includes(med.id)) {
      setSelectedIds(prev => [...prev, med.id]);
      if (!drafts[med.id]) {
        setDrafts(prev => ({
          ...prev,
          [med.id]: {
            medicineId: med.id,
            originalStock: med.stockQuantity,
            newStock: med.stockQuantity,
            originalRate: med.rate,
            newRate: med.rate,
            originalThreshold: med.minThreshold || 10,
            newThreshold: med.minThreshold || 10
          }
        }));
      }
    }
    setSearchQuery('');
    setIsAddDropdownOpen(false);
  };

  // Remove medicine from selection
  const handleRemoveMedicine = (id: string) => {
    setSelectedIds(prev => prev.filter(item => item !== id));
  };

  // Select all medicines
  const handleSelectAllMedicines = () => {
    setSelectedIds(allMedicines.map(m => m.id));
  };

  // Calculation of summary changes
  const summary = useMemo(() => {
    let changedItemsCount = 0;
    let originalTotalUnits = 0;
    let newTotalUnits = 0;
    let originalTotalValuation = 0;
    let newTotalValuation = 0;

    selectedMedicines.forEach(med => {
      const draft = drafts[med.id];
      if (!draft) return;

      const isChanged = 
        draft.newStock !== draft.originalStock ||
        draft.newRate !== draft.originalRate ||
        draft.newThreshold !== draft.originalThreshold;

      if (isChanged) changedItemsCount++;

      originalTotalUnits += draft.originalStock;
      newTotalUnits += draft.newStock;

      originalTotalValuation += draft.originalStock * draft.originalRate;
      newTotalValuation += draft.newStock * draft.newRate;
    });

    const netUnitsDelta = newTotalUnits - originalTotalUnits;
    const netValuationDelta = newTotalValuation - originalTotalValuation;

    return {
      changedItemsCount,
      originalTotalUnits,
      newTotalUnits,
      netUnitsDelta,
      originalTotalValuation,
      newTotalValuation,
      netValuationDelta
    };
  }, [selectedMedicines, drafts]);

  // Execute Batch Update in Firestore
  const handleApplyAdjustments = async () => {
    if (selectedMedicines.length === 0) return;
    if (summary.changedItemsCount === 0) {
      alert('No changes have been made yet. Modify stock or price before applying.');
      return;
    }

    try {
      setIsSubmitting(true);
      const changedMedNames: string[] = [];

      // Build granular item audit diffs
      const itemDiffs: any[] = [];
      let totalShrinkageUnits = 0;
      let totalShrinkageLoss = 0;

      for (const med of selectedMedicines) {
        const draft = drafts[med.id];
        if (!draft) continue;

        const isStockChanged = draft.newStock !== draft.originalStock;
        const isRateChanged = draft.newRate !== draft.originalRate;
        const isThresholdChanged = draft.newThreshold !== draft.originalThreshold;

        if (!isStockChanged && !isRateChanged && !isThresholdChanged) {
          continue;
        }

        changedMedNames.push(med.name);
        const stockDelta = draft.newStock - draft.originalStock;
        const rateDelta = draft.newRate - draft.originalRate;
        const thresholdDelta = draft.newThreshold - draft.originalThreshold;
        const isItemShrinkage = stockDelta < 0;
        const itemShrinkageLoss = isItemShrinkage ? Math.abs(stockDelta) * draft.originalRate : 0;

        if (isItemShrinkage) {
          totalShrinkageUnits += Math.abs(stockDelta);
          totalShrinkageLoss += itemShrinkageLoss;
        }

        itemDiffs.push({
          medicineId: med.id,
          medicineName: med.name,
          category: med.type,
          previousStock: draft.originalStock,
          newStock: draft.newStock,
          stockDelta,
          previousRate: draft.originalRate,
          newRate: draft.newRate,
          rateDelta,
          previousThreshold: draft.originalThreshold,
          newThreshold: draft.newThreshold,
          thresholdDelta,
          isShrinkage: isItemShrinkage,
          shrinkageLoss: itemShrinkageLoss,
          batchNumber: med.batches?.[0]?.batchNumber || med.batchNumber || 'Standard',
          reason: reason
        });

        // Adjust batches to stay aligned with new stockQuantity
        let updatedBatches = [...(med.batches || [])];
        if (isStockChanged) {
          if (updatedBatches.length > 0) {
            // Adjust the primary/latest batch to absorb the delta
            const primary = { ...updatedBatches[0] };
            primary.quantity = Math.max(0, primary.quantity + stockDelta);
            updatedBatches[0] = primary;
          } else {
            // Create a default batch
            updatedBatches = [{
              id: crypto.randomUUID(),
              batchNumber: 'AUDIT-' + new Date().toISOString().slice(2, 10).replace(/-/g, ''),
              expiryDate: med.expiryDate || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
              quantity: draft.newStock
            }];
          }
        }

        const docRef = doc(db, 'inventory', med.id);
        await updateDoc(docRef, {
          stockQuantity: draft.newStock,
          rate: draft.newRate,
          minThreshold: draft.newThreshold,
          batches: updatedBatches,
          updatedAt: new Date().toISOString()
        });
      }

      // Log system audit activity
      const reasonObj = REASONS.find(r => r.id === reason);
      const reasonLabel = reasonObj?.label || 'Manual Adjustment';
      const hasShrinkage = totalShrinkageUnits > 0;
      
      let logAction = 'Bulk Stock Adjustment';
      if (hasShrinkage && reason === 'damaged_writeoff') {
        logAction = 'Damaged Stock Write-off';
      } else if (hasShrinkage) {
        logAction = 'Inventory Reconciliation (Shrinkage Detected)';
      }

      const logDescription = `Bulk adjusted ${summary.changedItemsCount} medicines (${changedMedNames.slice(0, 3).join(', ')}${changedMedNames.length > 3 ? ` +${changedMedNames.length - 3} more` : ''}). Reason: ${reasonLabel}. Units Delta: ${summary.netUnitsDelta >= 0 ? `+${summary.netUnitsDelta}` : summary.netUnitsDelta}, Value Delta: ₹${summary.netValuationDelta.toFixed(2)}${hasShrinkage ? ` | Shrinkage Loss: -${totalShrinkageUnits} units (-₹${totalShrinkageLoss.toFixed(2)})` : ''}${auditNotes ? ` | Note: ${auditNotes}` : ''}`;

      await logActivity({
        action: logAction,
        description: logDescription,
        type: 'inventory',
        module: 'inventory',
        userEmail: profile?.email || 'admin@satyampharma.com',
        userId: profile?.uid,
        userName: profile?.displayName || profile?.email?.split('@')[0] || 'Staff',
        userRole: profile?.role || 'clerk',
        severity: hasShrinkage ? (totalShrinkageLoss > 1000 ? 'danger' : 'warning') : 'info',
        details: {
          adjustedCount: summary.changedItemsCount,
          reason: reasonLabel,
          reasonCode: reason,
          isShrinkage: hasShrinkage,
          shrinkageUnits: totalShrinkageUnits,
          shrinkageLoss: totalShrinkageLoss,
          netUnitsDelta: summary.netUnitsDelta,
          netValuationDelta: summary.netValuationDelta,
          previousTotalUnits: summary.originalTotalUnits,
          newTotalUnits: summary.newTotalUnits,
          previousTotalValuation: summary.originalTotalValuation,
          newTotalValuation: summary.newTotalValuation,
          notes: auditNotes || '',
          sampleMedicines: changedMedNames.slice(0, 5),
          items: itemDiffs
        }
      });

      setSaveSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 900);
    } catch (error) {
      console.error('Error applying bulk adjustments:', error);
      alert('Failed to update inventory. Please verify network permissions and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs"
        onClick={onClose}
      />

      {/* Modal Card */}
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="relative flex flex-col w-full max-w-6xl max-h-[94vh] rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-600/20">
              <Sliders size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  {t('bulkAdjustStock') || 'Adjust Stock & Pricing (Bulk Operation)'}
                </h2>
                <span className="rounded-full bg-blue-100 dark:bg-blue-950/80 px-2.5 py-0.5 text-[10px] font-black text-blue-700 dark:text-blue-300">
                  {selectedMedicines.length} Selected
                </span>
                {summary.changedItemsCount > 0 && (
                  <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 text-[10px] font-black text-emerald-700 dark:text-emerald-300 animate-pulse">
                    {summary.changedItemsCount} Modified
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('adjustStockDesc') || 'Modify multiple medication stock quantities, unit prices (MRP), or reorder thresholds simultaneously.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetAll}
              disabled={summary.changedItemsCount === 0}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 transition-all cursor-pointer"
              title="Reset all drafts to original database values"
            >
              <RotateCcw size={13} />
              <span>Reset All</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body: Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Top Quick Actions Bar: Global Batch Rule & Quick Search Picker */}
          <div className="grid gap-4 lg:grid-cols-12">
            {/* Global Rule Apply Box */}
            <div className="lg:col-span-8 rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-gradient-to-br from-blue-50/60 via-slate-50 to-white dark:from-blue-950/20 dark:via-slate-900 dark:to-slate-900 p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-300">
                    Apply Global Rule To All Selected Items ({selectedMedicines.length})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleApplyGlobalRules}
                  disabled={globalPriceAction === 'none' && globalStockAction === 'none' && globalThresholdVal === ''}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-40 transition-all active:scale-95 cursor-pointer"
                >
                  <Sparkles size={13} />
                  <span>Apply Rule</span>
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {/* Global Price Rule */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Price / MRP Rule
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      value={globalPriceAction}
                      onChange={(e) => setGlobalPriceAction(e.target.value as any)}
                      className="flex-1 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-2 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:border-blue-500 outline-none"
                    >
                      <option value="none">No Price Change</option>
                      <option value="percent_inc">+% Increase Rate</option>
                      <option value="percent_dec">-% Discount Rate</option>
                      <option value="flat_inc">+ Flat ₹ Add</option>
                      <option value="flat_dec">- Flat ₹ Deduct</option>
                      <option value="fixed">Set Fixed Rate (₹)</option>
                    </select>
                    {globalPriceAction !== 'none' && (
                      <input
                        type="number"
                        step={globalPriceAction.includes('percent') ? '1' : '0.5'}
                        value={globalPriceVal}
                        onChange={(e) => setGlobalPriceVal(Number(e.target.value))}
                        className="w-16 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-2 py-1.5 text-center text-xs font-bold text-slate-900 dark:text-white"
                        placeholder="Val"
                      />
                    )}
                  </div>
                </div>

                {/* Global Stock Rule */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Stock Quantity Rule
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      value={globalStockAction}
                      onChange={(e) => setGlobalStockAction(e.target.value as any)}
                      className="flex-1 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-2 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:border-blue-500 outline-none"
                    >
                      <option value="none">No Stock Change</option>
                      <option value="add_qty">+ Add Fixed Units</option>
                      <option value="deduct_qty">- Deduct Fixed Units</option>
                      <option value="set_fixed">Set Fixed Stock Qty</option>
                      <option value="percent_qty">±% Percentage Qty</option>
                    </select>
                    {globalStockAction !== 'none' && (
                      <input
                        type="number"
                        value={globalStockVal}
                        onChange={(e) => setGlobalStockVal(Number(e.target.value))}
                        className="w-16 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-2 py-1.5 text-center text-xs font-bold text-slate-900 dark:text-white"
                        placeholder="Qty"
                      />
                    )}
                  </div>
                </div>

                {/* Global Threshold Rule */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Min Safety Level
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      value={globalThresholdVal}
                      onChange={(e) => setGlobalThresholdVal(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="e.g. 15 (Optional)"
                      className="w-full rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Add Medicine Selector & Bulk Selection Tools */}
            <div className="lg:col-span-4 flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4 shadow-2xs">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Include More Medicines
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAllMedicines}
                    className="text-[10px] font-bold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
                  >
                    Select All ({allMedicines.length})
                  </button>
                </div>

                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onFocus={() => setIsAddDropdownOpen(true)}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsAddDropdownOpen(true);
                    }}
                    placeholder="Search medicine to add..."
                    className="w-full rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 py-2 pl-9 pr-3 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 outline-none"
                  />

                  {/* Dropdown search results */}
                  {isAddDropdownOpen && availableToAdd.length > 0 && (
                    <div className="absolute top-full mt-1 left-0 right-0 z-30 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xl divide-y divide-slate-100 dark:divide-slate-800">
                      {availableToAdd.map(med => (
                        <button
                          key={med.id}
                          type="button"
                          onClick={() => handleAddMedicine(med)}
                          className="flex w-full items-center justify-between p-2.5 text-left text-xs hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">{med.name}</p>
                            <p className="text-[10px] text-slate-400">{med.genericName || med.type} • Stock: {med.stockQuantity}</p>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] font-black text-blue-600 dark:text-blue-400">
                            <span>{formatCurrency(med.rate)}</span>
                            <Plus size={14} />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span>{selectedMedicines.length} in adjustment batch</span>
                {selectedMedicines.length < allMedicines.length && (
                  <button
                    type="button"
                    onClick={() => setSelectedIds(allMedicines.map(m => m.id))}
                    className="font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    + Add All ({allMedicines.length - selectedMedicines.length} remaining)
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Itemized Table of Selected Medications */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                  <tr className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3 min-w-[200px]">Medicine & Category</th>
                    <th className="px-4 py-3 min-w-[280px]">Stock Level (Current ➔ New)</th>
                    <th className="px-4 py-3 min-w-[240px]">Unit Rate / MRP (₹)</th>
                    <th className="px-4 py-3 min-w-[130px]">Reorder Min</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {selectedMedicines.map((med) => {
                    const draft = drafts[med.id] || {
                      medicineId: med.id,
                      originalStock: med.stockQuantity,
                      newStock: med.stockQuantity,
                      originalRate: med.rate,
                      newRate: med.rate,
                      originalThreshold: med.minThreshold || 10,
                      newThreshold: med.minThreshold || 10
                    };

                    const stockDelta = draft.newStock - draft.originalStock;
                    const priceDelta = draft.newRate - draft.originalRate;
                    const pricePercent = draft.originalRate > 0 ? (priceDelta / draft.originalRate) * 100 : 0;
                    const isChanged = stockDelta !== 0 || priceDelta !== 0 || draft.newThreshold !== draft.originalThreshold;

                    return (
                      <tr 
                        key={med.id} 
                        className={cn(
                          "transition-colors",
                          isChanged 
                            ? "bg-blue-50/30 dark:bg-blue-950/20 hover:bg-blue-50/60 dark:hover:bg-blue-950/40" 
                            : "odd:bg-white dark:odd:bg-slate-900 even:bg-slate-50/60 dark:even:bg-slate-800/30 hover:bg-blue-50/50 dark:hover:bg-slate-800/60"
                        )}
                      >
                        {/* Medicine Info */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-slate-900 dark:text-slate-100">{med.name}</span>
                              {isChanged && (
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" title="Changes pending" />
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[9px] font-black uppercase text-slate-600 dark:text-slate-400">
                                {med.type}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate max-w-[150px]">
                                {med.genericName || med.salt || 'Standard'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Stock Adjustment Controls */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Current</span>
                              <span className="text-xs font-black text-slate-700 dark:text-slate-300">{draft.originalStock}</span>
                            </div>

                            <ArrowRight size={12} className="text-slate-300 dark:text-slate-600 shrink-0" />

                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                value={draft.newStock}
                                onChange={(e) => handleUpdateDraft(med.id, 'newStock', Number(e.target.value))}
                                className="w-20 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-2.5 py-1.5 text-center text-xs font-black text-slate-900 dark:text-white focus:border-blue-500 outline-none"
                              />

                              {/* Delta Shortcut Buttons */}
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleAddStockDelta(med.id, -5)}
                                  className="h-6 w-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:bg-rose-100 hover:text-rose-700 transition-colors"
                                  title="Deduct 5 units"
                                >
                                  -5
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAddStockDelta(med.id, 5)}
                                  className="h-6 w-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:bg-emerald-100 hover:text-emerald-700 transition-colors"
                                  title="Add 5 units"
                                >
                                  +5
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAddStockDelta(med.id, 20)}
                                  className="h-6 w-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:bg-emerald-100 hover:text-emerald-700 transition-colors"
                                  title="Add 20 units"
                                >
                                  +20
                                </button>
                              </div>

                              {/* Delta Badge */}
                              {stockDelta !== 0 && (
                                <span className={cn(
                                  "rounded-lg px-2 py-0.5 text-[10px] font-black shrink-0",
                                  stockDelta > 0 
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                    : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                                )}>
                                  {stockDelta > 0 ? `+${stockDelta}` : stockDelta}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Rate / Price Adjustment Controls */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Current</span>
                              <span className="text-xs font-black text-slate-700 dark:text-slate-300">{formatCurrency(draft.originalRate)}</span>
                            </div>

                            <ArrowRight size={12} className="text-slate-300 dark:text-slate-600 shrink-0" />

                            <div className="flex items-center gap-1.5">
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  value={draft.newRate}
                                  onChange={(e) => handleUpdateDraft(med.id, 'newRate', Number(e.target.value))}
                                  className="w-24 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 py-1.5 pl-5 pr-2 text-xs font-black text-slate-900 dark:text-white focus:border-blue-500 outline-none"
                                />
                              </div>

                              {/* Price Quick % Buttons */}
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleAddPricePercent(med.id, 5)}
                                  className="h-6 px-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[9px] font-black text-blue-600 dark:text-blue-400 hover:bg-blue-100"
                                  title="+5% Markup"
                                >
                                  +5%
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAddPricePercent(med.id, -5)}
                                  className="h-6 px-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[9px] font-black text-amber-600 dark:text-amber-400 hover:bg-amber-100"
                                  title="-5% Discount"
                                >
                                  -5%
                                </button>
                              </div>

                              {/* Price Delta Badge */}
                              {priceDelta !== 0 && (
                                <span className={cn(
                                  "rounded-lg px-2 py-0.5 text-[10px] font-black shrink-0",
                                  priceDelta > 0 
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                    : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                )}>
                                  {priceDelta > 0 ? `+₹${priceDelta.toFixed(2)}` : `-₹${Math.abs(priceDelta).toFixed(2)}`}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Threshold Control */}
                        <td className="px-4 py-3.5">
                          <input
                            type="number"
                            min="0"
                            value={draft.newThreshold}
                            onChange={(e) => handleUpdateDraft(med.id, 'newThreshold', Number(e.target.value))}
                            className="w-16 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-2 py-1.5 text-center text-xs font-bold text-slate-800 dark:text-slate-200 focus:border-blue-500 outline-none"
                          />
                        </td>

                        {/* Actions per Row */}
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleResetItem(med.id)}
                              disabled={!isChanged}
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20 dark:hover:bg-slate-800 transition-colors"
                              title="Reset item to original values"
                            >
                              <RotateCcw size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveMedicine(med.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 transition-colors"
                              title="Remove from this adjustment batch"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {selectedMedicines.length === 0 && (
              <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                <Package size={40} className="mb-2 opacity-30" />
                <p className="text-sm font-bold">No medicines selected in batch</p>
                <button
                  type="button"
                  onClick={handleSelectAllMedicines}
                  className="mt-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Select all medicines ({allMedicines.length})
                </button>
              </div>
            )}
          </div>

          {/* Audit Reason & Documentation Section */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ClipboardCheck size={16} className="text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Audit Trail & Operation Purpose (Regulatory Requirement)
              </h3>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setReason(r.id)}
                  className={cn(
                    "flex flex-col text-left p-3 rounded-xl border transition-all cursor-pointer",
                    reason === r.id
                      ? "border-blue-600 bg-blue-50/80 dark:border-blue-500 dark:bg-blue-950/40 shadow-xs"
                      : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{r.icon}</span>
                    <span className="text-xs font-black text-slate-900 dark:text-white">{r.label}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">{r.desc}</p>
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Optional Audit Notes / Inward PO Reference / Pharmacist Remarks
              </label>
              <input
                type="text"
                value={auditNotes}
                onChange={(e) => setAuditNotes(e.target.value)}
                placeholder="e.g., Monthly physical count reconciliation, Invoice #VTP-8842, Approved by Lead Pharmacist"
                className="w-full rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Footer: Live Valuation Impact & Commit Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-6 py-4">
          {/* Summary Stat Pills */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-800 px-3 py-1.5">
              <Package size={14} className="text-blue-600 dark:text-blue-400" />
              <span className="text-slate-500 dark:text-slate-400">Stock Units:</span>
              <strong className="text-slate-900 dark:text-white">{summary.originalTotalUnits} ➔ {summary.newTotalUnits}</strong>
              {summary.netUnitsDelta !== 0 && (
                <span className={cn(
                  "rounded px-1.5 py-0.2 text-[10px] font-black",
                  summary.netUnitsDelta > 0 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                )}>
                  {summary.netUnitsDelta > 0 ? `+${summary.netUnitsDelta}` : summary.netUnitsDelta}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-800 px-3 py-1.5">
              <IndianRupee size={14} className="text-emerald-600 dark:text-emerald-400" />
              <span className="text-slate-500 dark:text-slate-400">Inventory Valuation:</span>
              <strong className="text-slate-900 dark:text-white">
                {formatCurrency(summary.originalTotalValuation)} ➔ {formatCurrency(summary.newTotalValuation)}
              </strong>
              {summary.netValuationDelta !== 0 && (
                <span className={cn(
                  "rounded px-1.5 py-0.2 text-[10px] font-black",
                  summary.netValuationDelta > 0 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                )}>
                  {summary.netValuationDelta > 0 ? `+${formatCurrency(summary.netValuationDelta)}` : formatCurrency(summary.netValuationDelta)}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
            >
              {t('cancel') || 'Cancel'}
            </button>

            <button
              type="button"
              id="confirm-bulk-stock-adjust-btn"
              onClick={handleApplyAdjustments}
              disabled={isSubmitting || summary.changedItemsCount === 0 || saveSuccess}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-blue-600/30 hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 size={16} className="text-emerald-300" />
                  <span>Adjustments Saved!</span>
                </>
              ) : isSubmitting ? (
                <>
                  <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Updating Inventory...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Apply {summary.changedItemsCount > 0 ? `(${summary.changedItemsCount}) ` : ''}Adjustments</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default BulkStockAdjustModal;
