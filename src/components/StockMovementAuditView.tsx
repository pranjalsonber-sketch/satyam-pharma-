import React, { useState, useEffect } from 'react';
import { 
  History, 
  ArrowUpRight, 
  ArrowDownRight, 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  PlusCircle, 
  MinusCircle, 
  Package, 
  Layers, 
  Clock, 
  User, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { motion } from 'motion/react';
import { StockMovement, fetchStockMovements, logStockMovement } from '../lib/stockAuditService';
import { Medicine } from '../types';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { useLanguage } from '../context/LanguageContext';

interface StockMovementAuditViewProps {
  medicines: Medicine[];
  onRefreshMedicines?: () => void;
}

export const StockMovementAuditView: React.FC<StockMovementAuditViewProps> = ({
  medicines,
  onRefreshMedicines,
}) => {
  const { tText } = useLanguage();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'addition' | 'subtraction'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // Manual Adjustment Form
  const [selectedMedicineId, setSelectedMedicineId] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'addition' | 'subtraction'>('addition');
  const [adjustmentQty, setAdjustmentQty] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('Physical Stock Count Adjustment');
  const [submitting, setSubmitting] = useState(false);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchStockMovements(300);
      setMovements(data);
    } catch (err) {
      console.error('Error fetching stock audit movements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const totalAdditions = movements.filter(m => m.type === 'addition').reduce((acc, m) => acc + (Number(m.quantity) || 0), 0);
  const totalSubtractions = movements.filter(m => m.type === 'subtraction').reduce((acc, m) => acc + (Number(m.quantity) || 0), 0);
  const netDelta = totalAdditions - totalSubtractions;

  const filteredMovements = movements.filter(m => {
    if (filterType !== 'all' && m.type !== filterType) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      m.medicineName.toLowerCase().includes(term) ||
      (m.batchNumber && m.batchNumber.toLowerCase().includes(term)) ||
      (m.reason && m.reason.toLowerCase().includes(term)) ||
      (m.userName && m.userName.toLowerCase().includes(term))
    );
  });

  const exportAuditCSV = () => {
    const headers = ["Timestamp", "Medicine Name", "Type", "Quantity", "Previous Stock", "New Stock", "Batch Number", "Reason", "User"];
    const rows = filteredMovements.map(m => [
      new Date(m.timestamp).toLocaleString('en-IN'),
      `"${m.medicineName.replace(/"/g, '""')}"`,
      m.type.toUpperCase(),
      m.quantity,
      m.previousStock,
      m.newStock,
      `"${m.batchNumber || 'N/A'}"`,
      `"${(m.reason || '').replace(/"/g, '""')}"`,
      `"${(m.userName || 'Staff').replace(/"/g, '""')}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Stock_Movement_Audit_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleManualAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const med = medicines.find(m => m.id === selectedMedicineId);
    if (!med || !adjustmentQty) return;

    const qty = parseInt(adjustmentQty, 10);
    if (isNaN(qty) || qty <= 0) return;

    const prevStock = Number(med.stockQuantity) || 0;
    const newStock = adjustmentType === 'addition' ? (prevStock + qty) : Math.max(0, prevStock - qty);

    setSubmitting(true);
    try {
      await logStockMovement({
        medicineId: med.id,
        medicineName: med.name,
        batchNumber: med.batches?.[0]?.batchNumber || 'GEN-01',
        type: adjustmentType,
        quantity: qty,
        previousStock: prevStock,
        newStock,
        reason: adjustmentReason,
        userName: 'Pharmacist',
        userRole: 'admin'
      });

      setIsManualModalOpen(false);
      setSelectedMedicineId('');
      setAdjustmentQty('');
      await loadLogs();
      if (onRefreshMedicines) onRefreshMedicines();
    } catch (err) {
      console.error('Adjustment error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-blue-600 shadow-md">
            <History size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
              {tText('Stock Audit Trail & Inventory Ledger', 'स्टॉक ऑडिट ट्रेल एवं इन्वेंटरी खाता')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Immutable ledger of all stock additions, sales subtractions, batch refills, and write-offs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={exportAuditCSV}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <FileSpreadsheet size={14} className="text-emerald-600" />
            <span>Export Audit CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsManualModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 active:scale-95 dark:bg-blue-600 dark:hover:bg-blue-500 cursor-pointer"
          >
            <PlusCircle size={14} />
            <span>Record Manual Adjustment</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Audited Events</span>
            <History size={16} className="text-blue-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{movements.length}</span>
            <span className="text-xs font-semibold text-slate-500">entries</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Complete movement history</p>
        </div>

        <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-3.5 shadow-2xs dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Stock Additions (+)</span>
            <ArrowUpRight size={16} className="text-emerald-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">+{totalAdditions}</span>
            <span className="text-xs font-semibold text-emerald-600">units</span>
          </div>
          <p className="text-[10px] text-emerald-600 mt-0.5">Restocks & purchase intakes</p>
        </div>

        <div className="rounded-xl border border-rose-200/70 bg-rose-50/40 p-3.5 shadow-2xs dark:border-rose-900/40 dark:bg-rose-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">Stock Subtractions (-)</span>
            <ArrowDownRight size={16} className="text-rose-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-rose-700 dark:text-rose-400">-{totalSubtractions}</span>
            <span className="text-xs font-semibold text-rose-600">units</span>
          </div>
          <p className="text-[10px] text-rose-600 mt-0.5">POS sales & disposals</p>
        </div>

        <div className="rounded-xl border border-indigo-200/70 bg-indigo-50/40 p-3.5 shadow-2xs dark:border-indigo-900/40 dark:bg-indigo-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">Net Inventory Delta</span>
            <Layers size={16} className="text-indigo-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className={cn(
              "text-2xl font-black",
              netDelta >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
            )}>
              {netDelta >= 0 ? `+${netDelta}` : netDelta}
            </span>
            <span className="text-xs font-semibold text-indigo-600">net units</span>
          </div>
          <p className="text-[10px] text-indigo-500 mt-0.5">Overall stock flux</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
              filterType === 'all'
                ? "bg-slate-900 text-white dark:bg-blue-600"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            )}
          >
            All Logs ({movements.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('addition')}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
              filterType === 'addition'
                ? "bg-emerald-600 text-white"
                : "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
            )}
          >
            Additions (+)
          </button>
          <button
            type="button"
            onClick={() => setFilterType('subtraction')}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
              filterType === 'subtraction'
                ? "bg-rose-600 text-white"
                : "text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
            )}
          >
            Subtractions (-)
          </button>
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search medicine, batch, or reason..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs font-medium dark:border-slate-800 dark:bg-slate-800"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-zinc-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Medicine Name</th>
                <th className="py-3 px-3 text-center">Batch</th>
                <th className="py-3 px-3 text-center">Action</th>
                <th className="py-3 px-3 text-right">Quantity</th>
                <th className="py-3 px-3 text-center">Stock Shift</th>
                <th className="py-3 px-4">Reason / Reference</th>
                <th className="py-3 px-4">Staff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredMovements.map((m) => {
                const isAddition = m.type === 'addition';
                const dateObj = new Date(m.timestamp);
                const dateFormatted = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                const timeFormatted = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

                return (
                  <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {dateFormatted} • {timeFormatted}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 dark:text-slate-100 block">
                        {m.medicineName}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-500">
                      {m.batchNumber || 'GEN-01'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
                        isAddition
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                      )}>
                        {isAddition ? '+ ADD' : '- DEDUCT'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-black">
                      <span className={isAddition ? "text-emerald-600" : "text-rose-600"}>
                        {isAddition ? `+${m.quantity}` : `-${m.quantity}`}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap font-mono text-[11px] text-slate-500">
                      <span>{m.previousStock}</span>
                      <span className="mx-1 text-slate-300">→</span>
                      <strong className="text-slate-900 dark:text-slate-100">{m.newStock}</strong>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {m.reason}
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap text-[11px]">
                      {m.userName || 'Pharmacist'}
                    </td>
                  </tr>
                );
              })}

              {filteredMovements.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <History className="mx-auto mb-2 text-slate-300" size={32} />
                    <p className="text-xs font-bold">No stock movements recorded yet</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Movements will automatically appear when sales are billed or batches restocked.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Stock Adjustment Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 mb-4">
              Record Manual Stock Adjustment
            </h3>

            <form onSubmit={handleManualAdjustment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Select Medicine *
                </label>
                <select
                  required
                  value={selectedMedicineId}
                  onChange={e => setSelectedMedicineId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">-- Choose Medicine --</option>
                  {medicines.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} (Current: {m.stockQuantity} units)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustmentType('addition')}
                  className={cn(
                    "rounded-lg p-2 text-xs font-bold text-center border cursor-pointer",
                    adjustmentType === 'addition'
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300"
                  )}
                >
                  + Add Stock
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentType('subtraction')}
                  className={cn(
                    "rounded-lg p-2 text-xs font-bold text-center border cursor-pointer",
                    adjustmentType === 'subtraction'
                      ? "bg-rose-600 text-white border-rose-600"
                      : "border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300"
                  )}
                >
                  - Deduct Stock
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Quantity (Units) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={adjustmentQty}
                  onChange={e => setAdjustmentQty(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Adjustment *
                </label>
                <input
                  type="text"
                  required
                  value={adjustmentReason}
                  onChange={e => setAdjustmentReason(e.target.value)}
                  placeholder="e.g. Physical inventory discrepancy reconciliation"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-blue-600 cursor-pointer"
                >
                  {submitting ? 'Recording...' : 'Commit Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
