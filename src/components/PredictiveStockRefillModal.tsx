import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Sparkles, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar, 
  Download, 
  Search, 
  Layers, 
  RefreshCw, 
  Sliders, 
  Info, 
  ShieldAlert, 
  Activity, 
  Package, 
  FileDown,
  BrainCircuit,
  ArrowUpRight,
  Clock,
  IndianRupee,
  Check,
  Zap,
  ShoppingBag,
  SlidersHorizontal,
  ChevronRight,
  Truck,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Medicine, Sale, MedicineStockPrediction, PredictiveRefillSummary, StockoutUrgency } from '../types';
import { formatCurrency, cn, formatDate } from '../lib/utils';
import { calculateMedicineStockPredictions } from '../utils/predictiveStockEngine';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logActivity } from '../lib/logger';
import { useAuth } from './AuthProvider';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PredictiveStockRefillModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: Medicine[];
  sales?: Sale[];
  onRestockMedicine?: (med: Medicine, suggestedQty: number) => void;
  onThresholdsUpdated?: () => void;
}

export const PredictiveStockRefillModal: React.FC<PredictiveStockRefillModalProps> = ({
  isOpen,
  onClose,
  inventory,
  sales = [],
  onRestockMedicine,
  onThresholdsUpdated,
}) => {
  const { profile } = useAuth();

  // Model parameters
  const [planningHorizonDays, setPlanningHorizonDays] = useState<number>(30);
  const [vendorLeadTimeDays, setVendorLeadTimeDays] = useState<number>(4);
  const [safetyStockDays, setSafetyStockDays] = useState<number>(7);
  const [surgeMultiplier, setSurgeMultiplier] = useState<number>(1.0);

  // Data & State
  const [salesHistory, setSalesHistory] = useState<Sale[]>(sales);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiStrategicTips, setAiStrategicTips] = useState<string[]>([]);
  const [aiEngineUsed, setAiEngineUsed] = useState<string>('Local Run-Rate Engine');
  
  // UI filter & search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUrgency, setFilterUrgency] = useState<string>('all');
  const [isApplyingThresholds, setIsApplyingThresholds] = useState(false);
  const [thresholdsAppliedSuccess, setThresholdsAppliedSuccess] = useState(false);

  // Fetch real sales records from Firestore if not passed
  useEffect(() => {
    if (isOpen && salesHistory.length === 0) {
      getDocs(collection(db, 'sales'))
        .then((snap) => {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
          setSalesHistory(list);
        })
        .catch(err => console.warn("Could not load sales history:", err));
    }
  }, [isOpen]);

  // Compute live mathematical predictions instantly
  const { summary, predictions } = useMemo(() => {
    return calculateMedicineStockPredictions(inventory, salesHistory, {
      planningHorizonDays,
      vendorLeadTimeDays,
      safetyStockDays,
      surgeMultiplier
    });
  }, [inventory, salesHistory, planningHorizonDays, vendorLeadTimeDays, safetyStockDays, surgeMultiplier]);

  // Run AI Deep Reasoning with Gemini
  const runAIEnhancedRefill = async () => {
    setLoadingAI(true);
    try {
      const res = await fetch('/api/inventory/ai-predictive-refill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventory,
          salesHistory: salesHistory.slice(0, 50),
          planningHorizonDays,
          vendorLeadTimeDays,
          safetyStockDays,
          surgeMultiplier
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.strategicRecommendations) {
          setAiStrategicTips(data.strategicRecommendations);
        }
        if (data.engine) {
          setAiEngineUsed(data.engine);
        }
      }
    } catch (err) {
      console.warn("AI predictive call fallback to local calculation:", err);
    } finally {
      setLoadingAI(false);
    }
  };

  if (!isOpen) return null;

  // Filter items
  const filteredPredictions = predictions.filter((item) => {
    const matchesSearch = 
      item.medicineName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.genericName && item.genericName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.salt && item.salt.toLowerCase().includes(searchTerm.toLowerCase())) ||
      item.type.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterUrgency === 'stockout') return item.urgency === 'stockout';
    if (filterUrgency === 'critical') return item.urgency === 'critical';
    if (filterUrgency === 'warning') return item.urgency === 'warning';
    if (filterUrgency === 'moderate') return item.urgency === 'moderate';
    if (filterUrgency === 'reorder') return item.recommendedRefillQty > 0;
    if (filterUrgency === 'expiry_conflict') return item.expiryConflict === 'expiry_before_stockout';
    return true;
  });

  // Batch Auto-apply Recommended Safety Thresholds to Firestore
  const handleAutoApplyThresholds = async () => {
    if (predictions.length === 0) return;

    if (!window.confirm(`Auto-update safety reorder thresholds for ${predictions.length} medicines based on calculated daily burn rates?`)) {
      return;
    }

    setIsApplyingThresholds(true);
    try {
      const batch = writeBatch(db);
      let count = 0;

      for (const item of predictions) {
        if (!item.medicineId) continue;
        // Calculated dynamic safety buffer: (lead time + safety stock) * daily burn
        const dynamicThreshold = Math.max(5, Math.ceil((vendorLeadTimeDays + safetyStockDays) * item.dailyBurnRate));
        const medRef = doc(db, 'inventory', item.medicineId);
        batch.update(medRef, {
          minThreshold: dynamicThreshold,
          dailyBurnRate: item.dailyBurnRate,
          lastRefillCalculatedAt: new Date().toISOString()
        });
        count++;
        if (count >= 450) break;
      }

      await batch.commit();

      await logActivity({
        action: 'Dynamic Refill Thresholds Applied',
        description: `Updated minimum reorder thresholds for ${count} medicines based on predictive daily consumption rate.`,
        type: 'inventory',
        module: 'inventory',
        userEmail: profile?.email || 'pharmacist@satyam.com',
        userName: profile?.displayName || 'Pharmacist',
        severity: 'success',
        details: {
          planningHorizonDays,
          vendorLeadTimeDays,
          updatedCount: count
        }
      });

      setThresholdsAppliedSuccess(true);
      if (onThresholdsUpdated) onThresholdsUpdated();
      setTimeout(() => setThresholdsAppliedSuccess(false), 4000);
    } catch (err: any) {
      console.error("Failed to update thresholds:", err);
      alert(`Error updating thresholds: ${err.message}`);
    } finally {
      setIsApplyingThresholds(false);
    }
  };

  // Export PDF Refill Schedule & Purchase Plan
  const exportPDFRefillSchedule = () => {
    const doc = new jsPDF();

    // Header
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 42, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('SATYAM PHARMA ERP — PREDICTIVE STOCK REFILL PLAN', 14, 18);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')} | Planning Horizon: ${planningHorizonDays} Days | Lead Time: ${vendorLeadTimeDays} Days`, 14, 26);
    doc.text(`Estimated Refill Budget: Rs. ${summary.totalEstimatedRefillCost.toLocaleString('en-IN')} | Immediate Action SKUs: ${summary.immediateActionRequiredCount}`, 14, 34);

    // Table Data
    const tableRows = predictions.map(p => [
      p.medicineName,
      p.type.toUpperCase(),
      p.currentStock.toString(),
      `${p.dailyBurnRate} u/d`,
      p.projectedStockOutFormatted,
      p.daysUntilStockOut <= 0 ? 'DEPLETED' : `${p.daysUntilStockOut} days`,
      p.recommendedRefillQty > 0 ? `${p.recommendedRefillQty} pcs` : 'No order',
      p.estimatedRefillCost > 0 ? `Rs. ${p.estimatedRefillCost.toLocaleString('en-IN')}` : '-',
      p.urgency.toUpperCase()
    ]);

    autoTable(doc, {
      head: [['Medicine Name', 'Type', 'Stock', 'Burn Rate', 'Stock-Out Date', 'Runway', 'Refill Qty', 'Est. Cost', 'Urgency']],
      body: tableRows,
      startY: 48,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [30, 41, 59]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      styles: {
        cellPadding: 2.5
      }
    });

    doc.save(`Satyam_Predictive_Stock_Refill_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Export CSV
  const exportCSV = () => {
    const headers = ['Medicine Name', 'Generic Salt', 'Category', 'Current Stock', 'Min Threshold', 'Daily Burn Rate (units/day)', 'Days Until Stock-out', 'Projected Stock-out Date', 'Recommended Order Date', 'Refill Qty', 'Unit Price', 'Est. Refill Cost', 'Urgency', 'Clinical Rationale'];
    const rows = predictions.map(p => [
      `"${p.medicineName.replace(/"/g, '""')}"`,
      `"${(p.genericName || p.salt || '').replace(/"/g, '""')}"`,
      `"${p.type}"`,
      p.currentStock,
      p.minThreshold,
      p.dailyBurnRate,
      p.daysUntilStockOut,
      `"${p.projectedStockOutDate}"`,
      `"${p.recommendedOrderDate}"`,
      p.recommendedRefillQty,
      p.rate,
      p.estimatedRefillCost,
      `"${p.urgency}"`,
      `"${(p.clinicalRationale || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Stock_Refill_Projections_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative w-full max-w-6xl max-h-[94vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden dark:bg-zinc-900 border border-slate-200 dark:border-slate-800"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-zinc-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight text-slate-900 dark:text-slate-100">
                  AI Predictive Stock Refill & Run-Rate Engine
                </h2>
                <span className="rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border border-indigo-200 dark:border-indigo-800">
                  {aiEngineUsed}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Calculates projected stock-out dates based on live sales volume, vendor transit buffers, and consumption velocity.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={runAIEnhancedRefill}
              disabled={loadingAI}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800 px-3.5 py-2 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-2xs"
            >
              <BrainCircuit size={14} className={loadingAI ? "animate-spin" : "text-purple-600"} />
              <span>{loadingAI ? 'Analyzing...' : 'Run Gemini 3.7 AI'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body with Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Top Control Bar & Sliders */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-zinc-900/50">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 text-xs">
              <span className="font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <SlidersHorizontal size={14} />
                <span>Simulation Parameters & Supply Chain Settings</span>
              </span>
              <span className="text-[11px] text-slate-400">
                Adjust horizon & lead times to recalculate required refill quantities
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3">
              {/* Planning Horizon */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Planning Horizon:</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-mono">{planningHorizonDays} Days</span>
                </div>
                <input 
                  type="range" 
                  min={15} 
                  max={90} 
                  step={5}
                  value={planningHorizonDays}
                  onChange={(e) => setPlanningHorizonDays(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:bg-slate-700"
                />
                <div className="flex justify-between text-[9px] text-slate-400 mt-0.5 font-mono">
                  <span>15d</span>
                  <span>45d</span>
                  <span>90d</span>
                </div>
              </div>

              {/* Vendor Lead Time */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Vendor Transit Lead Time:</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-mono">{vendorLeadTimeDays} Days</span>
                </div>
                <input 
                  type="range" 
                  min={1} 
                  max={14} 
                  step={1}
                  value={vendorLeadTimeDays}
                  onChange={(e) => setVendorLeadTimeDays(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:bg-slate-700"
                />
                <div className="flex justify-between text-[9px] text-slate-400 mt-0.5 font-mono">
                  <span>1d (Local)</span>
                  <span>7d (State)</span>
                  <span>14d</span>
                </div>
              </div>

              {/* Safety Buffer */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Safety Buffer Stock:</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-mono">{safetyStockDays} Days</span>
                </div>
                <input 
                  type="range" 
                  min={3} 
                  max={21} 
                  step={1}
                  value={safetyStockDays}
                  onChange={(e) => setSafetyStockDays(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:bg-slate-700"
                />
                <div className="flex justify-between text-[9px] text-slate-400 mt-0.5 font-mono">
                  <span>3d (Tight)</span>
                  <span>7d (Standard)</span>
                  <span>21d (Conservative)</span>
                </div>
              </div>

              {/* Surge Multiplier */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Seasonal Surge Factor:</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-mono">{surgeMultiplier}x</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[
                    { label: 'Normal (1.0x)', val: 1.0 },
                    { label: 'Spike (1.25x)', val: 1.25 },
                    { label: 'Epidemic (1.5x)', val: 1.5 }
                  ].map(b => (
                    <button
                      key={b.val}
                      type="button"
                      onClick={() => setSurgeMultiplier(b.val)}
                      className={cn(
                        "flex-1 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer",
                        surgeMultiplier === b.val
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                      )}
                    >
                      {b.label.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* AI Strategic Tips Banner (If Available) */}
          {aiStrategicTips.length > 0 && (
            <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-4 dark:border-purple-900/50 dark:bg-purple-950/30">
              <div className="flex items-center gap-2 mb-2">
                <BrainCircuit size={16} className="text-purple-600 dark:text-purple-400" />
                <span className="text-xs font-black uppercase tracking-wider text-purple-900 dark:text-purple-200">
                  Gemini AI Supply Chain Intelligence Recommendations:
                </span>
              </div>
              <ul className="space-y-1.5 pl-5 list-disc text-xs text-purple-900 dark:text-purple-300">
                {aiStrategicTips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 4 Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-red-200 bg-red-50/60 p-3.5 dark:border-red-900/40 dark:bg-red-950/30">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-600">Immediate Stockout Risk</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-red-700 dark:text-red-400">{summary.immediateActionRequiredCount}</span>
                <span className="text-xs font-bold text-red-600/80">SKUs (&le;7d)</span>
              </div>
              <p className="text-[10px] text-red-600/70 mt-0.5">{summary.stockedOutCount} depleted</p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 dark:border-amber-900/40 dark:bg-amber-950/30">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Refill Due (8–15d)</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-amber-800 dark:text-amber-400">{summary.warningStockoutCount}</span>
                <span className="text-xs font-bold text-amber-700/80">Medicines</span>
              </div>
              <p className="text-[10px] text-amber-700/70 mt-0.5">Order before lead-time cutoff</p>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/30">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Total Refill Order Volume</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-blue-800 dark:text-blue-400">{summary.totalRecommendedRefillUnits}</span>
                <span className="text-xs font-bold text-blue-700/80">Units / Pieces</span>
              </div>
              <p className="text-[10px] text-blue-700/70 mt-0.5">For {planningHorizonDays}d planning horizon</p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/30">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Estimated Refill Capital</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-emerald-800 dark:text-emerald-400">{formatCurrency(summary.totalEstimatedRefillCost)}</span>
              </div>
              <p className="text-[10px] text-emerald-700/70 mt-0.5">Procurement budget needed</p>
            </div>
          </div>

          {/* Search, Filters, and Bulk Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search medicine name, generic formula, category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden dark:border-slate-800 dark:bg-zinc-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleAutoApplyThresholds}
                disabled={isApplyingThresholds}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-3 py-2 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-2xs"
                title="Sync dynamic safety thresholds to Firestore inventory"
              >
                <CheckCircle2 size={14} className={thresholdsAppliedSuccess ? "text-emerald-600" : "text-indigo-600"} />
                <span>{thresholdsAppliedSuccess ? 'Thresholds Synced!' : isApplyingThresholds ? 'Applying...' : 'Auto-Sync Thresholds'}</span>
              </button>

              <button
                type="button"
                onClick={exportPDFRefillSchedule}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-zinc-900 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 transition-all active:scale-95 cursor-pointer shadow-2xs"
                title="Export Refill Schedule to PDF"
              >
                <FileDown size={14} />
                <span>PDF</span>
              </button>

              <button
                type="button"
                onClick={exportCSV}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/40 px-3 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 transition-all active:scale-95 cursor-pointer shadow-2xs"
                title="Download CSV report"
              >
                <FileSpreadsheet size={14} />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterUrgency('all')}
              className={cn(
                "rounded-lg px-3 py-1.5 font-bold transition-all cursor-pointer",
                filterUrgency === 'all'
                  ? "bg-slate-900 text-white dark:bg-indigo-600"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              )}
            >
              All SKUs ({predictions.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterUrgency('critical')}
              className={cn(
                "rounded-lg px-3 py-1.5 font-bold transition-all cursor-pointer flex items-center gap-1",
                filterUrgency === 'critical'
                  ? "bg-red-600 text-white"
                  : "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300"
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
              <span>Critical &le; 7 Days ({summary.immediateActionRequiredCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterUrgency('warning')}
              className={cn(
                "rounded-lg px-3 py-1.5 font-bold transition-all cursor-pointer flex items-center gap-1",
                filterUrgency === 'warning'
                  ? "bg-amber-500 text-slate-950 font-black"
                  : "bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300"
              )}
            >
              <span>Refill Soon 8–15 Days ({summary.warningStockoutCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterUrgency('reorder')}
              className={cn(
                "rounded-lg px-3 py-1.5 font-bold transition-all cursor-pointer",
                filterUrgency === 'reorder'
                  ? "bg-indigo-600 text-white"
                  : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300"
              )}
            >
              Needs Reorder Qty &gt; 0 ({predictions.filter(p => p.recommendedRefillQty > 0).length})
            </button>
            <button
              type="button"
              onClick={() => setFilterUrgency('expiry_conflict')}
              className={cn(
                "rounded-lg px-3 py-1.5 font-bold transition-all cursor-pointer flex items-center gap-1",
                filterUrgency === 'expiry_conflict'
                  ? "bg-rose-600 text-white"
                  : "bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300"
              )}
            >
              <AlertTriangle size={12} />
              <span>Expiry Precedes Stockout ({predictions.filter(p => p.expiryConflict === 'expiry_before_stockout').length})</span>
            </button>
          </div>

          {/* Predictions Table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs dark:border-slate-800 dark:bg-zinc-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-800/60 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3.5">Medicine & Salt</th>
                    <th className="px-4 py-3.5">Stock on Hand</th>
                    <th className="px-4 py-3.5">Daily Burn Rate</th>
                    <th className="px-4 py-3.5">Projected Stock-out Date</th>
                    <th className="px-4 py-3.5">Order Deadline</th>
                    <th className="px-4 py-3.5">Suggested Refill</th>
                    <th className="px-4 py-3.5">Est. Cost</th>
                    <th className="px-4 py-3.5 text-right">Quick Restock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredPredictions.map((item) => {
                    const isZeroStock = item.currentStock <= 0;
                    const isCritical = item.urgency === 'critical' || isZeroStock;
                    const isWarning = item.urgency === 'warning';
                    const hasExpiryConflict = item.expiryConflict === 'expiry_before_stockout';

                    const matchingMedicine = inventory.find(m => m.id === item.medicineId);

                    return (
                      <tr 
                        key={item.medicineId}
                        className={cn(
                          "transition-colors",
                          isZeroStock ? "bg-red-50/50 dark:bg-red-950/20" :
                          isCritical ? "bg-rose-50/30 dark:bg-rose-950/15" :
                          isWarning ? "bg-amber-50/30 dark:bg-amber-950/15" :
                          "hover:bg-slate-50/80 dark:hover:bg-zinc-800/50"
                        )}
                      >
                        {/* Medicine Name & Generic */}
                        <td className="px-4 py-3 max-w-xs">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 dark:text-slate-100">{item.medicineName}</span>
                              <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[9px] font-black uppercase text-slate-500">
                                {item.type}
                              </span>
                            </div>
                            {(item.genericName || item.salt) && (
                              <span className="text-[10px] text-slate-400 truncate max-w-xs">
                                {item.genericName || item.salt}
                              </span>
                            )}
                            {hasExpiryConflict && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                                <AlertTriangle size={10} />
                                <span>Batch expires in {item.daysUntilExpiry}d before runout</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Stock on Hand */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className={cn(
                              "font-black text-sm",
                              isZeroStock ? "text-red-600" : isCritical ? "text-red-600" : isWarning ? "text-amber-700 dark:text-amber-400" : "text-slate-800 dark:text-slate-200"
                            )}>
                              {item.currentStock} pcs
                            </span>
                            <span className="text-[9px] text-slate-400 font-semibold">Min: {item.minThreshold}</span>
                          </div>
                        </td>

                        {/* Daily Burn Rate */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Zap size={12} className="text-amber-500" />
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                              {item.dailyBurnRate}
                            </span>
                            <span className="text-[10px] text-slate-400">units/d</span>
                          </div>
                        </td>

                        {/* Projected Stock-out Date */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={12} className="text-slate-400" />
                              <span className="font-black text-slate-900 dark:text-slate-100">
                                {item.projectedStockOutFormatted}
                              </span>
                            </div>
                            <span className={cn(
                              "inline-block rounded-md px-1.5 py-0.2 text-[9px] font-black uppercase mt-0.5 w-fit",
                              isZeroStock ? "bg-red-600 text-white" :
                              item.daysUntilStockOut <= 7 ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" :
                              item.daysUntilStockOut <= 15 ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300" :
                              "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            )}>
                              {isZeroStock ? "DEPLETED" : `${item.daysUntilStockOut} days runway`}
                            </span>
                          </div>
                        </td>

                        {/* Order Deadline */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                              <Truck size={12} className="text-indigo-500" />
                              <span className="font-mono font-bold">{item.recommendedOrderDate}</span>
                            </div>
                            <span className="text-[9px] text-slate-400">
                              ({vendorLeadTimeDays}d lead buffer)
                            </span>
                          </div>
                        </td>

                        {/* Suggested Refill Qty */}
                        <td className="px-4 py-3">
                          {item.recommendedRefillQty > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-2 py-1 font-black text-indigo-700 dark:text-indigo-300">
                              +{item.recommendedRefillQty} pcs
                            </span>
                          ) : (
                            <span className="text-slate-400 font-semibold">Stock Sufficient</span>
                          )}
                        </td>

                        {/* Estimated Cost */}
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">
                          {item.estimatedRefillCost > 0 ? formatCurrency(item.estimatedRefillCost) : '-'}
                        </td>

                        {/* Quick Restock Action */}
                        <td className="px-4 py-3 text-right">
                          {matchingMedicine && (
                            <button
                              type="button"
                              onClick={() => {
                                if (onRestockMedicine) {
                                  onRestockMedicine(matchingMedicine, item.recommendedRefillQty || 20);
                                  onClose();
                                }
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white px-2.5 py-1 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-2xs"
                            >
                              <Package size={12} />
                              <span>Restock</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredPredictions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Layers size={36} className="mb-2 opacity-30" />
                <p className="text-sm font-bold">No medicines matched filter</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-zinc-900/90 text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-500 font-medium">
            <Info size={14} className="text-slate-400" />
            <span>Refill calculations automatically round to standard strip/box packaging batches.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-700 dark:hover:bg-slate-600 px-4 py-2 font-bold transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
};
