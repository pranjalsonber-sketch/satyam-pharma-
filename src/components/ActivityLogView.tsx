import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  getDocs,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from './AuthProvider';
import { ActivityLog, FieldDiff, InventoryItemAuditDiff, Medicine } from '../types';
import { formatDate, formatCurrency, cn } from '../lib/utils';
import { logActivity } from '../lib/logger';
import { StockMovementAuditView } from './StockMovementAuditView';
import { 
  History, 
  Search, 
  Filter, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  RefreshCw, 
  Calendar, 
  User, 
  ShoppingCart, 
  Package, 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  X, 
  ChevronRight, 
  ChevronDown, 
  Trash2, 
  Layers, 
  Sliders, 
  Eye, 
  ArrowUpRight, 
  Tag, 
  Clock, 
  Building2, 
  Users, 
  Sparkles,
  TrendingDown,
  TrendingUp,
  ArrowRight,
  ShieldAlert,
  SlidersHorizontal,
  Copy,
  Check,
  BarChart3,
  MapPin,
  FileCheck,
  AlertOctagon,
  ListOrdered
} from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ActivityLogViewProps {
  isModal?: boolean;
  onClose?: () => void;
  initialModuleFilter?: string;
}

type TimeFilterOption = 'all' | 'today' | '24h' | '7d' | '30d';

interface ExtractedDiff {
  field: string;
  label: string;
  oldValue: any;
  newValue: any;
  delta?: string | number;
  unit?: string;
  isShrinkage?: boolean;
}

interface ExtractedShrinkage {
  isShrinkage: boolean;
  unitsLost: number;
  lossValuation: number;
  reason?: string;
  reasonCode?: string;
}

export const ActivityLogView: React.FC<ActivityLogViewProps> = ({
  isModal = false,
  onClose,
  initialModuleFilter
}) => {
  const { t, isHindi } = useLanguage();
  const { profile } = useAuth();

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>(initialModuleFilter || 'all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilterOption>('all');
  const [selectedLogDetail, setSelectedLogDetail] = useState<ActivityLog | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isClearingLogs, setIsClearingLogs] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
  const [shrinkageOnlyFilter, setShrinkageOnlyFilter] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [auditSection, setAuditSection] = useState<'system_activity' | 'stock_movements'>('system_activity');
  const [medicines, setMedicines] = useState<Medicine[]>([]);

  const fetchMedicinesForAudit = async () => {
    try {
      const snap = await getDocs(collection(db, 'inventory'));
      setMedicines(snap.docs.map(d => ({ id: d.id, ...d.data() } as Medicine)));
    } catch (e) {
      console.warn("Notice loading medicines for stock audit:", e);
    }
  };

  useEffect(() => {
    fetchMedicinesForAudit();
  }, []);

  const isAdmin = profile?.role === 'admin';

  // Helper to extract and normalize granular diffs from any log record
  const extractDiffsFromLog = (log: ActivityLog): ExtractedDiff[] => {
    const details = log.details || {};
    const diffs: ExtractedDiff[] = [];

    // 1. Explicit `changes` array (from Inventory.tsx single updates)
    if (Array.isArray(details.changes) && details.changes.length > 0) {
      return details.changes.map((c: any) => ({
        field: c.field || 'field',
        label: c.label || c.field || 'Attribute',
        oldValue: c.oldValue,
        newValue: c.newValue,
        delta: c.delta,
        unit: c.unit,
        isShrinkage: c.isShrinkage
      }));
    }

    // 2. Single item Threshold diffs
    if (details.oldThreshold !== undefined && details.newThreshold !== undefined) {
      const delta = details.newThreshold - details.oldThreshold;
      diffs.push({
        field: 'minThreshold',
        label: 'Safety Threshold',
        oldValue: details.oldThreshold,
        newValue: details.newThreshold,
        delta: `${delta >= 0 ? '+' : ''}${delta} units`,
        unit: 'Units'
      });
    }

    // 3. Physical Scan Verification Diffs
    if (details.systemStock !== undefined && details.physicalStock !== undefined) {
      const delta = details.physicalStock - details.systemStock;
      diffs.push({
        field: 'stockQuantity',
        label: 'Stock Quantity (Audit Count)',
        oldValue: details.systemStock,
        newValue: details.physicalStock,
        delta: `${delta >= 0 ? '+' : ''}${delta} units`,
        unit: 'Units',
        isShrinkage: delta < 0
      });
    }

    // 4. Rate / Price diffs in details
    if (details.previousRate !== undefined && details.newRate !== undefined) {
      const delta = details.newRate - details.previousRate;
      diffs.push({
        field: 'rate',
        label: 'Unit Price / Rate',
        oldValue: `₹${Number(details.previousRate).toFixed(2)}`,
        newValue: `₹${Number(details.newRate).toFixed(2)}`,
        delta: `${delta >= 0 ? '+' : ''}₹${delta.toFixed(2)}`,
        unit: 'INR'
      });
    }

    // 5. Stock diffs in details (single item)
    if (details.previousStock !== undefined && details.newStock !== undefined) {
      const delta = details.newStock - details.previousStock;
      diffs.push({
        field: 'stockQuantity',
        label: 'Stock Quantity',
        oldValue: details.previousStock,
        newValue: details.newStock,
        delta: `${delta >= 0 ? '+' : ''}${delta} units`,
        unit: 'Units',
        isShrinkage: delta < 0
      });
    }

    // 6. Net Total Units Delta in bulk adjustment
    if (details.netUnitsDelta !== undefined && details.adjustedCount) {
      diffs.push({
        field: 'netUnitsDelta',
        label: `Bulk Net Units (${details.adjustedCount} SKUs)`,
        oldValue: details.previousTotalUnits !== undefined ? details.previousTotalUnits : '-',
        newValue: details.newTotalUnits !== undefined ? details.newTotalUnits : '-',
        delta: `${details.netUnitsDelta >= 0 ? '+' : ''}${details.netUnitsDelta} units`,
        isShrinkage: details.netUnitsDelta < 0
      });
    }

    // 7. Net Valuation Delta
    if (details.netValuationDelta !== undefined) {
      diffs.push({
        field: 'netValuationDelta',
        label: 'Bulk Inventory Valuation',
        oldValue: details.previousTotalValuation !== undefined ? `₹${Number(details.previousTotalValuation).toFixed(2)}` : '-',
        newValue: details.newTotalValuation !== undefined ? `₹${Number(details.newTotalValuation).toFixed(2)}` : '-',
        delta: `${details.netValuationDelta >= 0 ? '+' : ''}₹${Number(details.netValuationDelta).toFixed(2)}`
      });
    }

    // 8. Location changes
    if (details.location && typeof details.location === 'string' && details.location.includes('->')) {
      const parts = details.location.split('->').map(p => p.trim());
      if (parts.length >= 2) {
        diffs.push({
          field: 'location',
          label: 'Shelf Coordinates',
          oldValue: parts[0],
          newValue: parts[1]
        });
      }
    }

    return diffs;
  };

  // Helper to extract shrinkage analysis
  const extractShrinkageFromLog = (log: ActivityLog): ExtractedShrinkage => {
    const details = log.details || {};
    const actionLower = (log.action || '').toLowerCase();
    const descLower = (log.description || '').toLowerCase();

    let isShrinkage = false;
    let unitsLost = 0;
    let lossValuation = 0;
    let reason = details.reason || details.reasonLabel || '';

    // Direct flags from BulkStockAdjustModal or logger
    if (details.isShrinkage || details.shrinkageUnits > 0) {
      isShrinkage = true;
      unitsLost = Number(details.shrinkageUnits) || 0;
      lossValuation = Number(details.shrinkageLoss) || Math.abs(Number(details.netValuationDelta) || 0);
    } 
    // Physical scan shortage
    else if (details.stockDelta !== undefined && Number(details.stockDelta) < 0) {
      isShrinkage = true;
      unitsLost = Math.abs(Number(details.stockDelta));
      lossValuation = Math.abs(Number(details.valuationDelta) || 0);
      reason = reason || 'Physical Stock Count Shortage';
    } 
    // Inferred from action / description
    else if (
      actionLower.includes('shrinkage') || 
      actionLower.includes('write-off') || 
      actionLower.includes('damaged') ||
      actionLower.includes('shortage') ||
      descLower.includes('shrinkage') ||
      descLower.includes('units missing')
    ) {
      isShrinkage = true;
      unitsLost = Number(details.unitsDeducted || details.quantity || details.unitsLost) || 0;
      lossValuation = Number(details.lossAmount || details.valuationLoss || details.shrinkageLoss) || 0;
      reason = reason || details.reason || 'Inventory Write-off / Discrepancy';
    }

    // Check items array for bulk item shrinkage
    if (Array.isArray(details.items)) {
      const shrinkageItems = details.items.filter((it: any) => it.isShrinkage || (it.stockDelta && it.stockDelta < 0));
      if (shrinkageItems.length > 0) {
        isShrinkage = true;
        unitsLost = shrinkageItems.reduce((acc: number, it: any) => acc + Math.abs(it.stockDelta || 0), 0);
        lossValuation = shrinkageItems.reduce((acc: number, it: any) => acc + (it.shrinkageLoss || 0), 0);
      }
    }

    return {
      isShrinkage,
      unitsLost,
      lossValuation,
      reason: reason || (isShrinkage ? 'Physical count reduction / Write-off' : undefined),
      reasonCode: details.reasonCode
    };
  };

  // Real-time listener for activity_logs
  useEffect(() => {
    setLoading(true);
    const logsRef = collection(db, 'activity_logs');
    const q = query(logsRef, orderBy('timestamp', 'desc'), limit(300));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedLogs: ActivityLog[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          fetchedLogs.push({
            id: docSnap.id,
            action: data.action || 'Action Executed',
            description: data.description || '',
            timestamp: data.timestamp || new Date().toISOString(),
            userEmail: data.userEmail || data.user || 'system',
            userName: data.userName,
            userRole: data.userRole,
            userId: data.userId,
            module: data.module || (data.type === 'sale' ? 'pos' : data.type === 'inventory' ? 'inventory' : 'system'),
            type: data.type || 'system',
            details: data.details,
            severity: data.severity || (data.action?.toLowerCase().includes('delete') ? 'danger' : 'info'),
            ipAddress: data.ipAddress
          });
        });

        // Fallback: Also check legacy audit_logs if activity_logs is empty
        if (fetchedLogs.length === 0) {
          getDocs(query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(50)))
            .then((auditSnap) => {
              const auditLogs: ActivityLog[] = [];
              auditSnap.forEach((docSnap) => {
                const data = docSnap.data();
                auditLogs.push({
                  id: docSnap.id,
                  action: data.action || 'Audit Log',
                  description: data.description || '',
                  timestamp: data.timestamp || new Date().toISOString(),
                  userEmail: data.userEmail || 'admin@satyampharma.com',
                  module: data.type === 'sale' ? 'pos' : data.type === 'inventory' ? 'inventory' : 'system',
                  type: data.type || 'system',
                  severity: 'info'
                });
              });
              if (auditLogs.length > 0) {
                setLogs(auditLogs);
              } else {
                setLogs([]);
              }
            })
            .catch(() => {
              setLogs([]);
            })
            .finally(() => setLoading(false));
        } else {
          setLogs(fetchedLogs);
          setLoading(false);
        }
      },
      (error) => {
        console.error('Error listening to activity_logs:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Manual refresh trigger
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const snap = await getDocs(query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(300)));
      const fetchedLogs: ActivityLog[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        fetchedLogs.push({
          id: docSnap.id,
          action: data.action || 'Action Executed',
          description: data.description || '',
          timestamp: data.timestamp || new Date().toISOString(),
          userEmail: data.userEmail || 'system',
          userName: data.userName,
          userRole: data.userRole,
          userId: data.userId,
          module: data.module || (data.type === 'sale' ? 'pos' : data.type === 'inventory' ? 'inventory' : 'system'),
          type: data.type || 'system',
          details: data.details,
          severity: data.severity || 'info',
          ipAddress: data.ipAddress
        });
      });
      setLogs(fetchedLogs);
    } catch (err) {
      console.error('Manual refresh failed:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Seed initial demonstration activity logs with rich before/after diffs & shrinkage examples
  const handleSeedDemoLogs = async () => {
    try {
      // 1. Inventory Shrinkage write-off log with exact previous vs new values
      await logActivity({
        action: 'Damaged Stock Write-off',
        description: 'Physical audit write-off for Dolo 650mg: Stock reduced from 50 to 38 units (-12 units, ₹1,440.00 loss) due to water leakage in Aisle A shelf.',
        type: 'inventory',
        module: 'inventory',
        userEmail: profile?.email || 'admin@satyampharma.com',
        userName: profile?.displayName || 'Pharmacist Staff',
        userRole: 'admin',
        severity: 'danger',
        details: {
          medicineId: 'dolo-650-demo',
          medicineName: 'Dolo 650mg Tablet',
          batchNumber: 'DL-2026-X8',
          isShrinkage: true,
          shrinkageUnits: 12,
          shrinkageLoss: 1440,
          reason: 'Damaged Packaging / Water Leakage',
          reasonCode: 'damaged_writeoff',
          changes: [
            {
              field: 'stockQuantity',
              label: 'Stock Quantity',
              oldValue: 50,
              newValue: 38,
              delta: '-12 units (-24%)',
              unit: 'Units',
              isShrinkage: true
            },
            {
              field: 'location',
              label: 'Shelf Storage Coordinates',
              oldValue: 'Aisle A • Rack R-01 • Shelf Level 2',
              newValue: 'Aisle A • Rack R-01 • Shelf Level 2 (Quarantined)',
              delta: 'Relocated damaged stock'
            }
          ],
          previousValues: { stockQuantity: 50, rate: 120 },
          newValues: { stockQuantity: 38, rate: 120 }
        }
      });

      // 2. Price Revision with granular field diffs
      await logActivity({
        action: 'Medicine Rate & Threshold Revised',
        description: 'Updated Pantocid 40mg: Unit price adjusted ₹145.00 ➔ ₹165.00 (+₹20.00), Min threshold updated 10 ➔ 25 units.',
        type: 'inventory',
        module: 'inventory',
        userEmail: profile?.email || 'admin@satyampharma.com',
        userName: profile?.displayName || 'Inventory Manager',
        userRole: 'admin',
        severity: 'info',
        details: {
          medicineId: 'panto-40-demo',
          medicineName: 'Pantocid 40mg Injection',
          changes: [
            {
              field: 'rate',
              label: 'Unit Price / MRP',
              oldValue: '₹145.00',
              newValue: '₹165.00',
              delta: '+₹20.00 (+13.8%)',
              unit: 'INR'
            },
            {
              field: 'minThreshold',
              label: 'Safety Threshold',
              oldValue: '10 units',
              newValue: '25 units',
              delta: '+15 units (+150%)',
              unit: 'Units'
            }
          ],
          previousValues: { rate: 145, minThreshold: 10 },
          newValues: { rate: 165, minThreshold: 25 }
        }
      });

      // 3. Bulk Stock Reconciliation with multi-item audit ledger
      await logActivity({
        action: 'Inventory Reconciliation (Shrinkage Detected)',
        description: 'Bulk adjusted 3 medicines following physical shelf count audit. Net Units Delta: -18 units, Shrinkage Loss: -₹2,350.00 | Note: Monthly audit reconciliation',
        type: 'inventory',
        module: 'inventory',
        userEmail: profile?.email || 'admin@satyampharma.com',
        userName: profile?.displayName || 'Auditor Staff',
        userRole: 'clerk',
        severity: 'warning',
        details: {
          adjustedCount: 3,
          reason: 'Physical Audit Discrepancy',
          reasonCode: 'physical_discrepancy',
          isShrinkage: true,
          shrinkageUnits: 18,
          shrinkageLoss: 2350,
          netUnitsDelta: -18,
          netValuationDelta: -2350,
          previousTotalUnits: 185,
          newTotalUnits: 167,
          items: [
            {
              medicineId: 'amox-500',
              medicineName: 'Amoxicillin 500mg',
              previousStock: 60,
              newStock: 52,
              stockDelta: -8,
              previousRate: 85,
              newRate: 85,
              isShrinkage: true,
              shrinkageLoss: 680,
              reason: 'Unaccounted shortage'
            },
            {
              medicineId: 'azith-500',
              medicineName: 'Azithromycin 500mg',
              previousStock: 45,
              newStock: 35,
              stockDelta: -10,
              previousRate: 167,
              newRate: 167,
              isShrinkage: true,
              shrinkageLoss: 1670,
              reason: 'Missing strip discrepancy'
            },
            {
              medicineId: 'paracet-650',
              medicineName: 'Paracetamol 650mg',
              previousStock: 80,
              newStock: 80,
              stockDelta: 0,
              previousRate: 30,
              newRate: 35,
              rateDelta: 5,
              isShrinkage: false
            }
          ]
        }
      });

      // 4. POS Sale Transaction
      await logActivity({
        action: 'Sale Processed',
        description: 'Processed GST Retail invoice of 3 items for ₹740.00 (UPI) to Rahul Verma',
        type: 'sale',
        module: 'pos',
        userEmail: profile?.email || 'clerk@satyampharma.com',
        userName: profile?.displayName || 'Pharmacist Staff',
        userRole: 'clerk',
        severity: 'success',
        details: {
          invoiceNo: 'INV-849201',
          paymentMethod: 'upi',
          totalAmount: 740,
          customerName: 'Rahul Verma',
          itemsSummary: 'Paracetamol 650mg (x2), Cetirizine 10mg (x1), Azithromycin 500mg (x1)'
        }
      });
    } catch (e) {
      console.error('Error generating sample logs:', e);
    }
  };

  // Clear all logs (admin only)
  const handleClearLogs = async () => {
    if (!isAdmin) {
      alert('Only administrators have permission to clear audit history.');
      return;
    }
    const confirmed = window.confirm(
      'Are you sure you want to purge all stored activity audit logs? This action is permanent and cannot be undone.'
    );
    if (!confirmed) return;

    try {
      setIsClearingLogs(true);
      const snap = await getDocs(collection(db, 'activity_logs'));
      const batch = writeBatch(db);
      snap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      
      // Also log the deletion action as a new permanent record
      await logActivity({
        action: 'Activity Logs Purged',
        description: `Audit history cleared by administrator (${profile?.email || 'admin'})`,
        type: 'system',
        module: 'settings',
        userEmail: profile?.email || 'admin@satyampharma.com',
        userName: profile?.displayName || 'Administrator',
        userRole: 'admin',
        severity: 'danger'
      });

      setLogs([]);
    } catch (err) {
      console.error('Failed to clear logs:', err);
      alert('Failed to clear logs. Please verify permissions.');
    } finally {
      setIsClearingLogs(false);
    }
  };

  // Extract unique user emails for filter dropdown
  const uniqueUsers = useMemo(() => {
    const usersSet = new Set<string>();
    logs.forEach((log) => {
      if (log.userEmail) usersSet.add(log.userEmail);
    });
    return Array.from(usersSet);
  }, [logs]);

  // Compute filtered logs
  const filteredLogs = useMemo(() => {
    const now = Date.now();

    return logs.filter((log) => {
      // 0. Dedicated shrinkage filter
      if (shrinkageOnlyFilter) {
        const shrinkageInfo = extractShrinkageFromLog(log);
        if (!shrinkageInfo.isShrinkage) return false;
      }

      // 1. Module filter
      if (selectedModule !== 'all') {
        if (selectedModule === 'shrinkage') {
          const shrinkageInfo = extractShrinkageFromLog(log);
          if (!shrinkageInfo.isShrinkage) return false;
        } else if (selectedModule === 'inventory_edits') {
          const diffs = extractDiffsFromLog(log);
          if (diffs.length === 0 && log.module !== 'inventory') return false;
        } else {
          const logModule = log.module || (log.type === 'sale' ? 'pos' : log.type === 'inventory' ? 'inventory' : 'system');
          if (selectedModule === 'pos' && logModule !== 'pos' && log.type !== 'sale') return false;
          if (selectedModule === 'inventory' && logModule !== 'inventory' && log.type !== 'inventory') return false;
          if (selectedModule === 'patients' && logModule !== 'patients' && log.type !== 'patient') return false;
          if (selectedModule === 'wholesalers' && logModule !== 'wholesalers' && log.type !== 'wholesaler') return false;
          if (selectedModule === 'system' && logModule !== 'system' && logModule !== 'settings' && logModule !== 'auth') return false;
        }
      }

      // 2. Severity filter
      if (selectedSeverity !== 'all') {
        if (log.severity !== selectedSeverity) return false;
      }

      // 3. User filter
      if (selectedUser !== 'all') {
        if (log.userEmail !== selectedUser) return false;
      }

      // 4. Time filter
      if (timeFilter !== 'all') {
        const logTime = new Date(log.timestamp).getTime();
        const diffHours = (now - logTime) / (1000 * 60 * 60);

        if (timeFilter === 'today') {
          const logDateStr = new Date(log.timestamp).toDateString();
          const todayStr = new Date().toDateString();
          if (logDateStr !== todayStr) return false;
        } else if (timeFilter === '24h') {
          if (diffHours > 24) return false;
        } else if (timeFilter === '7d') {
          if (diffHours > 24 * 7) return false;
        } else if (timeFilter === '30d') {
          if (diffHours > 24 * 30) return false;
        }
      }

      // 5. Search query
      if (searchQuery.trim() !== '') {
        const queryLower = searchQuery.toLowerCase();
        const matchesAction = log.action?.toLowerCase().includes(queryLower);
        const matchesDesc = log.description?.toLowerCase().includes(queryLower);
        const matchesUser = log.userEmail?.toLowerCase().includes(queryLower) || log.userName?.toLowerCase().includes(queryLower);
        const matchesModule = log.module?.toLowerCase().includes(queryLower);
        const matchesDetails = log.details ? JSON.stringify(log.details).toLowerCase().includes(queryLower) : false;

        if (!matchesAction && !matchesDesc && !matchesUser && !matchesModule && !matchesDetails) {
          return false;
        }
      }

      return true;
    });
  }, [logs, selectedModule, selectedSeverity, selectedUser, timeFilter, searchQuery, shrinkageOnlyFilter]);

  // Key KPI stats & Shrinkage Analytics
  const stats = useMemo(() => {
    const total = logs.length;
    const posCount = logs.filter(l => l.module === 'pos' || l.type === 'sale').length;
    const inventoryCount = logs.filter(l => l.module === 'inventory' || l.type === 'inventory').length;
    const activeUsersCount = uniqueUsers.length;
    const dangerCount = logs.filter(l => l.severity === 'danger').length;

    // Shrinkage calculations
    let shrinkageEventsCount = 0;
    let totalShrinkageUnits = 0;
    let totalShrinkageLoss = 0;
    let inventoryEditsCount = 0;

    logs.forEach((log) => {
      const diffs = extractDiffsFromLog(log);
      if (diffs.length > 0) inventoryEditsCount++;

      const s = extractShrinkageFromLog(log);
      if (s.isShrinkage) {
        shrinkageEventsCount++;
        totalShrinkageUnits += s.unitsLost;
        totalShrinkageLoss += s.lossValuation;
      }
    });

    return {
      total,
      posCount,
      inventoryCount,
      activeUsersCount,
      dangerCount,
      shrinkageEventsCount,
      totalShrinkageUnits,
      totalShrinkageLoss,
      inventoryEditsCount
    };
  }, [logs, uniqueUsers]);

  // Copy raw payload helper
  const copyRawPayload = (payload: any) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 1500);
  };

  // Export to CSV for audit compliance with previous/new values & shrinkage columns
  const exportToCSV = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const headers = [
      'Log ID',
      'Timestamp (ISO)',
      'Date & Time',
      'Action Taken',
      'Module',
      'Severity',
      'Staff User Email',
      'Staff User Name',
      'Staff Role',
      'Is Shrinkage Discrepancy',
      'Shrinkage Units Lost',
      'Shrinkage Loss (INR)',
      'Audit Reason',
      'Granular Field Diffs (Previous -> New)',
      'Description / Summary',
      'Details JSON'
    ];

    const rows = filteredLogs.map((log) => {
      const escape = (val: any) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const dt = new Date(log.timestamp);
      const formattedDT = isNaN(dt.getTime()) ? log.timestamp : dt.toLocaleString('en-IN');
      const detailsStr = log.details ? JSON.stringify(log.details) : '';
      
      const diffs = extractDiffsFromLog(log);
      const diffsSummary = diffs.map(d => `${d.label}: [${d.oldValue}] -> [${d.newValue}]${d.delta ? ` (${d.delta})` : ''}`).join(' | ');
      
      const shrinkage = extractShrinkageFromLog(log);

      return [
        escape(log.id),
        escape(log.timestamp),
        escape(formattedDT),
        escape(log.action),
        escape(log.module || log.type),
        escape(log.severity || 'info'),
        escape(log.userEmail || 'system'),
        escape(log.userName || '-'),
        escape(log.userRole || '-'),
        escape(shrinkage.isShrinkage ? 'YES' : 'NO'),
        escape(shrinkage.unitsLost || 0),
        escape(shrinkage.lossValuation ? shrinkage.lossValuation.toFixed(2) : '0.00'),
        escape(shrinkage.reason || '-'),
        escape(diffsSummary || 'No field diffs recorded'),
        escape(log.description),
        escape(detailsStr)
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Inventory_Shrinkage_Audit_Log_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export to PDF Report with dedicated Shrinkage Section
  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const todayStr = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    // Header
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 297, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text('SATYAM PHARMA — INVENTORY SHRINKAGE & AUDIT LOG REPORT', 14, 18);

    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated On: ${todayStr} | Total Records: ${filteredLogs.length} | Total Shrinkage Loss: INR ${stats.totalShrinkageLoss.toFixed(2)} (${stats.totalShrinkageUnits} Units)`, 14, 28);
    doc.text(`Generated by: ${profile?.email || 'Admin'} | Live Audit Verification Engine`, 14, 34);

    // Table
    const tableColumns = ['Date & Time', 'Action & Module', 'Operator', 'Granular Changes (Before ➔ After)', 'Shrinkage Loss', 'Summary'];
    const tableRows = filteredLogs.slice(0, 100).map((log) => {
      const dt = new Date(log.timestamp);
      const dtStr = isNaN(dt.getTime()) ? log.timestamp : dt.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      const diffs = extractDiffsFromLog(log);
      const diffText = diffs.length > 0 
        ? diffs.map(d => `${d.label}: ${d.oldValue} ➔ ${d.newValue}`).join('\n')
        : '-';

      const shrinkage = extractShrinkageFromLog(log);
      const shrinkageStr = shrinkage.isShrinkage 
        ? `-${shrinkage.unitsLost} Units\n(Rs.${shrinkage.lossValuation.toFixed(2)})`
        : 'None';

      return [
        dtStr,
        `${log.action}\n[${(log.module || log.type).toUpperCase()}]`,
        log.userName ? `${log.userName}\n(${log.userRole || 'staff'})` : (log.userEmail || 'System'),
        diffText,
        shrinkageStr,
        log.description
      ];
    });

    autoTable(doc, {
      head: [tableColumns],
      body: tableRows,
      startY: 46,
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 38, fontStyle: 'bold' },
        2: { cellWidth: 32 },
        3: { cellWidth: 55 },
        4: { cellWidth: 26, fontStyle: 'bold' },
        5: { cellWidth: 'auto' }
      }
    });

    doc.save(`Inventory_Shrinkage_Audit_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Helper for severity styles
  const getSeverityBadge = (severity?: string) => {
    switch (severity) {
      case 'success':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50',
          dot: 'bg-emerald-500',
          icon: CheckCircle2,
          label: 'Success'
        };
      case 'warning':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50',
          dot: 'bg-amber-500',
          icon: AlertTriangle,
          label: 'Warning'
        };
      case 'danger':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50',
          dot: 'bg-rose-500',
          icon: AlertTriangle,
          label: 'Critical'
        };
      default:
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50',
          dot: 'bg-blue-500',
          icon: Info,
          label: 'Info'
        };
    }
  };

  // Helper for module icon and tag
  const getModuleConfig = (moduleName?: string, type?: string) => {
    const mod = (moduleName || type || 'system').toLowerCase();
    if (mod.includes('pos') || mod === 'sale') {
      return {
        label: 'POS / Billing',
        icon: ShoppingCart,
        badge: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/50'
      };
    }
    if (mod.includes('invent') || mod === 'inventory') {
      return {
        label: 'Inventory',
        icon: Package,
        badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50'
      };
    }
    if (mod.includes('patient')) {
      return {
        label: 'Patients',
        icon: Users,
        badge: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900/50'
      };
    }
    if (mod.includes('whole') || mod.includes('supplier')) {
      return {
        label: 'Wholesalers',
        icon: Building2,
        badge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/50'
      };
    }
    return {
      label: 'System & Auth',
      icon: Shield,
      badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
    };
  };

  // Format relative timestamp
  const formatTimeRelative = (isoString: string) => {
    try {
      const dt = new Date(isoString);
      if (isNaN(dt.getTime())) return isoString;

      const diffMs = Date.now() - dt.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;

      return dt.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3, staggerChildren: 0.04 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.2 } }
  };

  return (
    <motion.div 
      className={cn("space-y-6", isModal && "p-6 max-h-[88vh] overflow-y-auto")}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Top Header */}
      <motion.header variants={itemVariants} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-blue-600 shadow-sm">
              <History size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {isHindi ? 'ऑडिट ट्रेल एवं स्टॉक संकोचन लॉग' : 'Activity Audit & Inventory Shrinkage Trail'}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Granular Before / After Change Diff Tracking & Discrepancy Accounting
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 dark:border-slate-800 dark:bg-slate-800/80">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold transition-all cursor-pointer",
                viewMode === 'table'
                  ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-slate-100"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              <ListOrdered size={12} />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold transition-all cursor-pointer",
                viewMode === 'timeline'
                  ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-slate-100"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              <Clock size={12} />
              <span>Timeline</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            id="activity-log-refresh-btn"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-700 shadow-xs transition-all hover:bg-slate-50 active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 cursor-pointer"
            title="Refresh logs from database"
          >
            <RefreshCw size={14} className={cn(isRefreshing && "animate-spin text-blue-600")} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={exportToCSV}
            id="activity-log-export-csv-btn"
            className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-[10px] font-bold uppercase tracking-widest text-emerald-800 shadow-xs transition-all hover:bg-emerald-100 active:scale-95 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-pointer"
            title="Export filtered activity log as CSV spreadsheet with previous and new values"
          >
            <FileSpreadsheet size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={exportToPDF}
            id="activity-log-export-pdf-btn"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-700 shadow-xs transition-all hover:bg-slate-50 active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 cursor-pointer"
            title="Export printable audit summary PDF"
          >
            <FileText size={14} className="text-blue-600 dark:text-blue-400" />
            <span>PDF Report</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={handleClearLogs}
              disabled={isClearingLogs || logs.length === 0}
              id="activity-log-clear-btn"
              className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-rose-700 shadow-xs transition-all hover:bg-rose-100 active:scale-95 disabled:opacity-40 dark:border-rose-900/30 dark:bg-rose-950/40 dark:text-rose-300 cursor-pointer"
              title="Purge all audit logs (Admin only)"
            >
              <Trash2 size={14} />
              <span>Purge</span>
            </button>
          )}

          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </motion.header>

      {/* Audit View Section Switcher: System Logs vs Stock Additions/Subtractions Audit Trail (Requirement 8) */}
      <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          id="activity-logs-system-tab"
          onClick={() => setAuditSection('system_activity')}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer",
            auditSection === 'system_activity'
              ? "bg-slate-900 text-white shadow-md dark:bg-blue-600"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          )}
        >
          <History size={15} />
          <span>System & User Activity Logs</span>
          <span className="ml-1 rounded-full bg-slate-700/50 px-2 py-0.5 text-[10px] text-slate-200">
            {logs.length}
          </span>
        </button>

        <button
          type="button"
          id="activity-logs-stock-audit-tab"
          onClick={() => setAuditSection('stock_movements')}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer",
            auditSection === 'stock_movements'
              ? "bg-slate-900 text-white shadow-md dark:bg-blue-600"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          )}
        >
          <Layers size={15} />
          <span>Stock Additions & Subtractions Audit Trail</span>
          <span className="ml-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-black">
            Live Room DB
          </span>
        </button>
      </motion.div>

      {auditSection === 'stock_movements' ? (
        <StockMovementAuditView 
          medicines={medicines} 
          onRefreshMedicines={fetchMedicinesForAudit} 
        />
      ) : (
        <>
      {/* KPI Overview Tiles & Shrinkage Radar */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Audit Events</span>
            <History size={16} className="text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">{stats.total}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Logged staff operations</p>
        </div>

        {/* Highlighted Shrinkage Radar Tile */}
        <div className={cn(
          "rounded-2xl border p-4 shadow-xs transition-all",
          stats.shrinkageEventsCount > 0
            ? "border-rose-300 bg-gradient-to-br from-rose-50 via-rose-50/50 to-amber-50/30 dark:border-rose-900/60 dark:from-rose-950/40 dark:via-slate-900 dark:to-slate-900"
            : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
        )}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-700 dark:text-rose-400 flex items-center gap-1">
              <AlertOctagon size={13} className="text-rose-600 animate-pulse" />
              <span>Shrinkage & Loss</span>
            </span>
            <TrendingDown size={16} className="text-rose-600 dark:text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black tracking-tight text-rose-600 dark:text-rose-400">
              ₹{stats.totalShrinkageLoss.toFixed(0)}
            </span>
            <span className="text-xs font-bold text-rose-700/80 dark:text-rose-300">
              ({stats.totalShrinkageUnits} units)
            </span>
          </div>
          <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">
            Across {stats.shrinkageEventsCount} discrepancy incidents
          </p>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 shadow-xs dark:border-blue-900/30 dark:bg-blue-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-400">Inventory Field Diffs</span>
            <SlidersHorizontal size={16} className="text-blue-600 dark:text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-blue-900 dark:text-blue-200">{stats.inventoryEditsCount}</p>
          <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70 mt-0.5">Price, threshold & shelf updates</p>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 shadow-xs dark:border-indigo-900/30 dark:bg-indigo-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400">POS & Billing Invoices</span>
            <ShoppingCart size={16} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-indigo-900 dark:text-indigo-200">{stats.posCount}</p>
          <p className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70 mt-0.5">Dispatched sales receipts</p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 shadow-xs dark:border-emerald-900/30 dark:bg-emerald-950/20 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Active Operators</span>
            <User size={16} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight text-emerald-900 dark:text-emerald-200">{stats.activeUsersCount}</p>
          <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">Staff & admin accounts</p>
        </div>
      </motion.div>

      {/* Module & Shrinkage Quick Filter Tabs */}
      <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        {[
          { id: 'all', label: 'All Activities', count: logs.length, icon: Layers },
          { id: 'shrinkage', label: '🚨 Shrinkage & Discrepancies', count: stats.shrinkageEventsCount, icon: AlertOctagon, isAlert: true },
          { id: 'inventory_edits', label: '📦 Stock & Price Edits', count: stats.inventoryEditsCount, icon: SlidersHorizontal },
          { id: 'pos', label: 'POS & Invoices', count: stats.posCount, icon: ShoppingCart },
          { id: 'wholesalers', label: 'Wholesalers', count: logs.filter(l => l.module === 'wholesalers' || l.type === 'wholesaler').length, icon: Building2 },
          { id: 'patients', label: 'Patients', count: logs.filter(l => l.module === 'patients' || l.type === 'patient').length, icon: Users },
          { id: 'system', label: 'System Security & Audit', count: logs.filter(l => l.module === 'system' || l.module === 'settings' || l.module === 'auth').length, icon: Shield }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = selectedModule === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSelectedModule(tab.id);
                if (tab.id === 'shrinkage') setShrinkageOnlyFilter(false);
              }}
              id={`activity-filter-tab-${tab.id}`}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all cursor-pointer",
                isActive
                  ? tab.isAlert
                    ? "bg-rose-600 text-white shadow-sm ring-2 ring-rose-300 dark:ring-rose-900"
                    : "bg-slate-900 text-white shadow-xs dark:bg-blue-600"
                  : tab.isAlert
                  ? "bg-rose-50 text-rose-800 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50"
                  : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800"
              )}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
              <span className={cn(
                "rounded-md px-1.5 py-0.5 text-[9px] font-black",
                isActive 
                  ? "bg-white/20 text-white" 
                  : tab.isAlert
                  ? "bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-200"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              )}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </motion.div>

      {/* Search & Advanced Filters Bar */}
      <motion.div variants={itemVariants} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          {/* Search box */}
          <div className="relative md:col-span-5">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search actions, medicine names, staff email, invoice numbers, shrinkage reasons..."
              id="activity-log-search-input"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-9 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-100"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Time Filter */}
          <div className="md:col-span-3">
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as TimeFilterOption)}
                id="activity-log-time-filter"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-3 text-xs font-bold text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200"
              >
                <option value="all">Time: All History</option>
                <option value="today">Time: Today Only</option>
                <option value="24h">Time: Last 24 Hours</option>
                <option value="7d">Time: Last 7 Days</option>
                <option value="30d">Time: Last 30 Days</option>
              </select>
            </div>
          </div>

          {/* Severity Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              id="activity-log-severity-filter"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 px-3 text-xs font-bold text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200"
            >
              <option value="all">Severity: All</option>
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="danger">Critical / Shrinkage</option>
            </select>
          </div>

          {/* User Operator Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              id="activity-log-user-filter"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 px-3 text-xs font-bold text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200"
            >
              <option value="all">Staff: All Users</option>
              {uniqueUsers.map((u) => (
                <option key={u} value={u}>
                  {u.split('@')[0]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filter Indicators */}
        {(selectedModule !== 'all' || selectedSeverity !== 'all' || selectedUser !== 'all' || timeFilter !== 'all' || searchQuery || shrinkageOnlyFilter) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800/60 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Filters:</span>
            {selectedModule !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                Filter: {selectedModule}
                <button type="button" onClick={() => setSelectedModule('all')} className="hover:text-blue-900"><X size={10} /></button>
              </span>
            )}
            {timeFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Time: {timeFilter}
                <button type="button" onClick={() => setTimeFilter('all')} className="hover:text-slate-900"><X size={10} /></button>
              </span>
            )}
            {selectedSeverity !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                Severity: {selectedSeverity}
                <button type="button" onClick={() => setSelectedSeverity('all')} className="hover:text-amber-900"><X size={10} /></button>
              </span>
            )}
            {selectedUser !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                User: {selectedUser}
                <button type="button" onClick={() => setSelectedUser('all')} className="hover:text-purple-900"><X size={10} /></button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Query: "{searchQuery}"
                <button type="button" onClick={() => setSearchQuery('')} className="hover:text-slate-900"><X size={10} /></button>
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setSelectedModule('all');
                setSelectedSeverity('all');
                setSelectedUser('all');
                setTimeFilter('all');
                setSearchQuery('');
                setShrinkageOnlyFilter(false);
              }}
              className="text-[10px] font-bold text-rose-600 hover:underline dark:text-rose-400 cursor-pointer ml-auto"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </motion.div>

      {/* Main Content: Table View vs Timeline View */}
      {viewMode === 'table' ? (
        <motion.div variants={itemVariants} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Audit Stream & Granular Change Ledger
              </h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {filteredLogs.length} of {logs.length}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Real-time diff auditing active</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:border-slate-800 dark:bg-slate-800/40">
                <tr>
                  <th className="px-6 py-3.5">Timestamp</th>
                  <th className="px-6 py-3.5">Action & Severity</th>
                  <th className="px-6 py-3.5">Module</th>
                  <th className="px-6 py-3.5">User / Operator</th>
                  <th className="px-6 py-3.5">Change Summary & Diff</th>
                  <th className="px-6 py-3.5 text-right">Inspection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="animate-spin text-blue-600" size={24} />
                        <p className="text-xs font-bold uppercase tracking-widest">Loading activity ledger...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                          <History size={24} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No activity logs found</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {logs.length === 0 
                              ? "No user actions or stock edits have been recorded yet in this session."
                              : "Try adjusting your search query or filter parameters."}
                          </p>
                        </div>
                        {logs.length === 0 && (
                          <button
                            type="button"
                            onClick={handleSeedDemoLogs}
                            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95 cursor-pointer"
                          >
                            <Sparkles size={14} />
                            <span>Generate Demo Inventory & Shrinkage Records</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const severityStyle = getSeverityBadge(log.severity);
                    const moduleStyle = getModuleConfig(log.module, log.type);
                    const ModuleIcon = moduleStyle.icon;
                    const dt = new Date(log.timestamp);
                    const exactTime = isNaN(dt.getTime()) ? log.timestamp : dt.toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true
                    });

                    const diffs = extractDiffsFromLog(log);
                    const shrinkage = extractShrinkageFromLog(log);

                    return (
                      <tr
                        key={log.id}
                        className={cn(
                          "group transition-colors",
                          shrinkage.isShrinkage
                            ? "bg-rose-50/30 hover:bg-rose-50/60 dark:bg-rose-950/10 dark:hover:bg-rose-950/20"
                            : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                        )}
                      >
                        {/* Timestamp */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {formatTimeRelative(log.timestamp)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {exactTime}
                            </span>
                          </div>
                        </td>

                        {/* Action & Severity */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className={cn("h-2 w-2 rounded-full", severityStyle.dot)} />
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                {log.action}
                              </span>
                              <span className={cn("rounded-md border px-1.5 py-0.2 text-[8px] font-black uppercase tracking-wider", severityStyle.bg)}>
                                {severityStyle.label}
                              </span>
                            </div>

                            {/* Shrinkage Callout Badge */}
                            {shrinkage.isShrinkage && (
                              <div className="flex items-center gap-1">
                                <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-[9px] font-black text-rose-800 dark:bg-rose-900/60 dark:text-rose-200 border border-rose-200 dark:border-rose-800">
                                  <AlertOctagon size={10} />
                                  <span>Shrinkage: -{shrinkage.unitsLost} units</span>
                                  {shrinkage.lossValuation > 0 && (
                                    <span>(-₹{shrinkage.lossValuation.toFixed(2)})</span>
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Module */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider", moduleStyle.badge)}>
                            <ModuleIcon size={12} />
                            <span>{moduleStyle.label}</span>
                          </span>
                        </td>

                        {/* User / Operator */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[10px] font-black uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {log.userName ? log.userName.charAt(0) : (log.userEmail ? log.userEmail.charAt(0) : 'U')}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                {log.userName || (log.userEmail ? log.userEmail.split('@')[0] : 'System')}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-slate-400">
                                  {log.userEmail || 'system'}
                                </span>
                                {log.userRole && (
                                  <span className="rounded bg-slate-100 px-1 py-0.2 text-[8px] font-bold uppercase text-slate-500 dark:bg-slate-800">
                                    {log.userRole}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Granular Changes / Description */}
                        <td className="px-6 py-4">
                          <div className="space-y-1.5 max-w-md">
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 line-clamp-2">
                              {log.description}
                            </p>

                            {/* Granular Diff Pills */}
                            {diffs.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                {diffs.slice(0, 3).map((diff, idx) => (
                                  <span
                                    key={idx}
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium border",
                                      diff.isShrinkage
                                        ? "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50"
                                        : "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                                    )}
                                  >
                                    <span className="font-bold text-slate-500 dark:text-slate-400">{diff.label}:</span>
                                    <span className="line-through text-slate-400">{String(diff.oldValue)}</span>
                                    <ArrowRight size={10} className="text-slate-400" />
                                    <span className={cn("font-bold", diff.isShrinkage ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>
                                      {String(diff.newValue)}
                                    </span>
                                    {diff.delta && (
                                      <span className={cn("font-bold text-[9px]", diff.isShrinkage ? "text-rose-600" : "text-emerald-600")}>
                                        ({diff.delta})
                                      </span>
                                    )}
                                  </span>
                                ))}
                                {diffs.length > 3 && (
                                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                    +{diffs.length - 3} more changes
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Details View Button */}
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedLogDetail(log)}
                            id={`activity-view-detail-${log.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-400 cursor-pointer"
                          >
                            <Eye size={12} />
                            <span>Inspect</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      ) : (
        /* Timeline View Mode */
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 pl-6 space-y-6">
            {filteredLogs.map((log) => {
              const diffs = extractDiffsFromLog(log);
              const shrinkage = extractShrinkageFromLog(log);
              const severityStyle = getSeverityBadge(log.severity);
              const moduleStyle = getModuleConfig(log.module, log.type);
              const ModuleIcon = moduleStyle.icon;

              return (
                <div key={log.id} className="relative group">
                  {/* Timeline dot */}
                  <span className={cn(
                    "absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white dark:ring-slate-900",
                    shrinkage.isShrinkage ? "bg-rose-600" : severityStyle.dot
                  )} />

                  <div className={cn(
                    "rounded-2xl border bg-white p-5 shadow-xs transition-all dark:bg-slate-900",
                    shrinkage.isShrinkage
                      ? "border-rose-200 bg-rose-50/20 dark:border-rose-900/50"
                      : "border-slate-200 dark:border-slate-800"
                  )}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {log.action}
                        </span>
                        <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[9px] font-bold uppercase", moduleStyle.badge)}>
                          <ModuleIcon size={10} />
                          <span>{moduleStyle.label}</span>
                        </span>
                        {shrinkage.isShrinkage && (
                          <span className="rounded-md bg-rose-600 px-2 py-0.5 text-[9px] font-bold text-white shadow-2xs">
                            Shrinkage Write-off (-{shrinkage.unitsLost} units)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                        <Clock size={12} />
                        <span>{new Date(log.timestamp).toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-3 leading-relaxed">
                      {log.description}
                    </p>

                    {/* Diff Cards in Timeline */}
                    {diffs.length > 0 && (
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {diffs.map((diff, idx) => (
                          <div key={idx} className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-800/40 text-xs">
                            <span className="text-[10px] font-black uppercase text-slate-400">{diff.label}</span>
                            <div className="mt-1 flex items-center justify-between">
                              <span className="line-through text-slate-400 font-mono">{String(diff.oldValue)}</span>
                              <ArrowRight size={13} className="text-slate-400" />
                              <span className={cn("font-black font-mono", diff.isShrinkage ? "text-rose-600" : "text-emerald-600")}>
                                {String(diff.newValue)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/60">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">Operator:</span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {log.userName || log.userEmail || 'System'}
                        </span>
                        {log.userRole && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-bold uppercase text-slate-500 dark:bg-slate-800">
                            {log.userRole}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedLogDetail(log)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer"
                      >
                        <span>Deep Inspect</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Detailed Log Item Modal Inspector with Side-by-Side Change Diff */}
      <AnimatePresence>
        {selectedLogDetail && (() => {
          const diffs = extractDiffsFromLog(selectedLogDetail);
          const shrinkage = extractShrinkageFromLog(selectedLogDetail);
          const severityStyle = getSeverityBadge(selectedLogDetail.severity);
          const moduleStyle = getModuleConfig(selectedLogDetail.module, selectedLogDetail.type);
          const ModuleIcon = moduleStyle.icon;
          const bulkItems = Array.isArray(selectedLogDetail.details?.items) ? selectedLogDetail.details.items : [];

          return (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-xs"
                onClick={() => setSelectedLogDetail(null)}
              />

              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                className="relative flex flex-col w-full max-w-3xl max-h-[90vh] rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-2xl overflow-hidden"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/50">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm",
                      shrinkage.isShrinkage ? "bg-rose-600" : "bg-slate-900 dark:bg-blue-600"
                    )}>
                      {shrinkage.isShrinkage ? <AlertOctagon size={20} /> : <History size={20} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                          {selectedLogDetail.action}
                        </h3>
                        <span className={cn("rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider", severityStyle.bg)}>
                          {severityStyle.label}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Audit Event Record & Granular Value Comparison
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedLogDetail(null)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Shrinkage Summary Banner (if shrinkage recorded) */}
                  {shrinkage.isShrinkage && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-900/60 dark:bg-rose-950/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex h-2.5 w-2.5 rounded-full bg-rose-600 animate-ping" />
                          <h4 className="text-xs font-black uppercase tracking-wider text-rose-800 dark:text-rose-300">
                            Inventory Shrinkage & Write-Off Certificate
                          </h4>
                        </div>
                        <span className="rounded-full bg-rose-200 px-2.5 py-0.5 text-[9px] font-black text-rose-900 dark:bg-rose-900 dark:text-rose-100">
                          Audit Flagged
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-3 pt-2">
                        <div className="rounded-xl bg-white p-3 shadow-2xs dark:bg-slate-900 border border-rose-100 dark:border-rose-900/40">
                          <span className="text-[9px] font-bold uppercase text-slate-400">Units Deducted</span>
                          <p className="text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">
                            -{shrinkage.unitsLost} Units
                          </p>
                        </div>
                        <div className="rounded-xl bg-white p-3 shadow-2xs dark:bg-slate-900 border border-rose-100 dark:border-rose-900/40">
                          <span className="text-[9px] font-bold uppercase text-slate-400">Estimated Loss</span>
                          <p className="text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">
                            ₹{shrinkage.lossValuation.toFixed(2)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white p-3 shadow-2xs dark:bg-slate-900 border border-rose-100 dark:border-rose-900/40">
                          <span className="text-[9px] font-bold uppercase text-slate-400">Shrinkage Reason</span>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">
                            {shrinkage.reason || 'Physical Discrepancy'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Summary Card */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Operational Statement:
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Event ID: {selectedLogDetail.id}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                      {selectedLogDetail.description}
                    </p>
                  </div>

                  {/* Side-by-Side Granular Before / After Comparison Table */}
                  {diffs.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <SlidersHorizontal size={14} className="text-blue-600" />
                          <span>Granular Attribute Changes (Before ➔ After)</span>
                        </h4>
                        <span className="text-[10px] font-bold text-slate-400">
                          {diffs.length} Fields Modified
                        </span>
                      </div>

                      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
                            <tr>
                              <th className="px-4 py-2.5">Modified Field</th>
                              <th className="px-4 py-2.5 text-rose-600 dark:text-rose-400">Previous Value (Before)</th>
                              <th className="px-4 py-2.5 text-emerald-600 dark:text-emerald-400">New Value (After)</th>
                              <th className="px-4 py-2.5">Net Delta</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {diffs.map((diff, index) => (
                              <tr key={index} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">
                                  {diff.label}
                                </td>
                                <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">
                                  <span className="rounded bg-rose-50 px-2 py-1 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-semibold border border-rose-100 dark:border-rose-900/40">
                                    {String(diff.oldValue)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-mono text-slate-900 dark:text-slate-100">
                                  <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold border border-emerald-100 dark:border-emerald-900/40">
                                    {String(diff.newValue)}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  {diff.delta ? (
                                    <span className={cn(
                                      "inline-flex items-center gap-1 font-bold text-xs font-mono",
                                      diff.isShrinkage ? "text-rose-600" : "text-emerald-600"
                                    )}>
                                      {diff.isShrinkage ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                                      <span>{diff.delta}</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-[10px]">Updated</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Multi-Item Bulk Adjustment Breakdown Table (if items array exists) */}
                  {bulkItems.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Package size={14} className="text-blue-600" />
                          <span>Itemized Medication Adjustments ({bulkItems.length} SKUs)</span>
                        </h4>
                      </div>

                      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
                            <tr>
                              <th className="px-4 py-2.5">Medicine Name</th>
                              <th className="px-4 py-2.5">Previous Stock</th>
                              <th className="px-4 py-2.5">New Stock</th>
                              <th className="px-4 py-2.5">Stock Delta</th>
                              <th className="px-4 py-2.5">Shrinkage Loss</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {bulkItems.map((item: any, idx: number) => {
                              const isShrink = item.isShrinkage || (item.stockDelta && item.stockDelta < 0);
                              return (
                                <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                  <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-slate-100">
                                    {item.medicineName}
                                  </td>
                                  <td className="px-4 py-2.5 font-mono text-slate-500">
                                    {item.previousStock}
                                  </td>
                                  <td className="px-4 py-2.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                                    {item.newStock}
                                  </td>
                                  <td className="px-4 py-2.5 font-mono">
                                    <span className={cn(
                                      "font-bold",
                                      isShrink ? "text-rose-600" : item.stockDelta > 0 ? "text-emerald-600" : "text-slate-400"
                                    )}>
                                      {item.stockDelta > 0 ? `+${item.stockDelta}` : item.stockDelta || 0} units
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 font-mono font-bold">
                                    {item.shrinkageLoss > 0 ? (
                                      <span className="text-rose-600">
                                        -₹{item.shrinkageLoss.toFixed(2)}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">₹0.00</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Key Metadata Grid */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-800/40">
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Staff Operator</span>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-1 truncate">
                        {selectedLogDetail.userName || selectedLogDetail.userEmail || 'System'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-800/40">
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Role & Permission</span>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-1">
                        {(selectedLogDetail.userRole || 'admin').toUpperCase()}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-800/40 col-span-2 sm:col-span-1">
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Exact Timestamp</span>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
                        {new Date(selectedLogDetail.timestamp).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>

                  {/* Structured Payload Inspector */}
                  {selectedLogDetail.details && Object.keys(selectedLogDetail.details).length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          Structured Audit Payload Metadata (JSON)
                        </span>
                        <button
                          type="button"
                          onClick={() => copyRawPayload(selectedLogDetail.details)}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-blue-600 dark:text-slate-400 cursor-pointer"
                        >
                          {copiedPayload ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                          <span>{copiedPayload ? 'Copied' : 'Copy JSON'}</span>
                        </button>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs text-emerald-400 overflow-x-auto shadow-inner max-h-56">
                        <pre className="whitespace-pre-wrap leading-relaxed">
                          {JSON.stringify(selectedLogDetail.details, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/50">
                  <button
                    type="button"
                    onClick={() => setSelectedLogDetail(null)}
                    className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 active:scale-95 dark:bg-blue-600 dark:hover:bg-blue-700 cursor-pointer"
                  >
                    Close Inspection
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
        </>
      )}
    </motion.div>
  );
};

export default ActivityLogView;
