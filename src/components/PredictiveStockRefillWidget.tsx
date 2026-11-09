import React from 'react';
import { 
  Sparkles, 
  AlertTriangle, 
  Clock, 
  TrendingDown, 
  ArrowRight, 
  Layers, 
  Calendar,
  Zap,
  ShoppingBag,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';
import { PredictiveRefillSummary, StockoutUrgency } from '../types';
import { formatCurrency, cn } from '../lib/utils';

interface PredictiveStockRefillWidgetProps {
  summary: PredictiveRefillSummary | null;
  onOpenModal: () => void;
  activeFilter: string;
  onSelectFilter: (filter: string) => void;
  isLoading?: boolean;
}

export const PredictiveStockRefillWidget: React.FC<PredictiveStockRefillWidgetProps> = ({
  summary,
  onOpenModal,
  activeFilter,
  onSelectFilter,
  isLoading = false
}) => {
  if (!summary) return null;

  const isUrgent = summary.immediateActionRequiredCount > 0;

  return (
    <div 
      id="predictive-stock-refill-banner"
      className={cn(
        "rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm",
        isUrgent 
          ? "border-amber-200 bg-gradient-to-br from-amber-50/70 via-white to-orange-50/40 dark:border-amber-900/50 dark:from-amber-950/20 dark:via-zinc-900 dark:to-zinc-900"
          : "border-slate-200 bg-gradient-to-br from-white via-indigo-50/20 to-blue-50/30 dark:border-slate-800 dark:from-zinc-900 dark:via-zinc-900 dark:to-indigo-950/20"
      )}
    >
      <div className="p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-md transition-transform",
              isUrgent 
                ? "bg-amber-500 text-slate-950 shadow-amber-500/20" 
                : "bg-indigo-600 text-white shadow-indigo-600/20"
            )}>
              <Sparkles size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span>AI Predictive Stock Refill & Run-Rate Forecaster</span>
                </h3>
                <span className={cn(
                  "rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-2xs",
                  isUrgent 
                    ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800" 
                    : "bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800"
                )}>
                  <Zap size={10} className="fill-current" />
                  <span>Real-time Velocity Active</span>
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 max-w-2xl">
                Calculates projected <strong className="text-slate-900 dark:text-slate-100 font-bold">stock-out dates</strong> for all medications using live daily consumption rates, vendor delivery buffers, and historical patient dispensing volume.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              id="open-ai-predictive-refill-modal-btn"
              onClick={onOpenModal}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white px-4 py-2.5 text-xs font-black shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Sparkles size={14} className="text-amber-300 dark:text-white" />
              <span>Full Refill Simulation</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
          {/* Card 1: Critical Stockout <= 7 Days */}
          <div 
            onClick={() => onSelectFilter(activeFilter === 'stockout7' ? 'all' : 'stockout7')}
            className={cn(
              "rounded-xl border p-3 shadow-2xs transition-all cursor-pointer select-none",
              activeFilter === 'stockout7'
                ? "border-red-500 bg-red-50/90 dark:bg-red-950/40 ring-2 ring-red-400"
                : summary.immediateActionRequiredCount > 0
                  ? "border-red-200 bg-white hover:border-red-300 dark:border-red-900/40 dark:bg-zinc-900/80"
                  : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-zinc-900/80"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertTriangle size={12} />
                <span>Stockout in &le; 7 Days</span>
              </span>
              <span className="flex h-2 w-2 rounded-full bg-red-500 animate-ping" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black tracking-tight text-red-600 dark:text-red-400">
                {summary.immediateActionRequiredCount}
              </span>
              <span className="text-xs font-semibold text-slate-500">SKUs Critical</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {summary.stockedOutCount > 0 ? `${summary.stockedOutCount} already zero stock` : 'Urgent replenishment needed'}
            </p>
          </div>

          {/* Card 2: Warning Stockout 8-15 Days */}
          <div 
            onClick={() => onSelectFilter(activeFilter === 'stockout15' ? 'all' : 'stockout15')}
            className={cn(
              "rounded-xl border p-3 shadow-2xs transition-all cursor-pointer select-none",
              activeFilter === 'stockout15'
                ? "border-amber-500 bg-amber-50/90 dark:bg-amber-950/40 ring-2 ring-amber-400"
                : "border-slate-200 bg-white hover:border-amber-300 dark:border-slate-800 dark:bg-zinc-900/80"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <Clock size={12} />
                <span>Refill in 8–15 Days</span>
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black tracking-tight text-amber-700 dark:text-amber-400">
                {summary.warningStockoutCount}
              </span>
              <span className="text-xs font-semibold text-slate-500">Medicines</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">Place vendor PO this week</p>
          </div>

          {/* Card 3: Store Daily Burn Velocity */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-zinc-900/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <TrendingDown size={12} className="text-indigo-600 dark:text-indigo-400" />
                <span>Total Daily Burn</span>
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                {summary.totalDailyDepletionUnits}
              </span>
              <span className="text-xs font-semibold text-slate-500">units / day</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">Average stock runway: ~{summary.averageDaysRemaining} days</p>
          </div>

          {/* Card 4: Recommended Refill Investment */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-zinc-900/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <ShoppingBag size={12} className="text-emerald-600 dark:text-emerald-400" />
                <span>Refill Order Buffer</span>
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                {formatCurrency(summary.totalEstimatedRefillCost)}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">{summary.totalRecommendedRefillUnits} units suggested</p>
          </div>
        </div>

        {/* Quick Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200/60 dark:border-slate-800/80 mt-3 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">
              Refill Filters:
            </span>
            <button
              type="button"
              onClick={() => onSelectFilter(activeFilter === 'stockout7' ? 'all' : 'stockout7')}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer border",
                activeFilter === 'stockout7'
                  ? "bg-red-600 text-white border-red-600 shadow-xs"
                  : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50"
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />
              <span>Stockout &le; 7d ({summary.immediateActionRequiredCount})</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectFilter(activeFilter === 'stockout15' ? 'all' : 'stockout15')}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer border",
                activeFilter === 'stockout15'
                  ? "bg-amber-500 text-slate-950 border-amber-500 font-black shadow-xs"
                  : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50"
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span>Refill 8–15d ({summary.warningStockoutCount})</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectFilter(activeFilter === 'stockout30' ? 'all' : 'stockout30')}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer border",
                activeFilter === 'stockout30'
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50"
              )}
            >
              <span>Refill 16–30d ({summary.moderateStockoutCount})</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectFilter(activeFilter === 'healthy' ? 'all' : 'healthy')}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer border",
                activeFilter === 'healthy'
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50"
              )}
            >
              <span>Well Stocked ({summary.healthyCount})</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
            <Info size={12} className="text-slate-400" />
            <span>Click any card to filter medicines by depletion urgency</span>
          </div>
        </div>
      </div>
    </div>
  );
};
