import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from './AuthProvider';
import { Medicine, Batch, ActivityLog } from '../types';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { logActivity } from '../lib/logger';
import { playScanCaptureBeep, playMedicineIdentifiedBeep, playErrorAlertBeep } from '../lib/audioFeedback';
import {
  X,
  Camera,
  Scan,
  RefreshCw,
  Volume2,
  VolumeX,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Keyboard,
  Upload,
  Sparkles,
  Layers,
  FileDown,
  Download,
  IndianRupee,
  MapPin,
  Clock,
  ArrowRight,
  ShieldAlert,
  Sliders,
  Check,
  Plus,
  Minus,
  RotateCcw,
  CheckCheck,
  ListOrdered,
  Eye,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ScanToVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  allMedicines: Medicine[];
  onStockUpdated?: () => void;
}

export interface VerifiedItemRecord {
  id: string;
  medicineId: string;
  medicineName: string;
  barcode: string;
  batchNumber: string;
  systemStock: number;
  physicalStock: number;
  stockDelta: number;
  systemExpiry: string;
  physicalExpiry: string;
  expiryMismatch: boolean;
  status: 'match' | 'shortage' | 'surplus' | 'expiry_mismatch' | 'uncataloged';
  valuationDelta: number;
  unitRate: number;
  verifiedAt: string;
  adjustedInDb: boolean;
  notes: string;
  shelfLocation: string;
}

export const ScanToVerifyModal: React.FC<ScanToVerifyModalProps> = ({
  isOpen,
  onClose,
  allMedicines,
  onStockUpdated
}) => {
  const { tText, isHindi } = useLanguage();
  const { profile } = useAuth();

  // Active View Tab: 'scanner' or 'session_log'
  const [activeTab, setActiveTab] = useState<'scanner' | 'session_log'>('scanner');

  // Scanner & Camera State
  const [cameraState, setCameraState] = useState<'initializing' | 'active' | 'error' | 'denied'>('initializing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [continuousScanMode, setContinuousScanMode] = useState(false);
  const [manualBarcodeInput, setManualBarcodeInput] = useState('');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Active Verification Target
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [matchedMedicine, setMatchedMedicine] = useState<Medicine | null>(null);
  const [selectedBatchIndex, setSelectedBatchIndex] = useState<number>(0);
  const [physicalCount, setPhysicalCount] = useState<number>(0);
  const [physicalExpiry, setPhysicalExpiry] = useState<string>('');
  const [physicalBatchNum, setPhysicalBatchNum] = useState<string>('');
  const [auditNotes, setAuditNotes] = useState<string>('');

  // Status & Actions
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastCommittedRecord, setLastCommittedRecord] = useState<VerifiedItemRecord | null>(null);
  const [sessionRecords, setSessionRecords] = useState<VerifiedItemRecord[]>([]);

  // Refs for scanner
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);
  const lastScanTimeRef = useRef<number>(0);
  const lastCodeRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

  // Audio Beep generator
  const playBeep = (isError: boolean = false) => {
    if (!soundEnabled) return;
    if (isError) {
      playErrorAlertBeep(0.25);
    } else {
      playScanCaptureBeep(0.25);
    }
  };

  // Text-To-Speech spoken status
  const speakTTS = (textToSpeak: string) => {
    if (!ttsEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.lang = isHindi ? 'hi-IN' : 'en-IN';
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('TTS error:', err);
    }
  };

  // Start Camera Barcode Scanner
  const startScanner = async (targetFacingMode: 'environment' | 'user') => {
    if (!isOpen) return;
    setCameraState('initializing');
    setErrorMessage(null);

    const elementId = 'scan-to-verify-camera-view';

    if (html5QrcodeRef.current) {
      try {
        if (isScanningRef.current) {
          await html5QrcodeRef.current.stop();
          isScanningRef.current = false;
        }
        html5QrcodeRef.current.clear();
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
          Html5QrcodeSupportedFormats.DATA_MATRIX
        ],
        verbose: false
      });

      html5QrcodeRef.current = scanner;

      const config = {
        fps: 15,
        qrbox: { width: 260, height: 160 },
        aspectRatio: 1.333
      };

      await scanner.start(
        { facingMode: targetFacingMode },
        config,
        (decodedText) => {
          handleIncomingBarcode(decodedText);
        },
        () => {
          // Continuous frame error tick (no barcode in frame)
        }
      );

      isScanningRef.current = true;
      setCameraState('active');
    } catch (err: any) {
      console.warn('Camera start not available:', err?.name || err?.message || err);
      isScanningRef.current = false;

      const errStr = String(err).toLowerCase();
      if (errStr.includes('notallowederror') || errStr.includes('permission') || errStr.includes('denied')) {
        setCameraState('denied');
        setErrorMessage(
          tText(
            'Camera access denied. Please enable camera permissions in your browser address bar or use manual barcode entry.',
            'कैमरा एक्सेस अस्वीकृत। कृपया ब्राउज़र में कैमरा अनुमति दें या बारकोड मैन्युअल रूप से दर्ज करें।'
          )
        );
      } else {
        setCameraState('error');
        setErrorMessage(
          err?.message ||
            tText('Unable to access camera feed in this browser. Please use manual entry.', 'कैमरा शुरू करने में असमर्थ। कृपया मैन्युअल रूप से दर्ज करें।')
        );
      }

      setTimeout(() => {
        manualInputRef.current?.focus();
      }, 100);
    }
  };

  // Cleanup scanner on unmount or tab switch
  useEffect(() => {
    if (isOpen && activeTab === 'scanner') {
      startScanner(facingMode);
    } else {
      if (html5QrcodeRef.current) {
        const scanner = html5QrcodeRef.current;
        if (isScanningRef.current) {
          isScanningRef.current = false;
          scanner
            .stop()
            .then(() => {
              try {
                scanner.clear();
              } catch (err) {
                // Ignore if container is already unmounted by React
              }
            })
            .catch((e) => console.warn('Stop error:', e));
        } else {
          try {
            scanner.clear();
          } catch (err) {
            // Ignore if container is already unmounted
          }
        }
      }
    }

    return () => {
      if (html5QrcodeRef.current) {
        const scanner = html5QrcodeRef.current;
        if (isScanningRef.current) {
          isScanningRef.current = false;
          scanner
            .stop()
            .then(() => {
              try {
                scanner.clear();
              } catch (err) {
                // Ignore if container is already unmounted by React
              }
            })
            .catch((e) => console.warn('Stop error on unmount:', e));
        } else {
          try {
            scanner.clear();
          } catch (err) {
            // Ignore if container is already unmounted
          }
        }
      }
    };
  }, [isOpen, activeTab, facingMode]);

  // Handle incoming barcode from Camera, Image upload, or Manual entry
  const handleIncomingBarcode = (rawBarcode: string) => {
    const cleanCode = rawBarcode.trim();
    if (!cleanCode) return;

    const now = Date.now();
    if (cleanCode === lastCodeRef.current && now - lastScanTimeRef.current < 1500) {
      return; // prevent spamming duplicate scans
    }

    lastCodeRef.current = cleanCode;
    lastScanTimeRef.current = now;

    setScannedBarcode(cleanCode);

    // Look up medicine in inventory
    const found = allMedicines.find(
      (m) =>
        m.barcode?.toLowerCase() === cleanCode.toLowerCase() ||
        m.id.toLowerCase() === cleanCode.toLowerCase() ||
        m.name.toLowerCase() === cleanCode.toLowerCase() ||
        m.batches?.some((b) => b.batchNumber.toLowerCase() === cleanCode.toLowerCase())
    );

    if (found) {
      playBeep(false);
      setMatchedMedicine(found);
      setSelectedBatchIndex(0);
      const initialBatch = found.batches?.[0];
      const initialCount = initialBatch ? initialBatch.quantity : found.stockQuantity;
      const initialExp = initialBatch ? initialBatch.expiryDate : found.expiryDate;
      const initialBatchNum = initialBatch ? initialBatch.batchNumber : 'N/A';

      setPhysicalCount(initialCount);
      setPhysicalExpiry(initialExp || '');
      setPhysicalBatchNum(initialBatchNum);
      setAuditNotes('');
      setLastCommittedRecord(null);

      speakTTS(
        isHindi
          ? `${found.name} स्कैन हुआ। वर्तमान स्टॉक ${found.stockQuantity} यूनिट है।`
          : `${found.name} scanned. System stock is ${found.stockQuantity} units.`
      );
    } else {
      playBeep(true);
      setMatchedMedicine(null);
      setPhysicalCount(0);
      setPhysicalExpiry('');
      setPhysicalBatchNum('');
      setAuditNotes('');
      setLastCommittedRecord(null);

      speakTTS(
        isHindi
          ? `चेतावनी: बारकोड ${cleanCode} कैटलॉग में नहीं मिला।`
          : `Alert: Unregistered barcode ${cleanCode} not found in inventory catalog.`
      );
    }
  };

  // Switch Batch when medicine has multiple batches
  const handleBatchSelect = (idx: number) => {
    if (!matchedMedicine || !matchedMedicine.batches?.[idx]) return;
    setSelectedBatchIndex(idx);
    const b = matchedMedicine.batches[idx];
    setPhysicalCount(b.quantity);
    setPhysicalExpiry(b.expiryDate);
    setPhysicalBatchNum(b.batchNumber);
  };

  // Image Upload Barcode Scanning
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingImage(true);
    setImageError(null);

    try {
      let scanner = html5QrcodeRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode('scan-to-verify-camera-view', {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.DATA_MATRIX
          ],
          verbose: false
        });
      }

      const decodedText = await scanner.scanFile(file, true);
      handleIncomingBarcode(decodedText);
      setImageError(null);
    } catch (err: any) {
      console.warn('File decode error:', err);
      setImageError(
        tText('No barcode could be detected in this photo. Try scanning directly with camera.', 'इस फोटो में कोई बारकोड नहीं मिला।')
      );
      playBeep(true);
    } finally {
      setIsProcessingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Discrepancy Calculations
  const currentBatch = matchedMedicine?.batches?.[selectedBatchIndex] || {
    id: 'default',
    batchNumber: physicalBatchNum || 'N/A',
    quantity: matchedMedicine?.stockQuantity || 0,
    expiryDate: matchedMedicine?.expiryDate || ''
  };

  const systemQuantity = currentBatch.quantity;
  const stockDelta = physicalCount - systemQuantity;
  const unitRate = matchedMedicine?.rate || 0;
  const valuationDelta = stockDelta * unitRate;

  const isExpiryMismatch = Boolean(
    matchedMedicine &&
      physicalExpiry &&
      currentBatch.expiryDate &&
      physicalExpiry !== currentBatch.expiryDate
  );

  const isPhysicallyExpired = Boolean(
    physicalExpiry && new Date(physicalExpiry) < new Date()
  );

  const discrepancyStatus: VerifiedItemRecord['status'] = useMemo(() => {
    if (!matchedMedicine) return 'uncataloged';
    if (isPhysicallyExpired || isExpiryMismatch) return 'expiry_mismatch';
    if (stockDelta < 0) return 'shortage';
    if (stockDelta > 0) return 'surplus';
    return 'match';
  }, [matchedMedicine, stockDelta, isPhysicallyExpired, isExpiryMismatch]);

  // Commit Verification & Log Discrepancy to Firestore
  const handleCommitVerification = async (shouldAutoAdjustStock: boolean = false) => {
    if (!scannedBarcode) return;
    setIsSubmitting(true);

    try {
      const shelfLoc = matchedMedicine?.location
        ? `${matchedMedicine.location.aisle} • ${matchedMedicine.location.rack} • ${matchedMedicine.location.shelf} (${matchedMedicine.location.bin || 'Bin 01'})`
        : 'General Storage';

      const record: VerifiedItemRecord = {
        id: crypto.randomUUID(),
        medicineId: matchedMedicine?.id || 'uncataloged',
        medicineName: matchedMedicine?.name || `Unregistered SKU (${scannedBarcode})`,
        barcode: scannedBarcode,
        batchNumber: physicalBatchNum || currentBatch.batchNumber || 'N/A',
        systemStock: systemQuantity,
        physicalStock: physicalCount,
        stockDelta: stockDelta,
        systemExpiry: currentBatch.expiryDate || 'N/A',
        physicalExpiry: physicalExpiry || 'N/A',
        expiryMismatch: isExpiryMismatch || isPhysicallyExpired,
        status: discrepancyStatus,
        valuationDelta: valuationDelta,
        unitRate: unitRate,
        verifiedAt: new Date().toISOString(),
        adjustedInDb: shouldAutoAdjustStock,
        notes: auditNotes.trim(),
        shelfLocation: shelfLoc
      };

      // 1. If user chose to auto-adjust inventory to physical count in Firestore
      if (shouldAutoAdjustStock && matchedMedicine) {
        const docRef = doc(db, 'inventory', matchedMedicine.id);
        const existingBatches = [...(matchedMedicine.batches || [])];

        if (existingBatches[selectedBatchIndex]) {
          existingBatches[selectedBatchIndex] = {
            ...existingBatches[selectedBatchIndex],
            quantity: physicalCount,
            expiryDate: physicalExpiry || existingBatches[selectedBatchIndex].expiryDate,
            batchNumber: physicalBatchNum || existingBatches[selectedBatchIndex].batchNumber
          };
        } else {
          existingBatches.push({
            id: crypto.randomUUID(),
            batchNumber: physicalBatchNum || 'AUDIT-BATCH',
            expiryDate: physicalExpiry || matchedMedicine.expiryDate,
            quantity: physicalCount
          });
        }

        const newTotalStock = existingBatches.reduce((sum, b) => sum + b.quantity, 0);
        const nearestExpiry = existingBatches.reduce(
          (min, b) => (b.expiryDate < min ? b.expiryDate : min),
          existingBatches[0]?.expiryDate || matchedMedicine.expiryDate
        );

        await updateDoc(docRef, {
          batches: existingBatches,
          stockQuantity: newTotalStock,
          expiryDate: nearestExpiry,
          lastPhysicalAuditAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        if (onStockUpdated) onStockUpdated();
      }

      // 2. Determine Log Action & Severity
      let logAction = 'PHYSICAL_STOCK_VERIFICATION';
      let logSeverity: 'info' | 'success' | 'warning' | 'danger' = 'info';

      if (!matchedMedicine) {
        logAction = 'UNCATALOGED_BARCODE_FLAGGED';
        logSeverity = 'warning';
      } else if (isPhysicallyExpired) {
        logAction = 'EXPIRED_STOCK_DISCREPANCY_FLAGGED';
        logSeverity = 'danger';
      } else if (stockDelta < 0) {
        logAction = 'STOCK_SHORTAGE_FLAGGED';
        logSeverity = Math.abs(valuationDelta) > 500 ? 'danger' : 'warning';
      } else if (stockDelta > 0) {
        logAction = 'STOCK_SURPLUS_FLAGGED';
        logSeverity = 'warning';
      } else if (isExpiryMismatch) {
        logAction = 'EXPIRY_MISMATCH_FLAGGED';
        logSeverity = 'warning';
      } else {
        logAction = 'STOCK_VERIFIED_PERFECT_MATCH';
        logSeverity = 'success';
      }

      let desc = '';
      if (!matchedMedicine) {
        desc = `Physical scan audit flagged uncataloged barcode: ${scannedBarcode}. Physical count: ${physicalCount} units. ${auditNotes ? `Notes: ${auditNotes}` : ''}`;
      } else {
        const deltaText =
          stockDelta === 0
            ? 'Exact match (0 discrepancy)'
            : stockDelta < 0
            ? `Shortage of ${Math.abs(stockDelta)} units (-₹${Math.abs(valuationDelta).toFixed(2)})`
            : `Surplus of +${stockDelta} units (+₹${valuationDelta.toFixed(2)})`;

        desc = `Physical audit for ${matchedMedicine.name} (Batch: ${record.batchNumber}): ${deltaText}. Physical: ${physicalCount}, System: ${systemQuantity}. Location: ${shelfLoc}.${shouldAutoAdjustStock ? ' [AUTO-ADJUSTED IN DB]' : ''} ${auditNotes ? `| Notes: ${auditNotes}` : ''}`;
      }

      // 3. Write permanent audit log entry to Firestore activity_logs
      await logActivity({
        action: logAction,
        description: desc,
        type: 'inventory',
        module: 'inventory',
        userEmail: profile?.email || 'admin@satyampharma.com',
        userId: profile?.uid,
        userName: profile?.displayName || profile?.email?.split('@')[0] || 'Pharmacist Auditor',
        userRole: profile?.role || 'clerk',
        severity: logSeverity,
        details: {
          barcode: scannedBarcode,
          medicineId: record.medicineId,
          medicineName: record.medicineName,
          batchNumber: record.batchNumber,
          systemStock: record.systemStock,
          physicalStock: record.physicalStock,
          stockDelta: record.stockDelta,
          valuationDelta: record.valuationDelta,
          systemExpiry: record.systemExpiry,
          physicalExpiry: record.physicalExpiry,
          adjustedInDb: shouldAutoAdjustStock,
          shelfLocation: shelfLoc,
          auditNotes: auditNotes.trim()
        }
      });

      // 4. Update session state
      setSessionRecords((prev) => [record, ...prev]);
      setLastCommittedRecord(record);

      // 5. Spoken TTS confirmation
      if (discrepancyStatus === 'match') {
        speakTTS(
          isHindi
            ? `${matchedMedicine?.name || 'दवा'} का स्टॉक सत्यापित। कोई विसंगति नहीं मिली।`
            : `${matchedMedicine?.name || 'Stock'} verified. Perfect match confirmed in audit log.`
        );
      } else if (discrepancyStatus === 'shortage') {
        speakTTS(
          isHindi
            ? `स्टॉक कमी दर्ज की गई: ${Math.abs(stockDelta)} यूनिट कम। ऑडिट लॉग में फ्लैग किया गया।`
            : `Stock shortage detected: ${Math.abs(stockDelta)} units missing. Flagged in audit log.`
        );
      } else if (discrepancyStatus === 'surplus') {
        speakTTS(
          isHindi
            ? `अतिरिक्त स्टॉक दर्ज: ${stockDelta} यूनिट अधिक। ऑडिट लॉग में दर्ज।`
            : `Stock surplus detected: ${stockDelta} extra units recorded in audit log.`
        );
      } else {
        speakTTS(
          isHindi
            ? `विसंगति पाई गई और ऑडिट लॉग में सुरक्षित दर्ज की गई।`
            : `Discrepancy flagged and committed to audit log.`
        );
      }

      // Reset for continuous scan mode if enabled
      if (continuousScanMode) {
        setTimeout(() => {
          setScannedBarcode(null);
          setMatchedMedicine(null);
          setLastCommittedRecord(null);
        }, 1200);
      }
    } catch (err: any) {
      console.error('Error committing stock verification audit:', err);
      alert(`Audit log commit failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Test Demo Barcodes
  const demoBarcodes = useMemo(() => {
    const list: { label: string; code: string; isReal: boolean }[] = [];
    allMedicines.slice(0, 4).forEach((m) => {
      if (m.barcode) {
        list.push({ label: m.name, code: m.barcode, isReal: true });
      }
    });

    if (list.length < 3) {
      list.push(
        { label: 'Paracetamol 650', code: '8901086001234', isReal: false },
        { label: 'Amoxicillin 500', code: '8901086005678', isReal: false },
        { label: 'Pantoprazole 40', code: '8901086009012', isReal: false }
      );
    }

    list.push({ label: '⚠️ Unregistered SKU (999999)', code: '999999888888', isReal: false });
    return list;
  }, [allMedicines]);

  // Session Statistics
  const sessionStats = useMemo(() => {
    const total = sessionRecords.length;
    const matches = sessionRecords.filter((r) => r.status === 'match').length;
    const shortages = sessionRecords.filter((r) => r.status === 'shortage').length;
    const surpluses = sessionRecords.filter((r) => r.status === 'surplus').length;
    const expiryMismatches = sessionRecords.filter((r) => r.status === 'expiry_mismatch').length;
    const uncataloged = sessionRecords.filter((r) => r.status === 'uncataloged').length;
    const totalDiscrepancies = total - matches;
    const netUnitsDelta = sessionRecords.reduce((sum, r) => sum + r.stockDelta, 0);
    const netValuationImpact = sessionRecords.reduce((sum, r) => sum + r.valuationDelta, 0);

    return {
      total,
      matches,
      shortages,
      surpluses,
      expiryMismatches,
      uncataloged,
      totalDiscrepancies,
      netUnitsDelta,
      netValuationImpact
    };
  }, [sessionRecords]);

  // Export Session Audit Report as PDF
  const exportAuditPDF = () => {
    if (sessionRecords.length === 0) return;
    const doc = new jsPDF();

    // Header
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 42, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('SATYAM MEDICAL ERP', 14, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('PHYSICAL SCAN-TO-VERIFY AUDIT DISCREPANCY REPORT', 14, 28);
    doc.text(`Audited By: ${profile?.displayName || profile?.email || 'Staff Auditor'} | Session: ${new Date().toLocaleString()}`, 14, 35);

    // Summary Box
    doc.setFillColor(241, 245, 249);
    doc.rect(14, 48, 182, 22, 'F');
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Total Items Checked: ${sessionStats.total}   |   Exact Matches: ${sessionStats.matches}   |   Discrepancies Flagged: ${sessionStats.totalDiscrepancies}`,
      18,
      56
    );
    doc.text(
      `Net Stock Delta: ${sessionStats.netUnitsDelta > 0 ? '+' : ''}${sessionStats.netUnitsDelta} Units   |   Net Financial Impact: ${formatCurrency(sessionStats.netValuationImpact)}`,
      18,
      64
    );

    // Table Content
    const tableColumn = [
      'Item Name',
      'Barcode',
      'Batch',
      'Sys Stock',
      'Phys Stock',
      'Delta',
      'Value Delta',
      'Status / Action'
    ];

    const tableRows = sessionRecords.map((r) => [
      r.medicineName,
      r.barcode,
      r.batchNumber,
      r.systemStock.toString(),
      r.physicalStock.toString(),
      r.stockDelta > 0 ? `+${r.stockDelta}` : r.stockDelta.toString(),
      formatCurrency(r.valuationDelta),
      r.status === 'match'
        ? 'VERIFIED MATCH'
        : r.status === 'shortage'
        ? 'SHORTAGE'
        : r.status === 'surplus'
        ? 'OVERSTOCK'
        : r.status === 'expiry_mismatch'
        ? 'EXPIRY MISMATCH'
        : 'UNCATALOGED'
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 76,
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { top: 76 }
    });

    // Signatures
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Page ${i} of ${pageCount} - Satyam ERP Physical Audit Trail`, 105, 285, { align: 'center' });
    }

    doc.save(`Scan_Verify_Audit_Discrepancy_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Export Session as CSV
  const exportAuditCSV = () => {
    if (sessionRecords.length === 0) return;
    const headers = [
      'Timestamp',
      'Medicine Name',
      'Barcode',
      'Batch Number',
      'System Stock',
      'Physical Stock',
      'Stock Delta',
      'Unit MRP (₹)',
      'Valuation Delta (₹)',
      'System Expiry',
      'Physical Expiry',
      'Discrepancy Status',
      'Shelf Location',
      'Auto-Adjusted in DB',
      'Auditor Notes'
    ];

    const rows = sessionRecords.map((r) => [
      `"${r.verifiedAt}"`,
      `"${r.medicineName.replace(/"/g, '""')}"`,
      `"${r.barcode}"`,
      `"${r.batchNumber}"`,
      r.systemStock,
      r.physicalStock,
      r.stockDelta,
      r.unitRate,
      r.valuationDelta,
      `"${r.systemExpiry}"`,
      `"${r.physicalExpiry}"`,
      `"${r.status}"`,
      `"${r.shelfLocation.replace(/"/g, '""')}"`,
      r.adjustedInDb ? 'YES' : 'NO',
      `"${r.notes.replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Stock_Verification_Audit_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-5xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-500/20">
              <Scan size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                  {tText('Scan-to-Verify Physical Stock', 'स्कैन करके स्टॉक सत्यापित करें')}
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  <Sparkles size={11} />
                  Live Audit Trail
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tText(
                  'Camera barcode scanning & automated physical stock discrepancy audit logging',
                  'कैमरा बारकोड स्कैनिंग और स्वचालित स्टॉक विसंगति ऑडिट'
                )}
              </p>
            </div>
          </div>

          {/* Navigation Tabs & Controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setActiveTab('scanner')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer',
                  activeTab === 'scanner'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                )}
              >
                <Camera size={13} />
                <span>{tText('Scanner & HUD', 'स्कैनर')}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('session_log')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer relative',
                  activeTab === 'session_log'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                )}
              >
                <ListOrdered size={13} />
                <span>{tText('Session Log', 'सत्र लॉग')}</span>
                {sessionRecords.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-emerald-600 text-white">
                    {sessionRecords.length}
                  </span>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={cn(
                'p-2 rounded-xl border transition-colors cursor-pointer',
                soundEnabled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
              )}
              title={soundEnabled ? 'Scanner Beep Sound: ON' : 'Scanner Beep Sound: OFF'}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {activeTab === 'scanner' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Camera Scanner Viewport & Quick Barcode Inputs */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800 shadow-inner flex flex-col items-center">
                  <div className="relative w-full aspect-4/3 max-w-sm rounded-xl overflow-hidden bg-black flex items-center justify-center border border-slate-800">
                    <div id="scan-to-verify-camera-view" className="w-full h-full object-cover" />

                    {/* Laser Scanner animation overlay */}
                    {cameraState === 'active' && (
                      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                        <div className="w-56 h-36 border-2 border-emerald-500/80 rounded-2xl relative shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                          <motion.div
                            className="h-0.5 w-full bg-emerald-400 shadow-[0_0_12px_#34d399]"
                            animate={{ y: [0, 140, 0] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                          />
                          {/* Corner Aim Markers */}
                          <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-emerald-300" />
                          <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-emerald-300" />
                          <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-emerald-300" />
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-emerald-300" />
                        </div>
                        <span className="text-[11px] font-bold text-emerald-300 bg-slate-950/80 px-3 py-1 rounded-full mt-3 backdrop-blur-xs border border-emerald-500/30">
                          {tText('Align barcode inside box', 'बारकोड बॉक्स में रखें')}
                        </span>
                      </div>
                    )}

                    {/* Camera States Error / Denied */}
                    {cameraState === 'denied' && (
                      <div className="absolute inset-0 bg-slate-950/95 p-4 flex flex-col items-center justify-center text-center text-amber-200">
                        <ShieldAlert size={32} className="text-amber-400 mb-2" />
                        <h4 className="font-bold text-xs">{tText('Camera Access Denied', 'कैमरा अनुमति अस्वीकृत')}</h4>
                        <p className="text-[10px] text-slate-300 mt-1 max-w-xs">{errorMessage}</p>
                        <button
                          type="button"
                          onClick={() => startScanner(facingMode)}
                          className="mt-3 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                        >
                          {tText('Retry Camera Access', 'पुनः प्रयास करें')}
                        </button>
                      </div>
                    )}

                    {cameraState === 'error' && (
                      <div className="absolute inset-0 bg-slate-950/95 p-4 flex flex-col items-center justify-center text-center text-rose-200">
                        <AlertCircle size={32} className="text-rose-400 mb-2" />
                        <h4 className="font-bold text-xs">{tText('Camera Unavailable', 'कैमरा अनुपलब्ध')}</h4>
                        <p className="text-[10px] text-slate-300 mt-1 max-w-xs">{errorMessage}</p>
                        <button
                          type="button"
                          onClick={() => startScanner(facingMode)}
                          className="mt-3 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                        >
                          {tText('Restart Camera Feed', 'कैमरा पुनः शुरू करें')}
                        </button>
                      </div>
                    )}

                    {cameraState === 'initializing' && (
                      <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-slate-300">
                        <RefreshCw size={24} className="animate-spin text-emerald-400 mb-2" />
                        <span className="text-xs font-medium">{tText('Initializing camera...', 'कैमरा लोड हो रहा है...')}</span>
                      </div>
                    )}
                  </div>

                  {/* Camera Controls Bar */}
                  <div className="w-full flex items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setFacingMode(facingMode === 'environment' ? 'user' : 'environment')}
                      className="flex items-center gap-1 text-[11px] font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <RotateCcw size={12} />
                      <span>{facingMode === 'environment' ? 'Flip to Front' : 'Flip to Rear'}</span>
                    </button>

                    <label className="flex items-center gap-1 text-[11px] font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer">
                      <Upload size={12} />
                      <span>{isProcessingImage ? 'Scanning Image...' : 'Upload Image'}</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={isProcessingImage}
                      />
                    </label>

                    <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={continuousScanMode}
                        onChange={(e) => setContinuousScanMode(e.target.checked)}
                        className="rounded border-slate-700 text-emerald-600 focus:ring-0"
                      />
                      <span>Auto Next</span>
                    </label>
                  </div>
                </div>

                {imageError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
                    <AlertTriangle size={14} className="shrink-0 text-rose-600" />
                    <span>{imageError}</span>
                  </div>
                )}

                {/* Manual Barcode / SKU Input Fallback */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (manualBarcodeInput.trim()) {
                      handleIncomingBarcode(manualBarcodeInput.trim());
                      setManualBarcodeInput('');
                    }
                  }}
                  className="space-y-2 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Keyboard size={14} className="text-emerald-600" />
                      {tText('Manual Barcode / SKU Search', 'मैन्युअल बारकोड / SKU खोज')}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      ref={manualInputRef}
                      type="text"
                      placeholder={tText('Type barcode, medicine name or batch...', 'बारकोड या दवा का नाम दर्ज करें...')}
                      value={manualBarcodeInput}
                      onChange={(e) => setManualBarcodeInput(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono outline-none focus:border-emerald-500"
                    />
                    <button
                      type="submit"
                      disabled={!manualBarcodeInput.trim()}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
                    >
                      {tText('Lookup', 'खोजें')}
                    </button>
                  </div>
                </form>

                {/* Demo Barcodes for Quick Testing */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {tText('Quick Demo Test Barcodes:', 'त्वरित परीक्षण बारकोड:')}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {demoBarcodes.map((demo) => (
                      <button
                        key={demo.code}
                        type="button"
                        onClick={() => handleIncomingBarcode(demo.code)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all cursor-pointer',
                          demo.isReal
                            ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400'
                            : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 hover:border-amber-400'
                        )}
                      >
                        {demo.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Physical Item vs System Stock Comparison HUD */}
              <div className="lg:col-span-7 space-y-4">
                {!scannedBarcode ? (
                  <div className="h-full min-h-[360px] flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="p-4 rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 shadow-inner">
                      <Scan size={36} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                        {tText('Ready for Physical Scan', 'स्कैनिंग के लिए तैयार')}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                        {tText(
                          'Point camera at medicine barcode or select a demo barcode to automatically compare physical item against system stock & flag audit discrepancies.',
                          'भौतिक वस्तु की तुलना सिस्टम स्टॉक से करने और ऑडिट विसंगतियों को फ्लैग करने के लिए बारकोड स्कैन करें।'
                        )}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Header Card for Scanned Target */}
                    <div
                      className={cn(
                        'p-4 rounded-2xl border shadow-sm space-y-3',
                        matchedMedicine
                          ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                          : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                              {matchedMedicine ? matchedMedicine.name : tText('Unregistered Item', 'अपंजीकृत वस्तु')}
                            </h3>
                            {matchedMedicine ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                {matchedMedicine.type}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200 border border-amber-400">
                                Not in Inventory
                              </span>
                            )}
                          </div>

                          {matchedMedicine && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {matchedMedicine.genericName || matchedMedicine.salt || 'Standard Formulation'}
                            </p>
                          )}

                          <div className="flex items-center gap-3 pt-1 text-xs text-slate-600 dark:text-slate-400 flex-wrap">
                            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                              Barcode: {scannedBarcode}
                            </span>
                            {matchedMedicine && (
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                MRP: {formatCurrency(matchedMedicine.rate)}
                              </span>
                            )}
                            {matchedMedicine?.location && (
                              <span className="flex items-center gap-1 text-cyan-700 dark:text-cyan-400 font-medium">
                                <MapPin size={12} />
                                {matchedMedicine.location.aisle} • {matchedMedicine.location.rack} •{' '}
                                {matchedMedicine.location.shelf} ({matchedMedicine.location.bin || 'Bin 01'})
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setScannedBarcode(null);
                            setMatchedMedicine(null);
                            setLastCommittedRecord(null);
                          }}
                          className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          {tText('Clear', 'हटाएं')}
                        </button>
                      </div>

                      {/* Batches Selector if multiple batches exist */}
                      {matchedMedicine && matchedMedicine.batches && matchedMedicine.batches.length > 1 && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
                          <span className="text-[11px] font-bold text-slate-500 shrink-0">
                            {tText('Select Batch to Verify:', 'बैच चुनें:')}
                          </span>
                          {matchedMedicine.batches.map((b, idx) => (
                            <button
                              key={b.id || idx}
                              type="button"
                              onClick={() => handleBatchSelect(idx)}
                              className={cn(
                                'px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 border',
                                selectedBatchIndex === idx
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                              )}
                            >
                              {b.batchNumber} ({b.quantity}u • {formatDate(b.expiryDate)})
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Side-by-Side Comparison Workspace */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Left: System Records */}
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            {tText('System Inventory Record', 'सिस्टम रिकॉर्ड')}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            Database Live
                          </span>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">{tText('Recorded Stock:', 'सिस्टम स्टॉक:')}</span>
                            <span className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono">
                              {systemQuantity} units
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">{tText('Batch Number:', 'बैच संख्या:')}</span>
                            <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                              {currentBatch.batchNumber || 'N/A'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">{tText('Expiry Date:', 'समाप्ति तिथि:')}</span>
                            <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                              {currentBatch.expiryDate ? formatDate(currentBatch.expiryDate) : 'N/A'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">{tText('Inventory Value:', 'स्टॉक मूल्य:')}</span>
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {formatCurrency(systemQuantity * unitRate)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Physical Verification Input */}
                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-emerald-300 dark:border-emerald-700/80 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                            {tText('Physical Shelf Count', 'भौतिक गणना')}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                            Physical Scan
                          </span>
                        </div>

                        {/* Physical Count Stepper */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                            {tText('Physical Units Counted on Shelf:', 'शेल्फ पर गिनी गई इकाइयाँ:')}
                          </label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPhysicalCount((prev) => Math.max(0, prev - 10))}
                              className="px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                            >
                              -10
                            </button>
                            <button
                              type="button"
                              onClick={() => setPhysicalCount((prev) => Math.max(0, prev - 1))}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                            >
                              <Minus size={14} />
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={physicalCount}
                              onChange={(e) => setPhysicalCount(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-full text-center py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-base font-black font-mono text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                            />
                            <button
                              type="button"
                              onClick={() => setPhysicalCount((prev) => prev + 1)}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                            >
                              <Plus size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPhysicalCount((prev) => prev + 10)}
                              className="px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                            >
                              +10
                            </button>
                          </div>
                        </div>

                        {/* Physical Expiry & Batch Fields */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500">
                              {tText('Physical Expiry Date', 'समाप्ति तिथि')}
                            </label>
                            <input
                              type="date"
                              value={physicalExpiry}
                              onChange={(e) => setPhysicalExpiry(e.target.value)}
                              className="w-full text-[11px] py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500">
                              {tText('Physical Batch #', 'बैच #')}
                            </label>
                            <input
                              type="text"
                              value={physicalBatchNum}
                              onChange={(e) => setPhysicalBatchNum(e.target.value)}
                              placeholder="e.g. PCM-2026"
                              className="w-full text-[11px] py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Discrepancy Status & Financial Impact Alert Banner */}
                    <div
                      className={cn(
                        'p-4 rounded-2xl border transition-all space-y-2',
                        discrepancyStatus === 'match'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100'
                          : discrepancyStatus === 'shortage'
                          ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-100'
                          : discrepancyStatus === 'surplus'
                          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100'
                          : discrepancyStatus === 'expiry_mismatch'
                          ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-950 dark:text-purple-100'
                          : 'bg-orange-50 dark:bg-orange-950/40 border-orange-300 dark:border-orange-800 text-orange-950 dark:text-orange-100'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {discrepancyStatus === 'match' ? (
                            <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                          ) : discrepancyStatus === 'shortage' ? (
                            <AlertCircle size={20} className="text-rose-600 shrink-0" />
                          ) : (
                            <AlertTriangle size={20} className="text-amber-600 shrink-0" />
                          )}
                          <h4 className="font-extrabold text-sm">
                            {discrepancyStatus === 'match'
                              ? tText('Verified: Perfect Stock Match', 'सत्यापित: स्टॉक बिल्कुल मेल खाता है')
                              : discrepancyStatus === 'shortage'
                              ? tText(`Discrepancy: Stock Shortage of ${Math.abs(stockDelta)} Units`, `विसंगति: ${Math.abs(stockDelta)} यूनिट की कमी`)
                              : discrepancyStatus === 'surplus'
                              ? tText(`Discrepancy: Stock Surplus of +${stockDelta} Units`, `विसंगति: +${stockDelta} यूनिट अतिरिक्त`)
                              : discrepancyStatus === 'expiry_mismatch'
                              ? tText('Discrepancy: Expiry Date Mismatch or Expired Stock', 'विसंगति: समाप्ति तिथि बेमेल')
                              : tText('Discrepancy: Uncataloged Item on Physical Shelf', 'विसंगति: अनकैटलॉग आइटम')}
                          </h4>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-bold">
                            {stockDelta === 0
                              ? '₹0.00'
                              : `${valuationDelta > 0 ? '+' : ''}${formatCurrency(valuationDelta)}`}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs opacity-90 leading-relaxed">
                        {discrepancyStatus === 'match'
                          ? tText(
                              'Physical shelf stock matches the system inventory records perfectly. No discrepancy found.',
                              'भौतिक स्टॉक सिस्टम रिकॉर्ड से पूरी तरह मेल खाता है।'
                            )
                          : discrepancyStatus === 'shortage'
                          ? tText(
                              `Physical count (${physicalCount}) is lower than system record (${systemQuantity}). Estimated loss/shrinkage value is ${formatCurrency(Math.abs(valuationDelta))}.`,
                              `भौतिक गणना सिस्टम से कम है। संभावित कमी मूल्य ${formatCurrency(Math.abs(valuationDelta))} है।`
                            )
                          : discrepancyStatus === 'surplus'
                          ? tText(
                              `Physical count (${physicalCount}) exceeds system record (${systemQuantity}). Surplus inventory value is ${formatCurrency(valuationDelta)}.`,
                              `भौतिक गणना सिस्टम से अधिक है। अतिरिक्त मूल्य ${formatCurrency(valuationDelta)} है।`
                            )
                          : tText(
                              'Discrepancy detected between physical packaging details and database records.',
                              'पैकेजिंग और डेटाबेस विवरण में विसंगति पाई गई।'
                            )}
                      </p>
                    </div>

                    {/* Auditor Notes Input */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        {tText('Auditor Notes (Optional):', 'ऑडिटर टिप्पणियाँ (वैकल्पिक):')}
                      </label>
                      <input
                        type="text"
                        placeholder={tText('e.g., Verified shelf batch, seal intact, packaging undamaged...', 'टिप्पणी दर्ज करें...')}
                        value={auditNotes}
                        onChange={(e) => setAuditNotes(e.target.value)}
                        className="w-full mt-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-emerald-500"
                      />
                    </div>

                    {/* Action Buttons: Flag Discrepancy & Commit vs Auto-Adjust */}
                    <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleCommitVerification(false)}
                        className={cn(
                          'w-full sm:flex-1 py-3 px-4 rounded-xl font-bold text-xs text-white shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50',
                          discrepancyStatus === 'match'
                            ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                            : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                        )}
                      >
                        <ShieldAlert size={16} />
                        <span>
                          {isSubmitting
                            ? tText('Logging to Audit Trail...', 'ऑडिट लॉग हो रहा है...')
                            : discrepancyStatus === 'match'
                            ? tText('Commit Verification & Log to Audit Trail', 'सत्यापन सहेजें और लॉग करें')
                            : tText('Flag Discrepancy & Commit to Audit Log', 'विसंगति फ्लैग करें और ऑडिट में दर्ज करें')}
                        </span>
                      </button>

                      {matchedMedicine && stockDelta !== 0 && (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleCommitVerification(true)}
                          className="w-full sm:w-auto py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                          title="Update Firestore stock to match physical count and write audit log simultaneously"
                        >
                          <Sliders size={15} />
                          <span>{tText('Auto-Adjust Stock in DB', 'डेटाबेस में स्टॉक स्वतः समायोजित करें')}</span>
                        </button>
                      )}
                    </div>

                    {/* Success Confirmation Badge */}
                    {lastCommittedRecord && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCheck size={16} className="text-emerald-600" />
                          <span className="font-bold">
                            {tText(
                              `Audit logged successfully for ${lastCommittedRecord.medicineName}`,
                              `ऑडिट सफलतापूर्वक दर्ज हुआ`
                            )}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setScannedBarcode(null);
                            setMatchedMedicine(null);
                            setLastCommittedRecord(null);
                          }}
                          className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                        >
                          {tText('Scan Next Item ➔', 'अगला आइटम स्कैन करें ➔')}
                        </button>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Session Discrepancy & Verification Summary Tab */
            <div className="space-y-5">
              {/* Session KPI Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {tText('Total Items Audited', 'कुल ऑडिटेड')}
                  </span>
                  <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">
                    {sessionStats.total}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    {tText('Exact Matches', 'पूर्ण मेल')}
                  </span>
                  <p className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
                    {sessionStats.matches}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                    {tText('Discrepancies Flagged', 'विसंगतियों की संख्या')}
                  </span>
                  <p className="text-xl font-black text-rose-700 dark:text-rose-400 mt-1">
                    {sessionStats.totalDiscrepancies}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                    {tText('Net Financial Delta', 'वित्तीय प्रभाव')}
                  </span>
                  <p className="text-xl font-black text-blue-700 dark:text-blue-400 mt-1">
                    {formatCurrency(sessionStats.netValuationImpact)}
                  </p>
                </div>
              </div>

              {/* Action Toolbar for Session Log */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                  {tText('Current Audit Session Records', 'वर्तमान ऑडिट सत्र रिकॉर्ड्स')} ({sessionRecords.length})
                </h3>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={exportAuditCSV}
                    disabled={sessionRecords.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-bold disabled:opacity-40 cursor-pointer shadow-xs"
                  >
                    <FileSpreadsheet size={13} className="text-emerald-600" />
                    <span>{tText('Export CSV', 'CSV निर्यात')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={exportAuditPDF}
                    disabled={sessionRecords.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-40 cursor-pointer shadow-xs"
                  >
                    <FileDown size={13} />
                    <span>{tText('Download Audit Report (PDF)', 'ऑडिट रिपोर्ट (PDF)')}</span>
                  </button>
                </div>
              </div>

              {/* Table of Session Records */}
              {sessionRecords.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <ListOrdered size={28} className="mx-auto text-slate-400" />
                  <p className="text-xs font-medium text-slate-500">
                    {tText(
                      'No items have been verified in this session yet. Switch to the Scanner tab to begin scanning.',
                      'इस सत्र में अभी तक कोई वस्तु सत्यापित नहीं हुई है।'
                    )}
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto max-h-[340px]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3.5">Medicine & Barcode</th>
                          <th className="py-2.5 px-3">Batch</th>
                          <th className="py-2.5 px-3">System Stock</th>
                          <th className="py-2.5 px-3">Physical Count</th>
                          <th className="py-2.5 px-3">Discrepancy</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Adjusted in DB</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {sessionRecords.map((rec) => (
                          <tr
                            key={rec.id}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                          >
                            <td className="py-2.5 px-3.5">
                              <div className="font-bold text-slate-900 dark:text-slate-100">
                                {rec.medicineName}
                              </div>
                              <div className="text-[10px] font-mono text-slate-400">{rec.barcode}</div>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-medium">{rec.batchNumber}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-600 dark:text-slate-400">
                              {rec.systemStock}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-black text-slate-900 dark:text-slate-100">
                              {rec.physicalStock}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold">
                              {rec.stockDelta === 0 ? (
                                <span className="text-emerald-600">0</span>
                              ) : rec.stockDelta < 0 ? (
                                <span className="text-rose-600">
                                  {rec.stockDelta} ({formatCurrency(rec.valuationDelta)})
                                </span>
                              ) : (
                                <span className="text-amber-600">
                                  +{rec.stockDelta} (+{formatCurrency(rec.valuationDelta)})
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                                  rec.status === 'match'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : rec.status === 'shortage'
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                    : rec.status === 'surplus'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                )}
                              >
                                {rec.status === 'match'
                                  ? 'Match'
                                  : rec.status === 'shortage'
                                  ? 'Shortage'
                                  : rec.status === 'surplus'
                                  ? 'Surplus'
                                  : 'Mismatch'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              {rec.adjustedInDb ? (
                                <span className="text-blue-600 font-bold text-[11px]">✓ Auto-Adjusted</span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">Audit Log Only</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldAlert size={14} className="text-emerald-600" />
            <span>
              {tText(
                'All verifications and flagged discrepancies write directly to the pharmacy audit log.',
                'सभी सत्यापन और विसंगतियाँ सीधे ऑडिट लॉग में दर्ज की जाती हैं।'
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold cursor-pointer"
          >
            {tText('Done / Close', 'सम्पन्न / बंद करें')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ScanToVerifyModal;
