import React, { useState, useMemo } from 'react';
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
  PieChart,
  Pie,
  Cell,
  Legend,
  ReferenceLine
} from 'recharts';
import {
  TrendingUp,
  AlertTriangle,
  Package,
  Layers,
  Calendar,
  Clock,
  DollarSign,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  HelpCircle,
  TrendingDown,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Medicine } from '../types';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from './AuthProvider';
import { canViewFinancials } from '../lib/permissions';
import { SensitiveValueMask } from './SensitiveValueMask';
import { logAuditAction } from '../lib/auditLogger';

interface InventoryAnalyticsDashboardProps {
  items: Medicine[];
  onApplyFilter?: (filterKey: 'all' | 'low' | 'expiry30' | 'expiry60' | 'expiry90' | 'expired') => void;
  activeFilter?: string;
}

export const InventoryAnalyticsDashboard: React.FC<InventoryAnalyticsDashboardProps> = ({
  items,
  onApplyFilter,
  activeFilter = 'all'
}) => {
  const { t, tText } = useLanguage();
  const { profile } = useAuth();
  const isFinancialAuthorized = canViewFinancials(profile);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'trends' | 'expiry' | 'valuation'>('trends');
  const [metricMode, setMetricMode] = useState<'units' | 'valuation'>('units');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Compute days until expiry
  const getDaysUntilExpiry = (expiryDateStr: string): number => {
    if (!expiryDateStr) return 9999;
    const exp = new Date(expiryDateStr);
    if (isNaN(exp.getTime())) return 9999;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfExp = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());
    return Math.ceil((startOfExp.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Filter items by selected category if applicable
  const filteredItems = useMemo(() => {
    if (selectedCategory === 'all') return items;
    return items.filter(item => (item.type || 'others').toLowerCase() === selectedCategory.toLowerCase());
  }, [items, selectedCategory]);

  // Total Summary Metrics
  const summary = useMemo(() => {
    const totalSKUs = items.length;
    const totalUnits = items.reduce((sum, item) => sum + (Number(item.stockQuantity) || 0), 0);
    const totalValuation = items.reduce((sum, item) => sum + ((Number(item.rate) || 0) * (Number(item.stockQuantity) || 0)), 0);

    const lowStockCount = items.filter(item => item.stockQuantity <= (item.minThreshold || 10)).length;
    const outOfStockCount = items.filter(item => item.stockQuantity <= 0).length;

    let expiredCount = 0;
    let expiredValuation = 0;
    let critical30Count = 0;
    let critical30Valuation = 0;
    let warning90Count = 0;
    let warning90Valuation = 0;
    let safeCount = 0;
    let safeValuation = 0;

    items.forEach(item => {
      const days = getDaysUntilExpiry(item.expiryDate);
      const val = (item.rate || 0) * (item.stockQuantity || 0);

      if (days < 0) {
        expiredCount++;
        expiredValuation += val;
      } else if (days <= 30) {
        critical30Count++;
        critical30Valuation += val;
      } else if (days <= 90) {
        warning90Count++;
        warning90Valuation += val;
      } else {
        safeCount++;
        safeValuation += val;
      }
    });

    const atRiskValuation = expiredValuation + critical30Valuation + warning90Valuation;
    const healthScore = totalSKUs > 0 
      ? Math.max(0, Math.round(((totalSKUs - lowStockCount - expiredCount - critical30Count) / totalSKUs) * 100))
      : 100;

    return {
      totalSKUs,
      totalUnits,
      totalValuation,
      lowStockCount,
      outOfStockCount,
      expiredCount,
      expiredValuation,
      critical30Count,
      critical30Valuation,
      warning90Count,
      warning90Valuation,
      safeCount,
      safeValuation,
      atRiskValuation,
      healthScore
    };
  }, [items]);

  // Stock Level Status Bands (Distribution)
  const stockStatusDistribution = useMemo(() => {
    const outOfStock = filteredItems.filter(i => i.stockQuantity <= 0);
    const criticalLow = filteredItems.filter(i => i.stockQuantity > 0 && i.stockQuantity <= (i.minThreshold || 10) * 0.5);
    const lowStock = filteredItems.filter(i => i.stockQuantity > (i.minThreshold || 10) * 0.5 && i.stockQuantity <= (i.minThreshold || 10));
    const adequate = filteredItems.filter(i => i.stockQuantity > (i.minThreshold || 10) && i.stockQuantity <= (i.minThreshold || 10) * 3);
    const surplus = filteredItems.filter(i => i.stockQuantity > (i.minThreshold || 10) * 3);

    return [
      {
        name: 'Out of Stock (0)',
        count: outOfStock.length,
        units: 0,
        valuation: 0,
        fill: '#ef4444', // red-500
        tag: 'Critical'
      },
      {
        name: 'Critical Low (≤50% Threshold)',
        count: criticalLow.length,
        units: criticalLow.reduce((s, i) => s + i.stockQuantity, 0),
        valuation: criticalLow.reduce((s, i) => s + (i.rate * i.stockQuantity), 0),
        fill: '#f97316', // orange-500
        tag: 'Action Needed'
      },
      {
        name: 'Low Stock (≤ Threshold)',
        count: lowStock.length,
        units: lowStock.reduce((s, i) => s + i.stockQuantity, 0),
        valuation: lowStock.reduce((s, i) => s + (i.rate * i.stockQuantity), 0),
        fill: '#eab308', // yellow-500
        tag: 'Reorder Soon'
      },
      {
        name: 'Optimal / Adequate',
        count: adequate.length,
        units: adequate.reduce((s, i) => s + i.stockQuantity, 0),
        valuation: adequate.reduce((s, i) => s + (i.rate * i.stockQuantity), 0),
        fill: '#10b981', // emerald-500
        tag: 'Healthy'
      },
      {
        name: 'Surplus (>3x Threshold)',
        count: surplus.length,
        units: surplus.reduce((s, i) => s + i.stockQuantity, 0),
        valuation: surplus.reduce((s, i) => s + (i.rate * i.stockQuantity), 0),
        fill: '#3b82f6', // blue-500
        tag: 'Well Stocked'
      },
    ];
  }, [filteredItems]);

  // Top Stock Items vs Minimum Safety Threshold
  const stockLevelComparisonData = useMemo(() => {
    // Show a balanced selection: lowest stock (needs attention) and top volume
    const sortedByUrgency = [...filteredItems].sort((a, b) => {
      const ratioA = a.stockQuantity / (a.minThreshold || 10);
      const ratioB = b.stockQuantity / (b.minThreshold || 10);
      return ratioA - ratioB;
    });

    return sortedByUrgency.slice(0, 10).map(item => {
      const shortName = item.name.length > 14 ? item.name.slice(0, 13) + '…' : item.name;
      return {
        fullName: item.name,
        name: shortName,
        currentStock: item.stockQuantity,
        minThreshold: item.minThreshold || 10,
        valuation: (item.rate || 0) * (item.stockQuantity || 0),
        rate: item.rate,
        deficit: Math.max(0, (item.minThreshold || 10) - item.stockQuantity)
      };
    });
  }, [filteredItems]);

  // Expiry Horizon Risk Breakdown (Buckets)
  const expiryDistributionData = useMemo(() => {
    let expired = { count: 0, units: 0, valuation: 0 };
    let d1to30 = { count: 0, units: 0, valuation: 0 };
    let d31to60 = { count: 0, units: 0, valuation: 0 };
    let d61to90 = { count: 0, units: 0, valuation: 0 };
    let d91to180 = { count: 0, units: 0, valuation: 0 };
    let d181plus = { count: 0, units: 0, valuation: 0 };

    filteredItems.forEach(item => {
      const days = getDaysUntilExpiry(item.expiryDate);
      const units = item.stockQuantity || 0;
      const val = (item.rate || 0) * units;

      if (days < 0) {
        expired.count++;
        expired.units += units;
        expired.valuation += val;
      } else if (days <= 30) {
        d1to30.count++;
        d1to30.units += units;
        d1to30.valuation += val;
      } else if (days <= 60) {
        d31to60.count++;
        d31to60.units += units;
        d31to60.valuation += val;
      } else if (days <= 90) {
        d61to90.count++;
        d61to90.units += units;
        d61to90.valuation += val;
      } else if (days <= 180) {
        d91to180.count++;
        d91to180.units += units;
        d91to180.valuation += val;
      } else {
        d181plus.count++;
        d181plus.units += units;
        d181plus.valuation += val;
      }
    });

    return [
      { name: 'Expired', count: expired.count, units: expired.units, valuation: expired.valuation, fill: '#dc2626', filterKey: 'expired' },
      { name: '≤ 30 Days', count: d1to30.count, units: d1to30.units, valuation: d1to30.valuation, fill: '#f97316', filterKey: 'expiry30' },
      { name: '31–60 Days', count: d31to60.count, units: d31to60.units, valuation: d31to60.valuation, fill: '#f59e0b', filterKey: 'expiry60' },
      { name: '61–90 Days', count: d61to90.count, units: d61to90.units, valuation: d61to90.valuation, fill: '#eab308', filterKey: 'expiry90' },
      { name: '91–180 Days', count: d91to180.count, units: d91to180.units, valuation: d91to180.valuation, fill: '#3b82f6', filterKey: 'all' },
      { name: '> 180 Days Safe', count: d181plus.count, units: d181plus.units, valuation: d181plus.valuation, fill: '#10b981', filterKey: 'all' }
    ];
  }, [filteredItems]);

  // 12-Month Forward Expiry Timeline Projection
  const monthlyExpiryTimeline = useMemo(() => {
    const monthsAhead = 12;
    const now = new Date();
    const result: Array<{
      monthLabel: string;
      monthKey: string;
      unitsExpiring: number;
      valuationExpiring: number;
      skusExpiring: number;
      isUrgent: boolean;
    }> = [];

    for (let i = 0; i < monthsAhead; i++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth();
      const monthLabel = targetDate.toLocaleString('default', { month: 'short', year: '2-digit' });
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

      let unitsExpiring = 0;
      let valuationExpiring = 0;
      let skusExpiring = 0;

      filteredItems.forEach(item => {
        // Check item batches or main expiry
        const itemBatches = item.batches && item.batches.length > 0 ? item.batches : null;

        if (itemBatches) {
          let hasBatchInMonth = false;
          itemBatches.forEach(b => {
            if (b.expiryDate && b.expiryDate.startsWith(monthKey)) {
              unitsExpiring += Number(b.quantity) || 0;
              valuationExpiring += (Number(b.quantity) || 0) * (Number(item.rate) || 0);
              hasBatchInMonth = true;
            }
          });
          if (hasBatchInMonth) skusExpiring++;
        } else if (item.expiryDate && item.expiryDate.startsWith(monthKey)) {
          unitsExpiring += Number(item.stockQuantity) || 0;
          valuationExpiring += (Number(item.stockQuantity) || 0) * (Number(item.rate) || 0);
          skusExpiring++;
        }
      });

      result.push({
        monthLabel,
        monthKey,
        unitsExpiring,
        valuationExpiring,
        skusExpiring,
        isUrgent: i <= 2 && unitsExpiring > 0
      });
    }

    return result;
  }, [filteredItems]);

  // Category Breakdown & Valuation Chart Data
  const categoryAnalytics = useMemo(() => {
    const categoryMap: Record<string, { count: number; units: number; valuation: number; lowStock: number }> = {};

    items.forEach(item => {
      const type = (item.type || 'others').toLowerCase();
      if (!categoryMap[type]) {
        categoryMap[type] = { count: 0, units: 0, valuation: 0, lowStock: 0 };
      }
      categoryMap[type].count += 1;
      categoryMap[type].units += (item.stockQuantity || 0);
      categoryMap[type].valuation += ((item.rate || 0) * (item.stockQuantity || 0));
      if (item.stockQuantity <= (item.minThreshold || 10)) {
        categoryMap[type].lowStock += 1;
      }
    });

    const colors: Record<string, string> = {
      tablet: '#3b82f6',
      capsule: '#8b5cf6',
      syrup: '#f59e0b',
      injection: '#ef4444',
      others: '#10b981'
    };

    return Object.entries(categoryMap).map(([type, stats]) => ({
      type: type.toUpperCase(),
      rawType: type,
      ...stats,
      fill: colors[type] || '#64748b'
    })).sort((a, b) => b.valuation - a.valuation);
  }, [items]);

  // Custom Chart Tooltips
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-3 shadow-xl backdrop-blur-md text-xs z-50">
          <p className="font-black text-slate-900 dark:text-slate-100 text-sm mb-1.5">{data.fullName || label}</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4 text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-500" /> Current Stock:
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{data.currentStock ?? data.units ?? data.unitsExpiring ?? payload[0].value} units</span>
            </div>
            {data.minThreshold !== undefined && (
              <div className="flex items-center justify-between gap-4 text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-rose-400" /> Safety Min Threshold:
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{data.minThreshold} units</span>
              </div>
            )}
            {data.valuation !== undefined && (
              <div className="flex items-center justify-between gap-4 text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 pt-1 mt-1">
                <span>Inventory Value:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(data.valuation || data.valuationExpiring)}</span>
              </div>
            )}
            {data.deficit > 0 && (
              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/60 p-1.5 text-[10px] font-bold text-rose-700 dark:text-rose-300 mt-1">
                Deficit: Reorder {data.deficit} units immediately
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-3 shadow-xl backdrop-blur-md text-xs">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: data.fill }} />
            <p className="font-black text-slate-900 dark:text-slate-100 text-sm">{data.name}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4 text-slate-600 dark:text-slate-300">
              <span>SKUs Affected:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{data.count} medicines</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-slate-600 dark:text-slate-300">
              <span>Total Volume:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{data.units} units</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 pt-1">
              <span>Capital Value:</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(data.valuation)}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"
    >
      {/* Top Header & Interactive Switcher Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 via-indigo-50/20 to-blue-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-600 text-white shadow-md shadow-blue-500/20">
              <BarChart3 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                  {tText('Inventory Trends & Expiry Risk Visualizer', 'इन्वेंट्री ट्रेंड्स एवं एक्सपायरी रिस्क विज़ुअलाइज़र')}
                </h2>
                <span className="rounded-full bg-blue-100 dark:bg-blue-950/80 px-2.5 py-0.5 text-[10px] font-black uppercase text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Live Analytics
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Multi-dimensional stock safety margins, forward 12-month expiry projections, and capital risk exposure.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Tab View Switcher */}
            <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setActiveTab('trends')}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition-all cursor-pointer",
                  activeTab === 'trends'
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                )}
              >
                <TrendingUp size={13} />
                <span>Stock Levels</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('expiry')}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition-all cursor-pointer",
                  activeTab === 'expiry'
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                )}
              >
                <Calendar size={13} />
                <span>Expiry Horizon</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('valuation');
                  if (isFinancialAuthorized) {
                    logAuditAction({
                      action: 'Inventory Valuation & Risk Telemetry Viewed',
                      category: 'margin_view',
                      description: `User ${profile?.displayName || profile?.email} examined capital valuation breakdown for ${items.length} medicines`,
                      module: 'inventory',
                      userEmail: profile?.email,
                      userName: profile?.displayName,
                      userRole: profile?.role,
                      userId: profile?.uid,
                      severity: 'info',
                      details: {
                        totalSKUs: items.length,
                        totalValuation: summary.totalValuation,
                        atRiskValuation: summary.atRiskValuation
                      }
                    });
                  }
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition-all cursor-pointer",
                  activeTab === 'valuation'
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                )}
              >
                <PieChartIcon size={13} />
                <span>Valuation & Forms</span>
              </button>
            </div>

            {/* Units vs Value Toggle */}
            <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setMetricMode('units')}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer",
                  metricMode === 'units'
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                )}
              >
                Units
              </button>
              {isFinancialAuthorized ? (
                <button
                  type="button"
                  onClick={() => {
                    setMetricMode('valuation');
                    logAuditAction({
                      action: 'Inventory Valuation Metric Mode Activated',
                      category: 'margin_view',
                      description: `Valuation metric toggle enabled by ${profile?.displayName || profile?.email}`,
                      module: 'inventory',
                      userEmail: profile?.email,
                      userName: profile?.displayName,
                      userRole: profile?.role,
                      userId: profile?.uid,
                      severity: 'info'
                    });
                  }}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer",
                    metricMode === 'valuation'
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  )}
                >
                  Value (₹)
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="rounded-lg px-2 py-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 cursor-not-allowed flex items-center gap-1 opacity-60"
                  title="Valuation metrics are restricted to Admin/Manager accounts"
                >
                  <span>Value</span>
                  <span className="text-[9px]">🔒</span>
                </button>
              )}
            </div>

            {/* Collapse/Expand Toggle */}
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title={isCollapsed ? 'Expand Dashboard Visualizations' : 'Collapse Dashboard'}
            >
              {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </div>
        </div>

        {/* Live KPI Quick Tickers */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-4">
          {/* Total Stock Volume */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/80 p-3 shadow-2xs">
            <span className="text-[10px] font-black uppercase text-slate-400">Total Stock Holding</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black text-slate-900 dark:text-slate-100">
                {summary.totalUnits.toLocaleString()}
              </span>
              <SensitiveValueMask 
                isAuthorized={isFinancialAuthorized} 
                value={formatCurrency(summary.totalValuation)} 
                className="text-xs font-bold text-slate-500"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">{summary.totalSKUs} registered SKU records</p>
          </div>

          {/* Low Stock Urgent */}
          <div 
            onClick={() => onApplyFilter && onApplyFilter('low')}
            className={cn(
              "rounded-2xl border p-3 shadow-2xs cursor-pointer transition-all hover:scale-[1.01] active:scale-98",
              summary.lowStockCount > 0
                ? "border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/20"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400">Reorder Required</span>
              {summary.lowStockCount > 0 && <AlertTriangle size={13} className="text-amber-600 animate-pulse" />}
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black text-amber-700 dark:text-amber-300">
                {summary.lowStockCount}
              </span>
              <span className="text-[10px] font-bold text-amber-600">
                {summary.outOfStockCount > 0 ? `${summary.outOfStockCount} Out of Stock` : 'Below Threshold'}
              </span>
            </div>
            <p className="text-[10px] text-amber-600/80 mt-0.5">Click to view items needing PO</p>
          </div>

          {/* Expiry Risk at ≤90 Days */}
          <div 
            onClick={() => onApplyFilter && onApplyFilter('expiry90')}
            className={cn(
              "rounded-2xl border p-3 shadow-2xs cursor-pointer transition-all hover:scale-[1.01] active:scale-98",
              summary.critical30Count > 0 || summary.expiredCount > 0
                ? "border-rose-200 dark:border-rose-900/50 bg-rose-50/70 dark:bg-rose-950/20"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-rose-700 dark:text-rose-400">Expiry Exposure (≤90D)</span>
              <ShieldAlert size={13} className="text-rose-600" />
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black text-rose-700 dark:text-rose-300">
                {summary.expiredCount + summary.critical30Count + summary.warning90Count}
              </span>
              <SensitiveValueMask 
                isAuthorized={isFinancialAuthorized} 
                value={formatCurrency(summary.atRiskValuation)} 
                className="text-xs font-bold text-rose-600"
              />
            </div>
            <p className="text-[10px] text-rose-600/80 mt-0.5">{summary.expiredCount > 0 ? `${summary.expiredCount} already expired` : 'Batches in risk horizon'}</p>
          </div>

          {/* Overall Inventory Health Index */}
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/20 p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">Inventory Health</span>
              <Sparkles size={13} className="text-emerald-600" />
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                {summary.healthScore}%
              </span>
              <span className="text-[10px] font-bold text-emerald-600">
                {summary.healthScore >= 80 ? 'Optimal' : summary.healthScore >= 60 ? 'Moderate' : 'Action Required'}
              </span>
            </div>
            <p className="text-[10px] text-emerald-600/80 mt-0.5">Adequate stock & fresh expiry</p>
          </div>
        </div>
      </div>

      {/* Main Charts Body */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="p-4 sm:p-5 space-y-5 bg-white dark:bg-slate-900"
          >
            {/* Category Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[11px] font-bold flex items-center gap-1">
                  <Filter size={12} /> Dosage Type:
                </span>
                {['all', 'tablet', 'capsule', 'syrup', 'injection', 'others'].map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg font-bold text-[11px] capitalize transition-all cursor-pointer",
                      selectedCategory === cat
                        ? "bg-slate-900 text-white dark:bg-blue-600 shadow-2xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="text-[11px] text-slate-400 font-medium">
                Analyzing <strong>{filteredItems.length}</strong> items • Metric: <strong>{metricMode === 'units' ? 'Physical Stock Units' : 'Inventory Value (₹)'}</strong>
              </div>
            </div>

            {/* TAB 1: STOCK LEVEL TRENDS & REORDER MARGINS */}
            {activeTab === 'trends' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Main Stock vs Min Threshold Bar Chart */}
                <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/40 dark:bg-slate-950/40">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                        Critical Safety Stock Margins (Top Reorder Priorities)
                      </h3>
                      <p className="text-[11px] text-slate-500">Current available units compared directly against safety reorder thresholds</p>
                    </div>
                    <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded-md">
                      Safety Buffer
                    </span>
                  </div>

                  <div className="h-64 sm:h-72 w-full">
                    {stockLevelComparisonData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stockLevelComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                          <XAxis 
                            dataKey="name" 
                            tick={{ fontSize: 10, fill: '#64748b' }} 
                            angle={-25} 
                            textAnchor="end" 
                            interval={0}
                          />
                          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                          <Tooltip content={<CustomBarTooltip />} />
                          <Legend 
                            wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                            formatter={(value) => <span className="font-bold text-slate-700 dark:text-slate-300">{value}</span>}
                          />
                          <Bar 
                            dataKey="currentStock" 
                            name="Current Stock" 
                            fill="#3b82f6" 
                            radius={[6, 6, 0, 0]} 
                          />
                          <Bar 
                            dataKey="minThreshold" 
                            name="Safety Reorder Min" 
                            fill="#f43f5e" 
                            radius={[6, 6, 0, 0]} 
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-400">
                        No inventory data available for current selection.
                      </div>
                    )}
                  </div>
                </div>

                {/* Stock Adequacy Tier Distribution (Donut & Breakdown) */}
                <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/40 dark:bg-slate-950/40 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                        Stock Health Tier Distribution
                      </h3>
                      <span className="text-[10px] font-bold text-slate-400">By SKU Count</span>
                    </div>

                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stockStatusDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={42}
                            outerRadius={68}
                            paddingAngle={3}
                            dataKey="count"
                          >
                            {stockStatusDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomPieTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Status List Legend */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                    {stockStatusDistribution.map((tier, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: tier.fill }} />
                          <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px] truncate max-w-[140px] sm:max-w-[180px]">
                            {tier.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{tier.count} SKUs</span>
                          <span className="text-[10px] text-slate-400">
                            ({metricMode === 'units' ? `${tier.units} pcs` : formatCurrency(tier.valuation)})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: EXPIRY DISTRIBUTION & 12-MONTH PROJECTION */}
            {activeTab === 'expiry' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Forward 12-Month Expiry Timeline Area Chart */}
                <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/40 dark:bg-slate-950/40">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                        12-Month Forward Expiry Inflow & Capital Risk Projection
                      </h3>
                      <p className="text-[11px] text-slate-500">Upcoming monthly expiration volumes and capital risk across all active batches</p>
                    </div>
                    <span className="text-[10px] font-black uppercase text-rose-600 bg-rose-100 dark:bg-rose-950 px-2 py-0.5 rounded-md">
                      Next 12 Months
                    </span>
                  </div>

                  <div className="h-64 sm:h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlyExpiryTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                        <defs>
                          <linearGradient id="expiryGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.05}/>
                          </linearGradient>
                          <linearGradient id="valGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                        <XAxis 
                          dataKey="monthLabel" 
                          tick={{ fontSize: 10, fill: '#64748b' }} 
                        />
                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                        <Tooltip content={<CustomBarTooltip />} />
                        <Legend 
                          wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                          formatter={(value) => <span className="font-bold text-slate-700 dark:text-slate-300">{value}</span>}
                        />
                        {metricMode === 'units' ? (
                          <Area 
                            type="monotone" 
                            dataKey="unitsExpiring" 
                            name="Units Expiring" 
                            stroke="#f43f5e" 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill="url(#expiryGradient)" 
                          />
                        ) : (
                          <Area 
                            type="monotone" 
                            dataKey="valuationExpiring" 
                            name="Expiring Value (₹)" 
                            stroke="#8b5cf6" 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill="url(#valGradient)" 
                          />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Expiry Risk Horizon Breakdown (Buckets) */}
                <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/40 dark:bg-slate-950/40 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                        Expiry Risk Horizon Distribution
                      </h3>
                      <span className="text-[10px] font-bold text-slate-400">By Days to Expiry</span>
                    </div>

                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={expiryDistributionData}
                            cx="50%"
                            cy="50%"
                            innerRadius={42}
                            outerRadius={68}
                            paddingAngle={3}
                            dataKey={metricMode === 'units' ? 'units' : 'valuation'}
                          >
                            {expiryDistributionData.map((entry, index) => (
                              <Cell key={`cell-exp-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomPieTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Expiry Horizon Clickable Badges */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                    {expiryDistributionData.map((bucket, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onApplyFilter && onApplyFilter(bucket.filterKey as any)}
                        className={cn(
                          "w-full flex items-center justify-between p-1.5 rounded-xl text-xs transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-left",
                          activeFilter === bucket.filterKey && bucket.filterKey !== 'all' ? "bg-slate-100 dark:bg-slate-800 ring-1 ring-blue-500" : ""
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: bucket.fill }} />
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                            {bucket.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-black text-slate-900 dark:text-slate-100">{bucket.count} SKUs</span>
                          <span className="text-[10px] text-slate-500 font-bold">
                            ({metricMode === 'units' ? `${bucket.units} pcs` : formatCurrency(bucket.valuation)})
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: CATEGORY & VALUATION BREAKDOWN */}
            {activeTab === 'valuation' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Category Valuation Bar Chart */}
                <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/40 dark:bg-slate-950/40">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                        Capital Allocation by Dosage Form / Category
                      </h3>
                      <p className="text-[11px] text-slate-500">Breakdown of inventory investment across dosage types</p>
                    </div>
                    <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-100 dark:bg-blue-950 px-2 py-0.5 rounded-md">
                      Category Capital
                    </span>
                  </div>

                  <div className="h-64 sm:h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryAnalytics} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                        <XAxis 
                          dataKey="type" 
                          tick={{ fontSize: 10, fill: '#64748b' }} 
                        />
                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                        <Tooltip content={<CustomBarTooltip />} />
                        <Legend 
                          wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                          formatter={(value) => <span className="font-bold text-slate-700 dark:text-slate-300">{value}</span>}
                        />
                        {metricMode === 'units' ? (
                          <Bar 
                            dataKey="units" 
                            name="Total Stock Pieces" 
                            fill="#3b82f6" 
                            radius={[6, 6, 0, 0]} 
                          />
                        ) : (
                          <Bar 
                            dataKey="valuation" 
                            name="Capital Valuation (₹)" 
                            fill="#10b981" 
                            radius={[6, 6, 0, 0]} 
                          />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Category Detailed Table & Health Ratio */}
                <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/40 dark:bg-slate-950/40 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 mb-3">
                      Dosage Category Summary Matrix
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-black text-slate-400">
                            <th className="pb-2">Type</th>
                            <th className="pb-2 text-right">SKUs</th>
                            <th className="pb-2 text-right">Units</th>
                            <th className="pb-2 text-right">Valuation</th>
                            <th className="pb-2 text-right">Low</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {categoryAnalytics.map((cat, i) => (
                            <tr key={i} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/40">
                              <td className="py-2.5 font-bold flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.fill }} />
                                {cat.type}
                              </td>
                              <td className="py-2.5 text-right font-mono text-slate-600 dark:text-slate-400">{cat.count}</td>
                              <td className="py-2.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200">{cat.units}</td>
                              <td className="py-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(cat.valuation)}</td>
                              <td className="py-2.5 text-right font-mono">
                                {cat.lowStock > 0 ? (
                                  <span className="text-rose-600 font-bold bg-rose-50 dark:bg-rose-950 px-1.5 py-0.5 rounded text-[10px]">
                                    {cat.lowStock}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">0</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-3 mt-3 text-[11px] text-blue-800 dark:text-blue-200 flex items-start gap-2">
                    <Info size={14} className="shrink-0 mt-0.5 text-blue-600" />
                    <span>
                      Tablets & Capsules represent <strong>{Math.round(((categoryAnalytics.find(c => c.rawType === 'tablet')?.valuation || 0) + (categoryAnalytics.find(c => c.rawType === 'capsule')?.valuation || 0)) / (summary.totalValuation || 1) * 100)}%</strong> of overall store inventory valuation.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default InventoryAnalyticsDashboard;
