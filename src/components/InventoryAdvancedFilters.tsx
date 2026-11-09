import React, { useState, useMemo } from 'react';
import { 
  Filter, 
  X, 
  RotateCcw, 
  MapPin, 
  Building2, 
  Boxes, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  SlidersHorizontal,
  Package,
  Layers,
  Sparkles,
  Search,
  Check,
  ShieldAlert,
  Snowflake,
  ShieldCheck
} from 'lucide-react';
import { Medicine, StorageLocation, MedicineStockPrediction } from '../types';
import { getMedicineLocation, AISLE_PRESETS, RACK_PRESETS, SHELF_PRESETS } from '../lib/locationUtils';
import { getMedicineSupplier, PHARMACY_SUPPLIERS } from '../lib/supplierUtils';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export interface InventoryFilterState {
  category: 'all' | 'tablet' | 'capsule' | 'injection' | 'syrup' | 'others';
  aisle: string; // 'all' or specific aisle id
  rack: string;  // 'all' or specific rack name
  shelf: string; // 'all' or specific shelf name
  supplier: string; // 'all' or supplier name
  stockStatus: 'all' | 'low' | 'out_of_stock' | 'healthy' | 'stockout7' | 'stockout15' | 'stockout30' | 'overstocked';
  expiryStatus: 'all' | 'expired' | 'expiry30' | 'expiry60' | 'expiry90' | 'safe';
  minStock?: number;
  maxStock?: number;
}

export const DEFAULT_INVENTORY_FILTERS: InventoryFilterState = {
  category: 'all',
  aisle: 'all',
  rack: 'all',
  shelf: 'all',
  supplier: 'all',
  stockStatus: 'all',
  expiryStatus: 'all',
};

interface InventoryAdvancedFiltersProps {
  filters: InventoryFilterState;
  onFilterChange: (newFilters: InventoryFilterState) => void;
  items: Medicine[];
  predictionsMap: Record<string, MedicineStockPrediction>;
  filteredCount: number;
  totalCount: number;
  onResetFilters: () => void;
}

export const InventoryAdvancedFilters: React.FC<InventoryAdvancedFiltersProps> = ({
  filters,
  onFilterChange,
  items,
  predictionsMap,
  filteredCount,
  totalCount,
  onResetFilters
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');

  // Extract all unique suppliers across the current medicine catalog
  const uniqueSuppliers = useMemo(() => {
    const suppliersMap = new Map<string, number>();
    items.forEach(med => {
      const sup = getMedicineSupplier(med);
      suppliersMap.set(sup, (suppliersMap.get(sup) || 0) + 1);
    });

    const list = Array.from(suppliersMap.entries()).map(([name, count]) => ({
      name,
      count
    }));

    return list.sort((a, b) => b.count - a.count);
  }, [items]);

  // Filter suppliers by search query
  const filteredSuppliersList = useMemo(() => {
    if (!supplierSearch.trim()) return uniqueSuppliers;
    const q = supplierSearch.toLowerCase();
    return uniqueSuppliers.filter(s => s.name.toLowerCase().includes(q));
  }, [uniqueSuppliers, supplierSearch]);

  // Compute category counts
  const categoryCounts = useMemo(() => {
    const counts = { all: items.length, tablet: 0, capsule: 0, syrup: 0, injection: 0, others: 0 };
    items.forEach(med => {
      const type = (med.type || 'others').toLowerCase() as keyof typeof counts;
      if (counts[type] !== undefined) {
        counts[type]++;
      } else {
        counts.others++;
      }
    });
    return counts;
  }, [items]);

  // Compute stock status counts
  const stockCounts = useMemo(() => {
    let outOfStock = 0;
    let low = 0;
    let healthy = 0;
    let stockout7 = 0;
    let stockout15 = 0;
    let stockout30 = 0;
    let overstocked = 0;

    items.forEach(med => {
      const threshold = med.minThreshold || 10;
      const pred = predictionsMap[med.id] || predictionsMap[med.name];

      if (med.stockQuantity <= 0) {
        outOfStock++;
        stockout7++;
      } else if (med.stockQuantity <= threshold) {
        low++;
        if (pred && pred.daysUntilStockOut <= 7) stockout7++;
        else if (pred && pred.daysUntilStockOut <= 15) stockout15++;
      } else {
        healthy++;
        if (pred && pred.daysUntilStockOut <= 7) stockout7++;
        else if (pred && pred.daysUntilStockOut <= 15) stockout15++;
        else if (pred && pred.daysUntilStockOut <= 30) stockout30++;

        if (med.stockQuantity >= threshold * 3) {
          overstocked++;
        }
      }
    });

    return {
      all: items.length,
      outOfStock,
      low,
      healthy,
      stockout7,
      stockout15,
      stockout30,
      overstocked
    };
  }, [items, predictionsMap]);

  // Compute Location counts
  const locationCounts = useMemo(() => {
    const aisleMap: Record<string, number> = {};
    const rackMap: Record<string, number> = {};
    const shelfMap: Record<string, number> = {};

    items.forEach(med => {
      const loc = getMedicineLocation(med);
      aisleMap[loc.aisle] = (aisleMap[loc.aisle] || 0) + 1;
      rackMap[loc.rack] = (rackMap[loc.rack] || 0) + 1;
      shelfMap[loc.shelf] = (shelfMap[loc.shelf] || 0) + 1;
    });

    return { aisleMap, rackMap, shelfMap };
  }, [items]);

  // Count how many non-default filters are currently active
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.category !== 'all') count++;
    if (filters.aisle !== 'all') count++;
    if (filters.rack !== 'all') count++;
    if (filters.shelf !== 'all') count++;
    if (filters.supplier !== 'all') count++;
    if (filters.stockStatus !== 'all') count++;
    if (filters.expiryStatus !== 'all') count++;
    return count;
  }, [filters]);

  const handleUpdate = (partial: Partial<InventoryFilterState>) => {
    onFilterChange({ ...filters, ...partial });
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-zinc-900 transition-all">
      {/* Top Segmented Quick Filters & Toggle Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Quick Stock & Category Chips */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
            <Filter size={12} className="text-slate-400" />
            <span>Quick:</span>
          </span>

          {/* All */}
          <button
            type="button"
            id="filter-quick-all"
            onClick={() => handleUpdate({ stockStatus: 'all', category: 'all', aisle: 'all', supplier: 'all', expiryStatus: 'all' })}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5",
              activeFiltersCount === 0
                ? "bg-slate-900 text-white border-slate-900 dark:bg-blue-600 dark:border-blue-600 shadow-2xs"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700"
            )}
          >
            <span>All Items</span>
            <span className={cn(
              "rounded px-1 text-[10px] font-black",
              activeFiltersCount === 0 ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            )}>
              {totalCount}
            </span>
          </button>

          {/* Low Stock */}
          <button
            type="button"
            id="filter-quick-low-stock"
            onClick={() => handleUpdate({ stockStatus: filters.stockStatus === 'low' ? 'all' : 'low' })}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5",
              filters.stockStatus === 'low'
                ? "bg-amber-500 text-slate-950 border-amber-500 shadow-2xs font-extrabold"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-amber-50 hover:border-amber-300 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700"
            )}
          >
            <AlertTriangle size={12} className={filters.stockStatus === 'low' ? "text-slate-950" : "text-amber-500"} />
            <span>Low Stock</span>
            <span className={cn(
              "rounded px-1 text-[10px] font-black",
              filters.stockStatus === 'low' ? "bg-black/20 text-slate-950" : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
            )}>
              {stockCounts.low}
            </span>
          </button>

          {/* Out of Stock */}
          <button
            type="button"
            id="filter-quick-out-of-stock"
            onClick={() => handleUpdate({ stockStatus: filters.stockStatus === 'out_of_stock' ? 'all' : 'out_of_stock' })}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5",
              filters.stockStatus === 'out_of_stock'
                ? "bg-red-600 text-white border-red-600 shadow-2xs font-extrabold"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-red-50 hover:border-red-300 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700"
            )}
          >
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span>Out of Stock</span>
            <span className={cn(
              "rounded px-1 text-[10px] font-black",
              filters.stockStatus === 'out_of_stock' ? "bg-white/20 text-white" : "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
            )}>
              {stockCounts.outOfStock}
            </span>
          </button>

          {/* Healthy Stock */}
          <button
            type="button"
            id="filter-quick-healthy-stock"
            onClick={() => handleUpdate({ stockStatus: filters.stockStatus === 'healthy' ? 'all' : 'healthy' })}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5",
              filters.stockStatus === 'healthy'
                ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-extrabold"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700"
            )}
          >
            <CheckCircle2 size={12} className={filters.stockStatus === 'healthy' ? "text-white" : "text-emerald-500"} />
            <span>Healthy</span>
            <span className={cn(
              "rounded px-1 text-[10px] font-black",
              filters.stockStatus === 'healthy' ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
            )}>
              {stockCounts.healthy}
            </span>
          </button>

          {/* Cold Storage / Fridge */}
          <button
            type="button"
            id="filter-quick-cold-storage"
            onClick={() => handleUpdate({ aisle: filters.aisle === 'Aisle C' ? 'all' : 'Aisle C' })}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5",
              filters.aisle === 'Aisle C'
                ? "bg-cyan-600 text-white border-cyan-600 shadow-2xs font-extrabold"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-cyan-50 hover:border-cyan-300 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700"
            )}
          >
            <Snowflake size={12} className={filters.aisle === 'Aisle C' ? "text-white" : "text-cyan-500"} />
            <span>Cold Chain (2-8°C)</span>
            <span className={cn(
              "rounded px-1 text-[10px] font-black",
              filters.aisle === 'Aisle C' ? "bg-white/20 text-white" : "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300"
            )}>
              {locationCounts.aisleMap['Aisle C'] || 0}
            </span>
          </button>

          {/* Schedule H Safe */}
          <button
            type="button"
            id="filter-quick-secure-safe"
            onClick={() => handleUpdate({ aisle: filters.aisle === 'Secure Safe' ? 'all' : 'Secure Safe' })}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5",
              filters.aisle === 'Secure Safe'
                ? "bg-rose-700 text-white border-rose-700 shadow-2xs font-extrabold"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-rose-50 hover:border-rose-300 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700"
            )}
          >
            <ShieldAlert size={12} className={filters.aisle === 'Secure Safe' ? "text-white" : "text-rose-500"} />
            <span>Schedule H Lockbox</span>
            <span className={cn(
              "rounded px-1 text-[10px] font-black",
              filters.aisle === 'Secure Safe' ? "bg-white/20 text-white" : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
            )}>
              {locationCounts.aisleMap['Secure Safe'] || 0}
            </span>
          </button>
        </div>

        {/* Toggle Expand Button & Counter */}
        <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
          {activeFiltersCount > 0 && (
            <button
              type="button"
              id="reset-all-filters-btn"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-red-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition-colors cursor-pointer"
              title="Reset all applied filters"
            >
              <RotateCcw size={12} />
              <span>Reset Filters</span>
            </button>
          )}

          <button
            type="button"
            id="toggle-advanced-filters-panel-btn"
            onClick={() => setIsExpanded(prev => !prev)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer border shadow-2xs",
              isExpanded || activeFiltersCount > 0
                ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-blue-600/20"
                : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
            )}
          >
            <SlidersHorizontal size={14} />
            <span>Advanced Filters</span>
            {activeFiltersCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-black text-blue-700 shadow-xs">
                {activeFiltersCount}
              </span>
            )}
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Active Filter Badges Ribbon (if any filter is non-default) */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Active Criteria:</span>

          {filters.category !== 'all' && (
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-bold text-blue-800 dark:bg-blue-950/60 dark:border-blue-800 dark:text-blue-300">
              <Package size={11} />
              <span>Category: {filters.category.toUpperCase()}</span>
              <button 
                type="button" 
                onClick={() => handleUpdate({ category: 'all' })}
                className="hover:text-blue-900 cursor-pointer ml-0.5"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {filters.aisle !== 'all' && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300">
              <MapPin size={11} />
              <span>Aisle: {filters.aisle}</span>
              <button 
                type="button" 
                onClick={() => handleUpdate({ aisle: 'all' })}
                className="hover:text-emerald-900 cursor-pointer ml-0.5"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {filters.rack !== 'all' && (
            <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 border border-teal-200 px-2 py-0.5 text-xs font-bold text-teal-800 dark:bg-teal-950/60 dark:border-teal-800 dark:text-teal-300">
              <Boxes size={11} />
              <span>Rack: {filters.rack}</span>
              <button 
                type="button" 
                onClick={() => handleUpdate({ rack: 'all' })}
                className="hover:text-teal-900 cursor-pointer ml-0.5"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {filters.shelf !== 'all' && (
            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-xs font-bold text-indigo-800 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300">
              <Layers size={11} />
              <span>Shelf: {filters.shelf}</span>
              <button 
                type="button" 
                onClick={() => handleUpdate({ shelf: 'all' })}
                className="hover:text-indigo-900 cursor-pointer ml-0.5"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {filters.supplier !== 'all' && (
            <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 border border-purple-200 px-2 py-0.5 text-xs font-bold text-purple-800 dark:bg-purple-950/60 dark:border-purple-800 dark:text-purple-300">
              <Building2 size={11} />
              <span>Supplier: {filters.supplier}</span>
              <button 
                type="button" 
                onClick={() => handleUpdate({ supplier: 'all' })}
                className="hover:text-purple-900 cursor-pointer ml-0.5"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {filters.stockStatus !== 'all' && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-300">
              <AlertTriangle size={11} />
              <span>
                Status: {
                  filters.stockStatus === 'low' ? 'Low Stock' :
                  filters.stockStatus === 'out_of_stock' ? 'Out of Stock' :
                  filters.stockStatus === 'healthy' ? 'Healthy Stock' :
                  filters.stockStatus === 'stockout7' ? 'Stockout ≤ 7d' :
                  filters.stockStatus === 'stockout15' ? 'Stockout 8-15d' :
                  filters.stockStatus === 'stockout30' ? 'Stockout 16-30d' :
                  'Overstocked'
                }
              </span>
              <button 
                type="button" 
                onClick={() => handleUpdate({ stockStatus: 'all' })}
                className="hover:text-amber-900 cursor-pointer ml-0.5"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {filters.expiryStatus !== 'all' && (
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 text-xs font-bold text-rose-800 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300">
              <Clock size={11} />
              <span>
                Expiry: {
                  filters.expiryStatus === 'expired' ? 'Expired' :
                  filters.expiryStatus === 'expiry30' ? 'Within 30 Days' :
                  filters.expiryStatus === 'expiry60' ? 'Within 60 Days' :
                  filters.expiryStatus === 'expiry90' ? 'Within 90 Days' :
                  'Safe (>90d)'
                }
              </span>
              <button 
                type="button" 
                onClick={() => handleUpdate({ expiryStatus: 'all' })}
                className="hover:text-rose-900 cursor-pointer ml-0.5"
              >
                <X size={12} />
              </button>
            </span>
          )}

          <div className="ml-auto text-xs font-semibold text-slate-500">
            Showing <strong className="text-slate-900 dark:text-slate-100">{filteredCount}</strong> of {totalCount} items
          </div>
        </div>
      )}

      {/* Expandable Advanced Filters Grid Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-slate-200 pt-4 dark:border-slate-800"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
              
              {/* 1. Category / Form Filter */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Package size={14} className="text-blue-600 dark:text-blue-400" />
                  <span>Category / Dosage Form</span>
                </label>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => handleUpdate({ category: 'all' })}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all text-left cursor-pointer",
                      filters.category === 'all'
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    )}
                  >
                    <span>All Categories</span>
                    <span className="text-[10px] font-black opacity-80">{categoryCounts.all}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdate({ category: 'tablet' })}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all text-left cursor-pointer",
                      filters.category === 'tablet'
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    )}
                  >
                    <span>Tablets (Oral Solids)</span>
                    <span className="text-[10px] font-black opacity-80">{categoryCounts.tablet}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdate({ category: 'capsule' })}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all text-left cursor-pointer",
                      filters.category === 'capsule'
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    )}
                  >
                    <span>Capsules (Softgels/Hard)</span>
                    <span className="text-[10px] font-black opacity-80">{categoryCounts.capsule}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdate({ category: 'syrup' })}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all text-left cursor-pointer",
                      filters.category === 'syrup'
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    )}
                  >
                    <span>Syrups & Suspensions</span>
                    <span className="text-[10px] font-black opacity-80">{categoryCounts.syrup}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdate({ category: 'injection' })}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all text-left cursor-pointer",
                      filters.category === 'injection'
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    )}
                  >
                    <span>Injections & Vials</span>
                    <span className="text-[10px] font-black opacity-80">{categoryCounts.injection}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdate({ category: 'others' })}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all text-left cursor-pointer",
                      filters.category === 'others'
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    )}
                  >
                    <span>Others (Drops, Ointments)</span>
                    <span className="text-[10px] font-black opacity-80">{categoryCounts.others}</span>
                  </button>
                </div>
              </div>

              {/* 2. Shelf Location & Physical Storage Zone */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <MapPin size={14} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Shelf Location / Zone</span>
                </label>
                
                <div className="flex flex-col gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aisle / Zone:</span>
                    <select
                      id="filter-select-aisle"
                      value={filters.aisle}
                      onChange={(e) => handleUpdate({ aisle: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer shadow-2xs"
                    >
                      <option value="all">All Aisles & Zones ({items.length})</option>
                      {AISLE_PRESETS.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({locationCounts.aisleMap[a.id] || 0})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rack / Bay:</span>
                      <select
                        id="filter-select-rack"
                        value={filters.rack}
                        onChange={(e) => handleUpdate({ rack: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer shadow-2xs"
                      >
                        <option value="all">All Racks</option>
                        {RACK_PRESETS.map(r => (
                          <option key={r} value={r}>
                            {r} ({locationCounts.rackMap[r] || 0})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Shelf Tier:</span>
                      <select
                        id="filter-select-shelf"
                        value={filters.shelf}
                        onChange={(e) => handleUpdate({ shelf: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer shadow-2xs"
                      >
                        <option value="all">All Shelves</option>
                        {SHELF_PRESETS.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.label} ({locationCounts.shelfMap[s.id] || 0})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                    Coordinates indicate exact warehouse aisle, bay, and eye-level position.
                  </p>
                </div>
              </div>

              {/* 3. Supplier / Manufacturer Filter */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Building2 size={14} className="text-purple-600 dark:text-purple-400" />
                  <span>Supplier / Manufacturer</span>
                </label>

                <div className="flex flex-col gap-2">
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search supplier name..."
                      value={supplierSearch}
                      onChange={(e) => setSupplierSearch(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white pl-7 pr-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                    />
                  </div>

                  <div className="max-h-[160px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700/50">
                    <button
                      type="button"
                      onClick={() => handleUpdate({ supplier: 'all' })}
                      className={cn(
                        "w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-bold rounded text-left transition-colors cursor-pointer",
                        filters.supplier === 'all'
                          ? "bg-purple-600 text-white"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80"
                      )}
                    >
                      <span>All Suppliers ({items.length})</span>
                      {filters.supplier === 'all' && <Check size={12} />}
                    </button>

                    {filteredSuppliersList.map(sup => (
                      <button
                        key={sup.name}
                        type="button"
                        onClick={() => handleUpdate({ supplier: sup.name })}
                        className={cn(
                          "w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-bold rounded text-left transition-colors cursor-pointer",
                          filters.supplier === sup.name
                            ? "bg-purple-600 text-white"
                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80"
                        )}
                      >
                        <span className="truncate pr-2">{sup.name}</span>
                        <span className={cn(
                          "text-[10px] rounded px-1 font-black",
                          filters.supplier === sup.name ? "bg-white/20 text-white" : "bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300"
                        )}>
                          {sup.count}
                        </span>
                      </button>
                    ))}

                    {filteredSuppliersList.length === 0 && (
                      <div className="py-3 text-center text-xs text-slate-400">
                        No matching suppliers
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 4. Stock & Expiry Runway Status */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400" />
                  <span>Stock Health & Expiry</span>
                </label>

                <div className="flex flex-col gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Stock Health:</span>
                    <select
                      id="filter-select-stock-status"
                      value={filters.stockStatus}
                      onChange={(e) => handleUpdate({ stockStatus: e.target.value as any })}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer shadow-2xs"
                    >
                      <option value="all">All Stock Statuses ({stockCounts.all})</option>
                      <option value="out_of_stock">🚨 Out of Stock / Depleted (0 pcs) ({stockCounts.outOfStock})</option>
                      <option value="low">⚠️ Low Stock (≤ Min Threshold) ({stockCounts.low})</option>
                      <option value="stockout7">⚡ Critical Runway (Depleting in ≤ 7 Days) ({stockCounts.stockout7})</option>
                      <option value="stockout15">⏳ Warning Runway (Depleting in 8–15 Days) ({stockCounts.stockout15})</option>
                      <option value="stockout30">📅 Planning Runway (Depleting in 16–30 Days) ({stockCounts.stockout30})</option>
                      <option value="healthy">✅ Healthy / Well Stocked ({stockCounts.healthy})</option>
                      <option value="overstocked">📦 Overstocked ({stockCounts.overstocked})</option>
                    </select>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expiration Proximity:</span>
                    <select
                      id="filter-select-expiry-status"
                      value={filters.expiryStatus}
                      onChange={(e) => handleUpdate({ expiryStatus: e.target.value as any })}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer shadow-2xs"
                    >
                      <option value="all">All Expiration Dates</option>
                      <option value="expired">🚫 Expired Medications (&lt; 0 Days)</option>
                      <option value="expiry30">🔴 Critical: Expiring within 30 Days</option>
                      <option value="expiry60">🟠 Warning: Expiring within 60 Days</option>
                      <option value="expiry90">🟡 Notice: Expiring within 90 Days</option>
                      <option value="safe">🟢 Safe / Fresh (&gt; 90 Days)</option>
                    </select>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={onResetFilters}
                      className="text-xs font-bold text-slate-500 hover:text-red-600 dark:hover:text-red-400 underline cursor-pointer"
                    >
                      Clear All Criteria
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
