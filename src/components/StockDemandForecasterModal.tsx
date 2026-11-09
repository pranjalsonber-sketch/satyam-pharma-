import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  TrendingUp, 
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
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Medicine } from '../types';
import { formatCurrency, cn, formatDate } from '../lib/utils';
import { collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logActivity } from '../lib/logger';
import { useAuth } from './AuthProvider';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface StockDemandForecasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: Medicine[];
  onThresholdsUpdated?: () => void;
}

export interface ItemForecast {
  medicineId: string;
  medicineName: string;
  genericFormula: string;
  category: string;
  type: string;
  currentStock: number;
  minThreshold: number;
  historicalMonthlySales: number;
  dailyBurnRate: number;
  seasonalMultiplier: number;
  predictedDemandUnits: number;
  stockoutRiskDays: number;
  recommendedReorderQty: number;
  unitRate: number;
  estimatedProcurementCost: number;
  confidenceScore: number;
  urgency: 'critical_shortage' | 'high_surge' | 'moderate' | 'stable';
  clinicalRationale: string;
}

export interface ForecastResponse {
  engine?: string;
  generatedAt?: string;
  forecastSummary: {
    season: string;
    planningHorizonDays: number;
    totalSKUsAnalyzed: number;
    totalProjectedDemandUnits: number;
    totalRecommendedProcurementCost: number;
    criticalStockoutCount: number;
    highSurgeCount: number;
    keyEpidemiologicalDriver: string;
  };
  topSeasonalTrends: Array<{
    name: string;
    surgePct: string;
    status: string;
  }>;
  itemForecasts: ItemForecast[];
  procurementPlan: {
    immediateOrderCount: number;
    topPriorityItems: ItemForecast[];
    estimatedBudgetINR: number;
  };
}

export const StockDemandForecasterModal: React.FC<StockDemandForecasterModalProps> = ({
  isOpen,
  onClose,
  inventory,
  onThresholdsUpdated,
}) => {
  const { profile } = useAuth();
  
  // Detect current season by calendar month
  const getDefaultSeason = () => {
    const month = new Date().getMonth(); // 0-11
    if (month >= 5 && month <= 8) return 'monsoon'; // Jun - Sep
    if (month >= 9 && month <= 10) return 'post_monsoon'; // Oct - Nov
    if (month >= 11 || month <= 1) return 'winter'; // Dec - Feb
    return 'summer'; // Mar - May
  };

  const [season, setSeason] = useState<string>(getDefaultSeason());
  const [planningHorizonDays, setPlanningHorizonDays] = useState<number>(45);
  const [growthFactorPercent, setGrowthFactorPercent] = useState<number>(15);
  const [loading, setLoading] = useState(false);
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Table search & filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUrgency, setFilterUrgency] = useState<'all' | 'critical' | 'surge' | 'reorder'>('all');
  const [isApplyingThresholds, setIsApplyingThresholds] = useState(false);
  const [thresholdsAppliedSuccess, setThresholdsAppliedSuccess] = useState(false);

  const fetchForecast = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch recent sales history to enrich AI modeling
      let salesHistory: any[] = [];
      try {
        const salesSnap = await getDocs(collection(db, 'sales'));
        salesHistory = salesSnap.docs.map(d => d.data());
      } catch (e) {
        console.warn("Could not fetch sales history, will rely on local inventory run rates:", e);
      }

      const res = await fetch('/api/inventory/ai-demand-forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventory,
          salesHistory,
          season,
          planningHorizonDays,
          growthFactorPercent,
          focusCategory: 'all'
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.details || 'Failed to generate demand forecast.');
      }

      const data: ForecastResponse = await res.json();
      setForecastData(data);
    } catch (err: any) {
      console.error("Error generating demand forecast:", err);
      setError(err.message || 'Error communicating with AI Demand Forecaster engine.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !forecastData) {
      fetchForecast();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter forecasts
  const filteredForecasts = (forecastData?.itemForecasts || []).filter(item => {
    const matchesSearch = 
      item.medicineName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.genericFormula.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterUrgency === 'critical') return item.urgency === 'critical_shortage';
    if (filterUrgency === 'surge') return item.urgency === 'high_surge';
    if (filterUrgency === 'reorder') return item.recommendedReorderQty > 0;
    return true;
  });

  // Batch Auto-apply Recommended Safety Thresholds into Firestore
  const handleAutoApplyThresholds = async () => {
    if (!forecastData || forecastData.itemForecasts.length === 0) return;

    if (!window.confirm(`Auto-update safety reorder thresholds for ${forecastData.itemForecasts.length} medicines based on seasonal burn rates?`)) {
      return;
    }

    setIsApplyingThresholds(true);
    try {
      const batch = writeBatch(db);
      let count = 0;

      for (const item of forecastData.itemForecasts) {
        if (!item.medicineId) continue;
        // Calculated dynamic safety buffer: 7 days of seasonal demand
        const dynamicThreshold = Math.max(5, Math.ceil(item.dailyBurnRate * 7));
        const medRef = doc(db, 'inventory', item.medicineId);
        batch.update(medRef, {
          minThreshold: dynamicThreshold,
          seasonalDemandMultiplier: item.seasonalMultiplier,
          lastForecastDate: new Date().toISOString()
        });
        count++;
        if (count >= 450) break; // Firestore batch limit safety
      }

      await batch.commit();

      await logActivity({
        action: 'Seasonal Safety Thresholds Auto-Applied',
        description: `Updated minimum safety thresholds for ${count} medications based on ${season.toUpperCase()} seasonal forecast.`,
        type: 'inventory',
        module: 'inventory',
        userEmail: profile?.email || 'admin@satyampharma.com',
        userName: profile?.displayName || 'Pharmacist',
        severity: 'success',
        details: {
          season,
          planningHorizonDays,
          medicinesUpdatedCount: count
        }
      });

      setThresholdsAppliedSuccess(true);
      if (onThresholdsUpdated) onThresholdsUpdated();
      setTimeout(() => setThresholdsAppliedSuccess(false), 4000);
    } catch (err: any) {
      console.error("Failed to apply dynamic thresholds:", err);
      alert(`Error updating thresholds: ${err.message}`);
    } finally {
      setIsApplyingThresholds(false);
    }
  };

  // Export PDF Procurement Plan
  const exportPDFProcurementPlan = () => {
    if (!forecastData) return;

    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 42, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('SATYAM PHARMACEUTICALS ERP', 14, 18);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`AI DEMAND FORECAST & SEASONAL PROCUREMENT PLAN (${forecastData.forecastSummary.season})`, 14, 26);
    doc.text(`Generated: ${new Date().toLocaleString()} | Planning Horizon: ${forecastData.forecastSummary.planningHorizonDays} Days`, 14, 33);

    // Summary Box
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Executive Epidemiological Forecast Summary:', 14, 52);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const splitRationale = doc.splitTextToSize(forecastData.forecastSummary.keyEpidemiologicalDriver, 182);
    doc.text(splitRationale, 14, 58);

    const summaryEndY = 58 + (splitRationale.length * 4) + 4;

    // Metrics Overview
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total SKUs: ${forecastData.forecastSummary.totalSKUsAnalyzed}  |  Projected Demand: ${forecastData.forecastSummary.totalProjectedDemandUnits} units  |  Imminent Stockouts: ${forecastData.forecastSummary.criticalStockoutCount}  |  Est. Budget: ${formatCurrency(forecastData.forecastSummary.totalRecommendedProcurementCost)}`, 14, summaryEndY);

    // Table
    const reorderItems = forecastData.itemForecasts.filter(i => i.recommendedReorderQty > 0 || i.urgency === 'critical_shortage');
    const tableData = reorderItems.map(item => [
      item.medicineName,
      item.genericFormula,
      `${item.currentStock} units`,
      `${item.predictedDemandUnits} units`,
      `${item.seasonalMultiplier}x`,
      item.stockoutRiskDays <= 90 ? `${item.stockoutRiskDays} days` : '>90d',
      `${item.recommendedReorderQty} units`,
      formatCurrency(item.estimatedProcurementCost),
      item.urgency.replace('_', ' ').toUpperCase()
    ]);

    autoTable(doc, {
      startY: summaryEndY + 6,
      head: [['Medicine', 'Active Salt', 'Current', 'Pred. Demand', 'Season Surge', 'Days Left', 'Reorder Qty', 'Est. Cost', 'Urgency']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5, cellPadding: 2.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 200;

    // Signatures
    if (finalY + 35 < 280) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Prepared By: Chief Pharmacist', 14, finalY + 25);
      doc.text('Approved By: Medical Superintendent / Purchase Head', 110, finalY + 25);
      doc.line(14, finalY + 20, 75, finalY + 20);
      doc.line(110, finalY + 20, 195, finalY + 20);
    }

    doc.save(`AI_Demand_Forecast_Plan_${forecastData.forecastSummary.season}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative flex flex-col w-full max-w-6xl max-h-[92vh] rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-slate-100"
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800 p-5 bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-slate-50 dark:from-slate-900 dark:via-blue-950/20 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <BrainCircuit size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                  AI Stock Demand Forecaster
                </h2>
                <span className="flex items-center gap-1 rounded-full bg-blue-600/10 border border-blue-600/20 px-2.5 py-0.5 text-[10px] font-black uppercase text-blue-600 dark:text-blue-400">
                  <Sparkles size={11} /> Gemini 3.7 Intelligence
                </span>
                {forecastData?.engine && (
                  <span className="hidden sm:inline-block rounded-md bg-slate-200/80 dark:bg-slate-800 px-2 py-0.5 text-[9px] font-mono text-slate-600 dark:text-slate-400">
                    Engine: {forecastData.engine}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Predicts future inventory consumption & safety replenishment based on seasonal disease patterns and run rates.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Forecast Parameter Controls Bar */}
        <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Season Selection */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase text-slate-500">Season:</span>
                <select
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 shadow-2xs"
                >
                  <option value="monsoon">Monsoon (Viral, Antipyretics, Gastro)</option>
                  <option value="winter">Winter (Respiratory, Asthma, Flu)</option>
                  <option value="summer">Summer (ORS, Antacids, Antifungals)</option>
                  <option value="post_monsoon">Post-Monsoon (Dengue, Vector-Borne)</option>
                  <option value="general">General (Baseline Standard)</option>
                </select>
              </div>

              {/* Planning Horizon */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase text-slate-500">Horizon:</span>
                <select
                  value={planningHorizonDays}
                  onChange={(e) => setPlanningHorizonDays(Number(e.target.value))}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 shadow-2xs"
                >
                  <option value={30}>30 Days (Immediate Sprint)</option>
                  <option value={45}>45 Days (Recommended Cycle)</option>
                  <option value={60}>60 Days (Quarterly Buffer)</option>
                  <option value={90}>90 Days (Full Season Window)</option>
                </select>
              </div>

              {/* Growth Factor */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase text-slate-500">Growth:</span>
                <select
                  value={growthFactorPercent}
                  onChange={(e) => setGrowthFactorPercent(Number(e.target.value))}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 shadow-2xs"
                >
                  <option value={0}>0% (Steady Baseline)</option>
                  <option value={10}>+10% (Normal Seasonal Uptick)</option>
                  <option value={20}>+20% (High Footfall Surge)</option>
                  <option value={35}>+35% (Outbreak / Epidemic Surge)</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchForecast}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-black text-white shadow-md shadow-blue-600/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={cn(loading && "animate-spin")} />
              <span>{loading ? 'Analyzing Consumption...' : 'Re-Run Forecast'}</span>
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200 flex items-center gap-3">
              <AlertTriangle size={18} className="shrink-0 text-rose-600" />
              <p>{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                <BrainCircuit size={36} className="animate-spin text-blue-600" />
                <Sparkles size={18} className="absolute -top-1 -right-1 text-amber-500 animate-bounce" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  Gemini AI is Modeling Epidemiological Trends...
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  Cross-referencing {inventory.length} inventory SKUs with historical sales velocities and {season.toUpperCase()} disease surge multipliers.
                </p>
              </div>
            </div>
          ) : forecastData ? (
            <>
              {/* Overview Metrics Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 p-4 shadow-xs">
                  <div className="flex items-center justify-between text-slate-500 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider">Projected Demand</span>
                    <TrendingUp size={16} className="text-blue-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
                    {forecastData.forecastSummary.totalProjectedDemandUnits.toLocaleString()} <span className="text-xs font-normal text-slate-400">Units</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Over next {forecastData.forecastSummary.planningHorizonDays} days ({season.toUpperCase()})
                  </p>
                </div>

                <div className="rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 p-4 shadow-xs">
                  <div className="flex items-center justify-between text-rose-600 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider">Critical Stockouts</span>
                    <ShieldAlert size={16} className="text-rose-600" />
                  </div>
                  <div className="text-2xl font-black text-rose-700 dark:text-rose-300">
                    {forecastData.forecastSummary.criticalStockoutCount} <span className="text-xs font-normal text-rose-400">SKUs</span>
                  </div>
                  <p className="text-[10px] text-rose-600/80 mt-1">
                    Stock exhaustion in ≤ 7 days
                  </p>
                </div>

                <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 p-4 shadow-xs">
                  <div className="flex items-center justify-between text-amber-600 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider">High Surge SKUs</span>
                    <Activity size={16} className="text-amber-600" />
                  </div>
                  <div className="text-2xl font-black text-amber-700 dark:text-amber-300">
                    {forecastData.forecastSummary.highSurgeCount} <span className="text-xs font-normal text-amber-400">Medicines</span>
                  </div>
                  <p className="text-[10px] text-amber-600/80 mt-1">
                    Experiencing ≥ +35% seasonal demand
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 shadow-xs">
                  <div className="flex items-center justify-between text-emerald-600 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider">Procurement Budget</span>
                    <IndianRupee size={16} className="text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                    {formatCurrency(forecastData.forecastSummary.totalRecommendedProcurementCost)}
                  </div>
                  <p className="text-[10px] text-emerald-600/80 mt-1">
                    For {forecastData.procurementPlan.immediateOrderCount} replenishment items
                  </p>
                </div>
              </div>

              {/* Epidemiological Rationale & Top Seasonal Drivers */}
              <div className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-gradient-to-r from-blue-50/80 to-indigo-50/40 dark:from-blue-950/30 dark:to-slate-900 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-blue-950 dark:text-blue-200">
                    <Sparkles size={14} className="text-blue-600 dark:text-blue-400" />
                    <span>Clinical Epidemiological Driver & Seasonal Intelligence</span>
                  </div>
                  <span className="rounded-full bg-blue-600 text-white px-2.5 py-0.5 text-[9px] font-bold uppercase">
                    {season.toUpperCase()} Peak
                  </span>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {forecastData.forecastSummary.keyEpidemiologicalDriver}
                </p>

                {forecastData.topSeasonalTrends && forecastData.topSeasonalTrends.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {forecastData.topSeasonalTrends.map((trend, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 rounded-xl border border-blue-200 dark:border-blue-800/80 bg-white/80 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 shadow-2xs"
                      >
                        <span>{trend.name}</span>
                        <span className="rounded-md bg-blue-100 dark:bg-blue-900/60 px-1.5 py-0.5 text-[10px] font-black text-blue-700 dark:text-blue-300">
                          {trend.surgePct}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[220px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search forecasted medicines or salt..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 py-2 pl-9 pr-3 text-xs outline-none focus:border-blue-500 shadow-2xs"
                    />
                  </div>

                  <div className="flex rounded-xl border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setFilterUrgency('all')}
                      className={cn(
                        "rounded-lg px-2.5 py-1 transition-all cursor-pointer",
                        filterUrgency === 'all' ? "bg-white dark:bg-slate-700 shadow-2xs text-slate-900 dark:text-white" : "text-slate-500"
                      )}
                    >
                      All ({forecastData.itemForecasts.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterUrgency('critical')}
                      className={cn(
                        "rounded-lg px-2.5 py-1 transition-all cursor-pointer",
                        filterUrgency === 'critical' ? "bg-rose-500 text-white shadow-2xs" : "text-slate-500"
                      )}
                    >
                      Critical Shortage
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterUrgency('surge')}
                      className={cn(
                        "rounded-lg px-2.5 py-1 transition-all cursor-pointer",
                        filterUrgency === 'surge' ? "bg-amber-500 text-white shadow-2xs" : "text-slate-500"
                      )}
                    >
                      High Surge
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterUrgency('reorder')}
                      className={cn(
                        "rounded-lg px-2.5 py-1 transition-all cursor-pointer",
                        filterUrgency === 'reorder' ? "bg-blue-600 text-white shadow-2xs" : "text-slate-500"
                      )}
                    >
                      Reorder Needed
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAutoApplyThresholds}
                    disabled={isApplyingThresholds}
                    className="flex items-center gap-1.5 rounded-xl border border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-3.5 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 transition-all cursor-pointer disabled:opacity-50"
                    title="Auto-update safety reorder threshold fields in inventory based on predicted daily run-rate"
                  >
                    {thresholdsAppliedSuccess ? <Check size={14} className="text-emerald-600" /> : <Sliders size={14} />}
                    <span>{thresholdsAppliedSuccess ? 'Thresholds Applied!' : 'Auto-Apply Safety Thresholds'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={exportPDFProcurementPlan}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 px-4 py-2 text-xs font-black text-white shadow-sm transition-all active:scale-95 cursor-pointer"
                  >
                    <FileDown size={14} />
                    <span>Export Procurement PDF</span>
                  </button>
                </div>
              </div>

              {/* SKU Demand Prediction Table */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        <th className="p-3.5">Medicine & Salt Formulation</th>
                        <th className="p-3.5">Category</th>
                        <th className="p-3.5 text-center">Stock vs Demand</th>
                        <th className="p-3.5 text-center">Seasonal Surge</th>
                        <th className="p-3.5 text-center">Stockout In</th>
                        <th className="p-3.5 text-center">Reorder Qty</th>
                        <th className="p-3.5 text-right">Est. Cost</th>
                        <th className="p-3.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredForecasts.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400">
                            No medicines match your search / filter criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredForecasts.map((item) => {
                          const stockRatio = item.predictedDemandUnits > 0 
                            ? Math.min(100, Math.round((item.currentStock / item.predictedDemandUnits) * 100))
                            : 100;

                          return (
                            <tr
                              key={item.medicineId}
                              className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                            >
                              <td className="p-3.5">
                                <div>
                                  <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                                    {item.medicineName}
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-mono">
                                    {item.genericFormula}
                                  </div>
                                  <div className="text-[10px] text-slate-400 italic mt-0.5 max-w-sm line-clamp-1" title={item.clinicalRationale}>
                                    💡 {item.clinicalRationale}
                                  </div>
                                </div>
                              </td>

                              <td className="p-3.5">
                                <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[9px] font-black uppercase text-slate-600 dark:text-slate-300">
                                  {item.category}
                                </span>
                              </td>

                              <td className="p-3.5 text-center">
                                <div className="inline-block text-left w-28">
                                  <div className="flex justify-between text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    <span>{item.currentStock} units</span>
                                    <span className="text-slate-400">/ {item.predictedDemandUnits}</span>
                                  </div>
                                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                      className={cn(
                                        "h-full rounded-full transition-all",
                                        stockRatio <= 20 ? "bg-rose-500" : stockRatio <= 50 ? "bg-amber-500" : "bg-emerald-500"
                                      )}
                                      style={{ width: `${stockRatio}%` }}
                                    />
                                  </div>
                                </div>
                              </td>

                              <td className="p-3.5 text-center">
                                <span className={cn(
                                  "rounded-lg px-2 py-1 text-[11px] font-black",
                                  item.seasonalMultiplier >= 1.4 
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                    : item.seasonalMultiplier > 1.0
                                      ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                )}>
                                  {item.seasonalMultiplier}x
                                </span>
                              </td>

                              <td className="p-3.5 text-center font-bold">
                                <span className={cn(
                                  item.stockoutRiskDays <= 7 
                                    ? "text-rose-600 font-black animate-pulse" 
                                    : item.stockoutRiskDays <= 20 
                                      ? "text-amber-600" 
                                      : "text-slate-600 dark:text-slate-400"
                                )}>
                                  {item.stockoutRiskDays <= 90 ? `${item.stockoutRiskDays} Days` : '> 90 Days'}
                                </span>
                              </td>

                              <td className="p-3.5 text-center">
                                {item.recommendedReorderQty > 0 ? (
                                  <span className="font-black text-blue-600 dark:text-blue-400 text-xs">
                                    +{item.recommendedReorderQty}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">—</span>
                                )}
                              </td>

                              <td className="p-3.5 text-right font-black text-slate-800 dark:text-slate-200">
                                {item.estimatedProcurementCost > 0 ? formatCurrency(item.estimatedProcurementCost) : '₹0'}
                              </td>

                              <td className="p-3.5 text-center">
                                <span className={cn(
                                  "rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase",
                                  item.urgency === 'critical_shortage'
                                    ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                    : item.urgency === 'high_surge'
                                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                      : item.urgency === 'moderate'
                                        ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                )}>
                                  {item.urgency.replace('_', ' ')}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900 text-xs text-slate-500">
          <span>
            {forecastData ? `${forecastData.itemForecasts.length} SKUs Modeled for ${season.toUpperCase()} Season` : 'Ready to forecast'}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default StockDemandForecasterModal;
