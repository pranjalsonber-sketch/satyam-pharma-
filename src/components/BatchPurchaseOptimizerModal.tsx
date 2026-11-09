import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Package, 
  Users, 
  Calendar, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  IndianRupee, 
  Send, 
  Download, 
  Copy, 
  Check, 
  RefreshCw, 
  Sliders, 
  ShieldAlert, 
  Phone, 
  FileText, 
  ArrowRight, 
  Info,
  ChevronDown,
  ChevronUp,
  X,
  Plus,
  Minus,
  Truck,
  Layers,
  Zap,
  BarChart3
} from 'lucide-react';
import { collection, getDocs, query, addDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Medicine, Wholesaler, BatchOptimizerAnalysis, OptimizedWholesalerOrder, OptimizedOrderItem } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { cn, formatCurrency } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from './AuthProvider';
import { canViewFinancials, canViewSuppliers } from '../lib/permissions';
import { SensitiveValueMask } from './SensitiveValueMask';
import { logAuditAction } from '../lib/auditLogger';

interface BatchPurchaseOptimizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialWholesalerId?: string;
  onOrderCreated?: () => void;
}

export const BatchPurchaseOptimizerModal: React.FC<BatchPurchaseOptimizerModalProps> = ({
  isOpen,
  onClose,
  initialWholesalerId,
  onOrderCreated
}) => {
  const { t, tText } = useLanguage();
  const { profile } = useAuth();
  const isFinancialAuthorized = canViewFinancials(profile);
  const isSupplierAuthorized = canViewSuppliers(profile);

  // State
  const [loading, setLoading] = useState(false);
  const [wholesalers, setWholesalers] = useState<Wholesaler[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<BatchOptimizerAnalysis | null>(null);

  // Optimizer Parameters
  const [planningHorizonDays, setPlanningHorizonDays] = useState<number>(30);
  const [safetyStockMultiplier, setSafetyStockMultiplier] = useState<number>(1.5);
  const [selectedWholesalerFilter, setSelectedWholesalerFilter] = useState<string>(initialWholesalerId || 'all');
  const [expandedWholesalerIds, setExpandedWholesalerIds] = useState<Record<string, boolean>>({});

  // Local Quantity Overrides for pharmacist manual adjustments
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});

  // Action status
  const [copiedWholesalerId, setCopiedWholesalerId] = useState<string | null>(null);
  const [draftingBillId, setDraftingBillId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Fetch base data
  const loadDataAndOptimize = async () => {
    try {
      setLoading(true);

      // 1. Fetch Wholesalers
      const whSnap = await getDocs(query(collection(db, 'wholesalers'), orderBy('name')));
      const whList = whSnap.docs.map(d => ({ id: d.id, ...d.data() } as Wholesaler));
      setWholesalers(whList);

      // 2. Fetch Inventory
      const medSnap = await getDocs(query(collection(db, 'inventory')));
      const medList = medSnap.docs.map(d => ({ id: d.id, ...d.data() } as Medicine));
      setMedicines(medList);

      // 3. Fetch Recent Sales
      const salesSnap = await getDocs(query(collection(db, 'sales'), orderBy('timestamp', 'desc'), limit(150)));
      const sList = salesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSalesHistory(sList);

      // 4. Request AI Optimization from server
      await runOptimizer(whList, medList, sList);
    } catch (err: any) {
      console.error("Error loading optimizer data:", err);
    } finally {
      setLoading(false);
    }
  };

  const runOptimizer = async (
    whList = wholesalers, 
    medList = medicines, 
    sList = salesHistory, 
    horizon = planningHorizonDays, 
    buffer = safetyStockMultiplier
  ) => {
    try {
      setLoading(true);
      const res = await fetch("/api/ai/batch-purchase-optimizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wholesalers: whList,
          inventory: medList,
          salesHistory: sList,
          parameters: {
            planningHorizonDays: horizon,
            safetyStockMultiplier: buffer,
            targetWholesalerId: selectedWholesalerFilter !== 'all' ? selectedWholesalerFilter : undefined
          }
        })
      });

      if (!res.ok) {
        throw new Error(`Optimizer server responded with status: ${res.status}`);
      }

      const data: BatchOptimizerAnalysis = await res.json();
      setAnalysis(data);

      // Log audit for sensitive wholesale margin and investment analysis
      logAuditAction({
        action: 'Wholesale Purchase Optimizer & Margins Analyzed',
        category: 'margin_view',
        description: `Wholesale batch replenishment optimizer executed (${horizon} days horizon, ${buffer}x buffer) by ${profile?.displayName || profile?.email}`,
        module: 'wholesalers',
        userEmail: profile?.email,
        userName: profile?.displayName,
        userRole: profile?.role,
        userId: profile?.uid,
        severity: 'info',
        details: {
          planningHorizonDays: horizon,
          safetyBufferMultiplier: buffer,
          totalVendors: data.wholesalerOrders.length,
          totalRecommendedInvestment: data.totalRecommendedInvestment,
          totalEstimatedSavings: data.totalEstimatedSavings
        }
      });

      // Automatically expand first 2 wholesalers
      const initialExpanded: Record<string, boolean> = {};
      data.wholesalerOrders.forEach((wo, idx) => {
        initialExpanded[wo.wholesalerId] = idx < 2;
      });
      setExpandedWholesalerIds(initialExpanded);
      setCustomQuantities({});
    } catch (error: any) {
      console.error("Optimization execution error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDataAndOptimize();
    }
  }, [isOpen]);

  const toggleExpand = (wholesalerId: string) => {
    setExpandedWholesalerIds(prev => ({
      ...prev,
      [wholesalerId]: !prev[wholesalerId]
    }));
  };

  const handleQuantityChange = (medicineId: string, delta: number, currentQty: number) => {
    const activeQty = customQuantities[medicineId] !== undefined ? customQuantities[medicineId] : currentQty;
    const nextQty = Math.max(0, activeQty + delta);
    setCustomQuantities(prev => ({
      ...prev,
      [medicineId]: nextQty
    }));
  };

  // WhatsApp Order Formatter
  const copyWhatsAppOrder = (order: OptimizedWholesalerOrder) => {
    const itemsText = order.orderItems
      .filter(item => {
        const qty = customQuantities[item.medicineId] !== undefined ? customQuantities[item.medicineId] : item.recommendedBatchQuantity;
        return qty > 0;
      })
      .map((item, idx) => {
        const qty = customQuantities[item.medicineId] !== undefined ? customQuantities[item.medicineId] : item.recommendedBatchQuantity;
        return `${idx + 1}. *${item.medicineName}* - ${qty} ${item.packType} (Est: ₹${(qty * item.unitCost).toFixed(2)})`;
      })
      .join('\n');

    const totalEstimated = order.orderItems.reduce((sum, item) => {
      const qty = customQuantities[item.medicineId] !== undefined ? customQuantities[item.medicineId] : item.recommendedBatchQuantity;
      return sum + (qty * item.unitCost);
    }, 0);

    const message = `📋 *PURCHASE ORDER - SATYAM MEDICAL STORE & PHARMACY*\n\n` +
      `🏢 *To:* ${order.wholesalerName}\n` +
      `📅 *Date:* ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}\n` +
      `⏱️ *Expected Lead Time:* ${order.vendorLeadTimeDays} Days\n\n` +
      `*REQUIRED MEDICINES & BATCHES:*\n` +
      `${itemsText}\n\n` +
      `💰 *Estimated Total Value:* ₹${totalEstimated.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
      `📍 *Delivery Address:* Satyam Medical Store, Main Hospital Road\n` +
      `⚠️ *Note:* Please dispatch fresh batches with minimum 18-month shelf life. Send invoice on delivery.`;

    navigator.clipboard.writeText(message);
    setCopiedWholesalerId(order.wholesalerId);
    setSuccessToast(`Purchase Order copied! Ready to paste into WhatsApp for ${order.wholesalerName}`);
    setTimeout(() => setCopiedWholesalerId(null), 3000);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // Convert to Draft Bill in Firestore
  const handleDraftBill = async (order: OptimizedWholesalerOrder) => {
    try {
      setDraftingBillId(order.wholesalerId);
      const totalEstimated = order.orderItems.reduce((sum, item) => {
        const qty = customQuantities[item.medicineId] !== undefined ? customQuantities[item.medicineId] : item.recommendedBatchQuantity;
        return sum + (qty * item.unitCost);
      }, 0);

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (order.vendorLeadTimeDays || 3) + 15);

      await addDoc(collection(db, 'bills'), {
        wholesalerId: order.wholesalerId,
        wholesalerName: order.wholesalerName,
        amount: totalEstimated,
        dueDate: dueDate.toISOString().split('T')[0],
        status: 'pending',
        uploadedAt: new Date().toISOString(),
        items: order.orderItems.map(it => ({
          medicineId: it.medicineId,
          name: it.medicineName,
          quantity: customQuantities[it.medicineId] !== undefined ? customQuantities[it.medicineId] : it.recommendedBatchQuantity,
          rate: it.unitCost,
          packType: it.packType
        })),
        notes: `Auto-generated via AI Batch Purchase Optimizer (${planningHorizonDays}-Day Planning Horizon)`
      });

      setSuccessToast(`Draft Bill of ₹${totalEstimated.toLocaleString('en-IN')} created for ${order.wholesalerName}`);
      
      // Log audit for automated purchase order creation
      logAuditAction({
        action: 'Wholesale Purchase Order / Draft Bill Created',
        category: 'financial_export',
        description: `Automated Purchase Order of ₹${totalEstimated.toFixed(2)} drafted for vendor [${order.wholesalerName}] with ${order.orderItems.length} line items by ${profile?.displayName || profile?.email}`,
        module: 'wholesalers',
        userEmail: profile?.email,
        userName: profile?.displayName,
        userRole: profile?.role,
        userId: profile?.uid,
        severity: 'info',
        details: {
          wholesalerId: order.wholesalerId,
          wholesalerName: order.wholesalerName,
          itemCount: order.orderItems.length,
          totalEstimatedAmount: totalEstimated,
          horizonDays: planningHorizonDays
        }
      });

      if (onOrderCreated) onOrderCreated();
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      console.error("Error creating draft bill:", err);
    } finally {
      setDraftingBillId(null);
    }
  };

  // Filtered Wholesaler Orders
  const displayedOrders = useMemo(() => {
    if (!analysis) return [];
    if (selectedWholesalerFilter === 'all') return analysis.wholesalerOrders;
    return analysis.wholesalerOrders.filter(o => o.wholesalerId === selectedWholesalerFilter);
  }, [analysis, selectedWholesalerFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="bg-white dark:bg-slate-900 w-full max-w-6xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden my-auto"
      >
        {/* Header Ribbon */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shadow-inner">
              <Sparkles size={24} className="text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  AI Batch Purchase Optimizer
                </h2>
                <span className="bg-blue-500/30 text-blue-200 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-blue-400/30">
                  Lead-Time & EOQ
                </span>
              </div>
              <p className="text-xs text-blue-200/80 mt-0.5">
                Intelligent vendor replenishment based on empirical sales velocity and distributor lead times
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Global Success Notification Toast */}
        <AnimatePresence>
          {successToast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between gap-2 shadow-md shrink-0"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>{successToast}</span>
              </div>
              <button onClick={() => setSuccessToast(null)} className="text-white/80 hover:text-white">
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Parameter Controls Bar */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              {/* Planning Horizon */}
              <div className="flex items-center gap-1.5">
                <Calendar size={14} className="text-blue-600 dark:text-blue-400" />
                <span className="font-bold text-slate-700 dark:text-slate-300">Horizon:</span>
                <select 
                  value={planningHorizonDays}
                  onChange={(e) => {
                    const h = Number(e.target.value);
                    setPlanningHorizonDays(h);
                    runOptimizer(wholesalers, medicines, salesHistory, h, safetyStockMultiplier);
                  }}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                >
                  <option value={15}>15 Days (Bi-Weekly)</option>
                  <option value={30}>30 Days (Standard Month)</option>
                  <option value={45}>45 Days (Extended Buffer)</option>
                  <option value={60}>60 Days (Bi-Monthly Bulk)</option>
                </select>
              </div>

              {/* Safety Buffer Multiplier */}
              <div className="flex items-center gap-1.5">
                <Truck size={14} className="text-indigo-600 dark:text-indigo-400" />
                <span className="font-bold text-slate-700 dark:text-slate-300">Lead-Time Buffer:</span>
                <select 
                  value={safetyStockMultiplier}
                  onChange={(e) => {
                    const b = Number(e.target.value);
                    setSafetyStockMultiplier(b);
                    runOptimizer(wholesalers, medicines, salesHistory, planningHorizonDays, b);
                  }}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                >
                  <option value={1.2}>1.2x (Lean / Urban Fast Vendor)</option>
                  <option value={1.5}>1.5x (Balanced / Standard)</option>
                  <option value={2.0}>2.0x (Monsoon Surge / Remote Vendor)</option>
                </select>
              </div>

              {/* Wholesaler Filter */}
              <div className="flex items-center gap-1.5">
                <Users size={14} className="text-purple-600 dark:text-purple-400" />
                <span className="font-bold text-slate-700 dark:text-slate-300">Filter Vendor:</span>
                <select 
                  value={selectedWholesalerFilter}
                  onChange={(e) => setSelectedWholesalerFilter(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer max-w-[180px] truncate"
                >
                  <option value="all">All Wholesalers ({wholesalers.length})</option>
                  {wholesalers.map(wh => (
                    <option key={wh.id} value={wh.id}>{wh.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Recalculate Button */}
            <button
              type="button"
              disabled={loading}
              onClick={() => runOptimizer()}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <RefreshCw size={13} className={cn(loading && "animate-spin")} />
              <span>{loading ? "Optimizing..." : "Re-Optimize Batches"}</span>
            </button>
          </div>
        </div>

        {/* Scrollable Optimizer Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-center">
              <div className="h-16 w-16 rounded-2xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-lg border border-blue-200 dark:border-blue-800 animate-pulse">
                <Sparkles size={32} className="text-amber-500 animate-spin-slow" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  Running Supply Chain & Lead-Time Analysis...
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                  Analyzing 30-day sales velocity, vendor transit days, batch minimum thresholds, and volume discount tiers.
                </p>
              </div>
            </div>
          ) : analysis ? (
            <>
              {/* Executive Metrics Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="p-4 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 shadow-2xs">
                  <div className="flex items-center justify-between text-blue-700 dark:text-blue-300">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Total Recommended PO Value</span>
                    <IndianRupee size={16} />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
                    <SensitiveValueMask 
                      isAuthorized={isFinancialAuthorized} 
                      value={formatCurrency(analysis.totalRecommendedInvestment)} 
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Covers {analysis.planningHorizonDays}-day demand + lead-time buffer
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs">
                  <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Wholesale Margin Savings</span>
                    <TrendingUp size={16} />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1 font-mono">
                    <SensitiveValueMask 
                      isAuthorized={isFinancialAuthorized} 
                      value={formatCurrency(analysis.totalEstimatedSavings)} 
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Achieved via bulk batch discount tiers & grouped orders
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60 shadow-2xs">
                  <div className="flex items-center justify-between text-rose-700 dark:text-rose-300">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Critical Stockout Deficits</span>
                    <AlertTriangle size={16} />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 font-mono">
                    {analysis.criticalStockoutCount} Items
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Stock below threshold; urgent dispatch recommended
                  </p>
                </div>
              </div>

              {/* AI Strategic Insights Banner */}
              {analysis.strategicInsights && analysis.strategicInsights.length > 0 && (
                <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60">
                  <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-bold text-xs mb-2">
                    <Zap size={14} className="text-amber-500" />
                    <span>AI Procurement Insights & Guidance</span>
                  </div>
                  <ul className="space-y-1 text-xs text-indigo-950 dark:text-indigo-200/90">
                    {analysis.strategicInsights.map((insight, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-indigo-500 font-bold">•</span>
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Wholesaler Purchase Orders */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Optimized Purchase Orders ({displayedOrders.length} Distributors)
                  </h3>
                  <span className="text-xs text-slate-400">
                    Click card to inspect items, adjust quantities, or export PO
                  </span>
                </div>

                {displayedOrders.length > 0 ? (
                  displayedOrders.map((order) => {
                    const isExpanded = Boolean(expandedWholesalerIds[order.wholesalerId]);
                    
                    // Recalculate dynamic order total with overrides
                    const dynamicTotal = order.orderItems.reduce((sum, it) => {
                      const qty = customQuantities[it.medicineId] !== undefined ? customQuantities[it.medicineId] : it.recommendedBatchQuantity;
                      return sum + (qty * it.unitCost);
                    }, 0);

                    return (
                      <div 
                        key={order.wholesalerId}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all"
                      >
                        {/* Wholesaler Summary Header */}
                        <div 
                          onClick={() => toggleExpand(order.wholesalerId)}
                          className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <div className="flex items-start sm:items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold shrink-0">
                              <Users size={20} />
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                                  {order.wholesalerName}
                                </h4>
                                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  <Clock size={11} className="text-blue-500" />
                                  Lead Time: {order.vendorLeadTimeDays} Days
                                </span>
                                {order.meetsMinimumOrderValue ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                                    MOV Met
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
                                    Below MOV
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {order.wholesalerSummaryNote}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            <div className="text-right">
                              <div className="text-xs text-slate-400 font-medium">Est. Net Order</div>
                              <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono">
                                <SensitiveValueMask 
                                  isAuthorized={isFinancialAuthorized} 
                                  value={formatCurrency(dynamicTotal)} 
                                />
                              </div>
                            </div>

                            <div className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500">
                              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </div>
                          </div>
                        </div>

                        {/* Expandable Item Table & Action Panel */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 p-4 sm:p-5"
                            >
                              {/* Order Items Table */}
                              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                      <th className="p-3">Medicine & Salt</th>
                                      <th className="p-3 text-center">Stock / Min</th>
                                      <th className="p-3 text-center">Monthly Burn</th>
                                      <th className="p-3 text-center">Lead Buffer</th>
                                      <th className="p-3 text-center">Batch Order Qty</th>
                                      <th className="p-3 text-right">Unit Rate</th>
                                      <th className="p-3 text-right">Est. Total</th>
                                      <th className="p-3">AI Rationale</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {order.orderItems.map((item) => {
                                      const activeQty = customQuantities[item.medicineId] !== undefined 
                                        ? customQuantities[item.medicineId] 
                                        : item.recommendedBatchQuantity;
                                      const itemTotal = activeQty * item.unitCost;

                                      return (
                                        <tr key={item.medicineId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                          <td className="p-3">
                                            <div className="font-bold text-slate-900 dark:text-slate-100">
                                              {item.medicineName}
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                              <span className={cn(
                                                "text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider",
                                                item.priority === 'urgent_stockout_risk' 
                                                  ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                                  : item.priority === 'bulk_tier_saving'
                                                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                                                  : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                              )}>
                                                {item.priority === 'urgent_stockout_risk' ? 'Urgent Deficit' : 
                                                 item.priority === 'bulk_tier_saving' ? 'Bulk Tier' : 'Optimal'}
                                              </span>
                                              <span className="text-[10px] text-slate-400">{item.packType}</span>
                                            </div>
                                          </td>

                                          <td className="p-3 text-center font-mono">
                                            <span className={cn(
                                              "font-bold",
                                              item.currentStock <= item.minThreshold ? "text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-300"
                                            )}>
                                              {item.currentStock}
                                            </span>
                                            <span className="text-slate-400 text-[10px]"> / {item.minThreshold}</span>
                                          </td>

                                          <td className="p-3 text-center font-mono text-slate-600 dark:text-slate-400">
                                            {item.monthlySalesVelocity} units
                                          </td>

                                          <td className="p-3 text-center font-mono text-blue-600 dark:text-blue-400 font-bold">
                                            +{item.vendorLeadTimeBuffer} units
                                          </td>

                                          <td className="p-3 text-center">
                                            <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
                                              <button 
                                                type="button"
                                                onClick={() => handleQuantityChange(item.medicineId, -5, item.recommendedBatchQuantity)}
                                                className="h-6 w-6 rounded bg-white dark:bg-slate-700 flex items-center justify-center text-slate-600 hover:text-slate-900 cursor-pointer shadow-2xs"
                                              >
                                                <Minus size={11} />
                                              </button>
                                              <input 
                                                type="number" 
                                                value={activeQty}
                                                onChange={(e) => {
                                                  const val = Math.max(0, parseInt(e.target.value) || 0);
                                                  setCustomQuantities(prev => ({ ...prev, [item.medicineId]: val }));
                                                }}
                                                className="w-12 text-center bg-transparent font-black font-mono text-xs outline-none text-slate-900 dark:text-white"
                                              />
                                              <button 
                                                type="button"
                                                onClick={() => handleQuantityChange(item.medicineId, 5, item.recommendedBatchQuantity)}
                                                className="h-6 w-6 rounded bg-white dark:bg-slate-700 flex items-center justify-center text-slate-600 hover:text-slate-900 cursor-pointer shadow-2xs"
                                              >
                                                <Plus size={11} />
                                              </button>
                                            </div>
                                          </td>

                                          <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400">
                                            <SensitiveValueMask 
                                              isAuthorized={isFinancialAuthorized} 
                                              value={formatCurrency(item.unitCost)} 
                                            />
                                          </td>

                                          <td className="p-3 text-right font-mono font-black text-slate-900 dark:text-white">
                                            <SensitiveValueMask 
                                              isAuthorized={isFinancialAuthorized} 
                                              value={formatCurrency(itemTotal)} 
                                            />
                                          </td>

                                          <td className="p-3 max-w-[200px]">
                                            <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight">
                                              {item.justification}
                                            </div>
                                            {item.expirySafetyNote && (
                                              <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                                                ⚠️ {item.expirySafetyNote}
                                              </div>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>

                              {/* Footer Action Buttons for Wholesaler PO */}
                              <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  <span>Suggested Dispatch: </span>
                                  <span className="font-bold text-slate-800 dark:text-slate-200">
                                    {order.recommendedDispatchDate}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  {/* Copy WhatsApp Purchase Order */}
                                  <button
                                    type="button"
                                    onClick={() => copyWhatsAppOrder(order)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold transition-all cursor-pointer"
                                  >
                                    {copiedWholesalerId === order.wholesalerId ? <Check size={13} /> : <Copy size={13} />}
                                    <span>{copiedWholesalerId === order.wholesalerId ? "Copied PO!" : "Copy WhatsApp PO"}</span>
                                  </button>

                                  {/* Create Draft Invoice in Ledger */}
                                  <button
                                    type="button"
                                    disabled={draftingBillId === order.wholesalerId}
                                    onClick={() => handleDraftBill(order)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                                  >
                                    <FileText size={13} />
                                    <span>{draftingBillId === order.wholesalerId ? "Drafting..." : "Create Draft Bill"}</span>
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                      No purchase orders generated for the selected filter.
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try selecting 'All Wholesalers' or adjusting the planning horizon.
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="py-20 text-center text-slate-400">
              Click 'Re-Optimize Batches' to initialize supply chain analysis.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldAlert size={14} className="text-blue-500" />
            <span>AI algorithms verify First-Expiry-First-Out (FEFO) shelf safety.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Close Optimizer
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default BatchPurchaseOptimizerModal;
