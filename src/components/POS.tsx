import React, { useState, useEffect, useRef } from 'react';
import { collection, query, getDocs, addDoc, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLanguage } from '../context/LanguageContext';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  CreditCard, 
  IndianRupee, 
  Smartphone,
  User,
  Plus,
  Minus,
  CheckCircle2,
  Scan,
  Printer,
  History,
  AlertCircle,
  Stethoscope,
  Sparkles,
  Camera,
  Volume2,
  VolumeX,
  Zap,
  Barcode as BarcodeIcon,
  Check,
  Package,
  Info,
  FileDown
} from 'lucide-react';
import { Medicine, SaleItem, Sale, ReorderTargetPayload } from '../types';
import { useAuth } from './AuthProvider';
import { cn, formatCurrency } from '../lib/utils';
import { logActivity } from '../lib/logger';
import { motion, AnimatePresence } from 'motion/react';
import BarcodeScanner from './BarcodeScanner';
import PrescriptionScannerModal from './PrescriptionScannerModal';
import { useBarcodeKeystrokeListener, playScannerSound } from '../lib/useBarcodeKeystrokeListener';
import { 
  cacheInventoryLocally, 
  getCachedInventory, 
  saveOfflineSale, 
  OfflineSaleItem 
} from '../lib/offlinePosStore';
import OfflinePosManager from './OfflinePosManager';
import InvoiceModal from './InvoiceModal';
import { InvoiceData, downloadInvoicePDF, printInvoicePDF } from '../lib/invoicePdf';
import { logStockMovement } from '../lib/stockAuditService';

interface POSProps {
  reorderTarget?: ReorderTargetPayload | null;
}

const POS: React.FC<POSProps> = ({ reorderTarget }) => {
  const { t, tText } = useLanguage();
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [customer, setCustomer] = useState({ name: '', mobile: '' });
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi'>('cash');
  const [billingType, setBillingType] = useState<'retail' | 'gst' | 'tax_invoice'>('retail');
  const [isSuccess, setIsSuccess] = useState(false);
  const [offlineSuccessMsg, setOfflineSuccessMsg] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isRxScannerOpen, setIsRxScannerOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [activeInvoiceData, setActiveInvoiceData] = useState<InvoiceData | null>(null);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [scanStatus, setScanStatus] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Reorder from Expiry Audit Report
  const [procurementNotice, setProcurementNotice] = useState<{
    medicineName: string;
    batchNumber?: string;
    expiryDate?: string;
    stockQuantity?: number;
    supplier?: string;
  } | null>(null);
  const lastProcessedReorderTime = useRef<number>(0);

  useEffect(() => {
    const handleLoadCart = (e: any) => {
      const { items, customer: cust, note } = e.detail || {};
      if (items && Array.isArray(items) && items.length > 0) {
        setCart(items);
        if (cust?.name) {
          setCustomer({
            name: cust.name,
            mobile: cust.mobile || ''
          });
        }
        setScanStatus({
          message: note || `Loaded ${items.length} items for ${cust?.name || 'Customer'} into cart!`,
          type: 'success'
        });
        setTimeout(() => setScanStatus(null), 5000);
      }
    };

    window.addEventListener('load-pos-cart', handleLoadCart);
    return () => window.removeEventListener('load-pos-cart', handleLoadCart);
  }, []);

  const handleImportFromPrescription = (items: SaleItem[], patientInfo?: { name: string; mobile?: string }) => {
    if (items.length === 0) return;

    setCart(prevCart => {
      let updated = [...prevCart];
      items.forEach(newItem => {
        const existingIdx = updated.findIndex(i => i.medicineId === newItem.medicineId);
        if (existingIdx >= 0) {
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantity: updated[existingIdx].quantity + newItem.quantity
          };
        } else {
          updated.push(newItem);
        }
      });
      return updated;
    });

    if (patientInfo?.name && (!customer.name || customer.name.trim() === '')) {
      setCustomer(prev => ({
        ...prev,
        name: patientInfo.name,
        mobile: patientInfo.mobile || prev.mobile
      }));
    }

    setScanStatus({
      message: `Successfully imported ${items.length} prescribed medications into POS cart!`,
      type: 'success'
    });
    setTimeout(() => setScanStatus(null), 4000);
  };

  const fetchRecentSales = async () => {
    try {
      const q = query(collection(db, 'sales'), orderBy('timestamp', 'desc'), limit(5));
      const snap = await getDocs(q);
      setRecentSales(snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale)));
    } catch (error) {
      console.warn("Could not fetch online recent sales (offline mode active):", error);
    }
  };

  useEffect(() => {
    const fetchMedicines = async () => {
      try {
        const snapPromise = getDocs(collection(db, 'inventory'));
        const timeoutPromise = new Promise<null>((resolve) => 
          setTimeout(() => resolve(null), 8000)
        );

        const snap = await Promise.race([snapPromise, timeoutPromise]);
        if (snap && snap.docs.length > 0) {
          const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() } as Medicine));
          setMedicines(loaded);
          cacheInventoryLocally(loaded);
        } else {
          // Fallback to IndexedDB cache
          const cached = await getCachedInventory();
          if (cached && cached.length > 0) {
            setMedicines(cached);
          }
        }
      } catch (error) {
        console.warn("Network fetch interrupted, loading cached catalog from IndexedDB:", error);
        const cached = await getCachedInventory();
        if (cached && cached.length > 0) {
          setMedicines(cached);
        }
      }
    };
    fetchMedicines();
    fetchRecentSales();
  }, []);

  const addToCart = (med: Medicine) => {
    const existing = cart.find(item => item.medicineId === med.id);
    if (existing) {
      setCart(cart.map(item => 
        item.medicineId === med.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { medicineId: med.id, name: med.name, quantity: 1, price: med.rate }]);
    }
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.medicineId !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.medicineId === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  // Handle pre-selecting medicine from Expiry Audit Report Reorder action
  useEffect(() => {
    const handleProcure = (payload: ReorderTargetPayload) => {
      if (payload.module && payload.module !== 'pos') return;
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

      // Match item from loaded medicines
      const targetLower = payload.medicineName.trim().toLowerCase();
      const matched = medicines.find(
        m => (payload.medicineId && m.id === payload.medicineId) ||
             m.name.toLowerCase() === targetLower ||
             m.name.toLowerCase().includes(targetLower) ||
             targetLower.includes(m.name.toLowerCase())
      );

      if (matched) {
        addToCart(matched);
        setScanStatus({
          message: `Pre-selected & added ${matched.name} (${formatCurrency(matched.rate)}) to POS register!`,
          type: 'success'
        });
        setTimeout(() => setScanStatus(null), 4000);
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
  }, [reorderTarget, medicines]);

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const buildInvoiceData = (saleData?: Partial<Sale>): InvoiceData => {
    const items = saleData?.items || cart;
    const finalTotal = saleData?.totalAmount !== undefined ? saleData.totalAmount : total;
    const custName = saleData?.customerName || customer.name || 'Walk-in Customer';
    const custMobile = saleData?.customerMobile || customer.mobile;
    const timestamp = saleData?.timestamp || new Date().toISOString();
    const saleId = saleData?.id || `POS-${Date.now().toString().slice(-6)}`;
    const invoiceNo = `INV-${saleId.slice(-6).toUpperCase()}`;

    return {
      id: saleId,
      invoiceNo,
      timestamp,
      customerName: custName,
      customerMobile: custMobile,
      items: [...items],
      totalAmount: finalTotal,
      subtotal: finalTotal,
      paymentMethod: saleData?.paymentMethod || paymentMethod,
      billingType: saleData?.billingType || billingType,
      staffName: profile?.displayName || profile?.email?.split('@')[0] || 'Pharmacist',
      staffEmail: profile?.email || 'staff@satyampharma.com',
    };
  };

  const openInvoiceModal = (saleData?: Partial<Sale>) => {
    const invoice = buildInvoiceData(saleData);
    if (invoice.items.length === 0) return;
    setActiveInvoiceData(invoice);
    setIsInvoiceModalOpen(true);
  };

  const handleNewSaleReset = () => {
    setCart([]);
    setCustomer({ name: '', mobile: '' });
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 150);
  };

  const generatePDF = (saleData?: Partial<Sale>) => {
    const invoice = buildInvoiceData(saleData);
    if (invoice.items.length === 0) return;
    downloadInvoicePDF(invoice);
  };

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('satyam_pos_scanner_sound');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [showDemoBarcodes, setShowDemoBarcodes] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Toggle and persist sound preference
  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      localStorage.setItem('satyam_pos_scanner_sound', String(next));
      if (next) playScannerSound('success');
      return next;
    });
  };

  const handleScan = (rawBarcode: string, source: 'keystroke' | 'camera' | 'search' | 'demo' = 'keystroke') => {
    const cleanCode = rawBarcode.trim();
    if (!cleanCode) return;

    setLastScannedCode(cleanCode);

    // Search exact barcode match first
    let medicine = medicines.find(m => m.barcode && m.barcode.trim() === cleanCode);

    // Case-insensitive barcode match
    if (!medicine) {
      medicine = medicines.find(m => m.barcode && m.barcode.trim().toLowerCase() === cleanCode.toLowerCase());
    }

    // Batch barcode or batch number match
    if (!medicine) {
      medicine = medicines.find(m => m.batches && m.batches.some(b => 
        (b.batchNumber && b.batchNumber.toLowerCase() === cleanCode.toLowerCase())
      ));
    }

    // ID match
    if (!medicine) {
      medicine = medicines.find(m => m.id.toLowerCase() === cleanCode.toLowerCase());
    }

    // Exact medicine name match
    if (!medicine) {
      medicine = medicines.find(m => m.name.toLowerCase() === cleanCode.toLowerCase());
    }

    // Partial barcode match fallback (for shorter prefixes or UPCs)
    if (!medicine && cleanCode.length >= 4) {
      medicine = medicines.find(m => m.barcode && m.barcode.toLowerCase().includes(cleanCode.toLowerCase()));
    }

    if (medicine) {
      addToCart(medicine);
      if (soundEnabled) {
        playScannerSound(medicine.stockQuantity > 0 ? 'success' : 'warning');
      }

      // If search input matches or was filled by scanner, clear it for fast continuous scanning
      setSearchTerm('');

      const isLowStock = medicine.stockQuantity <= (medicine.minThreshold || 5);
      const isOutOfStock = medicine.stockQuantity <= 0;

      setScanStatus({
        message: isOutOfStock 
          ? `⚠️ Added ${medicine.name} (${formatCurrency(medicine.rate)}) — OUT OF STOCK (0 units)`
          : `⚡ Scanned: ${medicine.name} (${formatCurrency(medicine.rate)}) — Stock: ${medicine.stockQuantity} [${source.toUpperCase()}]`,
        type: isOutOfStock ? 'error' : 'success'
      });
    } else {
      if (soundEnabled) {
        playScannerSound('error');
      }
      setScanStatus({
        message: `Barcode / Code "${cleanCode}" not mapped to any medicine in inventory`,
        type: 'error'
      });
    }
    
    // Clear status toast after 3.5 seconds
    setTimeout(() => setScanStatus(null), 3500);
  };

  // Hardware Barcode Scanner Keystroke Listener
  const { isScanningBurst } = useBarcodeKeystrokeListener({
    enabled: true,
    playSound: false, // We control rich audio feedback in handleScan
    onScan: (scannedCode) => {
      handleScan(scannedCode, 'keystroke');
    }
  });

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = searchTerm.trim();
      if (!query) return;

      // Check if search term matches a barcode or medicine
      const directMatch = medicines.find(m => 
        (m.barcode && m.barcode.toLowerCase() === query.toLowerCase()) ||
        m.id.toLowerCase() === query.toLowerCase() ||
        m.name.toLowerCase() === query.toLowerCase() ||
        (m.batches && m.batches.some(b => b.batchNumber.toLowerCase() === query.toLowerCase()))
      );

      if (directMatch) {
        handleScan(query, 'search');
      } else if (filteredMedicines.length > 0) {
        // Add the top filtered match
        addToCart(filteredMedicines[0]);
        if (soundEnabled) playScannerSound('success');
        setScanStatus({
          message: `Added top match ${filteredMedicines[0].name} (${formatCurrency(filteredMedicines[0].rate)}) to Cart`,
          type: 'success'
        });
        setSearchTerm('');
        setTimeout(() => setScanStatus(null), 3000);
      } else {
        handleScan(query, 'search');
      }
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    const isDeviceOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    // Helper to process local IndexedDB offline sale
    const processLocalOfflineSale = async (reason?: string) => {
      try {
        const offlineItems: OfflineSaleItem[] = cart.map(item => ({
          id: item.medicineId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          unit: item.unit,
          batch: item.batchNumber
        }));

        const savedOffline = await saveOfflineSale({
          timestamp: new Date().toISOString(),
          customerName: customer.name || 'Walk-in Customer',
          customerMobile: customer.mobile || '',
          items: offlineItems,
          totalAmount: total,
          paymentMethod,
          billingType,
          staffId: profile?.uid,
          staffEmail: profile?.email || 'staff@satyampharma.com',
          staffName: profile?.displayName || profile?.email?.split('@')[0] || 'Pharmacist'
        });

        // Set active invoice data and display printable bill / PDF modal
        const offlineInvoiceData = buildInvoiceData({
          id: savedOffline.id,
          customerName: customer.name,
          customerMobile: customer.mobile,
          items: cart,
          totalAmount: total,
          timestamp: savedOffline.timestamp,
          paymentMethod,
          billingType
        });
        setActiveInvoiceData(offlineInvoiceData);
        setIsInvoiceModalOpen(true);

        setOfflineSuccessMsg(`Sale saved to Offline IndexedDB (#${savedOffline.id.slice(-6)}). Will auto-sync when connected.`);
        setIsSuccess(true);
        setCart([]);
        setCustomer({ name: '', mobile: '' });
        if (soundEnabled) playScannerSound('success');

        setTimeout(() => {
          setIsSuccess(false);
          setOfflineSuccessMsg(null);
        }, 5000);
      } catch (err: any) {
        console.error("IndexedDB offline write error:", err);
        alert(`Failed to save offline sale: ${err?.message || 'IndexedDB storage error'}`);
      }
    };

    // 1. If currently offline, process straight to IndexedDB
    if (!isDeviceOnline) {
      await processLocalOfflineSale('Browser is offline');
      return;
    }

    // 2. If online, attempt Firestore commit with fail-safe fallback to IndexedDB
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Network timeout')), 6000)
      );

      const writeProcess = async () => {
        const saleRef = await addDoc(collection(db, 'sales'), {
          timestamp: new Date().toISOString(),
          customerName: customer.name || 'Walk-in Customer',
          customerMobile: customer.mobile || '',
          items: cart,
          totalAmount: total,
          paymentMethod,
          billingType,
          staffId: profile?.uid
        });
        return saleRef;
      };

      const saleRef: any = await Promise.race([writeProcess(), timeoutPromise]);

      await logActivity({
        action: 'Sale Processed',
        description: `Processed ${billingType.toUpperCase()} sale of ${cart.length} items for ${formatCurrency(total)} (${paymentMethod.toUpperCase()})`,
        type: 'sale',
        module: 'pos',
        userEmail: profile?.email || 'staff@satyampharma.com',
        userId: profile?.uid,
        userName: profile?.displayName || profile?.email?.split('@')[0] || 'Pharmacist',
        userRole: profile?.role || 'clerk',
        severity: 'success',
        details: {
          saleId: saleRef.id,
          invoiceNo: `INV-${saleRef.id.slice(-6).toUpperCase()}`,
          totalAmount: total,
          itemCount: cart.length,
          paymentMethod,
          billingType,
          customerName: customer.name || 'Walk-in Customer',
          customerMobile: customer.mobile || '',
          itemsSummary: cart.map(i => `${i.name} (x${i.quantity})`).join(', ')
        }
      });

      // Log stock subtractions to stock audit ledger
      cart.forEach((cItem) => {
        const foundMed = medicines.find(m => m.id === cItem.medicineId);
        const prevQty = foundMed ? Number(foundMed.stockQuantity) || 0 : cItem.quantity;
        logStockMovement({
          medicineId: cItem.medicineId,
          medicineName: cItem.name,
          batchNumber: cItem.batchNumber || 'GEN-01',
          type: 'subtraction',
          quantity: cItem.quantity,
          previousStock: prevQty,
          newStock: Math.max(0, prevQty - cItem.quantity),
          reason: `POS Finalized Bill #INV-${saleRef.id.slice(-6).toUpperCase()} (${paymentMethod.toUpperCase()})`,
          userName: profile?.displayName || profile?.email?.split('@')[0] || 'Pharmacist',
          userRole: profile?.role || 'clerk'
        }).catch(e => console.warn('Stock audit log notice:', e));
      });
      
      // Set active invoice data and display printable bill / PDF modal immediately
      const onlineInvoiceData = buildInvoiceData({
        id: saleRef.id,
        customerName: customer.name,
        customerMobile: customer.mobile,
        items: cart,
        totalAmount: total,
        timestamp: new Date().toISOString(),
        paymentMethod,
        billingType
      });
      setActiveInvoiceData(onlineInvoiceData);
      setIsInvoiceModalOpen(true);

      setIsSuccess(true);
      setCart([]);
      setCustomer({ name: '', mobile: '' });
      fetchRecentSales();
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (error) {
      console.warn("Online write encountered an issue. Falling back to local IndexedDB storage:", error);
      await processLocalOfflineSale('Network write error');
    }
  };

  const filteredMedicines = medicines.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.genericName?.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 5);

  return (
    <div className="space-y-4 pb-12">
      {/* Offline POS Status, Cache Monitor & Auto-Sync Engine Ribbon */}
      <OfflinePosManager />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Search & Selection */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          
          {/* Expiry Audit Reorder Procurement Notice Banner */}
          {procurementNotice && (
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border-2 border-indigo-300 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200 text-xs shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
                  <ShoppingCart size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-white px-2 py-0.5 rounded">
                      Reorder Item
                    </span>
                    <span className="font-bold text-indigo-900 dark:text-indigo-100">
                      Pre-selected: <strong>{procurementNotice.medicineName}</strong>
                    </span>
                  </div>
                  <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-0.5">
                    {procurementNotice.batchNumber && `Expiring Batch: ${procurementNotice.batchNumber}`}
                    {procurementNotice.expiryDate && ` (Exp: ${procurementNotice.expiryDate})`}
                    {procurementNotice.supplier && ` • Wholesaler: ${procurementNotice.supplier}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProcurementNotice(null)}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition-all self-start sm:self-center"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Hardware Barcode Scanner Status Toolbar */}
          <div className="mb-4 rounded-lg bg-slate-50 p-3 border border-slate-200/80 dark:bg-slate-800/60 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className={cn(
                  "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
                  isScanningBurst ? "bg-amber-400" : "bg-emerald-400"
                )} />
                <span className={cn(
                  "relative inline-flex rounded-full h-2.5 w-2.5",
                  isScanningBurst ? "bg-amber-500" : "bg-emerald-500"
                )} />
              </span>
              <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                <BarcodeIcon size={15} className="text-slate-500 dark:text-slate-400" />
                <span className="font-bold text-[11px] uppercase tracking-wider">
                  {isScanningBurst ? "Reading Barcode Stream..." : "Hardware Scanner: Active"}
                </span>
                <span className="hidden sm:inline text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                  (USB / Bluetooth HID Keyboard Wedge)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSound}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer",
                  soundEnabled 
                    ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800" 
                    : "bg-slate-200/60 text-slate-500 border border-slate-300 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600"
                )}
                title={soundEnabled ? "Scanner beep audio feedback enabled" : "Scanner audio feedback muted"}
              >
                {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                <span>{soundEnabled ? "Beep ON" : "Muted"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDemoBarcodes(!showDemoBarcodes)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-200/70 text-slate-700 hover:bg-slate-300 transition-colors dark:bg-slate-700 dark:text-slate-300 cursor-pointer"
                title="Test barcode scanning with sample catalog items"
              >
                <Sparkles size={12} className="text-amber-500" />
                <span>{showDemoBarcodes ? "Hide Test Barcodes" : "Test Barcodes"}</span>
              </button>
            </div>
          </div>

          {/* Quick Demo Barcodes Ribbon */}
          <AnimatePresence>
            {showDemoBarcodes && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 overflow-hidden rounded-lg bg-amber-50/70 border border-amber-200/70 p-3 dark:bg-amber-950/20 dark:border-amber-900/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <Info size={13} /> Click any sample barcode to simulate hardware scanner gun input:
                  </span>
                  <span className="text-[9px] text-amber-700/70 dark:text-amber-400">Maps directly to medicine inventory</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {medicines.filter(m => m.barcode).slice(0, 6).map(med => (
                    <button
                      key={med.id}
                      type="button"
                      onClick={() => handleScan(med.barcode!, 'demo')}
                      className="group flex items-center gap-1.5 rounded-md bg-white border border-amber-200 px-2.5 py-1 text-left text-xs transition-all hover:bg-amber-100 hover:border-amber-400 dark:bg-slate-900 dark:border-amber-900/60 dark:hover:bg-amber-900/30 cursor-pointer"
                    >
                      <Package size={12} className="text-amber-600 dark:text-amber-400" />
                      <span className="font-semibold text-[11px] text-slate-800 dark:text-slate-200">{med.name}</span>
                      <span className="font-mono text-[9px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-amber-700 dark:text-amber-300">
                        {med.barcode}
                      </span>
                    </button>
                  ))}
                  {medicines.filter(m => m.barcode).length === 0 && (
                    <span className="text-[11px] text-slate-500">No medicines with barcodes found. Add barcodes in Inventory module to test.</span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-800 dark:text-slate-200">{t('pos')}</h2>
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={() => setIsRxScannerOpen(true)}
                id="pos-scan-doctor-rx-btn"
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition-all hover:shadow-indigo-500/25 active:scale-95 cursor-pointer"
                title="Scan doctor's prescription with camera & parse with AI into order"
              >
                <Stethoscope size={14} className="text-blue-200" />
                <span>Scan Doctor's Rx</span>
                <Sparkles size={11} className="text-amber-300" />
              </button>
              <button 
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg transition-transform active:scale-95 cursor-pointer"
              >
                <Scan size={14} />
                <span>{t('quickScan')}</span>
              </button>
            </div>
          </div>
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 text-slate-400" size={18} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={`${t('search')} (or scan product barcode / press Enter to add)...`}
              className="pos-search-input w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-20 text-sm shadow-sm outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-800"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            <div className="absolute right-2.5 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsRxScannerOpen(true)}
                id="pos-camera-scan-rx-icon-btn"
                className="rounded-lg bg-indigo-50 dark:bg-indigo-950/60 p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors cursor-pointer"
                title="Capture & Parse Doctor's Prescription Photo with AI"
              >
                <Camera size={16} />
              </button>
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                id="pos-camera-scan-input-btn"
                className="rounded-lg bg-blue-50 dark:bg-blue-950/60 p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors cursor-pointer"
                title="Open Camera Barcode / QR Scanner"
              >
                <Scan size={16} />
              </button>
            </div>
          </div>

          {searchTerm && (
            <div className="mt-4 divide-y border border-slate-200 rounded-xl overflow-hidden dark:border-slate-800">
              {filteredMedicines.map(med => (
                <button
                  key={med.id}
                  onClick={() => {
                    addToCart(med);
                    setSearchTerm('');
                  }}
                  className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-blue-900/10"
                >
                  <div>
                    <p className="text-sm font-bold">{med.name}</p>
                    <p className="text-[10px] uppercase font-semibold text-slate-500">
                      {med.genericName} • Stock: {med.stockQuantity} {med.barcode ? `• Barcode: ${med.barcode}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-blue-600">{formatCurrency(med.rate)}</p>
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">{med.type}</p>
                  </div>
                </button>
              ))}
              {filteredMedicines.length === 0 && (
                <div className="p-8 text-center text-[10px] font-bold uppercase text-slate-400">No results found (Press Enter to search code)</div>
              )}
            </div>
          )}
        </div>

        {/* Customer Details */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
            <User size={14} /> Customer Profile
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              type="text"
              placeholder="Customer Name (Optional)"
              className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-800"
              value={customer.name}
              onChange={(e) => setCustomer({...customer, name: e.target.value})}
            />
            <input
              type="text"
              placeholder="Mobile Number"
              className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-800"
              value={customer.mobile}
              onChange={(e) => setCustomer({...customer, mobile: e.target.value})}
            />
          </div>
        </div>

        <AnimatePresence>
          {isScannerOpen && (
            <div className="relative">
              <BarcodeScanner 
                onScan={(barcode) => handleScan(barcode, 'camera')}
                onClose={() => setIsScannerOpen(false)}
              />
            </div>
          )}
        </AnimatePresence>

        {/* Global Floating Barcode Scan Feedback Toast */}
        <AnimatePresence>
          {scanStatus && (
            <motion.div 
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={cn(
                "fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3.5 rounded-2xl font-bold text-xs shadow-2xl flex items-center gap-3 border backdrop-blur-md",
                scanStatus.type === 'success' 
                  ? "bg-emerald-900/95 text-emerald-100 border-emerald-500/50 shadow-emerald-950/40" 
                  : "bg-rose-900/95 text-rose-100 border-rose-500/50 shadow-rose-950/40"
              )}
            >
              {scanStatus.type === 'success' ? (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shrink-0">
                  <CheckCircle2 size={18} />
                </div>
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500 text-white shrink-0">
                  <AlertCircle size={18} />
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-semibold text-xs">{scanStatus.message}</span>
                {lastScannedCode && (
                  <span className="text-[10px] opacity-75 font-mono">Code: {lastScannedCode}</span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cart Display */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 dark:bg-slate-800/50 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <ShoppingCart size={14} /> Invoice Summary
            </h3>
            {cart.length > 0 && (
              <button 
                type="button"
                id="pos-cart-preview-invoice-btn"
                onClick={() => openInvoiceModal()}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                title="Preview printable tax invoice / generate PDF bill"
              >
                <Printer size={14} />
                <span>{t('generateInvoice')}</span>
              </button>
            )}
          </div>
          <div className="p-0 divide-y divide-slate-100 dark:divide-slate-800">
            {cart.map((item, idx) => (
              <div 
                key={item.medicineId} 
                className={cn(
                  "flex items-center justify-between p-4 transition-all",
                  idx % 2 === 0 
                    ? "bg-white dark:bg-slate-900" 
                    : "bg-slate-50/60 dark:bg-slate-850/50",
                  "hover:bg-blue-50/40 dark:hover:bg-blue-950/20"
                )}
              >
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{item.name}</p>
                  <p className="text-[10px] font-bold uppercase text-slate-500 font-mono">{formatCurrency(item.price)} per unit • Batch: {item.batchNumber || 'N/A'}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                    <button onClick={() => updateQuantity(item.medicineId, -1)} className="p-1 text-slate-400 hover:text-blue-600 cursor-pointer"><Minus size={14}/></button>
                    <span className="w-8 text-center text-xs font-bold">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.medicineId, 1)} className="p-1 text-slate-400 hover:text-blue-600 cursor-pointer"><Plus size={14}/></button>
                  </div>
                  <div className="w-24 text-right">
                    <p className="text-sm font-black text-slate-900 dark:text-slate-100">{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                  <button onClick={() => removeFromCart(item.medicineId)} className="text-slate-300 hover:text-red-500 cursor-pointer p-1">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <ShoppingCart size={40} className="mb-4 opacity-10" />
                <p className="text-[10px] font-bold uppercase tracking-widest">Cart is empty</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Checkout Section */}
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-6 text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('checkout')}</h3>
          
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-tight text-slate-500">Billing Type</p>
              <div className="flex gap-2">
                {(['retail', 'gst', 'tax_invoice'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setBillingType(type)}
                    className={cn(
                      "flex-1 rounded-lg border py-2 text-[10px] font-bold uppercase tracking-tight transition-all",
                      billingType === type ? "bg-slate-900 border-slate-900 text-white dark:bg-blue-600 dark:border-blue-600" : "border-slate-100 text-slate-400 dark:border-slate-800"
                    )}
                  >
                    {type.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-tight text-slate-500">{t('paymentMethod')}</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'cash', icon: IndianRupee, label: 'Cash' },
                  { id: 'card', icon: CreditCard, label: 'Card' },
                  { id: 'upi', icon: Smartphone, label: 'UPI' },
                ].map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setPaymentMethod(mode.id as any)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border p-4 transition-all",
                      paymentMethod === mode.id ? "bg-slate-50 border-slate-900 text-slate-900 dark:bg-blue-900/20 dark:border-blue-600 dark:text-blue-400" : "border-slate-50 text-slate-400 dark:border-slate-800"
                    )}
                  >
                    <mode.icon size={20} />
                    <span className="text-[10px] font-bold uppercase tracking-tight">{mode.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-50 pt-6 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Subtotal</span>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{formatCurrency(total)}</span>
              </div>
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">{t('total')}</span>
                <span className="text-xl font-black text-blue-600">{formatCurrency(total)}</span>
              </div>
              
              <button
                onClick={handleCheckout}
                disabled={cart.length === 0}
                className="w-full flex items-center justify-center gap-3 rounded-xl bg-slate-900 py-4 text-xs font-bold uppercase tracking-[0.2em] text-white shadow-xl transition-all hover:bg-slate-800 disabled:opacity-50 active:scale-95 dark:bg-blue-600"
              >
                {isSuccess ? (
                  <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="flex items-center gap-2">
                    <CheckCircle2 size={18} /> <span>Transaction Recorded</span>
                  </motion.div>
                ) : (
                  <>{t('confirmSale')}</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Quick Help */}
        <div className="rounded-xl bg-slate-900 p-6 text-white shadow-xl dark:bg-blue-600">
          <p className="mb-1 text-[10px] font-black uppercase tracking-widest opacity-60">Quick Tip</p>
          <p className="text-[11px] font-bold italic leading-relaxed">"Always verify medicine expiry during billing to ensure patient safety."</p>
        </div>

        {/* Transaction History */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <History size={14} /> {t('recentTransactions')}
            </h3>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-sales-report'))}
              className="flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              title="Generate comprehensive sales reports & PDF statements"
            >
              <FileDown size={12} />
              <span>Sales Audit PDF</span>
            </button>
          </div>
          
          <div className="space-y-4">
            {recentSales.length > 0 ? (
              recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0 dark:border-slate-800">
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-slate-900 dark:text-slate-100">
                      {sale.customerName || 'Walk-in'}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {formatCurrency(sale.totalAmount)}
                    </p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => openInvoiceModal(sale)}
                    className="p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors dark:hover:bg-slate-800 dark:hover:text-blue-400 cursor-pointer"
                    title={tText('View, Print & Download Invoice', 'चालान देखें, प्रिंट करें और डाउनलोड करें')}
                  >
                    <Printer size={16} />
                  </button>
                </div>
              ))
            ) : (
              <p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 py-4">
                {t('noTransactions')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      {isScannerOpen && (
        <BarcodeScanner
          onScan={handleScan}
          onClose={() => setIsScannerOpen(false)}
          title="POS Barcode / QR Scanner"
        />
      )}

      {/* Doctor's Prescription AI Camera & Parsing Modal */}
      {isRxScannerOpen && (
        <PrescriptionScannerModal
          onClose={() => setIsRxScannerOpen(false)}
          onImportToCart={handleImportFromPrescription}
          availableMedicines={medicines}
          patientContextName={customer.name || undefined}
        />
      )}

      {/* Interactive Printable Tax Invoice / Bill PDF Modal */}
      <InvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        invoiceData={activeInvoiceData}
        onNewSale={handleNewSaleReset}
      />

      {/* Scan Feedback Status Toast */}
      {scanStatus && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className={cn(
            "rounded-xl px-4 py-3 shadow-2xl flex items-center gap-2.5 text-xs font-bold text-white border",
            scanStatus.type === 'success' 
              ? "bg-emerald-600 border-emerald-500 shadow-emerald-600/30" 
              : "bg-rose-600 border-rose-500 shadow-rose-600/30"
          )}>
            {scanStatus.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{scanStatus.message}</span>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default POS;
