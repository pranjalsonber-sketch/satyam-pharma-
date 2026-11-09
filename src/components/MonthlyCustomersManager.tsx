import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Search, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ShoppingCart, 
  Share2, 
  Printer, 
  Pill, 
  User, 
  Phone, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  Sparkles, 
  ArrowUpDown, 
  Activity, 
  Check, 
  ArrowRight,
  RefreshCw,
  FileDown,
  X,
  ExternalLink
} from 'lucide-react';
import { Patient, MonthlyMedicineItem, MonthlyDispensationRecord, Medicine, SaleItem } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { cn, formatCurrency } from '../lib/utils';
import { 
  getMonthlyRefillStatus, 
  calculateMonthlyPackageTotal, 
  generateMonthlyCustomerWhatsAppText, 
  generateMonthlyRefillSlipPDF 
} from '../lib/monthlyCustomerUtils';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { triggerSafeLinkRedirect } from './AppAccessLinkPortal';

interface MonthlyCustomersManagerProps {
  patients: Patient[];
  inventoryMedicines: Medicine[];
  onSelectPatient: (patient: Patient) => void;
  onUpdatePatient: (updated: Patient) => void;
  onOpenAddPatient: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const MonthlyCustomersManager: React.FC<MonthlyCustomersManagerProps> = ({
  patients,
  inventoryMedicines,
  onSelectPatient,
  onUpdatePatient,
  onOpenAddPatient,
  onNavigateTab
}) => {
  const { tText } = useLanguage();

  // Selected Month State (defaults to current month)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'due' | 'dispensed' | 'overdue' | 'upcoming'>('all');
  const [sortBy, setSortBy] = useState<'day' | 'name' | 'value'>('day');
  const [dispenseModalPatient, setDispenseModalPatient] = useState<Patient | null>(null);
  const [dispenseNotes, setDispenseNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Month details
  const selectedYear = selectedDate.getFullYear();
  const selectedMonth = selectedDate.getMonth();
  const monthLabel = selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

  const isCurrentMonth = 
    selectedYear === new Date().getFullYear() && 
    selectedMonth === new Date().getMonth();

  // Navigation handlers
  const handlePrevMonth = () => {
    setSelectedDate(new Date(selectedYear, selectedMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedDate(new Date(selectedYear, selectedMonth + 1, 1));
  };

  const handleCurrentMonth = () => {
    setSelectedDate(new Date());
  };

  // Extract all enrolled monthly customers
  const monthlyCustomers = useMemo(() => {
    return patients.filter(p => p.isMonthlyCustomer || (p.monthlyMedicines && p.monthlyMedicines.length > 0));
  }, [patients]);

  // Aggregate Metrics for selected month
  const metrics = useMemo(() => {
    let totalValuation = 0;
    let dispensedCount = 0;
    let dueCount = 0;
    let overdueCount = 0;
    let upcomingCount = 0;

    monthlyCustomers.forEach(p => {
      const packageVal = calculateMonthlyPackageTotal(p.monthlyMedicines);
      totalValuation += packageVal;

      const status = getMonthlyRefillStatus(p, selectedDate);
      if (status.status === 'dispensed') dispensedCount++;
      else if (status.status === 'overdue') overdueCount++;
      else if (status.status === 'due') dueCount++;
      else if (status.status === 'upcoming') upcomingCount++;
    });

    return {
      totalCustomers: monthlyCustomers.length,
      totalValuation,
      dispensedCount,
      dueCount,
      overdueCount,
      upcomingCount,
      pendingCount: dueCount + overdueCount + upcomingCount
    };
  }, [monthlyCustomers, selectedDate]);

  // Filter and Sort Customers
  const filteredAndSortedCustomers = useMemo(() => {
    return monthlyCustomers.filter(p => {
      const status = getMonthlyRefillStatus(p, selectedDate);
      
      // Status filter
      if (statusFilter === 'dispensed' && status.status !== 'dispensed') return false;
      if (statusFilter === 'overdue' && status.status !== 'overdue') return false;
      if (statusFilter === 'due' && status.status !== 'due') return false;
      if (statusFilter === 'upcoming' && status.status !== 'upcoming') return false;

      // Search filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesPhone = p.mobile.includes(query);
        const matchesCondition = p.chronicConditions?.some(c => c.toLowerCase().includes(query));
        const matchesMed = p.monthlyMedicines?.some(m => m.name.toLowerCase().includes(query));
        return matchesName || matchesPhone || matchesCondition || matchesMed;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'day') {
        const dayA = a.preferredDayOfMonth || 5;
        const dayB = b.preferredDayOfMonth || 5;
        return dayA - dayB;
      } else if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'value') {
        const valA = calculateMonthlyPackageTotal(a.monthlyMedicines);
        const valB = calculateMonthlyPackageTotal(b.monthlyMedicines);
        return valB - valA; // Descending
      }
      return 0;
    });
  }, [monthlyCustomers, selectedDate, statusFilter, searchTerm, sortBy]);

  // Direct Firestore update helper
  const handleMarkDispensed = async (patient: Patient, notes?: string) => {
    setIsProcessing(true);
    try {
      const activeMedicines = (patient.monthlyMedicines || []).filter(m => m.isActive !== false);
      const monthlyTotalVal = calculateMonthlyPackageTotal(patient.monthlyMedicines);

      const dispRecord: MonthlyDispensationRecord = {
        id: crypto.randomUUID(),
        monthKey,
        monthLabel,
        dispensedDate: new Date().toISOString(),
        dispensedBy: 'Staff Pharmacist',
        items: activeMedicines,
        totalAmount: monthlyTotalVal,
        status: 'dispensed',
        notes: notes || 'Monthly medication package dispensed and delivered.'
      };

      const currentHistory = patient.monthlyDispensations || [];
      const filteredHistory = currentHistory.filter(d => d.monthKey !== monthKey);
      const updatedHistory = [dispRecord, ...filteredHistory];

      const patientRef = doc(db, 'patients', patient.id);
      await updateDoc(patientRef, {
        monthlyDispensations: updatedHistory
      });

      const updated = { ...patient, monthlyDispensations: updatedHistory };
      onUpdatePatient(updated);
      setDispenseModalPatient(null);
      setDispenseNotes('');
    } catch (err) {
      console.error('Error marking monthly customer as dispensed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUndoDispensed = async (patient: Patient) => {
    setIsProcessing(true);
    try {
      const currentHistory = patient.monthlyDispensations || [];
      const updatedHistory = currentHistory.filter(d => d.monthKey !== monthKey);

      const patientRef = doc(db, 'patients', patient.id);
      await updateDoc(patientRef, {
        monthlyDispensations: updatedHistory
      });

      const updated = { ...patient, monthlyDispensations: updatedHistory };
      onUpdatePatient(updated);
    } catch (err) {
      console.error('Error undoing monthly customer dispensation:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Send to POS Cart
  const handleSendToPOS = (patient: Patient) => {
    const activeMedicines = (patient.monthlyMedicines || []).filter(m => m.isActive !== false);
    if (activeMedicines.length === 0) return;

    const totalVal = calculateMonthlyPackageTotal(patient.monthlyMedicines);
    const saleItems: SaleItem[] = activeMedicines.map(m => ({
      medicineId: m.medicineId || m.id,
      name: m.name,
      quantity: m.monthlyQuantity,
      price: m.estimatedRate || 0,
      unit: m.unit
    }));

    window.dispatchEvent(new CustomEvent('load-pos-cart', {
      detail: {
        items: saleItems,
        customer: {
          name: patient.name,
          mobile: patient.mobile
        },
        note: `Loaded monthly refill package for ${patient.name} (${saleItems.length} medicines, ₹${totalVal.toFixed(2)})`
      }
    }));

    window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'pos' } }));
    if (onNavigateTab) onNavigateTab('pos');
  };

  // Send WhatsApp Reminder
  const handleSendWhatsApp = (patient: Patient) => {
    const text = generateMonthlyCustomerWhatsAppText(patient, monthLabel);
    const cleanMobile = patient.mobile.replace(/\D/g, '');
    const mobileWithCountry = cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile;
    const url = `https://wa.me/${mobileWithCountry}?text=${encodeURIComponent(text)}`;
    triggerSafeLinkRedirect(url, `WhatsApp Monthly Refill (${patient.name})`);
  };

  // Generate Master Monthly Packaging Checklist PDF
  const handleExportMonthlyChecklist = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text('SATYAM PHARMA & MEDICAL STORE', 105, 18, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`MONTHLY REFILL & DISPATCH MASTER SCHEDULE - ${monthLabel.toUpperCase()}`, 105, 25, { align: 'center' });
    doc.text(`Generated on ${new Date().toLocaleString()} • Total Monthly Customers: ${monthlyCustomers.length}`, 105, 30, { align: 'center' });

    doc.setDrawColor(203, 213, 225);
    doc.line(14, 34, 196, 34);

    const rows: any[] = [];
    monthlyCustomers.forEach((p, idx) => {
      const activeMeds = (p.monthlyMedicines || []).filter(m => m.isActive !== false);
      const medsStr = activeMeds.map(m => `• ${m.name} (${m.dosage || '1-0-1'}) - Qty: ${m.monthlyQuantity} ${m.unit || ''}`).join('\n');
      const val = calculateMonthlyPackageTotal(activeMeds);
      const status = getMonthlyRefillStatus(p, selectedDate);

      rows.push([
        idx + 1,
        `${p.name}\n${p.mobile || ''}\n(Day ${p.preferredDayOfMonth || 5})`,
        medsStr || 'No medicines listed',
        val > 0 ? `Rs. ${val.toFixed(2)}` : '-',
        status.status.toUpperCase(),
        status.status === 'dispensed' ? 'Delivered' : '[ ] Pending'
      ]);
    });

    autoTable(doc, {
      startY: 38,
      head: [['#', 'Customer Info & Day', 'Prescribed Monthly Medicines', 'Est. Total', 'Status', 'Checklist']],
      body: rows.length > 0 ? rows : [['-', 'No monthly customers enrolled', '-', '-', '-', '-']],
      theme: 'grid',
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: [30, 41, 59]
      },
      columnStyles: {
        1: { cellWidth: 42 },
        2: { cellWidth: 70 },
        3: { cellWidth: 24 }
      }
    });

    doc.save(`Monthly_Customers_Schedule_${monthLabel.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden space-y-4">
      {/* Header Month Selector & Quick Actions */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Month Navigation */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="px-3 py-1 flex items-center gap-2">
                <Calendar size={16} className="text-blue-600" />
                <span className="text-sm font-black text-slate-900 dark:text-white min-w-32 text-center">
                  {monthLabel}
                </span>
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                title="Next Month"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {!isCurrentMonth && (
              <button
                type="button"
                onClick={handleCurrentMonth}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
              >
                Current Month
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (onNavigateTab) {
                  onNavigateTab('monthly_updates');
                } else {
                  window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'monthly_updates' } }));
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
              title="View collective 30-day predicted wholesale order list"
            >
              <ShoppingCart size={14} />
              <span>30-Day Predicted Orders</span>
            </button>

            <button
              type="button"
              onClick={handleExportMonthlyChecklist}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-all shadow-xs cursor-pointer"
              title="Download print-ready dispatch checklist for this month"
            >
              <FileDown size={14} />
              <span>Export Schedule (PDF)</span>
            </button>

            <button
              type="button"
              onClick={onOpenAddPatient}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>+ Enroll Patient</span>
            </button>
          </div>
        </div>

        {/* High-Level Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-extrabold uppercase text-slate-400">Total Monthly Patients</span>
            <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
              {metrics.totalCustomers}
            </p>
          </div>

          <div className="bg-blue-50/60 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-100 dark:border-blue-900/40">
            <span className="text-[10px] font-extrabold uppercase text-blue-600 dark:text-blue-400">Monthly Package Volume</span>
            <p className="text-lg font-black text-blue-700 dark:text-blue-300 mt-0.5">
              ₹{metrics.totalValuation.toFixed(2)}
            </p>
          </div>

          <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
            <span className="text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400">Dispensed / Given</span>
            <p className="text-lg font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
              {metrics.dispensedCount} <span className="text-xs font-semibold text-slate-500">/ {metrics.totalCustomers}</span>
            </p>
          </div>

          <div className="bg-amber-50/60 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-100 dark:border-amber-900/40">
            <span className="text-[10px] font-extrabold uppercase text-amber-600 dark:text-amber-400">Due to Give</span>
            <p className="text-lg font-black text-amber-700 dark:text-amber-300 mt-0.5">
              {metrics.dueCount + metrics.upcomingCount}
            </p>
          </div>

          <div className="bg-rose-50/60 dark:bg-rose-950/30 p-3 rounded-xl border border-rose-100 dark:border-rose-900/40 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-extrabold uppercase text-rose-600 dark:text-rose-400">Overdue Refills</span>
            <p className="text-lg font-black text-rose-700 dark:text-rose-300 mt-0.5">
              {metrics.overdueCount}
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search patient, mobile, medicine, disease..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-2 text-xs outline-none focus:border-blue-500"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              statusFilter === 'all'
                ? "bg-slate-900 text-white dark:bg-blue-600 shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            )}
          >
            All ({monthlyCustomers.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('due')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              statusFilter === 'due'
                ? "bg-amber-500 text-white shadow-xs"
                : "bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300"
            )}
          >
            Due ({metrics.dueCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('overdue')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              statusFilter === 'overdue'
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-rose-50 text-rose-800 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300"
            )}
          >
            Overdue ({metrics.overdueCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('dispensed')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              statusFilter === 'dispensed'
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300"
            )}
          >
            Dispensed ({metrics.dispensedCount})
          </button>
        </div>

        {/* Sort Toggle */}
        <div className="flex items-center gap-1 text-xs">
          <span className="text-slate-400 font-bold uppercase text-[10px]">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
          >
            <option value="day">Refill Day (1st - 28th)</option>
            <option value="name">Patient Name (A-Z)</option>
            <option value="value">Package Value (High-Low)</option>
          </select>
        </div>
      </div>

      {/* Main Customers List / Cards */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {filteredAndSortedCustomers.length > 0 ? (
          filteredAndSortedCustomers.map((patient) => {
            const refillStatus = getMonthlyRefillStatus(patient, selectedDate);
            const activeMeds = (patient.monthlyMedicines || []).filter(m => m.isActive !== false);
            const packageTotal = calculateMonthlyPackageTotal(patient.monthlyMedicines);

            return (
              <div 
                key={patient.id}
                className="even:bg-slate-50/50 dark:even:bg-slate-900/80 odd:bg-white dark:odd:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md hover:bg-blue-50/20 dark:hover:bg-slate-850 transition-all space-y-3"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  {/* Patient Info */}
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-lg shrink-0 shadow-xs">
                      {patient.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => onSelectPatient(patient)}
                          className="text-base font-bold text-slate-900 dark:text-white hover:text-blue-600 transition-colors text-left flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>{patient.name}</span>
                          <ExternalLink size={13} className="text-slate-400" />
                        </button>

                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                          Day {patient.preferredDayOfMonth || 5} of Month
                        </span>

                        {patient.allergies && patient.allergies.length > 0 && (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                            Allergy: {patient.allergies.join(', ')}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 font-medium">
                          <Phone size={12} /> {patient.mobile}
                        </span>
                        {patient.age && (
                          <span>• {patient.age} Yrs / {patient.gender || 'Patient'}</span>
                        )}
                        {patient.chronicConditions && patient.chronicConditions.length > 0 && (
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            • {patient.chronicConditions.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge & Package Total */}
                  <div className="flex items-center md:items-end flex-col gap-1 shrink-0">
                    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border", refillStatus.badgeClass)}>
                      {refillStatus.status === 'dispensed' && <Check size={13} />}
                      {refillStatus.status === 'overdue' && <AlertTriangle size={13} />}
                      {refillStatus.status === 'due' && <Clock size={13} />}
                      <span>{refillStatus.label}</span>
                    </span>

                    <div className="text-right mt-1">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Monthly Package</span>
                      <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                        ₹{packageTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Medicines List Grid / Pill tags */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Pill size={12} className="text-blue-600" />
                      <span>Prescribed Medicines ({activeMeds.length} to give in {monthLabel})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectPatient(patient)}
                      className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      Edit Medicine List →
                    </button>
                  </div>

                  {activeMeds.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {activeMeds.map((med, mIdx) => {
                        const invMatch = inventoryMedicines.find(m => m.id === med.medicineId || m.name.toLowerCase() === med.name.toLowerCase());
                        const isLowStock = invMatch && invMatch.stockQuantity < med.monthlyQuantity;

                        return (
                          <div 
                            key={med.id || mIdx}
                            className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-xs"
                          >
                            <div className="min-w-0 pr-2">
                              <p className="font-bold text-slate-900 dark:text-white truncate">
                                {med.name}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">
                                {med.dosage || '1-0-1'}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/80 px-1.5 py-0.5 rounded text-[10px]">
                                {med.monthlyQuantity} {med.unit || 'Units'}
                              </span>
                              {invMatch && (
                                <span className={cn(
                                  "block text-[8px] font-bold mt-0.5",
                                  isLowStock ? "text-rose-500" : "text-slate-400"
                                )}>
                                  Store: {invMatch.stockQuantity}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No recurring medicines listed yet. Click "Edit Medicine List" to add.</p>
                  )}
                </div>

                {/* Bottom Workflow Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    {/* Mark Dispensed Button */}
                    {refillStatus.status !== 'dispensed' ? (
                      <button
                        type="button"
                        onClick={() => setDispenseModalPatient(patient)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                      >
                        <CheckCircle2 size={14} />
                        <span>Mark Given / Dispensed ({monthLabel})</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Check size={14} />
                          <span>Given for {monthLabel}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUndoDispensed(patient)}
                          className="text-[10px] font-bold text-slate-400 hover:text-slate-600 underline cursor-pointer"
                        >
                          Undo
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Send to POS Button */}
                    <button
                      type="button"
                      onClick={() => handleSendToPOS(patient)}
                      disabled={activeMeds.length === 0}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-bold shadow-xs active:scale-95 disabled:opacity-40 cursor-pointer"
                      title="Load this customer's monthly medicines into POS cart for instant billing"
                    >
                      <ShoppingCart size={13} />
                      <span>Send to POS</span>
                    </button>

                    {/* WhatsApp Button */}
                    <button
                      type="button"
                      onClick={() => handleSendWhatsApp(patient)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs active:scale-95 cursor-pointer"
                      title="Send WhatsApp refill schedule and prompt"
                    >
                      <Share2 size={13} />
                      <span>WhatsApp Slip</span>
                    </button>

                    {/* Print PDF Button */}
                    <button
                      type="button"
                      onClick={() => generateMonthlyRefillSlipPDF(patient, monthLabel)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                      title="Print Slip PDF"
                    >
                      <Printer size={13} />
                      <span>PDF</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400">
            <Calendar size={48} className="mx-auto mb-3 opacity-20" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">No Monthly Customers Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchTerm 
                ? 'No matching monthly patients found with the current search query.'
                : 'Enroll chronic patients (diabetes, BP, thyroid, etc.) as monthly customers to track recurring refills and monthly medicine schedules.'}
            </p>
            <button
              type="button"
              onClick={onOpenAddPatient}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md hover:bg-blue-700 cursor-pointer"
            >
              <Plus size={14} />
              <span>Enroll New Monthly Patient</span>
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Dispensing */}
      {dispenseModalPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 size={20} />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Confirm Monthly Dispensation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDispenseModalPatient(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs space-y-1">
              <p className="font-bold text-slate-900 dark:text-white">
                Patient: {dispenseModalPatient.name} ({dispenseModalPatient.mobile})
              </p>
              <p className="text-slate-500">
                Month: <strong>{monthLabel}</strong> • Day: {dispenseModalPatient.preferredDayOfMonth || 5}th
              </p>
              <p className="text-emerald-600 font-bold">
                Package Value: ₹{calculateMonthlyPackageTotal(dispenseModalPatient.monthlyMedicines).toFixed(2)} ({(dispenseModalPatient.monthlyMedicines || []).length} medicines)
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">
                Dispensation Notes / Delivery Details (Optional)
              </label>
              <input
                type="text"
                value={dispenseNotes}
                onChange={(e) => setDispenseNotes(e.target.value)}
                placeholder="e.g. Delivered to home / Collected by family"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDispenseModalPatient(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleMarkDispensed(dispenseModalPatient, dispenseNotes)}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? 'Recording...' : 'Confirm Given'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyCustomersManager;
