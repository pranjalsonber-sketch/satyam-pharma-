import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Layers, 
  Download, 
  Trash2, 
  X, 
  ShoppingBag, 
  HardDrive, 
  ArrowRight,
  Receipt,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getPendingOfflineSales, 
  getAllOfflineSales, 
  syncPendingOfflineSales, 
  deleteOfflineSale,
  OfflineSale,
  getOfflineQueueStats
} from '../lib/offlinePosStore';
import { cn, formatCurrency } from '../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface OfflinePosManagerProps {
  compact?: boolean;
}

export const OfflinePosManager: React.FC<OfflinePosManagerProps> = ({ compact = false }) => {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState(0);
  const [totalPendingAmount, setTotalPendingAmount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [offlineSales, setOfflineSales] = useState<OfflineSale[]>([]);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const refreshStats = async () => {
    const stats = await getOfflineQueueStats();
    setPendingCount(stats.pendingCount);
    setTotalPendingAmount(stats.totalPendingAmount);
    const all = await getAllOfflineSales();
    setOfflineSales(all);
  };

  useEffect(() => {
    refreshStats();

    const handleOnline = () => {
      setIsOnline(true);
      refreshStats();
    };

    const handleOffline = () => {
      setIsOnline(false);
      refreshStats();
    };

    const handleSalesUpdated = () => {
      refreshStats();
    };

    const handleSyncCompleted = (e: any) => {
      const { successCount, failCount } = e.detail || {};
      if (successCount > 0) {
        setSyncToast(`Synced ${successCount} offline ${successCount === 1 ? 'sale' : 'sales'} to cloud successfully!`);
        setTimeout(() => setSyncToast(null), 5000);
      }
      refreshStats();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-sales-updated', handleSalesUpdated);
    window.addEventListener('offline-sync-completed', handleSyncCompleted);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-sales-updated', handleSalesUpdated);
      window.removeEventListener('offline-sync-completed', handleSyncCompleted);
    };
  }, []);

  const handleManualSync = async () => {
    if (!isOnline) {
      alert('Cannot sync while device is offline. Please connect to the internet first.');
      return;
    }

    setIsSyncing(true);
    try {
      const result = await syncPendingOfflineSales();
      if (result.successCount > 0) {
        setSyncToast(`Successfully synced ${result.successCount} offline transactions.`);
        setTimeout(() => setSyncToast(null), 5000);
      } else if (result.failCount > 0) {
        alert(`Failed to sync ${result.failCount} transactions. Error: ${result.errors.join(', ')}`);
      }
      await refreshStats();
    } catch (err: any) {
      alert(`Sync error: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this local offline sale record?')) {
      await deleteOfflineSale(id);
      await refreshStats();
    }
  };

  // Generate offline invoice PDF
  const handlePrintOfflineInvoice = (sale: OfflineSale) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text('SATYAM MEDICAL STORE & PHARMACY', 105, 18, { align: 'center' });

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('OFFLINE BILLING RECEIPT • LOCAL INDEXEDDB TRANSACTION', 105, 25, { align: 'center' });
    doc.text('123 Pharma Street, Healthcare City | GSTIN: 24AAAAA0000A1Z5', 105, 30, { align: 'center' });

    doc.setDrawColor(200);
    doc.line(10, 36, 200, 36);

    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`Receipt #: ${sale.id}`, 10, 45);
    doc.text(`Date: ${new Date(sale.timestamp).toLocaleString('en-IN')}`, 10, 52);
    doc.text(`Customer: ${sale.customerName || 'Walk-in'}`, 10, 59);
    if (sale.customerMobile) doc.text(`Mobile: ${sale.customerMobile}`, 10, 66);

    doc.setFontSize(10);
    doc.setTextColor(sale.synced ? 22 : 180, sale.synced ? 163 : 83, sale.synced ? 74 : 9);
    doc.text(`Sync Status: ${sale.synced ? 'Synced to Cloud' : 'Pending Cloud Sync (Saved in IndexedDB)'}`, 10, 74);

    autoTable(doc, {
      startY: 80,
      head: [['Medicine Item', 'Qty', 'Rate (₹)', 'Amount (₹)']],
      body: sale.items.map(it => [
        it.name,
        it.quantity.toString(),
        formatCurrency(it.price),
        formatCurrency(it.price * it.quantity),
      ]),
      foot: [['', '', 'Total Amount:', formatCurrency(sale.totalAmount)]],
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], fontSize: 10 },
      footStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 11 },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 150;
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text('Thank you for your visit. Computer-generated local invoice.', 105, finalY + 15, { align: 'center' });

    doc.save(`Offline_Receipt_${sale.id}.pdf`);
  };

  // If compact banner is requested and device is online with 0 pending sales, render minimal badge
  if (compact && isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <>
      {/* Toast Notification */}
      <AnimatePresence>
        {syncToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 right-5 z-[200] flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xl shadow-emerald-600/30"
          >
            <CheckCircle2 size={16} />
            <span>{syncToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* POS Offline Ribbon */}
      <div className={cn(
        "rounded-2xl border p-4 transition-all shadow-xs",
        !isOnline 
          ? "border-amber-300 bg-gradient-to-r from-amber-50/90 via-orange-50/40 to-white dark:border-amber-800 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200"
          : pendingCount > 0 
            ? "border-blue-200 bg-gradient-to-r from-blue-50/90 to-indigo-50/40 dark:border-blue-900 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200"
            : "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-200"
      )}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold shadow-sm",
              !isOnline 
                ? "bg-amber-500 text-white animate-pulse" 
                : pendingCount > 0 
                  ? "bg-blue-600 text-white" 
                  : "bg-emerald-600 text-white"
            )}>
              {!isOnline ? <WifiOff size={20} /> : pendingCount > 0 ? <HardDrive size={20} /> : <Wifi size={20} />}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider">
                  {!isOnline ? 'Offline POS Mode Active' : pendingCount > 0 ? 'Offline Queue Active' : 'Online & Cloud Synced'}
                </span>
                <span className="rounded-full bg-black/10 dark:bg-white/10 px-2 py-0.5 text-[9px] font-black uppercase">
                  IndexedDB Protected
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                {!isOnline 
                  ? 'Transactions are securely saved to local IndexedDB storage and will automatically sync once internet reconnects.'
                  : pendingCount > 0
                    ? `${pendingCount} offline ${pendingCount === 1 ? 'sale' : 'sales'} (${formatCurrency(totalPendingAmount)}) ready to sync.`
                    : 'All sales and stock adjustments are synchronized in real-time with Firestore.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {pendingCount > 0 && (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open-sync-conflict-resolver'))}
                className="flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 px-3.5 py-2 text-xs font-black text-white shadow-sm shadow-amber-500/30 transition-all active:scale-95 cursor-pointer"
                title="Review offline records, diagnose stock/price discrepancies, and resolve conflicts"
              >
                <AlertTriangle size={13} />
                <span>Review & Resolve Conflicts ({pendingCount})</span>
              </button>
            )}

            {pendingCount > 0 && isOnline && (
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-3.5 py-2 text-xs font-black text-white shadow-sm shadow-blue-600/30 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={13} className={cn(isSyncing && "animate-spin")} />
                <span>{isSyncing ? 'Syncing...' : `Quick Sync (${pendingCount})`}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-all cursor-pointer shadow-2xs"
            >
              <Layers size={13} />
              <span>Offline Ledger ({offlineSales.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal for Offline Sales Ledger & Queue Details */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="relative flex flex-col w-full max-w-4xl max-h-[90vh] rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-slate-100"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 p-5 bg-gradient-to-r from-blue-50/70 via-white to-slate-50 dark:from-slate-900 dark:to-slate-900">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md">
                  <HardDrive size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-slate-100">
                    Local IndexedDB Offline Transactions Ledger
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Continuous offline resiliency for POS checkout and billing history.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isOnline && pendingCount > 0 && (
                  <button
                    type="button"
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
                  >
                    <RefreshCw size={13} className={cn(isSyncing && "animate-spin")} />
                    <span>Sync All ({pendingCount})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3">
              {offlineSales.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 p-10 text-center">
                  <ShoppingBag size={36} className="mx-auto text-slate-400 mb-2" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No offline sales in local storage</p>
                  <p className="text-xs text-slate-500 mt-1">
                    When you process sales while disconnected from internet, they will safely appear here.
                  </p>
                </div>
              ) : (
                offlineSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 p-4 shadow-xs hover:border-blue-300 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 mt-0.5">
                        <Receipt size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                            {sale.id}
                          </span>
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-[9px] font-black uppercase",
                            sale.synced
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          )}>
                            {sale.synced ? 'Synced to Cloud' : 'Pending Sync'}
                          </span>
                          <span className="rounded-md bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-600 dark:text-slate-300">
                            {sale.paymentMethod}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-1">
                          Customer: <strong>{sale.customerName || 'Walk-in'}</strong> {sale.customerMobile && `(${sale.customerMobile})`}
                        </p>

                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {sale.items.map(it => `${it.name} x${it.quantity}`).join(', ')} • {new Date(sale.timestamp).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <div className="text-right">
                        <span className="text-sm font-black text-slate-900 dark:text-slate-100">
                          {formatCurrency(sale.totalAmount)}
                        </span>
                        <p className="text-[10px] text-slate-400">{sale.items.length} items</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePrintOfflineInvoice(sale)}
                        className="flex items-center gap-1 p-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors"
                        title="Download / Print Offline Receipt"
                      >
                        <Download size={15} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDelete(sale.id, e)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Discard record"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900 text-xs text-slate-500">
              <span>{pendingCount} Pending • {offlineSales.length} Total Local Records</span>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
              >
                Close Ledger
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

export default OfflinePosManager;
