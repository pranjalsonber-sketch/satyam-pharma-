import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  BrainCircuit, 
  TrendingUp, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  Download, 
  FileDown, 
  RefreshCw, 
  Truck, 
  ShoppingBag, 
  Layers, 
  Package, 
  ArrowRight, 
  Search, 
  Filter, 
  Sliders, 
  ShieldAlert, 
  Plus, 
  Minus, 
  ExternalLink,
  ChevronRight,
  Info,
  Building2,
  Zap,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Medicine, Sale, SmartProcurementItem, SmartProcurementAnalysis, ProcurementUrgency } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { formatCurrency, cn, formatDate } from '../lib/utils';
import { logActivity } from '../lib/logger';
import { logStockMovement } from '../lib/stockAuditService';

interface SmartProcurementModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: Medicine[];
  salesHistory: Sale[];
  onOpenBatchModal?: (medicine: Medicine) => void;
  onNavigateToWholesalers?: (wholesalerName?: string) => void;
  onRefreshInventory?: () => void;
}

export const SmartProcurementModal: React.FC<SmartProcurementModalProps> = ({
  isOpen,
  onClose,
  inventory,
  salesHistory,
  onOpenBatchModal,
  onNavigateToWholesalers,
  onRefreshInventory
}) => {
  const { t, tText } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SmartProcurementAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Configuration sliders & toggles
  const [seasonOverride, setSeasonOverride] = useState<'auto' | 'monsoon' | 'winter' | 'summer'>('auto');
  const [safetyStockDays, setSafetyStockDays] = useState<number>(14);
  const [leadTimeDays, setLeadTimeDays] = useState<number>(3);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | ProcurementUrgency>('all');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

  // Customized quantities adjusted by user steppers
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});

  // Fetch or re-run analysis
  const runSmartProcurementAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/inventory/smart-procurement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: inventory,
          sales: salesHistory,
          seasonOverride,
          safetyStockDays,
          vendorLeadTimeDays: leadTimeDays
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const result: SmartProcurementAnalysis = await response.json();
      setData(result);
      
      // Initialize selected items to critical & high urgency items
      const urgentIds = (result.recommendations || [])
        .filter(r => r.urgency === 'immediate' || r.urgency === 'high')
        .map(r => r.medicineId);
      setSelectedItemIds(urgentIds.length > 0 ? urgentIds : (result.recommendations || []).slice(0, 5).map(r => r.medicineId));

      // Reset custom quantities
      const initialCustom: Record<string, number> = {};
      (result.recommendations || []).forEach(r => {
        initialCustom[r.medicineId] = r.suggestedReorderQty;
      });
      setCustomQuantities(initialCustom);
    } catch (err: any) {
      console.error('Smart procurement fetch error:', err);
      setError(err?.message || 'Failed to complete smart procurement analysis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runSmartProcurementAnalysis();
    }
  }, [isOpen, seasonOverride, safetyStockDays, leadTimeDays]);

  // Stepper handlers for fine-tuning
  const handleQtyChange = (medicineId: string, delta: number) => {
    setCustomQuantities(prev => {
      const current = prev[medicineId] || 10;
      const updated = Math.max(5, current + delta);
      return { ...prev, [medicineId]: updated };
    });
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItemIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (!data) return;
    if (selectedItemIds.length === filteredItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(filteredItems.map(i => i.medicineId));
    }
  };

  // Filter recommendations
  const filteredItems = useMemo(() => {
    if (!data?.recommendations) return [];
    return data.recommendations.filter(item => {
      const matchesSearch = 
        item.medicineName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.genericName && item.genericName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        item.preferredSupplier.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesUrgency = urgencyFilter === 'all' || item.urgency === urgencyFilter;

      return matchesSearch && matchesUrgency;
    });
  }, [data, searchQuery, urgencyFilter]);

  // Totals for selected items
  const selectedMetrics = useMemo(() => {
    if (!data?.recommendations) return { count: 0, units: 0, cost: 0 };
    const selected = data.recommendations.filter(r => selectedItemIds.includes(r.medicineId));
    const units = selected.reduce((sum, r) => sum + (customQuantities[r.medicineId] || r.suggestedReorderQty), 0);
    const cost = selected.reduce((sum, r) => {
      const qty = customQuantities[r.medicineId] || r.suggestedReorderQty;
      return sum + Math.round(qty * r.wholesaleRate);
    }, 0);
    return { count: selected.length, units, cost };
  }, [data, selectedItemIds, customQuantities]);

  // Quick Restock Selected Items into Inventory
  const handleQuickRestockSelected = async () => {
    if (selectedItemIds.length === 0 || !data) return;
    try {
      setLoading(true);
      const selected = data.recommendations.filter(r => selectedItemIds.includes(r.medicineId));
      
      const timestamp = new Date().toISOString();
      const todayDate = timestamp.split('T')[0];

      // Create draft bill / procurement order in Firestore bills collection
      const billData = {
        wholesalerId: 'smart-procurement-batch',
        wholesalerName: selected[0]?.preferredSupplier || 'Consolidated Wholesalers',
        amount: selectedMetrics.cost,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pending',
        uploadedAt: timestamp,
        notes: `Smart Procurement Order for ${selected.length} items (${data.summary.dominantSeasonName})`,
        items: selected.map(item => ({
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          quantity: customQuantities[item.medicineId] || item.suggestedReorderQty,
          rate: item.wholesaleRate,
          total: (customQuantities[item.medicineId] || item.suggestedReorderQty) * item.wholesaleRate,
          supplier: item.preferredSupplier
        }))
      };

      await addDoc(collection(db, 'bills'), billData);

      logActivity(
        'Smart Procurement Order Generated',
        `Requisition created for ${selected.length} medicines totaling ₹${selectedMetrics.cost.toLocaleString('en-IN')}`,
        'inventory'
      );

      setActionSuccessNotice(`Created Draft Procurement Order for ${selected.length} items (₹${selectedMetrics.cost.toLocaleString('en-IN')}) in Wholesalers bills.`);
      setTimeout(() => setActionSuccessNotice(null), 6000);
    } catch (e: any) {
      console.error('Procurement order dispatch failed:', e);
      setError('Failed to create procurement order: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Export to PDF Requisition
  const exportToPDF = () => {
    if (!data) return;
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

      // Header Banner
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 32, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text("SATYAM MEDICAL ERP - SMART PROCUREMENT REQUISITION", 14, 14);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(203, 213, 225);
      doc.text(`AI-Driven Sales Velocity & Seasonal Trend Analysis | Season: ${data.summary.dominantSeasonName}`, 14, 21);
      doc.text(`Generated: ${today} | Engine: ${data.engine} | Safety Buffer: ${safetyStockDays} Days`, 14, 27);

      // Summary Stats
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text("EXECUTIVE PROCUREMENT SUMMARY", 14, 40);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`• Total Low-Stock Medicines: ${data.summary.lowStockCount} SKUs`, 14, 46);
      doc.text(`• Critical Immediate Reorders: ${data.summary.criticalUrgencyCount} SKUs`, 14, 51);
      doc.text(`• Recommended Refill Volume: ${data.summary.totalRecommendedUnits.toLocaleString('en-IN')} units`, 110, 46);
      doc.text(`• Estimated Procurement Outlay: Rs. ${data.summary.totalEstimatedProcurementCost.toLocaleString('en-IN')}`, 110, 51);

      // Table
      const tableData = filteredItems.map((item, idx) => {
        const qty = customQuantities[item.medicineId] || item.suggestedReorderQty;
        const total = Math.round(qty * item.wholesaleRate);
        return [
          idx + 1,
          item.medicineName,
          `${item.currentStock} / ${item.minThreshold}`,
          `${item.salesVelocityDaily}/d (${item.velocityClass})`,
          `${item.seasonalFactor}x (${item.seasonalTrendName})`,
          qty,
          item.suggestedReorderTiming.split('•')[0].trim(),
          item.preferredSupplier,
          `Rs. ${total.toLocaleString('en-IN')}`
        ];
      });

      autoTable(doc, {
        head: [['#', 'Medicine', 'Stock/Min', 'Velocity', 'Seasonal Factor', 'Order Qty', 'Suggested Timing', 'Distributor', 'Wholesale Cost']],
        body: tableData,
        startY: 57,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          1: { cellWidth: 35 },
          7: { cellWidth: 30 }
        }
      });

      // Signature section
      const finalY = (doc as any).lastAutoTable?.finalY || 240;
      if (finalY < 260) {
        doc.setFontSize(8);
        doc.text("Prepared By: Clinical Pharmacist", 14, finalY + 18);
        doc.text("Approved By: Pharmacy Store Manager", 130, finalY + 18);
      }

      doc.save(`Smart_Procurement_Plan_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (pdfErr) {
      console.error('PDF export error:', pdfErr);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    if (!data) return;
    const headers = [
      'Medicine Name',
      'Generic Name',
      'Current Stock',
      'Min Threshold',
      'Daily Sales Velocity',
      'Weekly Sales Velocity',
      'Velocity Class',
      'Seasonal Factor',
      'Seasonal Trend Name',
      'Recommended Order Qty',
      'Recommended Timing',
      'Urgency',
      'Preferred Supplier',
      'Lead Time Days',
      'Wholesale Rate',
      'Estimated Cost'
    ];

    const rows = filteredItems.map(item => {
      const qty = customQuantities[item.medicineId] || item.suggestedReorderQty;
      const cost = Math.round(qty * item.wholesaleRate);
      return [
        `"${item.medicineName}"`,
        `"${item.genericName || ''}"`,
        item.currentStock,
        item.minThreshold,
        item.salesVelocityDaily,
        item.salesVelocityWeekly,
        item.velocityClass,
        item.seasonalFactor,
        `"${item.seasonalTrendName}"`,
        qty,
        `"${item.suggestedReorderTiming}"`,
        item.urgency,
        `"${item.preferredSupplier}"`,
        item.supplierLeadTimeDays,
        item.wholesaleRate,
        cost
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Smart_Procurement_Plan_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-6xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden"
      >
        {/* Header Ribbon */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 shadow-inner">
              <BrainCircuit size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-black uppercase tracking-wider text-white">
                  Smart Procurement Intelligence
                </h1>
                <span className="rounded-full bg-indigo-500/30 border border-indigo-400/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-indigo-200">
                  AI Velocity & Seasonal Engine
                </span>
                {data?.engine && (
                  <span className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                    {data.engine}
                  </span>
                )}
              </div>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                Analyzes actual daily sales run-rate, prescription velocity, and seasonal epidemiological patterns to prescribe optimal batch size and order timing.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={runSmartProcurementAnalysis}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-2 text-xs font-bold text-white transition-all cursor-pointer disabled:opacity-50"
              title="Re-run AI model with updated sales velocity"
            >
              <RefreshCw size={14} className={cn(loading && "animate-spin")} />
              <span>Refresh AI</span>
            </button>
            <button
              type="button"
              onClick={exportToPDF}
              disabled={!data || loading}
              className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-2 text-xs font-bold text-white transition-all cursor-pointer disabled:opacity-50"
              title="Download procurement requisition PDF"
            >
              <Download size={14} />
              <span>PDF Requisition</span>
            </button>
            <button
              type="button"
              onClick={exportToCSV}
              disabled={!data || loading}
              className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-2 text-xs font-bold text-white transition-all cursor-pointer disabled:opacity-50"
              title="Export CSV spreadsheet"
            >
              <FileDown size={14} />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Action success alert banner */}
        <AnimatePresence>
          {actionSuccessNotice && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-emerald-600 text-white px-6 py-2.5 text-xs font-bold flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>{actionSuccessNotice}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setActionSuccessNotice(null)}
                className="hover:text-emerald-200 text-white font-black"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Controls Bar: Season Override, Buffer Days, Lead Time */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 p-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  <Sliders size={14} />
                  <span>Procurement Model Controls:</span>
                </div>

                {/* Season selector */}
                <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 px-2 uppercase">Season:</span>
                  {(['auto', 'monsoon', 'winter', 'summer'] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSeasonOverride(s)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                        seasonOverride === s
                          ? "bg-indigo-600 text-white shadow-2xs"
                          : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                      )}
                    >
                      {s === 'auto' ? 'Auto (Current)' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Safety Buffer Slider */}
                <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Safety Buffer:</span>
                  <div className="flex items-center gap-1">
                    {[7, 14, 21, 30].map(days => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setSafetyStockDays(days)}
                        className={cn(
                          "px-2 py-0.5 rounded text-[11px] font-black transition-all cursor-pointer",
                          safetyStockDays === days
                            ? "bg-slate-900 text-white dark:bg-indigo-600"
                            : "text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
                        )}
                      >
                        {days}d
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lead Time Selector */}
                <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs shadow-2xs">
                  <Truck size={13} className="text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Vendor Lead Time:</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 5].map(lt => (
                      <button
                        key={lt}
                        type="button"
                        onClick={() => setLeadTimeDays(lt)}
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer",
                          leadTimeDays === lt
                            ? "bg-blue-600 text-white"
                            : "text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
                        )}
                      >
                        {lt}d
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Status info */}
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-zinc-400">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Live Active Season: <strong className="text-slate-800 dark:text-zinc-200">{data?.summary.dominantSeasonName || 'Computing...'}</strong></span>
              </div>
            </div>
          </div>

          {/* KPI Ribbon */}
          {data && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Low Stock SKUs</span>
                  <AlertTriangle size={15} className="text-amber-500" />
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">{data.summary.lowStockCount}</span>
                  <span className="text-xs text-slate-400">items</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Need restock attention</p>
              </div>

              <div className="rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-950/20 p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">Urgent (&lt;48h)</span>
                  <Clock size={15} className="text-rose-600" />
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-rose-600 dark:text-rose-400">{data.summary.criticalUrgencyCount}</span>
                  <span className="text-xs text-rose-700 font-bold">Lines</span>
                </div>
                <p className="text-[10px] text-rose-600/80 mt-0.5">Stockout imminent</p>
              </div>

              <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">Refill Volume</span>
                  <Package size={15} className="text-indigo-600" />
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                    {data.summary.totalRecommendedUnits.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs text-indigo-700 font-bold">Units</span>
                </div>
                <p className="text-[10px] text-indigo-600/80 mt-0.5">Consolidated pack volume</p>
              </div>

              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Procurement Outlay</span>
                  <span className="text-xs font-black text-emerald-600">₹</span>
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    ₹{data.summary.totalEstimatedProcurementCost.toLocaleString('en-IN')}
                  </span>
                </div>
                <p className="text-[10px] text-emerald-600/80 mt-0.5">Wholesale cost estimate</p>
              </div>

              <div className="rounded-2xl border border-purple-200 dark:border-purple-900/40 bg-purple-50/50 dark:bg-purple-950/20 p-4 shadow-2xs col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300">Seasonal Risk</span>
                  <Sparkles size={15} className="text-purple-600" />
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className={cn(
                    "text-xl font-black uppercase",
                    data.summary.seasonalRiskIndex === 'critical' ? "text-rose-600" :
                    data.summary.seasonalRiskIndex === 'high' ? "text-amber-600" : "text-purple-600"
                  )}>
                    {data.summary.seasonalRiskIndex}
                  </span>
                </div>
                <p className="text-[10px] text-purple-600/80 mt-0.5">Surge demand index</p>
              </div>
            </div>
          )}

          {/* Executive Strategy Synthesis Card */}
          {data && (
            <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/50 bg-gradient-to-r from-indigo-50/80 via-white to-blue-50/50 dark:from-indigo-950/30 dark:via-zinc-900 dark:to-zinc-900 p-4.5 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                  <BrainCircuit size={18} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
                      AI Executive Procurement Directive
                    </span>
                    <span className="rounded-full bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 text-[9px] font-black text-indigo-800 dark:text-indigo-300">
                      Season: {data.summary.dominantSeasonName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-zinc-300 mt-1 leading-relaxed">
                    {data.summary.executiveStrategySummary}
                  </p>

                  {/* Seasonal tags */}
                  {data.seasonalTrendsIdentified && data.seasonalTrendsIdentified.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-indigo-100 dark:border-zinc-800">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Surge Focus:</span>
                      {data.seasonalTrendsIdentified[0].impactCategories.map((cat, i) => (
                        <span key={i} className="rounded-md bg-white dark:bg-zinc-800 border border-indigo-200 dark:border-zinc-700 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 shadow-2xs">
                          {cat} (+{data.seasonalTrendsIdentified[0].suggestedBufferPercentage}%)
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Search, Filters, and Bulk Select Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative flex-1 min-w-[220px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by medicine, generic salt, or preferred wholesaler..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Urgency Filter */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl text-xs">
                {(['all', 'immediate', 'high', 'moderate', 'planned'] as const).map(u => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUrgencyFilter(u)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer capitalize",
                      urgencyFilter === u
                        ? (u === 'immediate' ? "bg-rose-600 text-white shadow-2xs" :
                           u === 'high' ? "bg-amber-600 text-white shadow-2xs" :
                           "bg-indigo-600 text-white shadow-2xs")
                        : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 transition-all cursor-pointer"
              >
                {selectedItemIds.length === filteredItems.length && filteredItems.length > 0 ? 'Deselect All' : `Select All (${filteredItems.length})`}
              </button>
            </div>
          </div>

          {/* Medicines Reorder Table */}
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-800 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  <tr>
                    <th className="w-10 px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedItemIds.length > 0 && selectedItemIds.length === filteredItems.length}
                        onChange={toggleSelectAll}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-3">Medicine & Details</th>
                    <th className="px-4 py-3">Stock / Min</th>
                    <th className="px-4 py-3">Sales Velocity</th>
                    <th className="px-4 py-3">Seasonal Factor</th>
                    <th className="px-4 py-3 text-center">Suggested Batch Qty</th>
                    <th className="px-4 py-3">Reorder Timing</th>
                    <th className="px-4 py-3">Distributor & Lead Time</th>
                    <th className="px-4 py-3 text-right">Wholesale Cost</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {loading && (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <RefreshCw size={24} className="animate-spin text-indigo-500" />
                          <span className="text-xs font-bold">Synthesizing Sales Velocity & Seasonal Patterns...</span>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loading && filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <CheckCircle2 size={24} className="text-emerald-500" />
                          <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">No low stock items matching criteria</span>
                          <span className="text-[11px] text-slate-400">All medicines in this filter have healthy stock cushions.</span>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loading && filteredItems.map((item) => {
                    const isSelected = selectedItemIds.includes(item.medicineId);
                    const qty = customQuantities[item.medicineId] || item.suggestedReorderQty;
                    const wholesaleTotal = Math.round(qty * item.wholesaleRate);
                    const isOutOfStock = item.currentStock <= 0;

                    return (
                      <tr 
                        key={item.medicineId}
                        className={cn(
                          "hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors",
                          isSelected && "bg-indigo-50/40 dark:bg-indigo-950/20"
                        )}
                      >
                        <td className="px-4 py-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectItem(item.medicineId)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{item.medicineName}</span>
                            <span className="rounded bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.2 text-[9px] font-bold text-slate-600 dark:text-zinc-400 uppercase">
                              {item.type}
                            </span>
                          </div>
                          {item.genericName && (
                            <div className="text-[10px] text-slate-400 dark:text-zinc-500 truncate max-w-[200px]">
                              {item.genericName}
                            </div>
                          )}
                          {/* AI Rationale Snippet */}
                          <div className="mt-1 text-[10px] text-slate-500 dark:text-zinc-400 italic line-clamp-1 max-w-[240px]">
                            {item.aiClinicalRationale}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              "font-black text-xs",
                              isOutOfStock ? "text-rose-600" : (item.currentStock <= item.minThreshold ? "text-amber-600" : "text-slate-700 dark:text-zinc-300")
                            )}>
                              {item.currentStock}
                            </span>
                            <span className="text-slate-400">/</span>
                            <span className="text-slate-500 font-semibold">{item.minThreshold} min</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {item.daysOfInventoryRemaining === 0 ? '0 days remaining' : `~${item.daysOfInventoryRemaining} days left`}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-slate-800 dark:text-zinc-200">
                              {item.salesVelocityDaily} <span className="text-[10px] font-normal text-slate-400">units/d</span>
                            </span>
                            <span className={cn(
                              "rounded px-1.5 py-0.2 text-[9px] font-black uppercase",
                              item.velocityClass === 'fast-moving' ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" :
                              item.velocityClass === 'accelerating' ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300" :
                              "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
                            )}>
                              {item.velocityClass}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {item.historical30dSold} sold in 30d
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-purple-700 dark:text-purple-300">
                              {item.seasonalFactor}x
                            </span>
                            <span className="rounded-md bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 px-1.5 py-0.5 text-[9px] font-bold text-purple-800 dark:text-purple-200">
                              {item.seasonalTrendName.split(' ')[0]}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[130px]">
                            {item.seasonalDiseaseContext}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-center">
                          <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl border border-slate-200 dark:border-zinc-700">
                            <button
                              type="button"
                              onClick={() => handleQtyChange(item.medicineId, -5)}
                              className="h-6 w-6 flex items-center justify-center rounded-lg bg-white dark:bg-zinc-700 hover:bg-slate-200 text-slate-700 dark:text-white transition-all cursor-pointer shadow-2xs font-bold"
                              title="Decrease quantity by 5"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="w-10 text-center font-black text-sm text-indigo-700 dark:text-indigo-300">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleQtyChange(item.medicineId, 5)}
                              className="h-6 w-6 flex items-center justify-center rounded-lg bg-white dark:bg-zinc-700 hover:bg-slate-200 text-slate-700 dark:text-white transition-all cursor-pointer shadow-2xs font-bold"
                              title="Increase quantity by 5"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-tight",
                              item.urgency === 'immediate' ? "bg-rose-600 text-white shadow-2xs animate-pulse" :
                              item.urgency === 'high' ? "bg-amber-500 text-slate-950 font-black" :
                              item.urgency === 'moderate' ? "bg-indigo-100 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300" :
                              "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
                            )}>
                              {item.urgency === 'immediate' && <Clock size={10} />}
                              <span>{item.urgency}</span>
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 font-semibold">
                            {item.suggestedReorderTiming}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1">
                            <Building2 size={12} className="text-slate-400" />
                            <span className="truncate max-w-[140px]">{item.preferredSupplier}</span>
                          </div>
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-semibold flex items-center gap-1">
                            <Truck size={10} />
                            <span>{item.supplierLeadTimeDays}-day delivery lead time</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-right">
                          <div className="font-black text-slate-900 dark:text-white text-xs">
                            ₹{wholesaleTotal.toLocaleString('en-IN')}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            @ ₹{item.wholesaleRate}/unit
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {onOpenBatchModal && (
                              <button
                                type="button"
                                onClick={() => {
                                  const original = inventory.find(m => m.id === item.medicineId);
                                  if (original) {
                                    onOpenBatchModal(original);
                                  }
                                }}
                                className="rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 px-2 py-1 text-[10px] font-black uppercase transition-all cursor-pointer"
                                title="Add stock batch directly"
                              >
                                Batch
                              </button>
                            )}
                            {onNavigateToWholesalers && (
                              <button
                                type="button"
                                onClick={() => {
                                  onNavigateToWholesalers(item.preferredSupplier);
                                  onClose();
                                }}
                                className="rounded-lg border border-slate-200 dark:border-zinc-700 px-2 py-1 text-[10px] font-bold text-slate-600 dark:text-zinc-400 hover:text-slate-900 transition-all cursor-pointer"
                                title="Open in Wholesalers module"
                              >
                                PO
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Ribbon with Execution Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-black text-xs shadow-2xs">
              {selectedMetrics.count}
            </div>
            <div>
              <div className="text-xs font-black text-slate-900 dark:text-white">
                {selectedMetrics.count} Items Selected for Procurement
              </div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                Total Volume: <strong className="text-slate-800 dark:text-zinc-200">{selectedMetrics.units.toLocaleString('en-IN')} units</strong> • Outlay: <strong className="text-emerald-600 dark:text-emerald-400">₹{selectedMetrics.cost.toLocaleString('en-IN')}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 dark:border-zinc-700 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleQuickRestockSelected}
              disabled={selectedMetrics.count === 0 || loading}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 text-white px-5 py-2.5 text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-600/30 hover:shadow-lg active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <ShoppingBag size={15} />
              <span>Draft Wholesaler PO ({selectedMetrics.count})</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
