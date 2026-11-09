import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShoppingCart, 
  Package, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  Calendar, 
  Users, 
  Search, 
  Filter, 
  Download, 
  Printer, 
  Share2, 
  ExternalLink, 
  ChevronRight, 
  ChevronDown, 
  Eye, 
  Sparkles, 
  Phone, 
  IndianRupee, 
  Sliders, 
  ArrowRight, 
  Layers, 
  Clock, 
  Zap, 
  FileText, 
  Check, 
  X,
  RefreshCw,
  Percent,
  Building2,
  HeartPulse,
  Pill
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Patient, Medicine, Wholesaler } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { cn, formatCurrency } from '../lib/utils';
import { 
  calculatePredictedOrders, 
  PredictedOrderItem, 
  WholesalerPredictedOrderGroup, 
  RecurringPatientDemand,
  generatePredictedOrderWhatsAppText,
  generatePredictedOrderPDF,
  exportPredictedOrdersCSV
} from '../lib/predictedOrderUtils';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { triggerSafeLinkRedirect } from './AppAccessLinkPortal';

interface PredictedOrderListProps {
  onNavigateTab?: (tab: string) => void;
  patients?: Patient[];
  inventoryMedicines?: Medicine[];
  wholesalers?: Wholesaler[];
}

export const PredictedOrderList: React.FC<PredictedOrderListProps> = ({
  onNavigateTab,
  patients: initialPatients,
  inventoryMedicines: initialMedicines,
  wholesalers: initialWholesalers
}) => {
  const { tText } = useLanguage();

  // Internal live state if not passed from parent
  const [patients, setPatients] = useState<Patient[]>(initialPatients || []);
  const [medicines, setMedicines] = useState<Medicine[]>(initialMedicines || []);
  const [wholesalers, setWholesalers] = useState<Wholesaler[]>(initialWholesalers || []);
  const [isLoading, setIsLoading] = useState(!initialPatients || !initialMedicines);

  // Configuration and Filters
  const [bufferPct, setBufferPct] = useState<number>(10);
  const [activeViewMode, setActiveViewMode] = useState<'items' | 'wholesalers' | 'patients'>('items');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'critical_deficit' | 'low_buffer' | 'sufficient_stock'>('all');
  const [selectedWholesalerFilter, setSelectedWholesalerFilter] = useState<string>('all');
  const [selectedConditionFilter, setSelectedConditionFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'deficit' | 'demand' | 'cost' | 'name'>('deficit');

  // Modal / Drawer state
  const [inspectingMedicine, setInspectingMedicine] = useState<PredictedOrderItem | null>(null);
  const [aiAnalysisOpen, setAiAnalysisOpen] = useState(false);
  const [copiedWholesalerId, setCopiedWholesalerId] = useState<string | null>(null);

  // Subscribe to live collections if not supplied
  useEffect(() => {
    if (initialPatients && initialMedicines && initialWholesalers) {
      setPatients(initialPatients);
      setMedicines(initialMedicines);
      setWholesalers(initialWholesalers);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const unsubPatients = onSnapshot(collection(db, 'patients'), (snapshot) => {
      const pList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
      setPatients(pList);
    }, (err) => console.warn('Patients snapshot handled:', err));

    const unsubMedicines = onSnapshot(collection(db, 'medicines'), (snapshot) => {
      const mList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Medicine));
      setMedicines(mList);
    }, (err) => console.warn('Medicines snapshot handled:', err));

    const unsubWholesalers = onSnapshot(collection(db, 'wholesalers'), (snapshot) => {
      const wList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Wholesaler));
      setWholesalers(wList);
      setIsLoading(false);
    }, (err) => {
      console.warn('Wholesalers snapshot handled:', err);
      setIsLoading(false);
    });

    return () => {
      unsubPatients();
      unsubMedicines();
      unsubWholesalers();
    };
  }, [initialPatients, initialMedicines, initialWholesalers]);

  // Compute 30-Day Predicted Orders Analysis
  const analysis = useMemo(() => {
    return calculatePredictedOrders(patients, medicines, wholesalers, bufferPct);
  }, [patients, medicines, wholesalers, bufferPct]);

  // Filter and sort items for display
  const filteredItems = useMemo(() => {
    return analysis.items.filter(item => {
      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = item.medicineName.toLowerCase().includes(term);
        const matchesGeneric = item.genericFormula.toLowerCase().includes(term);
        const matchesSupplier = item.supplierName.toLowerCase().includes(term);
        const matchesPatient = item.patients.some(p => p.patientName.toLowerCase().includes(term));
        if (!matchesName && !matchesGeneric && !matchesSupplier && !matchesPatient) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all' && item.stockStatus !== statusFilter) {
        return false;
      }

      // Wholesaler filter
      if (selectedWholesalerFilter !== 'all' && item.supplierName !== selectedWholesalerFilter) {
        return false;
      }

      // Condition filter
      if (selectedConditionFilter !== 'all') {
        if (!item.chronicTags.includes(selectedConditionFilter)) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'deficit') {
        const statusPriority = { critical_deficit: 0, low_buffer: 1, sufficient_stock: 2 };
        if (statusPriority[a.stockStatus] !== statusPriority[b.stockStatus]) {
          return statusPriority[a.stockStatus] - statusPriority[b.stockStatus];
        }
        return b.deficitQuantity - a.deficitQuantity;
      }
      if (sortBy === 'demand') return b.totalRequiredQuantity - a.totalRequiredQuantity;
      if (sortBy === 'cost') return b.totalEstimatedWholesaleCost - a.totalEstimatedWholesaleCost;
      return a.medicineName.localeCompare(b.medicineName);
    });
  }, [analysis.items, searchTerm, statusFilter, selectedWholesalerFilter, selectedConditionFilter, sortBy]);

  // Unique suppliers list for filter dropdown
  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    analysis.items.forEach(i => set.add(i.supplierName));
    return Array.from(set);
  }, [analysis.items]);

  // Enrolled recurring patients list for Patient Roster view
  const enrolledPatientsList = useMemo(() => {
    return patients.filter(p => p.isMonthlyCustomer || (p.monthlyMedicines && p.monthlyMedicines.length > 0));
  }, [patients]);

  const handleExportCSV = () => {
    exportPredictedOrdersCSV(filteredItems, `Satyam_30Day_Predicted_Order_List_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleSendWhatsAppOrder = (group: WholesalerPredictedOrderGroup) => {
    const text = generatePredictedOrderWhatsAppText(group, 'Satyam Medical Store');
    const cleanPhone = group.contactNumber.replace(/[^0-9]/g, '');
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${text}` : `https://wa.me/?text=${text}`;
    triggerSafeLinkRedirect(url, `WhatsApp Order (${group.wholesalerName})`);
  };

  const handleDownloadPDF = (group: WholesalerPredictedOrderGroup) => {
    generatePredictedOrderPDF(group, 'Satyam Medical Store');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
        <RefreshCw size={36} className="animate-spin text-blue-600 dark:text-blue-400" />
        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
          {tText('Analyzing 30-Day Recurring Customer Prescriptions...', 'मासिक ग्राहकों की आगामी 30 दिनों की दवाइयों का विश्लेषण हो रहा है...')}
        </p>
        <p className="text-xs text-slate-500">Cross-referencing live inventory stock levels and wholesale packaging...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Hero & KPI Cards */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 p-6 sm:p-7 text-white shadow-xl border border-indigo-900/50">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 border border-blue-400/40 px-3 py-0.5 text-xs font-bold text-blue-200">
                  <ShoppingCart size={13} className="text-blue-300" />
                  <span>30-Day Customer Demand Forecast</span>
                </span>

                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                  <Users size={12} />
                  <span>{analysis.totalEnrolledPatients} Recurring Customers</span>
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
                <span>Predicted Wholesale Order List</span>
                <span className="text-xs font-normal text-slate-300 rounded-lg bg-white/10 px-2.5 py-1">
                  Next 30 Days
                </span>
              </h2>

              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Calculated automatically from all enrolled regular monthly patients. Cross-referenced with your current inventory to prevent stockouts and batch distributor orders.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-3.5 py-2 text-xs font-bold text-white transition-all cursor-pointer shadow-sm"
              >
                <Download size={14} />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setAiAnalysisOpen(!aiAnalysisOpen)}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 px-3.5 py-2 text-xs font-bold text-slate-950 transition-all cursor-pointer shadow-md active:scale-95"
              >
                <Sparkles size={14} className="text-slate-950 fill-current" />
                <span>AI Procurement Strategy</span>
              </button>

              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('wholesalers')}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-3.5 py-2 text-xs font-bold text-white transition-all cursor-pointer shadow-md"
                >
                  <Building2 size={14} />
                  <span>Wholesalers Tab</span>
                  <ChevronRight size={13} />
                </button>
              )}
            </div>
          </div>

          {/* KPI Dashboard Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Metric 1: Total Demand */}
            <div className="rounded-2xl bg-white/10 backdrop-blur-md p-4 border border-white/10">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-[11px] font-bold uppercase tracking-wider">Total 30d Demand</span>
                <Pill size={16} className="text-blue-400" />
              </div>
              <p className="text-2xl font-black text-white mt-1">
                {analysis.totalUnitsRequired.toLocaleString('en-IN')}
                <span className="text-xs font-normal text-slate-300 ml-1">units</span>
              </p>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-300">
                <span>{analysis.totalUniqueMedicines} Unique SKUs</span>
                <span>•</span>
                <span>{analysis.totalActiveRecurringPrescriptions} Prescriptions</span>
              </div>
            </div>

            {/* Metric 2: Stock Deficit / Urgent Orders */}
            <div className={cn(
              "rounded-2xl p-4 border backdrop-blur-md transition-all",
              analysis.criticalDeficitCount > 0 
                ? "bg-rose-500/20 border-rose-400/40 text-rose-100" 
                : "bg-emerald-500/20 border-emerald-400/40 text-emerald-100"
            )}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider">Critical Stock Deficits</span>
                <AlertTriangle size={16} className={analysis.criticalDeficitCount > 0 ? "text-rose-400" : "text-emerald-400"} />
              </div>
              <p className="text-2xl font-black text-white mt-1">
                {analysis.criticalDeficitCount}
                <span className="text-xs font-normal text-slate-300 ml-1.5">SKUs short</span>
              </p>
              <p className="mt-1 text-[11px] text-slate-300">
                {analysis.criticalDeficitCount > 0 
                  ? `Immediate wholesale dispatch needed`
                  : `All recurring demand covered in stock`}
              </p>
            </div>

            {/* Metric 3: Estimated Procurement Cost */}
            <div className="rounded-2xl bg-white/10 backdrop-blur-md p-4 border border-white/10">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-[11px] font-bold uppercase tracking-wider">Est. Wholesale Cost</span>
                <IndianRupee size={16} className="text-amber-400" />
              </div>
              <p className="text-2xl font-black text-amber-300 mt-1">
                ₹{analysis.totalEstimatedProcurementCost.toLocaleString('en-IN')}
              </p>
              <p className="mt-1 text-[11px] text-slate-300">
                To replenish {analysis.totalUnitsToProcure} units (+{bufferPct}% safety)
              </p>
            </div>

            {/* Metric 4: Projected Retail Value & Profit */}
            <div className="rounded-2xl bg-emerald-500/15 backdrop-blur-md p-4 border border-emerald-400/30">
              <div className="flex items-center justify-between text-emerald-300">
                <span className="text-[11px] font-bold uppercase tracking-wider">Projected Revenue & Margin</span>
                <TrendingUp size={16} className="text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-emerald-300 mt-1">
                ₹{analysis.totalProjectedRetailRevenue.toLocaleString('en-IN')}
              </p>
              <div className="flex items-center justify-between mt-1 text-[11px] text-emerald-200">
                <span>Profit: ₹{analysis.totalProjectedGrossProfit.toLocaleString('en-IN')}</span>
                <span className="font-bold text-emerald-300">~{analysis.projectedProfitMarginPct}% Margin</span>
              </div>
            </div>
          </div>

          {/* Timeline Dispersion Bar (4 Weeks of the Month) */}
          <div className="rounded-2xl bg-black/25 p-4 border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Clock size={13} className="text-blue-400" />
                <span>30-Day Dispensing Demand Schedule by Week:</span>
              </span>
              <span className="text-[11px] text-slate-400">
                (Based on customer preferred pickup days 1st–28th)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="rounded-xl bg-white/5 p-2.5 border border-white/5 text-center">
                <span className="text-[10px] font-bold uppercase text-slate-400">Week 1 (Days 1–7)</span>
                <p className="text-base font-black text-blue-300 mt-0.5">
                  {analysis.timelineTotals.week1} <span className="text-[10px] font-normal text-slate-400">units</span>
                </p>
                <div className="w-full bg-slate-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div 
                    className="bg-blue-400 h-full rounded-full" 
                    style={{ width: `${Math.min(100, (analysis.timelineTotals.week1 / (analysis.totalUnitsRequired || 1)) * 100)}%` }} 
                  />
                </div>
              </div>

              <div className="rounded-xl bg-white/5 p-2.5 border border-white/5 text-center">
                <span className="text-[10px] font-bold uppercase text-slate-400">Week 2 (Days 8–14)</span>
                <p className="text-base font-black text-indigo-300 mt-0.5">
                  {analysis.timelineTotals.week2} <span className="text-[10px] font-normal text-slate-400">units</span>
                </p>
                <div className="w-full bg-slate-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div 
                    className="bg-indigo-400 h-full rounded-full" 
                    style={{ width: `${Math.min(100, (analysis.timelineTotals.week2 / (analysis.totalUnitsRequired || 1)) * 100)}%` }} 
                  />
                </div>
              </div>

              <div className="rounded-xl bg-white/5 p-2.5 border border-white/5 text-center">
                <span className="text-[10px] font-bold uppercase text-slate-400">Week 3 (Days 15–21)</span>
                <p className="text-base font-black text-purple-300 mt-0.5">
                  {analysis.timelineTotals.week3} <span className="text-[10px] font-normal text-slate-400">units</span>
                </p>
                <div className="w-full bg-slate-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div 
                    className="bg-purple-400 h-full rounded-full" 
                    style={{ width: `${Math.min(100, (analysis.timelineTotals.week3 / (analysis.totalUnitsRequired || 1)) * 100)}%` }} 
                  />
                </div>
              </div>

              <div className="rounded-xl bg-white/5 p-2.5 border border-white/5 text-center">
                <span className="text-[10px] font-bold uppercase text-slate-400">Week 4 (Days 22–30)</span>
                <p className="text-base font-black text-amber-300 mt-0.5">
                  {analysis.timelineTotals.week4} <span className="text-[10px] font-normal text-slate-400">units</span>
                </p>
                <div className="w-full bg-slate-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div 
                    className="bg-amber-400 h-full rounded-full" 
                    style={{ width: `${Math.min(100, (analysis.timelineTotals.week4 / (analysis.totalUnitsRequired || 1)) * 100)}%` }} 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Procurement Strategy Blueprint Slide-Down */}
      <AnimatePresence>
        {aiAnalysisOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-amber-500/10 border border-amber-300/40 dark:border-amber-700/40 p-6 space-y-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-slate-950 font-bold">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                    AI Chronic Procurement & Stocking Insights
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Optimization strategies for high-volume recurring prescriptions across your {analysis.totalEnrolledPatients} regular customers
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAiAnalysisOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 pt-2 text-xs">
              <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-amber-200/60 dark:border-amber-900/50 space-y-2">
                <span className="font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider text-[10px]">
                  1. Bulk Tier Negotiations
                </span>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  Your top chronic molecules (Metformin, Telmisartan, Atorvastatin) account for <strong>{Math.round((analysis.timelineTotals.week1 + analysis.timelineTotals.week2) / (analysis.totalUnitsRequired || 1) * 100)}%</strong> of early-month demand. Consolidate into 100-pack boxes to request an extra 3–5% wholesale margin.
                </p>
              </div>

              <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-amber-200/60 dark:border-amber-900/50 space-y-2">
                <span className="font-bold text-blue-800 dark:text-blue-400 uppercase tracking-wider text-[10px]">
                  2. Lead-Time Buffer Staggering
                </span>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  Place purchase orders by <strong>28th of every month</strong> for Week 1 patients (Days 1–7) to prevent stockouts before customer pickup dates.
                </p>
              </div>

              <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-amber-200/60 dark:border-amber-900/50 space-y-2">
                <span className="font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider text-[10px]">
                  3. Generic Margin Boost Opportunity
                </span>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  Patients taking high-cost branded cardiac and diabetic therapies can be offered certified generic IP salts with physician consent to increase retail margins by up to <strong>45%</strong>.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Controls Bar: View Mode Switcher, Buffer Slider, Search, Filters */}
      <div className="space-y-4">
        {/* Main View Mode Selector & Safety Buffer Slider */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
          {/* View Mode Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveViewMode('items')}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-all cursor-pointer",
                activeViewMode === 'items'
                  ? "bg-white text-blue-700 dark:bg-slate-900 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              )}
            >
              <Package size={14} />
              <span>Itemized Demand & Deficits</span>
              <span className="rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 text-[10px]">
                {analysis.items.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveViewMode('wholesalers')}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-all cursor-pointer",
                activeViewMode === 'wholesalers'
                  ? "bg-white text-blue-700 dark:bg-slate-900 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              )}
            >
              <Building2 size={14} />
              <span>Wholesaler PO Bundles</span>
              <span className="rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 text-[10px]">
                {analysis.wholesalerGroups.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveViewMode('patients')}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-all cursor-pointer",
                activeViewMode === 'patients'
                  ? "bg-white text-blue-700 dark:bg-slate-900 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              )}
            >
              <Users size={14} />
              <span>Customer Roster</span>
              <span className="rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 text-[10px]">
                {enrolledPatientsList.length}
              </span>
            </button>
          </div>

          {/* Buffer Percentage Selector */}
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-2 px-3 border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
              <Sliders size={13} className="text-blue-600" />
              <span>Safety Buffer:</span>
            </div>

            <div className="flex items-center gap-1">
              {[0, 10, 15, 20].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setBufferPct(val)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer",
                    bufferPct === val
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  )}
                >
                  +{val}%
                </button>
              ))}
            </div>

            <span className="text-[11px] text-slate-400 hidden sm:inline">
              (Adds safety cushion for walk-in surge)
            </span>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search Input */}
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search medicine, salt, patient, supplier..."
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2.5 text-xs font-bold text-slate-900 placeholder:text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Stock Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white shadow-2xs"
            >
              <option value="all">All Inventory Statuses ({analysis.items.length})</option>
              <option value="critical_deficit">🔴 Critical Deficit Only ({analysis.criticalDeficitCount})</option>
              <option value="low_buffer">🟡 Low Buffer Tight ({analysis.lowBufferCount})</option>
              <option value="sufficient_stock">🟢 Sufficient Stock ({analysis.sufficientStockCount})</option>
            </select>
          </div>

          {/* Wholesaler / Supplier Filter */}
          <div>
            <select
              value={selectedWholesalerFilter}
              onChange={(e) => setSelectedWholesalerFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white shadow-2xs"
            >
              <option value="all">All Wholesalers & Distributors</option>
              {uniqueSuppliers.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white shadow-2xs"
            >
              <option value="deficit">Sort: Highest Stock Deficit First</option>
              <option value="demand">Sort: Highest Total Demand First</option>
              <option value="cost">Sort: Highest Wholesale Cost First</option>
              <option value="name">Sort: Medicine Name (A to Z)</option>
            </select>
          </div>
        </div>

        {/* Chronic Condition Filter Pills */}
        {analysis.conditionBreakdown.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[11px] font-bold text-slate-500 shrink-0 uppercase tracking-wider">
              Filter by Condition:
            </span>
            <button
              type="button"
              onClick={() => setSelectedConditionFilter('all')}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-bold transition-all shrink-0 cursor-pointer",
                selectedConditionFilter === 'all'
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100"
              )}
            >
              All Conditions
            </button>

            {analysis.conditionBreakdown.map((cond) => (
              <button
                key={cond.name}
                type="button"
                onClick={() => setSelectedConditionFilter(cond.name)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all shrink-0 cursor-pointer",
                  selectedConditionFilter === cond.name
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100"
                )}
              >
                <HeartPulse size={12} className={selectedConditionFilter === cond.name ? "text-white" : "text-rose-500"} />
                <span>{cond.name}</span>
                <span className="rounded-full bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.2 text-[10px]">
                  {cond.patientCount} pts
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* VIEW MODE 1: ITEMIZED DEMAND & DEFICIT TABLE */}
      {activeViewMode === 'items' && (
        <div className="space-y-4">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
              <Package size={36} className="text-slate-400" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No matching medications found
              </p>
              <p className="text-xs text-slate-500 max-w-sm">
                Try adjusting your search query, status filters, or chronic condition selection.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3.5 pl-4">Medicine & Formula</th>
                      <th className="p-3.5">Supplier / Wholesaler</th>
                      <th className="p-3.5 text-center">30d Demand (+{bufferPct}%)</th>
                      <th className="p-3.5 text-center">Current Stock</th>
                      <th className="p-3.5 text-center">Stock Deficit</th>
                      <th className="p-3.5 text-center">Order Qty</th>
                      <th className="p-3.5 text-right">Est. Wholesale Cost</th>
                      <th className="p-3.5 text-right">Est. Retail Value</th>
                      <th className="p-3.5 text-center pr-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {filteredItems.map((item) => (
                      <tr 
                        key={item.medicineId}
                        className={cn(
                          "transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40",
                          item.stockStatus === 'critical_deficit' && "bg-rose-50/30 dark:bg-rose-950/10"
                        )}
                      >
                        {/* Medicine Name & Salt */}
                        <td className="p-3.5 pl-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 dark:text-slate-100 text-xs">
                                {item.medicineName}
                              </span>
                              {item.stockStatus === 'critical_deficit' && (
                                <span className="rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 px-2 py-0.2 text-[9px] font-black uppercase tracking-wider border border-rose-200 dark:border-rose-900">
                                  Shortage
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                              {item.genericFormula}
                            </p>
                            {item.chronicTags.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {item.chronicTags.map(tag => (
                                  <span key={tag} className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[9px] font-bold text-slate-600 dark:text-slate-300">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Supplier */}
                        <td className="p-3.5 text-slate-600 dark:text-slate-300">
                          <div className="space-y-0.5">
                            <p className="font-bold text-slate-800 dark:text-slate-200 line-clamp-1">
                              {item.supplierName}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              Mfr: {item.manufacturer}
                            </p>
                          </div>
                        </td>

                        {/* 30-Day Demand */}
                        <td className="p-3.5 text-center">
                          <div className="space-y-0.5">
                            <span className="font-black text-slate-900 dark:text-slate-100 text-xs">
                              {item.totalRequiredQuantity}
                            </span>
                            <p className="text-[10px] text-slate-400">
                              (+{bufferPct}% = {item.bufferedQuantity})
                            </p>
                          </div>
                        </td>

                        {/* Current In Stock */}
                        <td className="p-3.5 text-center">
                          <span className={cn(
                            "inline-block rounded-lg px-2 py-1 font-bold text-xs",
                            item.inStockQuantity < item.totalRequiredQuantity
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : item.inStockQuantity < item.bufferedQuantity + item.minThreshold
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          )}>
                            {item.inStockQuantity} units
                          </span>
                        </td>

                        {/* Stock Deficit */}
                        <td className="p-3.5 text-center">
                          {item.deficitQuantity > 0 ? (
                            <span className="font-black text-rose-600 dark:text-rose-400 text-xs">
                              -{item.deficitQuantity} units
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center gap-1">
                              <CheckCircle2 size={13} />
                              <span>Covered</span>
                            </span>
                          )}
                        </td>

                        {/* Recommended Order Qty */}
                        <td className="p-3.5 text-center">
                          <div className="space-y-0.5">
                            <span className={cn(
                              "font-black text-xs px-2.5 py-1 rounded-lg",
                              item.recommendedOrderQuantity > 0 
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                                : "text-slate-400"
                            )}>
                              {item.recommendedOrderQuantity > 0 ? `${item.recommendedOrderQuantity} ${item.packType}` : '0'}
                            </span>
                          </div>
                        </td>

                        {/* Est. Wholesale Cost */}
                        <td className="p-3.5 text-right font-extrabold text-slate-800 dark:text-slate-200">
                          ₹{item.totalEstimatedWholesaleCost.toLocaleString('en-IN')}
                          <div className="text-[10px] font-normal text-slate-400">
                            @ ₹{item.unitWholesaleCost}/u
                          </div>
                        </td>

                        {/* Est. Retail Value */}
                        <td className="p-3.5 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                          ₹{item.totalEstimatedSalesValue.toLocaleString('en-IN')}
                          <div className="text-[10px] font-normal text-slate-400">
                            MRP ₹{item.unitRate}/u
                          </div>
                        </td>

                        {/* Actions (View Patients) */}
                        <td className="p-3.5 text-center pr-4">
                          <button
                            type="button"
                            onClick={() => setInspectingMedicine(item)}
                            className="inline-flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-700 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                          >
                            <Users size={12} />
                            <span>{item.patientCount} Pts</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: WHOLESALER PURCHASE ORDER BUNDLES */}
      {activeViewMode === 'wholesalers' && (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {analysis.wholesalerGroups.map((group) => (
            <div
              key={group.wholesalerName}
              className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-sm space-y-4"
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                        <Building2 size={16} />
                      </span>
                      <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                        {group.wholesalerName}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Phone size={12} />
                      <span>{group.contactNumber}</span>
                      <span>•</span>
                      <span>Lead Time: {group.leadTimeDays}d</span>
                    </p>
                  </div>

                  {group.criticalDeficitCount > 0 && (
                    <span className="rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                      {group.criticalDeficitCount} Urgent
                    </span>
                  )}
                </div>

                {/* Metrics Box */}
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Order Value</span>
                    <p className="text-base font-black text-blue-700 dark:text-blue-300 mt-0.5">
                      ₹{group.totalOrderCost.toLocaleString('en-IN')}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Items & Units</span>
                    <p className="text-base font-black text-slate-900 dark:text-slate-100 mt-0.5">
                      {group.totalUniqueMedicines} SKUs ({group.totalUnitsToOrder} u)
                    </p>
                  </div>
                </div>

                {/* MOV Status */}
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-slate-500 text-[11px]">Min Order Value (MOV): ₹{group.minimumOrderValue}</span>
                  {group.meetsMinimumOrderValue ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      <span>MOV Met</span>
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 font-bold text-[11px]">
                      Below MOV (₹{group.minimumOrderValue - group.totalOrderCost} short)
                    </span>
                  )}
                </div>

                {/* Item List Preview */}
                <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    Medicines to Order:
                  </span>
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {group.items.map((med) => (
                      <div key={med.medicineId} className="flex items-center justify-between text-xs py-0.5">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className={cn(
                            "h-1.5 w-1.5 rounded-full shrink-0",
                            med.stockStatus === 'critical_deficit' ? "bg-rose-500" : "bg-blue-500"
                          )} />
                          <span className="text-slate-800 dark:text-slate-200 truncate">{med.medicineName}</span>
                        </div>
                        <span className="font-black text-slate-900 dark:text-slate-100 shrink-0">
                          {med.recommendedOrderQuantity} {med.packType}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => handleSendWhatsAppOrder(group)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-xs font-bold text-white transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <Share2 size={13} />
                  <span>WhatsApp PO</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadPDF(group)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 transition-all cursor-pointer shadow-xs"
                >
                  <Printer size={13} />
                  <span>Print PO PDF</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VIEW MODE 3: CUSTOMER RECURRING ROSTER */}
      {activeViewMode === 'patients' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {enrolledPatientsList.map((patient) => {
            const activeMeds = (patient.monthlyMedicines || []).filter(m => m.isActive !== false);
            const totalPkgVal = activeMeds.reduce((acc, i) => acc + ((i.estimatedRate || 10) * (i.monthlyQuantity || 30)), 0);
            const prefDay = patient.preferredDayOfMonth || 5;

            return (
              <div
                key={patient.id}
                className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-sm space-y-3"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">
                        {patient.name}
                      </h4>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone size={11} />
                        <span>{patient.mobile}</span>
                      </p>
                    </div>

                    <span className="rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-2.5 py-0.5 text-xs font-bold border border-blue-200 dark:border-blue-900">
                      Day {prefDay} of month
                    </span>
                  </div>

                  {patient.chronicConditions && patient.chronicConditions.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {patient.chronicConditions.map(c => (
                        <span key={c} className="rounded-md bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 px-2 py-0.2 text-[10px] font-bold">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Medicines List */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                      <span>Prescribed Refill Medicines ({activeMeds.length}):</span>
                      <span className="text-emerald-600 dark:text-emerald-400">₹{totalPkgVal} / mo</span>
                    </div>

                    <div className="space-y-1">
                      {activeMeds.map((med, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs py-0.5 text-slate-700 dark:text-slate-300">
                          <span className="truncate pr-2">• {med.name}</span>
                          <span className="font-bold shrink-0">{med.monthlyQuantity} {med.unit || 'Tabs'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('patients')}
                    className="w-full rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 p-2 text-center text-xs font-bold text-blue-600 dark:text-blue-400 transition-colors cursor-pointer"
                  >
                    Open Patient Clinical Profile →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* PATIENT BREAKDOWN DRILL-DOWN MODAL */}
      <AnimatePresence>
        {inspectingMedicine && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="space-y-1">
                  <span className="rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                    Customer Demand Roster
                  </span>
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                    {inspectingMedicine.medicineName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Formula: {inspectingMedicine.genericFormula} • Supplier: {inspectingMedicine.supplierName}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setInspectingMedicine(null)}
                  className="rounded-xl bg-slate-100 dark:bg-slate-800 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Quick Summary Grid */}
              <div className="grid grid-cols-3 gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5 text-xs text-center">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">30d Demand</span>
                  <p className="text-base font-black text-slate-900 dark:text-slate-100 mt-0.5">
                    {inspectingMedicine.totalRequiredQuantity} units
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">In Stock</span>
                  <p className={cn(
                    "text-base font-black mt-0.5",
                    inspectingMedicine.inStockQuantity < inspectingMedicine.totalRequiredQuantity
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  )}>
                    {inspectingMedicine.inStockQuantity} units
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Deficit / To Order</span>
                  <p className="text-base font-black text-blue-600 dark:text-blue-400 mt-0.5">
                    {inspectingMedicine.recommendedOrderQuantity} {inspectingMedicine.packType}
                  </p>
                </div>
              </div>

              {/* Patient List */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">
                  Enrolled Regular Patients Taking This Medicine ({inspectingMedicine.patients.length}):
                </h4>

                <div className="space-y-2">
                  {inspectingMedicine.patients.map((pat, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-800/40 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {pat.patientName}
                          </span>
                          <span className="rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 text-[10px] font-bold">
                            {pat.refillDayLabel}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {pat.mobile} • Dosage: {pat.dosage || '1-0-1'}
                        </p>
                        {pat.instructions && (
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 italic">
                            Note: {pat.instructions}
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="font-black text-sm text-slate-900 dark:text-slate-100">
                          {pat.monthlyQuantity}
                        </span>
                        <p className="text-[10px] text-slate-400">units/mo</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setInspectingMedicine(null)}
                  className="w-full rounded-xl bg-blue-600 p-3 text-xs font-bold text-white hover:bg-blue-500 transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PredictedOrderList;
