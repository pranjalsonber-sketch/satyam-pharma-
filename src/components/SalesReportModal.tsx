import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthProvider';
import { useLanguage } from '../context/LanguageContext';
import { Sale, Medicine } from '../types';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { generateSalesReportPDF, exportSalesReportCSV, SalesReportSummary } from '../lib/salesReportPdf';
import { canViewFinancials } from '../lib/permissions';
import { SensitiveValueMask } from './SensitiveValueMask';
import { logAuditAction } from '../lib/auditLogger';
import { 
  FileText, 
  Download, 
  Printer, 
  FileSpreadsheet, 
  Calendar, 
  IndianRupee, 
  ShoppingCart, 
  TrendingUp, 
  CreditCard, 
  Smartphone, 
  User, 
  X, 
  Filter, 
  RefreshCw, 
  CheckCircle2, 
  Layers, 
  Search,
  Sparkles,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SalesReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DateRangeOption = 'today' | 'yesterday' | '7days' | '30days' | 'this_month' | 'all' | 'custom';

export const SalesReportModal: React.FC<SalesReportModalProps> = ({ isOpen, onClose }) => {
  const { profile } = useAuth();
  const { t, isHindi } = useLanguage();

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRangeOption>('7days');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cash' | 'upi' | 'card'>('all');
  const [billingFilter, setBillingFilter] = useState<'all' | 'retail' | 'gst'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Fetch all sales on open
  const fetchSales = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'sales'), orderBy('timestamp', 'desc'));
      const snap = await getDocs(q);
      const list: Sale[] = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Sale);
      });
      setSales(list);
    } catch (err) {
      console.error('Error fetching sales for report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSales();
    }
  }, [isOpen]);

  // Compute filtered sales based on date range and filters
  const { filteredSales, dateRangeLabel } = useMemo(() => {
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    let label = 'Last 7 Days';

    if (dateRange === 'today') {
      label = 'Today';
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (dateRange === 'yesterday') {
      label = 'Yesterday';
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      startDate = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0);
      endDate = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59);
    } else if (dateRange === '7days') {
      label = 'Last 7 Days';
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
    } else if (dateRange === '30days') {
      label = 'Last 30 Days';
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 29);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
    } else if (dateRange === 'this_month') {
      label = 'This Calendar Month';
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      endDate = new Date();
    } else if (dateRange === 'custom') {
      label = `${customStartDate} to ${customEndDate}`;
      startDate = new Date(`${customStartDate}T00:00:00`);
      endDate = new Date(`${customEndDate}T23:59:59`);
    } else {
      label = 'All Recorded Sales';
    }

    const filtered = sales.filter(sale => {
      const saleDate = new Date(sale.timestamp);

      // Date check
      if (startDate && saleDate < startDate) return false;
      if (endDate && saleDate > endDate) return false;

      // Payment filter
      if (paymentFilter !== 'all' && (sale.paymentMethod || 'cash') !== paymentFilter) {
        return false;
      }

      // Billing filter
      if (billingFilter !== 'all') {
        const bType = (sale as any).billingType || 'retail';
        if (billingFilter === 'retail' && bType !== 'retail') return false;
        if (billingFilter === 'gst' && bType !== 'gst' && bType !== 'tax_invoice') return false;
      }

      // Search filter
      if (searchTerm.trim() !== '') {
        const qLower = searchTerm.toLowerCase();
        const cust = (sale.customerName || '').toLowerCase();
        const mob = (sale.customerMobile || '').toLowerCase();
        const inv = ((sale as any).invoiceNumber || sale.id).toLowerCase();
        const itemsStr = Array.isArray(sale.items)
          ? sale.items.map(i => i.name || i.medicineName || '').join(' ').toLowerCase()
          : '';

        if (!cust.includes(qLower) && !mob.includes(qLower) && !inv.includes(qLower) && !itemsStr.includes(qLower)) {
          return false;
        }
      }

      return true;
    });

    return { filteredSales: filtered, dateRangeLabel: label };
  }, [sales, dateRange, customStartDate, customEndDate, paymentFilter, billingFilter, searchTerm]);

  // Aggregate Summary Metrics
  const summary = useMemo<SalesReportSummary>(() => {
    let totalRevenue = 0;
    let totalItemsSold = 0;
    const paymentBreakdown = {
      cash: 0,
      cashCount: 0,
      upi: 0,
      upiCount: 0,
      card: 0,
      cardCount: 0,
    };
    const billingBreakdown = {
      retail: 0,
      gst: 0,
      tax_invoice: 0,
    };
    const medSalesMap: Record<string, { quantity: number; revenue: number }> = {};

    filteredSales.forEach(sale => {
      const amount = Number(sale.totalAmount) || 0;
      totalRevenue += amount;

      const pMethod = sale.paymentMethod || 'cash';
      if (pMethod === 'upi') {
        paymentBreakdown.upi += amount;
        paymentBreakdown.upiCount += 1;
      } else if (pMethod === 'card') {
        paymentBreakdown.card += amount;
        paymentBreakdown.cardCount += 1;
      } else {
        paymentBreakdown.cash += amount;
        paymentBreakdown.cashCount += 1;
      }

      const bType = (sale as any).billingType || 'retail';
      if (bType === 'gst') billingBreakdown.gst += amount;
      else if (bType === 'tax_invoice') billingBreakdown.tax_invoice += amount;
      else billingBreakdown.retail += amount;

      if (Array.isArray(sale.items)) {
        sale.items.forEach(it => {
          const qty = Number(it.quantity) || 1;
          const price = Number(it.price) || Number((it as any).rate) || 0;
          totalItemsSold += qty;

          const medName = it.name || it.medicineName || 'Medicine Item';
          if (!medSalesMap[medName]) {
            medSalesMap[medName] = { quantity: 0, revenue: 0 };
          }
          medSalesMap[medName].quantity += qty;
          medSalesMap[medName].revenue += qty * price;
        });
      }
    });

    const topSellingMedicines = Object.entries(medSalesMap)
      .map(([name, data]) => ({
        name,
        quantity: data.quantity,
        revenue: data.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    const totalTransactions = filteredSales.length;
    const averageOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    return {
      dateRangeLabel,
      startDate: customStartDate,
      endDate: customEndDate,
      generatedAt: new Date(),
      generatedBy: profile?.displayName || profile?.email?.split('@')[0] || 'Administrator',
      userRole: profile?.role || 'admin',
      totalRevenue,
      totalTransactions,
      averageOrderValue,
      totalItemsSold,
      paymentBreakdown,
      billingBreakdown,
      topSellingMedicines,
      pharmacyName: 'SATYAM MEDICAL & PHARMA ERP',
      pharmacyAddress: 'Central Healthcare Complex, Station Road, Raipur (C.G.)',
      gstin: '27AAAAA0000A1Z5',
      dlNumber: '20B/21B-MH-102948',
      contactNumber: '+91 98765 43210'
    };
  }, [filteredSales, dateRangeLabel, customStartDate, customEndDate, profile]);

  // Trigger PDF Generation
  const handleExportPDF = () => {
    try {
      setIsExporting(true);
      const filename = generateSalesReportPDF(filteredSales, summary, paymentFilter);
      setSuccessToast(`Successfully downloaded formatted PDF: ${filename}`);
      setTimeout(() => setSuccessToast(null), 4000);

      // Log financial report export audit
      logAuditAction({
        action: 'Financial Sales Report PDF Exported',
        category: 'financial_export',
        description: `Financial summary report downloaded as PDF by ${profile?.displayName || profile?.email} (${filteredSales.length} transactions, ₹${summary.totalRevenue.toFixed(2)})`,
        module: 'pos',
        userEmail: profile?.email,
        userName: profile?.displayName,
        userRole: profile?.role,
        userId: profile?.uid,
        severity: 'info',
        details: {
          format: 'PDF',
          filename,
          dateRange: dateRangeLabel,
          totalTransactions: filteredSales.length,
          totalRevenue: summary.totalRevenue
        }
      });
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate Sales Report PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  // Trigger CSV Generation
  const handleExportCSV = () => {
    try {
      exportSalesReportCSV(filteredSales, summary);
      setSuccessToast('Exported sales ledger CSV spreadsheet successfully.');
      setTimeout(() => setSuccessToast(null), 4000);

      // Log financial CSV export audit
      logAuditAction({
        action: 'Financial Sales Ledger CSV Exported',
        category: 'financial_export',
        description: `Detailed sales ledger data exported to CSV by ${profile?.displayName || profile?.email} (${filteredSales.length} records, ₹${summary.totalRevenue.toFixed(2)})`,
        module: 'pos',
        userEmail: profile?.email,
        userName: profile?.displayName,
        userRole: profile?.role,
        userId: profile?.uid,
        severity: 'info',
        details: {
          format: 'CSV',
          recordCount: filteredSales.length,
          dateRange: dateRangeLabel,
          totalRevenue: summary.totalRevenue
        }
      });
    } catch (err) {
      console.error('Error generating CSV:', err);
      alert('Failed to export CSV.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-xs"
        onClick={onClose}
      />

      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="relative flex flex-col w-full max-w-5xl max-h-[92vh] rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Modal Top Header */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-blue-600 shadow-sm">
              <FileText size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {isHindi ? 'बिक्री एवं राजस्व रिपोर्ट (PDF एक्सपोर्ट)' : 'Sales & Revenue Report (PDF Export)'}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40">
                  Offline Records
                </span>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Audited statements, GST breakdown, itemized invoices & payment channels
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              id="sales-report-export-csv-btn"
              className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-[10px] font-bold uppercase tracking-widest text-emerald-800 hover:bg-emerald-100 active:scale-95 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300 transition-all cursor-pointer"
              title="Download CSV spreadsheet"
            >
              <FileSpreadsheet size={14} className="text-emerald-600 dark:text-emerald-400" />
              <span>CSV Ledger</span>
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isExporting || filteredSales.length === 0}
              id="sales-report-export-pdf-btn"
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white shadow-sm hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
              title="Generate printable PDF report directly from browser"
            >
              <Download size={14} />
              <span>{isExporting ? 'Generating PDF...' : 'Download Formatted PDF'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Controls & Filter Bar */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
              {/* Date Preset Selector */}
              <div className="sm:col-span-4">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Report Period
                </label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as DateRangeOption)}
                  id="sales-report-date-range"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="today">Today Only</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="7days">Last 7 Days (Default)</option>
                  <option value="30days">Last 30 Days</option>
                  <option value="this_month">This Calendar Month</option>
                  <option value="custom">Custom Date Range...</option>
                  <option value="all">All Time (Full Ledger)</option>
                </select>
              </div>

              {/* Payment Mode Selector */}
              <div className="sm:col-span-3">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Payment Mode
                </label>
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value as any)}
                  id="sales-report-payment-filter"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="all">All Payment Channels</option>
                  <option value="cash">Cash Counter Only</option>
                  <option value="upi">UPI / QR Digital</option>
                  <option value="card">Card POS Terminal</option>
                </select>
              </div>

              {/* Billing Type Selector */}
              <div className="sm:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Tax / Bill Type
                </label>
                <select
                  value={billingFilter}
                  onChange={(e) => setBillingFilter(e.target.value as any)}
                  id="sales-report-billing-filter"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="all">All Types</option>
                  <option value="retail">Retail Bill</option>
                  <option value="gst">GST Tax Invoice</option>
                </select>
              </div>

              {/* Search input */}
              <div className="sm:col-span-3">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                  Search Invoices
                </label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Customer, invoice, medicine..."
                    id="sales-report-search-input"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* Custom Date Range Row */}
            {dateRange === 'custom' && (
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-700/60">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-400">Start Date:</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-400">End Date:</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Gross Sales Revenue</span>
              <p className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                <SensitiveValueMask 
                  isAuthorized={canViewFinancials(profile)} 
                  value={formatCurrency(summary.totalRevenue)} 
                />
              </p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                {summary.totalTransactions} Completed Invoices
              </p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 shadow-xs dark:border-blue-900/30 dark:bg-blue-950/20">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-400">Avg Order Value (AOV)</span>
              <p className="mt-2 text-2xl font-black tracking-tight text-blue-900 dark:text-blue-200">
                <SensitiveValueMask 
                  isAuthorized={canViewFinancials(profile)} 
                  value={formatCurrency(summary.averageOrderValue)} 
                />
              </p>
              <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70 mt-0.5">
                Per customer basket
              </p>
            </div>

            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 shadow-xs dark:border-indigo-900/30 dark:bg-indigo-950/20">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400">Total Units Sold</span>
              <p className="mt-2 text-2xl font-black tracking-tight text-indigo-900 dark:text-indigo-200">
                {summary.totalItemsSold}
              </p>
              <p className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70 mt-0.5">
                Formulations dispensed
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 shadow-xs dark:border-emerald-900/30 dark:bg-emerald-950/20">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Payment Breakdown</span>
              <div className="mt-1.5 space-y-0.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                <div className="flex justify-between text-[11px]">
                  <span>UPI:</span>
                  <SensitiveValueMask 
                    isAuthorized={canViewFinancials(profile)} 
                    value={formatCurrency(summary.paymentBreakdown.upi)} 
                  />
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Cash:</span>
                  <SensitiveValueMask 
                    isAuthorized={canViewFinancials(profile)} 
                    value={formatCurrency(summary.paymentBreakdown.cash)} 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Top-Selling Products Banner */}
          {summary.topSellingMedicines.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-800/30">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-1.5">
                <TrendingUp size={14} className="text-blue-600" />
                Fast-Moving Medicines (Top Revenue Drivers)
              </h4>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
                {summary.topSellingMedicines.map((med, idx) => (
                  <div key={med.name} className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-800/50">
                    <span className="text-[9px] font-black uppercase text-blue-600 dark:text-blue-400">#{idx + 1} Top Seller</span>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate mt-0.5" title={med.name}>
                      {med.name}
                    </p>
                    <p className="text-[10px] text-slate-500 font-semibold mt-1">
                      {med.quantity} sold • <SensitiveValueMask isAuthorized={canViewFinancials(profile)} value={formatCurrency(med.revenue)} />
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Itemized Table Preview */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3.5 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Itemized Sales Ledger ({filteredSales.length} Invoices Found)
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Live Audited Data
              </span>
            </div>

            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-2.5">Date & Time</th>
                    <th className="px-5 py-2.5">Invoice ID</th>
                    <th className="px-5 py-2.5">Customer</th>
                    <th className="px-5 py-2.5">Prescribed Items</th>
                    <th className="px-5 py-2.5">Mode</th>
                    <th className="px-5 py-2.5 text-right">Gross Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <RefreshCw className="animate-spin text-blue-600 mx-auto mb-2" size={20} />
                        <span>Loading sales records...</span>
                      </td>
                    </tr>
                  ) : filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No transactions found for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((sale) => {
                      const dt = new Date(sale.timestamp);
                      const itemsStr = Array.isArray(sale.items)
                        ? sale.items.map(it => `${it.name || it.medicineName || 'Med'} (x${it.quantity})`).join(', ')
                        : 'Items';

                      return (
                        <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-5 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300 font-medium">
                            {isNaN(dt.getTime()) ? sale.timestamp : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap font-mono font-bold text-slate-900 dark:text-slate-100">
                            {(sale as any).invoiceNumber || sale.id.slice(0, 8).toUpperCase()}
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">
                            {sale.customerName || 'Walk-in'}
                          </td>
                          <td className="px-5 py-3 text-slate-600 dark:text-slate-400 max-w-xs truncate" title={itemsStr}>
                            {itemsStr}
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            <span className={cn(
                              "rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-wider",
                              sale.paymentMethod === 'upi' ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300" :
                              sale.paymentMethod === 'card' ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300" :
                              "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            )}>
                              {sale.paymentMethod || 'cash'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right whitespace-nowrap font-bold text-slate-900 dark:text-slate-100">
                            <SensitiveValueMask 
                              isAuthorized={canViewFinancials(profile)} 
                              value={formatCurrency(sale.totalAmount)} 
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between border-t border-slate-200 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="text-xs text-slate-500">
            <span>Period: <strong>{dateRangeLabel}</strong> • Filtered Records: <strong>{filteredSales.length}</strong></span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isExporting || filteredSales.length === 0}
              id="sales-report-footer-pdf-btn"
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Download size={15} />
              <span>{isExporting ? 'Generating PDF...' : 'Download Formatted PDF Report'}</span>
            </button>
          </div>
        </div>

        {/* Success Toast */}
        <AnimatePresence>
          {successToast && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-6 right-6 z-50 rounded-xl bg-emerald-600 text-white px-4 py-3 shadow-2xl flex items-center gap-2 text-xs font-bold"
            >
              <CheckCircle2 size={16} />
              <span>{successToast}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default SalesReportModal;
