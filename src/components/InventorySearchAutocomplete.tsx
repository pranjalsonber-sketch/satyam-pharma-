import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  Package, 
  FlaskConical, 
  Compass, 
  Plus, 
  ArrowRight, 
  Sliders, 
  Sparkles,
  Layers,
  MapPin,
  Barcode,
  CornerDownLeft,
  AlertCircle,
  Mic,
  MicOff
} from 'lucide-react';
import { Medicine } from '../types';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { getMedicineLocation } from '../lib/locationUtils';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';

interface InventorySearchAutocompleteProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  items: Medicine[];
  onSelectMedicine: (medicine: Medicine) => void;
  onLocateShelf?: (medicine: Medicine) => void;
  onQuickRestock?: (medicine: Medicine) => void;
  onAddNewMedicine?: () => void;
  isListening?: boolean;
  onToggleVoiceSearch?: () => void;
  placeholder?: string;
}

export const InventorySearchAutocomplete: React.FC<InventorySearchAutocompleteProps> = ({
  searchTerm,
  onSearchChange,
  items,
  onSelectMedicine,
  onLocateShelf,
  onQuickRestock,
  onAddNewMedicine,
  isListening = false,
  onToggleVoiceSearch,
  placeholder = 'Search inventory by medicine name, salt formula, barcode, or generic...'
}) => {
  const { tText } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [filterMode, setFilterMode] = useState<'all' | 'lowStockOnly'>('all');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute autocomplete suggestions in real-time
  const { allMatches, lowStockMatches, displaySuggestions } = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return { allMatches: [], lowStockMatches: [], displaySuggestions: [] };
    }

    const matches = items.filter(med => {
      const nameMatch = med.name.toLowerCase().includes(query);
      const genericMatch = med.genericName?.toLowerCase().includes(query);
      const saltMatch = med.salt?.toLowerCase().includes(query);
      const formulaMatch = med.formula?.toLowerCase().includes(query);
      const barcodeMatch = med.barcode?.toLowerCase().includes(query);
      const mfgMatch = med.manufacturer?.toLowerCase().includes(query);

      return nameMatch || genericMatch || saltMatch || formulaMatch || barcodeMatch || mfgMatch;
    });

    // Score & Sort matches:
    // 1. Starts with query in name gets highest priority
    // 2. Low stock items boosted if matching
    // 3. Name alphabetical
    const sorted = [...matches].sort((a, b) => {
      const aNameStarts = a.name.toLowerCase().startsWith(query);
      const bNameStarts = b.name.toLowerCase().startsWith(query);
      if (aNameStarts && !bNameStarts) return -1;
      if (!aNameStarts && bNameStarts) return 1;

      const aThreshold = a.minThreshold || 10;
      const bThreshold = b.minThreshold || 10;
      const aIsLow = a.stockQuantity <= aThreshold;
      const bIsLow = b.stockQuantity <= bThreshold;

      if (aIsLow && !bIsLow) return -1;
      if (!aIsLow && bIsLow) return 1;

      return a.name.localeCompare(b.name);
    });

    const lowStock = sorted.filter(m => m.stockQuantity <= (m.minThreshold || 10));
    const finalFiltered = filterMode === 'lowStockOnly' ? lowStock : sorted;

    return {
      allMatches: sorted,
      lowStockMatches: lowStock,
      displaySuggestions: finalFiltered.slice(0, 8)
    };
  }, [searchTerm, items, filterMode]);

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(-1);
    if (searchTerm.trim().length > 0) {
      setIsOpen(true);
    }
  }, [searchTerm, filterMode]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || displaySuggestions.length === 0) {
      if (e.key === 'ArrowDown' && searchTerm.trim().length > 0) {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < displaySuggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : displaySuggestions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < displaySuggestions.length) {
        const item = displaySuggestions[selectedIndex];
        handleSelectSuggestion(item);
      } else if (displaySuggestions.length > 0) {
        handleSelectSuggestion(displaySuggestions[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleSelectSuggestion = (medicine: Medicine) => {
    onSearchChange(medicine.name);
    onSelectMedicine(medicine);
    setIsOpen(false);
  };

  const clearSearch = () => {
    onSearchChange('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Helper to highlight matching substrings
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim() || !text) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-amber-200/90 text-amber-950 font-bold px-0.5 rounded-xs dark:bg-amber-500/30 dark:text-amber-200">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      {/* Search Input Box */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
        
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => {
            onSearchChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (searchTerm.trim().length > 0) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-xl border bg-white py-3 pl-10 pr-24 text-sm shadow-xs outline-none transition-all",
            "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
            "dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:ring-blue-500/20",
            isOpen && allMatches.length > 0 && "rounded-b-none border-b-transparent focus:ring-0"
          )}
          id="inventory-search-autocomplete-input"
          autoComplete="off"
        />

        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {searchTerm.length > 0 && (
            <button
              type="button"
              onClick={clearSearch}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}

          {onToggleVoiceSearch && (
            <button
              type="button"
              onClick={onToggleVoiceSearch}
              className={cn(
                "p-1.5 rounded-lg transition-colors cursor-pointer",
                isListening 
                  ? "bg-red-100 text-red-600 animate-pulse dark:bg-red-950 dark:text-red-400" 
                  : "text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              )}
              title="Voice Search"
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}
        </div>
      </div>

      {/* Autocomplete Suggestions Popover */}
      <AnimatePresence>
        {isOpen && searchTerm.trim().length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full z-50 overflow-hidden rounded-b-2xl border border-t-0 border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-zinc-900"
            id="inventory-autocomplete-dropdown"
          >
            {/* Popover Header & Fast Filter Pills */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-3.5 py-2 dark:border-slate-800 dark:bg-zinc-900/90">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer",
                    filterMode === 'all'
                      ? "bg-slate-900 text-white dark:bg-blue-600 shadow-xs"
                      : "text-slate-600 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800"
                  )}
                >
                  <span>All Matches</span>
                  <span className={cn(
                    "px-1.5 py-0.2 rounded-full text-[10px]",
                    filterMode === 'all' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  )}>
                    {allMatches.length}
                  </span>
                </button>

                {lowStockMatches.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterMode('lowStockOnly')}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer",
                      filterMode === 'lowStockOnly'
                        ? "bg-amber-600 text-white shadow-xs"
                        : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60"
                    )}
                  >
                    <AlertTriangle size={12} className={filterMode === 'lowStockOnly' ? "text-white" : "text-amber-600 dark:text-amber-400"} />
                    <span>Low Stock Alert</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-white">
                      {lowStockMatches.length}
                    </span>
                  </button>
                )}
              </div>

              <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-400">
                <span className="inline-flex items-center gap-0.5">
                  <kbd className="px-1 py-0.5 rounded bg-slate-200 text-slate-600 font-mono text-[9px] dark:bg-slate-800 dark:text-slate-300">↑↓</kbd> navigate
                </span>
                <span className="inline-flex items-center gap-0.5">
                  <kbd className="px-1 py-0.5 rounded bg-slate-200 text-slate-600 font-mono text-[9px] dark:bg-slate-800 dark:text-slate-300">↵</kbd> select
                </span>
                <span className="inline-flex items-center gap-0.5">
                  <kbd className="px-1 py-0.5 rounded bg-slate-200 text-slate-600 font-mono text-[9px] dark:bg-slate-800 dark:text-slate-300">esc</kbd> close
                </span>
              </div>
            </div>

            {/* Suggestions List */}
            <div ref={listRef} className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {displaySuggestions.length > 0 ? (
                displaySuggestions.map((medicine, idx) => {
                  const threshold = medicine.minThreshold || 10;
                  const isOut = medicine.stockQuantity <= 0;
                  const isLow = medicine.stockQuantity <= threshold;
                  const isCritical = medicine.stockQuantity <= Math.max(1, Math.floor(threshold * 0.3));
                  const isHighlighted = selectedIndex === idx;
                  const location = getMedicineLocation(medicine);

                  return (
                    <div
                      key={medicine.id}
                      onClick={() => handleSelectSuggestion(medicine)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        "group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 transition-colors cursor-pointer",
                        isHighlighted && "bg-blue-50/70 dark:bg-blue-950/40",
                        !isHighlighted && isLow && "bg-amber-50/30 dark:bg-amber-950/10",
                        !isHighlighted && isOut && "bg-red-50/30 dark:bg-red-950/10"
                      )}
                    >
                      {/* Left Side: Medicine Identification */}
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {highlightMatch(medicine.name, searchTerm)}
                          </span>

                          {/* Dosage Type Chip */}
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {medicine.type || 'tablet'}
                          </span>

                          {/* LOW STOCK / OUT OF STOCK BADGES (High-Visibility Highlighting) */}
                          {isOut ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-xs animate-pulse">
                              <AlertCircle size={11} className="stroke-[2.5]" />
                              <span>Out of Stock</span>
                            </span>
                          ) : isLow ? (
                            <span className={cn(
                              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-xs",
                              isCritical 
                                ? "bg-red-500 text-white animate-pulse" 
                                : "bg-amber-500 text-slate-950 font-black"
                            )}>
                              <AlertTriangle size={11} className="stroke-[2.5]" />
                              <span>{isCritical ? "Critical Low" : "Low Stock"} ({medicine.stockQuantity} left)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[10px] font-bold dark:bg-emerald-950/60 dark:text-emerald-300">
                              <CheckCircle2 size={10} />
                              <span>{medicine.stockQuantity} in stock</span>
                            </span>
                          )}
                        </div>

                        {/* Chemical Formula / Salt & Generic Name */}
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {(medicine.formula || medicine.salt) && (
                            <span className="inline-flex items-center gap-1 font-semibold text-purple-600 dark:text-purple-400">
                              <FlaskConical size={11} />
                              <span>{highlightMatch(medicine.formula || medicine.salt || '', searchTerm)}</span>
                            </span>
                          )}

                          {medicine.genericName && medicine.genericName !== medicine.name && (
                            <span className="text-[11px] text-slate-500">
                              Generic: {highlightMatch(medicine.genericName, searchTerm)}
                            </span>
                          )}

                          {medicine.barcode && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400">
                              <Barcode size={11} />
                              <span>{medicine.barcode}</span>
                            </span>
                          )}
                        </div>

                        {/* Location and Expiry Details */}
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                          <span className="inline-flex items-center gap-1 text-cyan-700 dark:text-cyan-400 font-medium">
                            <MapPin size={11} />
                            <span>{location.aisle} • {location.rack} • {location.shelf}</span>
                          </span>
                          {medicine.expiryDate && (
                            <span>• Exp: {formatDate(medicine.expiryDate)}</span>
                          )}
                        </div>
                      </div>

                      {/* Right Side: Stock Status & Quick Action Buttons */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
                        <div className="text-right">
                          <div className="text-sm font-black text-slate-900 dark:text-slate-100">
                            {formatCurrency(medicine.rate)}
                          </div>
                          <div className={cn(
                            "text-[10px] font-bold",
                            isOut ? "text-red-600 dark:text-red-400" :
                            isLow ? "text-amber-600 dark:text-amber-400" :
                            "text-slate-400"
                          )}>
                            Min: {threshold} units
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {isLow && onQuickRestock && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onQuickRestock(medicine);
                                setIsOpen(false);
                              }}
                              className="inline-flex items-center gap-1 rounded-md bg-amber-500 hover:bg-amber-600 px-2 py-1 text-[10px] font-black uppercase text-slate-950 transition-all active:scale-95 cursor-pointer shadow-xs"
                              title="Restock this medicine now"
                            >
                              <Plus size={11} className="stroke-[3]" />
                              <span>Restock</span>
                            </button>
                          )}

                          {onLocateShelf && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onLocateShelf(medicine);
                                setIsOpen(false);
                              }}
                              className="p-1 rounded-md text-cyan-600 hover:bg-cyan-50 dark:text-cyan-400 dark:hover:bg-cyan-950/40 transition-colors cursor-pointer"
                              title="Locate Shelf Position"
                            >
                              <Compass size={14} />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectSuggestion(medicine);
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 transition-all cursor-pointer"
                          >
                            <span>Filter</span>
                            <ArrowRight size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                /* Empty / No Matches State */
                <div className="p-6 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                    <Search size={18} />
                  </div>
                  <p className="mt-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                    {filterMode === 'lowStockOnly' 
                      ? `No low-stock medicines found matching "${searchTerm}"`
                      : `No medicines found matching "${searchTerm}"`}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Check your spelling or register this medication in your inventory database.
                  </p>
                  {onAddNewMedicine && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onAddNewMedicine();
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 active:scale-95 transition-all cursor-pointer shadow-xs"
                    >
                      <Plus size={13} />
                      <span>Add "{searchTerm}" to Inventory</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Footer Bar */}
            {displaySuggestions.length > 0 && (
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-3.5 py-2 text-[11px] font-medium text-slate-500 dark:border-slate-800 dark:bg-zinc-900/60">
                <span>
                  Showing {displaySuggestions.length} of {allMatches.length} matching {allMatches.length === 1 ? 'medicine' : 'medicines'}
                </span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {lowStockMatches.length > 0 ? (
                    <span className="text-amber-600 dark:text-amber-400">
                      ⚠️ {lowStockMatches.length} low-stock {lowStockMatches.length === 1 ? 'item requires' : 'items require'} attention
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ✓ All matching stock levels are adequate
                    </span>
                  )}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InventorySearchAutocomplete;
