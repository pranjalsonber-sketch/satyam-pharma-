import React, { useEffect, useState } from 'react';
import { 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  Package, 
  Tag, 
  MoreHorizontal, 
  IndianRupee, 
  Edit, 
  MessageSquare, 
  Send, 
  CheckCircle,
  X,
  Sparkles,
  Clock,
  TrendingUp,
  Zap,
  Percent,
  Sliders,
  BarChart2
} from 'lucide-react';
import { collection, query, getDocs, addDoc, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLanguage } from '../context/LanguageContext';
import { Wholesaler } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { motion, AnimatePresence, Variants } from 'motion/react';
import { BatchPurchaseOptimizerModal } from './BatchPurchaseOptimizerModal';
import { SupplierPerformanceDashboard } from './SupplierPerformanceDashboard';
import { useAuth } from './AuthProvider';
import { canViewFinancials, canViewSuppliers } from '../lib/permissions';
import { SensitiveValueMask } from './SensitiveValueMask';

const Wholesalers: React.FC = () => {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const isFinancialAuthorized = canViewFinancials(profile);
  const isSupplierAuthorized = canViewSuppliers(profile);
  const [suppliers, setSuppliers] = useState<Wholesaler[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isOptimizerOpen, setIsOptimizerOpen] = useState(false);
  const [optimizerWholesalerId, setOptimizerWholesalerId] = useState<string | undefined>(undefined);
  const [performanceWholesalerId, setPerformanceWholesalerId] = useState<string | undefined>(undefined);
  const [selectedWholesaler, setSelectedWholesaler] = useState<Wholesaler | null>(null);
  const [manageTab, setManageTab] = useState<'edit' | 'contact'>('edit');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [emailMessage, setEmailMessage] = useState('');
  
  const [formData, setFormData] = useState<Partial<Wholesaler>>({
    name: '',
    contact: '',
    email: '',
    address: '',
    productTypes: [],
    brands: [],
    leadTimeDays: 3,
    minimumOrderValue: 3000,
    discountPercentage: 8
  });

  const [activeSubTab, setActiveSubTab] = useState<'directory' | 'performance' | 'bills'>('directory');
  const [bills, setBills] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'wholesalers'), orderBy('name'));
      
      const snapPromise = getDocs(q);
      const timeoutPromise = new Promise<null>((resolve) => 
        setTimeout(() => resolve(null), 12000)
      );

      const snap = await Promise.race([snapPromise, timeoutPromise]);
      if (snap) {
        setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Wholesaler)));
      }
    } catch (error) {
      console.warn("Notice loading wholesalers (handled):", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBills = async () => {
    try {
      const snapPromise = getDocs(collection(db, 'bills'));
      const timeoutPromise = new Promise<null>((resolve) => 
        setTimeout(() => resolve(null), 12000)
      );

      const snap = await Promise.race([snapPromise, timeoutPromise]);
      if (snap) {
        setBills(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    } catch (error) {
      console.warn("Notice loading bills (handled):", error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchBills();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'wholesalers'), {
        ...formData,
        leadTimeDays: Number(formData.leadTimeDays) || 3,
        minimumOrderValue: Number(formData.minimumOrderValue) || 3000,
        discountPercentage: Number(formData.discountPercentage) || 8
      });
      setIsAddModalOpen(false);
      fetchData();
      setFormData({ 
        name: '', 
        contact: '', 
        email: '', 
        address: '', 
        productTypes: [], 
        brands: [],
        leadTimeDays: 3,
        minimumOrderValue: 3000,
        discountPercentage: 8
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWholesaler) return;
    try {
      const { id, ...data } = selectedWholesaler;
      await updateDoc(doc(db, 'wholesalers', id), {
        ...data,
        leadTimeDays: Number(data.leadTimeDays) || 3,
        minimumOrderValue: Number(data.minimumOrderValue) || 3000,
        discountPercentage: Number(data.discountPercentage) || 8
      } as any);
      setIsManageModalOpen(false);
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const openOptimizer = (wholesalerId?: string) => {
    setOptimizerWholesalerId(wholesalerId);
    setIsOptimizerOpen(true);
  };

  const simulateEmail = () => {
    if (!emailMessage.trim()) return;
    setEmailStatus('sending');
    setTimeout(() => {
      setEmailStatus('sent');
      setTimeout(() => {
        setEmailStatus('idle');
        setEmailMessage('');
      }, 2000);
    }, 1500);
  };

  const openManageModal = (wholesaler: Wholesaler, tab: 'edit' | 'contact' = 'edit') => {
    setSelectedWholesaler({ ...wholesaler });
    setManageTab(tab);
    setIsManageModalOpen(true);
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.brands?.some(b => b.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const containerVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.35,
        ease: "easeOut",
        staggerChildren: 0.06
      }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.25, ease: "easeOut" }
    }
  };

  return (
    <motion.div 
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.header variants={itemVariants} className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t('wholesalers')}</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Vendor Management, Lead Times & AI Purchase Optimization</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* AI Batch Purchase Optimizer Action Button */}
          <button
            type="button"
            onClick={() => openOptimizer()}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
          >
            <Sparkles size={15} className="text-amber-300 animate-pulse" />
            <span>AI Batch Purchase Optimizer</span>
          </button>

          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl dark:bg-slate-800">
            <button 
              onClick={() => setActiveSubTab('directory')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer", 
                activeSubTab === 'directory' ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-700"
              )}
            >Directory</button>
            <button 
              onClick={() => {
                setPerformanceWholesalerId(undefined);
                setActiveSubTab('performance');
              }}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5", 
                activeSubTab === 'performance' ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <BarChart2 size={13} className={activeSubTab === 'performance' ? "text-blue-600 dark:text-blue-400" : "text-slate-400"} />
              <span>{t('supplierPerformance')}</span>
            </button>
            <button 
              onClick={() => setActiveSubTab('bills')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer", 
                activeSubTab === 'bills' ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-700"
              )}
            >{t('pendingBills')}</button>
          </div>
        </div>
      </motion.header>

      {activeSubTab === 'directory' ? (
        <motion.div variants={itemVariants} className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder={t('search')}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-2xs outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-md transition-transform active:scale-95 dark:bg-blue-600 cursor-pointer"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">{t('add')} Vendor</span>
            </button>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSuppliers.map((s) => {
              const leadTime = s.leadTimeDays || 3;
              const discount = s.discountPercentage || 8;
              const mov = s.minimumOrderValue || 3000;

              return (
                <motion.div
                  layout
                  key={s.id}
                  className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30">
                      <Package size={22} />
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => {
                          setPerformanceWholesalerId(s.id);
                          setActiveSubTab('performance');
                        }}
                        className="flex items-center gap-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 dark:text-blue-300 px-2 py-1 text-[10px] font-bold transition-colors cursor-pointer"
                        title="View Lead Times & Purchase History"
                      >
                        <TrendingUp size={12} className="text-blue-600 dark:text-blue-400" />
                        <span>Performance</span>
                      </button>
                      <button 
                        onClick={() => openOptimizer(s.id)}
                        className="flex items-center gap-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-300 px-2 py-1 text-[10px] font-bold transition-colors cursor-pointer"
                        title="AI Optimize Purchase Batches for this Wholesaler"
                      >
                        <Sparkles size={12} className="text-amber-500" />
                        <span>Optimize</span>
                      </button>
                      <button 
                        onClick={() => openManageModal(s, 'edit')}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-blue-600 dark:hover:bg-slate-800 cursor-pointer"
                        title="Edit Supplier"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => openManageModal(s, 'contact')}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-blue-600 dark:hover:bg-slate-800 cursor-pointer"
                        title="Contact Supplier"
                      >
                        <MessageSquare size={16} />
                      </button>
                    </div>
                  </div>
                  
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{s.name}</h3>
                  <p className="text-[10px] uppercase font-semibold text-slate-500 tracking-tight mt-0.5">{s.address || 'No address provided'}</p>

                  {/* Vendor Lead Time & Margin Badges */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      <Clock size={11} />
                      {leadTime}-Day Lead Time
                    </span>
                    {isFinancialAuthorized ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <Percent size={11} />
                        {discount}% Wholesale Tier
                      </span>
                    ) : (
                      <SensitiveValueMask 
                        isAuthorized={false} 
                        maskText="Wholesale Margin: Restricted" 
                        badgeMode={true}
                        requiredRole="manager" 
                      />
                    )}
                    <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                      <span>MOV:</span>
                      <SensitiveValueMask 
                        isAuthorized={isFinancialAuthorized} 
                        value={`₹${mov.toLocaleString('en-IN')}`} 
                        maskText="••••" 
                      />
                    </span>
                  </div>

                  <div className="my-4 space-y-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                      <Phone size={13} className="text-blue-500" />
                      <span>{s.contact}</span>
                    </div>
                    {s.email && (
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                        <Mail size={13} className="text-blue-500" />
                        <span className="truncate">{s.email}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                    {s.brands?.slice(0, 4).map(brand => (
                      <span key={brand} className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase text-slate-600 tracking-wider dark:bg-slate-800 dark:text-slate-400">
                        {brand}
                      </span>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      ) : activeSubTab === 'performance' ? (
        <motion.div variants={itemVariants}>
          <SupplierPerformanceDashboard
            wholesalers={suppliers}
            bills={bills}
            initialSelectedWholesalerId={performanceWholesalerId}
            onNavigateToDirectory={() => setActiveSubTab('directory')}
          />
        </motion.div>
      ) : (
        <motion.div variants={itemVariants} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-tight">{t('pendingBills')}</h3>
              <p className="text-xs text-slate-400">Track and pay wholesaler invoices & draft batch orders</p>
            </div>
            <button 
              onClick={() => openOptimizer()}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 cursor-pointer"
            >
              <Sparkles size={14} className="text-amber-300" />
              <span>Generate Batch PO</span>
            </button>
          </div>
          <div className="space-y-2">
            {bills.map((bill, idx) => (
              <div 
                key={bill.id} 
                className={cn(
                  "flex items-center justify-between rounded-xl border p-4 transition-all",
                  idx % 2 === 0 
                    ? "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800" 
                    : "bg-slate-50/60 dark:bg-slate-850/50 border-slate-200/60 dark:border-slate-800/80",
                  "hover:border-blue-300 dark:hover:border-blue-800 hover:bg-blue-50/30 dark:hover:bg-blue-950/20"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-900/30 font-bold">
                    <IndianRupee size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {bill.wholesalerName || `Bill #${bill.id.slice(0, 5)}`}
                    </p>
                    <p className="text-[10px] font-bold uppercase text-slate-500 font-mono">
                      Due: {bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : 'N/A'} {bill.notes ? `• ${bill.notes}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <SensitiveValueMask 
                    isAuthorized={isFinancialAuthorized} 
                    value={formatCurrency(bill.amount)} 
                    className="text-sm font-black text-rose-600 dark:text-rose-400 font-mono"
                  />
                  <span className={cn(
                    "rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider",
                    bill.status === 'paid' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                  )}>
                    {bill.status === 'paid' ? 'Paid' : 'Pending'}
                  </span>
                </div>
              </div>
            ))}
            {bills.length === 0 && (
              <div className="py-20 text-center text-slate-400">
                <div className="mb-4 flex justify-center"><Tag size={48} className="opacity-10" /></div>
                <p className="text-sm font-medium">No bills uploaded yet.</p>
                <p className="text-xs mt-1">Use the AI Batch Purchase Optimizer to automatically generate and draft wholesaler POs.</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Add Wholesaler Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setIsAddModalOpen(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Add Wholesaler / Distributor</h2>
                  <p className="text-xs text-slate-500">Configure lead time & wholesale margin for automated batch ordering</p>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={20} /></button>
              </div>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500">Wholesaler Name *</label>
                    <input required type="text" placeholder="e.g. Apollo Pharma Distributors" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-800" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500">Contact Number *</label>
                    <input required type="text" placeholder="e.g. +91 98765 43210" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-800" value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500">Lead Time (Days)</label>
                    <input type="number" min="1" max="30" placeholder="e.g. 3" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-800" value={formData.leadTimeDays} onChange={e => setFormData({...formData, leadTimeDays: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500">Min. Order Value (₹)</label>
                    <input type="number" min="0" placeholder="e.g. 3000" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-800" value={formData.minimumOrderValue} onChange={e => setFormData({...formData, minimumOrderValue: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500">Discount Margin (%)</label>
                    <input type="number" min="0" max="100" placeholder="e.g. 8" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-800" value={formData.discountPercentage} onChange={e => setFormData({...formData, discountPercentage: Number(e.target.value)})} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">Email Address</label>
                  <input type="email" placeholder="orders@distributor.com" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-800" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">Physical Address / Warehouse</label>
                  <textarea placeholder="Wholesaler Depot Address, City, State" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-800" rows={2} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">{t('cancel')}</button>
                  <button type="submit" className="rounded-xl bg-blue-600 px-6 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-xs cursor-pointer">{t('save')} Vendor</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit/Contact Wholesaler Modal */}
      <AnimatePresence>
        {isManageModalOpen && selectedWholesaler && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setIsManageModalOpen(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedWholesaler.name}</h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Manage Supplier Account & Lead Time Parameters</p>
                </div>
                <button onClick={() => setIsManageModalOpen(false)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={20} /></button>
              </div>

              <div className="mb-6 flex gap-2 border-b border-slate-100 dark:border-slate-800">
                <button 
                  onClick={() => setManageTab('edit')}
                  className={cn(
                    "px-4 py-2 text-xs font-bold uppercase tracking-widest border-b-2 transition-all",
                    manageTab === 'edit' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"
                  )}
                >
                  Edit Profile & Lead Time
                </button>
                <button 
                  onClick={() => setManageTab('contact')}
                  className={cn(
                    "px-4 py-2 text-xs font-bold uppercase tracking-widest border-b-2 transition-all",
                    manageTab === 'contact' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"
                  )}
                >
                  Contact Vendor
                </button>
              </div>

              {manageTab === 'edit' ? (
                <form onSubmit={handleUpdate} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-slate-500">Wholesaler Name</label>
                      <input required type="text" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-800" value={selectedWholesaler.name} onChange={e => setSelectedWholesaler({...selectedWholesaler, name: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-slate-500">Contact Number</label>
                      <input required type="text" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-800" value={selectedWholesaler.contact} onChange={e => setSelectedWholesaler({...selectedWholesaler, contact: e.target.value})} />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-slate-500">Lead Time (Days)</label>
                      <input type="number" min="1" max="30" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-800" value={selectedWholesaler.leadTimeDays ?? 3} onChange={e => setSelectedWholesaler({...selectedWholesaler, leadTimeDays: Number(e.target.value)})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-slate-500">Min. Order Value (₹)</label>
                      <input type="number" min="0" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-800" value={selectedWholesaler.minimumOrderValue ?? 3000} onChange={e => setSelectedWholesaler({...selectedWholesaler, minimumOrderValue: Number(e.target.value)})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-slate-500">Discount Margin (%)</label>
                      <input type="number" min="0" max="100" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-800" value={selectedWholesaler.discountPercentage ?? 8} onChange={e => setSelectedWholesaler({...selectedWholesaler, discountPercentage: Number(e.target.value)})} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500">Email Address</label>
                    <input type="email" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-800" value={selectedWholesaler.email || ''} onChange={e => setSelectedWholesaler({...selectedWholesaler, email: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500">Physical Address</label>
                    <textarea className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-800" rows={2} value={selectedWholesaler.address || ''} onChange={e => setSelectedWholesaler({...selectedWholesaler, address: e.target.value})} />
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={() => setIsManageModalOpen(false)} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">{t('cancel')}</button>
                    <button type="submit" className="rounded-xl bg-blue-600 px-6 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-xs cursor-pointer">{t('save')} Changes</button>
                  </div>
                </form>
              ) : (
                <div className="space-y-6 py-2">
                  <div className="flex items-center gap-4 rounded-xl bg-blue-50 p-4 dark:bg-blue-900/20">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
                      <Mail size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-blue-900 dark:text-blue-100">Direct Email Inquiry</p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">Sending to: {selectedWholesaler.email || 'No email configured'}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500">Message to Vendor</label>
                    <textarea 
                      placeholder="Type your message about orders, payments, or stock inquiries..." 
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold dark:border-slate-800 dark:bg-slate-800" 
                      rows={5}
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end">
                    <button 
                      onClick={simulateEmail}
                      disabled={emailStatus !== 'idle' || !selectedWholesaler.email || !emailMessage.trim()}
                      className={cn(
                        "flex items-center gap-2 rounded-xl px-6 py-2.5 text-xs font-bold transition-all cursor-pointer",
                        emailStatus === 'sent' ? "bg-emerald-600 text-white" : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                      )}
                    >
                      {emailStatus === 'idle' && (
                        <>
                          <Send size={16} />
                          <span>Send Inquiry</span>
                        </>
                      )}
                      {emailStatus === 'sending' && (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          <span>Sending...</span>
                        </>
                      )}
                      {emailStatus === 'sent' && (
                        <>
                          <CheckCircle size={16} />
                          <span>Message Sent!</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Batch Purchase Optimizer Modal */}
      <BatchPurchaseOptimizerModal
        isOpen={isOptimizerOpen}
        onClose={() => setIsOptimizerOpen(false)}
        initialWholesalerId={optimizerWholesalerId}
        onOrderCreated={() => fetchBills()}
      />
    </motion.div>
  );
};

export default Wholesalers;

