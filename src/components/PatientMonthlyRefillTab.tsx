import React, { useState } from 'react';
import { 
  Calendar, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  ShoppingCart, 
  Share2, 
  Printer, 
  Clock, 
  Sparkles, 
  Pill, 
  Activity, 
  Tag, 
  Save, 
  X, 
  ArrowRight,
  Check,
  AlertTriangle,
  RotateCcw,
  Search,
  IndianRupee
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
import { triggerSafeLinkRedirect } from './AppAccessLinkPortal';

interface PatientMonthlyRefillTabProps {
  patient: Patient;
  inventoryMedicines: Medicine[];
  onUpdatePatient: (updated: Patient) => void;
  onNavigateTab?: (tab: string) => void;
}

const COMMON_CHRONIC_CONDITIONS = [
  'Type 2 Diabetes',
  'Hypertension (BP)',
  'Thyroid (Hypo/Hyper)',
  'Cardiovascular / Heart',
  'Asthma / Respiratory',
  'Cholesterol / Lipids',
  'Arthritis / Joint Pain',
  'Neuropathy',
  'Gastro / GERD',
  'Kidney Care'
];

const DOSAGE_PRESETS = [
  '1-0-1 (Morning & Night After Food)',
  '1-0-0 (Morning Empty Stomach)',
  '1-0-0 (Morning After Food)',
  '0-0-1 (Night Before Sleep)',
  '1-1-1 (Morning, Afternoon & Night)',
  '0-1-0 (Afternoon After Food)',
  '1 Tab Once Daily',
  '1 Tab Twice Daily',
  'SOS (As Needed)'
];

const UNIT_OPTIONS = [
  'Tablets',
  'Capsules',
  'Strips (10s)',
  'Strips (15s)',
  'Bottles',
  'Vials',
  'Inhalers',
  'Packets',
  'Units'
];

export const PatientMonthlyRefillTab: React.FC<PatientMonthlyRefillTabProps> = ({
  patient,
  inventoryMedicines,
  onUpdatePatient,
  onNavigateTab
}) => {
  const { tText } = useLanguage();
  const [isSaving, setIsSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [customConditionInput, setCustomConditionInput] = useState('');
  const [showCustomCondition, setShowCustomCondition] = useState(false);

  // New Medicine Form State
  const [medSearchTerm, setMedSearchTerm] = useState('');
  const [selectedInventoryMed, setSelectedInventoryMed] = useState<Medicine | null>(null);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('1-0-1 (Morning & Night After Food)');
  const [newMedQty, setNewMedQty] = useState<number>(30);
  const [newMedUnit, setNewMedUnit] = useState('Tablets');
  const [newMedRate, setNewMedRate] = useState<string>('');
  const [newMedInstructions, setNewMedInstructions] = useState('');

  // Status for current month
  const now = new Date();
  const currentMonthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const refillStatus = getMonthlyRefillStatus(patient, now);

  const activeMedicines = (patient.monthlyMedicines || []).filter(m => m.isActive !== false);
  const monthlyTotalVal = calculateMonthlyPackageTotal(patient.monthlyMedicines);

  // Direct Firestore update helper
  const savePatientUpdates = async (updates: Partial<Patient>) => {
    setIsSaving(true);
    try {
      const patientRef = doc(db, 'patients', patient.id);
      await updateDoc(patientRef, updates);
      const updated = { ...patient, ...updates };
      onUpdatePatient(updated);
    } catch (err) {
      console.error('Error updating patient monthly refill data:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Monthly Customer status
  const handleToggleMonthlyCustomer = () => {
    const isMonthly = !patient.isMonthlyCustomer;
    savePatientUpdates({
      isMonthlyCustomer: isMonthly,
      preferredDayOfMonth: patient.preferredDayOfMonth || 5
    });
  };

  // Update Preferred Day of Month
  const handleDayChange = (day: number) => {
    const validDay = Math.min(Math.max(1, day), 28);
    savePatientUpdates({ preferredDayOfMonth: validDay });
  };

  // Add / Remove Chronic Condition
  const handleToggleCondition = (condition: string) => {
    const current = patient.chronicConditions || [];
    const updated = current.includes(condition)
      ? current.filter(c => c !== condition)
      : [...current, condition];
    savePatientUpdates({ chronicConditions: updated });
  };

  const handleAddCustomCondition = () => {
    if (!customConditionInput.trim()) return;
    const clean = customConditionInput.trim();
    const current = patient.chronicConditions || [];
    if (!current.includes(clean)) {
      savePatientUpdates({ chronicConditions: [...current, clean] });
    }
    setCustomConditionInput('');
    setShowCustomCondition(false);
  };

  // Add Medicine to Monthly List
  const handleAddMedicine = () => {
    const name = selectedInventoryMed ? selectedInventoryMed.name : newMedName.trim();
    if (!name) return;

    const rateNum = newMedRate ? parseFloat(newMedRate) : (selectedInventoryMed?.rate || 0);

    const newItem: MonthlyMedicineItem = {
      id: crypto.randomUUID(),
      medicineId: selectedInventoryMed?.id,
      name,
      dosage: newMedDosage,
      monthlyQuantity: Math.max(1, newMedQty),
      unit: newMedUnit,
      estimatedRate: rateNum > 0 ? rateNum : undefined,
      instructions: newMedInstructions.trim() || undefined,
      isActive: true
    };

    const updatedList = [...(patient.monthlyMedicines || []), newItem];
    savePatientUpdates({
      monthlyMedicines: updatedList,
      isMonthlyCustomer: true // Automatically enable monthly customer when adding items
    });

    // Reset Form
    setSelectedInventoryMed(null);
    setNewMedName('');
    setMedSearchTerm('');
    setNewMedQty(30);
    setNewMedRate('');
    setNewMedInstructions('');
    setShowAddForm(false);
  };

  // Remove Medicine from list
  const handleRemoveMedicine = (id: string) => {
    const updatedList = (patient.monthlyMedicines || []).filter(m => m.id !== id);
    savePatientUpdates({ monthlyMedicines: updatedList });
  };

  // Toggle active status of a medicine
  const handleToggleMedicineActive = (id: string) => {
    const updatedList = (patient.monthlyMedicines || []).map(m => 
      m.id === id ? { ...m, isActive: m.isActive === false ? true : false } : m
    );
    savePatientUpdates({ monthlyMedicines: updatedList });
  };

  // Quick edit quantity
  const handleUpdateMedicineQty = (id: string, newQty: number) => {
    if (newQty < 1) return;
    const updatedList = (patient.monthlyMedicines || []).map(m => 
      m.id === id ? { ...m, monthlyQuantity: newQty } : m
    );
    savePatientUpdates({ monthlyMedicines: updatedList });
  };

  // Record dispensation for current month
  const handleMarkAsDispensed = (notes?: string) => {
    const dispRecord: MonthlyDispensationRecord = {
      id: crypto.randomUUID(),
      monthKey: currentMonthKey,
      monthLabel: currentMonthLabel,
      dispensedDate: new Date().toISOString(),
      dispensedBy: 'Staff Pharmacist',
      items: activeMedicines,
      totalAmount: monthlyTotalVal,
      status: 'dispensed',
      notes: notes || 'Monthly package delivered to patient'
    };

    const currentHistory = patient.monthlyDispensations || [];
    // Replace if exists for current month or append
    const filteredHistory = currentHistory.filter(d => d.monthKey !== currentMonthKey);
    savePatientUpdates({
      monthlyDispensations: [dispRecord, ...filteredHistory]
    });
  };

  // Undo dispensation
  const handleUndoDispensation = (monthKey: string) => {
    const currentHistory = patient.monthlyDispensations || [];
    const updatedHistory = currentHistory.filter(d => d.monthKey !== monthKey);
    savePatientUpdates({ monthlyDispensations: updatedHistory });
  };

  // Send medicines to POS cart
  const handleSendToPOS = () => {
    if (activeMedicines.length === 0) return;

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
        note: `Loaded monthly refill package for ${patient.name} (${saleItems.length} medicines, ₹${monthlyTotalVal.toFixed(2)})`
      }
    }));

    window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'pos' } }));
    if (onNavigateTab) onNavigateTab('pos');
  };

  // Send WhatsApp Reminder
  const handleSendWhatsApp = () => {
    const text = generateMonthlyCustomerWhatsAppText(patient, currentMonthLabel);
    const cleanMobile = patient.mobile.replace(/\D/g, '');
    const mobileWithCountry = cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile;
    const url = `https://wa.me/${mobileWithCountry}?text=${encodeURIComponent(text)}`;
    triggerSafeLinkRedirect(url, `WhatsApp Refill Reminder (${patient.name})`);
  };

  // Filtered inventory medicines for autocomplete
  const filteredInventory = medSearchTerm.trim()
    ? inventoryMedicines.filter(m => 
        m.name.toLowerCase().includes(medSearchTerm.toLowerCase()) ||
        m.genericName?.toLowerCase().includes(medSearchTerm.toLowerCase()) ||
        m.salt?.toLowerCase().includes(medSearchTerm.toLowerCase())
      ).slice(0, 6)
    : [];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Top Banner: Status & Monthly Customer Activation Switch */}
      <div className={cn(
        "rounded-2xl p-5 border transition-all shadow-xs",
        patient.isMonthlyCustomer
          ? "bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-blue-50/90 border-blue-200 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-blue-950/40 dark:border-blue-800/80"
          : "bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700"
      )}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={cn(
              "p-3 rounded-2xl shrink-0 shadow-xs",
              patient.isMonthlyCustomer ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500 dark:bg-slate-700"
            )}>
              <Calendar size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {tText('Monthly Customer Medication Schedule', 'मासिक ग्राहक दवा शिड्यूल')}
                </h3>
                {patient.isMonthlyCustomer ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-600 text-white shadow-2xs">
                    <Sparkles size={11} className="text-amber-300" />
                    <span>ACTIVE MONTHLY CUSTOMER</span>
                  </span>
                ) : (
                  <span className="text-xs text-slate-500 font-medium italic">
                    (Regular Walk-in)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
                {tText(
                  'Maintain recurring chronic prescription lists, set preferred refill dispense dates, track monthly fulfillment status, and dispatch packages directly to POS billing or WhatsApp.',
                  'मरीज की मासिक नियमित दवाओं की सूची बनाएं, हर महीने किस तारीख को दवा देनी है तय करें, और सीधे POS बिलिंग या व्हाट्सएप पर भेजें।'
                )}
              </p>
            </div>
          </div>

          {/* Toggle Switch */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleToggleMonthlyCustomer}
              className={cn(
                "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                patient.isMonthlyCustomer ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                  patient.isMonthlyCustomer ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {patient.isMonthlyCustomer ? 'Enrolled' : 'Not Enrolled'}
            </span>
          </div>
        </div>

        {/* Status Metrics Bar if Enrolled */}
        {patient.isMonthlyCustomer && (
          <div className="mt-4 pt-4 border-t border-blue-100 dark:border-blue-900/60 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Preferred Refill Day */}
            <div className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl border border-blue-100 dark:border-blue-900/40 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Refill Day of Month</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    Every {patient.preferredDayOfMonth || 5}th of month
                  </span>
                </div>
              </div>
              <select
                value={patient.preferredDayOfMonth || 5}
                onChange={(e) => handleDayChange(parseInt(e.target.value))}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-blue-600 p-1.5 outline-none cursor-pointer"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}th</option>
                ))}
              </select>
            </div>

            {/* Current Month Status */}
            <div className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl border border-blue-100 dark:border-blue-900/40">
              <span className="text-[10px] font-extrabold uppercase text-slate-400">{currentMonthLabel} Status</span>
              <div className="mt-1">
                <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border", refillStatus.badgeClass)}>
                  {refillStatus.status === 'dispensed' && <Check size={12} />}
                  {refillStatus.status === 'overdue' && <AlertTriangle size={12} />}
                  {refillStatus.status === 'due' && <Clock size={12} />}
                  <span>{refillStatus.label}</span>
                </span>
              </div>
            </div>

            {/* Estimated Package Valuation */}
            <div className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl border border-blue-100 dark:border-blue-900/40 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Monthly Package Total</span>
                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                  ₹{monthlyTotalVal.toFixed(2)}
                </p>
              </div>
              <span className="text-[10px] text-slate-500 font-semibold">
                {activeMedicines.length} medicine(s)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Chronic Health Condition Tags */}
      {patient.isMonthlyCustomer && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Activity size={14} className="text-blue-600" />
              <span>Chronic Health Conditions / Indications (दीर्घकालिक रोग)</span>
            </label>
            {!showCustomCondition && (
              <button
                type="button"
                onClick={() => setShowCustomCondition(true)}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer flex items-center gap-1"
              >
                <Plus size={12} />
                <span>+ Custom Tag</span>
              </button>
            )}
          </div>

          {/* Condition Chips */}
          <div className="flex flex-wrap gap-2">
            {COMMON_CHRONIC_CONDITIONS.map((cond) => {
              const isSelected = (patient.chronicConditions || []).includes(cond);
              return (
                <button
                  key={cond}
                  type="button"
                  onClick={() => handleToggleCondition(cond)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer",
                    isSelected
                      ? "bg-blue-600 text-white border-blue-600 font-bold shadow-2xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                  )}
                >
                  {isSelected && <Check size={11} className="inline mr-1 stroke-[3]" />}
                  <span>{cond}</span>
                </button>
              );
            })}

            {/* Any Custom Conditions added */}
            {(patient.chronicConditions || [])
              .filter(c => !COMMON_CHRONIC_CONDITIONS.includes(c))
              .map((cond) => (
                <span
                  key={cond}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-indigo-600 text-white shadow-2xs"
                >
                  <span>{cond}</span>
                  <button
                    type="button"
                    onClick={() => handleToggleCondition(cond)}
                    className="hover:text-indigo-200 ml-1 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
          </div>

          {showCustomCondition && (
            <div className="flex items-center gap-2 pt-1 max-w-sm">
              <input
                type="text"
                value={customConditionInput}
                onChange={(e) => setCustomConditionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomCondition();
                  }
                }}
                placeholder="e.g. Chronic Kidney Disease"
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs outline-none focus:border-blue-500"
                autoFocus
              />
              <button
                type="button"
                onClick={handleAddCustomCondition}
                disabled={!customConditionInput.trim()}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 cursor-pointer disabled:opacity-50"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCustomCondition(false);
                  setCustomConditionInput('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Monthly Medicines List & Builder */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-800/40">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Pill size={16} className="text-blue-600" />
              <span>{tText('Monthly Recurring Medicines List', 'मासिक दवाओं की सूची')}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                {(patient.monthlyMedicines || []).length} items
              </span>
            </h4>
            <p className="text-[11px] text-slate-500">
              Medicines to be dispensed and packaged on every monthly refill cycle.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddForm(prev => !prev)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <Plus size={14} />
            <span>{showAddForm ? 'Close Builder' : '+ Add Monthly Medicine'}</span>
          </button>
        </div>

        {/* Add Medicine Inline Builder Form */}
        {showAddForm && (
          <div className="p-5 border-b border-blue-100 bg-blue-50/40 dark:bg-blue-950/20 dark:border-blue-900/40 space-y-4">
            <h5 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
              <Sparkles size={13} className="text-blue-600" />
              <span>Add Medicine to Monthly Refill Schedule</span>
            </h5>

            {/* Search Inventory Autocomplete */}
            <div className="space-y-1 relative">
              <label className="text-[10px] font-bold uppercase text-slate-500">
                Select from Store Inventory or Type Custom Name
              </label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search medicine by name, salt, or generic name..."
                  value={selectedInventoryMed ? selectedInventoryMed.name : (newMedName || medSearchTerm)}
                  onChange={(e) => {
                    setSelectedInventoryMed(null);
                    setMedSearchTerm(e.target.value);
                    setNewMedName(e.target.value);
                  }}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                />
                {(selectedInventoryMed || newMedName) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedInventoryMed(null);
                      setNewMedName('');
                      setMedSearchTerm('');
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {!selectedInventoryMed && medSearchTerm.trim().length > 1 && filteredInventory.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                  {filteredInventory.map(med => (
                    <button
                      key={med.id}
                      type="button"
                      onClick={() => {
                        setSelectedInventoryMed(med);
                        setNewMedName(med.name);
                        setNewMedRate(String(med.rate || ''));
                        setMedSearchTerm('');
                      }}
                      className="w-full text-left p-2.5 hover:bg-blue-50 dark:hover:bg-slate-800 flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800 last:border-0 cursor-pointer"
                    >
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-100">{med.name}</p>
                        <p className="text-[10px] text-slate-500">{med.salt || med.genericName || 'Standard Formulation'}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-blue-600">₹{med.rate}</span>
                        <span className="block text-[9px] text-slate-400">Stock: {med.stockQuantity}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dosage, Qty, Unit, Rate Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* Dosage */}
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[10px] font-bold uppercase text-slate-500">Dosage / Timings</label>
                <div className="relative">
                  <input
                    type="text"
                    value={newMedDosage}
                    onChange={(e) => setNewMedDosage(e.target.value)}
                    placeholder="e.g. 1-0-1 After Food"
                    list="dosage-presets"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                  />
                  <datalist id="dosage-presets">
                    {DOSAGE_PRESETS.map((p, i) => (
                      <option key={i} value={p} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Monthly Quantity */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Monthly Qty</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    value={newMedQty}
                    onChange={(e) => setNewMedQty(parseInt(e.target.value) || 1)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 text-center"
                  />
                </div>
                {/* Quick Increment Buttons */}
                <div className="flex gap-1 pt-0.5">
                  {[10, 30, 60].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setNewMedQty(q)}
                      className={cn(
                        "flex-1 py-0.5 rounded text-[9px] font-bold border transition-colors cursor-pointer",
                        newMedQty === q 
                          ? "bg-blue-600 text-white border-blue-600" 
                          : "bg-white text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                      )}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Unit Type */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Unit Type</label>
                <select
                  value={newMedUnit}
                  onChange={(e) => setNewMedUnit(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 cursor-pointer"
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Estimated Rate & Instructions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Estimated Unit Rate (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Rate per tablet/unit"
                  value={newMedRate}
                  onChange={(e) => setNewMedRate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[10px] font-bold uppercase text-slate-500">Special Instructions / Advice (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Keep refrigerated, Take with milk"
                  value={newMedInstructions}
                  onChange={(e) => setNewMedInstructions(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddMedicine}
                disabled={!selectedInventoryMed && !newMedName.trim()}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                + Save Medicine to List
              </button>
            </div>
          </div>
        )}

        {/* Medicines Table */}
        <div className="overflow-x-auto">
          {patient.monthlyMedicines && patient.monthlyMedicines.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5 w-10 text-center">#</th>
                  <th className="p-3.5">Medicine Name</th>
                  <th className="p-3.5">Dosage / Timings</th>
                  <th className="p-3.5 text-center">Monthly Qty</th>
                  <th className="p-3.5">Unit Rate</th>
                  <th className="p-3.5">Monthly Total</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {patient.monthlyMedicines.map((item, idx) => {
                  const invMatch = inventoryMedicines.find(m => m.id === item.medicineId || m.name.toLowerCase() === item.name.toLowerCase());
                  const isLowStock = invMatch && invMatch.stockQuantity < item.monthlyQuantity;
                  const itemSubtotal = (item.estimatedRate || 0) * item.monthlyQuantity;

                  return (
                    <tr 
                      key={item.id}
                      className={cn(
                        "transition-colors border-l-2",
                        idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/70 dark:bg-slate-800/35",
                        "hover:bg-blue-50/70 dark:hover:bg-slate-800/70",
                        item.isActive !== false ? "border-l-transparent hover:border-l-blue-500" : "border-l-slate-300 opacity-60 bg-slate-100/50 dark:bg-slate-900/50"
                      )}
                    >
                      <td className="p-3.5 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <span>{item.name}</span>
                          {invMatch && (
                            <span className={cn(
                              "text-[9px] font-extrabold px-1.5 py-0.2 rounded",
                              isLowStock 
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            )}>
                              Stock: {invMatch.stockQuantity}
                            </span>
                          )}
                        </div>
                        {item.instructions && (
                          <p className="text-[10px] text-slate-500 italic mt-0.5">
                            Note: {item.instructions}
                          </p>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-700 dark:text-slate-300 font-medium">
                        {item.dosage || '1-0-1'}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                          <button
                            type="button"
                            onClick={() => handleUpdateMedicineQty(item.id, item.monthlyQuantity - 1)}
                            className="text-slate-500 hover:text-slate-900 font-bold px-1 cursor-pointer"
                          >
                            -
                          </button>
                          <span className="font-bold text-slate-900 dark:text-white px-1">
                            {item.monthlyQuantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateMedicineQty(item.id, item.monthlyQuantity + 1)}
                            className="text-slate-500 hover:text-slate-900 font-bold px-1 cursor-pointer"
                          >
                            +
                          </button>
                          <span className="text-[10px] text-slate-400 ml-1">{item.unit || 'Units'}</span>
                        </div>
                      </td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-400">
                        {item.estimatedRate ? `₹${item.estimatedRate.toFixed(2)}` : '-'}
                      </td>
                      <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                        {itemSubtotal > 0 ? `₹${itemSubtotal.toFixed(2)}` : '-'}
                      </td>
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => handleToggleMedicineActive(item.id)}
                          className={cn(
                            "text-[10px] font-extrabold px-2 py-0.5 rounded-full cursor-pointer transition-colors",
                            item.isActive !== false
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          )}
                        >
                          {item.isActive !== false ? 'Active' : 'Paused'}
                        </button>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveMedicine(item.id)}
                          className="text-slate-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer"
                          title="Remove medicine from monthly schedule"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-10 text-center text-slate-400">
              <Pill size={36} className="mx-auto mb-2 opacity-20" />
              <p className="text-xs font-medium">No recurring monthly medicines added yet.</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Click <strong>"+ Add Monthly Medicine"</strong> above to add regular prescriptions for this patient.
              </p>
            </div>
          )}
        </div>

        {/* Action Toolbar */}
        {patient.monthlyMedicines && patient.monthlyMedicines.length > 0 && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase">Estimated Monthly Package:</span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                ₹{monthlyTotalVal.toFixed(2)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Mark as Dispensed */}
              {refillStatus.status !== 'dispensed' ? (
                <button
                  type="button"
                  onClick={() => handleMarkAsDispensed()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  <CheckCircle2 size={14} />
                  <span>Mark as Dispensed ({currentMonthLabel})</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Check size={14} />
                    <span>Dispensed for {currentMonthLabel}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUndoDispensation(currentMonthKey)}
                    className="text-[10px] font-bold text-slate-400 hover:text-slate-600 underline cursor-pointer"
                  >
                    Undo
                  </button>
                </div>
              )}

              {/* POS Cart Button */}
              <button
                type="button"
                onClick={handleSendToPOS}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                title="Send active monthly medicines directly to POS checkout cart"
              >
                <ShoppingCart size={14} />
                <span>Send to POS Cart</span>
              </button>

              {/* WhatsApp Reminder */}
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                title="Send pre-filled WhatsApp medicine schedule & refill prompt to patient"
              >
                <Share2 size={14} />
                <span>WhatsApp Refill Slip</span>
              </button>

              {/* Print PDF Slip */}
              <button
                type="button"
                onClick={() => generateMonthlyRefillSlipPDF(patient, currentMonthLabel)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 cursor-pointer shadow-xs"
                title="Generate printable PDF Refill Schedule & Packaging Slip"
              >
                <Printer size={14} />
                <span>Print Slip (PDF)</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dispensation History Log */}
      {patient.monthlyDispensations && patient.monthlyDispensations.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock size={14} />
              <span>Past Monthly Dispensations History (मासिक दवा वितरण इतिहास)</span>
            </h4>
            <span className="text-[10px] font-bold text-slate-400">
              {patient.monthlyDispensations.length} records
            </span>
          </div>

          <div className="space-y-2">
            {[...patient.monthlyDispensations]
              .sort((a, b) => new Date(b.dispensedDate).getTime() - new Date(a.dispensedDate).getTime())
              .map((disp) => (
                <div 
                  key={disp.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 even:bg-slate-50/80 dark:even:bg-slate-800/50 odd:bg-white dark:odd:bg-slate-900 hover:bg-blue-50/60 dark:hover:bg-slate-800/80 hover:border-blue-200 dark:hover:border-blue-800 transition-all gap-2 shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      <CheckCircle2 size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{disp.monthLabel}</span>
                        <span className="text-[10px] text-slate-400">
                          ({new Date(disp.dispensedDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })})
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {disp.items.length} medicines • Dispensed by: {disp.dispensedBy || 'Staff'} {disp.notes ? `• ${disp.notes}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:self-center">
                    {disp.totalAmount && (
                      <span className="text-xs font-bold text-emerald-600">
                        ₹{disp.totalAmount.toFixed(2)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleUndoDispensation(disp.monthKey)}
                      className="text-[10px] text-slate-400 hover:text-red-500 underline cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientMonthlyRefillTab;
