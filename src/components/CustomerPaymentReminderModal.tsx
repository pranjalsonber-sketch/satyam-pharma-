import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Calendar, 
  IndianRupee, 
  User, 
  Phone, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  X, 
  Plus, 
  Send, 
  Search,
  Filter,
  ArrowUpRight,
  Receipt
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { CustomerDue, fetchCustomerDues, createCustomerDue, markCustomerDueAsPaid } from '../lib/customerPaymentDuesService';
import { useLanguage } from '../context/LanguageContext';
import { triggerSafeLinkRedirect } from './AppAccessLinkPortal';

interface CustomerPaymentReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onDuesUpdated?: () => void;
  defaultSaleInfo?: {
    customerName?: string;
    customerMobile?: string;
    totalAmount?: number;
    invoiceNo?: string;
    saleId?: string;
  };
}

export const CustomerPaymentReminderModal: React.FC<CustomerPaymentReminderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onDuesUpdated,
  defaultSaleInfo,
}) => {
  const { tText } = useLanguage();
  const [dues, setDues] = useState<CustomerDue[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'overdue' | 'all' | 'new'>('pending');
  const [searchTerm, setSearchTerm] = useState('');

  // New due form state
  const [customerName, setCustomerName] = useState(defaultSaleInfo?.customerName || '');
  const [customerMobile, setCustomerMobile] = useState(defaultSaleInfo?.customerMobile || '');
  const [amount, setAmount] = useState(defaultSaleInfo?.totalAmount ? String(defaultSaleInfo.totalAmount) : '');
  const [invoiceNo, setInvoiceNo] = useState(defaultSaleInfo?.invoiceNo || '');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7); // Default 7 days
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadDues = async () => {
    setLoading(true);
    try {
      const data = await fetchCustomerDues();
      setDues(data);
    } catch (err) {
      console.error('Error loading dues:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDues();
      if (defaultSaleInfo) {
        setCustomerName(defaultSaleInfo.customerName || '');
        setCustomerMobile(defaultSaleInfo.customerMobile || '');
        setAmount(defaultSaleInfo.totalAmount ? String(defaultSaleInfo.totalAmount) : '');
        setInvoiceNo(defaultSaleInfo.invoiceNo || '');
        setActiveTab('new');
      }
    }
  }, [isOpen, defaultSaleInfo]);

  if (!isOpen) return null;

  const today = new Date().toISOString().split('T')[0];

  const pendingDues = dues.filter(d => d.status !== 'paid');
  const overdueDues = dues.filter(d => d.status === 'overdue' || (d.status !== 'paid' && d.dueDate < today));
  const totalPendingAmount = pendingDues.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);

  const filteredDues = dues.filter(d => {
    const matchesSearch = d.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          d.customerMobile.includes(searchTerm) ||
                          (d.invoiceNo && d.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!matchesSearch) return false;

    if (activeTab === 'pending') return d.status === 'pending';
    if (activeTab === 'overdue') return d.status === 'overdue' || (d.status !== 'paid' && d.dueDate < today);
    return true; // 'all'
  });

  const handleCreateDue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !amount || !dueDate) return;

    setSubmitting(true);
    try {
      await createCustomerDue({
        customerName,
        customerMobile,
        amount: parseFloat(amount),
        dueDate,
        invoiceNo: invoiceNo || undefined,
        notes: notes || undefined,
      });

      // Reset form
      setCustomerName('');
      setCustomerMobile('');
      setAmount('');
      setInvoiceNo('');
      setNotes('');
      await loadDues();
      setActiveTab('pending');
      if (onSuccess) onSuccess();
      if (onDuesUpdated) onDuesUpdated();
    } catch (err) {
      console.error('Failed to create customer due reminder:', err);
      alert('Failed to save reminder in database');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkPaid = async (id: string) => {
    try {
      await markCustomerDueAsPaid(id);
      await loadDues();
      if (onSuccess) onSuccess();
      if (onDuesUpdated) onDuesUpdated();
    } catch (err) {
      console.error('Failed to mark due paid:', err);
    }
  };

  const handleSendWhatsAppReminder = (due: CustomerDue) => {
    const mobile = due.customerMobile.replace(/\D/g, '');
    const dueFormatted = new Date(due.dueDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const message = `Namaste ${due.customerName},\nThis is a polite reminder from Satyam Medical Stores regarding your pending balance of ${formatCurrency(due.amount)}${due.invoiceNo ? ` for Bill #${due.invoiceNo}` : ''}.\nThe payment due date was ${dueFormatted}.\nKindly clear the dues at your earliest convenience.\nThank you!`;
    const url = mobile.length >= 10
      ? `https://wa.me/91${mobile.slice(-10)}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    triggerSafeLinkRedirect(url, `WhatsApp Payment Reminder (${due.customerName})`);
  };

  const setPresetDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDueDate(d.toISOString().split('T')[0]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative flex flex-col max-h-[90vh] w-full max-w-3xl rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-500/30">
              <Bell size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-slate-100">
                  {tText('Customer Payment Dues & Reminders', 'ग्राहक बकाया भुगतान एवं अनुस्मारक')}
                </h3>
                {overdueDues.length > 0 && (
                  <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-black text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                    {overdueDues.length} Overdue
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Total outstanding: <strong className="text-slate-900 dark:text-slate-100">{formatCurrency(totalPendingAmount)}</strong> across {pendingDues.length} pending payments
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-6 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
                activeTab === 'pending'
                  ? "bg-slate-900 text-white dark:bg-blue-600"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              )}
            >
              Pending ({pendingDues.filter(d => d.status === 'pending').length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('overdue')}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
                activeTab === 'overdue'
                  ? "bg-rose-600 text-white"
                  : "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
              )}
            >
              Overdue ({overdueDues.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
                activeTab === 'all'
                  ? "bg-slate-900 text-white dark:bg-blue-600"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              )}
            >
              All Dues ({dues.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'new' ? 'pending' : 'new')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 cursor-pointer"
          >
            <Plus size={14} />
            <span>{activeTab === 'new' ? 'View List' : 'Record New Due'}</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'new' ? (
            <form onSubmit={handleCreateDue} className="space-y-4 max-w-xl mx-auto">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-4 border border-slate-200 dark:border-slate-800">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
                  Record Customer Credit / Pending Payment
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Customer Mobile
                    </label>
                    <input
                      type="tel"
                      value={customerMobile}
                      onChange={e => setCustomerMobile(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Pending Amount (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Invoice / Bill Number
                    </label>
                    <input
                      type="text"
                      value={invoiceNo}
                      onChange={e => setInvoiceNo(e.target.value)}
                      placeholder="INV-123456"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-900"
                    />
                  </div>
                </div>

                {/* Due Date & Quick Presets */}
                <div className="mt-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Due Date *
                  </label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <input
                      type="date"
                      required
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-900"
                    />
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase text-slate-400">Quick:</span>
                      <button
                        type="button"
                        onClick={() => setPresetDays(7)}
                        className="rounded bg-slate-200 dark:bg-slate-700 px-2 py-1 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-100 cursor-pointer"
                      >
                        +7 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => setPresetDays(15)}
                        className="rounded bg-slate-200 dark:bg-slate-700 px-2 py-1 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-100 cursor-pointer"
                      >
                        +15 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => setPresetDays(30)}
                        className="rounded bg-slate-200 dark:bg-slate-700 px-2 py-1 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-100 cursor-pointer"
                      >
                        +30 Days
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Notes / Prescribed Items
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Promised to pay during next monthly refill"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-900"
                  />
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('pending')}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? 'Saving...' : 'Save Due Reminder'}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search customer name, mobile or invoice..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 py-2 text-xs font-medium dark:border-slate-800 dark:bg-slate-800/60"
                />
              </div>

              {/* Dues List */}
              <div className="space-y-2.5">
                {filteredDues.map(due => {
                  const isOverdue = due.status === 'overdue' || (due.status !== 'paid' && due.dueDate < today);
                  const isPaid = due.status === 'paid';
                  const dueFormatted = new Date(due.dueDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  });

                  return (
                    <div
                      key={due.id}
                      className={cn(
                        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4 transition-all",
                        isPaid
                          ? "bg-slate-50/50 border-slate-200 dark:bg-slate-900/40 dark:border-slate-800 opacity-60"
                          : isOverdue
                            ? "bg-rose-50/50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/50 shadow-2xs"
                            : "bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-2xs"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg shrink-0 mt-0.5",
                          isPaid ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" :
                          isOverdue ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" :
                          "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        )}>
                          {isPaid ? <CheckCircle2 size={16} /> : isOverdue ? <AlertCircle size={16} /> : <Clock size={16} />}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {due.customerName}
                            </h5>
                            <span className={cn(
                              "rounded px-1.5 py-0.5 text-[9px] font-black uppercase",
                              isPaid ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                              isOverdue ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" :
                              "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            )}>
                              {isPaid ? 'PAID' : isOverdue ? 'OVERDUE' : 'PENDING'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            {due.customerMobile && (
                              <span className="flex items-center gap-1">
                                <Phone size={11} /> {due.customerMobile}
                              </span>
                            )}
                            {due.invoiceNo && (
                              <span className="font-mono">#{due.invoiceNo}</span>
                            )}
                            <span className={cn(
                              "font-bold",
                              isOverdue ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-300"
                            )}>
                              Due: {dueFormatted}
                            </span>
                          </div>

                          {due.notes && (
                            <p className="text-[10px] text-slate-400 italic mt-0.5">{due.notes}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
                        <div className="text-left sm:text-right">
                          <span className="text-sm font-black text-slate-900 dark:text-slate-100 block">
                            {formatCurrency(due.amount)}
                          </span>
                        </div>

                        {!isPaid ? (
                          <div className="flex items-center gap-1.5">
                            {due.customerMobile && (
                              <button
                                type="button"
                                onClick={() => handleSendWhatsAppReminder(due)}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer"
                                title="Send WhatsApp Payment Reminder"
                              >
                                <Send size={12} />
                                <span>Remind</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleMarkPaid(due.id)}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer"
                            >
                              <CheckCircle2 size={12} />
                              <span>Mark Paid</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] font-bold text-emerald-600">Settled</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {filteredDues.length === 0 && (
                  <div className="py-12 text-center text-slate-400">
                    <CheckCircle2 className="mx-auto mb-2 text-slate-300" size={32} />
                    <p className="text-xs font-bold">No payment dues found in this view</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default CustomerPaymentReminderModal;
