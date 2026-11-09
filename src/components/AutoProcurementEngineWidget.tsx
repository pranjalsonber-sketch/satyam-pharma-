import React, { useState, useMemo } from 'react';
import {
  Cpu,
  TrendingUp,
  AlertTriangle,
  PackagePlus,
  Truck,
  Download,
  CheckCircle2,
  Sliders,
  Search,
  ArrowUpRight,
  Clock,
  Flame,
  ShieldCheck,
  Plus,
  Minus,
  FileSpreadsheet,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react';
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Medicine, Sale, Wholesaler } from '../types';
import {
  runAutoProcurementEngine,
  AutoProcurementRecommendation,
  SupplierProcurementBundle,
} from '../lib/autoProcurementEngine';
import { cn, formatCurrency } from '../lib/utils';
import { useAuth } from './AuthProvider';
import { isManager } from '../lib/permissions';
import { logStockMovement } from '../lib/stockAuditService';
import { logActivity } from '../lib/logger';
import { roomInsertItem } from '../lib/roomLocalDb';

interface AutoProcurementEngineWidgetProps {
  items: Medicine[];
  salesHistory: Sale[];
  wholesalers?: Wholesaler[];
  onSelectMedicine?: (medicine: Medicine) => void;
  onNavigateToWholesalers?: () => void;
  defaultCollapsed?: boolean;
}

export const AutoProcurementEngineWidget: React.FC<AutoProcurementEngineWidgetProps> = ({
  items,
  salesHistory,
  wholesalers = [],
  onSelectMedicine,
  onNavigateToWholesalers,
  defaultCollapsed = false,
}) => {
  const { profile } = useAuth();
  const isOwnerAuthorized = isManager(profile);

  const [targetCoverageDays, setTargetCoverageDays] = useState<number>(30);
  const [safetyBufferPct, setSafetyBufferPct] = useState<number>(20);
  const [activeTab, setActiveTab] = useState<
    'all' | 'stockout_imminent' | 'below_rop' | 'velocity_surge' | 'suppliers'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // Owner custom quantity overrides keyed by medicineId
  const [qtyOverrides, setQtyOverrides] = useState<Record<string, number>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [approvedIds, setApprovedIds] = useState<Record<string, number>>({});
  const [createdPoSuppliers, setCreatedPoSuppliers] = useState<Record<string, boolean>>({});
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Run the Auto-Procurement Recommendation Engine
  const engineOutput = useMemo(() => {
    return runAutoProcurementEngine(items, salesHistory, wholesalers, {
      targetCoverageDays,
      safetyBufferPct,
    });
  }, [items, salesHistory, wholesalers, targetCoverageDays, safetyBufferPct]);

  // Restrict visibility exclusively to Owners / Managers
  if (!isOwnerAuthorized) {
    return null;
  }

  const getEffectiveOrderQty = (rec: AutoProcurementRecommendation): number => {
    if (qtyOverrides[rec.medicineId] !== undefined) {
      return qtyOverrides[rec.medicineId];
    }
    return rec.suggestedReorderQty;
  };

  const handleAdjustQty = (rec: AutoProcurementRecommendation, deltaPacks: number) => {
    const current = getEffectiveOrderQty(rec);
    const next = Math.max(rec.packSize, current + deltaPacks * rec.packSize);
    setQtyOverrides((prev) => ({
      ...prev,
      [rec.medicineId]: next,
    }));
  };

  // Filter recommendations by active tab & search query
  const filteredRecommendations = engineOutput.flaggedRecommendations.filter((rec) => {
    if (activeTab === 'stockout_imminent' && rec.urgency !== 'stockout_imminent') return false;
    if (activeTab === 'below_rop' && rec.urgency !== 'below_rop') return false;
    if (activeTab === 'velocity_surge' && rec.urgency !== 'velocity_surge') return false;

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return (
        rec.medicineName.toLowerCase().includes(q) ||
        rec.genericName.toLowerCase().includes(q) ||
        rec.supplierName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Execute direct restock approval for a single recommended SKU
  const handleApproveRestock = async (rec: AutoProcurementRecommendation) => {
    const orderQty = getEffectiveOrderQty(rec);
    if (orderQty <= 0 || processingId) return;

    setProcessingId(rec.medicineId);
    setStatusBanner(null);

    try {
      const med = rec.medicine;
      const previousTotalStock = Number(med.stockQuantity) || 0;
      const newTotalStock = previousTotalStock + orderQty;

      const existingBatches =
        Array.isArray(med.batches) && med.batches.length > 0
          ? [...med.batches]
          : [
              {
                id: 'batch-auto-1',
                batchNumber: rec.nearestBatchNumber,
                expiryDate:
                  med.expiryDate ||
                  new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                quantity: previousTotalStock,
                storageCondition: med.storageCondition || 'Room Temp (15-25°C)',
              },
            ];

      const primaryBatch = existingBatches[0];
      const prevBatchQty = Number(primaryBatch.quantity) || 0;
      const newBatchQty = prevBatchQty + orderQty;

      existingBatches[0] = {
        ...primaryBatch,
        quantity: newBatchQty,
      };

      const nowIso = new Date().toISOString();
      const updatedMedicine: Medicine = {
        ...med,
        stockQuantity: newTotalStock,
        batches: existingBatches,
      };

      await updateDoc(doc(db, 'inventory', med.id), {
        stockQuantity: newTotalStock,
        batches: existingBatches,
        updatedAt: nowIso,
      });

      await roomInsertItem(updatedMedicine);

      await logStockMovement({
        medicineId: med.id,
        medicineName: med.name,
        batchNumber: primaryBatch.batchNumber,
        type: 'addition',
        quantity: orderQty,
        previousStock: previousTotalStock,
        newStock: newTotalStock,
        reason: `Auto-Procurement Engine Reorder (${rec.effectiveDailyBurnRate} u/day velocity, ${targetCoverageDays}d coverage)`,
        referenceId: `AUTO-PO-${Date.now().toString().slice(-5)}`,
        userName: profile?.displayName || profile?.email || 'Pharmacy Owner',
        userRole: profile?.role || 'admin',
      });

      await logActivity({
        action: 'Auto-Procurement Reorder Approved',
        description: `Approved +${orderQty} units of ${med.name} via Auto-Procurement Engine (New stock: ${newTotalStock} u)`,
        type: 'inventory',
        module: 'inventory',
        severity: 'success',
      });

      setApprovedIds((prev) => ({ ...prev, [rec.medicineId]: orderQty }));
      setStatusBanner({
        type: 'success',
        message: `Restocked +${orderQty} units of ${rec.medicineName} (Updated stock: ${newTotalStock} units).`,
      });
    } catch (error: any) {
      console.error('Failed to approve auto-procurement restock:', error);
      setStatusBanner({
        type: 'error',
        message: error?.message || 'Could not update inventory stock. Please retry.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  // Generate a pending Purchase Order Bill in Firestore for a Supplier Bundle
  const handleGenerateSupplierPO = async (bundle: SupplierProcurementBundle) => {
    if (processingId) return;
    const bundleKey = `supplier-${bundle.supplierName}`;
    setProcessingId(bundleKey);
    setStatusBanner(null);

    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);

      const poItems = bundle.items.map((item) => {
        const qty = getEffectiveOrderQty(item);
        return {
          medicineId: item.medicineId,
          name: item.medicineName,
          quantity: qty,
          rate: item.estimatedWholesaleUnitCost,
          totalCost: Math.round(qty * item.estimatedWholesaleUnitCost),
          burnRatePerDay: item.effectiveDailyBurnRate,
        };
      });

      const totalAmount = poItems.reduce((sum, i) => sum + i.totalCost, 0);

      await addDoc(collection(db, 'bills'), {
        wholesalerId: bundle.supplierName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        wholesalerName: bundle.supplierName,
        amount: totalAmount,
        dueDate: dueDate.toISOString().split('T')[0],
        status: 'pending',
        uploadedAt: new Date().toISOString(),
        promisedLeadTimeDays: bundle.leadTimeDays,
        fulfillmentStatus: 'pending',
        items: poItems,
        notes: `Generated by Auto-Procurement Engine (${targetCoverageDays}d horizon, ${safetyBufferPct}% safety buffer, ${poItems.length} SKUs)`,
      });

      await logActivity({
        action: 'Auto-Procurement PO Dispatched',
        description: `Generated Purchase Order for ${bundle.supplierName} (${poItems.length} SKUs, ${formatCurrency(totalAmount)})`,
        type: 'wholesaler',
        module: 'wholesalers',
        severity: 'info',
      });

      setCreatedPoSuppliers((prev) => ({ ...prev, [bundle.supplierName]: true }));
      setStatusBanner({
        type: 'success',
        message: `Purchase Order created for ${bundle.supplierName} (${poItems.length} SKUs • ${formatCurrency(totalAmount)}) in Wholesaler Bills.`,
      });
    } catch (error: any) {
      console.error('Error generating supplier PO:', error);
      setStatusBanner({
        type: 'error',
        message: error?.message || 'Failed to generate Purchase Order bill.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  // Export CSV of all current Auto-Procurement recommendations
  const handleExportProcurementCsv = () => {
    const headers = [
      'Medicine Name',
      'Formula / Salt',
      'Category',
      'Supplier',
      'Lead Time (Days)',
      'Current Stock',
      'Min Threshold',
      'Reorder Point (ROP)',
      '7D Velocity (u/day)',
      '30D Velocity (u/day)',
      'Effective Daily Burn (u/day)',
      'Days Supply Left',
      'Suggested Reorder Qty',
      'Est. Unit Cost (INR)',
      'Total Est. Cost (INR)',
      'Projected Gross Profit (INR)',
      'Urgency Status',
    ];

    const rows = engineOutput.flaggedRecommendations.map((rec) => {
      const qty = getEffectiveOrderQty(rec);
      const totalCost = Math.round(qty * rec.estimatedWholesaleUnitCost);
      const totalProfit = Math.max(0, Math.round(qty * rec.retailUnitPrice) - totalCost);
      return [
        `"${rec.medicineName.replace(/"/g, '""')}"`,
        `"${rec.genericName.replace(/"/g, '""')}"`,
        rec.category,
        `"${rec.supplierName.replace(/"/g, '""')}"`,
        rec.supplierLeadTimeDays,
        rec.currentStock,
        rec.minThreshold,
        rec.reorderPointUnits,
        rec.dailyVelocity7d,
        rec.dailyVelocity30d,
        rec.effectiveDailyBurnRate,
        rec.daysOfSupplyRemaining,
        qty,
        rec.estimatedWholesaleUnitCost,
        totalCost,
        totalProfit,
        `"${rec.urgencyLabel}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `auto-procurement-recommendations-${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section
      aria-label="Automated Auto-Procurement Recommendation Engine"
      className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-zinc-900 overflow-hidden"
    >
      {/* Top Command Header */}
      <div className="border-b border-slate-200/80 dark:border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-5 py-4 text-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 shadow-inner">
              <Cpu size={22} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-sm font-black uppercase tracking-wider text-white">
                  Auto-Procurement Recommendation Engine
                </h2>
                <span className="text-[11px] font-mono uppercase tracking-widest text-amber-300 font-semibold">
                  • OWNER EXECUTIVE ACCESS
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 max-w-3xl">
                Analyzes 7D/30D/90D historical sales velocity, supplier lead times, and Reorder Points (<span className="font-mono text-indigo-200">ROP = Burn × LeadTime + SafetyBuffer</span>) to compute optimal pack-rounded reorder quantities.
              </p>
            </div>
          </div>

          {/* Right Controls: Export CSV + Collapse Toggle */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleExportProcurementCsv}
              disabled={engineOutput.flaggedRecommendations.length === 0}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 hover:bg-white/15 disabled:opacity-40 px-3.5 py-2 text-xs font-bold text-white transition-all cursor-pointer"
              title="Download CSV of suggested reorder quantities and supplier breakdown"
            >
              <Download size={14} />
              <span>Export PO Sheet (CSV)</span>
            </button>

            {onNavigateToWholesalers && (
              <button
                type="button"
                onClick={onNavigateToWholesalers}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
              >
                <Truck size={14} />
                <span>Wholesaler Desk</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-bold text-slate-200 transition-colors cursor-pointer"
            >
              {isCollapsed ? (
                <>
                  <span>Expand Engine</span>
                  <ChevronDown size={14} />
                </>
              ) : (
                <>
                  <span>Minimize</span>
                  <ChevronUp size={14} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* 4-Column Executive KPI Strip */}
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-white/10">
          <div className="rounded-xl bg-white/5 border border-white/10 px-3.5 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
              SKUs Flagged for Reorder
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-black font-mono tabular-nums text-white">
                {engineOutput.flaggedRecommendations.length}
              </span>
              <span className="text-xs font-mono text-rose-300">
                ({engineOutput.imminentStockoutCount} ≤ Lead Time)
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 px-3.5 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
              Suggested Reorder Volume
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-black font-mono tabular-nums text-indigo-300">
                {engineOutput.totalUnitsToProcure.toLocaleString()}
              </span>
              <span className="text-xs text-slate-300">
                units across {engineOutput.supplierBundles.length} suppliers
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 px-3.5 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
              Est. Wholesale Capital
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-black font-mono tabular-nums text-amber-300">
                {formatCurrency(engineOutput.totalEstimatedCapitalRequired)}
              </span>
              <span className="text-xs text-slate-300">
                for {targetCoverageDays}d stock cycle
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 px-3.5 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
              Projected Gross Margin
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-black font-mono tabular-nums text-emerald-300">
                +{formatCurrency(engineOutput.totalProjectedGrossProfit)}
              </span>
              <span className="text-xs text-slate-300">
                on {formatCurrency(engineOutput.totalProjectedGrossRevenue)} MRP
              </span>
            </div>
          </div>
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-5 space-y-5">
          {/* Status Notification Banner */}
          {statusBanner && (
            <div
              className={cn(
                'flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-bold',
                statusBanner.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200'
              )}
            >
              <div className="flex items-center gap-2">
                {statusBanner.type === 'success' ? (
                  <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
                )}
                <span>{statusBanner.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusBanner(null)}
                className="text-[11px] underline hover:no-underline cursor-pointer shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Engine Parameters & Filter Toolbar */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-zinc-950/50 p-3.5">
            {/* Left: Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer',
                  activeTab === 'all'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-zinc-800'
                )}
              >
                All Flagged ({engineOutput.flaggedRecommendations.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('stockout_imminent')}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer',
                  activeTab === 'stockout_imminent'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40'
                )}
              >
                Stockout ≤ Lead Time ({engineOutput.imminentStockoutCount})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('below_rop')}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer',
                  activeTab === 'below_rop'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40'
                )}
              >
                Below ROP ({engineOutput.belowRopCount})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('velocity_surge')}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer',
                  activeTab === 'velocity_surge'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40'
                )}
              >
                Velocity Surge ({engineOutput.velocitySurgeCount})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('suppliers')}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5',
                  activeTab === 'suppliers'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40'
                )}
              >
                <Truck size={13} />
                <span>Supplier PO Bundles ({engineOutput.supplierBundles.length})</span>
              </button>
            </div>

            {/* Right: Horizon & Buffer Parameters + Search */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Target Coverage Horizon */}
              <div className="flex items-center gap-1.5 text-xs">
                <Sliders size={13} className="text-slate-400" />
                <span className="font-semibold text-slate-600 dark:text-slate-400">
                  Target Cycle:
                </span>
                <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-zinc-900 p-0.5">
                  {[15, 30, 45, 60].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setTargetCoverageDays(days)}
                      className={cn(
                        'rounded-md px-2 py-0.5 text-[11px] font-mono font-bold transition-colors cursor-pointer',
                        targetCoverageDays === days
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      )}
                    >
                      {days}d
                    </button>
                  ))}
                </div>
              </div>

              {/* Safety Stock Buffer */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-semibold text-slate-600 dark:text-slate-400">
                  Safety Buffer:
                </span>
                <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-zinc-900 p-0.5">
                  {[10, 20, 30].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setSafetyBufferPct(pct)}
                      className={cn(
                        'rounded-md px-2 py-0.5 text-[11px] font-mono font-bold transition-colors cursor-pointer',
                        safetyBufferPct === pct
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      )}
                    >
                      +{pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Input */}
              {activeTab !== 'suppliers' && (
                <div className="relative min-w-[200px]">
                  <Search
                    size={13}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter SKU or supplier..."
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-zinc-900 pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* View 1: Supplier Purchase Order Bundles */}
          {activeTab === 'suppliers' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {engineOutput.supplierBundles.map((bundle) => {
                const isPoCreated = createdPoSuppliers[bundle.supplierName];
                const isBusy = processingId === `supplier-${bundle.supplierName}`;

                return (
                  <div
                    key={bundle.supplierName}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-zinc-950/40 p-4 flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                              {bundle.supplierName}
                            </h3>
                            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              • Lead Time: {bundle.leadTimeDays}d
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Contact: {bundle.supplierContact} • {bundle.totalSkus} SKUs flagged
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Est. PO Value
                          </span>
                          <p className="text-base font-black font-mono tabular-nums text-slate-900 dark:text-white">
                            {formatCurrency(bundle.totalEstimatedCost)}
                          </p>
                        </div>
                      </div>

                      {/* Mini table of items in this supplier bundle */}
                      <div className="mt-3 divide-y divide-slate-200/60 dark:divide-slate-800/80 border-t border-b border-slate-200/70 dark:border-slate-800 max-h-48 overflow-y-auto">
                        {bundle.items.map((item) => {
                          const qty = getEffectiveOrderQty(item);
                          return (
                            <div
                              key={item.medicineId}
                              className="py-2 flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="min-w-0">
                                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                                  {item.medicineName}
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  Stock: {item.currentStock} u • Burn: {item.effectiveDailyBurnRate} u/d
                                </span>
                              </div>
                              <div className="text-right font-mono shrink-0">
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                  +{qty} u
                                </span>
                                <span className="block text-[11px] text-slate-500">
                                  {formatCurrency(Math.round(qty * item.estimatedWholesaleUnitCost))}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Total Units:{' '}
                        <strong className="font-mono text-slate-800 dark:text-slate-200">
                          {bundle.totalUnitsToOrder} u
                        </strong>{' '}
                        • Est. Margin:{' '}
                        <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                          +{formatCurrency(bundle.totalProjectedProfit)}
                        </strong>
                      </div>

                      {isPoCreated ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 size={14} />
                          <span>PO Recorded in Bills</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleGenerateSupplierPO(bundle)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white px-3.5 py-2 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                        >
                          <FileSpreadsheet size={13} />
                          <span>{isBusy ? 'Generating PO...' : 'Generate Supplier PO'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* View 2: Detailed SKU Velocity & Reorder Recommendation Table */
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              {filteredRecommendations.length === 0 ? (
                <div className="py-12 text-center">
                  <ShieldCheck size={32} className="mx-auto text-emerald-500 mb-2" />
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    All Stock Levels Satisfy Reorder Point Thresholds
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    No medicines match the selected urgency filter for the {targetCoverageDays}-day coverage horizon.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-zinc-950/60 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="py-3 px-4">Medicine & Supplier Lead Time</th>
                      <th className="py-3 px-3">Historical Velocity (7D / 30D)</th>
                      <th className="py-3 px-3">Stock vs Reorder Point (ROP)</th>
                      <th className="py-3 px-3 text-right">Suggested Reorder Qty</th>
                      <th className="py-3 px-3 text-right">Est. Cost & Profit</th>
                      <th className="py-3 px-4 text-right">Owner Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70 text-xs">
                    {filteredRecommendations.slice(0, 12).map((rec) => {
                      const effectiveQty = getEffectiveOrderQty(rec);
                      const dynamicCost = Math.round(
                        effectiveQty * rec.estimatedWholesaleUnitCost
                      );
                      const dynamicProfit = Math.max(
                        0,
                        Math.round(effectiveQty * rec.retailUnitPrice) - dynamicCost
                      );
                      const approvedQty = approvedIds[rec.medicineId];
                      const isProcessing = processingId === rec.medicineId;

                      // Progress bar ratio: currentStock vs targetStockUnits
                      const stockFillPct = Math.min(
                        100,
                        Math.round((rec.currentStock / Math.max(1, rec.targetStockUnits)) * 100)
                      );
                      const ropMarkerPct = Math.min(
                        95,
                        Math.round((rec.reorderPointUnits / Math.max(1, rec.targetStockUnits)) * 100)
                      );

                      return (
                        <tr
                          key={rec.medicineId}
                          className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                        >
                          {/* Column 1: Medicine & Supplier */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="flex items-start gap-2.5">
                              <span
                                className={cn(
                                  'mt-1 h-2 w-2 rounded-full shrink-0',
                                  rec.urgency === 'stockout_imminent'
                                    ? 'bg-rose-500 animate-pulse'
                                    : rec.urgency === 'below_rop'
                                    ? 'bg-amber-500'
                                    : 'bg-indigo-500'
                                )}
                              />
                              <div>
                                <button
                                  type="button"
                                  onClick={() => onSelectMedicine && onSelectMedicine(rec.medicine)}
                                  className="font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 text-left cursor-pointer"
                                >
                                  {rec.medicineName}
                                </button>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                                  {rec.genericName}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                  <span>{rec.supplierName}</span>
                                  <span>•</span>
                                  <span>Lead: {rec.supplierLeadTimeDays}d</span>
                                  <span>•</span>
                                  <span
                                    className={cn(
                                      'font-bold uppercase',
                                      rec.urgency === 'stockout_imminent'
                                        ? 'text-rose-600 dark:text-rose-400'
                                        : rec.urgency === 'below_rop'
                                        ? 'text-amber-600 dark:text-amber-400'
                                        : 'text-indigo-600 dark:text-indigo-400'
                                    )}
                                  >
                                    {rec.urgencyLabel}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Column 2: Historical Sales Velocity */}
                          <td className="py-3.5 px-3 align-top font-mono tabular-nums">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-sm font-black text-slate-900 dark:text-slate-100">
                                {rec.effectiveDailyBurnRate.toFixed(1)}
                              </span>
                              <span className="text-[11px] text-slate-500">u/day burn</span>
                              {rec.velocityTrendPct !== 0 && (
                                <span
                                  className={cn(
                                    'text-[11px] font-bold',
                                    rec.velocityTrendPct > 0
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : 'text-emerald-600 dark:text-emerald-400'
                                  )}
                                >
                                  {rec.velocityTrendPct > 0 ? `+${rec.velocityTrendPct}%` : `${rec.velocityTrendPct}%`}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                              7D: {rec.unitsSold7d}u ({rec.dailyVelocity7d}u/d) • 30D: {rec.unitsSold30d}u
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-slate-500">
                              30D Demand Forecast: ~{rec.monthlyProjectedDemand} units
                            </div>
                          </td>

                          {/* Column 3: Stock vs Reorder Point (ROP) Progress Bar */}
                          <td className="py-3.5 px-3 align-top min-w-[200px]">
                            <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                Stock: {rec.currentStock} u
                              </span>
                              <span
                                className={cn(
                                  'font-bold',
                                  rec.daysOfSupplyRemaining <= rec.supplierLeadTimeDays
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-amber-600 dark:text-amber-400'
                                )}
                              >
                                {rec.daysOfSupplyRemaining}d supply left
                              </span>
                            </div>

                            {/* Visual Progress Bar with ROP Marker */}
                            <div className="relative mt-1.5 h-2 w-full rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all duration-300',
                                  rec.urgency === 'stockout_imminent'
                                    ? 'bg-rose-500'
                                    : rec.urgency === 'below_rop'
                                    ? 'bg-amber-500'
                                    : 'bg-indigo-500'
                                )}
                                style={{ width: `${stockFillPct}%` }}
                              />
                              {/* Vertical Reorder Point (ROP) threshold line */}
                              <div
                                className="absolute top-0 bottom-0 w-0.5 bg-slate-900 dark:bg-white"
                                style={{ left: `${ropMarkerPct}%` }}
                                title={`Reorder Point (ROP): ${rec.reorderPointUnits} units`}
                              />
                            </div>

                            <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
                              <span>ROP: {rec.reorderPointUnits} u</span>
                              <span>Target ({targetCoverageDays}d): {rec.targetStockUnits} u</span>
                            </div>
                          </td>

                          {/* Column 4: Editable Suggested Reorder Quantity */}
                          <td className="py-3.5 px-3 align-top text-right font-mono tabular-nums">
                            <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-zinc-900 p-0.5">
                              <button
                                type="button"
                                onClick={() => handleAdjustQty(rec, -1)}
                                className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                                title={`Decrease by ${rec.packSize} units`}
                              >
                                <Minus size={12} />
                              </button>
                              <span className="px-2 text-sm font-black text-indigo-600 dark:text-indigo-400">
                                +{effectiveQty}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAdjustQty(rec, 1)}
                                className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                                title={`Increase by ${rec.packSize} units`}
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                            <div className="mt-1 text-[10px] text-slate-500">
                              Pack multiple of {rec.packSize} u (Safety: +{rec.safetyStockUnits} u)
                            </div>
                          </td>

                          {/* Column 5: Financials */}
                          <td className="py-3.5 px-3 align-top text-right font-mono tabular-nums">
                            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                              {formatCurrency(dynamicCost)}
                            </div>
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                              +{formatCurrency(dynamicProfit)} est. profit
                            </div>
                            <div className="text-[10px] text-slate-400">
                              @ ₹{rec.estimatedWholesaleUnitCost}/u wholesale
                            </div>
                          </td>

                          {/* Column 6: Action */}
                          <td className="py-3.5 px-4 align-top text-right">
                            {approvedQty ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 size={14} />
                                <span>Restocked +{approvedQty}u</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleApproveRestock(rec)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-1.5 text-xs font-bold shadow-2xs transition-all cursor-pointer active:scale-95"
                              >
                                <PackagePlus size={13} />
                                <span>{isProcessing ? 'Updating...' : 'Approve & Restock'}</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
