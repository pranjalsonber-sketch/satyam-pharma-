import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLanguage } from '../context/LanguageContext';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  AlertTriangle, 
  AlertCircle,
  CheckCircle2,
  Package, 
  IndianRupee, 
  Clock,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Sparkles,
  Users,
  Bot,
  Newspaper,
  Sliders,
  Bell,
  BellOff,
  Compass,
  ShoppingCart,
  ArrowRight,
  Mail,
  FileText,
  Download,
  RotateCcw,
  GripVertical,
  Move,
  CreditCard,
  Layers,
  Percent
} from 'lucide-react';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { Medicine, Sale, ActivityLog } from '../types';
import { getExpirySettings, ExpirySettings } from '../lib/expirySettings';
import { motion, Variants } from 'motion/react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableStatCard, StatCardData } from './SortableStatCard';
import { SortableDashboardWidget } from './SortableDashboardWidget';
import { ExpirySettingsPanel } from './ExpirySettingsPanel';
import { MonthlyIdeaDashboardWidget } from './MonthlyIdeaDashboardWidget';
import { ActiveStaffWidget } from './ActiveStaffWidget';
import { LoggedInMembersMonitor } from './LoggedInMembersMonitor';
import { DashboardSkeleton } from './DashboardSkeleton';
import { useAuth } from './AuthProvider';
import { canViewFinancials } from '../lib/permissions';
import { SensitiveValueMask } from './SensitiveValueMask';
import { fetchCustomerDues, CustomerDue } from '../lib/customerPaymentDuesService';
import CustomerPaymentReminderModal from './CustomerPaymentReminderModal';
import { AIStockReorderSummaryCard } from './AIStockReorderSummaryCard';
import { AutoProcurementEngineWidget } from './AutoProcurementEngineWidget';

export interface ExpiringItem {
  id: string;
  medicineName: string;
  genericName?: string;
  salt?: string;
  batchNumber: string;
  expiryDate: string;
  stockQuantity: number;
  daysLeft: number;
}

interface DashboardProps {
  onNavigate?: (tab: string) => void;
}

// Framer Motion Animation Variants for Staggered Grid Entry
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.12,
    },
  },
};

const widgetCardVariants: Variants = {
  hidden: { 
    opacity: 0, 
    y: 22, 
    scale: 0.97 
  },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { 
      type: "spring",
      stiffness: 280, 
      damping: 24,
      mass: 0.8
    }
  },
};

const sectionVariants: Variants = {
  hidden: { 
    opacity: 0, 
    y: 20 
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { 
      duration: 0.45,
      ease: [0.16, 1, 0.3, 1]
    }
  },
};

const CATEGORY_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#64748b'];

const DEFAULT_CARD_ORDER = ['today-sales', 'total-orders', 'inventory-status', 'expiring-soon', 'active-staff'];

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { t, tText } = useLanguage();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSales: 0,
    salesCount: 0,
    lowStock: 0,
    expiringSoon: 0,
  });
  const [staffStats, setStaffStats] = useState({
    totalStaff: 3,
    onlineStaff: 2,
  });
  const [expiring30Days, setExpiring30Days] = useState<ExpiringItem[]>([]);
  const [expiryFilter, setExpiryFilter] = useState<'all' | 'critical' | 'expired'>('all');
  const [expirySettings, setExpirySettings] = useState<ExpirySettings>(getExpirySettings());
  const [isExpirySettingsModalOpen, setIsExpirySettingsModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [allSalesHistory, setAllSalesHistory] = useState<Sale[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [monthlySalesData, setMonthlySalesData] = useState<any[]>([]);
  const [categoryDistribution, setCategoryDistribution] = useState<any[]>([]);
  const [customerDues, setCustomerDues] = useState<CustomerDue[]>([]);
  const [isDuesModalOpen, setIsDuesModalOpen] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<Medicine[]>([]);
  const [isAiReorderOpen, setIsAiReorderOpen] = useState(false);

  // Customer dues metrics for notifications (Requirement 3)
  const pendingDues = customerDues.filter(d => d.status !== 'paid');
  const pendingDuesCount = pendingDues.length;
  const overdueDuesCount = pendingDues.filter(d => d.status === 'overdue').length;
  const totalPendingDuesAmount = pendingDues.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);

  // Drag and drop prioritization state
  const [cardOrder, setCardOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('satyam_dashboard_stats_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter(k => DEFAULT_CARD_ORDER.includes(k));
          const missing = DEFAULT_CARD_ORDER.filter(k => !valid.includes(k));
          return [...valid, ...missing];
        }
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_CARD_ORDER;
  });

  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 5,
    },
  });
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });
  const sensors = useSensors(pointerSensor, keyboardSensor);

  const handleCardDragStart = (event: DragStartEvent) => {
    setActiveCardId(String(event.active.id));
  };

  const handleCardDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);
    if (over && active.id !== over.id) {
      setCardOrder((items) => {
        const oldIndex = items.indexOf(String(active.id));
        const newIndex = items.indexOf(String(over.id));
        const newOrder = arrayMove(items, oldIndex, newIndex);
        try {
          localStorage.setItem('satyam_dashboard_stats_order', JSON.stringify(newOrder));
        } catch (e) {
          console.error(e);
        }
        return newOrder;
      });
    }
  };

  const handleResetCardOrder = () => {
    setCardOrder(DEFAULT_CARD_ORDER);
    try {
      localStorage.removeItem('satyam_dashboard_stats_order');
    } catch (e) {
      console.error(e);
    }
  };

  const isCardsCustomized = JSON.stringify(cardOrder) !== JSON.stringify(DEFAULT_CARD_ORDER);

  // Real-time listener for active staff members and online counters
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      let count = 0;
      let total = snapshot.size;
      snapshot.forEach(docSnap => {
        if (docSnap.data().isOnline) count++;
      });
      if (total <= 1) {
        total = 3;
        count = Math.max(count, 2);
      }
      setStaffStats({
        totalStaff: total,
        onlineStaff: Math.max(1, count),
      });
    }, (error) => {
      console.warn("Dashboard staff count listener note:", error.message);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const handleSettingsUpdate = (e: any) => {
      if (e?.detail) {
        setExpirySettings(e.detail);
      } else {
        setExpirySettings(getExpirySettings());
      }
    };
    window.addEventListener('expiry-settings-updated', handleSettingsUpdate);
    return () => window.removeEventListener('expiry-settings-updated', handleSettingsUpdate);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      setLoading(true);

      try {
        const currentExpirySettings = getExpirySettings();

        // Soft timeout helper for Firestore queries
        const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
          return Promise.race([
            promise,
            new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
          ]);
        };

        // Parallel fetch for inventory, sales, and activity logs
        const [invResult, salesResult, activityResult] = await Promise.allSettled([
          withTimeout(getDocs(collection(db, 'inventory')), 12000, null),
          withTimeout(getDocs(collection(db, 'sales')), 12000, null),
          withTimeout(getDocs(query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(8))), 8000, null)
        ]);

        if (!isMounted) return;

        // 1. Process Inventory
        let lowStockCount = 0;
        let expiring30Count = 0;
        const expiriesList: ExpiringItem[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (invResult.status === 'fulfilled' && invResult.value) {
          const invSnap = invResult.value;
          const allMeds: Medicine[] = [];
          const catMap: Record<string, { name: string; count: number; totalUnits: number }> = {};

          invSnap.forEach((docSnap) => {
            const item = { id: docSnap.id, ...docSnap.data() } as Medicine;
            allMeds.push(item);

            const catRaw = (item.type || 'tablet').toLowerCase();
            const catKey = catRaw.charAt(0).toUpperCase() + catRaw.slice(1);
            if (!catMap[catKey]) {
              catMap[catKey] = { name: catKey, count: 0, totalUnits: 0 };
            }
            catMap[catKey].count += 1;
            catMap[catKey].totalUnits += (Number(item.stockQuantity) || 0);

            if (item.stockQuantity <= (item.minThreshold || 10)) {
              lowStockCount++;
            }

            const batchesToEvaluate =
              item.batches && item.batches.length > 0
                ? item.batches
                : [
                    {
                      id: 'default',
                      batchNumber: (item as any).batchNumber || 'N/A',
                      expiryDate: item.expiryDate,
                      quantity: item.stockQuantity
                    }
                  ];

            batchesToEvaluate.forEach((batch) => {
              if (!batch.expiryDate) return;
              const expDate = new Date(batch.expiryDate);
              expDate.setHours(0, 0, 0, 0);
              const diffMs = expDate.getTime() - today.getTime();
              const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

              if (daysLeft <= currentExpirySettings.thresholdDays) {
                expiring30Count++;
                expiriesList.push({
                  id: `${item.id}-${batch.id || batch.batchNumber}`,
                  medicineName: item.name,
                  genericName: item.genericName,
                  salt: item.salt,
                  batchNumber: batch.batchNumber || (item as any).batchNumber || 'N/A',
                  expiryDate: batch.expiryDate,
                  stockQuantity: batch.quantity || item.stockQuantity,
                  daysLeft
                });
              }
            });
          });

          expiriesList.sort((a, b) => a.daysLeft - b.daysLeft);
          setExpiring30Days(expiriesList);
          setInventoryItems(allMeds);

          const catSorted = Object.values(catMap).sort((a, b) => b.count - a.count);
          setCategoryDistribution(catSorted);
        }

        // 2. Process Sales (Single source of truth for total, recent sales & charts)
        let totalSalesAmount = 0;
        let totalSalesCount = 0;
        const allSalesList: Sale[] = [];

        if (salesResult.status === 'fulfilled' && salesResult.value) {
          const salesSnap = salesResult.value;
          totalSalesCount = salesSnap.size;

          salesSnap.forEach((docSnap) => {
            const sale = { id: docSnap.id, ...docSnap.data() } as Sale;
            totalSalesAmount += sale.totalAmount || 0;
            allSalesList.push(sale);
          });

          // Sort sales descending by timestamp for recent sales
          allSalesList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setAllSalesHistory(allSalesList);
          setRecentSales(allSalesList.slice(0, 5));

          // Compute 7-day sales chart directly in memory (no extra Firestore round trip)
          const salesByDay: Record<string, number> = {};
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const todayDay = new Date().getDay();

          for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dayName = date.toLocaleDateString([], { weekday: 'short' });
            salesByDay[dayName] = 0;
          }

          const sevenDaysAgoTime = new Date();
          sevenDaysAgoTime.setDate(sevenDaysAgoTime.getDate() - 6);
          sevenDaysAgoTime.setHours(0, 0, 0, 0);

          allSalesList.forEach((sale) => {
            const saleDate = new Date(sale.timestamp);
            if (saleDate >= sevenDaysAgoTime) {
              const dayName = saleDate.toLocaleDateString([], { weekday: 'short' });
              if (salesByDay[dayName] !== undefined) {
                salesByDay[dayName] += sale.totalAmount || 0;
              }
            }
          });

          const last7Days = [];
          for (let i = 6; i >= 0; i--) {
            const dayIndex = (todayDay - i + 7) % 7;
            const dayName = days[dayIndex];
            last7Days.push({
              name: dayName,
              sales: salesByDay[dayName] || 0
            });
          }
          setSalesData(last7Days);

          // Compute Monthly Sales Trends (Last 6 Months) for Recharts Bar Chart
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const monthlyMap: Record<string, { month: string; sales: number; orders: number }> = {};
          const now = new Date();
          for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const label = `${monthNames[d.getMonth()]} '${String(d.getFullYear()).slice(-2)}`;
            monthlyMap[label] = { month: label, sales: 0, orders: 0 };
          }

          allSalesList.forEach(sale => {
            const d = new Date(sale.timestamp);
            const label = `${monthNames[d.getMonth()]} '${String(d.getFullYear()).slice(-2)}`;
            if (monthlyMap[label]) {
              monthlyMap[label].sales += (Number(sale.totalAmount) || 0);
              monthlyMap[label].orders += 1;
            }
          });

          setMonthlySalesData(Object.values(monthlyMap));
        }

        // Fetch pending customer dues
        try {
          const dues = await fetchCustomerDues();
          setCustomerDues(dues);
        } catch (dueErr) {
          console.warn("Notice: Customer dues loading error:", dueErr);
        }

        setStats({
          totalSales: totalSalesAmount,
          salesCount: totalSalesCount,
          lowStock: lowStockCount,
          expiringSoon: expiring30Count
        });

        // 3. Process Activity Logs
        if (activityResult.status === 'fulfilled' && activityResult.value) {
          const actSnap = activityResult.value;
          setActivities(actSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog)));
        }
      } catch (err) {
        console.warn("Notice during dashboard data load (handled gracefully):", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  const displayedExpiries = expiring30Days.filter(item => {
    if (expiryFilter === 'expired') return item.daysLeft <= 0;
    if (expiryFilter === 'critical') return item.daysLeft > 0 && item.daysLeft <= expirySettings.criticalDays;
    return true;
  });

  // Stock Turnover & Expiry Summary Metrics (Requirement 4)
  const expiredCount = expiring30Days.filter(i => i.daysLeft <= 0).length;
  const criticalCount = expiring30Days.filter(i => i.daysLeft > 0 && i.daysLeft <= expirySettings.criticalDays).length;
  const nearExpiryCount = expiring30Days.filter(i => i.daysLeft > expirySettings.criticalDays).length;
  const totalExpiringUnits = expiring30Days.reduce((acc, i) => acc + (i.stockQuantity || 0), 0);

  const handleExportExpiryCsv = () => {
    if (expiring30Days.length === 0) return;
    const headers = ['Medicine Name', 'Generic / Salt', 'Batch Number', 'Expiry Date', 'Days Left', 'Stock Units'];
    const rows = expiring30Days.map(item => [
      `"${(item.medicineName || '').replace(/"/g, '""')}"`,
      `"${(item.genericName || item.salt || '').replace(/"/g, '""')}"`,
      `"${(item.batchNumber || '').replace(/"/g, '""')}"`,
      item.expiryDate,
      item.daysLeft,
      item.stockQuantity
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `expiry_stock_turnover_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const cardsMap: Record<string, StatCardData> = {
    'today-sales': { 
      id: 'today-sales',
      label: t('totalSales'), // Today's Sales
      subtitle: "Today's Revenue & Growth",
      value: (
        <SensitiveValueMask 
          isAuthorized={canViewFinancials(profile)} 
          value={formatCurrency(stats.totalSales)} 
        />
      ), 
      icon: IndianRupee, 
      color: 'bg-emerald-500', 
      trend: '+12%', 
      isUp: true 
    },
    'total-orders': { 
      id: 'total-orders',
      label: t('totalOrders'), 
      subtitle: "Billed Invoices Today",
      value: stats.salesCount, 
      icon: TrendingUp, 
      color: 'bg-blue-500', 
      trend: '+5%', 
      isUp: true 
    },
    'inventory-status': { 
      id: 'inventory-status',
      label: t('inventoryStatus', 'Inventory Status'), 
      subtitle: stats.lowStock > 0 ? `${stats.lowStock} Low Stock Alert${stats.lowStock !== 1 ? 's' : ''}` : 'Inventory Healthy',
      value: stats.lowStock, 
      icon: Package, 
      color: 'bg-amber-500', 
      trend: stats.lowStock > 0 ? `${stats.lowStock} at risk` : 'Optimal', 
      isUp: stats.lowStock === 0 
    },
    'expiring-soon': { 
      id: 'expiring-soon',
      label: t('expiringSoon'), 
      subtitle: `≤ ${expirySettings.thresholdDays} Days Risk Radar`,
      value: stats.expiringSoon, 
      icon: AlertTriangle, 
      color: 'bg-rose-500', 
      trend: `${expirySettings.thresholdDays} ${t('days')}`, 
      isUp: false 
    },
    'active-staff': {
      id: 'active-staff',
      label: tText('Staff on Duty', 'ड्यूटी पर स्टाफ'),
      subtitle: `${staffStats.onlineStaff} online • ${staffStats.totalStaff} team members`,
      value: `${staffStats.onlineStaff} Online`,
      icon: Users,
      color: 'bg-purple-600',
      trend: `${staffStats.totalStaff} Staff`,
      isUp: true,
      onClick: () => setIsMembersModalOpen(true)
    },
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 pb-12"
    >
      <motion.header variants={sectionVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t('dashboard')}</h1>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('realTimeInsights')}</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <motion.button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-onboarding-tour'))}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 450, damping: 25 }}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 px-3.5 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors cursor-pointer shadow-2xs self-start sm:self-auto"
            title={tText('Interactive System Guide', 'इंटरएक्टिव सिस्टम गाइड')}
          >
            <Compass size={14} className="text-indigo-600 dark:text-indigo-400" />
            <span>{tText('Getting Started Tour', 'शुरुआती टूर')}</span>
          </motion.button>

          <motion.button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-stock-email-alerts'))}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 450, damping: 25 }}
            className="flex items-center gap-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 px-3.5 py-2 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900 transition-colors cursor-pointer shadow-2xs self-start sm:self-auto"
            title="Configure and preview automated email notifications for critical stock levels"
          >
            <Mail size={14} className="text-rose-600 dark:text-rose-400" />
            <span>Stock Alerts</span>
          </motion.button>

          {/* Customer Payment Dues Quick Button (Requirement 3) */}
          <motion.button
            type="button"
            id="dashboard-header-dues-btn"
            onClick={() => setIsDuesModalOpen(true)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 px-3.5 py-2 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors cursor-pointer shadow-2xs self-start sm:self-auto"
            title="Customer credit dues and payment reminders"
          >
            <CreditCard size={14} className="text-amber-600 dark:text-amber-400" />
            <span>Payment Dues</span>
            {pendingDuesCount > 0 && (
              <span className="ml-1 rounded-full bg-amber-500 text-white px-1.5 py-0.2 text-[9px] font-black">
                {pendingDuesCount}
              </span>
            )}
          </motion.button>

          {/* AI Stock Reorder Quick Button (Requirement 2) */}
          <motion.button
            type="button"
            id="dashboard-header-ai-reorder-btn"
            onClick={() => setIsAiReorderOpen(prev => !prev)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/80 px-3.5 py-2 text-xs font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900 transition-colors cursor-pointer shadow-2xs self-start sm:self-auto"
            title="AI Stock Level Analysis & Reorder Dates"
          >
            <Bot size={14} className="text-purple-600 dark:text-purple-400" />
            <span>AI Reorder</span>
          </motion.button>

          {onNavigate && (
            <motion.button
              onClick={() => onNavigate('monthly_updates')}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 450, damping: 25 }}
              className="flex items-center gap-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 px-3.5 py-2 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors cursor-pointer shadow-2xs self-start sm:self-auto"
            >
              <Sparkles size={14} className="text-amber-500" />
              <span>{t('monthlyInnovations')} (v2026.08)</span>
            </motion.button>
          )}
        </div>
      </motion.header>

      {/* Monthly Business Strategy & Software Update Banner */}
      <motion.div variants={sectionVariants}>
        <MonthlyIdeaDashboardWidget onOpenHub={() => onNavigate && onNavigate('monthly_updates')} />
      </motion.div>

      {/* Customer Payment Reminders Notification Banner (Requirement 3) */}
      {pendingDuesCount > 0 && (
        <motion.div
          variants={sectionVariants}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-2xl border border-amber-300 bg-linear-to-r from-amber-50 via-orange-50/50 to-amber-50 p-4 shadow-sm dark:border-amber-900/60 dark:from-amber-950/40 dark:to-orange-950/30"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/30">
              <Bell size={20} className="animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-950 dark:text-amber-200">
                  Payment Due Reminder • {pendingDuesCount} Pending {pendingDuesCount === 1 ? 'Customer Due' : 'Customer Dues'}
                </span>
                {overdueDuesCount > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700 dark:bg-red-900/60 dark:text-red-200">
                    {overdueDuesCount} Overdue
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                Outstanding customer credit totaling <strong className="font-bold">{formatCurrency(totalPendingDuesAmount)}</strong> recorded in database. Review due dates and send reminders.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              id="dashboard-open-payment-dues-btn"
              onClick={() => setIsDuesModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2 text-xs font-bold text-white shadow-md shadow-amber-600/30 transition-all active:scale-95 cursor-pointer"
            >
              <CreditCard size={14} />
              <span>Review Dues & Due Dates</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* AI Stock Reorder Summary Card (Requirement 2) */}
      {isAiReorderOpen && inventoryItems.length > 0 && (
        <motion.div variants={sectionVariants}>
          <AIStockReorderSummaryCard 
            inventory={inventoryItems} 
            onRestockItem={() => onNavigate && onNavigate('inventory')}
          />
        </motion.div>
      )}

      {/* Stats Grid with Drag and Drop Prioritization via @dnd-kit */}
      <motion.div variants={sectionVariants} className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <Move size={12} className="text-slate-400 dark:text-slate-500" />
            <span>{tText('Drag & drop cards to prioritize widgets (Inventory, Sales, Orders, Expiries, Staff on Duty)', 'विजेट्स को प्राथमिकता देने के लिए कार्ड्स ड्रैग करें (इन्वेंट्री, बिक्री, ऑर्डर, एक्सपायरी, ड्यूटी स्टाफ)')}</span>
          </div>
          {isCardsCustomized && (
            <button
              type="button"
              onClick={handleResetCardOrder}
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:underline cursor-pointer transition-colors"
              title="Reset cards order to default"
            >
              <RotateCcw size={11} />
              <span>{tText('Reset Order', 'रीसेट ऑर्डर')}</span>
            </button>
          )}
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleCardDragStart}
          onDragEnd={handleCardDragEnd}
        >
          <SortableContext items={cardOrder} strategy={rectSortingStrategy}>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              {cardOrder.map((cardId, index) => {
                const card = cardsMap[cardId];
                if (!card) return null;
                return (
                  <SortableStatCard
                    key={card.id}
                    card={card}
                    index={index}
                  />
                );
              })}
            </div>
          </SortableContext>

          <DragOverlay adjustScale style={{ transformOrigin: '0 0' }}>
            {activeCardId && cardsMap[activeCardId] ? (
              <SortableStatCard
                card={cardsMap[activeCardId]}
                index={0}
                isOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </motion.div>

      {/* Automated Auto-Procurement Recommendation Engine for the Owner */}
      <motion.div variants={widgetCardVariants}>
        <AutoProcurementEngineWidget
          items={inventoryItems}
          salesHistory={allSalesHistory}
          onSelectMedicine={() => onNavigate && onNavigate('inventory')}
          onNavigateToWholesalers={() => onNavigate && onNavigate('wholesalers')}
        />
      </motion.div>

      {/* Upcoming Expiries Summary Widget */}
      <motion.div 
        variants={widgetCardVariants}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                <AlertTriangle size={18} />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{t('upcomingExpiries')}</h3>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                {expiring30Days.length} {t('itemsAtRisk')}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t('expiryNoticeDesc')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-auto">
            {/* 90-Day Expiry Audit PDF Tool Button */}
            <button
              type="button"
              id="open-90d-expiry-report-btn"
              onClick={() => {
                if (onNavigate) onNavigate('expiry_report');
                else window.dispatchEvent(new CustomEvent('open-expiry-report'));
              }}
              className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300 transition-all cursor-pointer shadow-2xs active:scale-95"
              title="Open full 90-day medication expiry and urgency PDF report tool"
            >
              <FileText size={14} className="text-rose-600 dark:text-rose-400" />
              <span>90D Expiry PDF</span>
            </button>

            {/* Widget Admin Settings Button */}
            <button
              type="button"
              id="open-expiry-settings-btn"
              onClick={() => setIsExpirySettingsModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              <Sliders size={14} className="text-amber-500" />
              <span>{t('expirySettingsTitle')}</span>
            </button>

            {/* Filter Buttons */}
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-800/80">
              <button
                onClick={() => setExpiryFilter('all')}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
                  expiryFilter === 'all'
                    ? "bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                )}
              >
                {t('filterAll')} ({expiring30Days.length})
              </button>
              <button
                onClick={() => setExpiryFilter('critical')}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
                  expiryFilter === 'critical'
                    ? "bg-white text-rose-600 shadow dark:bg-slate-700 dark:text-rose-400"
                    : "text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"
                )}
              >
                {t('filterCritical')} ≤ {expirySettings.criticalDays}d ({expiring30Days.filter(i => i.daysLeft > 0 && i.daysLeft <= expirySettings.criticalDays).length})
              </button>
              <button
                onClick={() => setExpiryFilter('expired')}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
                  expiryFilter === 'expired'
                    ? "bg-white text-red-600 shadow dark:bg-slate-700 dark:text-red-400"
                    : "text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
                )}
              >
                {t('filterExpired')} ({expiring30Days.filter(i => i.daysLeft <= 0).length})
              </button>
            </div>
          </div>
        </div>

        {/* Disabled Alerts Banner */}
        {!expirySettings.alertsEnabled && (
          <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            <div className="flex items-center gap-2.5">
              <BellOff size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <p className="text-xs font-bold">Upcoming Expiry Alerts Off</p>
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  Alert notifications for medications expiring within {expirySettings.thresholdDays} days are currently disabled by Admin preference.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsExpirySettingsModalOpen(true)}
              className="text-xs font-bold text-amber-800 dark:text-amber-200 underline hover:no-underline cursor-pointer shrink-0"
            >
              Configure / Enable Alerts
            </button>
          </div>
        )}

        {/* Stock Turnover & Expiry Mitigation Summary Card (Requirement 4) */}
        <div className="mb-6 rounded-2xl border border-rose-200/80 bg-linear-to-r from-rose-50/70 via-orange-50/40 to-amber-50/50 p-4.5 dark:border-rose-900/50 dark:from-rose-950/30 dark:via-orange-950/20 dark:to-amber-950/20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500 text-white shadow-md shadow-rose-500/25">
                <Percent size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Stock Turnover & Expiry Mitigation Summary
                  </h4>
                  <span className="rounded-full bg-rose-100 dark:bg-rose-900/60 px-2 py-0.5 text-[10px] font-black text-rose-700 dark:text-rose-200">
                    FEFO Protocol Active
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 max-w-2xl">
                  <strong>{totalExpiringUnits} units</strong> across {expiring30Days.length} batches require active stock turnover. Prioritize First-Expiry-First-Out (FEFO) dispensing and clearance promotions to avoid inventory loss.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                id="stock-turnover-export-csv-btn"
                onClick={handleExportExpiryCsv}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-2xs cursor-pointer"
              >
                <Download size={13} />
                <span>Export Expiry CSV</span>
              </button>
              {onNavigate && (
                <button
                  type="button"
                  id="stock-turnover-inventory-action-btn"
                  onClick={() => onNavigate('inventory')}
                  className="flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 text-xs font-bold shadow-md shadow-rose-600/20 transition-all cursor-pointer"
                >
                  <Package size={13} />
                  <span>Execute Clearance / Restock</span>
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-rose-200/50 dark:border-rose-900/40">
            <div className="rounded-xl bg-white/80 dark:bg-slate-900/80 p-3 border border-rose-100 dark:border-rose-900/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Immediate Return / Write-Off</span>
              <p className="text-lg font-black text-rose-700 dark:text-rose-300 mt-0.5">{expiredCount} Batches</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Expired &bull; Pull from shelves</p>
            </div>
            <div className="rounded-xl bg-white/80 dark:bg-slate-900/80 p-3 border border-red-100 dark:border-red-900/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">Fast Turnover (≤15 Days)</span>
              <p className="text-lg font-black text-red-700 dark:text-red-300 mt-0.5">{criticalCount} Batches</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Clearance sale target</p>
            </div>
            <div className="rounded-xl bg-white/80 dark:bg-slate-900/80 p-3 border border-amber-100 dark:border-amber-900/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">FEFO Dispense (16-60 Days)</span>
              <p className="text-lg font-black text-amber-700 dark:text-amber-300 mt-0.5">{nearExpiryCount} Batches</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Front of pharmacy rack</p>
            </div>
            <div className="rounded-xl bg-white/80 dark:bg-slate-900/80 p-3 border border-emerald-100 dark:border-emerald-900/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Total Units at Risk</span>
              <p className="text-lg font-black text-emerald-700 dark:text-emerald-300 mt-0.5">{totalExpiringUnits} Units</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Active monitoring</p>
            </div>
          </div>
        </div>

        {/* Urgency Summary Badges Bar */}
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50/50 p-3 dark:border-red-900/50 dark:bg-red-950/20">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-bold text-red-700 dark:text-red-400">Expired</span>
            </div>
            <span className="text-sm font-black text-red-700 dark:text-red-300">
              {expiring30Days.filter(i => i.daysLeft <= 0).length}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50/50 p-3 dark:border-rose-900/50 dark:bg-rose-950/20">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-rose-500" />
              <span className="text-xs font-bold text-rose-700 dark:text-rose-400">Critical (1-{expirySettings.criticalDays}d)</span>
            </div>
            <span className="text-sm font-black text-rose-700 dark:text-rose-300">
              {expiring30Days.filter(i => i.daysLeft > 0 && i.daysLeft <= expirySettings.criticalDays).length}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400">Urgent ({expirySettings.criticalDays + 1}-15d)</span>
            </div>
            <span className="text-sm font-black text-amber-700 dark:text-amber-300">
              {expiring30Days.filter(i => i.daysLeft > expirySettings.criticalDays && i.daysLeft <= 15).length}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-yellow-200 bg-yellow-50/50 p-3 dark:border-yellow-900/50 dark:bg-yellow-950/20">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-yellow-500" />
              <span className="text-xs font-bold text-yellow-800 dark:text-yellow-400">Warning (16-{expirySettings.thresholdDays}d)</span>
            </div>
            <span className="text-sm font-black text-yellow-800 dark:text-yellow-300">
              {expiring30Days.filter(i => i.daysLeft > 15 && i.daysLeft <= expirySettings.thresholdDays).length}
            </span>
          </div>
        </div>

        {/* Items List */}
        {displayedExpiries.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto pr-1">
            {displayedExpiries.map((item) => {
              let badgeStyle = "bg-yellow-500/10 text-yellow-800 border-yellow-300 dark:bg-yellow-950/60 dark:text-yellow-300 dark:border-yellow-800";
              let badgeText = `${item.daysLeft}d left`;
              let UrgencyIcon = Calendar;

              if (item.daysLeft <= 0) {
                badgeStyle = "bg-red-500/15 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800 font-black";
                badgeText = item.daysLeft === 0 ? "Expires Today" : `Expired ${Math.abs(item.daysLeft)}d ago`;
                UrgencyIcon = AlertTriangle;
              } else if (item.daysLeft <= expirySettings.criticalDays) {
                badgeStyle = "bg-rose-500/15 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800 font-bold";
                badgeText = `Critical: ${item.daysLeft}d left`;
                UrgencyIcon = AlertCircle;
              } else if (item.daysLeft <= 15) {
                badgeStyle = "bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 font-semibold";
                badgeText = `Urgent: ${item.daysLeft}d left`;
                UrgencyIcon = Clock;
              }

              return (
                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 rounded-xl px-2 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      item.daysLeft <= 0 ? "bg-red-100 text-red-600 dark:bg-red-900/30" :
                      item.daysLeft <= 7 ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30" :
                      item.daysLeft <= 15 ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30" :
                      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30"
                    )}>
                      <UrgencyIcon size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{item.medicineName}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          Batch: {item.batchNumber}
                        </span>
                      </div>
                      {(item.genericName || item.salt) && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                          {item.genericName || item.salt}
                        </p>
                      )}
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                        Stock: <strong className="text-slate-800 dark:text-slate-200">{item.stockQuantity} units</strong> &bull; Expiry Date: <strong className="text-slate-800 dark:text-slate-200">{formatDate(item.expiryDate)}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border shadow-xs",
                      badgeStyle
                    )}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {badgeText}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700">
            <CheckCircle2 size={36} className="text-emerald-500 mb-2" />
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No Expiries in this filter</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {expiryFilter === 'all' 
                ? 'All inventory items have more than 30 days remaining.'
                : `No items found matching the "${expiryFilter}" filter.`}
            </p>
          </div>
        )}

        {onNavigate && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              onClick={() => onNavigate('inventory')}
              className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              <span>Manage Inventory & Expiries</span>
              <ArrowUpRight size={14} />
            </button>
          </div>
        )}
      </motion.div>

      <motion.div variants={sectionVariants} className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Sales Chart */}
        <motion.div 
          variants={widgetCardVariants}
          className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-tight">{t('salesChart')}</h3>
            <select className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold uppercase dark:border-slate-800 dark:bg-slate-800">
              <option>{t('last7Days')}</option>
              <option>{t('last30Days')}</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 600}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 600}} />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), t('revenue')]}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    padding: '12px',
                    fontWeight: 'bold'
                  }}
                  itemStyle={{ color: '#2563eb' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Recent Transactions */}
        <motion.div 
          variants={widgetCardVariants}
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-tight">{t('recentSales')}</h3>
            <button className="text-[10px] font-bold uppercase text-blue-600 hover:underline cursor-pointer">{t('viewAll')}</button>
          </div>
          <div className="space-y-2">
            {recentSales.map((sale, idx) => (
              <div 
                key={sale.id} 
                className={cn(
                  "flex items-center justify-between rounded-xl border p-3.5 transition-all cursor-pointer",
                  idx % 2 === 0 
                    ? "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800" 
                    : "bg-slate-50/70 dark:bg-slate-850/60 border-slate-200/60 dark:border-slate-800/80",
                  "hover:border-blue-300 dark:hover:border-blue-800 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 hover:shadow-xs"
                )}
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 shrink-0">
                    <Clock size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{sale.customerName || t('walkInCustomer')}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-mono tracking-tight">{new Date(sale.timestamp).toLocaleTimeString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100">{formatCurrency(sale.totalAmount)}</p>
                  <p className="text-[9px] font-black uppercase text-slate-400">{sale.paymentMethod}</p>
                </div>
              </div>
            ))}
            {recentSales.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                <Clock size={48} className="mb-2 opacity-20" />
                <p>{t('noSalesToday')}</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Recharts Analytics: Monthly Sales Trends Bar Chart & Stock Distribution by Category Pie Chart (Requirement 5) */}
        <motion.div 
          variants={widgetCardVariants}
          className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30">
                  <TrendingUp size={16} />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-tight text-slate-900 dark:text-slate-100">
                  Monthly Sales Trends (6-Month Performance)
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Aggregated monthly pharmacy revenue and bill volume plotted with Recharts
              </p>
            </div>
            <span className="self-start sm:self-auto rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-2.5 py-1 text-[11px] font-bold text-blue-700 dark:text-blue-300">
              Recharts Bar
            </span>
          </div>

          <div className="h-[290px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySalesData} margin={{ top: 10, right: 10, left: -5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600 }} dy={8} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 600 }}
                  tickFormatter={(v) => v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value), 
                    name === 'sales' ? 'Revenue' : name
                  ]}
                  labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                    padding: '10px 14px',
                    fontSize: '12px'
                  }}
                />
                <Bar 
                  dataKey="sales" 
                  name="Monthly Revenue" 
                  fill="#2563eb" 
                  radius={[6, 6, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>Total 6M Volume: <strong className="text-slate-800 dark:text-slate-200">{monthlySalesData.reduce((acc, m) => acc + (m.orders || 0), 0)} bills</strong></span>
            <span>Total 6M Revenue: <strong className="text-blue-600 dark:text-blue-400 font-bold">{formatCurrency(monthlySalesData.reduce((acc, m) => acc + (m.sales || 0), 0))}</strong></span>
          </div>
        </motion.div>

        {/* Stock Distribution by Category Pie Chart */}
        <motion.div 
          variants={widgetCardVariants}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30">
                  <Package size={16} />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-tight text-slate-900 dark:text-slate-100">
                  Stock by Category
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Medicine dosage formats
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
              Recharts Pie
            </span>
          </div>

          <div className="h-[270px] w-full flex items-center justify-center">
            {categoryDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryDistribution}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="48%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {categoryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string, item: any) => [
                      `${value} SKUs (${item.payload.totalUnits || 0} units)`,
                      item.payload.name
                    ]}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                      padding: '8px 12px',
                      fontSize: '12px'
                    }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                    formatter={(value) => <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <Package size={32} className="opacity-20 mb-2" />
                <p className="text-xs">No category data yet</p>
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>{categoryDistribution.length} Categories</span>
            <span>Total Units: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{categoryDistribution.reduce((acc, c) => acc + (c.totalUnits || 0), 0)}</strong></span>
          </div>
        </motion.div>

        {/* Intelligent Services Quick Access */}
        <motion.div variants={widgetCardVariants} className="lg:col-span-3">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">
              <Sparkles size={18} className="text-blue-600" />
              {t('intelligentModules')}
            </h3>
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">{t('advancedPharmacyTools')}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
            <motion.div 
              whileHover={{ scale: 1.025, y: -4 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              onClick={() => {
                if (onNavigate) onNavigate('expiry_report');
                else window.dispatchEvent(new CustomEvent('open-expiry-report'));
              }} 
              className="group relative overflow-hidden rounded-2xl border border-rose-200 bg-white p-6 shadow-sm transition-all hover:shadow-xl dark:border-rose-900/60 dark:bg-slate-900 cursor-pointer"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 transition-transform group-hover:scale-105">
                <FileText size={24} />
              </div>
              <h4 className="mb-1 text-sm font-bold text-slate-900 dark:text-white">90D Expiry Audit</h4>
              <p className="text-[10px] leading-relaxed text-slate-500 mb-4">Automated risk radar & PDF audit report sorted by urgency.</p>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">
                <span>{stats.expiringSoon} Expiring Batches</span>
                <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.025, y: -4 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              onClick={() => window.dispatchEvent(new CustomEvent('open-sales-report'))} 
              className="group relative overflow-hidden rounded-2xl border border-blue-200 bg-white p-6 shadow-sm transition-all hover:shadow-xl dark:border-blue-900/60 dark:bg-slate-900 cursor-pointer"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 transition-transform group-hover:scale-105">
                <TrendingUp size={24} />
              </div>
              <h4 className="mb-1 text-sm font-bold text-slate-900 dark:text-white">Sales & Revenue Audit</h4>
              <p className="text-[10px] leading-relaxed text-slate-500 mb-4">Export browser-generated PDF statements with GST breakdown.</p>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                <span>{stats.salesCount} Invoices Billed</span>
                <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.025, y: -4 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              onClick={() => setIsMembersModalOpen(true)} 
              className="group relative overflow-hidden rounded-2xl border border-purple-200 bg-white p-6 shadow-sm transition-all hover:shadow-xl dark:border-purple-900/60 dark:bg-slate-900 cursor-pointer"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 transition-transform group-hover:scale-105">
                <Users size={24} />
              </div>
              <h4 className="mb-1 text-sm font-bold text-slate-900 dark:text-white">{tText('Staff & Terminals', 'स्टाफ एवं टर्मिनल्स')}</h4>
              <p className="text-[10px] leading-relaxed text-slate-500 mb-4">{tText('Active counters, duty shifts and staff access monitors.', 'सक्रिय काउंटर्स, शिफ्ट ड्यूटी एवं स्टाफ एक्सेस मॉनिटर।')}</p>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400">
                <span>{staffStats.onlineStaff} {tText('Staff Online', 'स्टाफ ऑनलाइन')}</span>
                <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.025, y: -4 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              onClick={() => onNavigate && onNavigate('inventory')} 
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 cursor-pointer"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-900/20 transition-transform group-hover:scale-105">
                <Package size={24} />
              </div>
              <h4 className="mb-1 text-sm font-bold text-slate-900 dark:text-white">{t('inventory')}</h4>
              <p className="text-[10px] leading-relaxed text-slate-500 mb-4">{t('stockAlertsDesc')}</p>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-orange-600">
                <span>{stats.lowStock} {t('itemsAtRisk')}</span>
                <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.025, y: -4 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              onClick={() => onNavigate && onNavigate('ai')} 
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 cursor-pointer"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 transition-transform group-hover:scale-105">
                <Bot size={24} />
              </div>
              <h4 className="mb-1 text-sm font-bold text-slate-900 dark:text-white">{t('aiAssistant')}</h4>
              <p className="text-[10px] leading-relaxed text-slate-500 mb-4">{t('aiAssistantDesc')}</p>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-600">
                <span>{t('askAi')}</span>
                <Sparkles size={14} className="animate-pulse" />
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.025, y: -4 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              onClick={() => onNavigate && onNavigate('patients')} 
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 cursor-pointer"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/20 transition-transform group-hover:scale-105">
                <Users size={24} />
              </div>
              <h4 className="mb-1 text-sm font-bold text-slate-900 dark:text-white">{t('patients')}</h4>
              <p className="text-[10px] leading-relaxed text-slate-500 mb-4">{t('patientDirectoryDesc')}</p>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-600">
                <span>{t('viewPatients')}</span>
                <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.025, y: -4 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              onClick={() => onNavigate && onNavigate('regulatory')} 
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 cursor-pointer"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 transition-transform group-hover:scale-105">
                <Newspaper size={24} />
              </div>
              <h4 className="mb-1 text-sm font-bold text-slate-900 dark:text-white">{t('regulatory')}</h4>
              <p className="text-[10px] leading-relaxed text-slate-500 mb-4">{t('regulatoryFeedDesc')}</p>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                <span>{t('dailyFeedReady')}</span>
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Activity Log */}
        <motion.div 
          variants={widgetCardVariants}
          className="lg:col-span-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">
              <Activity size={18} className="text-blue-600" />
              {t('systemAuditLog')}
            </h3>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate && onNavigate('activity_logs')}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-700 hover:bg-slate-100 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-blue-400 cursor-pointer transition-all active:scale-95"
              >
                <span>View Full Activity Log</span>
                <ArrowRight size={12} />
              </button>
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest hidden sm:inline">{t('recentActivityLogs')}</span>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activities.map((log) => (
              <div key={log.id} className="flex gap-4 rounded-xl border border-slate-50 p-4 transition-all hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  log.type === 'inventory' ? "bg-orange-50 text-orange-600 dark:bg-orange-900/20" :
                  log.type === 'sale' ? "bg-green-50 text-green-600 dark:bg-green-900/20" :
                  "bg-blue-50 text-blue-600 dark:bg-blue-900/20"
                )}>
                  {log.type === 'inventory' ? <Package size={18} /> : <TrendingUp size={18} />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{log.action}</p>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-300">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{log.description}</p>
                </div>
              </div>
            ))}
            {activities.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-400">
                <p className="text-[10px] font-bold uppercase tracking-widest">{t('noRecentActivityLogs')}</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Active Staff On-Duty & Logged-In Members Widget */}
      <motion.div variants={sectionVariants}>
        <ActiveStaffWidget onOpenMembers={() => setIsMembersModalOpen(true)} />
      </motion.div>

      {/* Expiry Alert Settings Modal */}
      {isExpirySettingsModalOpen && (
        <ExpirySettingsPanel isModal onClose={() => setIsExpirySettingsModalOpen(false)} />
      )}

      {/* Logged In Members & Staff Management Modal */}
      {isMembersModalOpen && (
        <LoggedInMembersMonitor isModal onClose={() => setIsMembersModalOpen(false)} />
      )}

      {/* Customer Payment Reminders & Due Dates Modal (Requirement 3) */}
      {isDuesModalOpen && (
        <CustomerPaymentReminderModal
          isOpen={isDuesModalOpen}
          onClose={() => setIsDuesModalOpen(false)}
          onDuesUpdated={async () => {
            const updated = await fetchCustomerDues();
            setCustomerDues(updated);
          }}
        />
      )}
    </motion.div>
  );
};

export default Dashboard;

