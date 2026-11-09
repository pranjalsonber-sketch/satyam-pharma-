import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Search, 
  Package, 
  User, 
  Users, 
  X, 
  ArrowRight, 
  CornerDownLeft, 
  Command, 
  Sparkles, 
  ShoppingCart, 
  FileText, 
  Settings, 
  Calendar, 
  IndianRupee, 
  Barcode, 
  Phone, 
  ExternalLink,
  ShieldCheck,
  Tag,
  Check,
  Eye,
  Layers,
  Zap
} from 'lucide-react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Medicine, Patient, Wholesaler } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from './AuthProvider';

export interface SearchResult {
  id: string;
  type: 'inventory' | 'patient' | 'wholesaler' | 'action';
  title: string;
  subtitle?: string;
  badge?: string;
  matchedField?: string;
  matchedValue?: string;
  tabTarget: string;
  data: any;
  rate?: number;
  stock?: number;
  barcode?: string;
  phone?: string;
}

interface GlobalSearchProps {
  onNavigate?: (tab: string, itemData?: any) => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ onNavigate }) => {
  const { t, tText } = useLanguage();
  const { profile } = useAuth();
  const isClerkRole = profile?.role === 'clerk';
  const [queryStr, setQueryStr] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'inventory' | 'patient' | 'wholesaler' | 'action'>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [previewItem, setPreviewItem] = useState<SearchResult | null>(null);

  const [data, setData] = useState<{
    inventory: Medicine[];
    patients: Patient[];
    wholesalers: Wholesaler[];
  }>({
    inventory: [],
    patients: [],
    wholesalers: [],
  });

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Real-time Firestore subscriptions
  useEffect(() => {
    const unsubInventory = onSnapshot(query(collection(db, 'inventory')), (snap) => {
      setData(prev => ({ 
        ...prev, 
        inventory: snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Medicine)) 
      }));
    }, (err) => {
      console.warn("Global search inventory listener notice:", err.message);
    });

    const unsubPatients = onSnapshot(query(collection(db, 'patients')), (snap) => {
      setData(prev => ({ 
        ...prev, 
        patients: snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)) 
      }));
    }, (err) => {
      console.warn("Global search patients listener notice:", err.message);
    });

    const unsubWholesalers = onSnapshot(query(collection(db, 'wholesalers')), (snap) => {
      setData(prev => ({ 
        ...prev, 
        wholesalers: snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Wholesaler)) 
      }));
    }, (err) => {
      console.warn("Global search wholesalers listener notice:", err.message);
    });

    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      unsubInventory();
      unsubPatients();
      unsubWholesalers();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // System Quick Actions
  const systemActions: SearchResult[] = useMemo(() => [
    {
      id: 'action-batch-optimizer',
      type: 'action',
      title: 'AI Batch Purchase Optimizer',
      subtitle: 'Calculate optimal reorder quantities by vendor lead times & sales velocity',
      badge: 'AI Procurement',
      tabTarget: 'wholesalers',
      data: { tab: 'wholesalers' }
    },
    {
      id: 'action-pos',
      type: 'action',
      title: 'POS Billing & Checkout Counter',
      subtitle: 'Create new sale invoice, scan barcodes, print thermal bills',
      badge: 'Quick Sale',
      tabTarget: 'pos',
      data: { tab: 'pos' }
    },
    {
      id: 'action-inventory',
      type: 'action',
      title: 'Inventory & Stock Batches',
      subtitle: 'Manage medicines, add stock batches, print QR codes',
      badge: 'Catalog',
      tabTarget: 'inventory',
      data: { tab: 'inventory' }
    },
    {
      id: 'action-demand-forecaster',
      type: 'action',
      title: 'AI Stock Demand Forecaster & Seasonal Supply Radar',
      subtitle: 'Predict future stock needs with Gemini AI based on seasonal disease patterns and consumption rates',
      badge: 'Gemini AI',
      tabTarget: 'inventory',
      data: { action: 'open-demand-forecaster' }
    },
    {
      id: 'action-expiry',
      type: 'action',
      title: '90-Day Expiry Audit & Return Radar (PDF)',
      subtitle: 'Audit near-expiry medicines and export formal PDF audit statements',
      badge: 'Audit PDF',
      tabTarget: 'expiry_report',
      data: { tab: 'expiry_report' }
    },
    {
      id: 'action-sales-report',
      type: 'action',
      title: 'Sales & Revenue Audit Report (PDF)',
      subtitle: 'Generate formatted sales statements, GST breakdown, customer invoices',
      badge: 'Sales PDF',
      tabTarget: 'sales_report_modal',
      data: { action: 'open-sales-report' }
    },
    {
      id: 'action-patients',
      type: 'action',
      title: 'Patients & Clinical Rx History',
      subtitle: 'Lookup patient medical profiles, scan prescriptions with AI',
      badge: 'Records',
      tabTarget: 'patients',
      data: { tab: 'patients' }
    },
    {
      id: 'action-wholesalers',
      type: 'action',
      title: 'Wholesalers & Supplier Accounts',
      subtitle: 'Manage wholesale distributor ledgers, upload invoices',
      badge: 'Vendors',
      tabTarget: 'wholesalers',
      data: { tab: 'wholesalers' }
    },
    {
      id: 'action-supplier-performance',
      type: 'action',
      title: 'Supplier Performance & Lead Time Analytics',
      subtitle: 'Recharts visualization of vendor SLAs, actual lead times & purchase spend history',
      badge: 'Analytics',
      tabTarget: 'wholesalers',
      data: { tab: 'wholesalers', subTab: 'performance' }
    },
    {
      id: 'action-activity-logs',
      type: 'action',
      title: 'Activity Log & Accountability Audit Trail',
      subtitle: 'Track POS sales, inventory modifications & staff action timestamps',
      badge: 'Audit',
      tabTarget: 'activity_logs',
      data: { tab: 'activity_logs' }
    },
    {
      id: 'action-system-backup',
      type: 'action',
      title: '1-Click System State Backup & Disaster Recovery',
      subtitle: 'Create JSON snapshots of inventory and patient records, recover during sync errors',
      badge: 'Recovery',
      tabTarget: 'system_backup_modal',
      data: { action: 'open-system-backup' }
    },
    {
      id: 'action-ai-assistant',
      type: 'action',
      title: 'Ask Medicine Uses & Formula AI Assistant',
      subtitle: 'Ask about any medicine uses, active salt formula, strength, dosage guidelines & substitutes',
      badge: 'Clinical AI',
      tabTarget: 'ai',
      data: { tab: 'ai' }
    },
    {
      id: 'action-midnight-theme',
      type: 'action',
      title: 'Midnight High-Contrast Theme (Night Shift Mode)',
      subtitle: 'Switch to ultra-dark high-contrast palette with eye-strain reduction for late-night pharmacy shifts',
      badge: 'Night Shift',
      tabTarget: 'settings',
      data: { tab: 'settings', action: 'theme-settings' }
    },
    {
      id: 'action-settings',
      type: 'action',
      title: 'System Settings & SMTP Email Alerts',
      subtitle: 'Configure automated inventory alerts, database backup, clinic profile',
      badge: 'Config',
      tabTarget: 'settings',
      data: { tab: 'settings' }
    }
  ], []);

  const allowedSystemActions = useMemo(() => {
    if (!isClerkRole) return systemActions;
    const clerkAllowedTargets = new Set(['inventory', 'pos', 'expiry_report', 'ai']);
    return systemActions.filter(a => clerkAllowedTargets.has(a.tabTarget));
  }, [systemActions, isClerkRole]);

  // Global Keyboard Shortcuts (Cmd+K / Ctrl+K / '/' to focus, Escape to close)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K or '/' (when not already in an input)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }

      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
        return;
      }

      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen]);

  // Compute matched results
  const allResults = useMemo(() => {
    const q = queryStr.trim().toLowerCase();
    if (!q) {
      // When empty query, return top quick actions and recent medicines
      return allowedSystemActions.slice(0, 4);
    }

    const tokens = q.split(/\s+/).filter(Boolean);
    const matches: SearchResult[] = [];

    // 1. Search Medicines
    data.inventory.forEach(item => {
      const name = (item.name || '').toLowerCase();
      const generic = (item.genericName || '').toLowerCase();
      const salt = (item.salt || '').toLowerCase();
      const barcode = (item.barcode || '').toLowerCase();
      const mfr = (item.manufacturer || '').toLowerCase();
      const type = (item.type || '').toLowerCase();
      const id = (item.id || '').toLowerCase();

      // Check matching batch numbers
      const matchedBatch = item.batches?.find(b => b.batchNumber && b.batchNumber.toLowerCase().includes(q));

      const nameMatch = tokens.every(t => name.includes(t));
      const genericMatch = generic && tokens.every(t => generic.includes(t));
      const saltMatch = salt && tokens.every(t => salt.includes(t));
      const barcodeMatch = barcode && (barcode.includes(q) || tokens.some(t => barcode.includes(t)));
      const batchMatch = Boolean(matchedBatch);
      const mfrMatch = mfr && tokens.every(t => mfr.includes(t));
      const idMatch = id.includes(q);

      if (nameMatch || genericMatch || saltMatch || barcodeMatch || batchMatch || mfrMatch || idMatch) {
        let matchedField: string | undefined;
        let matchedValue: string | undefined;

        if (barcodeMatch) {
          matchedField = 'Barcode';
          matchedValue = item.barcode;
        } else if (batchMatch && matchedBatch) {
          matchedField = 'Batch #';
          matchedValue = matchedBatch.batchNumber;
        } else if (saltMatch) {
          matchedField = 'Salt';
          matchedValue = item.salt;
        } else if (mfrMatch) {
          matchedField = 'Manufacturer';
          matchedValue = item.manufacturer;
        }

        matches.push({
          id: item.id,
          type: 'inventory',
          title: item.name,
          subtitle: item.genericName || (item.salt ? `Salt: ${item.salt}` : `${item.type.toUpperCase()}`),
          badge: item.stockQuantity <= (item.minThreshold || 5) 
            ? (item.stockQuantity <= 0 ? 'Out of Stock' : `Low Stock: ${item.stockQuantity}`) 
            : `In Stock: ${item.stockQuantity}`,
          matchedField,
          matchedValue,
          tabTarget: 'inventory',
          data: item,
          rate: item.rate,
          stock: item.stockQuantity,
          barcode: item.barcode
        });
      }
    });

    // 2. Search Patients (Owners / Managers only)
    if (!isClerkRole) {
      data.patients.forEach(patient => {
        const name = (patient.name || '').toLowerCase();
        const mobile = (patient.mobile || '').toLowerCase();
        const notesContent = (patient.notes || []).map(n => n.content.toLowerCase()).join(' ');

        const nameMatch = tokens.every(t => name.includes(t));
        const mobileMatch = mobile.includes(q);
        const notesMatch = tokens.some(t => notesContent.includes(t));

        if (nameMatch || mobileMatch || notesMatch) {
          matches.push({
            id: patient.id,
            type: 'patient',
            title: patient.name,
            subtitle: patient.mobile ? `Mobile: ${patient.mobile} ${patient.age ? `• ${patient.age} yrs` : ''}` : 'Patient Record',
            badge: patient.notes && patient.notes.length > 0 ? `${patient.notes.length} Rx/Notes` : 'Patient',
            matchedField: mobileMatch ? 'Phone' : (notesMatch ? 'Rx Notes' : undefined),
            matchedValue: mobileMatch ? patient.mobile : undefined,
            tabTarget: 'patients',
            data: patient,
            phone: patient.mobile
          });
        }
      });

      // 3. Search Wholesalers (Owners / Managers only)
      data.wholesalers.forEach(wholesaler => {
        const name = (wholesaler.name || '').toLowerCase();
        const contact = (wholesaler.contact || '').toLowerCase();
        const email = (wholesaler.email || '').toLowerCase();
        const brands = (wholesaler.brands || []).join(' ').toLowerCase();

        const nameMatch = tokens.every(t => name.includes(t));
        const contactMatch = contact.includes(q);
        const emailMatch = email.includes(q);
        const brandsMatch = tokens.some(t => brands.includes(t));

        if (nameMatch || contactMatch || emailMatch || brandsMatch) {
          matches.push({
            id: wholesaler.id,
            type: 'wholesaler',
            title: wholesaler.name,
            subtitle: wholesaler.contact ? `Contact: ${wholesaler.contact} ${wholesaler.address ? `• ${wholesaler.address}` : ''}` : 'Wholesale Distributor',
            badge: 'Supplier',
            matchedField: contactMatch ? 'Contact' : (emailMatch ? 'Email' : undefined),
            matchedValue: contactMatch ? wholesaler.contact : (emailMatch ? wholesaler.email : undefined),
            tabTarget: 'wholesalers',
            data: wholesaler,
            phone: wholesaler.contact
          });
        }
      });
    }

    // 4. Search System Actions
    allowedSystemActions.forEach(action => {
      const title = action.title.toLowerCase();
      const subtitle = (action.subtitle || '').toLowerCase();
      if (tokens.some(t => title.includes(t) || subtitle.includes(t))) {
        matches.push(action);
      }
    });

    return matches;
  }, [queryStr, data, allowedSystemActions, isClerkRole]);

  // Filtered by Category Tab
  const filteredResults = useMemo(() => {
    if (categoryFilter === 'all') return allResults.slice(0, 12);
    return allResults.filter(r => r.type === categoryFilter).slice(0, 12);
  }, [allResults, categoryFilter]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredResults.length, queryStr, categoryFilter]);

  // Scroll active item into view
  useEffect(() => {
    if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [selectedIndex]);

  // Navigate to selected result
  const handleSelectResult = useCallback((result: SearchResult) => {
    setIsOpen(false);
    
    if (result.tabTarget === 'sales_report_modal' || result.data?.action === 'open-sales-report') {
      window.dispatchEvent(new CustomEvent('open-sales-report'));
      return;
    }

    if (result.tabTarget === 'system_backup_modal' || result.data?.action === 'open-system-backup') {
      window.dispatchEvent(new CustomEvent('open-system-backup'));
      return;
    }

    if (result.data?.action === 'open-stock-email-alerts') {
      window.dispatchEvent(new CustomEvent('open-stock-email-alerts'));
      return;
    }

    if (result.data?.action === 'open-demand-forecaster') {
      window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'inventory' } }));
      if (onNavigate) onNavigate('inventory');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('open-demand-forecaster'));
      }, 100);
      return;
    }

    // Broadcast navigation event
    window.dispatchEvent(new CustomEvent('navigate-tab', { 
      detail: { tab: result.tabTarget, data: result.data } 
    }));

    if (onNavigate) {
      onNavigate(result.tabTarget, result.data);
    }
  }, [onNavigate]);

  // Keyboard navigation within the input/dropdown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || filteredResults.length === 0) {
      if (e.key === 'ArrowDown') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredResults.length) % filteredResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredResults[selectedIndex]) {
        handleSelectResult(filteredResults[selectedIndex]);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        setSelectedIndex(prev => (prev - 1 + filteredResults.length) % filteredResults.length);
      } else {
        setSelectedIndex(prev => (prev + 1) % filteredResults.length);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  /**
   * Real-time Multi-term Substring Highlighter
   * Breaks query into tokens and highlights all matched parts with high-contrast pill styling
   */
  const highlightMatch = (text: string, search: string) => {
    if (!text) return null;
    const cleanSearch = search.trim();
    if (!cleanSearch) return <span>{text}</span>;

    // Build regex with all tokens
    const tokens = cleanSearch
      .split(/\s+/)
      .filter(Boolean)
      .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    if (tokens.length === 0) return <span>{text}</span>;

    const regex = new RegExp(`(${tokens.join('|')})`, 'gi');
    const parts = text.split(regex);

    return (
      <span>
        {parts.map((part, i) => {
          const isMatch = tokens.some(t => part.toLowerCase() === t.toLowerCase());
          return isMatch ? (
            <mark 
              key={i} 
              className="bg-amber-300 text-amber-950 dark:bg-amber-400/30 dark:text-amber-200 dark:ring-1 dark:ring-amber-400/50 font-black px-1 py-0.5 rounded text-inherit inline-block mx-0.5 shadow-2xs"
            >
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          );
        })}
      </span>
    );
  };

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = {
      all: allResults.length,
      inventory: 0,
      patient: 0,
      wholesaler: 0,
      action: 0
    };
    allResults.forEach(r => {
      if (r.type in counts) {
        counts[r.type as keyof typeof counts]++;
      }
    });
    return counts;
  }, [allResults]);

  const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  return (
    <div ref={searchRef} className="relative w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg">
      {/* Search Input Bar */}
      <div className={cn(
        "flex items-center bg-slate-100/90 dark:bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-200/80 dark:border-slate-700/80 transition-all duration-200 shadow-2xs",
        isOpen ? "ring-2 ring-blue-500/30 border-blue-500 bg-white dark:bg-slate-900 shadow-md" : "hover:border-slate-300 dark:hover:border-slate-600"
      )}>
        <Search className={cn("shrink-0 mr-2.5 transition-colors", isOpen ? "text-blue-600 dark:text-blue-400" : "text-slate-400")} size={16} />
        
        <input 
          ref={inputRef}
          type="text" 
          placeholder={`${t('search')} medicines, patients, barcodes (⌘K)...`} 
          className="bg-transparent text-xs sm:text-sm w-full outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 font-medium"
          value={queryStr}
          onChange={(e) => {
            setQueryStr(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />

        <div className="flex items-center gap-1.5 shrink-0">
          {queryStr && (
            <button 
              type="button"
              onClick={() => {
                setQueryStr('');
                inputRef.current?.focus();
              }} 
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              title="Clear search"
            >
              <X size={13} />
            </button>
          )}

          {/* Keyboard Shortcut Indicator Badge */}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-400 bg-slate-200/70 dark:bg-slate-700/70 dark:text-slate-400 rounded border border-slate-300/50 dark:border-slate-600/50 select-none">
            {isMac ? '⌘' : 'Ctrl'}K
          </kbd>
        </div>
      </div>

      {/* Interactive Results Dropdown Popup */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[500px]"
          >
            {/* Category Filter Navigation Pills */}
            <div className="flex items-center gap-1.5 p-2 bg-slate-50/80 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800 overflow-x-auto no-scrollbar text-xs">
              {[
                { id: 'all', label: 'All', icon: Layers, count: categoryCounts.all },
                { id: 'inventory', label: 'Medicines', icon: Package, count: categoryCounts.inventory },
                { id: 'patient', label: 'Patients', icon: User, count: categoryCounts.patient },
                { id: 'wholesaler', label: 'Wholesalers', icon: Users, count: categoryCounts.wholesaler },
                { id: 'action', label: 'Quick Actions', icon: Zap, count: categoryCounts.action },
              ].map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(cat.id as any)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer",
                    categoryFilter === cat.id 
                      ? "bg-blue-600 text-white shadow-xs" 
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
                  )}
                >
                  <cat.icon size={12} />
                  <span>{cat.label}</span>
                  {cat.count > 0 && (
                    <span className={cn(
                      "px-1.5 py-0.2 rounded-full text-[9px] font-black font-mono",
                      categoryFilter === cat.id ? "bg-blue-800 text-blue-100" : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    )}>
                      {cat.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Results List */}
            <div 
              ref={resultsContainerRef}
              className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-slate-100/50 dark:divide-slate-800/50"
            >
              {filteredResults.length > 0 ? (
                filteredResults.map((result, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      ref={(el) => { itemRefs.current[idx] = el; }}
                      type="button"
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => handleSelectResult(result)}
                      className={cn(
                        "flex w-full items-start gap-3 p-3 rounded-xl transition-all text-left cursor-pointer border",
                        isSelected 
                          ? "bg-blue-50/90 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 shadow-xs" 
                          : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      )}
                    >
                      {/* Icon Avatar */}
                      <div className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform",
                        isSelected && "scale-105",
                        result.type === 'inventory' ? "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400" :
                        result.type === 'patient' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" :
                        result.type === 'wholesaler' ? "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400" :
                        "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
                      )}>
                        {result.type === 'inventory' ? <Package size={17} /> :
                         result.type === 'patient' ? <User size={17} /> :
                         result.type === 'wholesaler' ? <Users size={17} /> :
                         <Sparkles size={17} />}
                      </div>

                      {/* Info Content with Real-time Highlighting */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {highlightMatch(result.title, queryStr)}
                          </div>
                          
                          {result.rate !== undefined && (
                            <span className="text-xs font-black text-blue-600 dark:text-blue-400 font-mono">
                              {formatCurrency(result.rate)}
                            </span>
                          )}
                        </div>

                        {result.subtitle && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-normal truncate mt-0.5">
                            {highlightMatch(result.subtitle, queryStr)}
                          </div>
                        )}

                        {/* Matched Field Extra Badge */}
                        {result.matchedField && result.matchedValue && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
                              Matched {result.matchedField}:
                            </span>
                            <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-900">
                              {highlightMatch(result.matchedValue, queryStr)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right Tag & Action Indicator */}
                      <div className="flex flex-col items-end justify-between shrink-0 gap-1 pl-2">
                        {result.badge && (
                          <span className={cn(
                            "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                            result.badge.includes('Out of Stock') ? "bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300" :
                            result.badge.includes('Low Stock') ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300" :
                            result.type === 'action' ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300" :
                            "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          )}>
                            {result.badge}
                          </span>
                        )}

                        {isSelected && (
                          <span className="flex items-center gap-1 text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-1">
                            <span>Open</span>
                            <CornerDownLeft size={11} />
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="py-12 px-6 text-center">
                  <div className="flex justify-center mb-3">
                    <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                      <Search size={22} />
                    </div>
                  </div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No records found matching "{queryStr}"</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    Try searching by brand name, generic salt, batch number, patient phone, or barcode number.
                  </p>
                </div>
              )}
            </div>

            {/* Keyboard Shortcuts Navigation Footer */}
            <div className="bg-slate-50 dark:bg-slate-950/60 p-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono shadow-2xs">↑</kbd>
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono shadow-2xs">↓</kbd>
                  <span>to navigate</span>
                </span>

                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono shadow-2xs">↵</kbd>
                  <span>to open</span>
                </span>

                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono shadow-2xs">Esc</kbd>
                  <span>to dismiss</span>
                </span>
              </div>

              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">
                {filteredResults.length} {filteredResults.length === 1 ? 'record' : 'records'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GlobalSearch;
