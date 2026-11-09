import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLanguage } from '../context/LanguageContext';
import BarcodeScanner from './BarcodeScanner';
import BulkStockAdjustModal from './BulkStockAdjustModal';
import BulkDeleteConfirmationModal from './BulkDeleteConfirmationModal';
import StockDemandForecasterModal from './StockDemandForecasterModal';
import VisualShelfLocatorModal from './VisualShelfLocatorModal';
import ScanToVerifyModal from './ScanToVerifyModal';
import ScanToAddProductModal from './ScanToAddProductModal';
import InventorySearchAutocomplete from './InventorySearchAutocomplete';
import InventoryAnalyticsDashboard from './InventoryAnalyticsDashboard';
import { PredictiveStockRefillWidget } from './PredictiveStockRefillWidget';
import { PredictiveStockRefillModal } from './PredictiveStockRefillModal';
import { InventoryAdvancedFilters, InventoryFilterState, DEFAULT_INVENTORY_FILTERS } from './InventoryAdvancedFilters';
import { calculateMedicineStockPredictions } from '../utils/predictiveStockEngine';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  AlertCircle, 
  CheckCircle,
  ChevronRight,
  MoreVertical,
  Calendar,
  Clock,
  Layers,
  ArrowRight,
  ArrowUpDown,
  Mic,
  MicOff,
  Scan,
  Download,
  AlertTriangle,
  Settings2,
  Sliders,
  FileDown,
  ShoppingBag,
  Gauge,
  Mail,
  Zap,
  Sparkles,
  BrainCircuit,
  MapPin,
  Compass,
  Navigation,
  Grid,
  QrCode,
  Barcode,
  FlaskConical,
  Package,
  Building2,
  Thermometer,
  Snowflake,
  Droplets,
  ShieldCheck,
  Lock,
  PackagePlus,
  History,
  ChevronDown,
  StickyNote
} from 'lucide-react';
import { Medicine, Batch, StorageLocation, Sale, MedicineStockPrediction, PredictiveRefillSummary, ReorderTargetPayload } from '../types';
import { cn, formatDate, formatCurrency } from '../lib/utils';
import { 
  getMedicineLocation, 
  AISLE_PRESETS, 
  RACK_PRESETS, 
  SHELF_PRESETS, 
  BIN_PRESETS 
} from '../lib/locationUtils';
import { getMedicineSupplier, PHARMACY_SUPPLIERS } from '../lib/supplierUtils';
import { logActivity } from '../lib/logger';
import { useAuth } from './AuthProvider';
import { canViewSuppliers, canViewFinancials, maskSensitiveValue } from '../lib/permissions';
import { SensitiveValueMask } from './SensitiveValueMask';
import { motion, AnimatePresence, Variants } from 'motion/react';
import { roomInsertItem, roomSyncAllItems, roomGetAllItems } from '../lib/roomLocalDb';
import { logStockMovement } from '../lib/stockAuditService';
import { AIStockReorderSummaryCard } from './AIStockReorderSummaryCard';
import { StockHistorySparkline } from './StockHistorySparkline';
import { SmartProcurementModal } from './SmartProcurementModal';
import { BatchQuickActionModal, BatchQuickActionType } from './BatchQuickActionModal';
import { InventoryHealthDashboardWidget } from './InventoryHealthDashboardWidget';
import { AutoProcurementEngineWidget } from './AutoProcurementEngineWidget';

interface InventoryProps {
  reorderTarget?: ReorderTargetPayload | null;
}

const Inventory: React.FC<InventoryProps> = ({ reorderTarget }) => {
  const { t, tText } = useLanguage();
  const { profile } = useAuth();
  const [items, setItems] = useState<Medicine[]>([]);
  const [salesHistory, setSalesHistory] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'expiry30' | 'expiry60' | 'expiry90' | 'expired' | 'stockout7' | 'stockout15' | 'stockout30' | 'healthy'>('all');
  const [advancedFilters, setAdvancedFilters] = useState<InventoryFilterState>(DEFAULT_INVENTORY_FILTERS);
  const [sortByExpiry, setSortByExpiry] = useState<boolean>(false);
  const [batchGroupSortMode, setBatchGroupSortMode] = useState<'off' | 'asc' | 'desc'>('off');
  const [focusedBatchGroup, setFocusedBatchGroup] = useState<string | null>(null);
  const [cellBatchSortOrder, setCellBatchSortOrder] = useState<Record<string, 'asc' | 'desc'>>({});
  const [expandedBatchCells, setExpandedBatchCells] = useState<Record<string, boolean>>({});
  const [openQuickActionRowId, setOpenQuickActionRowId] = useState<string | null>(null);
  const [quickActionBatchByRow, setQuickActionBatchByRow] = useState<Record<string, string>>({});
  const [batchQuickModalState, setBatchQuickModalState] = useState<{
    isOpen: boolean;
    actionType: BatchQuickActionType;
    medicine: Medicine | null;
    batchNumber: string;
  }>({
    isOpen: false,
    actionType: 'restock',
    medicine: null,
    batchNumber: ''
  });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPredictiveRefillModalOpen, setIsPredictiveRefillModalOpen] = useState(false);
  const [isSmartProcurementOpen, setIsSmartProcurementOpen] = useState(false);

  // Visual Locator Modal State
  const [isLocatorModalOpen, setIsLocatorModalOpen] = useState(false);
  const [locatorTargetMedicine, setLocatorTargetMedicine] = useState<Medicine | null>(null);

  // Edit Medicine Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [editFormData, setEditFormData] = useState<any>({
    name: '',
    genericName: '',
    salt: '',
    barcode: '',
    rate: 0,
    type: 'tablet',
    minThreshold: 10,
    expiryDate: '',
    aisle: 'Aisle A',
    rack: 'Rack R-01',
    shelf: 'Shelf Level 2',
    bin: 'Bin 01',
    notes: ''
  });
  
  // Form State
  const [formData, setFormData] = useState<any>({
    name: '',
    expiryDate: '',
    stockQuantity: 0,
    rate: 0,
    type: 'tablet',
    batchNumber: '',
    genericName: '',
    salt: '',
    barcode: '',
    minThreshold: 10,
    aisle: 'Aisle A',
    rack: 'Rack R-01',
    shelf: 'Shelf Level 2',
    bin: 'Bin 01',
    notes: ''
  });
  const [isFormScannerOpen, setIsFormScannerOpen] = useState(false);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkAdjustModalOpen, setIsBulkAdjustModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);
  const [isDemandForecasterOpen, setIsDemandForecasterOpen] = useState(false);
  const [isScanToVerifyOpen, setIsScanToVerifyOpen] = useState(false);
  const [isScanToAddModalOpen, setIsScanToAddModalOpen] = useState(false);
  const [newThreshold, setNewThreshold] = useState<number>(10);
  const [newBatch, setNewBatch] = useState({
    batchNumber: '',
    expiryDate: '',
    quantity: 0,
    storageCondition: ''
  });

  // Reorder from Expiry Audit Report
  const [procurementNotice, setProcurementNotice] = useState<{
    medicineName: string;
    batchNumber?: string;
    expiryDate?: string;
    stockQuantity?: number;
    supplier?: string;
  } | null>(null);
  const lastProcessedReorderTime = React.useRef<number>(0);

  const fetchData = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'inventory'), orderBy('name'));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => {
        const medicine = { id: d.id, ...d.data() } as Medicine;
        // Ensure batches array exists (for legacy data)
        if (!medicine.batches) {
          medicine.batches = [{
            id: 'legacy-batch',
            batchNumber: (d.data() as any).batchNumber || 'N/A',
            expiryDate: medicine.expiryDate,
            quantity: medicine.stockQuantity
          }];
        }
        
        // Recalculate aggregates to be safe
        medicine.stockQuantity = medicine.batches.reduce((sum, b) => sum + b.quantity, 0);
        medicine.expiryDate = medicine.batches.length > 0 
          ? medicine.batches.reduce((min, b) => b.expiryDate < min ? b.expiryDate : min, medicine.batches[0].expiryDate)
          : medicine.expiryDate;

        return medicine;
      });
      setItems(data);

      // Synchronize Room local SQLite/IndexedDB store
      roomSyncAllItems(data).catch(err => console.warn('Room DB sync warning:', err));

      // Also fetch recent sales records for historical consumption calculation
      try {
        const salesSnap = await getDocs(collection(db, 'sales'));
        const salesData = salesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
        setSalesHistory(salesData);
      } catch (sErr) {
        console.warn("Could not load sales records for run-rate calculation:", sErr);
      }
    } catch (error) {
      console.error("Error fetching inventory from network, attempting Room DB local cache:", error);
      try {
        const localItems = await roomGetAllItems();
        if (localItems && localItems.length > 0) {
          setItems(localItems);
        }
      } catch (localErr) {
        console.error("Room DB local cache read error:", localErr);
      }
    } finally {
      setLoading(false);
    }
  };

  // Compute live mathematical and AI stock refill predictions & stockout dates
  const { summary: predictiveRefillSummary, predictions: stockPredictions } = React.useMemo(() => {
    return calculateMedicineStockPredictions(items, salesHistory);
  }, [items, salesHistory]);

  const predictionsMap = React.useMemo(() => {
    const map: Record<string, MedicineStockPrediction> = {};
    stockPredictions.forEach(p => {
      if (p.medicineId) map[p.medicineId] = p;
      if (p.medicineName) map[p.medicineName] = p;
    });
    return map;
  }, [stockPredictions]);

  useEffect(() => {
    fetchData();

    const handleOpenForecaster = () => setIsDemandForecasterOpen(true);
    const handleOpenScanToVerify = () => setIsScanToVerifyOpen(true);
    const handleOpenPredictiveRefill = () => setIsPredictiveRefillModalOpen(true);
    window.addEventListener('open-demand-forecaster', handleOpenForecaster);
    window.addEventListener('open-scan-to-verify', handleOpenScanToVerify);
    window.addEventListener('open-predictive-refill', handleOpenPredictiveRefill);

    return () => {
      window.removeEventListener('open-demand-forecaster', handleOpenForecaster);
      window.removeEventListener('open-scan-to-verify', handleOpenScanToVerify);
      window.removeEventListener('open-predictive-refill', handleOpenPredictiveRefill);
    };
  }, []);

  // Handle pre-selecting medicine from Expiry Audit Report Reorder action
  useEffect(() => {
    const handleProcure = (payload: ReorderTargetPayload) => {
      if (payload.module && payload.module !== 'inventory') return;
      if (payload.timestamp && payload.timestamp <= lastProcessedReorderTime.current) return;
      lastProcessedReorderTime.current = payload.timestamp || Date.now();

      setSearchTerm(payload.medicineName);
      setProcurementNotice({
        medicineName: payload.medicineName,
        batchNumber: payload.batchNumber,
        expiryDate: payload.expiryDate,
        stockQuantity: payload.stockQuantity,
        supplier: payload.supplier
      });

      // Match item from loaded items
      const targetLower = payload.medicineName.trim().toLowerCase();
      const matched = items.find(
        m => (payload.medicineId && m.id === payload.medicineId) ||
             m.name.toLowerCase() === targetLower ||
             m.name.toLowerCase().includes(targetLower) ||
             targetLower.includes(m.name.toLowerCase())
      );

      if (matched) {
        setSelectedMedicine(matched);
        setSelectedIds([matched.id]);
        setIsBatchModalOpen(true);
        // Pre-fill suggested restock quantity based on expiring batch
        const suggestedUnits = Math.max(10, payload.stockQuantity || (matched.minThreshold ? matched.minThreshold * 2 : 20));
        setNewBatch({
          batchNumber: '',
          expiryDate: '',
          quantity: suggestedUnits,
          storageCondition: ''
        });
      }
    };

    if (reorderTarget) {
      handleProcure(reorderTarget);
    }

    const onProcureEvent = (e: any) => {
      if (e?.detail) {
        handleProcure(e.detail);
      }
    };

    window.addEventListener('procure-reorder-medicine', onProcureEvent);
    return () => window.removeEventListener('procure-reorder-medicine', onProcureEvent);
  }, [reorderTarget, items]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const initialBatch = {
        id: crypto.randomUUID(),
        batchNumber: formData.batchNumber || 'N/A',
        expiryDate: formData.expiryDate,
        quantity: formData.stockQuantity
      };

      const customLocation: StorageLocation = {
        aisle: formData.aisle || 'Aisle A',
        rack: formData.rack || 'Rack R-01',
        shelf: formData.shelf || 'Shelf Level 2',
        bin: formData.bin || 'Bin 01',
        notes: formData.notes || ''
      };

      const medicinePayload = {
        name: formData.name,
        genericName: formData.genericName || formData.salt || '',
        salt: formData.salt || '',
        formula: formData.formula || formData.salt || '',
        barcode: formData.barcode || '',
        rate: Number(formData.rate) || 0,
        type: formData.type || 'tablet',
        minThreshold: Number(formData.minThreshold) || 10,
        stockQuantity: Number(formData.stockQuantity) || 0,
        mfgDate: formData.mfgDate || '',
        expiryDate: formData.expiryDate || '',
        batchNumber: formData.batchNumber || '',
        batches: [initialBatch],
        location: customLocation,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'inventory'), medicinePayload);

      // Persist to Room local database
      const roomItem: Medicine = { id: docRef.id, ...medicinePayload };
      await roomInsertItem(roomItem).catch(e => console.warn('Room DB insert notice:', e));

      // Log to Stock Movement Audit Ledger
      await logStockMovement({
        medicineId: docRef.id,
        medicineName: formData.name,
        batchNumber: formData.batchNumber || 'GEN-01',
        type: 'addition',
        quantity: Number(formData.stockQuantity) || 0,
        previousStock: 0,
        newStock: Number(formData.stockQuantity) || 0,
        reason: 'Initial inventory intake via Product Add FAB (Room DB)',
        userName: profile?.displayName || profile?.email?.split('@')[0] || 'Staff',
        userRole: profile?.role || 'clerk'
      }).catch(e => console.warn('Audit movement notice:', e));

      await logActivity({
        action: 'Medicine Added',
        description: `Added new medication: ${formData.name} (${formData.stockQuantity} units, ${formData.type?.toUpperCase()}, ₹${formData.rate}) at ${customLocation.aisle} • ${customLocation.rack} • ${customLocation.shelf}`,
        type: 'inventory',
        module: 'inventory',
        userEmail: profile?.email || 'admin@satyampharma.com',
        userId: profile?.uid,
        userName: profile?.displayName || profile?.email?.split('@')[0] || 'Staff',
        userRole: profile?.role || 'clerk',
        severity: 'success',
        details: {
          medicineName: formData.name,
          genericName: formData.genericName || '-',
          stockQuantity: formData.stockQuantity,
          rate: formData.rate,
          batchNumber: formData.batchNumber || 'N/A',
          expiryDate: formData.expiryDate,
          type: formData.type,
          location: `${customLocation.aisle} -> ${customLocation.rack} -> ${customLocation.shelf}`
        }
      });

      setIsAddModalOpen(false);
      fetchData();
      setFormData({ name: '', expiryDate: '', stockQuantity: 0, rate: 0, type: 'tablet', barcode: '', minThreshold: 10, batchNumber: '', genericName: '', salt: '', aisle: 'Aisle A', rack: 'Rack R-01', shelf: 'Shelf Level 2', bin: 'Bin 01', notes: '' });
    } catch (error) {
      console.error(error);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMedicine) return;

    try {
      const oldLoc = getMedicineLocation(editingMedicine);
      const updatedLocation: StorageLocation = {
        aisle: editFormData.aisle || 'Aisle A',
        rack: editFormData.rack || 'Rack R-01',
        shelf: editFormData.shelf || 'Shelf Level 2',
        bin: editFormData.bin || 'Bin 01',
        notes: editFormData.notes || ''
      };

      const oldLocationStr = `${oldLoc.aisle} • ${oldLoc.rack} • ${oldLoc.shelf}${oldLoc.bin ? ` (${oldLoc.bin})` : ''}`;
      const newLocationStr = `${updatedLocation.aisle} • ${updatedLocation.rack} • ${updatedLocation.shelf}${updatedLocation.bin ? ` (${updatedLocation.bin})` : ''}`;

      // Build structured field-by-field diff list
      const fieldDiffs: any[] = [];
      const previousValues: Record<string, any> = {};
      const newValues: Record<string, any> = {};

      const newRate = Number(editFormData.rate);
      if (editingMedicine.rate !== newRate) {
        const delta = newRate - editingMedicine.rate;
        fieldDiffs.push({
          field: 'rate',
          label: 'Unit Price / MRP',
          oldValue: editingMedicine.rate,
          newValue: newRate,
          delta: `${delta >= 0 ? '+' : ''}₹${delta.toFixed(2)}`,
          unit: 'INR'
        });
        previousValues.rate = editingMedicine.rate;
        newValues.rate = newRate;
      }

      const newThreshold = Number(editFormData.minThreshold);
      if ((editingMedicine.minThreshold || 10) !== newThreshold) {
        const delta = newThreshold - (editingMedicine.minThreshold || 10);
        fieldDiffs.push({
          field: 'minThreshold',
          label: 'Safety Threshold',
          oldValue: editingMedicine.minThreshold || 10,
          newValue: newThreshold,
          delta: `${delta >= 0 ? '+' : ''}${delta} units`,
          unit: 'Units'
        });
        previousValues.minThreshold = editingMedicine.minThreshold || 10;
        newValues.minThreshold = newThreshold;
      }

      if (editingMedicine.name !== editFormData.name) {
        fieldDiffs.push({
          field: 'name',
          label: 'Medicine Name',
          oldValue: editingMedicine.name,
          newValue: editFormData.name
        });
        previousValues.name = editingMedicine.name;
        newValues.name = editFormData.name;
      }

      if ((editingMedicine.genericName || '') !== (editFormData.genericName || '')) {
        fieldDiffs.push({
          field: 'genericName',
          label: 'Generic Formula',
          oldValue: editingMedicine.genericName || '-',
          newValue: editFormData.genericName || '-'
        });
        previousValues.genericName = editingMedicine.genericName || '';
        newValues.genericName = editFormData.genericName || '';
      }

      if (editingMedicine.type !== editFormData.type) {
        fieldDiffs.push({
          field: 'type',
          label: 'Dosage Form / Category',
          oldValue: editingMedicine.type,
          newValue: editFormData.type
        });
        previousValues.type = editingMedicine.type;
        newValues.type = editFormData.type;
      }

      if (editingMedicine.expiryDate !== editFormData.expiryDate) {
        fieldDiffs.push({
          field: 'expiryDate',
          label: 'Expiry Date',
          oldValue: editingMedicine.expiryDate,
          newValue: editFormData.expiryDate
        });
        previousValues.expiryDate = editingMedicine.expiryDate;
        newValues.expiryDate = editFormData.expiryDate;
      }

      if (oldLocationStr !== newLocationStr) {
        fieldDiffs.push({
          field: 'location',
          label: 'Shelf Storage Coordinates',
          oldValue: oldLocationStr,
          newValue: newLocationStr
        });
        previousValues.location = oldLocationStr;
        newValues.location = newLocationStr;
      }

      if ((editingMedicine.barcode || '') !== (editFormData.barcode || '')) {
        fieldDiffs.push({
          field: 'barcode',
          label: 'Barcode / SKU',
          oldValue: editingMedicine.barcode || '-',
          newValue: editFormData.barcode || '-'
        });
        previousValues.barcode = editingMedicine.barcode || '';
        newValues.barcode = editFormData.barcode || '';
      }

      const docRef = doc(db, 'inventory', editingMedicine.id);
      await updateDoc(docRef, {
        name: editFormData.name,
        genericName: editFormData.genericName || '',
        salt: editFormData.salt || '',
        barcode: editFormData.barcode || '',
        rate: Number(editFormData.rate),
        type: editFormData.type,
        minThreshold: Number(editFormData.minThreshold),
        expiryDate: editFormData.expiryDate,
        location: updatedLocation,
        updatedAt: new Date().toISOString()
      });

      const changeSummaryStr = fieldDiffs.length > 0
        ? fieldDiffs.map(d => `${d.label}: ${d.oldValue} ➔ ${d.newValue}`).join('; ')
        : 'Updated coordinates and metadata';

      await logActivity({
        action: 'Medicine Updated',
        description: `Updated ${editFormData.name}: ${changeSummaryStr}`,
        type: 'inventory',
        module: 'inventory',
        userEmail: profile?.email || 'admin@satyampharma.com',
        userId: profile?.uid,
        userName: profile?.displayName || profile?.email?.split('@')[0] || 'Staff',
        userRole: profile?.role || 'clerk',
        severity: 'info',
        details: {
          medicineId: editingMedicine.id,
          medicineName: editFormData.name,
          currentStock: editingMedicine.stockQuantity,
          changes: fieldDiffs,
          previousValues,
          newValues,
          location: `${updatedLocation.aisle} -> ${updatedLocation.rack} -> ${updatedLocation.shelf}`
        }
      });

      setIsEditModalOpen(false);
      setEditingMedicine(null);
      fetchData();
    } catch (error) {
      console.error("Error updating medication:", error);
    }
  };

  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedicine) return;

    try {
      const batchToAdd = {
        id: crypto.randomUUID(),
        ...newBatch
      };

      const updatedBatches = [...selectedMedicine.batches, batchToAdd];
      const newTotalStock = updatedBatches.reduce((sum, b) => sum + b.quantity, 0);
      const nearestExpiry = updatedBatches.reduce((min, b) => b.expiryDate < min ? b.expiryDate : min, updatedBatches[0].expiryDate);

      const docRef = doc(db, 'inventory', selectedMedicine.id);
      await updateDoc(docRef, {
        batches: updatedBatches,
        stockQuantity: newTotalStock,
        expiryDate: nearestExpiry,
        updatedAt: new Date().toISOString()
      });

      await logActivity({
        action: 'Stock Batch Added',
        description: `Added batch ${newBatch.batchNumber} (+${newBatch.quantity} units, Exp: ${newBatch.expiryDate}) to ${selectedMedicine.name}`,
        type: 'inventory',
        module: 'inventory',
        userEmail: profile?.email || 'admin@satyampharma.com',
        userId: profile?.uid,
        userName: profile?.displayName || profile?.email?.split('@')[0] || 'Staff',
        userRole: profile?.role || 'clerk',
        severity: 'info',
        details: {
          medicineId: selectedMedicine.id,
          medicineName: selectedMedicine.name,
          batchNumber: newBatch.batchNumber,
          quantityAdded: newBatch.quantity,
          expiryDate: newBatch.expiryDate,
          newTotalStock: newTotalStock
        }
      });

      setIsBatchModalOpen(false);
      setNewBatch({ batchNumber: '', expiryDate: '', quantity: 0, storageCondition: '' });
      fetchData();
    } catch (error) {
      console.error("Error adding batch:", error);
    }
  };

  useEffect(() => {
    if (!openQuickActionRowId) return;
    const handleClickOutside = () => {
      setOpenQuickActionRowId(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openQuickActionRowId]);

  const handleOpenBatchQuickAction = (
    medicine: Medicine,
    batchNumber: string,
    actionType: BatchQuickActionType
  ) => {
    setOpenQuickActionRowId(null);
    setBatchQuickModalState({
      isOpen: true,
      actionType,
      medicine,
      batchNumber
    });
  };

  const handleConfirmDirectRestock = async ({
    medicine,
    batchNumber,
    quantityToAdd,
    supplierRef,
    notes
  }: {
    medicine: Medicine;
    batchNumber: string;
    quantityToAdd: number;
    supplierRef: string;
    notes: string;
  }) => {
    const existingBatches =
      medicine.batches && medicine.batches.length > 0
        ? medicine.batches
        : [
            {
              id: 'default-batch',
              batchNumber: medicine.batchNumber || batchNumber,
              expiryDate: medicine.expiryDate,
              quantity: medicine.stockQuantity,
              storageCondition: medicine.storageCondition
            }
          ];

    let targetFound = false;
    let prevBatchStock = 0;
    let newBatchStock = 0;

    const updatedBatches = existingBatches.map(b => {
      if (b.batchNumber === batchNumber) {
        targetFound = true;
        prevBatchStock = b.quantity;
        newBatchStock = b.quantity + quantityToAdd;
        return { ...b, quantity: newBatchStock };
      }
      return b;
    });

    if (!targetFound) {
      prevBatchStock = 0;
      newBatchStock = quantityToAdd;
      updatedBatches.push({
        id: crypto.randomUUID(),
        batchNumber,
        expiryDate: medicine.expiryDate,
        quantity: quantityToAdd,
        storageCondition: medicine.storageCondition
      });
    }

    const previousTotalStock = medicine.stockQuantity;
    const newTotalStock = updatedBatches.reduce((sum, b) => sum + b.quantity, 0);
    const nearestExpiry = updatedBatches.reduce(
      (min, b) => (b.expiryDate && b.expiryDate < min ? b.expiryDate : min),
      updatedBatches[0]?.expiryDate || medicine.expiryDate
    );

    const nowIso = new Date().toISOString();
    const updatedMedicine: Medicine = {
      ...medicine,
      batches: updatedBatches,
      stockQuantity: newTotalStock,
      expiryDate: nearestExpiry
    };

    setItems(prev => {
      const next = prev.map(m => (m.id === medicine.id ? updatedMedicine : m));
      roomSyncAllItems(next).catch(() => {});
      return next;
    });

    setBatchQuickModalState(prev =>
      prev.medicine?.id === medicine.id ? { ...prev, medicine: updatedMedicine } : prev
    );

    try {
      const docRef = doc(db, 'inventory', medicine.id);
      await updateDoc(docRef, {
        batches: updatedBatches,
        stockQuantity: newTotalStock,
        expiryDate: nearestExpiry,
        updatedAt: nowIso
      });
    } catch (err) {
      console.warn('Firestore direct restock sync fallback:', err);
    }

    await logStockMovement({
      medicineId: medicine.id,
      medicineName: medicine.name,
      batchNumber,
      type: 'addition',
      quantity: quantityToAdd,
      previousStock: prevBatchStock,
      newStock: newBatchStock,
      reason: notes || 'Direct Batch Restock',
      referenceId: supplierRef || undefined,
      userName: profile?.displayName || profile?.email?.split('@')[0] || 'Pharmacist',
      userRole: profile?.role || 'pharmacist'
    });

    await logActivity({
      action: 'Direct Batch Restock',
      description: `Restocked +${quantityToAdd} pcs into Batch #${batchNumber} of ${medicine.name} (Total: ${previousTotalStock} ➔ ${newTotalStock})`,
      type: 'inventory',
      module: 'inventory',
      userEmail: profile?.email || 'admin@satyampharma.com',
      userId: profile?.uid,
      userName: profile?.displayName || profile?.email?.split('@')[0] || 'Staff',
      userRole: profile?.role || 'clerk',
      severity: 'info',
      details: {
        medicineId: medicine.id,
        medicineName: medicine.name,
        batchNumber,
        quantityAdded: quantityToAdd,
        previousBatchStock: prevBatchStock,
        newBatchStock,
        previousTotalStock,
        newTotalStock,
        supplierRef
      }
    });
  };

  const handleConfirmMarkDamaged = async ({
    medicine,
    batchNumber,
    damagedQuantity,
    damageReason,
    notes
  }: {
    medicine: Medicine;
    batchNumber: string;
    damagedQuantity: number;
    damageReason: string;
    notes: string;
  }) => {
    const existingBatches =
      medicine.batches && medicine.batches.length > 0
        ? medicine.batches
        : [
            {
              id: 'default-batch',
              batchNumber: medicine.batchNumber || batchNumber,
              expiryDate: medicine.expiryDate,
              quantity: medicine.stockQuantity,
              storageCondition: medicine.storageCondition
            }
          ];

    let prevBatchStock = 0;
    let newBatchStock = 0;

    const updatedBatches = existingBatches.map((b, idx) => {
      if (b.batchNumber === batchNumber || (idx === 0 && existingBatches.length === 1)) {
        prevBatchStock = b.quantity;
        newBatchStock = Math.max(0, b.quantity - damagedQuantity);
        return { ...b, quantity: newBatchStock };
      }
      return b;
    });

    const previousTotalStock = medicine.stockQuantity;
    const newTotalStock = updatedBatches.reduce((sum, b) => sum + b.quantity, 0);

    const nowIso = new Date().toISOString();
    const updatedMedicine: Medicine = {
      ...medicine,
      batches: updatedBatches,
      stockQuantity: newTotalStock
    };

    setItems(prev => {
      const next = prev.map(m => (m.id === medicine.id ? updatedMedicine : m));
      roomSyncAllItems(next).catch(() => {});
      return next;
    });

    setBatchQuickModalState(prev =>
      prev.medicine?.id === medicine.id ? { ...prev, medicine: updatedMedicine } : prev
    );

    try {
      const docRef = doc(db, 'inventory', medicine.id);
      await updateDoc(docRef, {
        batches: updatedBatches,
        stockQuantity: newTotalStock,
        updatedAt: nowIso
      });
    } catch (err) {
      console.warn('Firestore damaged batch sync fallback:', err);
    }

    const fullReason = notes
      ? `Damaged Write-Off (${damageReason}): ${notes}`
      : `Damaged Write-Off: ${damageReason}`;

    await logStockMovement({
      medicineId: medicine.id,
      medicineName: medicine.name,
      batchNumber,
      type: 'subtraction',
      quantity: damagedQuantity,
      previousStock: prevBatchStock,
      newStock: newBatchStock,
      reason: fullReason,
      referenceId: `DMG-${batchNumber}`,
      userName: profile?.displayName || profile?.email?.split('@')[0] || 'Pharmacist',
      userRole: profile?.role || 'pharmacist'
    });

    await logActivity({
      action: 'Batch Marked as Damaged',
      description: `Marked ${damagedQuantity} pcs in Batch #${batchNumber} of ${medicine.name} as damaged (${damageReason})`,
      type: 'inventory',
      module: 'inventory',
      userEmail: profile?.email || 'admin@satyampharma.com',
      userId: profile?.uid,
      userName: profile?.displayName || profile?.email?.split('@')[0] || 'Staff',
      userRole: profile?.role || 'clerk',
      severity: 'warning',
      details: {
        medicineId: medicine.id,
        medicineName: medicine.name,
        batchNumber,
        damagedQuantity,
        damageReason,
        notes,
        previousBatchStock: prevBatchStock,
        newBatchStock,
        previousTotalStock,
        newTotalStock
      }
    });
  };

  const handleConfirmAddBatchNote = async ({
    medicine,
    batchNumber,
    noteText,
    updatedNotes
  }: {
    medicine: Medicine;
    batchNumber: string;
    noteText: string;
    updatedNotes: string[];
  }) => {
    const existingBatches =
      medicine.batches && medicine.batches.length > 0
        ? medicine.batches
        : [
            {
              id: 'default-batch',
              batchNumber: medicine.batchNumber || batchNumber,
              expiryDate: medicine.expiryDate,
              quantity: medicine.stockQuantity,
              storageCondition: medicine.storageCondition,
              notes: []
            }
          ];

    let targetFound = false;
    const latestNote = updatedNotes.length > 0 ? updatedNotes[updatedNotes.length - 1] : '';

    const updatedBatches = existingBatches.map((b, idx) => {
      if (b.batchNumber === batchNumber || (idx === 0 && existingBatches.length === 1)) {
        targetFound = true;
        return {
          ...b,
          notes: updatedNotes,
          latestNote
        };
      }
      return b;
    });

    if (!targetFound) {
      updatedBatches.push({
        id: crypto.randomUUID(),
        batchNumber,
        expiryDate: medicine.expiryDate,
        quantity: medicine.stockQuantity,
        storageCondition: medicine.storageCondition,
        notes: updatedNotes,
        latestNote
      });
    }

    const nowIso = new Date().toISOString();
    const updatedMedicine: Medicine = {
      ...medicine,
      batches: updatedBatches
    };

    setItems(prev => {
      const next = prev.map(m => (m.id === medicine.id ? updatedMedicine : m));
      roomSyncAllItems(next).catch(() => {});
      return next;
    });

    setBatchQuickModalState(prev =>
      prev.medicine?.id === medicine.id ? { ...prev, medicine: updatedMedicine } : prev
    );

    try {
      const docRef = doc(db, 'inventory', medicine.id);
      await updateDoc(docRef, {
        batches: updatedBatches,
        updatedAt: nowIso
      });
    } catch (err) {
      console.warn('Firestore batch note sync fallback:', err);
    }

    await logActivity({
      action: 'Batch Operational Note Updated',
      description: `Batch #${batchNumber} (${medicine.name}): "${noteText}"`,
      type: 'inventory',
      module: 'inventory',
      userEmail: profile?.email || 'admin@satyampharma.com',
      userId: profile?.uid,
      userName: profile?.displayName || profile?.email?.split('@')[0] || 'Staff',
      userRole: profile?.role || 'clerk',
      severity: 'info',
      details: {
        medicineId: medicine.id,
        medicineName: medicine.name,
        batchNumber,
        noteText,
        notesCount: updatedNotes.length
      }
    });
  };

  const getDaysUntilExpiry = (expiryDateStr: string): number => {
    if (!expiryDateStr) return 9999;
    const exp = new Date(expiryDateStr);
    if (isNaN(exp.getTime())) return 9999;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfExp = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());
    return Math.ceil((startOfExp.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getShelfLifeBadgeInfo = (daysRemaining: number) => {
    if (daysRemaining < 0) {
      return {
        statusLabel: 'Expired Shelf-Life',
        detailLabel: `${Math.abs(daysRemaining)}d Overdue • Quarantine`,
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800',
        dotClass: 'bg-rose-600 animate-pulse',
        tier: 'expired' as const
      };
    }
    if (daysRemaining <= 30) {
      return {
        statusLabel: 'Critical Shelf-Life',
        detailLabel: `${daysRemaining}d Left • FEFO Priority`,
        badgeClass: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/80 dark:text-red-300 dark:border-red-800',
        dotClass: 'bg-red-600 animate-pulse',
        tier: 'critical' as const
      };
    }
    if (daysRemaining <= 90) {
      return {
        statusLabel: 'Short Shelf-Life',
        detailLabel: `${daysRemaining}d (~${Math.max(1, Math.round(daysRemaining / 30))}m) • Fast-Track`,
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/75 dark:text-amber-300 dark:border-amber-700',
        dotClass: 'bg-amber-500',
        tier: 'warning' as const
      };
    }
    if (daysRemaining <= 180) {
      return {
        statusLabel: 'Moderate Shelf-Life',
        detailLabel: `~${Math.round(daysRemaining / 30)} Mos Stability`,
        badgeClass: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800',
        dotClass: 'bg-teal-500',
        tier: 'moderate' as const
      };
    }
    return {
      statusLabel: 'Optimal Shelf-Life',
      detailLabel: daysRemaining > 365
        ? `~${(daysRemaining / 365).toFixed(1)} Yrs Stability`
        : `~${Math.round(daysRemaining / 30)} Mos Stability`,
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
      dotClass: 'bg-emerald-500',
      tier: 'optimal' as const
    };
  };

  const getBatchStorageConditionBadges = (item: Medicine, location: StorageLocation, explicitCondition?: string) => {
    const cond = (explicitCondition || item.batches?.[0]?.storageCondition || item.storageCondition || '').toLowerCase();
    const nameUpper = (item.name || '').toUpperCase();
    const saltUpper = `${item.genericName || ''} ${item.salt || ''} ${item.formula || ''}`.toUpperCase();

    if (
      cond === 'cold_chain' ||
      location.zone === 'cold_storage' ||
      item.type === 'injection' ||
      nameUpper.includes('INSULIN') ||
      nameUpper.includes('VACCINE') ||
      saltUpper.includes('INSULIN')
    ) {
      return {
        primaryLabel: 'Cold Chain (2°C–8°C)',
        secondaryLabel: 'Do Not Freeze • Light Sensitive',
        iconType: 'cold' as const,
        primaryClass: 'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800',
        secondaryClass: 'bg-sky-50/80 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/70'
      };
    }

    if (
      cond === 'controlled_lockbox' ||
      location.zone === 'schedule_h' ||
      nameUpper.includes('ALPRAZOLAM') ||
      nameUpper.includes('CLONAZEPAM') ||
      nameUpper.includes('DIAZEPAM') ||
      nameUpper.includes('TRAMADOL')
    ) {
      return {
        primaryLabel: 'Controlled Safe (15°C–25°C)',
        secondaryLabel: 'Schedule H1 Lockbox • Dry',
        iconType: 'lock' as const,
        primaryClass: 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
        secondaryClass: 'bg-fuchsia-50/80 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-300 dark:border-fuchsia-800/70'
      };
    }

    if (
      cond === 'cool_dark' ||
      location.zone === 'liquids' ||
      item.type === 'syrup' ||
      nameUpper.includes('SYRUP') ||
      nameUpper.includes('SUSPENSION') ||
      nameUpper.includes('DROPS')
    ) {
      return {
        primaryLabel: 'Cool & Dark (<25°C)',
        secondaryLabel: 'Protect from Light • Upright',
        iconType: 'liquid' as const,
        primaryClass: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
        secondaryClass: 'bg-blue-50/80 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/70'
      };
    }

    if (
      cond === 'moisture_sensitive' ||
      item.type === 'capsule' ||
      saltUpper.includes('CLAVULANIC') ||
      saltUpper.includes('AMOXICILLIN') ||
      saltUpper.includes('PANTOPRAZOLE') ||
      saltUpper.includes('OMEGA')
    ) {
      return {
        primaryLabel: 'Dry & Airtight (<25°C, RH <60%)',
        secondaryLabel: 'Moisture-Barrier Blister',
        iconType: 'moisture' as const,
        primaryClass: 'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800',
        secondaryClass: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:border-slate-700'
      };
    }

    return {
      primaryLabel: 'Controlled Room (15°C–25°C)',
      secondaryLabel: 'Cool & Dry • Original Strip',
      iconType: 'ambient' as const,
      primaryClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      secondaryClass: 'bg-slate-50 text-slate-500 border-slate-200/80 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700/60'
    };
  };

  const getSortedItemBatches = (item: Medicine, direction: 'asc' | 'desc' = 'asc'): Batch[] => {
    const rawBatches: Batch[] = item.batches && item.batches.length > 0
      ? item.batches
      : [{
          id: 'default-batch',
          batchNumber: item.batchNumber || `LOT-${item.id.slice(0, 4).toUpperCase()}`,
          expiryDate: item.expiryDate,
          quantity: item.stockQuantity,
          storageCondition: item.storageCondition,
          notes: []
        }];

    return [...rawBatches].sort((a, b) => {
      const timeA = new Date(a.expiryDate).getTime();
      const timeB = new Date(b.expiryDate).getTime();
      const validA = !isNaN(timeA);
      const validB = !isNaN(timeB);
      if (!validA && !validB) return (a.batchNumber || '').localeCompare(b.batchNumber || '');
      if (!validA) return 1;
      if (!validB) return -1;
      return direction === 'asc' ? timeA - timeB : timeB - timeA;
    });
  };

  const getNearestBatchExpiryTime = (item: Medicine): number => {
    const sorted = getSortedItemBatches(item, 'asc');
    for (const b of sorted) {
      const t = new Date(b.expiryDate).getTime();
      if (!isNaN(t)) return t;
    }
    const fallback = new Date(item.expiryDate).getTime();
    return isNaN(fallback) ? Number.MAX_SAFE_INTEGER : fallback;
  };

  const getItemBatchGroupKey = (item: Medicine): { key: string; label: string; priority: number } => {
    const loc = getMedicineLocation(item);
    const storage = getBatchStorageConditionBadges(item, loc);
    switch (storage.iconType) {
      case 'cold':
        return { key: 'cold', label: 'Cold Chain Group', priority: 1 };
      case 'lock':
        return { key: 'lock', label: 'Controlled Safe Group', priority: 2 };
      case 'liquid':
        return { key: 'liquid', label: 'Cool & Dark Group', priority: 3 };
      case 'moisture':
        return { key: 'moisture', label: 'Dry & Airtight Group', priority: 4 };
      default:
        return { key: 'ambient', label: 'Controlled Room Group', priority: 5 };
    }
  };

  const handleResetAllFilters = () => {
    setFilter('all');
    setAdvancedFilters(DEFAULT_INVENTORY_FILTERS);
    setSearchTerm('');
    setBatchGroupSortMode('off');
    setFocusedBatchGroup(null);
  };

  const filteredItems = items.filter(item => {
    const s = searchTerm.toLowerCase().trim();
    const itemSupplier = getMedicineSupplier(item);
    const itemLocation = getMedicineLocation(item);

    // Search query match
    if (s.length > 0) {
      const matchesSearch = item.name.toLowerCase().includes(s) || 
                            item.genericName?.toLowerCase().includes(s) ||
                            item.salt?.toLowerCase().includes(s) ||
                            item.barcode?.toLowerCase().includes(s) ||
                            itemSupplier.toLowerCase().includes(s) ||
                            itemLocation.aisle.toLowerCase().includes(s) ||
                            itemLocation.rack.toLowerCase().includes(s);
      if (!matchesSearch) return false;
    }
    
    // 1. Category Filter
    if (advancedFilters.category !== 'all') {
      const itemCategory = (item.type || 'others').toLowerCase();
      if (itemCategory !== advancedFilters.category) return false;
    }

    // 2. Storage Location Filter (Aisle, Rack, Shelf)
    if (advancedFilters.aisle !== 'all' && itemLocation.aisle !== advancedFilters.aisle) {
      return false;
    }
    if (advancedFilters.rack !== 'all' && itemLocation.rack !== advancedFilters.rack) {
      return false;
    }
    if (advancedFilters.shelf !== 'all' && itemLocation.shelf !== advancedFilters.shelf) {
      return false;
    }

    // 3. Supplier Filter
    if (advancedFilters.supplier !== 'all' && itemSupplier !== advancedFilters.supplier) {
      return false;
    }

    // 4. Stock Status Filter
    const threshold = item.minThreshold || 10;
    const pred = predictionsMap[item.id] || predictionsMap[item.name];

    if (advancedFilters.stockStatus === 'out_of_stock') {
      if (item.stockQuantity > 0) return false;
    } else if (advancedFilters.stockStatus === 'low') {
      if (item.stockQuantity > threshold) return false;
    } else if (advancedFilters.stockStatus === 'healthy') {
      if (item.stockQuantity <= threshold) return false;
      if (pred && pred.daysUntilStockOut <= 15) return false;
    } else if (advancedFilters.stockStatus === 'stockout7') {
      if (item.stockQuantity > 0 && (!pred || pred.daysUntilStockOut > 7)) return false;
    } else if (advancedFilters.stockStatus === 'stockout15') {
      if (!pred || pred.daysUntilStockOut <= 7 || pred.daysUntilStockOut > 15) return false;
    } else if (advancedFilters.stockStatus === 'stockout30') {
      if (!pred || pred.daysUntilStockOut <= 15 || pred.daysUntilStockOut > 30) return false;
    } else if (advancedFilters.stockStatus === 'overstocked') {
      const isOver = item.stockQuantity >= threshold * 3 || (pred && pred.daysUntilStockOut > 90);
      if (!isOver) return false;
    }

    // Legacy quick filter fallback if advancedFilters.stockStatus is 'all'
    if (advancedFilters.stockStatus === 'all') {
      if (filter === 'low' && item.stockQuantity > threshold) return false;
      if (filter === 'stockout7' && item.stockQuantity > 0 && (!pred || pred.daysUntilStockOut > 7)) return false;
      if (filter === 'stockout15' && (!pred || pred.daysUntilStockOut <= 7 || pred.daysUntilStockOut > 15)) return false;
      if (filter === 'stockout30' && (!pred || pred.daysUntilStockOut <= 15 || pred.daysUntilStockOut > 30)) return false;
      if (filter === 'healthy' && (item.stockQuantity <= threshold || (pred && pred.daysUntilStockOut <= 30))) return false;
    }

    // 5. Expiry Status Filter
    const daysRemaining = getDaysUntilExpiry(item.expiryDate);
    if (advancedFilters.expiryStatus === 'expired') {
      if (daysRemaining >= 0) return false;
    } else if (advancedFilters.expiryStatus === 'expiry30') {
      if (daysRemaining < 0 || daysRemaining > 30) return false;
    } else if (advancedFilters.expiryStatus === 'expiry60') {
      if (daysRemaining < 0 || daysRemaining > 60) return false;
    } else if (advancedFilters.expiryStatus === 'expiry90') {
      if (daysRemaining < 0 || daysRemaining > 90) return false;
    } else if (advancedFilters.expiryStatus === 'safe') {
      if (daysRemaining <= 90) return false;
    }

    // Legacy expiry filter fallback if advancedFilters.expiryStatus is 'all'
    if (advancedFilters.expiryStatus === 'all') {
      if (filter === 'expired' && daysRemaining >= 0) return false;
      if (filter.startsWith('expiry') && filter !== 'expired') {
        const days = parseInt(filter.replace('expiry', ''));
        if (daysRemaining < 0 || daysRemaining > days) return false;
      }
    }
    
    return true;
  }).sort((a, b) => {
    if (batchGroupSortMode !== 'off') {
      const groupA = getItemBatchGroupKey(a);
      const groupB = getItemBatchGroupKey(b);

      // If user clicked a specific batch group inside a Batch Details cell, prioritize that group at the top
      if (focusedBatchGroup) {
        const isAFocused = groupA.key === focusedBatchGroup;
        const isBFocused = groupB.key === focusedBatchGroup;
        if (isAFocused && !isBFocused) return -1;
        if (!isAFocused && isBFocused) return 1;
      }

      // Group items by their batch group first
      if (groupA.priority !== groupB.priority) {
        return groupA.priority - groupB.priority;
      }

      // Within the same batch group, order by nearest batch expiration date
      const nearestA = getNearestBatchExpiryTime(a);
      const nearestB = getNearestBatchExpiryTime(b);
      if (nearestA !== nearestB) {
        return batchGroupSortMode === 'asc' ? nearestA - nearestB : nearestB - nearestA;
      }
      return a.name.localeCompare(b.name);
    }

    if (sortByExpiry) {
      const dateA = getNearestBatchExpiryTime(a);
      const dateB = getNearestBatchExpiryTime(b);
      
      if (dateA !== dateB) {
        return dateA - dateB; // Nearest expiration date first (ascending)
      }
      return a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  });

  const expiredMedicines = items.filter(m => getDaysUntilExpiry(m.expiryDate) < 0);
  const criticalExpiryMedicines = items.filter(m => {
    const d = getDaysUntilExpiry(m.expiryDate);
    return d >= 0 && d <= 30;
  });
  const warningExpiryMedicines = items.filter(m => {
    const d = getDaysUntilExpiry(m.expiryDate);
    return d > 30 && d <= 90;
  });
  const safeExpiryMedicines = items.filter(m => getDaysUntilExpiry(m.expiryDate) > 90);
  const zeroStockMedicines = items.filter(m => m.stockQuantity <= 0);
  const selectedMedicinesList = items.filter(m => selectedIds.includes(m.id));

  const toggleSelectItem = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const allFilteredIds = filteredItems.map(i => i.id);
  const areAllFilteredSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.includes(id));
  const areSomeFilteredSelected = allFilteredIds.some(id => selectedIds.includes(id)) && !areAllFilteredSelected;

  const toggleSelectAllFiltered = () => {
    if (areAllFilteredSelected) {
      setSelectedIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const selectAllExpired = () => {
    const expiredIds = expiredMedicines.map(m => m.id);
    if (expiredIds.length > 0) {
      setSelectedIds(prev => Array.from(new Set([...prev, ...expiredIds])));
    }
  };

  const selectAllZeroStock = () => {
    const zeroIds = zeroStockMedicines.map(m => m.id);
    if (zeroIds.length > 0) {
      setSelectedIds(prev => Array.from(new Set([...prev, ...zeroIds])));
    }
  };

  const selectAllMedicines = () => {
    setSelectedIds(items.map(m => m.id));
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const toggleVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN'; // Default to English India, but works for generic English too
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSearchTerm(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const downloadInventoryReport = () => {
    const doc = new jsPDF();
    
    // Add header branding
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("VITAL PHARMA", 14, 25);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("INVENTORY AUDIT REPORT", 14, 32);
    
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Generated: ${new Date().toLocaleString()}`, 140, 25);
    
    // Table content
    const tableColumn = ["Medicine Name", "Batches", "Type", "Stock", "Expiry", "Rate"];
    const tableRows = filteredItems.map(item => [
      item.name,
      item.batches.map(b => b.batchNumber).join(', '),
      item.type.toUpperCase(),
      item.stockQuantity.toString(),
      formatDate(item.expiryDate),
      formatCurrency(item.rate)
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 50,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { top: 50 }
    });

    // Add footer with page numbers
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
    }

    doc.save(`Inventory_Audit_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const escapeCSVField = (val: any): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const exportToCSV = async () => {
    const isFinancialAuthorized = canViewFinancials(profile);
    const isSupplierAuthorized = canViewSuppliers(profile);
    const totalItems = filteredItems.length;
    const totalStockUnits = filteredItems.reduce((acc, item) => acc + item.stockQuantity, 0);
    const totalValuation = filteredItems.reduce((acc, item) => acc + (item.rate * item.stockQuantity), 0);
    const todayStr = new Date().toISOString().split('T')[0];

    const metadata = [
      ["PHARMACY INVENTORY AUDIT REPORT"],
      [`Generated On`, new Date().toLocaleString()],
      [`Total SKU Records`, totalItems],
      [`Total Stock Units`, totalStockUnits],
      [`Total Valuation (INR)`, isFinancialAuthorized ? totalValuation.toFixed(2) : "Confidential (Masked)"],
      []
    ].map(row => row.map(cell => escapeCSVField(cell)).join(','));

    const headers = [
      "Medicine Name",
      "Generic / Active Formula",
      "Dosage Form / Type",
      "Barcode / SKU",
      "Manufacturer",
      "Supplier",
      "Current Stock Qty",
      "Min Reorder Threshold",
      "Stock Level Status",
      "Unit Rate (INR)",
      "Total Stock Valuation (INR)",
      "Earliest Expiry Date",
      "Days To Expiry",
      "Expiry Alert Status",
      "Batches Count",
      "Batch Breakdown Details"
    ].map(h => escapeCSVField(h)).join(",");

    const rows = filteredItems.map(item => {
      const now = new Date();
      const expiryDate = new Date(item.expiryDate);
      const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      let stockStatus = 'In Stock';
      const threshold = item.minThreshold || 10;
      if (item.stockQuantity <= 0) stockStatus = 'Out of Stock';
      else if (item.stockQuantity <= threshold * 0.3) stockStatus = 'Critical Low';
      else if (item.stockQuantity <= threshold) stockStatus = 'Low Stock';

      let expiryStatus = 'Valid';
      if (diffDays <= 0) expiryStatus = 'EXPIRED';
      else if (diffDays <= 30) expiryStatus = 'Critical (≤30 Days)';
      else if (diffDays <= 90) expiryStatus = 'Warning (≤90 Days)';

      const batchString = item.batches && item.batches.length > 0
        ? item.batches.map(b => `${b.batchNumber} [Exp:${b.expiryDate}, Qty:${b.quantity}]`).join(' | ')
        : 'N/A';

      return [
        escapeCSVField(item.name),
        escapeCSVField(item.genericName || item.salt || '-'),
        escapeCSVField(item.type ? item.type.toUpperCase() : '-'),
        escapeCSVField(item.barcode || '-'),
        escapeCSVField(item.manufacturer || '-'),
        escapeCSVField(isSupplierAuthorized ? (item.supplier || '-') : 'Confidential (Admin Only)'),
        escapeCSVField(item.stockQuantity),
        escapeCSVField(threshold),
        escapeCSVField(stockStatus),
        escapeCSVField(item.rate),
        escapeCSVField(isFinancialAuthorized ? (item.rate * item.stockQuantity).toFixed(2) : '••••••'),
        escapeCSVField(item.expiryDate),
        escapeCSVField(diffDays),
        escapeCSVField(expiryStatus),
        escapeCSVField(item.batches ? item.batches.length : 0),
        escapeCSVField(batchString)
      ].join(",");
    });

    const csvContent = "\uFEFF" + [...metadata, headers, ...rows].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Inventory_Audit_Report_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    await logActivity({
      action: 'Inventory Audit CSV Exported',
      description: `Exported comprehensive CSV audit report for ${totalItems} medicines (Stock: ${totalStockUnits} units, Valuation: ₹${totalValuation.toFixed(2)})`,
      type: 'inventory',
      module: 'inventory',
      userEmail: profile?.email || 'admin@satyampharma.com',
      userId: profile?.uid,
      userName: profile?.displayName || profile?.email?.split('@')[0] || 'Staff',
      userRole: profile?.role || 'clerk',
      severity: 'info',
      details: {
        totalSKUs: totalItems,
        totalUnits: totalStockUnits,
        totalValuation: totalValuation
      }
    });
  };

  const downloadPurchaseOrder = (itemsToRestock: Medicine[]) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("DRAFT PURCHASE ORDER", 14, 25);
    doc.setFontSize(10);
    doc.text(`Generated On: ${new Date().toLocaleDateString()}`, 14, 33);

    // Table
    const tableColumn = ["Item Name", "Generic", "Current Stock", "Threshold", "Suggested Order"];
    const tableRows = itemsToRestock.map(item => [
      item.name,
      item.genericName || '-',
      item.stockQuantity.toString(),
      (item.minThreshold || 10).toString(),
      ((item.minThreshold || 10) * 2 - item.stockQuantity).toString() // Suggest ordering up to 2x threshold
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 50,
      headStyles: { fillColor: [37, 99, 235] }
    });

    doc.save(`Purchase_Order_Draft_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleUpdateThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedicine) return;

    try {
      const docRef = doc(db, 'inventory', selectedMedicine.id);
      await updateDoc(docRef, {
        minThreshold: newThreshold,
        updatedAt: new Date().toISOString()
      });

      await logActivity({
        action: 'Safety Threshold Updated',
        description: `Updated minimum safety threshold for ${selectedMedicine.name} from ${selectedMedicine.minThreshold || 10} to ${newThreshold} units`,
        type: 'inventory',
        module: 'inventory',
        userEmail: profile?.email || 'admin@satyampharma.com',
        userId: profile?.uid,
        userName: profile?.displayName || profile?.email?.split('@')[0] || 'Staff',
        userRole: profile?.role || 'clerk',
        severity: 'info',
        details: {
          medicineId: selectedMedicine.id,
          medicineName: selectedMedicine.name,
          oldThreshold: selectedMedicine.minThreshold || 10,
          newThreshold: newThreshold
        }
      });

      setIsThresholdModalOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error updating threshold:", error);
    }
  };

  const lowStockItems = items.filter(m => m.stockQuantity <= (m.minThreshold || 10));

  // Product Diversity & Quantity Calculations
  const totalProductTypes = items.length;
  const totalStockQuantity = items.reduce((acc, med) => acc + (med.stockQuantity || 0), 0);
  const totalBatchesCount = items.reduce((acc, med) => acc + (med.batches?.length || 1), 0);
  const totalUniqueFormulas = new Set(
    items.map(m => (m.formula || m.salt || m.genericName || '').trim()).filter(Boolean)
  ).size;

  const productTypeBreakdown = {
    tablet: { count: items.filter(m => m.type === 'tablet').length, qty: items.filter(m => m.type === 'tablet').reduce((s, m) => s + (m.stockQuantity || 0), 0) },
    capsule: { count: items.filter(m => m.type === 'capsule').length, qty: items.filter(m => m.type === 'capsule').reduce((s, m) => s + (m.stockQuantity || 0), 0) },
    syrup: { count: items.filter(m => m.type === 'syrup').length, qty: items.filter(m => m.type === 'syrup').reduce((s, m) => s + (m.stockQuantity || 0), 0) },
    injection: { count: items.filter(m => m.type === 'injection').length, qty: items.filter(m => m.type === 'injection').reduce((s, m) => s + (m.stockQuantity || 0), 0) },
    others: { count: items.filter(m => m.type === 'others' || !['tablet', 'capsule', 'syrup', 'injection'].includes(m.type)).length, qty: items.filter(m => m.type === 'others' || !['tablet', 'capsule', 'syrup', 'injection'].includes(m.type)).reduce((s, m) => s + (m.stockQuantity || 0), 0) },
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.35,
        ease: "easeOut",
        staggerChildren: 0.05
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
      <motion.header variants={itemVariants} className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t('inventory')}</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Real-time Stock & Expiry Monitoring • {totalProductTypes} Medicine Types Recorded</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Primary QR / Barcode Product Intake Button */}
          <button 
            type="button"
            onClick={() => setIsScanToAddModalOpen(true)}
            id="inventory-open-scan-to-add-product-btn"
            className="flex items-center gap-2 rounded-xl border border-blue-400 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-white shadow-md shadow-blue-500/25 transition-all hover:shadow-lg hover:scale-[1.02] active:scale-95 cursor-pointer"
            title="Scan QR / Barcode with Camera or Image to automatically extract chemical formula, mfg date, expiry, rate, and add medicine records"
          >
            <QrCode size={16} className="animate-pulse" />
            <span>Scan QR / Barcode to Add</span>
          </button>

          <button 
            type="button"
            onClick={() => setIsScanToVerifyOpen(true)}
            id="inventory-open-scan-to-verify-btn"
            className="flex items-center gap-2 rounded-lg border border-emerald-400 bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-md shadow-emerald-500/20 transition-all hover:shadow-lg hover:scale-[1.02] active:scale-95 cursor-pointer"
            title="Scan medicine barcodes with camera to verify physical shelf stock against database records and flag audit discrepancies"
          >
            <Scan size={16} className="animate-pulse" />
            <span>Scan-to-Verify (Audit)</span>
          </button>
          <button 
            type="button"
            onClick={() => {
              setLocatorTargetMedicine(filteredItems.length > 0 ? filteredItems[0] : (items.length > 0 ? items[0] : null));
              setIsLocatorModalOpen(true);
            }}
            id="inventory-open-shelf-locator-btn"
            className="flex items-center gap-2 rounded-lg border border-cyan-300 bg-gradient-to-r from-cyan-50 via-blue-50 to-cyan-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-cyan-900 shadow-sm transition-all hover:border-cyan-400 hover:shadow-md active:scale-95 dark:border-cyan-900/50 dark:bg-cyan-950/40 dark:text-cyan-300 cursor-pointer"
            title="Open 2D Pharmacy Floor Plan & 4-Tier Shelf Locator for physical stock retrieval"
          >
            <Compass size={16} className="text-cyan-600 dark:text-cyan-400 animate-spin-slow" />
            <span>Shelf Locator (Floor Map)</span>
          </button>
          <button 
            type="button"
            onClick={() => setIsDemandForecasterOpen(true)}
            id="inventory-open-ai-demand-forecaster-btn"
            className="flex items-center gap-2 rounded-lg border border-purple-300 bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-purple-900 shadow-sm transition-all hover:border-purple-400 hover:shadow-md active:scale-95 dark:border-purple-900/50 dark:bg-purple-950/40 dark:text-purple-300 cursor-pointer"
            title="AI-powered stock demand forecasting based on seasonal disease patterns and run-rates"
          >
            <Sparkles size={16} className="text-purple-600 dark:text-purple-400 animate-pulse" />
            <span>AI Demand Forecaster</span>
          </button>
          <button 
            type="button"
            onClick={() => setIsSmartProcurementOpen(true)}
            id="inventory-open-smart-procurement-btn"
            className="flex items-center gap-2 rounded-lg border border-indigo-400 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-md shadow-indigo-500/25 transition-all hover:shadow-lg hover:scale-[1.02] active:scale-95 cursor-pointer"
            title="AI Smart Procurement: Analyze sales velocity & seasonal trends for optimal reorder quantities and timing"
          >
            <BrainCircuit size={16} className="text-indigo-200 animate-pulse" />
            <span>Smart Procurement (AI)</span>
          </button>
          <button 
            type="button"
            onClick={() => setIsPredictiveRefillModalOpen(true)}
            id="inventory-open-predictive-refill-header-btn"
            className="flex items-center gap-2 rounded-lg border border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-amber-900 shadow-sm transition-all hover:border-amber-400 hover:shadow-md active:scale-95 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300 cursor-pointer"
            title="AI Predictive Stock Refill: Projected stock-out dates & consumption velocity"
          >
            <Zap size={16} className="text-amber-600 dark:text-amber-400 animate-pulse" />
            <span>Predictive Refill</span>
          </button>
          <button 
            type="button"
            onClick={() => setIsBulkAdjustModalOpen(true)}
            id="inventory-open-bulk-adjust-btn"
            className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-blue-800 shadow-sm transition-all hover:bg-blue-100 active:scale-95 dark:border-blue-900/40 dark:bg-blue-950/50 dark:text-blue-300 cursor-pointer"
            title="Bulk adjust medication stock quantities, unit prices, or thresholds"
          >
            <Sliders size={16} className="text-blue-600 dark:text-blue-400" />
            <span>Adjust Stock (Bulk)</span>
          </button>
          <button 
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-expiry-report'))}
            id="inventory-open-90d-expiry-report-btn"
            className="flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-rose-800 shadow-sm transition-all hover:bg-rose-100 active:scale-95 dark:border-rose-900/40 dark:bg-rose-950/50 dark:text-rose-300 cursor-pointer"
            title="Open 90-day medication expiry risk radar and automated PDF reporting tool"
          >
            <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400" />
            <span>90D Expiry Audit</span>
          </button>
          <button 
            onClick={exportToCSV}
            id="download-inventory-report-csv-btn"
            className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-emerald-800 shadow-sm transition-all hover:bg-emerald-100 active:scale-95 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-pointer"
            title="Download current stock data and medicine records as a CSV file for auditing"
          >
            <FileDown size={16} />
            <span>CSV</span>
          </button>
          <button 
            onClick={downloadInventoryReport}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-600 shadow-sm transition-all hover:bg-slate-50 active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 cursor-pointer"
            title="Download PDF audit report"
          >
            <Download size={16} />
            <span>PDF</span>
          </button>
          <button 
            onClick={() => setIsRestockModalOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-orange-700 shadow-sm transition-all hover:bg-orange-100 active:scale-95 dark:border-orange-900/30 dark:bg-orange-900/20 dark:text-orange-400 cursor-pointer"
          >
            <AlertTriangle size={16} />
            <span>Restock</span>
          </button>
          <button 
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-stock-email-alerts'))}
            className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-rose-700 shadow-sm transition-all hover:bg-rose-100 active:scale-95 dark:border-rose-900/30 dark:bg-rose-950/40 dark:text-rose-300 cursor-pointer"
            title="Configure and preview automated email notifications for critical stock levels"
          >
            <Mail size={16} />
            <span>Alerts</span>
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg transition-transform active:scale-95 dark:bg-blue-600 cursor-pointer"
          >
            <Plus size={16} />
            <span>{t('add')}</span>
          </button>
        </div>
      </motion.header>

      {/* Expiry Audit Reorder Procurement Notice Banner */}
      {procurementNotice && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 border-2 border-indigo-300 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
              <Package size={22} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-white px-2 py-0.5 rounded-md">
                  Reorder In Progress
                </span>
                <span className="text-sm font-black">
                  Pre-selected: <strong>{procurementNotice.medicineName}</strong>
                </span>
              </div>
              <p className="text-xs text-indigo-800/90 dark:text-indigo-300/90 mt-0.5 font-medium">
                {procurementNotice.batchNumber && `Expiring Batch: ${procurementNotice.batchNumber}`}
                {procurementNotice.expiryDate && ` (Exp: ${procurementNotice.expiryDate})`}
                {procurementNotice.stockQuantity && ` • ${procurementNotice.stockQuantity} units to replenish`}
                {procurementNotice.supplier && ` • Preferred Wholesaler: ${procurementNotice.supplier}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {selectedMedicine && (
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(true)}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 text-xs font-black uppercase tracking-wider shadow-sm cursor-pointer transition-all hover:scale-105 active:scale-95"
              >
                Add Restock Batch
              </button>
            )}
            <button
              type="button"
              onClick={() => setProcurementNotice(null)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition-all"
            >
              Dismiss
            </button>
          </div>
        </motion.div>
      )}

      {/* Inventory Health Dashboard Widget: Average Shelf-Life Remaining & High-Velocity Turnover Flagging */}
      <motion.div variants={itemVariants}>
        <InventoryHealthDashboardWidget
          items={items}
          salesHistory={salesHistory}
          predictionsMap={predictionsMap}
          onSelectItem={(med) => {
            setSearchTerm(med.name);
          }}
          onQuickRestockItem={(med) => {
            const primaryBatch = med.batches?.[0]?.batchNumber || med.batchNumber || 'LOT-1';
            handleOpenBatchQuickAction(med, primaryBatch, 'restock');
          }}
          onFilterByShelfLife={(tier) => {
            setFilter(tier);
            if (tier !== 'all') {
              setSortByExpiry(true);
            }
          }}
        />
      </motion.div>

      {/* Automated 'Auto-Procurement' Recommendation Engine (Owner Executive Module) */}
      <motion.div variants={itemVariants}>
        <AutoProcurementEngineWidget
          items={items}
          salesHistory={salesHistory}
          onSelectMedicine={(med) => {
            setSearchTerm(med.name);
          }}
        />
      </motion.div>

      {/* Interactive Recharts Inventory Analytics Dashboard (Stock Level Trends & Expiry Distribution) */}
      <motion.div variants={itemVariants}>
        <InventoryAnalyticsDashboard
          items={items}
          onApplyFilter={(f) => {
            setFilter(f);
            // If user clicked expired, also enable sort by expiry to show immediate concerns
            if (f === 'expired' || f === 'expiry30') {
              setSortByExpiry(true);
            }
          }}
          activeFilter={filter}
        />
      </motion.div>

      {/* AI-Driven Predictive Stock Refill & Stock-Out Projection Widget */}
      <motion.div variants={itemVariants}>
        <PredictiveStockRefillWidget
          summary={predictiveRefillSummary}
          onOpenModal={() => setIsPredictiveRefillModalOpen(true)}
          activeFilter={filter}
          onSelectFilter={(f: string) => {
            setFilter(f as any);
          }}
        />
      </motion.div>

      {/* Medicine Records & Product Type Diversity Breakdown Card */}
      <motion.div 
        variants={itemVariants} 
        className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50/30 p-5 shadow-sm dark:border-slate-800 dark:from-zinc-900 dark:via-zinc-900 dark:to-blue-950/20"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Medicine Records & Product Type Diversity Audit
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live breakdown of unique pharmaceutical types, active batches, and total inventory pieces in store.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsScanToAddModalOpen(true)}
            className="inline-flex items-center gap-2 self-start lg:self-center rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 active:scale-95 dark:bg-blue-600 dark:hover:bg-blue-500 cursor-pointer"
          >
            <Barcode size={15} />
            <span>Scan Product Barcode</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
          <div className="rounded-xl border border-slate-200/70 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Product Types</span>
              <Package size={16} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">{totalProductTypes}</span>
              <span className="text-xs font-semibold text-slate-500">Unique SKUs</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Distinct medicine records</p>
          </div>

          <div className="rounded-xl border border-slate-200/70 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Stock Quantity</span>
              <Layers size={16} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">{totalStockQuantity}</span>
              <span className="text-xs font-semibold text-slate-500">Units / Pieces</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Across {totalBatchesCount} registered batches</p>
          </div>

          <div className="rounded-xl border border-slate-200/70 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Chemical Formulas</span>
              <FlaskConical size={16} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black tracking-tight text-purple-600 dark:text-purple-400">{totalUniqueFormulas}</span>
              <span className="text-xs font-semibold text-slate-500">Active Salts</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Formulation compositions</p>
          </div>

          <div className="rounded-xl border border-slate-200/70 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Stock Health Status</span>
              <Sparkles size={16} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                {items.length > 0 ? `${Math.round(((items.length - lowStockItems.length) / items.length) * 100)}%` : '100%'}
              </span>
              <span className="text-xs font-semibold text-slate-500">Adequate</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">{lowStockItems.length} items below minimum</p>
          </div>
        </div>

        {/* Category breakdown chips */}
        <div className="flex flex-wrap items-center gap-2 pt-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Categories:</span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
            Tablets: {productTypeBreakdown.tablet.count} types ({productTypeBreakdown.tablet.qty} pcs)
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-800 dark:bg-purple-950/40 dark:text-purple-300">
            Capsules: {productTypeBreakdown.capsule.count} types ({productTypeBreakdown.capsule.qty} pcs)
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Syrups: {productTypeBreakdown.syrup.count} types ({productTypeBreakdown.syrup.qty} pcs)
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
            Injections: {productTypeBreakdown.injection.count} types ({productTypeBreakdown.injection.qty} pcs)
          </span>
          {productTypeBreakdown.others.count > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              Others: {productTypeBreakdown.others.count} types ({productTypeBreakdown.others.qty} pcs)
            </span>
          )}
        </div>
      </motion.div>

      {/* Gemini AI Stock Level & Reorder Analysis Summary Card (Requirement 2) */}
      <motion.div variants={itemVariants}>
        <AIStockReorderSummaryCard
          inventory={items}
          onRestockItem={(medicineName) => {
            const found = items.find(m => m.name.toLowerCase() === medicineName.toLowerCase());
            if (found) {
              setSelectedMedicine(found);
              setIsBatchModalOpen(true);
            } else {
              setFormData(prev => ({ ...prev, name: medicineName }));
              setIsAddModalOpen(true);
            }
          }}
        />
      </motion.div>

      {/* Filters & Search */}
      <motion.div variants={itemVariants} className="flex flex-col gap-3">
        {/* Top Search & Primary Actions Bar */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex-1">
              <InventorySearchAutocomplete
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                items={items}
                onSelectMedicine={(med) => {
                  setSearchTerm(med.name);
                }}
                onLocateShelf={(med) => {
                  setLocatorTargetMedicine(med);
                  setIsLocatorModalOpen(true);
                }}
                onQuickRestock={(med) => {
                  setSelectedMedicine(med);
                  setIsBatchModalOpen(true);
                }}
                onAddNewMedicine={() => setIsAddModalOpen(true)}
                isListening={isListening}
                onToggleVoiceSearch={toggleVoiceSearch}
                placeholder={t('search')}
              />
            </div>

            {/* Sort by Expiry Toggle */}
            <button
              type="button"
              id="sort-by-expiry-toggle-btn"
              onClick={() => setSortByExpiry(prev => !prev)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-bold uppercase tracking-tight transition-all cursor-pointer shadow-2xs shrink-0",
                sortByExpiry
                  ? "bg-amber-500 text-slate-950 border-amber-500 font-black shadow-amber-500/20 ring-2 ring-amber-400/40 dark:bg-amber-400 dark:border-amber-400 dark:text-slate-950"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800"
              )}
              title={tText('Toggle to prioritize items nearest to expiration dates', 'निकटतम समाप्ति तिथि के अनुसार क्रमबद्ध करने के लिए टॉगल करें')}
            >
              <ArrowUpDown size={14} className={cn(sortByExpiry ? "text-slate-950 stroke-[2.5]" : "text-slate-400")} />
              <span>{tText('Sort by Expiry', 'एक्सपायरी अनुसार')}</span>
              {sortByExpiry ? (
                <span className="rounded bg-slate-950 px-1.5 py-0.5 text-[9px] font-black text-amber-300">
                  ON (Nearest First)
                </span>
              ) : (
                <span className="text-[9px] font-medium text-slate-400">
                  OFF
                </span>
              )}
            </button>
          </div>

          {/* Quick Batch Selection Helpers */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-0.5">
                Select Shortcuts:
              </span>
              <button
                type="button"
                id="quick-select-all-btn"
                onClick={toggleSelectAllFiltered}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold border transition-all cursor-pointer",
                  areAllFilteredSelected
                    ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/60 dark:border-blue-800 dark:text-blue-300"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-300"
                )}
              >
                <input
                  type="checkbox"
                  checked={areAllFilteredSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = areSomeFilteredSelected;
                  }}
                  onChange={toggleSelectAllFiltered}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 pointer-events-none"
                />
                <span>{areAllFilteredSelected ? t('deselectAll') : `${t('selectAll')} (${filteredItems.length})`}</span>
              </button>

              {expiredMedicines.length > 0 && (
                <button
                  type="button"
                  id="quick-select-expired-btn"
                  onClick={selectAllExpired}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 transition-colors cursor-pointer"
                  title="Select all medicines that have passed expiration date for bulk disposal"
                >
                  <span className="h-2 w-2 rounded-full bg-rose-600 animate-pulse" />
                  <span>{t('selectExpired')} ({expiredMedicines.length})</span>
                </button>
              )}

              {zeroStockMedicines.length > 0 && (
                <button
                  type="button"
                  id="quick-select-deprecated-btn"
                  onClick={selectAllZeroStock}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 transition-colors cursor-pointer"
                  title="Select all zero-stock / discontinued medicines for bulk de-listing"
                >
                  <span>⚪</span>
                  <span>{t('selectDeprecated')} ({zeroStockMedicines.length})</span>
                </button>
              )}

              {sortByExpiry && (
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:text-amber-200">
                  <ArrowUpDown size={12} className="text-amber-600 dark:text-amber-400" />
                  <span>Sorted: Nearest Expiration Dates First</span>
                  <button
                    type="button"
                    onClick={() => setSortByExpiry(false)}
                    className="ml-1 text-[10px] text-amber-900 dark:text-amber-100 hover:underline font-extrabold cursor-pointer"
                    title="Reset to default sorting"
                  >
                    ✕ Reset
                  </button>
                </div>
              )}
            </div>

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-blue-700 dark:text-blue-400">
                  {selectedIds.length} item{selectedIds.length === 1 ? '' : 's'} selected
                </span>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer"
                >
                  {t('deselectAll')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Multi-Faceted Filter Panel (Category, Shelf Location, Supplier, Stock Status) */}
        <InventoryAdvancedFilters
          filters={advancedFilters}
          onFilterChange={setAdvancedFilters}
          items={items}
          predictionsMap={predictionsMap}
          filteredCount={filteredItems.length}
          totalCount={items.length}
          onResetFilters={handleResetAllFilters}
        />
      </motion.div>

      {/* Visual Physical Shelf Retrieval Suggestion Bar when Searching */}
      {searchTerm.trim().length > 0 && filteredItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border-2 border-cyan-300 dark:border-cyan-800 bg-gradient-to-r from-cyan-50/90 via-blue-50/40 to-white dark:from-cyan-950/40 dark:via-slate-900 dark:to-slate-900 p-4 shadow-sm"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-600 text-white shadow-lg shadow-cyan-600/30">
                <Compass size={22} className="animate-spin-slow" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black uppercase tracking-wider text-cyan-900 dark:text-cyan-200 flex items-center gap-1">
                    <MapPin size={13} className="text-cyan-600 animate-bounce" />
                    <span>Physical Shelf Locator Suggestion</span>
                  </span>
                  <span className="rounded-full bg-cyan-200/90 dark:bg-cyan-900/90 px-2 py-0.5 text-[9px] font-black text-cyan-950 dark:text-cyan-100">
                    Primary Pick: {filteredItems[0].name}
                  </span>
                </div>

                {/* Exact coordinates banner */}
                <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-700 dark:text-slate-300 flex-wrap">
                  <span className="font-bold text-slate-500">Storage Position:</span>
                  <span className="font-extrabold text-blue-800 dark:text-blue-200 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-slate-700 shadow-2xs flex items-center gap-1.5">
                    <span className="underline decoration-2 text-blue-600 dark:text-blue-400">{getMedicineLocation(filteredItems[0]).aisle}</span>
                    <ArrowRight size={11} className="text-slate-400" />
                    <span>{getMedicineLocation(filteredItems[0]).rack}</span>
                    <ArrowRight size={11} className="text-slate-400" />
                    <span className="text-emerald-700 dark:text-emerald-300 font-black">{getMedicineLocation(filteredItems[0]).shelf}</span>
                    <ArrowRight size={11} className="text-slate-400" />
                    <span className="bg-blue-100 dark:bg-blue-900/60 text-blue-900 dark:text-blue-100 px-1 py-0.2 rounded text-[10px] font-black">
                      {getMedicineLocation(filteredItems[0]).bin || 'Bin 01'}
                    </span>
                  </span>
                  {getMedicineLocation(filteredItems[0]).temperature && (
                    <span className="text-[11px] font-bold text-cyan-700 dark:text-cyan-300">
                      ({getMedicineLocation(filteredItems[0]).temperature})
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setLocatorTargetMedicine(filteredItems[0]);
                  setIsLocatorModalOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 text-xs font-black shadow-md shadow-cyan-600/20 active:scale-95 transition-all cursor-pointer"
              >
                <Compass size={15} />
                <span>View On 2D/3D Map</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Multiple items match strip */}
          {filteredItems.length > 1 && (
            <div className="mt-3 pt-2.5 border-t border-cyan-200/70 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto text-xs">
              <span className="text-[10px] font-black uppercase text-slate-400 shrink-0">
                All Matched Items:
              </span>
              {filteredItems.slice(0, 6).map(item => {
                const loc = getMedicineLocation(item);
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setLocatorTargetMedicine(item);
                      setIsLocatorModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-cyan-400 text-slate-700 dark:text-slate-300 text-xs font-bold shrink-0 transition-all cursor-pointer shadow-2xs"
                  >
                    <span className="truncate max-w-[110px]">{item.name}</span>
                    <span className="text-[10px] text-cyan-700 dark:text-cyan-300 font-mono font-black">
                      {loc.aisle.replace('Aisle ', 'A-')} • {loc.rack.replace('Rack ', '')} • {loc.shelf.replace('Shelf Level ', 'S')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* Multi-Item Critical Stock Alert Notification Banner */}
      {lowStockItems.length >= 2 && (
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-gradient-to-r from-rose-50 via-amber-50/40 to-white dark:from-rose-950/40 dark:via-slate-900 dark:to-slate-900 p-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-md shadow-rose-600/20">
              <Mail size={18} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-rose-800 dark:text-rose-300">
                  🚨 Multi-Item Critical Threshold ({lowStockItems.length} Medicines Low)
                </span>
                <span className="rounded-full bg-rose-100 dark:bg-rose-900/60 px-2 py-0.5 text-[9px] font-black text-rose-800 dark:text-rose-200">
                  Auto-Email Active
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Simultaneous stock drop detected for: <strong className="text-slate-800 dark:text-slate-200">{lowStockItems.slice(0, 3).map(m => m.name).join(', ')}{lowStockItems.length > 3 ? ` +${lowStockItems.length - 3} more` : ''}</strong>. Automated admin dispatch is monitoring this batch.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsSmartProcurementOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <BrainCircuit size={13} />
              <span>Smart Procurement</span>
            </button>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-stock-email-alerts'))}
              className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-700 transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <Mail size={13} />
              <span>Email Alert Settings & Log</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* Bulk Action Bar (When Items Selected) */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/95 dark:border-blue-900/60 dark:bg-blue-950/60 px-5 py-3.5 shadow-md backdrop-blur-xs"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-black text-xs shadow-xs">
                {selectedIds.length}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-200">
                    {selectedIds.length} {selectedIds.length === 1 ? 'Medicine' : 'Medicines'} Selected
                  </span>
                  <div className="flex items-center gap-1.5">
                    {selectedMedicinesList.some(m => new Date(m.expiryDate) < new Date()) && (
                      <span className="rounded-full bg-rose-200/80 dark:bg-rose-900/80 px-2 py-0.5 text-[9px] font-black text-rose-800 dark:text-rose-200">
                        {selectedMedicinesList.filter(m => new Date(m.expiryDate) < new Date()).length} Expired
                      </span>
                    )}
                    {selectedMedicinesList.some(m => m.stockQuantity <= 0) && (
                      <span className="rounded-full bg-slate-200 dark:bg-slate-800 px-2 py-0.5 text-[9px] font-black text-slate-700 dark:text-slate-300">
                        {selectedMedicinesList.filter(m => m.stockQuantity <= 0).length} Zero-Stock
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-blue-700/90 dark:text-blue-400 mt-0.5">
                  Bulk adjust stock & pricing, or securely purge expired and deprecated drug records.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                id="bulk-adjust-selected-medicines-btn"
                onClick={() => setIsBulkAdjustModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all cursor-pointer"
              >
                <Sliders size={14} />
                <span>Adjust Stock ({selectedIds.length})</span>
              </button>
              
              <button
                type="button"
                id="bulk-delete-selected-records-btn"
                onClick={() => setIsBulkDeleteModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-rose-600/20 hover:bg-rose-700 active:scale-95 transition-all cursor-pointer"
                title="Permanently remove selected expired or deprecated records"
              >
                <Trash2 size={14} />
                <span>Delete Records ({selectedIds.length})</span>
              </button>

              <button
                type="button"
                onClick={clearSelection}
                className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300 transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inventory List */}
      <motion.div variants={itemVariants} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm dark:border-slate-800 dark:bg-zinc-900">
        {/* Expiry Color-Coding Visual Legend & Quick Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-zinc-900/90 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-1 flex items-center gap-1">
              <Clock size={12} className="text-slate-400" />
              <span>Expiry Color Code:</span>
            </span>

            {/* Critical <30 days filter pill */}
            <button
              type="button"
              id="filter-expiry-critical-btn"
              onClick={() => setFilter(filter === 'expiry30' ? 'all' : 'expiry30')}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold border transition-all cursor-pointer shadow-2xs",
                filter === 'expiry30'
                  ? "bg-red-600 text-white border-red-600 ring-2 ring-red-400/40"
                  : "bg-red-50 text-red-800 border-red-200 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60"
              )}
              title="Filter items expiring in less than 30 days"
            >
              <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
              <span>&lt; 30 Days (Red)</span>
              <span className={cn(
                "rounded-full px-1.5 py-0.2 text-[10px] font-black",
                filter === 'expiry30' ? "bg-white/20 text-white" : "bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-200"
              )}>
                {criticalExpiryMedicines.length}
              </span>
            </button>

            {/* Warning <90 days filter pill */}
            <button
              type="button"
              id="filter-expiry-warning-btn"
              onClick={() => setFilter(filter === 'expiry90' ? 'all' : 'expiry90')}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold border transition-all cursor-pointer shadow-2xs",
                filter === 'expiry90'
                  ? "bg-amber-500 text-slate-950 border-amber-500 font-black ring-2 ring-amber-400/40"
                  : "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60"
              )}
              title="Filter items expiring in less than 90 days"
            >
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span>&lt; 90 Days (Yellow)</span>
              <span className={cn(
                "rounded-full px-1.5 py-0.2 text-[10px] font-black",
                filter === 'expiry90' ? "bg-slate-950 text-amber-300" : "bg-amber-200 text-amber-950 dark:bg-amber-900 dark:text-amber-200"
              )}>
                {warningExpiryMedicines.length}
              </span>
            </button>

            {/* Expired filter pill */}
            {expiredMedicines.length > 0 && (
              <button
                type="button"
                id="filter-expiry-expired-btn"
                onClick={() => setFilter(filter === 'expired' ? 'all' : 'expired')}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold border transition-all cursor-pointer shadow-2xs",
                  filter === 'expired'
                    ? "bg-rose-600 text-white border-rose-600 ring-2 ring-rose-400/40"
                    : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60"
                )}
                title="Filter already expired medicines"
              >
                <span className="h-2 w-2 rounded-full bg-rose-600" />
                <span>Expired (Dark Red)</span>
                <span className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px] font-black",
                  filter === 'expired' ? "bg-white/20 text-white" : "bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-200"
                )}>
                  {expiredMedicines.length}
                </span>
              </button>
            )}

            {/* Safe >90 days */}
            <div className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 border border-slate-200 dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>&gt; 90 Days (Adequate)</span>
              <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                {safeExpiryMedicines.length}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Showing <span className="font-black text-slate-900 dark:text-slate-100">{filteredItems.length}</span> of {items.length} SKUs
            </span>
            {filter !== 'all' && (
              <button
                type="button"
                onClick={() => setFilter('all')}
                className="text-[11px] font-bold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200 dark:bg-slate-800/50 dark:border-slate-800">
              <tr className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <th className="w-12 px-4 py-4 text-center">
                  <input
                    type="checkbox"
                    checked={areAllFilteredSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = areSomeFilteredSelected;
                    }}
                    onChange={toggleSelectAllFiltered}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 cursor-pointer"
                    title={areAllFilteredSelected ? "Deselect all filtered medicines" : "Select all filtered medicines"}
                  />
                </th>
                <th className="px-6 py-4 text-slate-800 dark:text-slate-200">{t('medicineName')}</th>
                <th className="px-6 py-4">{t('category')}</th>
                <th className="px-6 py-4">{tText('Shelf Location', 'शेल्फ स्थान')}</th>
                <th 
                  className="px-6 py-4 cursor-pointer select-none group/batchsort"
                  onClick={() => {
                    setSortByExpiry(false);
                    setBatchGroupSortMode(prev => prev === 'off' ? 'asc' : prev === 'asc' ? 'desc' : 'off');
                  }}
                  title={tText(
                    'Click to order inventory items by nearest expiration date within their batch groups (FEFO)',
                    'बैच समूहों के भीतर निकटतम समाप्ति तिथि के अनुसार क्रमबद्ध करने के लिए क्लिक करें'
                  )}
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={cn(
                      "transition-colors",
                      batchGroupSortMode !== 'off' && "text-blue-600 dark:text-blue-400 font-black"
                    )}>
                      {tText('Batch Details', 'बैच विवरण')}
                    </span>
                    <ArrowUpDown size={12} className={cn(
                      "transition-colors",
                      batchGroupSortMode !== 'off'
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-slate-400 opacity-50 group-hover/batchsort:opacity-100"
                    )} />
                    {batchGroupSortMode !== 'off' && (
                      <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-300 dark:border-blue-700">
                        {batchGroupSortMode === 'asc' ? 'Group Nearest Exp ↑' : 'Group Furthest Exp ↓'}
                      </span>
                    )}
                    {focusedBatchGroup && batchGroupSortMode !== 'off' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFocusedBatchGroup(null);
                        }}
                        className="text-[8px] font-bold uppercase text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-1 py-0.5 rounded border border-amber-300 dark:border-amber-700 hover:bg-amber-200"
                        title="Clear focused batch group priority"
                      >
                        Reset Group Focus ×
                      </button>
                    )}
                  </div>
                </th>
                <th className="px-6 py-4">{t('stock')}</th>
                <th className="px-4 py-4 text-slate-800 dark:text-slate-200">
                  <div className="flex items-center gap-1">
                    <span>{t('stockTrend6M')}</span>
                  </div>
                </th>
                <th 
                  className="px-6 py-4 cursor-pointer select-none group"
                  onClick={() => setSortByExpiry(prev => !prev)}
                  title={tText('Click to toggle Sort by Expiry (prioritize nearest expiration dates)', 'निकटतम समाप्ति तिथि के अनुसार क्रमबद्ध करने के लिए क्लिक करें')}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={cn(sortByExpiry && "text-amber-600 dark:text-amber-400 font-black")}>
                      {t('expiry')}
                    </span>
                    <ArrowUpDown size={12} className={cn(
                      "transition-colors",
                      sortByExpiry ? "text-amber-600 dark:text-amber-400" : "text-slate-400 opacity-40 group-hover:opacity-100"
                    )} />
                    {sortByExpiry && (
                      <span className="text-[8px] font-black uppercase text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-1 py-0.2 rounded border border-amber-300 dark:border-amber-700">
                        Nearest
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-4">{t('price')}</th>
                <th className="px-6 py-4 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredItems.map((item) => {
                const daysRemaining = getDaysUntilExpiry(item.expiryDate);
                const isExpired = daysRemaining < 0;
                const isCriticalExpiry = daysRemaining >= 0 && daysRemaining <= 30;
                const isWarningExpiry = daysRemaining > 30 && daysRemaining <= 90;

                const threshold = item.minThreshold || 10;
                const isLow = item.stockQuantity <= threshold;
                const isCritical = item.stockQuantity <= (threshold * 0.3);
                const isSelected = selectedIds.includes(item.id);
                const itemLocation = getMedicineLocation(item);
                
                // Calculate health percentage
                const healthPercent = Math.min(100, (item.stockQuantity / (threshold * 2)) * 100);
                
                return (
                  <tr 
                    key={item.id} 
                    className={cn(
                      "group transition-all duration-150 border-l-4",
                      // Alternating zebra striping base
                      "odd:bg-white dark:odd:bg-zinc-900 even:bg-slate-50/70 dark:even:bg-zinc-800/35",

                      // Selected state styling
                      isSelected && "bg-blue-100/90 dark:bg-blue-950/70 ring-1 ring-inset ring-blue-500/50",
                      
                      // Conditional formatting by expiry proximity when NOT selected
                      !isSelected && isExpired && "border-l-rose-600 bg-rose-50/85 hover:bg-rose-100/95 dark:bg-rose-950/30 dark:hover:bg-rose-950/60",
                      !isSelected && isCriticalExpiry && "border-l-red-500 bg-red-50/75 hover:bg-red-100/85 dark:bg-red-950/25 dark:hover:bg-red-950/50",
                      !isSelected && isWarningExpiry && "border-l-amber-400 dark:border-l-amber-500 bg-amber-50/60 hover:bg-amber-100/70 dark:bg-amber-950/20 dark:hover:bg-amber-950/45",
                      !isSelected && !isExpired && !isCriticalExpiry && !isWarningExpiry && "border-l-transparent hover:bg-blue-50/60 dark:hover:bg-zinc-800/70 hover:shadow-2xs",

                      // Maintain left indicator border when selected
                      isSelected && isExpired && "border-l-rose-600",
                      isSelected && isCriticalExpiry && "border-l-red-500",
                      isSelected && isWarningExpiry && "border-l-amber-400 dark:border-l-amber-500",
                      isSelected && !isExpired && !isCriticalExpiry && !isWarningExpiry && "border-l-blue-500"
                    )}
                  >
                    <td className="w-12 px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectItem(item.id)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.name}</span>
                          {isLow && (
                            <span className={cn(
                              "flex h-2 w-2 rounded-full",
                              isCritical ? "bg-red-500 animate-pulse" : "bg-orange-500"
                            )} />
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5 mt-0.5">
                          {(item.formula || item.salt) && (
                            <div className="flex items-center gap-1 text-[10px] text-purple-600 dark:text-purple-400 font-semibold truncate max-w-xs">
                              <FlaskConical size={10} className="shrink-0" />
                              <span className="truncate">{item.formula || item.salt}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-semibold text-slate-500">
                            {item.genericName && item.genericName !== item.name && (
                              <span className="uppercase">{item.genericName} •</span>
                            )}
                            {canViewSuppliers(profile) ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const sup = getMedicineSupplier(item);
                                  setAdvancedFilters(prev => ({ ...prev, supplier: prev.supplier === sup ? 'all' : sup }));
                                }}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold border transition-colors cursor-pointer",
                                  advancedFilters.supplier === getMedicineSupplier(item)
                                    ? "bg-purple-600 text-white border-purple-600 shadow-2xs"
                                    : "bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:hover:bg-purple-900/80 dark:text-purple-300 dark:border-purple-800"
                                )}
                                title={`Filter inventory by supplier: ${getMedicineSupplier(item)}`}
                              >
                                <Building2 size={10} className={advancedFilters.supplier === getMedicineSupplier(item) ? "text-white" : "text-purple-600 dark:text-purple-400"} />
                                <span>{getMedicineSupplier(item)}</span>
                              </button>
                            ) : (
                              <SensitiveValueMask 
                                isAuthorized={false} 
                                maskText="Vendor: Confidential" 
                                badgeMode={true}
                                requiredRole="admin" 
                              />
                            )}
                            <span>• {item.batches.length} {item.batches.length === 1 ? 'Batch' : 'Batches'}</span>
                            {item.mfgDate && (
                              <span className="text-slate-400">• Mfg: {formatDate(item.mfgDate)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => {
                          const cat = (item.type || 'others').toLowerCase() as any;
                          setAdvancedFilters(prev => ({ ...prev, category: prev.category === cat ? 'all' : cat }));
                        }}
                        className={cn(
                          "rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border transition-colors cursor-pointer",
                          advancedFilters.category === (item.type || 'others').toLowerCase()
                            ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                            : "bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 border-transparent hover:border-blue-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-blue-950/60 dark:hover:text-blue-300"
                        )}
                        title={`Filter by category: ${item.type}`}
                      >
                        {item.type}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => {
                          setLocatorTargetMedicine(item);
                          setIsLocatorModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/60 dark:hover:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200 border border-cyan-200 dark:border-cyan-800 text-xs font-bold transition-all cursor-pointer group/pos shadow-2xs"
                        title={tText('Click to view exact physical shelf map position', 'भौतिक शेल्फ स्थिति देखने के लिए क्लिक करें')}
                      >
                        <MapPin size={12} className="text-cyan-600 dark:text-cyan-400 group-hover/pos:scale-125 transition-transform" />
                        <span>{itemLocation.aisle.replace('Aisle ', 'A-')} • {itemLocation.rack.replace('Rack ', '')}</span>
                        <span className="text-[10px] px-1 py-0.2 bg-cyan-200/80 dark:bg-cyan-900 text-cyan-950 dark:text-cyan-100 rounded font-black">
                          {itemLocation.shelf.replace('Shelf Level ', 'S')}
                        </span>
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const cellSortDir = cellBatchSortOrder[item.id] || 'asc';
                        const sortedBatches = getSortedItemBatches(item, cellSortDir);
                        const nearestBatch = getSortedItemBatches(item, 'asc')[0];
                        const nearestDaysRemaining = getDaysUntilExpiry(nearestBatch?.expiryDate || item.expiryDate);
                        const shelfLife = getShelfLifeBadgeInfo(nearestDaysRemaining);
                        const storageInfo = getBatchStorageConditionBadges(item, itemLocation);
                        const batchGroup = getItemBatchGroupKey(item);
                        const primaryBatch = sortedBatches[0] || {
                          batchNumber: item.batchNumber || 'B-101',
                          expiryDate: item.expiryDate,
                          quantity: item.stockQuantity
                        };
                        const batchCount = item.batches?.length || 1;
                        const isGroupSortedActive = batchGroupSortMode !== 'off' && (!focusedBatchGroup || focusedBatchGroup === batchGroup.key);
                        const isFocusedGroup = batchGroupSortMode !== 'off' && focusedBatchGroup === batchGroup.key;
                        const isExpanded = !!expandedBatchCells[item.id];

                        // Compute item's rank within its batch group by nearest expiration date
                        const sameGroupItemsSorted = filteredItems
                          .filter(m => getItemBatchGroupKey(m).key === batchGroup.key)
                          .sort((x, y) => {
                            const diff = getNearestBatchExpiryTime(x) - getNearestBatchExpiryTime(y);
                            if (diff !== 0) return batchGroupSortMode === 'desc' ? -diff : diff;
                            return x.name.localeCompare(y.name);
                          });
                        const groupExpiryRank = sameGroupItemsSorted.findIndex(m => m.id === item.id) + 1;

                        return (
                          <div className="flex flex-col gap-1.5 min-w-[220px]">
                            {/* Top Row: Batch Number + Shelf-Life Status Badge + Cell Expiry Sort Control */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedMedicine(item);
                                  setIsBatchModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 rounded-md bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/60 px-1.5 py-0.5 text-[10px] font-mono font-black text-slate-700 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                                title="Click to inspect or add batches"
                              >
                                <Package size={10} className="text-slate-500 dark:text-slate-400 shrink-0" />
                                <span>#{primaryBatch.batchNumber && primaryBatch.batchNumber !== 'N/A' ? primaryBatch.batchNumber : `LOT-${item.id.slice(0, 4).toUpperCase()}`}</span>
                                {batchCount > 1 && (
                                  <span className="ml-0.5 rounded bg-blue-600 px-1 py-0.2 text-[8px] font-sans font-black text-white">
                                    +{batchCount - 1}
                                  </span>
                                )}
                              </button>

                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-tight shadow-2xs",
                                  shelfLife.badgeClass
                                )}
                                title={`Shelf-Life Status: ${shelfLife.statusLabel} (${shelfLife.detailLabel})`}
                              >
                                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", shelfLife.dotClass)} />
                                <span>{shelfLife.statusLabel}</span>
                              </span>

                              {/* Interactive Sort by Nearest Expiry within Batch Group Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSortByExpiry(false);
                                  if (batchGroupSortMode === 'off' || focusedBatchGroup !== batchGroup.key) {
                                    setBatchGroupSortMode('asc');
                                    setFocusedBatchGroup(batchGroup.key);
                                  } else if (batchGroupSortMode === 'asc') {
                                    setBatchGroupSortMode('desc');
                                  } else {
                                    setBatchGroupSortMode('off');
                                    setFocusedBatchGroup(null);
                                  }
                                }}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-tight transition-all cursor-pointer shadow-2xs",
                                  isFocusedGroup
                                    ? "bg-blue-600 text-white border-blue-600 ring-2 ring-blue-400/40"
                                    : isGroupSortedActive
                                      ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-700"
                                      : "bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-700 border-slate-200 hover:border-blue-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-blue-950/50"
                                )}
                                title={`Sort '${batchGroup.label}' items by nearest expiration date (FEFO)`}
                              >
                                <ArrowUpDown size={9} className="shrink-0" />
                                <span>
                                  {batchGroupSortMode !== 'off'
                                    ? `FEFO #${groupExpiryRank}/${sameGroupItemsSorted.length} ${batchGroupSortMode === 'asc' ? '↑' : '↓'}`
                                    : `Sort Group Exp`}
                                </span>
                              </button>
                            </div>

                            {/* Second Row: Batch-Specific Storage Condition Badges */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold shadow-2xs",
                                  storageInfo.primaryClass
                                )}
                                title={`Batch Group Storage Requirement: ${storageInfo.primaryLabel}`}
                              >
                                {storageInfo.iconType === 'cold' && <Snowflake size={10} className="shrink-0 text-cyan-600 dark:text-cyan-400" />}
                                {storageInfo.iconType === 'lock' && <Lock size={10} className="shrink-0 text-purple-600 dark:text-purple-400" />}
                                {storageInfo.iconType === 'liquid' && <Droplets size={10} className="shrink-0 text-indigo-600 dark:text-indigo-400" />}
                                {(storageInfo.iconType === 'moisture' || storageInfo.iconType === 'ambient') && (
                                  <Thermometer size={10} className="shrink-0 text-slate-500 dark:text-slate-400" />
                                )}
                                <span>{storageInfo.primaryLabel}</span>
                              </span>

                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-semibold",
                                  storageInfo.secondaryClass
                                )}
                              >
                                <ShieldCheck size={9} className="shrink-0 opacity-75" />
                                <span>{storageInfo.secondaryLabel}</span>
                              </span>
                            </div>

                            {/* Third Row: Nearest Batch Expiration Summary & In-Cell Batch Queue Sorter */}
                            <div className="flex items-center justify-between gap-1.5 pt-0.5">
                              <div className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-500 dark:text-slate-400">
                                <Clock size={9} className="text-amber-500 shrink-0" />
                                <span>
                                  {cellSortDir === 'asc' ? 'Nearest Exp:' : 'Furthest Exp:'}{' '}
                                  <strong className="text-slate-700 dark:text-slate-200 font-mono">
                                    {formatDate(primaryBatch.expiryDate || item.expiryDate)}
                                  </strong>
                                </span>
                              </div>

                              <div className="flex items-center gap-1">
                                {batchCount > 1 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCellBatchSortOrder(prev => ({
                                        ...prev,
                                        [item.id]: (prev[item.id] || 'asc') === 'asc' ? 'desc' : 'asc'
                                      }));
                                      setExpandedBatchCells(prev => ({ ...prev, [item.id]: true }));
                                    }}
                                    className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[8px] font-black uppercase bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-indigo-950/60 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                                    title="Toggle batch order inside this item's batch group (Nearest vs Furthest Expiry)"
                                  >
                                    <ArrowUpDown size={8} />
                                    <span>{cellSortDir === 'asc' ? 'Nearest First' : 'Furthest First'}</span>
                                  </button>
                                )}
                                {batchCount > 1 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedBatchCells(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                                    }}
                                    className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[8px] font-bold bg-blue-50/80 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800 transition-colors cursor-pointer"
                                    title={isExpanded ? "Hide batch expiry queue" : "Show all batches ordered by expiration date"}
                                  >
                                    <span>{isExpanded ? 'Hide' : `${batchCount} Lots`}</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Expandable In-Cell Sorted Batch Group Breakdown */}
                            {isExpanded && batchCount > 1 && (
                              <div className="mt-0.5 rounded-lg border border-slate-200/90 dark:border-slate-700/80 bg-slate-50/90 dark:bg-slate-900/70 p-1.5 space-y-1">
                                <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-wider text-slate-400 px-1">
                                  <span>Batch Queue ({cellSortDir === 'asc' ? 'FEFO ↑' : 'LIFO ↓'})</span>
                                  <span>Exp Date • Qty</span>
                                </div>
                                {sortedBatches.map((b, idx) => {
                                  const bDays = getDaysUntilExpiry(b.expiryDate);
                                  const bShelf = getShelfLifeBadgeInfo(bDays);
                                  const bNum = b.batchNumber || `LOT-${idx + 1}`;
                                  return (
                                    <div
                                      key={`${bNum}-${idx}`}
                                      className="flex items-center justify-between gap-2 rounded bg-white dark:bg-slate-800/90 px-1.5 py-0.5 text-[9px] border border-slate-100 dark:border-slate-700/60"
                                    >
                                      <div className="flex items-center gap-1 font-mono font-bold text-slate-700 dark:text-slate-200">
                                        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", bShelf.dotClass)} />
                                        <span>#{bNum}</span>
                                        {idx === 0 && cellSortDir === 'asc' && (
                                          <span className="rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-1 text-[7px] font-sans font-black uppercase">
                                            Nearest
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1.5 font-mono text-slate-600 dark:text-slate-300">
                                        <span>{formatDate(b.expiryDate)}</span>
                                        <span className="text-slate-400">•</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-100">{b.quantity} pcs</span>
                                        <div className="flex items-center gap-0.5 ml-1 pl-1 border-l border-slate-200 dark:border-slate-700">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenBatchQuickAction(item, bNum, 'restock');
                                            }}
                                            className="rounded p-0.5 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/60 cursor-pointer"
                                            title={`Direct Restock Batch #${bNum}`}
                                          >
                                            <PackagePlus size={10} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenBatchQuickAction(item, bNum, 'damaged');
                                            }}
                                            className="rounded p-0.5 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/60 cursor-pointer"
                                            title={`Mark Batch #${bNum} as Damaged`}
                                          >
                                            <AlertTriangle size={10} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenBatchQuickAction(item, bNum, 'note');
                                            }}
                                            className="rounded p-0.5 text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/60 cursor-pointer"
                                            title={`Add Operational Note to Batch #${bNum}`}
                                          >
                                            <StickyNote size={10} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenBatchQuickAction(item, bNum, 'audit');
                                            }}
                                            className="rounded p-0.5 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/60 cursor-pointer"
                                            title={`View Audit Trail for Batch #${bNum}`}
                                          >
                                            <History size={10} />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Attached Operational Batch Notes Display */}
                            {(() => {
                              const allNotesWithBatch = sortedBatches.flatMap((b, bIdx) => {
                                const bCode = b.batchNumber || `LOT-${bIdx + 1}`;
                                const notesArr = Array.isArray(b.notes)
                                  ? b.notes
                                  : b.latestNote
                                    ? [b.latestNote]
                                    : [];
                                return notesArr.map(note => ({ batchNumber: bCode, note }));
                              });

                              if (allNotesWithBatch.length === 0) return null;

                              return (
                                <div className="mt-1 flex flex-wrap items-center gap-1 pt-0.5">
                                  {allNotesWithBatch.map((entry, nIdx) => (
                                    <button
                                      key={`${entry.batchNumber}-${nIdx}`}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenBatchQuickAction(item, entry.batchNumber, 'note');
                                      }}
                                      className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50/90 hover:bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-900 dark:border-amber-800/80 dark:bg-amber-950/60 dark:text-amber-200 transition-colors cursor-pointer"
                                      title={`Operational note on Batch #${entry.batchNumber} (Click to manage notes)`}
                                    >
                                      <StickyNote size={9} className="text-amber-600 dark:text-amber-400 shrink-0" />
                                      <span className="font-mono text-[8px] opacity-75">#{entry.batchNumber}:</span>
                                      <span className="truncate max-w-[145px]">{entry.note}</span>
                                    </button>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 min-w-[150px]">
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "text-sm font-black tracking-tight",
                            item.stockQuantity <= 0 ? "text-red-600 font-extrabold" : isLow ? "text-red-600" : "text-slate-900 dark:text-slate-100"
                          )}>
                            {item.stockQuantity} pcs
                          </span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                            Min: {threshold}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${healthPercent}%` }}
                            className={cn(
                              "h-full rounded-full transition-all",
                              item.stockQuantity <= 0 ? "bg-red-600" : isCritical ? "bg-red-500" : isLow ? "bg-orange-500" : "bg-emerald-500"
                            )}
                          />
                        </div>

                        {/* Predictive Stock-Out Date & Daily Consumption Indicator */}
                        {(() => {
                          const pred = predictionsMap[item.id] || predictionsMap[item.name];
                          if (!pred) return null;
                          const isZero = item.stockQuantity <= 0;
                          const isCriticalStockout = pred.daysUntilStockOut <= 7 || isZero;
                          const isWarningStockout = pred.daysUntilStockOut > 7 && pred.daysUntilStockOut <= 15;

                          return (
                            <div className="flex flex-col gap-0.5 mt-0.5">
                              <button
                                type="button"
                                onClick={() => setIsPredictiveRefillModalOpen(true)}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase transition-all cursor-pointer text-left w-fit border",
                                  isZero
                                    ? "bg-red-600 text-white border-red-600 shadow-2xs"
                                    : isCriticalStockout
                                      ? "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800"
                                      : isWarningStockout
                                        ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                                        : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                                )}
                                title={`Projected Stock-out: ${pred.projectedStockOutFormatted} (Daily burn: ${pred.dailyBurnRate} units/day). Click to open Refill Forecaster.`}
                              >
                                <Zap size={9} className={isCriticalStockout ? "text-red-500 fill-current" : "text-amber-500"} />
                                <span>{isZero ? "Depleted" : `Out: ${pred.projectedStockOutFormatted} (${pred.daysUntilStockOut}d)`}</span>
                              </button>
                              <span className="text-[9px] font-medium text-slate-400 pl-0.5">
                                ⚡ {pred.dailyBurnRate} u/day
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <StockHistorySparkline
                        medicine={item}
                        salesHistory={salesHistory}
                        prediction={predictionsMap[item.id] || predictionsMap[item.name]}
                      />
                    </td>
                    <td className="px-6 py-4">
                      {isExpired ? (
                        <div className="flex flex-col gap-1 items-start">
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-xs">
                            <AlertCircle size={11} className="stroke-[2.5]" />
                            <span>Expired ({Math.abs(daysRemaining)}d ago)</span>
                          </span>
                          <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 pl-0.5">
                            {formatDate(item.expiryDate)}
                          </span>
                        </div>
                      ) : isCriticalExpiry ? (
                        <div className="flex flex-col gap-1 items-start">
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border border-red-300 dark:border-red-800 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-2xs">
                            <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse shrink-0" />
                            <span>{daysRemaining === 0 ? "Expires Today!" : `${daysRemaining} Days Left (<30d)`}</span>
                          </span>
                          <span className="text-[11px] font-bold text-red-600 dark:text-red-400 pl-0.5 flex items-center gap-1">
                            <Calendar size={10} />
                            <span>{formatDate(item.expiryDate)}</span>
                          </span>
                        </div>
                      ) : isWarningExpiry ? (
                        <div className="flex flex-col gap-1 items-start">
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-700 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-2xs">
                            <Clock size={11} className="text-amber-700 dark:text-amber-400 stroke-[2.5] shrink-0" />
                            <span>{daysRemaining} Days Left (&lt;90d)</span>
                          </span>
                          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 pl-0.5 flex items-center gap-1">
                            <Calendar size={10} />
                            <span>{formatDate(item.expiryDate)}</span>
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-0.5 items-start">
                          <div className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300">
                            <Calendar size={11} className="text-slate-400 shrink-0" />
                            <span>{formatDate(item.expiryDate)}</span>
                          </div>
                          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 pl-4">
                            {daysRemaining > 365 
                              ? `~${(daysRemaining / 365).toFixed(1)} yrs (${daysRemaining}d)` 
                              : `~${Math.round(daysRemaining / 30)} mo (${daysRemaining}d)`}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-black text-slate-900 dark:text-slate-100">
                      {formatCurrency(item.rate)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {(() => {
                        const rowBatches = getSortedItemBatches(item, cellBatchSortOrder[item.id] || 'asc');
                        const defaultBatchNum =
                          rowBatches[0]?.batchNumber && rowBatches[0]?.batchNumber !== 'N/A'
                            ? rowBatches[0].batchNumber
                            : item.batchNumber || `LOT-${item.id.slice(0, 4).toUpperCase()}`;
                        const activeQuickBatchNum = quickActionBatchByRow[item.id] || defaultBatchNum;
                        const isQuickMenuOpen = openQuickActionRowId === item.id;

                        return (
                          <div className="relative flex items-center justify-end gap-1.5">
                            {/* Batch-Specific Quick Actions Menu Trigger & Popover */}
                            <div
                              className="relative"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenQuickActionRowId(prev => (prev === item.id ? null : item.id))
                                }
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-black transition-all cursor-pointer shadow-2xs",
                                  isQuickMenuOpen
                                    ? "bg-blue-600 text-white border-blue-600 ring-2 ring-blue-400/40"
                                    : "bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border-slate-200 hover:border-blue-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-blue-950/50"
                                )}
                                title={`Quick Actions for Batch #${activeQuickBatchNum}`}
                              >
                                <MoreVertical size={13} className="shrink-0" />
                                <span>Quick Actions</span>
                                <ChevronDown
                                  size={11}
                                  className={cn("transition-transform", isQuickMenuOpen && "rotate-180")}
                                />
                              </button>

                              <AnimatePresence>
                                {isQuickMenuOpen && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 4 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 4 }}
                                    transition={{ duration: 0.12 }}
                                    className="absolute right-0 top-full mt-1.5 z-50 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-zinc-900 text-left"
                                  >
                                    {/* Target Batch Header & Selector */}
                                    <div className="border-b border-slate-100 dark:border-slate-800 px-2.5 py-2 mb-1">
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                                          Target Batch Action
                                        </span>
                                        <span className="rounded bg-blue-50 dark:bg-blue-950/70 px-1.5 py-0.5 text-[10px] font-mono font-black text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800">
                                          #{activeQuickBatchNum}
                                        </span>
                                      </div>

                                      {rowBatches.length > 1 && (
                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                          {rowBatches.map((b, bIdx) => {
                                            const bCode =
                                              b.batchNumber || `LOT-${bIdx + 1}`;
                                            const isSelected = bCode === activeQuickBatchNum;
                                            return (
                                              <button
                                                key={`${bCode}-${bIdx}`}
                                                type="button"
                                                onClick={() =>
                                                  setQuickActionBatchByRow(prev => ({
                                                    ...prev,
                                                    [item.id]: bCode
                                                  }))
                                                }
                                                className={cn(
                                                  "rounded px-1.5 py-0.5 text-[9px] font-mono font-bold border transition-colors cursor-pointer",
                                                  isSelected
                                                    ? "bg-blue-600 text-white border-blue-600"
                                                    : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                                                )}
                                              >
                                                #{bCode} ({b.quantity})
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>

                                    {/* 1. Direct Restock */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenBatchQuickAction(item, activeQuickBatchNum, 'restock')
                                      }
                                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-slate-200 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-300 transition-colors cursor-pointer"
                                    >
                                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100/80 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                                        <PackagePlus size={14} />
                                      </span>
                                      <div className="flex flex-col">
                                        <span className="font-black">Direct Restock</span>
                                        <span className="text-[10px] font-medium text-slate-400">
                                          Add stock to #{activeQuickBatchNum}
                                        </span>
                                      </div>
                                    </button>

                                    {/* 2. Mark as Damaged */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenBatchQuickAction(item, activeQuickBatchNum, 'damaged')
                                      }
                                      className="mt-0.5 flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-800 dark:text-slate-200 dark:hover:bg-rose-950/50 dark:hover:text-rose-300 transition-colors cursor-pointer"
                                    >
                                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-100/80 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                                        <AlertTriangle size={14} />
                                      </span>
                                      <div className="flex flex-col">
                                        <span className="font-black">Mark as Damaged</span>
                                        <span className="text-[10px] font-medium text-slate-400">
                                          Deduct spoilage from #{activeQuickBatchNum}
                                        </span>
                                      </div>
                                    </button>

                                    {/* 3. Add Batch Note */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenBatchQuickAction(item, activeQuickBatchNum, 'note')
                                      }
                                      className="mt-0.5 flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-800 dark:text-slate-200 dark:hover:bg-amber-950/50 dark:hover:text-amber-300 transition-colors cursor-pointer"
                                    >
                                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100/80 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                                        <StickyNote size={14} />
                                      </span>
                                      <div className="flex flex-col">
                                        <span className="font-black">Add Batch Note</span>
                                        <span className="text-[10px] font-medium text-slate-400">
                                          Append operational note to #{activeQuickBatchNum}
                                        </span>
                                      </div>
                                    </button>

                                    {/* 4. View Audit Trail */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenBatchQuickAction(item, activeQuickBatchNum, 'audit')
                                      }
                                      className="mt-0.5 flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-800 dark:text-slate-200 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                                    >
                                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-100/80 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                                        <History size={14} />
                                      </span>
                                      <div className="flex flex-col">
                                        <span className="font-black">View Audit Trail</span>
                                        <span className="text-[10px] font-medium text-slate-400">
                                          History & logs for #{activeQuickBatchNum}
                                        </span>
                                      </div>
                                    </button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            {/* Secondary Row Utility Icons */}
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => {
                                  setLocatorTargetMedicine(item);
                                  setIsLocatorModalOpen(true);
                                }}
                                className="rounded-md p-1.5 text-cyan-600 hover:bg-cyan-50 hover:text-cyan-800 dark:text-cyan-400 dark:hover:bg-cyan-950/40 cursor-pointer"
                                title="Locate Shelf Position & 3D Floor Plan"
                              >
                                <Compass size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsSmartProcurementOpen(true)}
                                className="rounded-md p-1.5 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-950/40 cursor-pointer"
                                title="Smart Procurement Analysis (Sales Velocity & Seasonal Trends)"
                              >
                                <BrainCircuit size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedIds([item.id]);
                                  setIsBulkAdjustModalOpen(true);
                                }}
                                className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/40"
                                title="Adjust Stock & Price"
                              >
                                <Sliders size={14} />
                              </button>
                              <button 
                                onClick={() => {
                                  setSelectedMedicine(item);
                                  setNewThreshold(item.minThreshold || 10);
                                  setIsThresholdModalOpen(true);
                                }}
                                className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                                title="Set Threshold"
                              >
                                <Settings2 size={14} />
                              </button>
                              <button 
                                onClick={() => {
                                  setSelectedMedicine(item);
                                  setIsBatchModalOpen(true);
                                }}
                                className="rounded-md p-1.5 text-slate-400 hover:bg-green-50 hover:text-green-600"
                                title="Add Batches"
                              >
                                <Plus size={14} />
                              </button>
                              <button 
                                type="button"
                                onClick={() => {
                                  setEditingMedicine(item);
                                  const loc = getMedicineLocation(item);
                                  setEditFormData({
                                    name: item.name,
                                    genericName: item.genericName || '',
                                    salt: item.salt || '',
                                    barcode: item.barcode || '',
                                    rate: item.rate,
                                    type: item.type,
                                    minThreshold: item.minThreshold || 10,
                                    expiryDate: item.expiryDate,
                                    aisle: loc.aisle,
                                    rack: loc.rack,
                                    shelf: loc.shelf,
                                    bin: loc.bin || 'Bin 01',
                                    notes: loc.notes || ''
                                  });
                                  setIsEditModalOpen(true);
                                }}
                                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
                                title="Edit Medicine & Storage Location"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button 
                                type="button"
                                onClick={() => {
                                  setSelectedIds([item.id]);
                                  setIsBulkDeleteModalOpen(true);
                                }}
                                className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 cursor-pointer"
                                title="Delete medication record"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
              <Layers size={48} className="mb-4 opacity-20" />
              <p className="text-lg">No medicines found</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Add Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsAddModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('add')}</h2>
                  <p className="text-xs text-slate-500">Add medicine records manually or via barcode</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsScanToAddModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:border-blue-900 dark:text-blue-300 cursor-pointer"
                >
                  <QrCode size={14} />
                  <span>Scan QR Code</span>
                </button>
              </div>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1">
                    <label className="text-sm font-medium">{t('medicineName')}</label>
                    <input
                      required
                      type="text"
                      className="w-full rounded-lg border bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>

                  <div className="col-span-2 space-y-1">
                    <label className="text-sm font-medium flex items-center justify-between">
                      <span>Active Chemical Formula / Composition</span>
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">Salt Formula</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Paracetamol IP 650mg, Amoxicillin + Clavulanic Acid"
                      className="w-full rounded-lg border bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-800"
                      value={formData.formula || formData.salt}
                      onChange={(e) => setFormData({...formData, formula: e.target.value, salt: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium">{t('category')}</label>
                    <select
                      className="w-full rounded-lg border bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800"
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                    >
                      <option value="tablet">Tablet</option>
                      <option value="capsule">Capsule</option>
                      <option value="injection">Injection</option>
                      <option value="syrup">Syrup</option>
                      <option value="others">Others / Ointment</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Batch Number</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800"
                      value={formData.batchNumber}
                      onChange={(e) => setFormData({...formData, batchNumber: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium">Date of Mfg (Optional)</label>
                    <input
                      type="date"
                      className="w-full rounded-lg border bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800"
                      value={formData.mfgDate}
                      onChange={(e) => setFormData({...formData, mfgDate: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium">{t('expiry')}</label>
                    <input
                      required
                      type="date"
                      className="w-full rounded-lg border bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({...formData, expiryDate: e.target.value})}
                    />
                  </div>

                  <div className="col-span-2 space-y-1">
                    <label className="text-sm font-medium">Barcode / QR</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Scan or enter barcode"
                        className="flex-1 rounded-lg border bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800"
                        value={formData.barcode}
                        onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                      />
                      <button 
                        type="button"
                        onClick={() => setIsFormScannerOpen(true)}
                        className="rounded-lg bg-slate-100 p-2 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                      >
                        <Scan size={20} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">{t('stock')}</label>
                    <input
                      required
                      type="number"
                      className="w-full rounded-lg border bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800"
                      value={formData.stockQuantity}
                      onChange={(e) => setFormData({...formData, stockQuantity: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">{t('price')}</label>
                    <input
                      required
                      type="number"
                      className="w-full rounded-lg border bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800"
                      value={formData.rate}
                      onChange={(e) => setFormData({...formData, rate: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Min Threshold</label>
                    <input
                      required
                      type="number"
                      className="w-full rounded-lg border bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800"
                      value={formData.minThreshold}
                      onChange={(e) => setFormData({...formData, minThreshold: Number(e.target.value)})}
                    />
                  </div>

                  {/* Storage Location Presets */}
                  <div className="col-span-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 mb-2 text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      <MapPin size={13} />
                      <span>{tText('Physical Storage Coordinates', 'भौतिक भंडारण स्थान')}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500">Aisle / Zone</label>
                        <select
                          className="w-full rounded-lg border bg-zinc-50 px-2.5 py-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-800"
                          value={formData.aisle}
                          onChange={(e) => setFormData({...formData, aisle: e.target.value})}
                        >
                          {AISLE_PRESETS.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500">Rack / Bay</label>
                        <select
                          className="w-full rounded-lg border bg-zinc-50 px-2.5 py-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-800"
                          value={formData.rack}
                          onChange={(e) => setFormData({...formData, rack: e.target.value})}
                        >
                          {RACK_PRESETS.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500">Shelf Tier</label>
                        <select
                          className="w-full rounded-lg border bg-zinc-50 px-2.5 py-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-800"
                          value={formData.shelf}
                          onChange={(e) => setFormData({...formData, shelf: e.target.value})}
                        >
                          {SHELF_PRESETS.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500">Bin Slot</label>
                        <select
                          className="w-full rounded-lg border bg-zinc-50 px-2.5 py-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-800"
                          value={formData.bin}
                          onChange={(e) => setFormData({...formData, bin: e.target.value})}
                        >
                          {BIN_PRESETS.map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsAddModalOpen(false)}
                    className="rounded-xl px-4 py-2 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    {t('cancel')}
                  </button>
                  <button 
                    type="submit"
                    className="rounded-xl bg-blue-600 px-6 py-2 font-bold text-white shadow-lg hover:bg-blue-700"
                  >
                    {t('save')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRestockModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsRestockModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl rounded-2xl bg-white p-8 shadow-2xl dark:bg-zinc-900"
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Restock Suggestions</h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Predictive replenishment based on current thresholds</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/30">
                  <ShoppingBag size={24} />
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto pr-2">
                {lowStockItems.length > 0 ? (
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-white dark:bg-zinc-900">
                      <tr className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        <th className="pb-3 pr-4">Item</th>
                        <th className="pb-3 pr-4">Stock</th>
                        <th className="pb-3 pr-4">Threshold</th>
                        <th className="pb-3 text-right">Order Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {lowStockItems.map((item, rIdx) => (
                        <tr 
                          key={item.id} 
                          className={cn(
                            "text-sm transition-colors",
                            rIdx % 2 === 0 ? "bg-white dark:bg-zinc-900" : "bg-slate-50/70 dark:bg-zinc-800/40",
                            "hover:bg-blue-50/60 dark:hover:bg-zinc-800/80"
                          )}
                        >
                          <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">{item.name}</td>
                          <td className="py-3 px-3 text-red-600 font-bold">{item.stockQuantity}</td>
                          <td className="py-3 px-3 text-slate-500">{item.minThreshold || 10}</td>
                          <td className="py-3 px-3 text-right font-black text-blue-600 dark:text-blue-400">
                            {(item.minThreshold || 10) * 2 - item.stockQuantity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 opacity-50">
                    <CheckCircle className="text-green-600 mb-2" size={32} />
                    <p className="text-xs font-bold uppercase tracking-widest">All stock levels optimized</p>
                  </div>
                )}
              </div>

              <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-6 dark:border-slate-800">
                <button 
                  onClick={() => setIsRestockModalOpen(false)}
                  className="rounded-xl px-6 py-2 font-bold text-slate-500 hover:bg-slate-100"
                >
                  Close
                </button>
                <button 
                  onClick={() => downloadPurchaseOrder(lowStockItems)}
                  disabled={lowStockItems.length === 0}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2 font-bold text-white shadow-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <FileDown size={18} />
                  <span>Generate Purchase Order</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isThresholdModalOpen && selectedMedicine && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsThresholdModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl dark:bg-zinc-900"
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Stock Threshold</h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Configure safety limits for {selectedMedicine.name}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30">
                  <Gauge size={24} />
                </div>
              </div>

              <form onSubmit={handleUpdateThreshold} className="space-y-6">
                <div className="space-y-4">
                  <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4 dark:border-blue-900/20 dark:bg-blue-900/10">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">
                      <span>Current Stock</span>
                      <span>{selectedMedicine.stockQuantity} units</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-blue-100 dark:bg-blue-900/50 overflow-hidden">
                      <div 
                        className="h-full bg-blue-500" 
                        style={{ width: `${Math.min(100, (selectedMedicine.stockQuantity / (newThreshold || 1)) * 50)}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Minimum Safety Quantity</label>
                    <div className="flex items-center gap-4">
                      <input 
                        type="range"
                        min="0"
                        max="500"
                        step="5"
                        className="flex-1 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:bg-slate-800"
                        value={newThreshold}
                        onChange={(e) => setNewThreshold(Number(e.target.value))}
                      />
                      <input 
                        type="number"
                        className="w-20 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm font-black dark:border-slate-800 dark:bg-slate-800"
                        value={newThreshold}
                        onChange={(e) => setNewThreshold(Number(e.target.value))}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 italic">Alerts will trigger when stock drops below this level.</p>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsThresholdModalOpen(false)}
                    className="flex-1 rounded-xl py-3 text-sm font-bold text-slate-500 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-lg hover:bg-blue-700 active:scale-95"
                  >
                    Apply Settings
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isBatchModalOpen && selectedMedicine && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsBatchModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl rounded-2xl bg-white p-8 shadow-2xl dark:bg-zinc-900"
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">{selectedMedicine.name}</h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Manage Multiple Batches</p>
                </div>
                <button 
                  onClick={() => setIsBatchModalOpen(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <div className="grid gap-8 lg:grid-cols-2">
                {/* Existing Batches */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Current Batches & Storage Conditions</h3>
                  <div className="max-h-[320px] space-y-2.5 overflow-y-auto pr-2">
                    {selectedMedicine.batches.map((batch) => {
                      const bDays = getDaysUntilExpiry(batch.expiryDate);
                      const bShelf = getShelfLifeBadgeInfo(bDays);
                      const bStorage = getBatchStorageConditionBadges(
                        selectedMedicine,
                        getMedicineLocation(selectedMedicine),
                        batch.storageCondition
                      );
                      return (
                        <div key={batch.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/50 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold font-mono">#{batch.batchNumber}</span>
                            <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 dark:bg-blue-900/30 dark:border-blue-800">
                              Qty: {batch.quantity}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-black uppercase", bShelf.badgeClass)}>
                              <span className={cn("h-1.5 w-1.5 rounded-full", bShelf.dotClass)} />
                              <span>{bShelf.statusLabel}</span>
                            </span>
                            <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-bold", bStorage.primaryClass)}>
                              <Thermometer size={9} />
                              <span>{bStorage.primaryLabel}</span>
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                            <span className="flex items-center gap-1">
                              <Calendar size={11} />
                              <span>Expires: {formatDate(batch.expiryDate)}</span>
                            </span>
                            <span className="font-semibold">{bShelf.detailLabel}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Add New Batch */}
                <div className="rounded-2xl bg-slate-50 p-6 dark:bg-slate-800/30">
                  <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Add New Batch</h3>
                  <form onSubmit={handleAddBatch} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-slate-500">Batch Number</label>
                      <input 
                        required
                        type="text"
                        className="w-full rounded-xl border bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
                        value={newBatch.batchNumber}
                        onChange={(e) => setNewBatch({...newBatch, batchNumber: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-slate-500">Expiry Date</label>
                      <input 
                        required
                        type="date"
                        className="w-full rounded-xl border bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
                        value={newBatch.expiryDate}
                        onChange={(e) => setNewBatch({...newBatch, expiryDate: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-slate-500">Quantity</label>
                      <input 
                        required
                        type="number"
                        className="w-full rounded-xl border bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
                        value={newBatch.quantity}
                        onChange={(e) => setNewBatch({...newBatch, quantity: Number(e.target.value)})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-slate-500">Batch Storage Condition</label>
                      <select
                        className="w-full rounded-xl border bg-white px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-900"
                        value={newBatch.storageCondition}
                        onChange={(e) => setNewBatch({...newBatch, storageCondition: e.target.value})}
                      >
                        <option value="">Auto-Detect from Formulation / Zone</option>
                        <option value="ambient_crt">Controlled Room Temp (15°C–25°C • Dry)</option>
                        <option value="cold_chain">Cold Chain (2°C–8°C • Do Not Freeze)</option>
                        <option value="cool_dark">Cool & Dark (&lt;25°C • Protect from Light)</option>
                        <option value="moisture_sensitive">Dry & Airtight (&lt;25°C • RH &lt;60%)</option>
                        <option value="controlled_lockbox">Schedule H1 Safe (15°C–25°C • Locked)</option>
                      </select>
                    </div>
                    <button 
                      type="submit"
                      className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-blue-700 active:scale-95"
                    >
                      Record Batch
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isBulkAdjustModalOpen && (
          <BulkStockAdjustModal
            isOpen={isBulkAdjustModalOpen}
            onClose={() => setIsBulkAdjustModalOpen(false)}
            allMedicines={items}
            initialSelectedIds={selectedIds}
            onSuccess={() => {
              fetchData();
              setSelectedIds([]);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isBulkDeleteModalOpen && (
          <BulkDeleteConfirmationModal
            isOpen={isBulkDeleteModalOpen}
            onClose={() => setIsBulkDeleteModalOpen(false)}
            selectedMedicines={selectedMedicinesList}
            onRemoveItemFromBatch={(id) => {
              setSelectedIds(prev => prev.filter(item => item !== id));
            }}
            onSuccess={() => {
              fetchData();
              setSelectedIds([]);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDemandForecasterOpen && (
          <StockDemandForecasterModal
            isOpen={isDemandForecasterOpen}
            onClose={() => setIsDemandForecasterOpen(false)}
            inventory={items}
            onThresholdsUpdated={fetchData}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFormScannerOpen && (
          <BarcodeScanner 
            onScan={(code) => {
              setFormData({...formData, barcode: code});
              setIsFormScannerOpen(false);
            }}
            onClose={() => setIsFormScannerOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Edit Medicine & Location Modal */}
      <AnimatePresence>
        {isEditModalOpen && editingMedicine && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsEditModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-xl rounded-3xl bg-white p-6 sm:p-7 shadow-2xl dark:bg-zinc-900 border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Edit2 size={18} className="text-blue-600" />
                    <span>{tText('Edit Medication & Storage Position', 'दवा और शेल्फ स्थान संपादित करें')}</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    {editingMedicine.name} ({editingMedicine.type?.toUpperCase()})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="col-span-1 sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('medicineName')}</label>
                    <input
                      required
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Generic Name</label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                      value={editFormData.genericName}
                      onChange={(e) => setEditFormData({...editFormData, genericName: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Salt / Composition</label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                      value={editFormData.salt}
                      onChange={(e) => setEditFormData({...editFormData, salt: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('category')}</label>
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                      value={editFormData.type}
                      onChange={(e) => setEditFormData({...editFormData, type: e.target.value as any})}
                    >
                      <option value="tablet">Tablet</option>
                      <option value="capsule">Capsule</option>
                      <option value="injection">Injection</option>
                      <option value="syrup">Syrup</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('price')} (₹)</label>
                    <input
                      required
                      type="number"
                      step="any"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                      value={editFormData.rate}
                      onChange={(e) => setEditFormData({...editFormData, rate: Number(e.target.value)})}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Min Threshold</label>
                    <input
                      required
                      type="number"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                      value={editFormData.minThreshold}
                      onChange={(e) => setEditFormData({...editFormData, minThreshold: Number(e.target.value)})}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('expiry')}</label>
                    <input
                      required
                      type="date"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                      value={editFormData.expiryDate}
                      onChange={(e) => setEditFormData({...editFormData, expiryDate: e.target.value})}
                    />
                  </div>

                  {/* Physical Storage Coordinates Section */}
                  <div className="col-span-1 sm:col-span-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 mb-2 text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      <MapPin size={13} />
                      <span>{tText('Physical Shelf Coordinates & Retrieval Position', 'भौतिक शेल्फ स्थिति')}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500">Aisle / Zone</label>
                        <select
                          className="w-full rounded-lg border bg-zinc-50 px-2.5 py-1.5 text-xs font-bold dark:border-zinc-800 dark:bg-zinc-800"
                          value={editFormData.aisle}
                          onChange={(e) => setEditFormData({...editFormData, aisle: e.target.value})}
                        >
                          {AISLE_PRESETS.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500">Rack / Bay</label>
                        <select
                          className="w-full rounded-lg border bg-zinc-50 px-2.5 py-1.5 text-xs font-bold dark:border-zinc-800 dark:bg-zinc-800"
                          value={editFormData.rack}
                          onChange={(e) => setEditFormData({...editFormData, rack: e.target.value})}
                        >
                          {RACK_PRESETS.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500">Shelf Tier</label>
                        <select
                          className="w-full rounded-lg border bg-zinc-50 px-2.5 py-1.5 text-xs font-bold dark:border-zinc-800 dark:bg-zinc-800"
                          value={editFormData.shelf}
                          onChange={(e) => setEditFormData({...editFormData, shelf: e.target.value})}
                        >
                          {SHELF_PRESETS.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500">Bin Slot</label>
                        <select
                          className="w-full rounded-lg border bg-zinc-50 px-2.5 py-1.5 text-xs font-bold dark:border-zinc-800 dark:bg-zinc-800"
                          value={editFormData.bin}
                          onChange={(e) => setEditFormData({...editFormData, bin: e.target.value})}
                        >
                          {BIN_PRESETS.map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-2 space-y-1">
                      <label className="text-[11px] font-bold text-slate-500">Picking / Handling Notes</label>
                      <input
                        type="text"
                        placeholder="e.g. Keep away from direct light • FIFO earliest batch first"
                        className="w-full rounded-lg border bg-zinc-50 px-3 py-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-800"
                        value={editFormData.notes}
                        onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button 
                    type="button" 
                    onClick={() => setIsEditModalOpen(false)}
                    className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    {t('cancel')}
                  </button>
                  <button 
                    type="submit"
                    className="rounded-xl bg-blue-600 px-6 py-2 text-xs font-black text-white shadow-lg hover:bg-blue-700 active:scale-95 transition-all cursor-pointer"
                  >
                    {t('save')} Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Visual Pharmacy Shelf Locator Modal */}
      <AnimatePresence>
        {isLocatorModalOpen && (
          <VisualShelfLocatorModal
            isOpen={isLocatorModalOpen}
            onClose={() => setIsLocatorModalOpen(false)}
            medicine={locatorTargetMedicine}
            allMedicines={items}
            onLocationUpdated={fetchData}
            onSelectMedicine={(med) => setLocatorTargetMedicine(med)}
          />
        )}
      </AnimatePresence>

      {/* Scan-to-Verify Physical Stock Audit Modal */}
      <AnimatePresence>
        {isScanToVerifyOpen && (
          <ScanToVerifyModal
            isOpen={isScanToVerifyOpen}
            onClose={() => setIsScanToVerifyOpen(false)}
            allMedicines={items}
            onStockUpdated={fetchData}
          />
        )}
      </AnimatePresence>

      {/* QR & Barcode Intake / Add Product Modal */}
      <AnimatePresence>
        {isScanToAddModalOpen && (
          <ScanToAddProductModal
            isOpen={isScanToAddModalOpen}
            onClose={() => setIsScanToAddModalOpen(false)}
            existingMedicines={items}
            onProductAdded={fetchData}
          />
        )}
      </AnimatePresence>

      {/* AI Predictive Stock Refill & Stock-Out Projection Modal */}
      <AnimatePresence>
        {isPredictiveRefillModalOpen && (
          <PredictiveStockRefillModal
            isOpen={isPredictiveRefillModalOpen}
            onClose={() => setIsPredictiveRefillModalOpen(false)}
            inventory={items}
            sales={salesHistory}
            onRestockMedicine={(med, suggestedQty) => {
              setSelectedMedicine(med);
              setNewBatch({
                batchNumber: `RESTOCK-${Date.now().toString().slice(-4)}`,
                expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                quantity: suggestedQty || 20,
                storageCondition: ''
              });
              setIsBatchModalOpen(true);
            }}
            onThresholdsUpdated={fetchData}
          />
        )}
      </AnimatePresence>

      {/* AI Smart Procurement Modal (Sales Velocity & Seasonal Trend Engine) */}
      <AnimatePresence>
        {isSmartProcurementOpen && (
          <SmartProcurementModal
            isOpen={isSmartProcurementOpen}
            onClose={() => setIsSmartProcurementOpen(false)}
            inventory={items}
            salesHistory={salesHistory}
            onOpenBatchModal={(med) => {
              setSelectedMedicine(med);
              setNewBatch({
                batchNumber: `PROC-${Date.now().toString().slice(-4)}`,
                expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                quantity: 30,
                storageCondition: ''
              });
              setIsBatchModalOpen(true);
            }}
            onNavigateToWholesalers={(supplierName) => {
              window.dispatchEvent(new CustomEvent('navigate-to-module', { 
                detail: { module: 'wholesalers', supplier: supplierName } 
              }));
            }}
            onRefreshInventory={fetchData}
          />
        )}
      </AnimatePresence>

      {/* Batch-Specific Quick Action Modal (Direct Restock, Mark as Damaged, View Audit Trail) */}
      <BatchQuickActionModal
        isOpen={batchQuickModalState.isOpen}
        actionType={batchQuickModalState.actionType}
        medicine={batchQuickModalState.medicine}
        initialBatchNumber={batchQuickModalState.batchNumber}
        onClose={() =>
          setBatchQuickModalState(prev => ({
            ...prev,
            isOpen: false
          }))
        }
        onSwitchAction={(nextType) =>
          setBatchQuickModalState(prev => ({
            ...prev,
            actionType: nextType
          }))
        }
        onConfirmRestock={handleConfirmDirectRestock}
        onConfirmDamaged={handleConfirmMarkDamaged}
        onConfirmAddNote={handleConfirmAddBatchNote}
      />

      {/* Floating Action Button (FAB) - Add New Items to Inventory using Room Database (Requirement 1) */}
      <motion.button
        type="button"
        id="fab-inventory-add-product"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsAddModalOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-2xl hover:bg-blue-500 shadow-blue-500/40 cursor-pointer border-2 border-white/20 transition-all"
        title="Add New Medicine to Inventory (Room DB)"
      >
        <Plus size={20} className="stroke-[2.5]" />
        <span className="hidden sm:inline">Add Product (Room DB)</span>
      </motion.button>
    </motion.div>
  );
};

export default Inventory;
