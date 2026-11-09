import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ArrowRight,
  ShieldCheck,
  X,
  Layers,
  FileText,
  DollarSign,
  Package,
  TrendingDown,
  TrendingUp,
  HelpCircle,
  Sparkles,
  Download,
  Trash2,
  Check,
  RotateCcw,
  Info,
  Clock,
  User,
  ShoppingBag,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  OfflineSale,
  OfflineSaleConflictAnalysis,
  ConflictResolutionDecision,
  diagnoseAllPendingConflicts,
  resolveAndMergeOfflineSale,
  mergeAllCleanSales,
  batchAutoResolveAndMergeAll,
  createSimulatedOfflineConflictSale,
  deleteOfflineSale,
  getOfflineQueueStats,
  getAllOfflineSales
} from '../lib/offlinePosStore';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { useAuth } from './AuthProvider';
import { useLanguage } from '../context/LanguageContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SyncConflictResolverModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SyncConflictResolverModal: React.FC<SyncConflictResolverModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { profile } = useAuth();
  const { t, tText } = useLanguage();

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [analyses, setAnalyses] = useState<OfflineSaleConflictAnalysis[]>([]);
  const [allSales, setAllSales] = useState<OfflineSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'conflicts' | 'clean'>('all');
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Per-sale expanded state for granular diff inspection
  const [expandedSaleIds, setExpandedSaleIds] = useState<Record<string, boolean>>({});

  // Per-sale decisions state: saleId -> itemId -> decision
  const [decisions, setDecisions] = useState<Record<string, Record<string, ConflictResolutionDecision>>>({});

  // Notes per sale
  const [saleNotes, setSaleNotes] = useState<Record<string, string>>({});

  // Loading state for individual merge actions
  const [mergingSaleId, setMergingSaleId] = useState<string | null>(null);
  const [isBatchMerging, setIsBatchMerging] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const fetchConflicts = async () => {
    setLoading(true);
    try {
      const data = await diagnoseAllPendingConflicts();
      setAnalyses(data);
      const all = await getAllOfflineSales();
      setAllSales(all);

      // Initialize default decisions for any items with conflicts
      const initialDecisions: Record<string, Record<string, ConflictResolutionDecision>> = {};
      data.forEach(item => {
        initialDecisions[item.sale.id] = {};
        item.conflicts.forEach(c => {
          initialDecisions[item.sale.id][c.medicineId] = {
            strategy: 'honor_offline',
            deductStock: true,
            customPrice: c.offlinePrice,
            customQuantity: c.offlineQuantity,
          };
        });
      });
      setDecisions(initialDecisions);
    } catch (err) {
      console.error('[Sync Conflict Resolver] Failed to analyze:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchConflicts();
    }

    const handleOnline = () => {
      setIsOnline(true);
      fetchConflicts();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleSalesUpdated = () => {
      fetchConflicts();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-sales-updated', handleSalesUpdated);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-sales-updated', handleSalesUpdated);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const totalPendingCount = analyses.length;
  const conflictedCount = analyses.filter(a => a.hasConflicts).length;
  const cleanCount = analyses.filter(a => !a.hasConflicts).length;
  const totalPendingAmount = analyses.reduce((sum, a) => sum + (Number(a.sale.totalAmount) || 0), 0);

  const filteredAnalyses = analyses.filter(a => {
    if (activeFilter === 'conflicts' && !a.hasConflicts) return false;
    if (activeFilter === 'clean' && a.hasConflicts) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = a.sale.id.toLowerCase().includes(q);
      const matchCust = (a.sale.customerName || '').toLowerCase().includes(q);
      const matchItem = a.sale.items.some(it => it.name.toLowerCase().includes(q));
      if (!matchId && !matchCust && !matchItem) return false;
    }
    return true;
  });

  const toggleExpand = (saleId: string) => {
    setExpandedSaleIds(prev => ({ ...prev, [saleId]: !prev[saleId] }));
  };

  const handleDecisionChange = (
    saleId: string,
    itemId: string,
    newDecision: Partial<ConflictResolutionDecision>
  ) => {
    setDecisions(prev => ({
      ...prev,
      [saleId]: {
        ...(prev[saleId] || {}),
        [itemId]: {
          ...(prev[saleId]?.[itemId] || { strategy: 'honor_offline', deductStock: true }),
          ...newDecision,
        },
      },
    }));
  };

  const handleApplyPresetToAllItems = (
    saleId: string,
    strategy: 'honor_offline' | 'apply_cloud_pricing' | 'cap_to_live_stock' | 'skip_stock_deduction'
  ) => {
    const saleAnalysis = analyses.find(a => a.sale.id === saleId);
    if (!saleAnalysis) return;

    const updatedSaleDecisions: Record<string, ConflictResolutionDecision> = {};
    saleAnalysis.conflicts.forEach(c => {
      let customPrice = c.offlinePrice;
      let customQuantity = c.offlineQuantity;
      let deductStock = true;

      if (strategy === 'apply_cloud_pricing' && c.livePrice !== undefined) {
        customPrice = c.livePrice;
      }
      if (strategy === 'cap_to_live_stock' && c.liveAvailableStock !== undefined) {
        customQuantity = Math.max(0, c.liveAvailableStock);
      }
      if (strategy === 'skip_stock_deduction') {
        deductStock = false;
      }

      updatedSaleDecisions[c.medicineId] = {
        strategy,
        customPrice,
        customQuantity,
        deductStock,
      };
    });

    setDecisions(prev => ({
      ...prev,
      [saleId]: updatedSaleDecisions,
    }));
  };

  const handleMergeSingleSale = async (saleId: string) => {
    if (!isOnline) {
      alert('Cannot merge while disconnected. Please connect to the internet.');
      return;
    }

    setMergingSaleId(saleId);
    try {
      const saleDecisions = decisions[saleId] || {};
      const note = saleNotes[saleId] || '';
      const res = await resolveAndMergeOfflineSale(
        saleId,
        saleDecisions,
        note,
        profile ? { uid: profile.uid, email: profile.email, displayName: profile.displayName } : undefined
      );

      if (res.success) {
        setActionSuccessMsg(`Sale #${saleId.slice(-6)} merged to cloud database successfully!`);
        setTimeout(() => setActionSuccessMsg(null), 4000);
        await fetchConflicts();
      } else {
        alert(`Merge error: ${res.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Error during merge: ${err?.message || 'Error occurred'}`);
    } finally {
      setMergingSaleId(null);
    }
  };

  const handleMergeAllClean = async () => {
    if (!isOnline) {
      alert('Cannot merge while offline.');
      return;
    }

    setIsBatchMerging(true);
    try {
      const res = await mergeAllCleanSales();
      if (res.successCount > 0) {
        setActionSuccessMsg(`Merged ${res.successCount} clean transactions to cloud database!`);
        setTimeout(() => setActionSuccessMsg(null), 4000);
      }
      if (res.failCount > 0) {
        alert(`Failed to merge ${res.failCount} transactions: ${res.errors.join(', ')}`);
      }
      await fetchConflicts();
    } catch (err: any) {
      alert(`Batch merge error: ${err?.message || 'Error'}`);
    } finally {
      setIsBatchMerging(false);
    }
  };

  const handleAutoResolveAll = async () => {
    if (!isOnline) {
      alert('Cannot merge while offline.');
      return;
    }

    if (
      !window.confirm(
        `Merge all ${totalPendingCount} pending offline transactions? Standard pharmacy policy will honor prices printed on customer receipts and adjust inventory balances accordingly.`
      )
    ) {
      return;
    }

    setIsBatchMerging(true);
    try {
      const res = await batchAutoResolveAndMergeAll();
      if (res.successCount > 0) {
        setActionSuccessMsg(`Auto-merged all ${res.successCount} offline transactions successfully!`);
        setTimeout(() => setActionSuccessMsg(null), 5000);
      }
      if (res.failCount > 0) {
        alert(`Failed to merge ${res.failCount} records: ${res.errors.join(', ')}`);
      }
      await fetchConflicts();
    } catch (err: any) {
      alert(`Auto-merge error: ${err?.message || 'Error'}`);
    } finally {
      setIsBatchMerging(false);
    }
  };

  const handleDiscardSale = async (saleId: string) => {
    if (window.confirm(`Discard offline sale record #${saleId}? This will remove it from the local queue.`)) {
      await deleteOfflineSale(saleId);
      await fetchConflicts();
    }
  };

  const handleSimulateConflict = async (type: 'stock_conflict' | 'price_conflict' | 'clean') => {
    setIsSimulating(true);
    try {
      const simulated = await createSimulatedOfflineConflictSale(type);
      setActionSuccessMsg(`Simulated test offline sale #${simulated.id.slice(-6)} created!`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
      await fetchConflicts();
    } catch (err: any) {
      alert(`Simulation error: ${err?.message || 'Error'}`);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleExportConflictReport = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text('SATYAM MEDICAL PHARMACY', 105, 16, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(70);
    doc.text('Offline POS Sync Conflicts & Merge Audit Report', 105, 23, { align: 'center' });
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')} | Staff: ${profile?.displayName || 'Pharmacist'}`, 105, 29, { align: 'center' });

    doc.setDrawColor(200);
    doc.line(10, 33, 200, 33);

    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`Pending Transactions: ${totalPendingCount} | Conflicted Records: ${conflictedCount} | Total Queue Value: ${formatCurrency(totalPendingAmount)}`, 10, 40);

    const rows: any[] = [];
    analyses.forEach(a => {
      a.conflicts.forEach(c => {
        rows.push([
          a.sale.id.slice(-8),
          a.sale.customerName || 'Walk-in',
          c.medicineName,
          `Sold: ${c.offlineQuantity} (Avail: ${c.liveAvailableStock ?? 'N/A'})`,
          `Sold: ₹${c.offlinePrice} (Cloud: ₹${c.livePrice ?? 'N/A'})`,
          c.hasConflict ? (c.conflictNotes.join('; ') || 'Conflict detected') : 'Clean / Matches Live DB',
        ]);
      });
    });

    autoTable(doc, {
      startY: 45,
      head: [['Receipt #', 'Customer', 'Medicine Item', 'Qty (Sold/Live)', 'Price (Sold/Live)', 'Conflict Diagnostic']],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42], fontSize: 9 },
      styles: { fontSize: 8 },
    });

    doc.save(`Offline_Sync_Conflicts_Report_${Date.now()}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative flex flex-col w-full max-w-5xl h-[92vh] max-h-[850px] rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-slate-100"
      >
        {/* Top Banner & Feedback */}
        <AnimatePresence>
          {actionSuccessMsg && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-xl shadow-emerald-600/30"
            >
              <CheckCircle2 size={16} />
              <span>{actionSuccessMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 p-4 sm:p-5 bg-gradient-to-r from-indigo-50/70 via-blue-50/40 to-slate-50 dark:from-slate-900 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-md">
              <RotateCcw size={22} className={cn(loading && "animate-spin")} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                  {tText('Offline POS Sync Conflict Resolver', 'ऑफलाइन पीओएस सिंक कॉन्फ्लिक्ट रिसॉल्वर')}
                </h2>
                <span className={cn(
                  "flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase",
                  isOnline 
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                )}>
                  {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                  {isOnline ? 'Online • Ready to Merge' : 'Offline • Local Mode'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Review offline-captured billing sales, inspect stock/pricing variances, and safely merge into the cloud database.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={fetchConflicts}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-all cursor-pointer shadow-2xs"
              title="Refresh live cloud inventory state and re-diagnose"
            >
              <RefreshCw size={13} className={cn(loading && "animate-spin")} />
              <span className="hidden sm:inline">Re-Scan</span>
            </button>

            <button
              type="button"
              onClick={handleExportConflictReport}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-all cursor-pointer shadow-2xs"
              title="Download PDF Audit Report"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Report</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Diagnostic Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 p-3 sm:p-4 bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 p-3 shadow-2xs">
            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">
              Pending Queue
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black text-slate-900 dark:text-slate-100">
                {totalPendingCount}
              </span>
              <span className="text-xs font-bold text-slate-500">
                {formatCurrency(totalPendingAmount)}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/20 p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-rose-700 dark:text-rose-400">
                Conflicts Detected
              </span>
              {conflictedCount > 0 && <AlertOctagon size={14} className="text-rose-600 animate-pulse" />}
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black text-rose-700 dark:text-rose-300">
                {conflictedCount}
              </span>
              <span className="text-[11px] font-bold text-rose-600/80">
                {conflictedCount === 0 ? 'All Safe' : 'Needs Review'}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20 p-3 shadow-2xs">
            <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">
              Clean / Verified
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                {cleanCount}
              </span>
              <span className="text-[11px] font-bold text-emerald-600/80">
                100% Match
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/60 dark:bg-indigo-950/20 p-3 shadow-2xs flex flex-col justify-center">
            <span className="text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-400">
              Total Offline Records
            </span>
            <span className="text-xl font-black text-indigo-700 dark:text-indigo-300 mt-1">
              {allSales.length}
            </span>
          </div>
        </div>

        {/* Toolbar & Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
                activeFilter === 'all'
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              )}
            >
              All ({totalPendingCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('conflicts')}
              className={cn(
                "flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
                activeFilter === 'conflicts'
                  ? "bg-rose-600 text-white shadow-2xs"
                  : "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              )}
            >
              <AlertTriangle size={12} />
              <span>Conflicts ({conflictedCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('clean')}
              className={cn(
                "flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
                activeFilter === 'clean'
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              )}
            >
              <CheckCircle2 size={12} />
              <span>Clean ({cleanCount})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Simulation Generator Tool for testing */}
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 text-xs">
              <Sparkles size={13} className="text-amber-500" />
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mr-1">Simulate:</span>
              <button
                type="button"
                onClick={() => handleSimulateConflict('stock_conflict')}
                disabled={isSimulating}
                className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-900/60 text-[10px] font-black text-rose-800 dark:text-rose-200 hover:bg-rose-200 transition-colors"
                title="Create a test offline sale that exceeds available cloud stock"
              >
                + Stock Shortage
              </button>
              <button
                type="button"
                onClick={() => handleSimulateConflict('price_conflict')}
                disabled={isSimulating}
                className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 text-[10px] font-black text-amber-800 dark:text-amber-200 hover:bg-amber-200 transition-colors"
                title="Create a test offline sale with rate divergence"
              >
                + Price Diff
              </button>
              <button
                type="button"
                onClick={() => handleSimulateConflict('clean')}
                disabled={isSimulating}
                className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-[10px] font-black text-emerald-800 dark:text-emerald-200 hover:bg-emerald-200 transition-colors"
                title="Create a clean test offline sale"
              >
                + Clean
              </button>
            </div>

            {/* Batch Merge Actions */}
            {cleanCount > 0 && isOnline && (
              <button
                type="button"
                onClick={handleMergeAllClean}
                disabled={isBatchMerging}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 text-xs font-black text-white shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <Check size={14} />
                <span>Merge Clean ({cleanCount})</span>
              </button>
            )}

            {totalPendingCount > 0 && isOnline && (
              <button
                type="button"
                onClick={handleAutoResolveAll}
                disabled={isBatchMerging}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-3.5 py-1.5 text-xs font-black text-white shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                title="Apply standard pharmacy practice: honor offline receipt, deduct stock, and write audit diffs"
              >
                <ShieldCheck size={14} />
                <span>Auto-Resolve All ({totalPendingCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Main Content List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-100/50 dark:bg-slate-950/40">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-16 text-center">
              <RefreshCw size={36} className="animate-spin text-blue-600 mb-3" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Comparing offline records with live cloud database...
              </p>
              <p className="text-xs text-slate-500 mt-1">Analyzing inventory stock and price matrices.</p>
            </div>
          ) : filteredAnalyses.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center shadow-xs">
              <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 mb-3">
                <CheckCircle2 size={28} />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                {totalPendingCount === 0 ? 'All Offline Sales Synchronized!' : 'No sales matching current filter.'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                {totalPendingCount === 0
                  ? 'Your local IndexedDB queue is completely empty. When you process offline sales, they will appear here with live conflict detection.'
                  : 'Try switching filters to view all pending sales or simulate a test offline sale above.'}
              </p>
            </div>
          ) : (
            filteredAnalyses.map(analysis => {
              const sale = analysis.sale;
              const isExpanded = expandedSaleIds[sale.id] ?? analysis.hasConflicts;
              const saleDecisions = decisions[sale.id] || {};
              const isMerging = mergingSaleId === sale.id;

              return (
                <div
                  key={sale.id}
                  className={cn(
                    "rounded-3xl border bg-white dark:bg-slate-900 shadow-sm transition-all overflow-hidden",
                    analysis.hasConflicts
                      ? "border-rose-200 dark:border-rose-900/60"
                      : "border-emerald-200 dark:border-emerald-900/60"
                  )}
                >
                  {/* Card Header Summary */}
                  <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-start gap-3.5">
                      <div className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-bold shadow-xs mt-0.5",
                        analysis.hasConflicts
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      )}>
                        {analysis.hasConflicts ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-black text-sm text-slate-900 dark:text-slate-100">
                            #{sale.id}
                          </span>
                          <span className={cn(
                            "rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider",
                            analysis.riskLevel === 'high'
                              ? "bg-rose-600 text-white"
                              : analysis.riskLevel === 'moderate'
                                ? "bg-amber-500 text-white"
                                : "bg-emerald-600 text-white"
                          )}>
                            {analysis.riskLevel === 'high' ? 'High Conflict' : analysis.riskLevel === 'moderate' ? 'Price Variance' : 'Clean & Verified'}
                          </span>
                          <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                            {sale.billingType} • {sale.paymentMethod}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300 font-medium mt-1">
                          <span>Customer: <strong>{sale.customerName || 'Walk-in'}</strong> {sale.customerMobile && `(${sale.customerMobile})`}</span>
                          <span>Billed by: <strong>{sale.staffName || 'Pharmacist'}</strong></span>
                          <span>Time: {new Date(sale.timestamp).toLocaleString('en-IN')}</span>
                        </div>

                        {/* Conflict Explanation Banner if any */}
                        {analysis.hasConflicts && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-700 dark:text-rose-300 font-bold bg-rose-50 dark:bg-rose-950/50 px-3 py-1.5 rounded-xl border border-rose-200/80 dark:border-rose-900/60">
                            <AlertTriangle size={14} className="shrink-0 text-rose-600" />
                            <span>{analysis.summaryMessage}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right summary & primary actions */}
                    <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                      <div className="text-left lg:text-right">
                        <span className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                          {formatCurrency(sale.totalAmount)}
                        </span>
                        <p className="text-[11px] text-slate-500">{sale.items.length} line items</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleExpand(sale.id)}
                          className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-all cursor-pointer"
                        >
                          <span>{isExpanded ? 'Hide Details' : 'Review Diff'}</span>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleMergeSingleSale(sale.id)}
                          disabled={isMerging || !isOnline}
                          className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-black text-white shadow-sm shadow-blue-600/30 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw size={13} className={cn(isMerging && "animate-spin")} />
                          <span>{isMerging ? 'Merging...' : 'Merge to Cloud'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDiscardSale(sale.id)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                          title="Discard / Void offline record"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Item-by-Item Review & Diff Matrix */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 bg-slate-50/60 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 space-y-4">
                      {/* Batch strategy shortcuts for this sale */}
                      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                        <span className="font-bold text-slate-600 dark:text-slate-300 text-[11px]">
                          Quick Resolution Presets:
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleApplyPresetToAllItems(sale.id, 'honor_offline')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer"
                          >
                            Honor Offline Billed Receipt
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyPresetToAllItems(sale.id, 'apply_cloud_pricing')}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[11px] font-bold text-blue-800 dark:text-blue-300 hover:bg-blue-100 cursor-pointer"
                          >
                            Use Current Cloud Pricing
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyPresetToAllItems(sale.id, 'skip_stock_deduction')}
                            className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-[11px] font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 cursor-pointer"
                          >
                            Record Revenue Only (Skip Stock)
                          </button>
                        </div>
                      </div>

                      {/* Items comparison table */}
                      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100/70 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-black text-slate-500 dark:text-slate-400">
                            <tr>
                              <th className="p-3">Medicine Line Item</th>
                              <th className="p-3">Offline Checkout</th>
                              <th className="p-3">Live Cloud Database</th>
                              <th className="p-3">Variance / Conflict</th>
                              <th className="p-3">Resolution Strategy</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {analysis.conflicts.map(itemConflict => {
                              const itemId = itemConflict.medicineId;
                              const currentDecision = saleDecisions[itemId] || {
                                strategy: 'honor_offline',
                                deductStock: true,
                              };

                              return (
                                <tr
                                  key={itemId}
                                  className={cn(
                                    "transition-colors",
                                    itemConflict.hasConflict
                                      ? "bg-rose-50/30 dark:bg-rose-950/10"
                                      : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                  )}
                                >
                                  {/* Item Name */}
                                  <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                                    <div>{itemConflict.medicineName}</div>
                                    <span className="text-[10px] text-slate-400 font-mono">ID: {itemId}</span>
                                  </td>

                                  {/* Offline Sold */}
                                  <td className="p-3">
                                    <div className="font-bold text-slate-800 dark:text-slate-200">
                                      {itemConflict.offlineQuantity} units @ {formatCurrency(itemConflict.offlinePrice)}
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                      Subtotal: {formatCurrency(itemConflict.offlineQuantity * itemConflict.offlinePrice)}
                                    </div>
                                  </td>

                                  {/* Live Cloud State */}
                                  <td className="p-3">
                                    {itemConflict.isItemMissingInCloud ? (
                                      <span className="text-rose-600 font-bold">Item Missing in DB</span>
                                    ) : (
                                      <div>
                                        <div className="font-bold text-slate-800 dark:text-slate-200">
                                          Stock: {itemConflict.liveAvailableStock} units
                                        </div>
                                        <div className="text-[10px] text-slate-500">
                                          Rate: {formatCurrency(itemConflict.livePrice || 0)}
                                        </div>
                                      </div>
                                    )}
                                  </td>

                                  {/* Conflict Diagnostics */}
                                  <td className="p-3">
                                    {!itemConflict.hasConflict ? (
                                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                                        <Check size={13} /> Clean Match
                                      </span>
                                    ) : (
                                      <div className="space-y-1">
                                        {itemConflict.conflictNotes.map((note, idx) => (
                                          <div key={idx} className="flex items-start gap-1 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                                            <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                                            <span>{note}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </td>

                                  {/* Resolution Selector */}
                                  <td className="p-3">
                                    <div className="space-y-2">
                                      <select
                                        value={currentDecision.strategy}
                                        onChange={(e) => {
                                          const strat = e.target.value as any;
                                          let deductStock = true;
                                          if (strat === 'skip_stock_deduction') deductStock = false;
                                          handleDecisionChange(sale.id, itemId, {
                                            strategy: strat,
                                            deductStock,
                                          });
                                        }}
                                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
                                      >
                                        <option value="honor_offline">Honor Offline Receipt (Price ₹{itemConflict.offlinePrice})</option>
                                        {itemConflict.livePrice !== undefined && (
                                          <option value="apply_cloud_pricing">Update to Cloud Rate (₹{itemConflict.livePrice})</option>
                                        )}
                                        <option value="skip_stock_deduction">Financial Only (Do Not Deduct Stock)</option>
                                        <option value="custom">Custom Values</option>
                                      </select>

                                      {/* Custom quantity or rate override if selected */}
                                      {currentDecision.strategy === 'custom' && (
                                        <div className="flex items-center gap-2 pt-1">
                                          <div>
                                            <label className="text-[9px] font-bold text-slate-500 block">Qty:</label>
                                            <input
                                              type="number"
                                              min="0"
                                              value={currentDecision.customQuantity ?? itemConflict.offlineQuantity}
                                              onChange={(e) => handleDecisionChange(sale.id, itemId, { customQuantity: Number(e.target.value) })}
                                              className="w-16 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs font-bold bg-white dark:bg-slate-800"
                                            />
                                          </div>
                                          <div>
                                            <label className="text-[9px] font-bold text-slate-500 block">Rate (₹):</label>
                                            <input
                                              type="number"
                                              min="0"
                                              step="0.01"
                                              value={currentDecision.customPrice ?? itemConflict.offlinePrice}
                                              onChange={(e) => handleDecisionChange(sale.id, itemId, { customPrice: Number(e.target.value) })}
                                              className="w-20 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs font-bold bg-white dark:bg-slate-800"
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Resolution Audit Note */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <div className="flex-1">
                          <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                            Auditor / Manager Resolution Note (Logged to Cloud Diff History):
                          </label>
                          <input
                            type="text"
                            placeholder="e.g., Customer honored offline receipt; inventory variance approved by lead pharmacist."
                            value={saleNotes[sale.id] || ''}
                            onChange={(e) => setSaleNotes(prev => ({ ...prev, [sale.id]: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleMergeSingleSale(sale.id)}
                          disabled={isMerging || !isOnline}
                          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-black text-white shadow-sm transition-all cursor-pointer disabled:opacity-50 self-end sm:self-center"
                        >
                          <CheckCircle2 size={14} />
                          <span>Approve & Merge Sale</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <Info size={14} className="text-blue-500 shrink-0" />
            <span>
              All merged transactions are immutably logged with before/after diff states in Firestore Audit Logs.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
            >
              Close Resolver
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SyncConflictResolverModal;
