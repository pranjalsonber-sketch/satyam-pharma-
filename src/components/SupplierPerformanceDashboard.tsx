import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  Legend
} from 'recharts';
import {
  Truck,
  Clock,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  IndianRupee,
  Download,
  Plus,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  Search,
  ChevronRight,
  X,
  ShieldCheck,
  RefreshCw,
  BarChart2,
  Layers,
  Sparkles,
  Phone,
  Mail,
  Building2,
  Percent,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Wholesaler, Bill, Medicine, SupplierPurchaseRecord, SupplierPerformanceMetrics } from '../types';
import { 
  fetchAllSupplierPurchases, 
  calculateSupplierPerformanceMetrics, 
  recordSupplierDeliveryReceipt, 
  exportSupplierPerformanceCSV 
} from '../lib/supplierPerformanceService';
import { cn, formatCurrency } from '../lib/utils';
import { useAuth } from './AuthProvider';
import { canViewFinancials } from '../lib/permissions';
import { SensitiveValueMask } from './SensitiveValueMask';
import { useLanguage } from '../context/LanguageContext';

interface SupplierPerformanceDashboardProps {
  wholesalers: Wholesaler[];
  bills?: Bill[];
  medicines?: Medicine[];
  initialSelectedWholesalerId?: string;
  onNavigateToDirectory?: () => void;
}

export const SupplierPerformanceDashboard: React.FC<SupplierPerformanceDashboardProps> = ({
  wholesalers,
  bills = [],
  medicines = [],
  initialSelectedWholesalerId,
  onNavigateToDirectory
}) => {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const isFinancialAuthorized = canViewFinancials(profile);

  // State
  const [purchases, setPurchases] = useState<SupplierPurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(initialSelectedWholesalerId || 'all');
  const [timeframeDays, setTimeframeDays] = useState<number>(180); // Default 6 months (180 days)
  const [chartMetricMode, setChartMetricMode] = useState<'spend' | 'orders' | 'leadTime'>('spend');
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'delayed' | 'on_time' | 'high_spend'>('all');

  // Modal State for Recording a new Shipment / Delivery
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordForm, setRecordForm] = useState({
    wholesalerId: wholesalers[0]?.id || '',
    orderNumber: '',
    orderDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    receivedDate: new Date().toISOString().split('T')[0],
    promisedLeadTimeDays: wholesalers[0]?.leadTimeDays || 3,
    actualLeadTimeDays: 3,
    totalAmount: 12500,
    qualityRating: 5,
    notes: ''
  });
  const [recordSuccessMessage, setRecordSuccessMessage] = useState<string | null>(null);

  // Sync initialSelectedWholesalerId prop changes
  useEffect(() => {
    if (initialSelectedWholesalerId) {
      setSelectedSupplierId(initialSelectedWholesalerId);
    }
  }, [initialSelectedWholesalerId]);

  // Load Data
  const loadData = async (showRefreshSpinner = false) => {
    try {
      if (showRefreshSpinner) setRefreshing(true);
      else setLoading(true);

      const records = await fetchAllSupplierPurchases(wholesalers, bills, medicines);
      setPurchases(records);
    } catch (err) {
      console.error("Error loading supplier purchases:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (wholesalers.length > 0) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [wholesalers, bills]);

  // Calculate Metrics
  const { metricsList, globalSummary } = useMemo(() => {
    return calculateSupplierPerformanceMetrics(wholesalers, purchases, timeframeDays);
  }, [wholesalers, purchases, timeframeDays]);

  // Active Selected Supplier Metrics (or null if "all")
  const activeSupplierMetrics = useMemo(() => {
    if (selectedSupplierId === 'all') return null;
    return metricsList.find(m => m.wholesalerId === selectedSupplierId) || null;
  }, [metricsList, selectedSupplierId]);

  // Filtered Suppliers for Table / List
  const filteredMetricsList = useMemo(() => {
    return metricsList.filter(m => {
      const matchesSearch = m.wholesalerName.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (m.contact && m.contact.includes(searchFilter));

      if (!matchesSearch) return false;

      if (statusFilter === 'delayed') return m.leadTimeVariance > 0 || m.onTimeDeliveryRate < 85;
      if (statusFilter === 'on_time') return m.onTimeDeliveryRate >= 90;
      if (statusFilter === 'high_spend') return m.totalSpend >= 20000;

      return true;
    });
  }, [metricsList, searchFilter, statusFilter]);

  // Cross-Supplier Lead Time Comparison Chart Data
  const crossSupplierLeadTimeData = useMemo(() => {
    return metricsList.map(m => {
      // Shorten name for chart label
      const shortName = m.wholesalerName.split(' ')[0] + (m.wholesalerName.split(' ')[1] ? ` ${m.wholesalerName.split(' ')[1].slice(0, 3)}.` : '');
      return {
        id: m.wholesalerId,
        fullName: m.wholesalerName,
        name: shortName,
        promisedSLA: m.promisedLeadTimeDays,
        actualAvg: m.avgActualLeadTimeDays,
        variance: m.leadTimeVariance,
        onTimeRate: m.onTimeDeliveryRate,
        isDelayed: m.leadTimeVariance > 0,
        spend: m.totalSpend,
        orders: m.totalOrdersCount
      };
    }).sort((a, b) => a.actualAvg - b.actualAvg);
  }, [metricsList]);

  // Spend & Purchase History Trend Data
  const monthlyTrendData = useMemo(() => {
    if (activeSupplierMetrics) {
      return activeSupplierMetrics.monthlySpendHistory.map(item => ({
        month: item.monthLabel,
        monthKey: item.monthKey,
        spend: item.spend,
        orders: item.ordersCount,
        avgLeadTime: item.avgLeadTime,
        sla: activeSupplierMetrics.promisedLeadTimeDays
      }));
    }

    // Aggregate monthly data across all suppliers
    const monthAgg: Record<string, { label: string; spend: number; orders: number; leadSum: number; leadCount: number }> = {};
    metricsList.forEach(m => {
      m.monthlySpendHistory.forEach(h => {
        if (!monthAgg[h.monthKey]) {
          monthAgg[h.monthKey] = { label: h.monthLabel, spend: 0, orders: 0, leadSum: 0, leadCount: 0 };
        }
        monthAgg[h.monthKey].spend += h.spend;
        monthAgg[h.monthKey].orders += h.ordersCount;
        monthAgg[h.monthKey].leadSum += (h.avgLeadTime * h.ordersCount);
        monthAgg[h.monthKey].leadCount += h.ordersCount;
      });
    });

    return Object.entries(monthAgg).map(([key, data]) => ({
      month: data.label,
      monthKey: key,
      spend: data.spend,
      orders: data.orders,
      avgLeadTime: data.leadCount > 0 ? parseFloat((data.leadSum / data.leadCount).toFixed(1)) : 3.0,
      sla: 3.0
    }));
  }, [activeSupplierMetrics, metricsList]);

  // Order Lead Time History (for Single Supplier Drilldown)
  const singleSupplierOrderTrend = useMemo(() => {
    if (!activeSupplierMetrics) return [];
    return [...activeSupplierMetrics.recentOrders]
      .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime())
      .map(o => ({
        orderNumber: o.orderNumber.replace('PO-', ''),
        date: o.orderDate.slice(5), // MM-DD
        leadTime: o.actualLeadTimeDays,
        sla: o.promisedLeadTimeDays,
        status: o.fulfillmentStatus,
        amount: o.totalAmount
      }));
  }, [activeSupplierMetrics]);

  // Handle Recording Delivery Receipt
  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetWholesaler = wholesalers.find(w => w.id === recordForm.wholesalerId);
    if (!targetWholesaler) return;

    try {
      const orderDateObj = new Date(recordForm.orderDate);
      const receivedDateObj = new Date(recordForm.receivedDate);
      const diffTime = Math.abs(receivedDateObj.getTime() - orderDateObj.getTime());
      const calculatedLeadDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

      const saved = await recordSupplierDeliveryReceipt({
        wholesalerId: targetWholesaler.id,
        wholesalerName: targetWholesaler.name,
        orderNumber: recordForm.orderNumber || `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        orderDate: recordForm.orderDate,
        receivedDate: recordForm.receivedDate,
        promisedLeadTimeDays: Number(recordForm.promisedLeadTimeDays) || targetWholesaler.leadTimeDays || 3,
        actualLeadTimeDays: calculatedLeadDays,
        totalAmount: Number(recordForm.totalAmount) || 5000,
        qualityRating: Number(recordForm.qualityRating) || 5,
        userEmail: profile?.email,
        userName: profile?.displayName,
        userRole: profile?.role,
        userId: profile?.uid
      });

      setPurchases(prev => [saved, ...prev]);
      setIsRecordModalOpen(false);
      setRecordSuccessMessage(`Shipment ${saved.orderNumber} successfully recorded for ${targetWholesaler.name}! Lead time: ${calculatedLeadDays} days.`);
      setTimeout(() => setRecordSuccessMessage(null), 5000);
    } catch (err) {
      console.error("Error saving delivery receipt:", err);
    }
  };

  // Custom Chart Tooltips
  const CustomLeadTimeTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-3 shadow-xl backdrop-blur-md text-xs z-50">
          <p className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-1">{data.fullName || data.name}</p>
          <div className="space-y-1 text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-500" /> Actual Avg Lead Time:
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{data.actualAvg ?? data.leadTime} days</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-400" /> Promised SLA:
              </span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{data.promisedSLA ?? data.sla} days</span>
            </div>
            {data.variance !== undefined && (
              <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-100 dark:border-slate-800">
                <span>Variance:</span>
                <span className={cn("font-bold", data.variance <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                  {data.variance <= 0 ? `${Math.abs(data.variance)}d faster` : `+${data.variance}d delayed`}
                </span>
              </div>
            )}
            {data.onTimeRate !== undefined && (
              <div className="flex items-center justify-between gap-4">
                <span>On-Time Rate:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{data.onTimeRate}%</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomSpendTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-3 shadow-xl backdrop-blur-md text-xs z-50">
          <p className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-1.5">{label || data.month}</p>
          <div className="space-y-1.5 text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-indigo-500" /> Total Purchases:
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {isFinancialAuthorized ? formatCurrency(data.spend) : '••••'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-400" /> Shipments Fulfilled:
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{data.orders} orders</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Avg Lead Time:
              </span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{data.avgLeadTime} days</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30">
              <Truck size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Supplier Performance Analytics
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span>Vendor Lead Times</span>
                <span aria-hidden="true">·</span>
                <span>Purchase History</span>
                <span aria-hidden="true">·</span>
                <span>SLA Fulfillment Tracking</span>
              </div>
            </div>
          </div>
        </div>

        {/* Global Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Supplier Selector Dropdown */}
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <Building2 size={14} className="text-slate-400 shrink-0" />
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer pr-1"
            >
              <option value="all">All Suppliers (Overview)</option>
              {wholesalers.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          {/* Timeframe Filter Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {[
              { days: 30, label: '30D' },
              { days: 90, label: '90D' },
              { days: 180, label: '6M' },
              { days: 365, label: '1Y' },
              { days: 0, label: 'All' }
            ].map(tf => (
              <button
                key={tf.days}
                onClick={() => setTimeframeDays(tf.days)}
                className={cn(
                  "px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer",
                  timeframeDays === tf.days
                    ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Record Delivery Action */}
          <button
            onClick={() => {
              if (activeSupplierMetrics) {
                setRecordForm(prev => ({
                  ...prev,
                  wholesalerId: activeSupplierMetrics.wholesalerId,
                  promisedLeadTimeDays: activeSupplierMetrics.promisedLeadTimeDays
                }));
              }
              setIsRecordModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-transform active:scale-95 cursor-pointer"
          >
            <Plus size={14} />
            <span>Record Shipment</span>
          </button>

          {/* Export CSV Action */}
          <button
            onClick={() => exportSupplierPerformanceCSV(metricsList, purchases)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Download Performance Summary as CSV"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Refresh Action */}
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Refresh Performance Data"
          >
            <RefreshCw size={14} className={cn(refreshing && "animate-spin text-blue-600")} />
          </button>
        </div>
      </div>

      {/* Success Notice Banner */}
      <AnimatePresence>
        {recordSuccessMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-medium"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{recordSuccessMessage}</span>
            </div>
            <button onClick={() => setRecordSuccessMessage(null)} className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1: Avg Lead Time */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Avg Lead Time</span>
            <Clock size={16} className="text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {activeSupplierMetrics ? activeSupplierMetrics.avgActualLeadTimeDays : globalSummary.avgGlobalLeadTime}
            </span>
            <span className="text-xs font-medium text-slate-500">days</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px]">
            {activeSupplierMetrics ? (
              <span className={cn(
                "font-bold",
                activeSupplierMetrics.leadTimeVariance <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              )}>
                {activeSupplierMetrics.leadTimeVariance <= 0 
                  ? `SLA Met (${activeSupplierMetrics.promisedLeadTimeDays}d promised)` 
                  : `+${activeSupplierMetrics.leadTimeVariance}d over SLA`}
              </span>
            ) : (
              <span className="text-slate-500">Industry SLA benchmark: 2.5d</span>
            )}
          </div>
        </div>

        {/* Metric 2: On-Time Fulfillment Rate */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>On-Time Fulfillment</span>
            <ShieldCheck size={16} className="text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {activeSupplierMetrics ? activeSupplierMetrics.onTimeDeliveryRate : globalSummary.globalOnTimeRate}%
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px]">
            {activeSupplierMetrics ? (
              <span className="text-slate-500">
                Grade: <strong className="text-slate-900 dark:text-white font-bold">{activeSupplierMetrics.reliabilityGrade}</strong> ({activeSupplierMetrics.completedOrdersCount} orders analyzed)
              </span>
            ) : (
              <span className="text-slate-500">
                {globalSummary.delayedOrdersCount} delayed order(s) recorded
              </span>
            )}
          </div>
        </div>

        {/* Metric 3: Total Purchase Spend */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Purchases</span>
            <IndianRupee size={16} className="text-indigo-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <SensitiveValueMask
              isAuthorized={isFinancialAuthorized}
              value={formatCurrency(activeSupplierMetrics ? activeSupplierMetrics.totalSpend : globalSummary.totalSpend)}
              className="text-2xl font-black text-slate-900 dark:text-white font-mono"
            />
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
            <span>
              {activeSupplierMetrics ? `${activeSupplierMetrics.discountPercentage}% Tier Discount` : `${wholesalers.length} Active Wholesalers`}
            </span>
          </div>
        </div>

        {/* Metric 4: Orders Fulfilled */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Shipments & POs</span>
            <Package size={16} className="text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {activeSupplierMetrics ? activeSupplierMetrics.totalOrdersCount : globalSummary.totalOrders}
            </span>
            <span className="text-xs font-medium text-slate-500">orders</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
            {activeSupplierMetrics ? (
              <span>Avg Order: {isFinancialAuthorized ? formatCurrency(activeSupplierMetrics.averageOrderValue) : '••••'}</span>
            ) : (
              <span>Top Partner: <strong className="text-slate-800 dark:text-slate-200">{globalSummary.topPerformingSupplier?.split(' ')[0] || 'Apollo'}</strong></span>
            )}
          </div>
        </div>
      </div>

      {/* Main Charts Grid: Recharts Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: Lead Time Benchmark & SLA Compliance */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {activeSupplierMetrics ? `${activeSupplierMetrics.wholesalerName} · Lead Time History` : 'Supplier Lead Times vs Promised SLA'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeSupplierMetrics ? 'Chronological lead time (days) per shipment vs target SLA' : 'Compares actual delivery turnaround against promised SLA per vendor'}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                  <span className="h-2 w-2 rounded-full bg-blue-500" /> Actual
                </span>
                <span className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                  <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" /> SLA Target
                </span>
              </div>
            </div>

            {/* Recharts Container */}
            <div className="h-64 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                {activeSupplierMetrics ? (
                  /* Single Supplier Order Chronological Lead Time Chart */
                  <ComposedChart data={singleSupplierOrderTrend} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit="d" />
                    <Tooltip content={<CustomLeadTimeTooltip />} />
                    <ReferenceLine 
                      y={activeSupplierMetrics.promisedLeadTimeDays} 
                      stroke="#f59e0b" 
                      strokeDasharray="4 4" 
                      label={{ value: `SLA: ${activeSupplierMetrics.promisedLeadTimeDays}d`, position: 'top', fill: '#d97706', fontSize: 10 }} 
                    />
                    <Area type="monotone" dataKey="leadTime" fill="#3b82f6" fillOpacity={0.15} stroke="#2563eb" strokeWidth={2} name="Actual Lead Time" />
                    <Line type="monotone" dataKey="sla" stroke="#94a3b8" strokeWidth={1.5} dot={false} strokeDasharray="3 3" name="Promised SLA" />
                  </ComposedChart>
                ) : (
                  /* Cross-Supplier Comparison Bar Chart */
                  <BarChart data={crossSupplierLeadTimeData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 10 }} 
                      interval={0} 
                      angle={-20} 
                      textAnchor="end"
                      tickLine={false} 
                      axisLine={{ stroke: '#cbd5e1' }} 
                    />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit="d" />
                    <Tooltip content={<CustomLeadTimeTooltip />} />
                    <ReferenceLine y={2.5} stroke="#64748b" strokeDasharray="3 3" label={{ value: 'Target: 2.5d', position: 'insideTopRight', fill: '#64748b', fontSize: 9 }} />
                    <Bar dataKey="actualAvg" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Actual Avg (Days)" />
                    <Bar dataKey="promisedSLA" fill="#cbd5e1" radius={[4, 4, 0, 0]} name="Promised SLA (Days)" />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>Fastest delivery benchmark: <strong>1-2 Days</strong></span>
            {activeSupplierMetrics ? (
              <button 
                onClick={() => setSelectedSupplierId('all')} 
                className="text-blue-600 hover:text-blue-700 font-bold cursor-pointer"
              >
                Back to All Suppliers
              </button>
            ) : (
              <span>Click a supplier in the table below to drill down</span>
            )}
          </div>
        </div>

        {/* CHART 2: Purchase History & Spend Progression */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {activeSupplierMetrics ? `${activeSupplierMetrics.wholesalerName} · Purchase History` : 'Monthly Purchase Spend & Order Volume'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Procurement volume and fulfillment cadence over past 6 months
                </p>
              </div>
              
              {/* Metric Toggle Buttons */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
                <button
                  onClick={() => setChartMetricMode('spend')}
                  className={cn(
                    "px-2.5 py-1 font-bold rounded-md transition-colors cursor-pointer text-[11px]",
                    chartMetricMode === 'spend' 
                      ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white" 
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                  )}
                >
                  Spend (₹)
                </button>
                <button
                  onClick={() => setChartMetricMode('orders')}
                  className={cn(
                    "px-2.5 py-1 font-bold rounded-md transition-colors cursor-pointer text-[11px]",
                    chartMetricMode === 'orders' 
                      ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white" 
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                  )}
                >
                  Orders
                </button>
                <button
                  onClick={() => setChartMetricMode('leadTime')}
                  className={cn(
                    "px-2.5 py-1 font-bold rounded-md transition-colors cursor-pointer text-[11px]",
                    chartMetricMode === 'leadTime' 
                      ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white" 
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                  )}
                >
                  Turnaround
                </button>
              </div>
            </div>

            {/* Recharts Container */}
            <div className="h-64 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                  <YAxis 
                    yAxisId="left" 
                    tick={{ fontSize: 11 }} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(val) => {
                      if (!isFinancialAuthorized && chartMetricMode === 'spend') return '••';
                      if (chartMetricMode === 'spend') return `₹${(val / 1000).toFixed(0)}k`;
                      if (chartMetricMode === 'leadTime') return `${val}d`;
                      return val;
                    }}
                  />
                  <Tooltip content={<CustomSpendTooltip />} />
                  {chartMetricMode === 'spend' && (
                    <Area 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="spend" 
                      fill="#6366f1" 
                      fillOpacity={0.2} 
                      stroke="#4f46e5" 
                      strokeWidth={2.5} 
                      name="Purchase Spend"
                    />
                  )}
                  {chartMetricMode === 'orders' && (
                    <Bar 
                      yAxisId="left"
                      dataKey="orders" 
                      fill="#3b82f6" 
                      radius={[4, 4, 0, 0]} 
                      name="Orders Count" 
                    />
                  )}
                  {chartMetricMode === 'leadTime' && (
                    <>
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="avgLeadTime" 
                        stroke="#f59e0b" 
                        strokeWidth={2.5} 
                        dot={{ r: 4, fill: '#f59e0b' }}
                        name="Avg Lead Time (Days)"
                      />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="sla" 
                        stroke="#94a3b8" 
                        strokeWidth={1.5} 
                        strokeDasharray="4 4"
                        dot={false}
                        name="SLA Benchmark"
                      />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>Aggregated 6-month turnover: <strong>{isFinancialAuthorized ? formatCurrency(globalSummary.totalSpend) : '••••'}</strong></span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
              <TrendingUp size={13} /> High replenishment velocity
            </span>
          </div>
        </div>
      </div>

      {/* Supplier Comparison Matrix Table (When "all" selected) */}
      {selectedSupplierId === 'all' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Supplier Performance Scorecard</h3>
              <p className="text-xs text-slate-500 mt-0.5">Benchmark lead time SLAs, on-time rates, and spend rankings</p>
            </div>

            {/* Filter toolbar */}
            <div className="flex items-center gap-2">
              <div className="relative max-w-xs">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter supplier..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-blue-500 dark:text-slate-200 w-44"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e: any) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-1.5 px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="all">All Vendors</option>
                <option value="on_time">Top SLA (&gt;90% On-Time)</option>
                <option value="delayed">SLA Breached / Delayed</option>
                <option value="high_spend">High Spend (&gt;₹20k)</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-3">Supplier Name</th>
                  <th className="py-3 px-3">Promised SLA</th>
                  <th className="py-3 px-3">Actual Avg Lead</th>
                  <th className="py-3 px-3">Variance</th>
                  <th className="py-3 px-3">On-Time %</th>
                  <th className="py-3 px-3">Reliability</th>
                  <th className="py-3 px-3">Total Spend</th>
                  <th className="py-3 px-3">Orders</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredMetricsList.map((m) => {
                  const isFaster = m.leadTimeVariance <= 0;
                  return (
                    <tr 
                      key={m.wholesalerId} 
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">
                        <div>
                          <span>{m.wholesalerName}</span>
                          <div className="text-[10px] font-normal text-slate-400">{m.contact || 'No phone'}</div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono font-medium text-slate-600 dark:text-slate-300">
                        {m.promisedLeadTimeDays} days
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                        {m.avgActualLeadTimeDays} days
                      </td>
                      <td className="py-3 px-3 font-mono">
                        <span className={cn(
                          "font-bold",
                          isFaster ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        )}>
                          {isFaster ? `${Math.abs(m.leadTimeVariance)}d early` : `+${m.leadTimeVariance}d delayed`}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{m.onTimeDeliveryRate}%</span>
                          <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full",
                                m.onTimeDeliveryRate >= 90 ? "bg-emerald-500" : (m.onTimeDeliveryRate >= 75 ? "bg-amber-500" : "bg-rose-500")
                              )} 
                              style={{ width: `${m.onTimeDeliveryRate}%` }} 
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={cn(
                          "text-[10px] font-black px-2 py-0.5 rounded-md",
                          m.reliabilityGrade === 'A+' || m.reliabilityGrade === 'A' 
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                            : m.reliabilityGrade === 'B+' 
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                              : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                        )}>
                          Grade {m.reliabilityGrade}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                        <SensitiveValueMask 
                          isAuthorized={isFinancialAuthorized} 
                          value={formatCurrency(m.totalSpend)} 
                        />
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">
                        {m.totalOrdersCount}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => setSelectedSupplierId(m.wholesalerId)}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-300 text-xs font-bold transition-colors cursor-pointer"
                        >
                          View History
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Single Supplier Detailed Purchase Ledger (When a supplier is selected) */}
      {activeSupplierMetrics && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 px-2 py-0.5 rounded">
                  Individual Supplier Drilldown
                </span>
                <span className="text-xs text-slate-500">Contact: {activeSupplierMetrics.contact}</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
                {activeSupplierMetrics.wholesalerName} · Order History & Lead Time Tracker
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedSupplierId('all')}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
              >
                Back to All
              </button>
              <button
                onClick={() => {
                  setRecordForm(prev => ({
                    ...prev,
                    wholesalerId: activeSupplierMetrics.wholesalerId,
                    promisedLeadTimeDays: activeSupplierMetrics.promisedLeadTimeDays
                  }));
                  setIsRecordModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
              >
                <Plus size={14} />
                <span>Log New PO Receipt</span>
              </button>
            </div>
          </div>

          {/* Orders Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-3">PO Number</th>
                  <th className="py-3 px-3">Order Date</th>
                  <th className="py-3 px-3">Received Date</th>
                  <th className="py-3 px-3">Promised SLA</th>
                  <th className="py-3 px-3">Actual Lead Time</th>
                  <th className="py-3 px-3">Fulfillment</th>
                  <th className="py-3 px-3">Items</th>
                  <th className="py-3 px-3">Invoice Amount</th>
                  <th className="py-3 px-3">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeSupplierMetrics.recentOrders.map((o) => {
                  const variance = o.actualLeadTimeDays - o.promisedLeadTimeDays;
                  return (
                    <tr key={o.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {o.orderNumber}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                        {o.orderDate}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-medium">
                        {o.receivedDate || 'In Transit'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">
                        {o.promisedLeadTimeDays}d
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                        {o.actualLeadTimeDays} days
                      </td>
                      <td className="py-3 px-3">
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-md",
                          o.fulfillmentStatus === 'early' 
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : o.fulfillmentStatus === 'on_time'
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                              : o.fulfillmentStatus === 'delayed'
                                ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                                : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                        )}>
                          {o.fulfillmentStatus === 'early' ? 'Early Delivery' : (o.fulfillmentStatus === 'on_time' ? 'On-Time' : (o.fulfillmentStatus === 'delayed' ? `Delayed (${variance > 0 ? `+${variance}d` : ''})` : 'In Transit'))}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                        {o.itemsCount} SKU(s)
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                        <SensitiveValueMask 
                          isAuthorized={isFinancialAuthorized} 
                          value={formatCurrency(o.totalAmount)} 
                        />
                      </td>
                      <td className="py-3 px-3">
                        <span className={cn(
                          "text-[10px] font-bold uppercase",
                          o.paymentStatus === 'paid' ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                        )}>
                          {o.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Shipment Delivery Modal */}
      <AnimatePresence>
        {isRecordModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-black/50 backdrop-blur-xs" 
              onClick={() => setIsRecordModalOpen(false)} 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            >
              <div className="mb-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Record Shipment Receipt & Lead Time</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Logs shipment arrival and calculates SLA compliance</p>
                </div>
                <button 
                  onClick={() => setIsRecordModalOpen(false)} 
                  className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleRecordSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">Supplier / Wholesaler *</label>
                  <select
                    value={recordForm.wholesalerId}
                    onChange={(e) => {
                      const selected = wholesalers.find(w => w.id === e.target.value);
                      setRecordForm({
                        ...recordForm,
                        wholesalerId: e.target.value,
                        promisedLeadTimeDays: selected?.leadTimeDays || 3
                      });
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100 outline-none"
                    required
                  >
                    {wholesalers.map(w => (
                      <option key={w.id} value={w.id}>{w.name} (SLA: {w.leadTimeDays || 3}d)</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500">PO Number (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. PO-2026-891"
                      value={recordForm.orderNumber}
                      onChange={(e) => setRecordForm({ ...recordForm, orderNumber: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500">Promised SLA (Days)</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={recordForm.promisedLeadTimeDays}
                      onChange={(e) => setRecordForm({ ...recordForm, promisedLeadTimeDays: Number(e.target.value) })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500">Order Placed Date *</label>
                    <input
                      type="date"
                      required
                      value={recordForm.orderDate}
                      onChange={(e) => setRecordForm({ ...recordForm, orderDate: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500">Received / Delivery Date *</label>
                    <input
                      type="date"
                      required
                      value={recordForm.receivedDate}
                      onChange={(e) => setRecordForm({ ...recordForm, receivedDate: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500">Invoice Amount (₹) *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={recordForm.totalAmount}
                      onChange={(e) => setRecordForm({ ...recordForm, totalAmount: Number(e.target.value) })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500">Quality Rating</label>
                    <select
                      value={recordForm.qualityRating}
                      onChange={(e) => setRecordForm({ ...recordForm, qualityRating: Number(e.target.value) })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100 outline-none"
                    >
                      <option value={5}>⭐⭐⭐⭐⭐ (Perfect Condition)</option>
                      <option value={4}>⭐⭐⭐⭐ (Good)</option>
                      <option value={3}>⭐⭐⭐ (Acceptable)</option>
                      <option value={2}>⭐⭐ (Minor Issues)</option>
                      <option value={1}>⭐ (Damaged / Return)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRecordModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                  >
                    Save Delivery Record
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
