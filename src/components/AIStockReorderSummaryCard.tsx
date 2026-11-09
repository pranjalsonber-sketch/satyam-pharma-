import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Calendar, 
  AlertOctagon, 
  TrendingUp, 
  RefreshCw, 
  PackageCheck, 
  Clock, 
  IndianRupee, 
  ChevronRight, 
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { Medicine } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';

interface ReorderItem {
  medicineId: string;
  medicineName: string;
  currentStock: number;
  minThreshold: number;
  suggestedReorderDate: string;
  recommendedReorderQty: number;
  estimatedLeadTimeDays: number;
  priority: 'critical' | 'high' | 'medium';
  clinicalRiskReason: string;
  estimatedCost: number;
}

interface AnalysisResult {
  summary: {
    totalOutOfStock: number;
    criticalUrgencyCount: number;
    estimatedReorderCost: number;
    recommendedOrderDateEarliest: string;
    stockHealthScore: number;
    executiveActionNote: string;
  };
  reorderSuggestions: ReorderItem[];
  turnoverStrategy: string;
  engine?: string;
  analyzedAt?: string;
}

interface AIStockReorderSummaryCardProps {
  inventory: Medicine[];
  onNavigateToWholesalers?: () => void;
  onRestockItem?: (medicineName: string) => void;
}

export const AIStockReorderSummaryCard: React.FC<AIStockReorderSummaryCardProps> = ({
  inventory,
  onNavigateToWholesalers,
  onRestockItem,
}) => {
  const { tText } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const outOfStockItems = inventory.filter(m => Number(m.stockQuantity || 0) <= 0);
  const lowStockItems = inventory.filter(m => {
    const qty = Number(m.stockQuantity || 0);
    const min = Number(m.minThreshold || 10);
    return qty > 0 && qty <= min;
  });

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/inventory/ai-stock-reorder-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventory,
          outOfStockItems
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data: AnalysisResult = await response.json();
      setAnalysis(data);
    } catch (err: any) {
      console.error('AI Stock reorder analysis failed:', err);
      setError(err?.message || 'Failed to complete AI stock analysis');
    } finally {
      setLoading(false);
    }
  };

  // Run automatically on first mount if there are out-of-stock items
  useEffect(() => {
    if (inventory.length > 0 && !analysis) {
      runAnalysis();
    }
  }, [inventory.length]);

  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-blue-50/30 p-5 shadow-sm dark:border-indigo-950/60 dark:from-zinc-900 dark:via-zinc-900 dark:to-indigo-950/20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-indigo-100/70 dark:border-indigo-950/40">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-500/20">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                {tText('Gemini AI Stock Level & Reorder Analysis', 'जेमिनी एआई स्टॉक स्तर एवं पुनः ऑर्डर विश्लेषण')}
              </h3>
              <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                AI Powered
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Predictive replenishment engine: suggests exact reorder dates for out-of-stock and critical medicines.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={runAnalysis}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            <RefreshCw size={13} className={cn(loading && "animate-spin")} />
            <span>{loading ? tText('Analyzing...', 'विश्लेषण जारी...') : tText('Re-analyze Stock', 'पुनः विश्लेषण')}</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      {analysis && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
          <div className="rounded-xl border border-rose-200/80 bg-rose-50/50 p-3 dark:border-rose-900/40 dark:bg-rose-950/20">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Out of Stock</span>
              <AlertOctagon size={16} className="text-rose-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-rose-700 dark:text-rose-400">
                {analysis.summary.totalOutOfStock}
              </span>
              <span className="text-xs font-semibold text-rose-600">SKUs</span>
            </div>
            <p className="text-[10px] text-rose-500 mt-0.5">{analysis.summary.criticalUrgencyCount} critical priority</p>
          </div>

          <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Earliest Reorder</span>
              <Calendar size={16} className="text-amber-600" />
            </div>
            <div className="mt-1">
              <span className="text-sm font-black text-amber-900 dark:text-amber-300 truncate block">
                {analysis.summary.recommendedOrderDateEarliest}
              </span>
            </div>
            <p className="text-[10px] text-amber-600 mt-0.5">Avoid clinical stockout</p>
          </div>

          <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/50 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">Est. Reorder Cost</span>
              <IndianRupee size={16} className="text-indigo-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-black text-indigo-900 dark:text-indigo-300">
                {formatCurrency(analysis.summary.estimatedReorderCost)}
              </span>
            </div>
            <p className="text-[10px] text-indigo-500 mt-0.5">Wholesale replenishment</p>
          </div>

          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Stock Health</span>
              <PackageCheck size={16} className="text-emerald-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
                {analysis.summary.stockHealthScore}%
              </span>
              <span className="text-xs font-semibold text-emerald-600">Score</span>
            </div>
            <p className="text-[10px] text-emerald-600 mt-0.5">{lowStockItems.length} items near low mark</p>
          </div>
        </div>
      )}

      {/* Strategic Note */}
      {analysis && (
        <div className="mt-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 text-xs flex items-start gap-2.5">
          <Sparkles size={16} className="text-indigo-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              {analysis.summary.executiveActionNote}
            </p>
            {analysis.turnoverStrategy && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                <strong>Turnover Strategy:</strong> {analysis.turnoverStrategy}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Suggested Reorder Items List */}
      {analysis && analysis.reorderSuggestions && analysis.reorderSuggestions.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Out-of-Stock Suggested Reorder Schedule ({analysis.reorderSuggestions.length} Items)
            </h4>
            <span className="text-[10px] text-slate-400">Ranked by Clinical Urgency</span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {analysis.reorderSuggestions.map((item, idx) => (
              <div 
                key={item.medicineId || idx}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs hover:border-indigo-300 transition-all dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-800"
              >
                <div className="flex items-start gap-3">
                  <span className={cn(
                    "mt-0.5 inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
                    item.priority === 'critical' ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" :
                    item.priority === 'high' ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" :
                    "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                  )}>
                    {item.priority}
                  </span>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {item.medicineName}
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {item.clinicalRiskReason}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800 shrink-0">
                  <div className="text-left sm:text-right">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                      <Calendar size={12} />
                      <span>{item.suggestedReorderDate}</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Order {item.recommendedReorderQty} units • Lead time: {item.estimatedLeadTimeDays}d
                    </p>
                  </div>

                  {onRestockItem && (
                    <button
                      type="button"
                      onClick={() => onRestockItem(item.medicineName)}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <span>Restock</span>
                      <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis && analysis.reorderSuggestions && analysis.reorderSuggestions.length === 0 && (
        <div className="mt-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 p-4 text-center">
          <CheckCircle2 className="mx-auto text-emerald-600 mb-1" size={24} />
          <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
            Zero Out-of-Stock Items Detected
          </p>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
            All registered medicines maintain healthy stock levels above minimum thresholds.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:border-rose-900">
          <strong>Notice:</strong> {error}
        </div>
      )}
    </div>
  );
};
