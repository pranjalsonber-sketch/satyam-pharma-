import React, { useState, useRef, useEffect } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { 
  Camera, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Package, 
  Calendar, 
  DollarSign, 
  Layers, 
  FlaskConical, 
  Tag, 
  Building2, 
  MapPin, 
  Plus, 
  RefreshCw, 
  Volume2, 
  VolumeX, 
  Volume1,
  Upload, 
  ArrowRight,
  Barcode,
  QrCode,
  Check,
  AlertTriangle,
  Music
} from 'lucide-react';
import { Medicine, StorageLocation } from '../types';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logActivity } from '../lib/logger';
import { useAuth } from './AuthProvider';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { 
  playScanCaptureBeep, 
  playMedicineIdentifiedBeep, 
  playProductAddedChime, 
  playErrorAlertBeep 
} from '../lib/audioFeedback';

interface ScanToAddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingMedicines: Medicine[];
  onProductAdded: () => void;
}

interface ScannedProductData {
  barcode: string;
  name: string;
  genericName: string;
  salt: string;
  formula: string;
  manufacturer: string;
  rate: number;
  type: 'tablet' | 'capsule' | 'injection' | 'syrup' | 'others';
  minThreshold: number;
  stockQuantity: number;
  batchNumber: string;
  mfgDate: string;
  expiryDate: string;
  location: {
    aisle: string;
    rack: string;
    shelf: string;
    bin: string;
  };
  source?: string;
  isAiEnriched?: boolean;
}

const PRESET_DEMO_CODES = [
  { 
    label: 'Dolo 650 (EAN-13)', 
    code: '8901086001234',
    type: '1D Barcode',
    desc: 'Paracetamol IP 650mg Antipyretic'
  },
  { 
    label: 'Augmentin 625 Duo (GS1)', 
    code: '(01)08901086005678(17)270630(11)240601(10)AUG8923',
    type: '2D GS1 DataMatrix',
    desc: 'Amoxicillin + Clavulanic Acid with Mfg & Exp'
  },
  { 
    label: 'Pan 40 (EAN-13)', 
    code: '8901086009012',
    type: '1D Barcode',
    desc: 'Pantoprazole Sodium 40mg PPI'
  },
  { 
    label: 'Azithral 500 (EAN-13)', 
    code: '8901086003456',
    type: '1D Barcode',
    desc: 'Azithromycin 500mg Macrolide'
  },
  { 
    label: 'Pharma QR Payload (JSON)', 
    code: JSON.stringify({
      name: "Montek-LC Tablet",
      salt: "Montelukast Sodium (10mg) + Levocetirizine HCl (5mg)",
      formula: "C35H36ClNO3S (Montelukast) + C21H25ClN2O3 (Levocetirizine)",
      mfg: "2024-04-10",
      exp: "2026-10-31",
      mrp: 185.00,
      batch: "MLC-4091",
      qty: 25,
      type: "tablet",
      manufacturer: "Sun Pharma"
    }),
    type: 'Pharma QR (JSON)',
    desc: 'Complete package barcode with formula & dates'
  }
];

export const ScanToAddProductModal: React.FC<ScanToAddProductModalProps> = ({
  isOpen,
  onClose,
  existingMedicines,
  onProductAdded
}) => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'manual'>('camera');
  const [cameraState, setCameraState] = useState<'initializing' | 'active' | 'error' | 'denied'>('initializing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [loudAudioMode, setLoudAudioMode] = useState(true); // Default high-clarity boost for noisy counters
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [manualCodeInput, setManualCodeInput] = useState('');
  const [recentScannedList, setRecentScannedList] = useState<Array<{ name: string; formula: string; qty: number; timestamp: string }>>([]);

  // Visual feedback states: Flash effect & Floating Success Toast
  const [isScanFlashing, setIsScanFlashing] = useState(false);
  const [isSuccessFlash, setIsSuccessFlash] = useState(false);
  const [activeToast, setActiveToast] = useState<{
    id: string;
    type: 'scan' | 'add' | 'restock' | 'info';
    title: string;
    subtitle: string;
    quantity?: number;
  } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showFeedbackToast = (toast: {
    id: string;
    type: 'scan' | 'add' | 'restock' | 'info';
    title: string;
    subtitle: string;
    quantity?: number;
  }) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setActiveToast(toast);
    toastTimeoutRef.current = setTimeout(() => {
      setActiveToast(null);
    }, 4000);
  };

  // Parsed product form state
  const [formData, setFormData] = useState<ScannedProductData>({
    barcode: '',
    name: '',
    genericName: '',
    salt: '',
    formula: '',
    manufacturer: '',
    rate: 50,
    type: 'tablet',
    minThreshold: 10,
    stockQuantity: 10,
    batchNumber: '',
    mfgDate: '',
    expiryDate: '',
    location: {
      aisle: 'Aisle A',
      rack: 'Rack R-01',
      shelf: 'Shelf Level 2',
      bin: 'Bin 01'
    }
  });

  const [hasScannedResult, setHasScannedResult] = useState(false);
  const [existingMatch, setExistingMatch] = useState<Medicine | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio Cue Trigger using Web Audio API synthesis
  const triggerAudioBeep = (type: 'scan' | 'identify' | 'add' | 'error' = 'scan') => {
    if (!soundEnabled) return;
    const vol = loudAudioMode ? 0.32 : 0.18;
    if (type === 'scan') {
      playScanCaptureBeep(vol);
    } else if (type === 'identify') {
      playMedicineIdentifiedBeep(vol);
    } else if (type === 'add') {
      playProductAddedChime(loudAudioMode ? 0.36 : 0.22);
    } else if (type === 'error') {
      playErrorAlertBeep(vol);
    }
  };

  const testAudioCue = () => {
    triggerAudioBeep('scan');
    setTimeout(() => triggerAudioBeep('add'), 250);
  };

  // Start Camera
  const startCameraScanner = async () => {
    if (!isOpen || activeTab !== 'camera') return;
    setCameraState('initializing');
    setErrorMessage(null);

    const elementId = "scan-to-add-camera-view";
    
    // Stop any existing
    if (scannerRef.current) {
      try {
        if (isScanningRef.current) {
          await scannerRef.current.stop();
          isScanningRef.current = false;
        }
        scannerRef.current.clear();
      } catch (e) {
        console.warn('Scanner cleanup warning:', e);
      }
    }

    try {
      const scanner = new Html5Qrcode(elementId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
        ],
        verbose: false,
      });

      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 15, qrbox: { width: 280, height: 180 }, aspectRatio: 1.333 },
        (decodedText) => {
          handleCodeDetected(decodedText);
        },
        () => {}
      );

      isScanningRef.current = true;
      setCameraState('active');
    } catch (err: any) {
      console.warn("Camera start error:", err);
      isScanningRef.current = false;
      const errStr = String(err).toLowerCase();
      if (errStr.includes('permission') || errStr.includes('denied') || errStr.includes('notallowed')) {
        setCameraState('denied');
        setErrorMessage("Camera access permission was denied. Please allow camera permissions or use manual entry.");
      } else {
        setCameraState('error');
        setErrorMessage(err?.message || "No camera device detected in browser environment.");
      }
    }
  };

  // Stop Camera
  const stopCameraScanner = async () => {
    if (scannerRef.current) {
      const scanner = scannerRef.current;
      if (isScanningRef.current) {
        isScanningRef.current = false;
        try {
          await scanner.stop();
        } catch (e) {
          console.warn("Scanner stop error:", e);
        }
      }
      try {
        scanner.clear();
      } catch (clearErr) {
        // Safe ignore if container was already manipulated or detached by React
      }
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'camera') {
      startCameraScanner();
    } else {
      stopCameraScanner();
    }

    return () => {
      stopCameraScanner();
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [isOpen, activeTab]);

  // Handle scanned or entered code
  const handleCodeDetected = async (rawCode: string) => {
    const cleanCode = rawCode.trim();
    if (!cleanCode) return;

    // Trigger visual scanner flash effect
    setIsScanFlashing(true);
    setTimeout(() => setIsScanFlashing(false), 450);

    // Play POS Laser Scan Capture Beep immediately
    triggerAudioBeep('scan');
    setIsParsing(true);
    setSaveSuccessMessage(null);

    // Trigger initial detection toast
    showFeedbackToast({
      id: crypto.randomUUID(),
      type: 'scan',
      title: 'Barcode / QR Code Captured',
      subtitle: `Analyzing pharmacy specifications for ${cleanCode.slice(0, 20)}${cleanCode.length > 20 ? '...' : ''}`
    });

    // Check if this barcode already exists in inventory
    const matched = existingMedicines.find(m => 
      (m.barcode && m.barcode === cleanCode) ||
      (m.name.toLowerCase() === cleanCode.toLowerCase())
    );
    setExistingMatch(matched || null);

    try {
      const res = await fetch('/api/ai/parse-medicine-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawCode: cleanCode })
      });

      if (res.ok) {
        const parsed = await res.json();
        const detectedName = parsed.name || (matched ? matched.name : 'Medication Item');
        setFormData({
          barcode: parsed.barcode || cleanCode,
          name: detectedName,
          genericName: parsed.genericName || parsed.salt || (matched ? matched.genericName || '' : ''),
          salt: parsed.salt || parsed.formula || (matched ? matched.salt || '' : ''),
          formula: parsed.formula || parsed.salt || (matched ? (matched.formula || matched.salt || '') : ''),
          manufacturer: parsed.manufacturer || (matched ? matched.manufacturer || '' : 'Pharma Labs'),
          rate: Number(parsed.rate) || (matched ? matched.rate : 50),
          type: parsed.type || (matched ? matched.type : 'tablet'),
          minThreshold: Number(parsed.minThreshold) || (matched ? matched.minThreshold : 10),
          stockQuantity: Number(parsed.stockQuantity) || 10,
          batchNumber: parsed.batchNumber || 'BCH-' + Math.floor(1000 + Math.random() * 9000),
          mfgDate: parsed.mfgDate || new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10),
          expiryDate: parsed.expiryDate || new Date(Date.now() + 600 * 86400000).toISOString().slice(0, 10),
          location: parsed.location || {
            aisle: matched?.location?.aisle || 'Aisle A',
            rack: matched?.location?.rack || 'Rack R-01',
            shelf: matched?.location?.shelf || 'Shelf Level 2',
            bin: matched?.location?.bin || 'Bin 01'
          },
          source: parsed.source,
          isAiEnriched: parsed.isAiEnriched
        });
        setHasScannedResult(true);

        // Play Medicine Identified confirmation audio cue
        triggerAudioBeep('identify');

        showFeedbackToast({
          id: crypto.randomUUID(),
          type: matched ? 'info' : 'scan',
          title: matched ? `Catalog Item: ${detectedName}` : `Parsed: ${detectedName}`,
          subtitle: `${parsed.type || 'tablet'} • ₹${parsed.rate || 50} • Exp: ${parsed.expiryDate || 'N/A'}${matched ? ` (Stock: ${matched.stockQuantity})` : ''}`
        });
      } else {
        // Fallback manual defaults
        const detectedName = matched ? matched.name : `Scanned Medicine (${cleanCode.slice(-6)})`;
        setFormData({
          barcode: cleanCode,
          name: detectedName,
          genericName: matched?.genericName || '',
          salt: matched?.salt || '',
          formula: matched?.formula || matched?.salt || '',
          manufacturer: matched?.manufacturer || 'Pharmaceuticals',
          rate: matched ? matched.rate : 50,
          type: matched ? matched.type : 'tablet',
          minThreshold: matched ? matched.minThreshold : 10,
          stockQuantity: 10,
          batchNumber: 'BAT-' + Math.floor(1000 + Math.random() * 9000),
          mfgDate: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10),
          expiryDate: new Date(Date.now() + 600 * 86400000).toISOString().slice(0, 10),
          location: {
            aisle: matched?.location?.aisle || 'Aisle A',
            rack: matched?.location?.rack || 'Rack R-01',
            shelf: matched?.location?.shelf || 'Shelf Level 2',
            bin: matched?.location?.bin || 'Bin 01'
          }
        });
        setHasScannedResult(true);
        triggerAudioBeep('identify');
      }
    } catch (err) {
      console.error("Barcode parse error:", err);
      setFormData({
        barcode: cleanCode,
        name: `Scanned Item (${cleanCode.slice(-6)})`,
        genericName: '',
        salt: '',
        formula: '',
        manufacturer: 'Pharma Labs',
        rate: 50,
        type: 'tablet',
        minThreshold: 10,
        stockQuantity: 10,
        batchNumber: 'BCH-' + Math.floor(1000 + Math.random() * 9000),
        mfgDate: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10),
        expiryDate: new Date(Date.now() + 600 * 86400000).toISOString().slice(0, 10),
        location: {
          aisle: 'Aisle A',
          rack: 'Rack R-01',
          shelf: 'Shelf Level 2',
          bin: 'Bin 01'
        }
      });
      setHasScannedResult(true);
      triggerAudioBeep('identify');
    } finally {
      setIsParsing(false);
    }
  };

  // Image File Upload Scan
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const html5QrCode = new Html5Qrcode("upload-scan-helper");
      const decoded = await html5QrCode.scanFile(file, true);
      handleCodeDetected(decoded);
    } catch (err: any) {
      alert("Could not detect a clear barcode or QR code in the uploaded image. Please try a clearer picture or manual entry.");
      setIsParsing(false);
    }
  };

  // Save Scanned Product to Inventory / Database
  const handleSaveProduct = async (asNewBatchToExisting: boolean = false) => {
    if (!formData.name.trim()) {
      alert("Please provide a medicine name.");
      return;
    }

    setIsSaving(true);
    try {
      const newBatchItem = {
        id: crypto.randomUUID(),
        batchNumber: formData.batchNumber || 'BATCH-' + Math.floor(1000 + Math.random() * 9000),
        expiryDate: formData.expiryDate || new Date(Date.now() + 600 * 86400000).toISOString().slice(0, 10),
        quantity: Number(formData.stockQuantity) || 10
      };

      const storageLoc: StorageLocation = {
        aisle: formData.location.aisle || 'Aisle A',
        rack: formData.location.rack || 'Rack R-01',
        shelf: formData.location.shelf || 'Shelf Level 2',
        bin: formData.location.bin || 'Bin 01'
      };

      if (asNewBatchToExisting && existingMatch) {
        // Restock existing medicine with this new batch
        const updatedBatches = [...(existingMatch.batches || []), newBatchItem];
        const newTotalStock = updatedBatches.reduce((acc, b) => acc + b.quantity, 0);
        const earliestExpiry = updatedBatches.reduce((min, b) => b.expiryDate < min ? b.expiryDate : min, updatedBatches[0].expiryDate);

        const docRef = doc(db, 'inventory', existingMatch.id);
        await updateDoc(docRef, {
          batches: updatedBatches,
          stockQuantity: newTotalStock,
          expiryDate: earliestExpiry,
          mfgDate: formData.mfgDate || existingMatch.mfgDate || '',
          salt: formData.salt || existingMatch.salt || '',
          formula: formData.formula || existingMatch.formula || '',
          rate: Number(formData.rate) || existingMatch.rate,
          updatedAt: new Date().toISOString()
        });

        await logActivity({
          action: 'QR/Barcode Batch Restocked',
          description: `Restocked ${existingMatch.name} (+${formData.stockQuantity} units, Batch: ${formData.batchNumber}, Exp: ${formData.expiryDate}) via Barcode Scanner`,
          type: 'inventory',
          module: 'inventory',
          userEmail: profile?.email || 'admin@satyampharma.com',
          userId: profile?.uid,
          userName: profile?.displayName || 'Staff',
          userRole: profile?.role || 'clerk',
          severity: 'success',
          details: {
            medicineName: existingMatch.name,
            barcode: formData.barcode,
            addedQuantity: formData.stockQuantity,
            newTotalStock,
            mfgDate: formData.mfgDate,
            expiryDate: formData.expiryDate,
            rate: formData.rate,
            formula: formData.formula
          }
        });

        setSaveSuccessMessage(`Successfully restocked ${existingMatch.name} with +${formData.stockQuantity} units!`);
        showFeedbackToast({
          id: crypto.randomUUID(),
          type: 'restock',
          title: `Restocked: ${existingMatch.name}`,
          subtitle: `+${formData.stockQuantity} units added (New Total: ${newTotalStock}) • Batch ${newBatchItem.batchNumber}`,
          quantity: formData.stockQuantity
        });
      } else {
        // Add brand new medicine record
        await addDoc(collection(db, 'inventory'), {
          name: formData.name,
          genericName: formData.genericName || formData.salt,
          salt: formData.salt,
          formula: formData.formula || formData.salt,
          barcode: formData.barcode,
          rate: Number(formData.rate) || 50,
          manufacturer: formData.manufacturer || '',
          type: formData.type || 'tablet',
          minThreshold: Number(formData.minThreshold) || 10,
          stockQuantity: Number(formData.stockQuantity) || 10,
          mfgDate: formData.mfgDate || '',
          expiryDate: formData.expiryDate || '',
          batchNumber: formData.batchNumber || '',
          batches: [newBatchItem],
          location: storageLoc,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        await logActivity({
          action: 'QR/Barcode Product Registered',
          description: `Added new medicine: ${formData.name} (${formData.stockQuantity} units, ${formData.type.toUpperCase()}, ₹${formData.rate}) [Formula: ${formData.formula || formData.salt || '-'}]`,
          type: 'inventory',
          module: 'inventory',
          userEmail: profile?.email || 'admin@satyampharma.com',
          userId: profile?.uid,
          userName: profile?.displayName || 'Staff',
          userRole: profile?.role || 'clerk',
          severity: 'success',
          details: {
            medicineName: formData.name,
            barcode: formData.barcode,
            formula: formData.formula || formData.salt,
            mfgDate: formData.mfgDate,
            expiryDate: formData.expiryDate,
            rate: formData.rate,
            type: formData.type,
            quantity: formData.stockQuantity
          }
        });

        setSaveSuccessMessage(`Successfully registered ${formData.name} into medicine records!`);
        showFeedbackToast({
          id: crypto.randomUUID(),
          type: 'add',
          title: `Product Added: ${formData.name}`,
          subtitle: `Successfully saved ${formData.stockQuantity} units (${formData.type.toUpperCase()}) • Rate: ₹${formData.rate}`,
          quantity: formData.stockQuantity
        });
      }

      // Trigger green success burst flash
      setIsSuccessFlash(true);
      setTimeout(() => setIsSuccessFlash(false), 700);

      // Play Product Added confirmation chime
      triggerAudioBeep('add');
      setRecentScannedList(prev => [
        {
          name: formData.name,
          formula: formData.formula || formData.salt || 'Standard Formula',
          qty: Number(formData.stockQuantity) || 10,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        ...prev.slice(0, 5)
      ]);

      onProductAdded();
      
      // Reset form after short delay or keep open for rapid multi-scan
      setTimeout(() => {
        setHasScannedResult(false);
        setExistingMatch(null);
        setSaveSuccessMessage(null);
        if (activeTab === 'camera') {
          startCameraScanner();
        }
      }, 1600);

    } catch (err: any) {
      console.error("Save scanned medicine error:", err);
      triggerAudioBeep('error');
      alert("Failed to save medicine to database: " + (err?.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  // Product types summary calculation
  const totalProductTypes = existingMedicines.length;
  const totalStockQuantity = existingMedicines.reduce((sum, m) => sum + (m.stockQuantity || 0), 0);
  const typeCounts = existingMedicines.reduce((acc, m) => {
    const t = m.type || 'tablet';
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md overflow-y-auto">
      <div id="upload-scan-helper" className="hidden" />

      {/* Floating Success / Scan Toast Notification */}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ opacity: 0, y: -30, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 450, damping: 28 }}
            className={cn(
              "fixed top-6 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[92vw] sm:w-auto px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3.5 border backdrop-blur-xl pointer-events-auto",
              activeToast.type === 'add' || activeToast.type === 'restock'
                ? "bg-slate-900/95 text-emerald-100 border-emerald-500/60 shadow-emerald-950/50"
                : activeToast.type === 'info'
                ? "bg-slate-900/95 text-amber-100 border-amber-500/60 shadow-amber-950/50"
                : "bg-slate-900/95 text-blue-100 border-blue-500/60 shadow-blue-950/50"
            )}
          >
            {/* Visual Icon Badge */}
            <div className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl shrink-0 shadow-md",
              activeToast.type === 'add' || activeToast.type === 'restock'
                ? "bg-emerald-500 text-white shadow-emerald-500/30"
                : activeToast.type === 'info'
                ? "bg-amber-500 text-white shadow-amber-500/30"
                : "bg-blue-600 text-white shadow-blue-500/30 animate-pulse"
            )}>
              {activeToast.type === 'add' ? (
                <CheckCircle2 size={20} />
              ) : activeToast.type === 'restock' ? (
                <Layers size={20} />
              ) : activeToast.type === 'info' ? (
                <AlertTriangle size={20} />
              ) : (
                <Sparkles size={20} />
              )}
            </div>

            {/* Text Content */}
            <div className="flex flex-col min-w-0 pr-2">
              <div className="flex items-center gap-2">
                <span className="font-black text-xs text-white tracking-wide truncate">
                  {activeToast.title}
                </span>
                {activeToast.quantity && (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-300 border border-emerald-500/30 shrink-0">
                    +{activeToast.quantity} QTY
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-300 truncate mt-0.5">
                {activeToast.subtitle}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setActiveToast(null)}
              className="ml-auto rounded-lg p-1 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className={cn(
          "relative flex w-full max-w-4xl flex-col rounded-2xl border bg-white shadow-2xl dark:bg-slate-900 max-h-[90vh] overflow-hidden transition-all duration-300",
          isSuccessFlash 
            ? "border-emerald-500 ring-4 ring-emerald-500/30 shadow-emerald-500/20 dark:border-emerald-400" 
            : isScanFlashing 
            ? "border-blue-500 ring-2 ring-blue-500/30 dark:border-blue-400"
            : "border-slate-200 dark:border-slate-800"
        )}
      >
        {/* Full-Modal Success / Scan Flash Overlay Animation */}
        <AnimatePresence>
          {isScanFlashing && (
            <motion.div
              initial={{ opacity: 0.8 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="pointer-events-none absolute inset-0 z-40 bg-blue-500/15 backdrop-blur-[1px]"
            />
          )}
          {isSuccessFlash && (
            <motion.div
              initial={{ opacity: 0.85 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="pointer-events-none absolute inset-0 z-40 bg-gradient-to-br from-emerald-500/20 via-emerald-400/10 to-transparent backdrop-blur-[1px]"
            />
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-2.5 text-white shadow-md shadow-blue-500/20">
              <QrCode size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  QR & Barcode Product Intake Scanner
                </h2>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  Smart AI Parser
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Scan pharmaceutical barcodes & QR codes to record chemical formula, mfg date, expiry, price & quantities.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Audio Profile & High-Noise Environment Booster */}
            <div className="hidden sm:flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
                  soundEnabled 
                    ? "bg-blue-600 text-white shadow-xs" 
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                )}
                title={soundEnabled ? "Mute audio cues" : "Enable audio cues"}
              >
                {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                <span>{soundEnabled ? "Audio On" : "Muted"}</span>
              </button>

              {soundEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    const next = !loudAudioMode;
                    setLoudAudioMode(next);
                    if (next) {
                      triggerAudioBeep('scan');
                    }
                  }}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer",
                    loudAudioMode
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  )}
                  title="Boost audio frequencies for noisy counters and warehouses"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                  <span>{loudAudioMode ? "Loud Boost" : "Normal"}</span>
                </button>
              )}

              {soundEnabled && (
                <button
                  type="button"
                  onClick={testAudioCue}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  title="Test scan beep & add chime"
                >
                  <Music size={12} />
                  <span>Test Beep</span>
                </button>
              )}
            </div>

            {/* Mobile Sound Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                if (next) triggerAudioBeep('scan');
              }}
              className={cn(
                "sm:hidden rounded-lg p-2 transition-colors cursor-pointer",
                soundEnabled 
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400" 
                  : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
              )}
              title={soundEnabled ? "Mute audio beeps" : "Enable scan audio beeps"}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>

            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Store Catalog Live Diversity Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-slate-100 bg-slate-50/50 px-6 py-2.5 text-xs dark:border-slate-800/80 dark:bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Product Types</p>
              <p className="font-bold text-slate-800 dark:text-slate-200">{totalProductTypes} Unique Medicines</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Total Stock Quantity</p>
              <p className="font-bold text-emerald-700 dark:text-emerald-400">{totalStockQuantity} Units in Stock</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FlaskConical size={16} className="text-purple-600 dark:text-purple-400 shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Tablets / Syrups</p>
              <p className="font-bold text-slate-700 dark:text-slate-300">
                {typeCounts.tablet || 0} Tabs • {typeCounts.syrup || 0} Liq
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Caps / Injections</p>
              <p className="font-bold text-slate-700 dark:text-slate-300">
                {typeCounts.capsule || 0} Caps • {typeCounts.injection || 0} Inj
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Left Column: Scanner / Input Controls */}
          <div className="md:col-span-6 space-y-4">
            {/* Tab Navigation */}
            <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('camera')}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all cursor-pointer",
                  activeTab === 'camera'
                    ? "bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-400"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                )}
              >
                <Camera size={14} />
                <span>Live Camera</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all cursor-pointer",
                  activeTab === 'upload'
                    ? "bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-400"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                )}
              >
                <Upload size={14} />
                <span>Upload Image</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('manual')}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all cursor-pointer",
                  activeTab === 'manual'
                    ? "bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-400"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                )}
              >
                <Barcode size={14} />
                <span>Manual Code</span>
              </button>
            </div>

            {/* View 1: Live Camera Scanner */}
            {activeTab === 'camera' && (
              <div className={cn(
                "relative overflow-hidden rounded-2xl border-2 transition-all duration-300 bg-slate-950 p-2",
                isScanFlashing 
                  ? "border-emerald-400 shadow-lg shadow-emerald-500/30 scale-[1.01]" 
                  : "border-dashed border-slate-300 dark:border-slate-700"
              )}>
                <div className="relative h-56 w-full rounded-xl overflow-hidden bg-black flex items-center justify-center">
                  {/* Dedicated html5-qrcode root container (kept empty of React children to prevent removeChild collision) */}
                  <div 
                    id="scan-to-add-camera-view" 
                    className="absolute inset-0 w-full h-full"
                  />

                  {cameraState === 'initializing' && (
                    <div className="relative z-10 flex flex-col items-center gap-2 text-slate-400 pointer-events-none">
                      <RefreshCw size={24} className="animate-spin text-blue-500" />
                      <p className="text-xs font-medium">Initializing camera stream...</p>
                    </div>
                  )}
                  {cameraState === 'denied' && (
                    <div className="relative z-10 flex flex-col items-center gap-2 text-center p-4 text-rose-400">
                      <AlertCircle size={28} />
                      <p className="text-xs font-semibold">Camera Access Restricted</p>
                      <p className="text-[11px] text-slate-400">Please switch to "Upload Image" or "Manual Code" below.</p>
                    </div>
                  )}
                  {cameraState === 'error' && (
                    <div className="relative z-10 flex flex-col items-center gap-2 text-center p-4 text-amber-400">
                      <Camera size={28} />
                      <p className="text-xs font-semibold">Camera Not Accessible</p>
                      <p className="text-[11px] text-slate-400">{errorMessage || "Use presets or manual barcode entry."}</p>
                    </div>
                  )}

                  {/* Camera Scanner Viewfinder & Laser Pulse Line */}
                  {cameraState === 'active' && (
                    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
                      <div className={cn(
                        "relative w-56 h-32 rounded-xl border-2 transition-all duration-300 overflow-hidden",
                        isScanFlashing 
                          ? "border-emerald-400 bg-emerald-500/20 shadow-[0_0_20px_#10b981]" 
                          : "border-blue-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]"
                      )}>
                        {/* High-Tech Animated Laser Line */}
                        <div className={cn(
                          "absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#38bdf8] top-1/2 -translate-y-1/2",
                          isScanFlashing ? "via-emerald-400 shadow-[0_0_16px_#10b981] scale-y-150" : "animate-pulse"
                        )} />

                        {/* Scanner Corner Crosshairs */}
                        <div className="absolute top-0 left-0 h-3.5 w-3.5 border-t-2 border-l-2 border-cyan-400 rounded-tl-xs" />
                        <div className="absolute top-0 right-0 h-3.5 w-3.5 border-t-2 border-r-2 border-cyan-400 rounded-tr-xs" />
                        <div className="absolute bottom-0 left-0 h-3.5 w-3.5 border-b-2 border-l-2 border-cyan-400 rounded-bl-xs" />
                        <div className="absolute bottom-0 right-0 h-3.5 w-3.5 border-b-2 border-r-2 border-cyan-400 rounded-br-xs" />
                      </div>
                    </div>
                  )}

                  {/* Flash Ripple Indicator on Scan */}
                  <AnimatePresence>
                    {isScanFlashing && (
                      <motion.div 
                        initial={{ opacity: 0.9, scale: 0.9 }}
                        animate={{ opacity: 0, scale: 1.15 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.45 }}
                        className="pointer-events-none absolute inset-0 flex items-center justify-center bg-emerald-500/30"
                      >
                        <div className="flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-white shadow-lg">
                          <Check size={16} />
                          <span>Code Captured!</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {cameraState === 'active' && (
                  <div className="absolute inset-x-4 top-4 flex items-center justify-between pointer-events-none">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                      <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                      Camera Scanning Active
                    </span>
                    <span className="text-[10px] font-mono text-white/80 bg-black/60 px-2 py-0.5 rounded">
                      Align QR / Barcode in frame
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* View 2: Image Upload */}
            {activeTab === 'upload' && (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/50 p-8 text-center transition-colors hover:bg-blue-50 cursor-pointer dark:border-blue-900/50 dark:bg-blue-950/20"
              >
                <div className="rounded-full bg-blue-100 p-3 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                  <Upload size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Upload Medicine Barcode / QR Image
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    PNG, JPG, or WEBP from packaging, carton, or strip
                  </p>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleImageUpload} 
                />
                <button
                  type="button"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
                >
                  Select Picture from Device
                </button>
              </div>
            )}

            {/* View 3: Manual Code Entry */}
            {activeTab === 'manual' && (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (manualCodeInput.trim()) {
                    handleCodeDetected(manualCodeInput.trim());
                  }
                }}
                className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40"
              >
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Enter Barcode Number, GS1 String, or Medicine Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 8901086001234 or Augmentin 625"
                    value={manualCodeInput}
                    onChange={(e) => setManualCodeInput(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900"
                  />
                  <button
                    type="submit"
                    disabled={!manualCodeInput.trim() || isParsing}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                  >
                    <ArrowRight size={14} />
                    <span>Lookup</span>
                  </button>
                </div>
              </form>
            )}

            {/* Fast Demo Barcode / QR Selection */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>Quick Pharma Test Barcodes (Click to Test)</span>
                <span className="text-blue-600 dark:text-blue-400 text-[10px]">Instant AI Parsing</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRESET_DEMO_CODES.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleCodeDetected(preset.code)}
                    className="flex flex-col text-left rounded-xl border border-slate-200 bg-white p-2.5 transition-all hover:border-blue-400 hover:bg-blue-50/50 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:border-blue-600 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{preset.label}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        {preset.type}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {preset.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Recently Scanned Session Feed */}
            {recentScannedList.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/30">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Scanned in this Session ({recentScannedList.length})
                </p>
                <div className="space-y-1.5 max-h-24 overflow-y-auto">
                  {recentScannedList.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs bg-white px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800 dark:bg-slate-900">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{item.name}</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">+{item.qty} units</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Scanned Product Details & Verification Form */}
          <div className="md:col-span-6 flex flex-col justify-between space-y-4">
            {isParsing ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-blue-200 bg-blue-50/30 p-8 text-center dark:border-blue-900/40 dark:bg-blue-950/10 min-h-[350px]">
                <Sparkles size={36} className="text-blue-600 animate-spin mb-3" />
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Parsing Barcode & Chemical Formula...
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  Extracting manufacturing date, expiry date, chemical formula, and standard Indian pharmaceutical MRP.
                </p>
              </div>
            ) : hasScannedResult ? (
              <div className="space-y-3">
                {/* Notification Banner */}
                {saveSuccessMessage ? (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>{saveSuccessMessage}</span>
                  </div>
                ) : existingMatch ? (
                  <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300 text-xs">
                    <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Catalog Match Found:</span> "{existingMatch.name}" is already in records (Current Stock: {existingMatch.stockQuantity} units).
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                        You can restock it with this new batch or register as a separate item.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-200 p-2.5 text-blue-800 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300 text-xs">
                    <Check size={14} className="text-blue-600 shrink-0" />
                    <span>New Medication Extracted — Verify details below and save to list:</span>
                  </div>
                )}

                {/* Form Fields Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Medicine Name */}
                  <div className="sm:col-span-2">
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Medicine / Product Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>

                  {/* Active Chemical Formula / Salt */}
                  <div className="sm:col-span-2">
                    <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between mb-1">
                      <span>Active Chemical Formula / Salt Composition</span>
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-normal flex items-center gap-1">
                        <FlaskConical size={11} />
                        Chemical Identity
                      </span>
                    </label>
                    <input
                      type="text"
                      value={formData.formula || formData.salt}
                      onChange={(e) => setFormData({ ...formData, formula: e.target.value, salt: e.target.value })}
                      placeholder="e.g. Paracetamol IP 650mg, Amoxicillin + Clavulanic Acid"
                      className="w-full rounded-xl border border-slate-200 bg-purple-50/30 px-3 py-2 text-xs font-medium text-purple-950 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-purple-950/20 dark:text-purple-200"
                    />
                  </div>

                  {/* Date of Manufacture */}
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Date of Manufacture (Mfg)
                    </label>
                    <input
                      type="date"
                      value={formData.mfgDate}
                      onChange={(e) => setFormData({ ...formData, mfgDate: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>

                  {/* Expiry Date */}
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Date of Expiry (Exp) *
                    </label>
                    <input
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 outline-none focus:border-rose-500 dark:border-slate-700 dark:bg-slate-900 dark:text-rose-400"
                    />
                  </div>

                  {/* Rate / MRP & Quantity */}
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Unit Rate / MRP (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.rate}
                        onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) || 0 })}
                        className="w-full rounded-xl border border-slate-200 bg-white pl-7 pr-3 py-2 text-xs font-bold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Intake Quantity (Units) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.stockQuantity}
                      onChange={(e) => setFormData({ ...formData, stockQuantity: parseInt(e.target.value) || 1 })}
                      className="w-full rounded-xl border border-slate-200 bg-emerald-50/50 px-3 py-2 text-xs font-bold text-emerald-800 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                    />
                  </div>

                  {/* Batch Number & Product Type */}
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Batch Number
                    </label>
                    <input
                      type="text"
                      value={formData.batchNumber}
                      onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Dosage Form / Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 capitalize"
                    >
                      <option value="tablet">Tablet</option>
                      <option value="capsule">Capsule</option>
                      <option value="syrup">Syrup (Liquid)</option>
                      <option value="injection">Injection</option>
                      <option value="others">Ointment / Drops / Others</option>
                    </select>
                  </div>

                  {/* Barcode / SKU */}
                  <div className="sm:col-span-2">
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Barcode / GTIN Code
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={formData.barcode}
                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                        className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-mono text-slate-600 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      />
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500 dark:bg-slate-800">
                        {formData.barcode.length} digits
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  {existingMatch && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveProduct(true)}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-xs font-bold text-white shadow-md shadow-amber-600/20 hover:bg-amber-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      <Layers size={16} />
                      <span>Restock Existing ({existingMatch.name})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveProduct(false)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:from-blue-700 hover:to-indigo-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <CheckCircle2 size={16} />
                    <span>{existingMatch ? "Add as Separate New SKU" : "Save & Add to Medicine List"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center dark:border-slate-800 dark:bg-slate-800/20 min-h-[350px]">
                <div className="rounded-full bg-blue-100/80 p-4 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 mb-3">
                  <QrCode size={36} />
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Ready to Scan Medicine
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  Scan any 1D barcode or 2D pharma QR code on the camera view, or pick a sample code on the left to extract the product formula, dates, rate, and quantity.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3 dark:border-slate-800 dark:bg-slate-800/50">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Records automatically sync across the pharmacy POS, Inventory, and Expiry Audit.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 cursor-pointer"
          >
            Close Scanner
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ScanToAddProductModal;
