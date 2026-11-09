import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, getDocs, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthProvider';
import { useLanguage } from '../context/LanguageContext';
import { 
  FileText, 
  Download, 
  Printer, 
  FileSpreadsheet, 
  Search, 
  AlertTriangle, 
  Calendar, 
  ShieldAlert, 
  RefreshCw, 
  Building2, 
  ChevronRight, 
  ChevronLeft,
  Package, 
  IndianRupee, 
  Clock, 
  ArrowUpDown, 
  CheckCircle2, 
  Sliders, 
  X, 
  AlertOctagon,
  Boxes,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Languages,
  FastForward,
  Radio,
  Sparkles,
  Check,
  CheckSquare,
  ListChecks,
  HelpCircle,
  MapPin,
  Eye,
  ArrowRight,
  ArrowLeft,
  Plus,
  Minus,
  Tag,
  Zap,
  RotateCcw,
  Lock,
  ExternalLink,
  ShoppingCart,
  PackagePlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Medicine } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { 
  ExpiryReportItem, 
  ExpiryReportSummary, 
  generateExpiryReportPDF, 
  exportExpiryReportCSV 
} from '../lib/expiryReportPdf';
import { getMedicineLocation } from '../lib/locationUtils';
import { logActivity } from '../lib/logger';

interface ExpiryAuditReportProps {
  isModal?: boolean;
  onClose?: () => void;
  initialFilter?: 'all' | 'expired' | 'critical' | 'urgent' | 'approaching';
  initialTimeframe?: 30 | 60 | 90;
  onNavigateToReorder?: (module: 'inventory' | 'pos', item: ExpiryReportItem) => void;
}

type SortField = 'urgency' | 'value' | 'stock' | 'name';

interface VerifiedBatchInfo {
  verifiedAt: string;
  verifiedCount: number;
  verifiedExpiry: string;
  isModified: boolean;
}

interface VoiceLogEntry {
  id: string;
  time: string;
  command: string;
  feedback: string;
  status: 'success' | 'info' | 'warn';
}

// Spoken number parser (supports English and Hindi phonetic speech numbers)
function parseSpokenNumber(text: string): number | null {
  const clean = text.toLowerCase().trim();
  const digitMatch = clean.match(/\b\d+\b/);
  if (digitMatch) return parseInt(digitMatch[0], 10);

  const wordMap: Record<string, number> = {
    zero: 0, shunya: 0, none: 0, nil: 0, khatam: 0,
    one: 1, ek: 1, first: 1,
    two: 2, do: 2, second: 2,
    three: 3, teen: 3, third: 3,
    four: 4, char: 4, chaar: 4, fourth: 4,
    five: 5, paanch: 5, panch: 5, fifth: 5,
    six: 6, chhah: 6, che: 6, sixth: 6,
    seven: 7, saat: 7, sat: 7, seventh: 7,
    eight: 8, aath: 8, ath: 8, eighth: 8,
    nine: 9, nau: 9, no: 9, ninth: 9,
    ten: 10, das: 10, tenth: 10,
    eleven: 11, gyarah: 11,
    twelve: 12, barah: 12, dozen: 12,
    thirteen: 13, terah: 13,
    fourteen: 14, chaudah: 14,
    fifteen: 15, pandrah: 15,
    sixteen: 16, solah: 16,
    seventeen: 17, satrah: 17,
    eighteen: 18, atharah: 18,
    nineteen: 19, unnis: 19,
    twenty: 20, bees: 20,
    thirty: 30, tees: 30,
    forty: 40, chalis: 40,
    fifty: 50, pachaas: 50,
    sixty: 60, saath: 60,
    seventy: 70, sattar: 70,
    eighty: 80, assi: 80,
    ninety: 90, nabbe: 90,
    hundred: 100, sau: 100,
  };

  for (const [w, val] of Object.entries(wordMap)) {
    const regex = new RegExp(`\\b${w}\\b`, 'i');
    if (regex.test(clean)) {
      return val;
    }
  }

  return null;
}

// Spoken expiry date parser (supports natural speech like "Dec 2026", "12/26", "March 2027", "15 Aug 2026")
function parseSpokenExpiryDate(text: string): { isoDate: string; display: string } | null {
  const clean = text.toLowerCase().trim();

  // Pattern 1: ISO YYYY-MM-DD
  const isoMatch = clean.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = String(parseInt(isoMatch[2], 10)).padStart(2, '0');
    const d = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
    return { isoDate: `${y}-${m}-${d}`, display: `${d}/${m}/${y}` };
  }

  // Pattern 2: MM/YY or MM/YYYY
  const slashMatch = clean.match(/\b(\d{1,2})[/.-](\d{2,4})\b/);
  if (slashMatch) {
    let m = parseInt(slashMatch[1], 10);
    let y = parseInt(slashMatch[2], 10);
    if (m > 12 && y <= 12) {
      const temp = m; m = y; y = temp;
    }
    if (y < 100) y = 2000 + y;
    if (m >= 1 && m <= 12) {
      const lastDay = new Date(y, m, 0).getDate();
      const mStr = String(m).padStart(2, '0');
      const dStr = String(lastDay).padStart(2, '0');
      return { isoDate: `${y}-${mStr}-${dStr}`, display: `${mStr}/${y}` };
    }
  }

  // Pattern 3: Spoken Month + Year (e.g., "December 2026", "Nov 26", "15 August 2026")
  const monthMap: Record<string, number> = {
    january: 1, jan: 1, janvari: 1,
    february: 2, feb: 2, farvari: 2,
    march: 3, mar: 3,
    april: 4, apr: 4,
    may: 5, mai: 5,
    june: 6, jun: 6,
    july: 7, jul: 7,
    august: 8, aug: 8, agast: 8,
    september: 9, sep: 9, sept: 9, sitambar: 9,
    october: 10, oct: 10, aktubar: 10,
    november: 11, nov: 11, navambar: 11,
    december: 12, dec: 12, disambar: 12
  };

  const monthNames = Object.keys(monthMap).join('|');
  const monthRegex = new RegExp(`(?:(\\d{1,2})\\s+)?(${monthNames})\\s+(?:(\\d{1,2})(?:st|nd|rd|th)?\\s+)?(?:of\\s+)?(20\\d{2}|\\d{2})`, 'i');
  const match = clean.match(monthRegex);

  if (match) {
    const day = match[1] || match[3] || null;
    const monthStr = match[2].toLowerCase();
    const monthNum = monthMap[monthStr] || 1;
    let year = parseInt(match[4], 10);
    if (year < 100) year = 2000 + year;

    let dayNum = day ? parseInt(day, 10) : new Date(year, monthNum, 0).getDate();
    if (dayNum > 31) dayNum = new Date(year, monthNum, 0).getDate();

    const mStr = String(monthNum).padStart(2, '0');
    const dStr = String(dayNum).padStart(2, '0');
    return {
      isoDate: `${year}-${mStr}-${dStr}`,
      display: `${monthStr.toUpperCase().slice(0, 3)} ${year}`
    };
  }

  return null;
}

export const ExpiryAuditReport: React.FC<ExpiryAuditReportProps> = ({ 
  isModal = false, 
  onClose,
  initialFilter = 'all',
  initialTimeframe = 90,
  onNavigateToReorder
}) => {
  const { profile } = useAuth();
  const { t, tText } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'expired' | 'critical' | 'urgent' | 'approaching' | 'return_eligible'>(initialFilter);
  const [expiryTimeframe, setExpiryTimeframe] = useState<30 | 60 | 90>(initialTimeframe);
  const [sortBy, setSortBy] = useState<SortField>('urgency');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfSuccessMessage, setPdfSuccessMessage] = useState<string | null>(null);
  const [isEmailingAlert, setIsEmailingAlert] = useState(false);
  const [emailSuccessMessage, setEmailSuccessMessage] = useState<string | null>(null);
  const [selectedBatchForReturn, setSelectedBatchForReturn] = useState<ExpiryReportItem | null>(null);
  const [selectedBatchForReorder, setSelectedBatchForReorder] = useState<ExpiryReportItem | null>(null);

  // Execute Reorder navigation to Inventory or POS with pre-selected medicine
  const handleExecuteReorder = (module: 'inventory' | 'pos', item: ExpiryReportItem) => {
    setSelectedBatchForReorder(null);

    // If displayed in a modal, close the modal first so the underlying module is visible
    if (isModal && onClose) {
      onClose();
    }

    if (onNavigateToReorder) {
      onNavigateToReorder(module, item);
    }

    // Broadcast custom event so App/Inventory/POS components receive the pre-selected payload
    window.dispatchEvent(new CustomEvent('procure-reorder-medicine', {
      detail: {
        module,
        tab: module,
        medicineId: item.medicineId,
        medicineName: item.medicineName,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        rate: item.rate,
        stockQuantity: item.stockQuantity,
        supplier: item.supplier,
        timestamp: Date.now()
      }
    }));

    // Voice announcement & audit log
    const targetLabel = module === 'inventory' ? 'Inventory' : 'POS';
    speakMessage(`Opening ${targetLabel} with ${item.medicineName} pre-selected for procurement.`);
    logActivity('REORDER_INITIATED', `Initiated procurement reorder for ${item.medicineName} (${item.batchNumber}) into ${targetLabel} module`);
  };

  // Instant Expiry Horizon Change Handler
  const handleTimeframeChange = (newTimeframe: 30 | 60 | 90) => {
    setExpiryTimeframe(newTimeframe);
    // If active urgency tab is outside the selected timeframe window, reset to 'all'
    if (newTimeframe === 30 && (activeFilter === 'urgent' || activeFilter === 'approaching')) {
      setActiveFilter('all');
    } else if (newTimeframe === 60 && activeFilter === 'approaching') {
      setActiveFilter('all');
    }
  };

  // --- Voice Shelf Audit States ---
  const [isVoiceAuditActive, setIsVoiceAuditActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState('');
  const [speechInterim, setSpeechInterim] = useState('');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [dictationLang, setDictationLang] = useState<'en-IN' | 'hi-IN'>('en-IN');
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [showVoiceHelpModal, setShowVoiceHelpModal] = useState(false);
  const [voiceLogs, setVoiceLogs] = useState<VoiceLogEntry[]>([]);
  const [verifiedBatches, setVerifiedBatches] = useState<Record<string, VerifiedBatchInfo>>(() => {
    try {
      const saved = localStorage.getItem('satyam_shelf_audit_verified');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const recognitionRef = useRef<any>(null);
  const isVoiceAuditActiveRef = useRef(isVoiceAuditActive);
  isVoiceAuditActiveRef.current = isVoiceAuditActive;

  // Persist verified batches
  useEffect(() => {
    try {
      localStorage.setItem('satyam_shelf_audit_verified', JSON.stringify(verifiedBatches));
    } catch (e) {
      console.warn('Failed to save verified batches:', e);
    }
  }, [verifiedBatches]);

  // Fetch Inventory Real-Time
  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(
      collection(db, 'inventory'),
      (snapshot) => {
        const list: Medicine[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as Medicine);
        });
        setMedicines(list);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching inventory for expiry report:', error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  // Compute All Flagged Formulations & Batches (up to 90 days or expired)
  const allFlaggedItems = useMemo<ExpiryReportItem[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reportItems: ExpiryReportItem[] = [];

    medicines.forEach((med) => {
      const batches = med.batches && med.batches.length > 0
        ? med.batches
        : [{
            id: 'default',
            batchNumber: (med as any).batchNumber || 'LOT-MAIN',
            expiryDate: med.expiryDate,
            quantity: med.stockQuantity
          }];

      batches.forEach((batch) => {
        if (!batch.expiryDate) return;
        const exp = new Date(batch.expiryDate);
        exp.setHours(0, 0, 0, 0);

        const diffTime = exp.getTime() - today.getTime();
        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Flag if expiring within 90 days OR already expired
        if (daysLeft <= 90) {
          const qty = batch.quantity || 0;
          const rate = med.rate || 0;
          const totalVal = qty * rate;

          let urgency: 'expired' | 'critical' | 'urgent' | 'approaching' = 'approaching';
          let recommendedAction = 'FEFO Priority Dispense';
          let returnEligibility = 'Eligible (90-Day Policy)';

          if (daysLeft <= 0) {
            urgency = 'expired';
            recommendedAction = 'Immediate Quarantine & Debit Note';
            returnEligibility = 'Expired (Supplier Credit Claim)';
          } else if (daysLeft <= 30) {
            urgency = 'critical';
            recommendedAction = 'Return to Distributor / Clearance Discount';
            returnEligibility = 'Urgent Return (60-Day Cutoff)';
          } else if (daysLeft <= 60) {
            urgency = 'urgent';
            recommendedAction = 'Move to Front Shelf / Pause Reorder';
            returnEligibility = 'Eligible (Standard Return)';
          } else {
            urgency = 'approaching';
            recommendedAction = 'FEFO Priority / Sales Velocity Check';
            returnEligibility = 'Eligible (Advance Notice)';
          }

          reportItems.push({
            id: `${med.id}-${batch.id || batch.batchNumber}`,
            medicineId: med.id,
            medicineName: med.name,
            genericName: med.genericName,
            salt: med.salt,
            manufacturer: med.manufacturer,
            supplier: med.supplier,
            batchNumber: batch.batchNumber || 'N/A',
            expiryDate: batch.expiryDate,
            stockQuantity: qty,
            rate,
            totalValue: totalVal,
            daysLeft,
            urgencyLevel: urgency,
            recommendedAction,
            returnEligibility
          });
        }
      });
    });

    // Default sort by daysLeft ascending (most urgent first)
    return reportItems.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [medicines]);

  // Compute Active Flagged Batches based on selected timeframe (Expiring within 30 days, 60 days, 90 days)
  const flaggedItems = useMemo<ExpiryReportItem[]>(() => {
    return allFlaggedItems.filter((item) => item.daysLeft <= expiryTimeframe);
  }, [allFlaggedItems, expiryTimeframe]);

  // Aggregate Executive Statistics
  const summary = useMemo<ExpiryReportSummary>(() => {
    let totalUnits = 0;
    let totalValue = 0;

    let expCount = 0, expUnits = 0, expVal = 0;
    let critCount = 0, critUnits = 0, critVal = 0;
    let urgCount = 0, urgUnits = 0, urgVal = 0;
    let appCount = 0, appUnits = 0, appVal = 0;

    flaggedItems.forEach((item) => {
      totalUnits += item.stockQuantity;
      totalValue += item.totalValue;

      if (item.urgencyLevel === 'expired') {
        expCount++;
        expUnits += item.stockQuantity;
        expVal += item.totalValue;
      } else if (item.urgencyLevel === 'critical') {
        critCount++;
        critUnits += item.stockQuantity;
        critVal += item.totalValue;
      } else if (item.urgencyLevel === 'urgent') {
        urgCount++;
        urgUnits += item.stockQuantity;
        urgVal += item.totalValue;
      } else if (item.urgencyLevel === 'approaching') {
        appCount++;
        appUnits += item.stockQuantity;
        appVal += item.totalValue;
      }
    });

    return {
      generatedAt: new Date(),
      generatedBy: profile?.displayName || profile?.email || 'Authorized Pharmacist',
      userRole: profile?.role || 'Pharmacist',
      totalFlaggedCount: flaggedItems.length,
      totalUnitsAtRisk: totalUnits,
      totalFinancialValue: totalValue,
      expiredCount: expCount,
      expiredUnits: expUnits,
      expiredValue: expVal,
      criticalCount: critCount,
      criticalUnits: critUnits,
      criticalValue: critVal,
      urgentCount: urgCount,
      urgentUnits: urgUnits,
      urgentValue: urgVal,
      approachingCount: appCount,
      approachingUnits: appUnits,
      approachingValue: appVal,
      pharmacyName: 'Satyam Medical & Healthcare ERP',
      pharmacyAddress: 'Main Healthcare Complex, Station Road',
      gstin: '24AAAAA0000A1Z5',
      dlNumber: '20B/21B-DL-984201',
    };
  }, [flaggedItems, profile]);

  // Unique Suppliers for filter dropdown
  const suppliers = useMemo(() => {
    const set = new Set<string>();
    flaggedItems.forEach((item) => {
      if (item.supplier) set.add(item.supplier);
    });
    return Array.from(set);
  }, [flaggedItems]);

  // Filtered & Sorted Display Items
  const displayedItems = useMemo(() => {
    let list = flaggedItems.filter((item) => {
      // Filter tab
      if (activeFilter === 'expired' && item.urgencyLevel !== 'expired') return false;
      if (activeFilter === 'critical' && item.urgencyLevel !== 'critical') return false;
      if (activeFilter === 'urgent' && item.urgencyLevel !== 'urgent') return false;
      if (activeFilter === 'approaching' && item.urgencyLevel !== 'approaching') return false;
      if (activeFilter === 'return_eligible' && item.daysLeft > 60) return false;

      // Supplier filter
      if (selectedSupplier !== 'all' && item.supplier !== selectedSupplier) return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = item.medicineName.toLowerCase().includes(q);
        const matchesSalt = item.salt?.toLowerCase().includes(q) || item.genericName?.toLowerCase().includes(q);
        const matchesBatch = item.batchNumber.toLowerCase().includes(q);
        const matchesSupplier = item.supplier?.toLowerCase().includes(q);
        const matchesManufacturer = item.manufacturer?.toLowerCase().includes(q);
        if (!matchesName && !matchesSalt && !matchesBatch && !matchesSupplier && !matchesManufacturer) {
          return false;
        }
      }

      return true;
    });

    // Sort order
    if (sortBy === 'urgency') {
      list = [...list].sort((a, b) => a.daysLeft - b.daysLeft);
    } else if (sortBy === 'value') {
      list = [...list].sort((a, b) => b.totalValue - a.totalValue);
    } else if (sortBy === 'stock') {
      list = [...list].sort((a, b) => b.stockQuantity - a.stockQuantity);
    } else if (sortBy === 'name') {
      list = [...list].sort((a, b) => a.medicineName.localeCompare(b.medicineName));
    }

    return list;
  }, [flaggedItems, activeFilter, selectedSupplier, searchTerm, sortBy]);

  // --- Voice Feedback & Speech Synthesis ---
  const speakMessage = (text: string) => {
    if (!ttsEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.lang = dictationLang;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis error:', err);
    }
  };

  const addVoiceLog = (command: string, feedback: string, status: 'success' | 'info' | 'warn') => {
    const entry: VoiceLogEntry = {
      id: crypto.randomUUID(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      command,
      feedback,
      status
    };
    setVoiceLogs(prev => [entry, ...prev.slice(0, 7)]);
  };

  // Announce Item for shelf inspector
  const announceItem = (item: ExpiryReportItem, index: number) => {
    if (!item) return;
    const targetMedicine = medicines.find(m => m.id === item.medicineId);
    const loc = targetMedicine ? getMedicineLocation(targetMedicine) : null;
    const locStr = loc ? `${loc.aisle}, ${loc.rack}, ${loc.shelf}` : 'Shelf general';
    const expDate = new Date(item.expiryDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    const textToSpeak = `Item ${index + 1}: ${item.medicineName}. Current stock is ${item.stockQuantity} units. Expiry ${expDate}. Location: ${locStr}. Say "Count is" or "Expiry" to update.`;
    speakMessage(textToSpeak);
  };

  // Handle stock and expiry updates to Firestore
  const handleUpdateStockAndExpiry = async (
    item: ExpiryReportItem,
    newStock: number,
    newExpiry?: string,
    newBatchNumber?: string
  ) => {
    try {
      const targetMedicine = medicines.find(m => m.id === item.medicineId);
      if (!targetMedicine) return false;

      let updatedBatches = targetMedicine.batches && targetMedicine.batches.length > 0
        ? [...targetMedicine.batches]
        : [{
            id: 'default',
            batchNumber: item.batchNumber || 'LOT-MAIN',
            expiryDate: targetMedicine.expiryDate || item.expiryDate,
            quantity: targetMedicine.stockQuantity || item.stockQuantity
          }];

      const batchIndex = updatedBatches.findIndex(b => 
        b.id === item.id.split('-')[1] || 
        b.batchNumber === item.batchNumber || 
        (b.batchNumber === 'LOT-MAIN' && item.batchNumber === 'LOT-MAIN')
      );

      if (batchIndex >= 0) {
        updatedBatches[batchIndex] = {
          ...updatedBatches[batchIndex],
          quantity: Math.max(0, newStock),
          expiryDate: newExpiry || updatedBatches[batchIndex].expiryDate,
          batchNumber: newBatchNumber || updatedBatches[batchIndex].batchNumber,
        };
      } else {
        updatedBatches.push({
          id: crypto.randomUUID(),
          batchNumber: newBatchNumber || item.batchNumber || 'AUDIT-LOT',
          expiryDate: newExpiry || item.expiryDate,
          quantity: Math.max(0, newStock)
        });
      }

      const totalStock = updatedBatches.reduce((acc, b) => acc + (b.quantity || 0), 0);
      const nearestExp = updatedBatches.reduce((min, b) => (b.expiryDate && b.expiryDate < min ? b.expiryDate : min), updatedBatches[0]?.expiryDate || newExpiry || targetMedicine.expiryDate);

      const docRef = doc(db, 'inventory', targetMedicine.id);
      await updateDoc(docRef, {
        batches: updatedBatches,
        stockQuantity: totalStock,
        expiryDate: nearestExp,
        updatedAt: new Date().toISOString()
      });

      // Update local verified state
      setVerifiedBatches(prev => ({
        ...prev,
        [item.id]: {
          verifiedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          verifiedCount: newStock,
          verifiedExpiry: newExpiry || item.expiryDate,
          isModified: true
        }
      }));

      // Log Activity
      await logActivity({
        action: 'Shelf Audit Verified',
        description: `Voice shelf audit updated ${item.medicineName}: Stock set to ${newStock} (Batch: ${newBatchNumber || item.batchNumber}, Expiry: ${newExpiry || item.expiryDate})`,
        type: 'inventory',
        module: 'inventory',
        userEmail: profile?.email || 'pharmacist@satyampharma.com',
        userId: profile?.uid,
        userName: profile?.displayName || 'Pharmacist',
        userRole: profile?.role || 'pharmacist',
        severity: 'info',
        details: {
          medicineId: targetMedicine.id,
          name: item.medicineName,
          batchNumber: newBatchNumber || item.batchNumber,
          newStock,
          newExpiry: newExpiry || item.expiryDate
        }
      });

      return true;
    } catch (error) {
      console.error('Error updating stock/expiry during shelf audit:', error);
      return false;
    }
  };

  const handleNextItem = (silent = false) => {
    if (displayedItems.length === 0) return;
    const nextIdx = (focusedIndex + 1) % displayedItems.length;
    setFocusedIndex(nextIdx);
    if (!silent) {
      announceItem(displayedItems[nextIdx], nextIdx);
    }
  };

  const handlePrevItem = () => {
    if (displayedItems.length === 0) return;
    const prevIdx = focusedIndex - 1 >= 0 ? focusedIndex - 1 : displayedItems.length - 1;
    setFocusedIndex(prevIdx);
    announceItem(displayedItems[prevIdx], prevIdx);
  };

  // --- Voice Command NLP Processor ---
  const executeVoiceCommand = async (rawTranscript: string) => {
    const text = rawTranscript.trim().toLowerCase();
    if (!text) return;

    const currentItem = displayedItems[focusedIndex] || displayedItems[0];

    // 1. HELP COMMAND
    if (text.includes('help') || text.includes('madad') || text.includes('kya bole') || text.includes('commands')) {
      setShowVoiceHelpModal(true);
      speakMessage(tText('Say: Count is [number], Expiry [month year], Verified, or Next item.', 'बोलें: Count is [संख्या], Expiry [महीना साल], Verified, या Next item.'));
      addVoiceLog(rawTranscript, 'Opened Voice Commands Cheat Sheet', 'info');
      return;
    }

    // 2. TTS TOGGLE
    if (text.includes('mute') || text.includes('silent') || text.includes('chup')) {
      setTtsEnabled(false);
      addVoiceLog(rawTranscript, 'Speech feedback muted', 'info');
      return;
    }
    if (text.includes('unmute') || text.includes('enable speech') || text.includes('speak')) {
      setTtsEnabled(true);
      speakMessage(tText('Voice feedback enabled.', 'वॉयस फीडबैक चालू किया गया।'));
      addVoiceLog(rawTranscript, 'Voice feedback enabled', 'success');
      return;
    }

    // 3. STOP LISTENING / EXIT
    if (text.includes('stop audit') || text.includes('stop listening') || text.includes('exit voice') || text.includes('band karo')) {
      stopListening();
      setIsVoiceAuditActive(false);
      speakMessage(tText('Voice shelf audit stopped.', 'वॉयस शेल्फ ऑडिट रोक दिया गया।'));
      addVoiceLog(rawTranscript, 'Voice audit stopped', 'info');
      return;
    }

    // 4. FILTER COMMANDS
    if (text.includes('show expired') || text.includes('filter expired') || text.includes('expired only')) {
      setActiveFilter('expired');
      setFocusedIndex(0);
      speakMessage(tText('Filtered to expired medications.', 'समाप्त दवाओं पर फ़िल्टर किया गया।'));
      addVoiceLog(rawTranscript, 'Filter changed to Expired', 'success');
      return;
    }
    if (text.includes('show critical') || text.includes('filter critical')) {
      setActiveFilter('critical');
      setFocusedIndex(0);
      speakMessage(tText('Filtered to critical medications within 30 days.', '30 दिनों के भीतर गंभीर दवाओं पर फ़िल्टर किया गया।'));
      addVoiceLog(rawTranscript, 'Filter changed to Critical', 'success');
      return;
    }
    if (text.includes('show urgent') || text.includes('filter urgent')) {
      setActiveFilter('urgent');
      setFocusedIndex(0);
      speakMessage(tText('Filtered to urgent medications within 60 days.', '60 दिनों के भीतर जरूरी दवाओं पर फ़िल्टर किया गया।'));
      addVoiceLog(rawTranscript, 'Filter changed to Urgent', 'success');
      return;
    }
    if (text.includes('show approaching') || text.includes('filter approaching')) {
      setActiveFilter('approaching');
      setFocusedIndex(0);
      speakMessage(tText('Filtered to approaching medications within 90 days.', '90 दिनों के भीतर दवाओं पर फ़िल्टर किया गया।'));
      addVoiceLog(rawTranscript, 'Filter changed to Approaching', 'success');
      return;
    }
    if (text.includes('show all') || text.includes('filter all') || text.includes('reset filter')) {
      setActiveFilter('all');
      setFocusedIndex(0);
      speakMessage(tText('Showing all 90-day flagged medications.', 'सभी दवाएं दिखाई जा रही हैं।'));
      addVoiceLog(rawTranscript, 'Filter reset to All', 'success');
      return;
    }

    // 5. NAVIGATION COMMANDS
    if (text === 'next' || text.includes('next item') || text.includes('next medicine') || text.includes('agla') || text.includes('forward')) {
      handleNextItem();
      addVoiceLog(rawTranscript, 'Advanced to next item', 'info');
      return;
    }
    if (text === 'previous' || text === 'back' || text.includes('prev item') || text.includes('previous item') || text.includes('pichhla')) {
      handlePrevItem();
      addVoiceLog(rawTranscript, 'Moved to previous item', 'info');
      return;
    }

    // 6. SELECT SPECIFIC ITEM BY NUMBER (e.g. "item 3" or "number 5")
    const itemNumMatch = text.match(/(?:item|number|no|aitem)\s+(\d+)/);
    if (itemNumMatch) {
      const idx = parseInt(itemNumMatch[1], 10) - 1;
      if (idx >= 0 && idx < displayedItems.length) {
        setFocusedIndex(idx);
        const target = displayedItems[idx];
        announceItem(target, idx);
        addVoiceLog(rawTranscript, `Selected item #${idx + 1}: ${target.medicineName}`, 'success');
        return;
      }
    }

    // 7. SELECT SPECIFIC ITEM BY MEDICINE NAME (e.g. "select Paracetamol" or "find Dolo")
    const findMatch = text.match(/(?:select|find|check|focus|goto|search|dhoondho|dekho)\s+([a-z0-9\s]+)/);
    if (findMatch) {
      const query = findMatch[1].trim();
      if (query.length > 2 && !['next', 'back', 'item', 'expired', 'critical', 'all'].includes(query)) {
        const matchIdx = displayedItems.findIndex(it => 
          it.medicineName.toLowerCase().includes(query) ||
          it.genericName?.toLowerCase().includes(query) ||
          it.salt?.toLowerCase().includes(query) ||
          it.batchNumber.toLowerCase().includes(query)
        );
        if (matchIdx >= 0) {
          setFocusedIndex(matchIdx);
          const target = displayedItems[matchIdx];
          announceItem(target, matchIdx);
          addVoiceLog(rawTranscript, `Found & selected ${target.medicineName}`, 'success');
          return;
        }
      }
    }

    // 8. RECORD EXPIRY DATE COMMAND
    if (text.includes('expiry') || text.includes('expire') || text.includes('tareekh') || text.includes('date')) {
      if (!currentItem) {
        speakMessage(tText('No medicine currently selected to update expiry.', 'कोई दवा चयनित नहीं है।'));
        return;
      }
      const parsedDate = parseSpokenExpiryDate(text);
      if (parsedDate) {
        const success = await handleUpdateStockAndExpiry(currentItem, currentItem.stockQuantity, parsedDate.isoDate);
        if (success) {
          const feedbackMsg = `Expiry updated to ${parsedDate.display} for ${currentItem.medicineName}.`;
          speakMessage(feedbackMsg);
          addVoiceLog(rawTranscript, feedbackMsg, 'success');
          if (autoAdvance) {
            setTimeout(() => handleNextItem(true), 1300);
          }
        } else {
          speakMessage(tText('Failed to update expiry date.', 'तारीख अपडेट करने में विफल।'));
        }
        return;
      }
    }

    // 9. CONFIRM / VERIFY EXISTING STOCK
    if (
      text.includes('verified') || 
      text.includes('confirm') || 
      text.includes('stock verified') || 
      text.includes('count verified') || 
      text.includes('verify') || 
      text.includes('sahi hai') || 
      text.includes('theek hai') || 
      text === 'ok' || 
      text === 'done' || 
      text === 'check'
    ) {
      if (!currentItem) return;
      const success = await handleUpdateStockAndExpiry(currentItem, currentItem.stockQuantity);
      if (success) {
        const feedbackMsg = `Verified ${currentItem.medicineName}, count confirmed as ${currentItem.stockQuantity} units.`;
        speakMessage(feedbackMsg);
        addVoiceLog(rawTranscript, feedbackMsg, 'success');
        if (autoAdvance) {
          setTimeout(() => handleNextItem(true), 1000);
        }
      }
      return;
    }

    // 10. STOCK COUNT UPDATE COMMAND (e.g. "count is 15", "stock 20", "count zero", "quantity 12")
    if (
      text.includes('count') || 
      text.includes('stock') || 
      text.includes('quantity') || 
      text.includes('units') || 
      text.includes('ginti') || 
      text.includes('stok') ||
      text.includes('is') ||
      text.includes('set')
    ) {
      if (!currentItem) return;
      const parsedQty = parseSpokenNumber(text);
      if (parsedQty !== null && parsedQty >= 0) {
        const success = await handleUpdateStockAndExpiry(currentItem, parsedQty);
        if (success) {
          const feedbackMsg = `Stock count updated to ${parsedQty} units for ${currentItem.medicineName}.`;
          speakMessage(feedbackMsg);
          addVoiceLog(rawTranscript, feedbackMsg, 'success');
          if (autoAdvance) {
            setTimeout(() => handleNextItem(true), 1200);
          }
        } else {
          speakMessage(tText('Failed to update stock count in database.', 'डेटाबेस में स्टॉक अपडेट नहीं हो सका।'));
        }
        return;
      }
    }

    // 11. RECORD BATCH NUMBER (e.g. "batch B102" or "batch number LOT-441")
    if (text.includes('batch') || text.includes('lot') || text.includes('baich')) {
      if (!currentItem) return;
      const batchMatch = text.match(/(?:batch|lot|number|baich)\s+(?:is\s+)?([a-z0-9-_]+)/);
      if (batchMatch && batchMatch[1]) {
        const newBatchStr = batchMatch[1].toUpperCase();
        const success = await handleUpdateStockAndExpiry(currentItem, currentItem.stockQuantity, undefined, newBatchStr);
        if (success) {
          const feedbackMsg = `Batch updated to ${newBatchStr} for ${currentItem.medicineName}.`;
          speakMessage(feedbackMsg);
          addVoiceLog(rawTranscript, feedbackMsg, 'success');
        }
        return;
      }
    }

    // 12. QUARANTINE / RETURN MEMO
    if (text.includes('quarantine') || text.includes('return memo') || text.includes('credit claim') || text.includes('return batch')) {
      if (currentItem) {
        setSelectedBatchForReturn(currentItem);
        speakMessage(`Opened supplier return claim for ${currentItem.medicineName}.`);
        addVoiceLog(rawTranscript, `Opened Return Memo for ${currentItem.medicineName}`, 'info');
        return;
      }
    }

    // 13. REORDER PROCUREMENT (e.g. "reorder", "reorder medicine", "reorder in inventory", "reorder in pos")
    if (text.includes('reorder') || text.includes('procure') || text.includes('order again') || text.includes('dobara mangwao')) {
      if (currentItem) {
        if (text.includes('pos') || text.includes('counter')) {
          handleExecuteReorder('pos', currentItem);
        } else if (text.includes('inventory') || text.includes('stock')) {
          handleExecuteReorder('inventory', currentItem);
        } else {
          setSelectedBatchForReorder(currentItem);
          speakMessage(`Opening reorder options for ${currentItem.medicineName}.`);
        }
        addVoiceLog(rawTranscript, `Initiated Reorder for ${currentItem.medicineName}`, 'success');
        return;
      }
    }

    // TIMEFRAME HORIZON VOICE COMMANDS
    if (text.includes('30 day') || text.includes('30 din') || text.includes('tees din')) {
      handleTimeframeChange(30);
      speakMessage(tText('Filtered to batches expiring within 30 days.', '३० दिनों में समाप्त होने वाले बैच।'));
      addVoiceLog(rawTranscript, 'Switched to 30-Day Expiry Horizon', 'success');
      return;
    }
    if (text.includes('60 day') || text.includes('60 din') || text.includes('saath din')) {
      handleTimeframeChange(60);
      speakMessage(tText('Filtered to batches expiring within 60 days.', '६० दिनों में समाप्त होने वाले बैच।'));
      addVoiceLog(rawTranscript, 'Switched to 60-Day Expiry Horizon', 'success');
      return;
    }
    if (text.includes('90 day') || text.includes('90 din') || text.includes('nabbe din')) {
      handleTimeframeChange(90);
      speakMessage(tText('Filtered to batches expiring within 90 days.', '९० दिनों में समाप्त होने वाले बैच।'));
      addVoiceLog(rawTranscript, 'Switched to 90-Day Expiry Horizon', 'success');
      return;
    }

    // 13. EXPORT PDF
    if (text.includes('export pdf') || text.includes('download pdf') || text.includes('download report')) {
      handleExportPDF();
      speakMessage(tText('Generating Expiry Audit PDF Report.', 'पीडीएफ रिपोर्ट तैयार की जा रही है।'));
      addVoiceLog(rawTranscript, 'Exported Expiry PDF', 'success');
      return;
    }

    // Unrecognized command
    addVoiceLog(rawTranscript, `Heard "${rawTranscript}". Say "Help" for available voice commands.`, 'warn');
  };

  // Start Speech Recognition
  const startListening = async () => {
    setSpeechError(null);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError(tText('Speech recognition is not supported in this browser.', 'इस ब्राउज़र में स्पीच रिकॉग्निशन समर्थित नहीं है।'));
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      } catch (micErr: any) {
        console.warn('Shelf audit microphone permission notice:', micErr);
        if (micErr.name === 'NotAllowedError' || micErr.name === 'PermissionDeniedError' || micErr.message?.includes('denied')) {
          setSpeechError(tText('Microphone permission denied. Please allow microphone access in your browser or open in a new tab.', 'माइक्रोफ़ोन अनुमति अस्वीकृत। कृपया ब्राउज़र में अनुमति दें या नए टैब में खोलें।'));
          return;
        }
      }
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = dictationLang;

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        setSpeechInterim(interim);
        if (final.trim()) {
          setSpeechTranscript(final.trim());
          executeVoiceCommand(final.trim());
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error event:', event.error);
        if (event.error === 'not-allowed') {
          setSpeechError(tText('Microphone permission denied. Please allow microphone access in your browser or open in a new tab.', 'माइक्रोफ़ोन अनुमति अस्वीकृत।'));
          setIsListening(false);
        } else if (event.error !== 'no-speech') {
          setSpeechError(`Speech error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        // Auto-restart if voice audit is still active
        if (isVoiceAuditActiveRef.current) {
          setTimeout(() => {
            if (isVoiceAuditActiveRef.current) {
              try {
                recognition.start();
                setIsListening(true);
              } catch (e) {
                console.warn('Could not auto-restart recognition:', e);
              }
            }
          }, 300);
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err: any) {
      console.error('Error starting speech recognition:', err);
      setSpeechError(err.message || 'Failed to start microphone. Please check permissions.');
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
    setSpeechInterim('');
  };

  // Toggle Voice Shelf Audit Mode
  const toggleVoiceAudit = () => {
    if (isVoiceAuditActive) {
      stopListening();
      setIsVoiceAuditActive(false);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } else {
      setIsVoiceAuditActive(true);
      startListening();
      if (displayedItems.length > 0) {
        const itemToFocus = displayedItems[focusedIndex] || displayedItems[0];
        announceItem(itemToFocus, focusedIndex);
      }
    }
  };

  // Clean up speech synthesis & recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Update recognition language if toggled
  useEffect(() => {
    if (isVoiceAuditActive && isListening) {
      stopListening();
      setTimeout(() => startListening(), 200);
    }
  }, [dictationLang]);

  // Handle PDF Export
  const handleExportPDF = () => {
    setIsExportingPdf(true);
    try {
      const filename = generateExpiryReportPDF(displayedItems, summary, activeFilter, expiryTimeframe);
      setPdfSuccessMessage(`Generated ${filename}`);
      setTimeout(() => setPdfSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Error generating PDF report:', err);
      alert('Failed to generate PDF. Please check console.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Handle CSV Export
  const handleExportCSV = () => {
    exportExpiryReportCSV(displayedItems, expiryTimeframe);
  };

  // Print Report Handler
  const handlePrint = () => {
    window.print();
  };

  // Handle Email Expiry Alert
  const handleEmailExpiryAlert = async () => {
    if (displayedItems.length === 0) return;
    setIsEmailingAlert(true);
    try {
      const payloadItems = displayedItems.map(it => ({
        medicineId: it.medicineId,
        medicineName: it.medicineName,
        genericName: it.genericName,
        salt: it.salt,
        batchNumber: it.batchNumber,
        expiryDate: it.expiryDate,
        stockQuantity: it.stockQuantity,
        rate: it.rate,
        totalValue: it.totalValue,
        daysLeft: it.daysLeft,
        supplier: it.supplier,
      }));

      const response = await fetch('/api/notifications/expiry-alert-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: payloadItems,
          triggeredBy: `Pharmacist ${profile?.displayName || 'Admin'} via Expiry Audit Radar`,
          storeName: 'Satyam Medical Store & Pharmacy',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setEmailSuccessMessage(`Expiry alert email sent successfully to ${data.recipients?.join(', ') || 'Admin'}`);
        setTimeout(() => setEmailSuccessMessage(null), 5000);
      } else {
        alert('Failed to send expiry alert email.');
      }
    } catch (err) {
      console.error('Error sending expiry email:', err);
      alert('Error connecting to email service.');
    } finally {
      setIsEmailingAlert(false);
    }
  };

  // Active focused item for Shelf HUD
  const activeInspectionItem = displayedItems[focusedIndex] || displayedItems[0] || null;
  const activeMedicineObj = activeInspectionItem ? medicines.find(m => m.id === activeInspectionItem.medicineId) : null;
  const activeLocation = activeMedicineObj ? getMedicineLocation(activeMedicineObj) : null;
  const verifiedCountInCurrentList = displayedItems.filter(it => verifiedBatches[it.id]).length;

  const content = (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/20">
            <FileText size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                {expiryTimeframe}-Day Medication Expiry & Urgency Audit Report
              </h2>
              <span className="flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800/60 px-2.5 py-0.5 text-[10px] font-black uppercase text-rose-800 dark:text-rose-300">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                Live {expiryTimeframe}D Radar
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Automated clinical risk flagging, FEFO stock prioritization, and distributor credit-return audit.
            </p>
          </div>
        </div>

        {/* Action Button Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Header Expiry Horizon Dropdown */}
          <div className="flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/80 dark:bg-rose-950/40 px-2.5 py-1.5 shadow-2xs">
            <Calendar size={13} className="text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="text-[11px] font-black text-rose-900 dark:text-rose-200 hidden sm:inline">Horizon:</span>
            <select
              id="header-expiry-timeframe-filter"
              aria-label="Toggle expiry timeframe"
              value={expiryTimeframe}
              onChange={(e) => handleTimeframeChange(Number(e.target.value) as 30 | 60 | 90)}
              className="bg-transparent text-xs font-black text-rose-900 dark:text-rose-100 focus:outline-none cursor-pointer"
            >
              <option value={30} className="text-slate-900 dark:text-slate-100">Expiring within 30 days</option>
              <option value={60} className="text-slate-900 dark:text-slate-100">60 days</option>
              <option value={90} className="text-slate-900 dark:text-slate-100">90 days</option>
            </select>
          </div>

          {isModal && onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X size={20} />
            </button>
          )}

          {/* Voice Shelf Audit Master Button */}
          <button
            type="button"
            onClick={toggleVoiceAudit}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black transition-all shadow-md active:scale-95 cursor-pointer",
              isVoiceAuditActive
                ? "bg-gradient-to-r from-red-600 to-rose-600 text-white ring-2 ring-red-400 shadow-red-500/30 animate-pulse"
                : "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-indigo-500/25"
            )}
            title="Start hands-free voice shelf audit with speech recognition and audio feedback"
          >
            {isVoiceAuditActive ? (
              <>
                <MicOff size={15} />
                <span>Voice Audit Active</span>
                <span className="flex h-2 w-2 rounded-full bg-white animate-ping ml-0.5" />
              </>
            ) : (
              <>
                <Mic size={15} />
                <span>Voice Shelf Audit</span>
                <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[9px] font-bold">Hands-Free</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={displayedItems.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            title="Download CSV spreadsheet for vendor returns"
          >
            <FileSpreadsheet size={15} className="text-emerald-600 dark:text-emerald-400" />
            <span>CSV Return Memo</span>
          </button>

          <button
            type="button"
            onClick={handleEmailExpiryAlert}
            disabled={isEmailingAlert || displayedItems.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            title="Send formatted expiry alert notice directly to admin email"
          >
            <Send size={14} className={cn(isEmailingAlert && "animate-spin")} />
            <span>{isEmailingAlert ? 'Emailing...' : 'Email Expiry Alert'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="hidden sm:flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-xs cursor-pointer"
            title="Direct print this view"
          >
            <Printer size={15} className="text-slate-500" />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExportingPdf || displayedItems.length === 0}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 px-4 py-2 text-xs font-black text-white shadow-md shadow-rose-600/25 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            title="Generate executive PDF report with pharmacy sign-off directly from browser"
          >
            <Download size={16} />
            <span>{isExportingPdf ? 'Generating PDF...' : 'Export Audit PDF'}</span>
          </button>

          {isModal && onClose && (
            <button
              onClick={onClose}
              className="hidden md:flex p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 transition-all"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* HANDS-FREE VOICE SHELF AUDIT HUD */}
      <AnimatePresence>
        {isVoiceAuditActive && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            className="rounded-3xl border-2 border-indigo-500/40 bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950 text-white p-5 sm:p-6 shadow-2xl shadow-indigo-950/40 relative overflow-hidden"
          >
            {/* Background Glow */}
            <div className="absolute top-0 right-0 -mt-8 -mr-8 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-1/3 -mb-8 h-40 w-40 rounded-full bg-violet-600/20 blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-4.5">
              {/* HUD Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-800/60 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30">
                    <Mic size={20} className={cn(isListening && "animate-pulse text-rose-300")} />
                    {isListening && (
                      <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500" />
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-2">
                        Hands-Free Shelf Inspection Voice Mode
                      </h3>
                      <span className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                        Active Listening
                      </span>
                    </div>
                    <p className="text-xs text-indigo-200/80">
                      Dictate stock counts & expiry updates while walking physical racks. Zero typing required.
                    </p>
                  </div>
                </div>

                {/* HUD Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Language Toggle */}
                  <button
                    type="button"
                    onClick={() => setDictationLang(prev => prev === 'en-IN' ? 'hi-IN' : 'en-IN')}
                    className="flex items-center gap-1 rounded-xl bg-indigo-900/70 hover:bg-indigo-800 border border-indigo-700/60 px-2.5 py-1.5 text-xs font-bold text-indigo-200 transition-all cursor-pointer"
                    title="Toggle Speech Language"
                  >
                    <Languages size={14} className="text-indigo-400" />
                    <span>{dictationLang === 'en-IN' ? 'English (IN)' : 'हिन्दी (IN)'}</span>
                  </button>

                  {/* TTS Speech Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      const next = !ttsEnabled;
                      setTtsEnabled(next);
                      if (next) speakMessage('Voice feedback enabled.');
                    }}
                    className={cn(
                      "flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer",
                      ttsEnabled
                        ? "bg-indigo-900/70 border-indigo-700/60 text-indigo-200"
                        : "bg-slate-800/80 border-slate-700 text-slate-400"
                    )}
                    title="Toggle Spoken Voice Feedback"
                  >
                    {ttsEnabled ? <Volume2 size={14} className="text-indigo-400" /> : <VolumeX size={14} />}
                    <span>{ttsEnabled ? 'Speech ON' : 'Muted'}</span>
                  </button>

                  {/* Auto-Advance Toggle */}
                  <button
                    type="button"
                    onClick={() => setAutoAdvance(prev => !prev)}
                    className={cn(
                      "flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer",
                      autoAdvance
                        ? "bg-emerald-950/60 border-emerald-700/60 text-emerald-300"
                        : "bg-slate-800/80 border-slate-700 text-slate-400"
                    )}
                    title="Automatically move to next item after count verification"
                  >
                    <FastForward size={14} className={cn(autoAdvance && "text-emerald-400")} />
                    <span>{autoAdvance ? 'Auto-Next ON' : 'Auto-Next OFF'}</span>
                  </button>

                  {/* Help Cheat Sheet */}
                  <button
                    type="button"
                    onClick={() => setShowVoiceHelpModal(true)}
                    className="flex items-center gap-1 rounded-xl bg-indigo-600/60 hover:bg-indigo-600 border border-indigo-400/30 px-3 py-1.5 text-xs font-black text-white transition-all cursor-pointer"
                  >
                    <HelpCircle size={14} />
                    <span>Voice Commands</span>
                  </button>

                  {/* Exit Voice Mode */}
                  <button
                    type="button"
                    onClick={toggleVoiceAudit}
                    className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-900/80 text-slate-300 hover:text-rose-200 border border-slate-700 transition-all cursor-pointer"
                    title="Exit Voice Audit"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* ACTIVE MEDICINE INSPECTION CARD */}
              {activeInspectionItem ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                  {/* Left Info: Item details & Shelf coordinates */}
                  <div className="lg:col-span-7 space-y-2.5">
                    {/* Shelf Location Coordinate Badge */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="flex items-center gap-1.5 rounded-lg bg-indigo-900/90 border border-indigo-600/50 px-2.5 py-1 font-mono font-black text-indigo-200">
                        <MapPin size={13} className="text-amber-400 shrink-0" />
                        <span>Shelf Coordinates:</span>
                        <strong className="text-white">
                          {activeLocation ? `${activeLocation.aisle} • ${activeLocation.rack} • ${activeLocation.shelf} • ${activeLocation.bin}` : 'General Rack R-01'}
                        </strong>
                      </span>

                      <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-bold text-slate-300">
                        Item {focusedIndex + 1} of {displayedItems.length}
                      </span>

                      {verifiedBatches[activeInspectionItem.id] && (
                        <span className="flex items-center gap-1 rounded-md bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[11px] font-black text-emerald-300">
                          <CheckCircle2 size={12} className="text-emerald-400" />
                          <span>Verified ({verifiedBatches[activeInspectionItem.id].verifiedAt})</span>
                        </span>
                      )}
                    </div>

                    {/* Big Medicine Name & Formulation */}
                    <div>
                      <h4 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                        <span>{activeInspectionItem.medicineName}</span>
                      </h4>
                      {activeInspectionItem.salt && (
                        <p className="text-xs sm:text-sm font-semibold text-indigo-300 mt-0.5">
                          {activeInspectionItem.salt}
                        </p>
                      )}
                    </div>

                    {/* Batch Number & Expiry Badge Grid */}
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                      <div className="flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-700/80">
                        <Tag size={13} className="text-slate-400" />
                        <span className="text-slate-400">Batch:</span>
                        <span className="font-mono font-black text-white">{activeInspectionItem.batchNumber}</span>
                      </div>

                      <div className="flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-700/80">
                        <Calendar size={13} className="text-rose-400" />
                        <span className="text-slate-400">Expiry:</span>
                        <span className="font-bold text-rose-300">
                          {new Date(activeInspectionItem.expiryDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                        <span className="ml-1 rounded bg-rose-950 px-1.5 py-0.5 text-[10px] font-black text-rose-400 border border-rose-800/60">
                          {activeInspectionItem.daysLeft <= 0 ? 'Expired' : `${activeInspectionItem.daysLeft}d left`}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-700/80">
                        <Building2 size={13} className="text-slate-400" />
                        <span className="text-slate-400 truncate max-w-[140px]">{activeInspectionItem.supplier || 'Main Distributor'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Controls: Big Physical Stock Counter & Navigation */}
                  <div className="lg:col-span-5 bg-slate-900/90 rounded-2xl border border-indigo-700/50 p-4 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Physical Shelf Count:</span>
                      <span className="text-[11px] text-indigo-300 font-semibold">Say "Count is 15"</span>
                    </div>

                    {/* Stock Counter with Interactive Controls */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const newQty = Math.max(0, activeInspectionItem.stockQuantity - 1);
                          handleUpdateStockAndExpiry(activeInspectionItem, newQty);
                          speakMessage(`Count is ${newQty}`);
                        }}
                        className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xl font-black text-white active:scale-95 transition-all cursor-pointer"
                        title="Decrement Count"
                      >
                        -
                      </button>

                      <div className="flex-1 text-center bg-indigo-950/80 border-2 border-indigo-500/80 rounded-2xl py-2 px-3">
                        <div className="text-3xl font-black text-white tracking-tight">
                          {activeInspectionItem.stockQuantity}
                        </div>
                        <span className="text-[10px] uppercase tracking-widest text-indigo-300 font-bold">Units in stock</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const newQty = activeInspectionItem.stockQuantity + 1;
                          handleUpdateStockAndExpiry(activeInspectionItem, newQty);
                          speakMessage(`Count is ${newQty}`);
                        }}
                        className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xl font-black text-white active:scale-95 transition-all cursor-pointer"
                        title="Increment Count"
                      >
                        +
                      </button>
                    </div>

                    {/* Quick Action Buttons for Hands-Free or Tap */}
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={handlePrevItem}
                        className="flex items-center justify-center gap-1 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 py-2 font-bold text-slate-300 transition-all active:scale-95 cursor-pointer"
                      >
                        <ChevronLeft size={14} />
                        <span>Prev</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          await handleUpdateStockAndExpiry(activeInspectionItem, activeInspectionItem.stockQuantity);
                          speakMessage(`Confirmed ${activeInspectionItem.medicineName} stock as ${activeInspectionItem.stockQuantity} units.`);
                          if (autoAdvance) setTimeout(() => handleNextItem(true), 800);
                        }}
                        className="flex items-center justify-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2 font-black text-white shadow-md shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer"
                      >
                        <Check size={15} />
                        <span>Verify</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedBatchForReorder(activeInspectionItem)}
                        className="flex items-center justify-center gap-1 rounded-xl bg-violet-600 hover:bg-violet-500 py-2 font-bold text-white shadow transition-all active:scale-95 cursor-pointer"
                        title="Reorder medicine in Inventory or POS"
                      >
                        <ShoppingCart size={13} />
                        <span>Reorder</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleNextItem()}
                        className="flex items-center justify-center gap-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2 font-bold text-white shadow transition-all active:scale-95 cursor-pointer"
                      >
                        <span>Next</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-indigo-300">
                  <p className="font-bold">No medications in current view. Adjust filters to inspect stock.</p>
                </div>
              )}

              {/* LIVE AUDIO WAVEFORM & TRANSCRIPTION BAR */}
              <div className="rounded-2xl bg-black/40 border border-indigo-900/60 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Voice Status & Interim Transcript */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Equalizer Audio Waves */}
                  <div className="flex items-end gap-0.8 h-5 shrink-0">
                    <span className={cn("w-1 rounded-full bg-indigo-400", isListening ? "h-5 animate-bounce" : "h-1.5")} />
                    <span className={cn("w-1 rounded-full bg-rose-400", isListening ? "h-3 animate-bounce delay-75" : "h-2")} />
                    <span className={cn("w-1 rounded-full bg-indigo-300", isListening ? "h-4 animate-bounce delay-150" : "h-1.5")} />
                    <span className={cn("w-1 rounded-full bg-violet-400", isListening ? "h-5 animate-bounce delay-100" : "h-2.5")} />
                    <span className={cn("w-1 rounded-full bg-indigo-400", isListening ? "h-3 animate-bounce delay-200" : "h-1.5")} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-indigo-300">
                        {isListening ? 'Listening for speech...' : 'Microphone paused'}
                      </span>
                      {speechError && (
                        <span className="text-[10px] text-rose-300 font-bold truncate">({speechError})</span>
                      )}
                    </div>

                    <p className="text-xs font-mono text-white truncate mt-0.5">
                      {speechInterim ? (
                        <span className="text-amber-300 italic">"{speechInterim}"</span>
                      ) : speechTranscript ? (
                        <span className="text-emerald-300 font-semibold">Heard: "{speechTranscript}"</span>
                      ) : (
                        <span className="text-slate-400">Say: "Count is 24", "Expiry Dec 2026", "Verified", or "Next item"...</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Progress bar of Shelf Verification */}
                <div className="flex items-center gap-3 shrink-0 text-xs">
                  <div className="text-right">
                    <div className="font-bold text-white">
                      {verifiedCountInCurrentList} of {displayedItems.length} Audited
                    </div>
                    <div className="text-[10px] text-indigo-300">
                      {displayedItems.length > 0 ? Math.round((verifiedCountInCurrentList / displayedItems.length) * 100) : 0}% Complete
                    </div>
                  </div>
                  <div className="w-24 h-2 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${displayedItems.length > 0 ? (verifiedCountInCurrentList / displayedItems.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* RECENT VOICE LOGS TICKER */}
              {voiceLogs.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto text-[11px] pt-1 pb-0.5 scrollbar-none">
                  <span className="text-[10px] font-black uppercase text-indigo-300 shrink-0">Recent Actions:</span>
                  {voiceLogs.slice(0, 3).map((log) => (
                    <span 
                      key={log.id}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 shrink-0 border",
                        log.status === 'success' && "bg-emerald-950/60 border-emerald-700/60 text-emerald-300",
                        log.status === 'warn' && "bg-amber-950/60 border-amber-700/60 text-amber-300",
                        log.status === 'info' && "bg-indigo-900/60 border-indigo-700/60 text-indigo-200"
                      )}
                    >
                      <span className="text-[9px] text-slate-400 font-mono">{log.time}</span>
                      <strong className="text-white">{log.feedback}</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Notification Banner for PDF / Email */}
      <AnimatePresence>
        {(pdfSuccessMessage || emailSuccessMessage) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900 dark:border-emerald-800/80 dark:bg-emerald-950/60 dark:text-emerald-200"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold">{pdfSuccessMessage || emailSuccessMessage}</span>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
              {pdfSuccessMessage ? 'Ready in Downloads' : 'Dispatched'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expiry Horizon Filter Dropdown Bar (Directly Above Expiry Audit Report) */}
      <div 
        id="expiry-audit-filter-bar"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-2xl border border-rose-200/80 bg-gradient-to-r from-rose-50/70 via-white to-amber-50/50 p-4 shadow-xs dark:border-rose-900/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-600 to-red-600 text-white shadow-md shadow-rose-600/20">
            <Calendar size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <label htmlFor="expiry-timeframe-dropdown" className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Expiry Audit Horizon Filter:
              </label>
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-black text-rose-800 dark:bg-rose-950/80 dark:text-rose-300">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
                {expiryTimeframe === 30 ? 'Expiring within 30 days' : expiryTimeframe === 60 ? '60 days' : '90 days'} active
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Showing {flaggedItems.length} batches expiring within {expiryTimeframe} days with {formatCurrency(summary.totalFinancialValue)} total capital at risk.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Main Filter Dropdown */}
          <div className="relative min-w-[210px]">
            <select
              id="expiry-timeframe-dropdown"
              aria-label="Filter expiry timeframe"
              value={expiryTimeframe}
              onChange={(e) => handleTimeframeChange(Number(e.target.value) as 30 | 60 | 90)}
              className="w-full appearance-none rounded-xl border-2 border-rose-300 bg-white py-2 pl-3.5 pr-9 text-xs font-black text-slate-900 shadow-xs transition-all hover:border-rose-400 focus:border-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500/20 dark:border-rose-700/80 dark:bg-slate-800 dark:text-white cursor-pointer"
            >
              <option value={30} className="text-slate-900 dark:text-slate-100">Expiring within 30 days</option>
              <option value={60} className="text-slate-900 dark:text-slate-100">60 days</option>
              <option value={90} className="text-slate-900 dark:text-slate-100">90 days</option>
            </select>
            <ChevronRight size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-rose-600 dark:text-rose-400" />
          </div>

          {/* Instant 1-Click Fast Buttons */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-white/80 p-1 shadow-xs dark:border-slate-800 dark:bg-slate-800/80">
            <button
              type="button"
              id="expiry-filter-pill-30"
              onClick={() => handleTimeframeChange(30)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
                expiryTimeframe === 30
                  ? "bg-rose-600 text-white shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              )}
              title="Toggle to 30 days"
            >
              30 Days
            </button>
            <button
              type="button"
              id="expiry-filter-pill-60"
              onClick={() => handleTimeframeChange(60)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
                expiryTimeframe === 60
                  ? "bg-rose-600 text-white shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              )}
              title="Toggle to 60 days"
            >
              60 Days
            </button>
            <button
              type="button"
              id="expiry-filter-pill-90"
              onClick={() => handleTimeframeChange(90)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
                expiryTimeframe === 90
                  ? "bg-rose-600 text-white shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              )}
              title="Toggle to 90 days"
            >
              90 Days
            </button>
          </div>
        </div>
      </div>

      {/* Executive KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {/* Total Risk Highlight */}
        <div className="col-span-2 md:col-span-1 rounded-2xl border border-slate-900 bg-slate-900 text-white p-4.5 shadow-md flex flex-col justify-between dark:border-slate-700 dark:bg-slate-800">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total at Risk (≤{expiryTimeframe}d)</span>
              <Boxes size={16} className="text-rose-400" />
            </div>
            <p className="mt-2 text-2xl font-black">{summary.totalFlaggedCount} <span className="text-xs font-normal text-slate-400">batches</span></p>
            <p className="text-xs font-bold text-slate-300 mt-0.5">{summary.totalUnitsAtRisk} total units</p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800 dark:border-slate-700 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Capital at Risk:</span>
            <span className="text-xs font-black text-rose-300">{formatCurrency(summary.totalFinancialValue)}</span>
          </div>
        </div>

        {/* Expired (<= 0d) */}
        <div 
          onClick={() => setActiveFilter('expired')}
          className={cn(
            "rounded-2xl border p-4 transition-all cursor-pointer shadow-xs",
            activeFilter === 'expired' 
              ? "border-red-600 bg-red-50/90 dark:bg-red-950/70 ring-2 ring-red-500/20" 
              : "border-red-200 bg-red-50/40 hover:bg-red-50/70 dark:border-red-900/40 dark:bg-red-950/20"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-wider text-red-800 dark:text-red-300">Expired (≤0d)</span>
            </div>
            <AlertOctagon size={15} className="text-red-600" />
          </div>
          <p className="mt-2 text-xl font-black text-red-900 dark:text-red-200">{summary.expiredCount} <span className="text-xs font-semibold text-red-600">lots</span></p>
          <p className="text-[11px] font-bold text-red-700 dark:text-red-400">{summary.expiredUnits} units</p>
          <div className="mt-2.5 pt-2 border-t border-red-200/60 dark:border-red-900/60 flex items-center justify-between">
            <span className="text-[10px] text-red-600 dark:text-red-400">Total Loss:</span>
            <span className="text-xs font-black text-red-700 dark:text-red-300">{formatCurrency(summary.expiredValue)}</span>
          </div>
        </div>

        {/* Critical (1-30d) */}
        <div 
          onClick={() => setActiveFilter('critical')}
          className={cn(
            "rounded-2xl border p-4 transition-all cursor-pointer shadow-xs",
            activeFilter === 'critical' 
              ? "border-rose-600 bg-rose-50/90 dark:bg-rose-950/70 ring-2 ring-rose-500/20" 
              : "border-rose-200 bg-rose-50/40 hover:bg-rose-50/70 dark:border-rose-900/40 dark:bg-rose-950/20"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-600" />
              <span className="text-[11px] font-black uppercase tracking-wider text-rose-800 dark:text-rose-300">Critical (1-30d)</span>
            </div>
            <AlertTriangle size={15} className="text-rose-600" />
          </div>
          <p className="mt-2 text-xl font-black text-rose-900 dark:text-rose-200">{summary.criticalCount} <span className="text-xs font-semibold text-rose-600">lots</span></p>
          <p className="text-[11px] font-bold text-rose-700 dark:text-rose-400">{summary.criticalUnits} units</p>
          <div className="mt-2.5 pt-2 border-t border-rose-200/60 dark:border-rose-900/60 flex items-center justify-between">
            <span className="text-[10px] text-rose-600 dark:text-rose-400">Capital at Risk:</span>
            <span className="text-xs font-black text-rose-700 dark:text-rose-300">{formatCurrency(summary.criticalValue)}</span>
          </div>
        </div>

        {/* Urgent (31-60d) */}
        <div 
          onClick={() => {
            if (expiryTimeframe < 60) handleTimeframeChange(60);
            setActiveFilter('urgent');
          }}
          className={cn(
            "rounded-2xl border p-4 transition-all cursor-pointer shadow-xs",
            activeFilter === 'urgent' 
              ? "border-amber-500 bg-amber-50/90 dark:bg-amber-950/70 ring-2 ring-amber-500/20" 
              : "border-amber-200 bg-amber-50/40 hover:bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/20",
            expiryTimeframe < 60 && "opacity-60 hover:opacity-100"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">Urgent (31-60d)</span>
            </div>
            <Clock size={15} className="text-amber-600" />
          </div>
          <p className="mt-2 text-xl font-black text-amber-900 dark:text-amber-200">
            {expiryTimeframe < 60 ? (
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Click to expand to 60D</span>
            ) : (
              <>{summary.urgentCount} <span className="text-xs font-semibold text-amber-600">lots</span></>
            )}
          </p>
          <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
            {expiryTimeframe < 60 ? 'Outside 30D Window' : `${summary.urgentUnits} units`}
          </p>
          <div className="mt-2.5 pt-2 border-t border-amber-200/60 dark:border-amber-900/60 flex items-center justify-between">
            <span className="text-[10px] text-amber-600 dark:text-amber-400">Capital at Risk:</span>
            <span className="text-xs font-black text-amber-700 dark:text-amber-300">{formatCurrency(summary.urgentValue)}</span>
          </div>
        </div>

        {/* Approaching (61-90d) */}
        <div 
          onClick={() => {
            if (expiryTimeframe < 90) handleTimeframeChange(90);
            setActiveFilter('approaching');
          }}
          className={cn(
            "rounded-2xl border p-4 transition-all cursor-pointer shadow-xs",
            activeFilter === 'approaching' 
              ? "border-blue-500 bg-blue-50/90 dark:bg-blue-950/70 ring-2 ring-blue-500/20" 
              : "border-blue-200 bg-blue-50/40 hover:bg-blue-50/70 dark:border-blue-900/40 dark:bg-blue-950/20",
            expiryTimeframe < 90 && "opacity-60 hover:opacity-100"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-[11px] font-black uppercase tracking-wider text-blue-800 dark:text-blue-300">Approaching (61-90d)</span>
            </div>
            <Calendar size={15} className="text-blue-600" />
          </div>
          <p className="mt-2 text-xl font-black text-blue-900 dark:text-blue-200">
            {expiryTimeframe < 90 ? (
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Click to expand to 90D</span>
            ) : (
              <>{summary.approachingCount} <span className="text-xs font-semibold text-blue-600">lots</span></>
            )}
          </p>
          <p className="text-[11px] font-bold text-blue-700 dark:text-blue-400">
            {expiryTimeframe < 90 ? `Outside ${expiryTimeframe}D Window` : `${summary.approachingUnits} units`}
          </p>
          <div className="mt-2.5 pt-2 border-t border-blue-200/60 dark:border-blue-900/60 flex items-center justify-between">
            <span className="text-[10px] text-blue-600 dark:text-blue-400">Capital:</span>
            <span className="text-xs font-black text-blue-700 dark:text-blue-300">{formatCurrency(summary.approachingValue)}</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs, Search & Sort Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveFilter('all')}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
              activeFilter === 'all'
                ? "bg-slate-900 text-white dark:bg-blue-600"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            )}
          >
            All ≤{expiryTimeframe} Days ({flaggedItems.length})
          </button>
          <button
            onClick={() => setActiveFilter('expired')}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
              activeFilter === 'expired'
                ? "bg-red-600 text-white"
                : "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-300"
            )}
          >
            Expired ({summary.expiredCount})
          </button>
          <button
            onClick={() => setActiveFilter('critical')}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
              activeFilter === 'critical'
                ? "bg-rose-600 text-white"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300"
            )}
          >
            Critical 1-30d ({summary.criticalCount})
          </button>
          <button
            onClick={() => {
              if (expiryTimeframe < 60) handleTimeframeChange(60);
              setActiveFilter('urgent');
            }}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
              activeFilter === 'urgent'
                ? "bg-amber-600 text-white"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300",
              expiryTimeframe < 60 && "opacity-60 hover:opacity-100"
            )}
          >
            Urgent 31-60d {expiryTimeframe < 60 ? '(Expand to 60D)' : `(${summary.urgentCount})`}
          </button>
          <button
            onClick={() => {
              if (expiryTimeframe < 90) handleTimeframeChange(90);
              setActiveFilter('approaching');
            }}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
              activeFilter === 'approaching'
                ? "bg-blue-600 text-white"
                : "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300",
              expiryTimeframe < 90 && "opacity-60 hover:opacity-100"
            )}
          >
            Approaching 61-90d {expiryTimeframe < 90 ? '(Expand to 90D)' : `(${summary.approachingCount})`}
          </button>
          <button
            onClick={() => setActiveFilter('return_eligible')}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer",
              activeFilter === 'return_eligible'
                ? "bg-emerald-600 text-white"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300"
            )}
          >
            Return Window (≤60d) ({summary.expiredCount + summary.criticalCount + summary.urgentCount})
          </button>
        </div>

        {/* Search, Supplier & Sort Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Table-level Expiry Horizon Filter Dropdown */}
          <div className="flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-800/80 bg-rose-50/70 dark:bg-rose-950/40 px-2.5 py-1 shadow-2xs">
            <Clock size={12} className="text-rose-600 dark:text-rose-400 shrink-0" />
            <select
              id="table-expiry-timeframe-filter"
              aria-label="Filter expiry timeframe"
              value={expiryTimeframe}
              onChange={(e) => handleTimeframeChange(Number(e.target.value) as 30 | 60 | 90)}
              className="bg-transparent text-xs font-black text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value={30} className="text-slate-900 dark:text-slate-100">Expiring within 30 days</option>
              <option value={60} className="text-slate-900 dark:text-slate-100">60 days</option>
              <option value={90} className="text-slate-900 dark:text-slate-100">90 days</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search medicine, salt, batch..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-1.5 pl-8 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Supplier Dropdown */}
          {suppliers.length > 0 && (
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-1.5 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="all">All Distributors ({suppliers.length})</option>
              {suppliers.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}

          {/* Sort Selector */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1">
            <ArrowUpDown size={12} className="text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="urgency">Urgency (Fewest Days)</option>
              <option value="value">Highest Value at Risk</option>
              <option value="stock">Stock Quantity (High-Low)</option>
              <option value="name">Medicine Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table View */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Urgency & Days</th>
                <th className="py-3 px-4">Shelf Location</th>
                <th className="py-3 px-4">Medicine & Formulation</th>
                <th className="py-3 px-4">Batch No.</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4 text-center">Stock Units</th>
                <th className="py-3 px-4 text-right">Unit Rate</th>
                <th className="py-3 px-4 text-right">Value at Risk</th>
                <th className="py-3 px-4">Distributor</th>
                <th className="py-3 px-4">Recommendation</th>
                <th className="py-3 px-4 text-center">Audit & Reorder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <RefreshCw className="animate-spin mx-auto mb-2 text-rose-500" size={24} />
                    <p className="font-bold">Scanning pharmacy inventory for expiring batches...</p>
                  </td>
                </tr>
              ) : displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <CheckCircle2 size={36} className="mx-auto mb-2 text-emerald-500 opacity-60" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No medications match the 90-day filter.</p>
                    <p className="text-xs text-slate-500 mt-1">All other batches have longer shelf lives.</p>
                  </td>
                </tr>
              ) : (
                displayedItems.map((item, idx) => {
                  let badgeBg = "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800";
                  let pulseColor = "bg-blue-500";
                  let urgencyTitle = `${item.daysLeft} days left`;

                  if (item.urgencyLevel === 'expired') {
                    badgeBg = "bg-red-100 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800 font-black";
                    pulseColor = "bg-red-600";
                    urgencyTitle = item.daysLeft === 0 ? "Expires Today" : `Expired ${Math.abs(item.daysLeft)}d ago`;
                  } else if (item.urgencyLevel === 'critical') {
                    badgeBg = "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800 font-bold";
                    pulseColor = "bg-rose-600";
                    urgencyTitle = `Critical (${item.daysLeft}d left)`;
                  } else if (item.urgencyLevel === 'urgent') {
                    badgeBg = "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 font-bold";
                    pulseColor = "bg-amber-500";
                    urgencyTitle = `Urgent (${item.daysLeft}d left)`;
                  } else {
                    badgeBg = "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800";
                    pulseColor = "bg-blue-500";
                    urgencyTitle = `Approaching (${item.daysLeft}d left)`;
                  }

                  const isCurrentVoiceTarget = isVoiceAuditActive && focusedIndex === idx;
                  const medObj = medicines.find(m => m.id === item.medicineId);
                  const loc = medObj ? getMedicineLocation(medObj) : null;
                  const verifiedInfo = verifiedBatches[item.id];

                  return (
                    <tr 
                      key={item.id} 
                      onClick={() => {
                        setFocusedIndex(idx);
                        if (isVoiceAuditActive) {
                          speakMessage(`Selected ${item.medicineName}. Current count is ${item.stockQuantity}. Shelf location: ${loc ? `${loc.aisle}, rack ${loc.rack}` : 'Rack 1'}.`);
                        }
                      }}
                      className={cn(
                        "hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all cursor-pointer",
                        item.urgencyLevel === 'expired' && "bg-red-50/20 dark:bg-red-950/10",
                        item.urgencyLevel === 'critical' && "bg-rose-50/15 dark:bg-rose-950/10",
                        isCurrentVoiceTarget && "bg-indigo-50/90 dark:bg-indigo-950/60 ring-2 ring-indigo-500 shadow-sm"
                      )}
                    >
                      {/* Urgency Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] border shadow-2xs",
                            badgeBg
                          )}>
                            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", pulseColor, (item.urgencyLevel === 'expired' || item.urgencyLevel === 'critical') && "animate-ping")} />
                            <span>{urgencyTitle}</span>
                          </span>
                          {isCurrentVoiceTarget && (
                            <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1">
                              <Mic size={10} className="animate-pulse" />
                              Voice Inspecting
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Shelf Coordinates Column */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs font-mono">
                          <MapPin size={12} className="text-amber-500 shrink-0" />
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {loc ? `${loc.aisle} • ${loc.rack} • ${loc.shelf}` : 'R-01'}
                          </span>
                        </div>
                        {loc && (
                          <span className="text-[9px] text-slate-400 block ml-4">Bin {loc.bin}</span>
                        )}
                      </td>

                      {/* Medicine Name & Salt */}
                      <td className="py-3 px-4 max-w-[200px]">
                        <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{item.medicineName}</p>
                        {item.salt && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{item.salt}</p>
                        )}
                        {item.manufacturer && (
                          <p className="text-[9px] text-slate-400 dark:text-slate-500">{item.manufacturer}</p>
                        )}
                      </td>

                      {/* Batch Number */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                          {item.batchNumber}
                        </span>
                      </td>

                      {/* Expiry Date */}
                      <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">
                        {new Date(item.expiryDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>

                      {/* Stock Units */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="font-black text-slate-900 dark:text-slate-100 text-sm">{item.stockQuantity}</span>
                      </td>

                      {/* Unit Rate */}
                      <td className="py-3 px-4 text-right whitespace-nowrap text-slate-600 dark:text-slate-400">
                        ₹{item.rate.toFixed(2)}
                      </td>

                      {/* Value at Risk */}
                      <td className="py-3 px-4 text-right whitespace-nowrap font-black text-rose-600 dark:text-rose-400">
                        ₹{item.totalValue.toFixed(2)}
                      </td>

                      {/* Distributor */}
                      <td className="py-3 px-4 max-w-[140px] truncate text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Building2 size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate">{item.supplier || 'Main Distributor'}</span>
                        </div>
                      </td>

                      {/* Action Recommendation */}
                      <td className="py-3 px-4">
                        <span className={cn(
                          "inline-block rounded-md px-2 py-0.5 text-[10px] font-bold",
                          item.urgencyLevel === 'expired' && "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
                          item.urgencyLevel === 'critical' && "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
                          item.urgencyLevel === 'urgent' && "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
                          item.urgencyLevel === 'approaching' && "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                        )}>
                          {item.recommendedAction}
                        </span>
                      </td>

                      {/* Audit Status / Action */}
                      <td className="py-3 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          {verifiedInfo ? (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 px-2 py-1 text-[10px] font-black border border-emerald-300 dark:border-emerald-800">
                              <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" />
                              <span>Audited ({verifiedInfo.verifiedCount})</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateStockAndExpiry(item, item.stockQuantity);
                                speakMessage(`Stock verified for ${item.medicineName}`);
                              }}
                              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 hover:border-emerald-300 dark:hover:bg-emerald-950 px-2 py-1 text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:text-emerald-700 transition-all cursor-pointer"
                              title="Mark this batch count verified"
                            >
                              Verify
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedBatchForReturn(item)}
                            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
                            title="Open Supplier Return memo draft"
                          >
                            Memo
                          </button>

                          {/* Reorder Button for Procurement */}
                          <button
                            type="button"
                            id={`reorder-btn-${item.id}`}
                            onClick={() => setSelectedBatchForReorder(item)}
                            className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:hover:bg-indigo-900/80 dark:text-indigo-300 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xs"
                            title={`Reorder ${item.medicineName} in POS or Inventory`}
                          >
                            <ShoppingCart size={11} className="text-indigo-600 dark:text-indigo-400" />
                            <span>Reorder</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary of Table */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-4 text-xs">
          <div className="text-slate-500 dark:text-slate-400">
            Showing <strong className="text-slate-800 dark:text-slate-200">{displayedItems.length}</strong> of <strong className="text-slate-800 dark:text-slate-200">{flaggedItems.length}</strong> flagged batches (≤90 days)
          </div>
          <div className="flex items-center gap-4 text-slate-700 dark:text-slate-300 font-bold">
            <span>Filtered Units: <strong className="text-slate-900 dark:text-white">{displayedItems.reduce((s, i) => s + i.stockQuantity, 0)}</strong></span>
            <span>Total Filtered Capital: <strong className="text-rose-600 dark:text-rose-400">{formatCurrency(displayedItems.reduce((s, i) => s + i.totalValue, 0))}</strong></span>
          </div>
        </div>
      </div>

      {/* Voice Commands Cheat Sheet Modal */}
      {showVoiceHelpModal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/30">
                  <Mic size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                    Voice Shelf Inspection Cheat Sheet
                  </h3>
                  <p className="text-xs text-slate-500">Natural voice commands for hands-free pharmacy audits</p>
                </div>
              </div>
              <button
                onClick={() => setShowVoiceHelpModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs max-h-[65vh] overflow-y-auto pr-1">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-2xl">
                <p className="font-bold text-indigo-900 dark:text-indigo-200 text-xs">
                  Tip: Speak naturally in English or Hindi (e.g., "पंद्रह यूनिट्स", "Count is 15"). The system updates Firestore live.
                </p>
              </div>

              {/* Command Categories */}
              <div className="space-y-3">
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5 border border-slate-200 dark:border-slate-700/60">
                  <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
                    1. Stock Count Dictation
                  </span>
                  <ul className="mt-2 space-y-1.5 text-slate-700 dark:text-slate-300">
                    <li>• <code className="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">"Count is 18"</code> or <code className="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">"Stock 25"</code> - Sets exact quantity</li>
                    <li>• <code className="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">"Add 5"</code> / <code className="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">"Subtract 2"</code> - Quick adjustments</li>
                    <li>• <code className="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">"Out of stock"</code> / <code className="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">"Zero units"</code> - Sets count to 0</li>
                    <li>• <code className="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">"Verified"</code> / <code className="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">"Confirm count"</code> - Confirms shelf matching</li>
                  </ul>
                </div>

                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5 border border-slate-200 dark:border-slate-700/60">
                  <span className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 tracking-wider">
                    2. Expiry Date Dictation
                  </span>
                  <ul className="mt-2 space-y-1.5 text-slate-700 dark:text-slate-300">
                    <li>• <code className="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">"Expiry December 2026"</code> or <code className="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">"Expires 12/26"</code></li>
                    <li>• <code className="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">"Expiry date 15 August 2027"</code></li>
                  </ul>
                </div>

                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5 border border-slate-200 dark:border-slate-700/60">
                  <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
                    3. Shelf Walk Navigation
                  </span>
                  <ul className="mt-2 space-y-1.5 text-slate-700 dark:text-slate-300">
                    <li>• <code className="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">"Next medicine"</code> / <code className="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">"Aage chalo"</code></li>
                    <li>• <code className="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">"Previous medicine"</code> / <code className="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">"Peeche jao"</code></li>
                    <li>• <code className="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">"Find Dolo"</code> / <code className="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">"Search Azithromycin"</code></li>
                  </ul>
                </div>

                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5 border border-slate-200 dark:border-slate-700/60">
                  <span className="text-[10px] font-black uppercase text-violet-600 dark:text-violet-400 tracking-wider">
                    4. Filtering & System Controls
                  </span>
                  <ul className="mt-2 space-y-1.5 text-slate-700 dark:text-slate-300">
                    <li>• <code className="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">"Show expired"</code> / <code className="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">"Show critical"</code> / <code className="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">"Show all"</code></li>
                    <li>• <code className="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">"Reorder medicine"</code> / <code className="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">"Reorder in Inventory"</code> / <code className="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">"Reorder in POS"</code></li>
                    <li>• <code className="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">"Return memo"</code> - Drafts distributor debit note</li>
                    <li>• <code className="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">"Mute voice"</code> / <code className="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">"Unmute voice"</code> / <code className="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">"Stop audit"</code></li>
                  </ul>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowVoiceHelpModal(false)}
                  className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-500 py-3 font-black text-white shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  Got It, Let's Audit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Return Memo Draft Modal */}
      {selectedBatchForReturn && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Supplier Return & Debit Claim Memo
                  </h3>
                  <p className="text-[11px] text-slate-500">Draft credit debit note for upcoming/expired stock</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedBatchForReturn(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3.5 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Medicine:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{selectedBatchForReturn.medicineName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Batch No:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{selectedBatchForReturn.batchNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Expiry Date:</span>
                  <span className="font-bold text-rose-600">{selectedBatchForReturn.expiryDate} ({selectedBatchForReturn.daysLeft <= 0 ? 'Expired' : `${selectedBatchForReturn.daysLeft} days left`})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Quantity to Return:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{selectedBatchForReturn.stockQuantity} units</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Claim Amount:</span>
                  <span className="font-black text-rose-600 text-sm">₹{selectedBatchForReturn.totalValue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Distributor:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{selectedBatchForReturn.supplier || 'Primary Wholesaler'}</span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-amber-900 dark:text-amber-200">
                <p className="font-bold text-[11px]">Regulatory Return Policy:</p>
                <p className="text-[10px] mt-0.5">Under Indian Pharma trade rules, near-expiry formulations (within 60 days) or expired formulations are eligible for credit debit notes or 1:1 replacement with fresh batch stock.</p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    exportExpiryReportCSV([selectedBatchForReturn]);
                    setSelectedBatchForReturn(null);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-blue-600 py-2.5 font-bold text-white shadow hover:opacity-90"
                >
                  <Download size={14} />
                  <span>Export Return Voucher</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedBatchForReturn(null)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 font-bold text-slate-700 dark:text-slate-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Streamlined Procurement Reorder Modal */}
      {selectedBatchForReorder && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 shadow-xs">
                  <ShoppingCart size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Streamline Procurement Reorder
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Pre-select medicine to immediately create a purchase order or restock batch
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBatchForReorder(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Expiring Item Details Card */}
            <div className="mt-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-100 dark:border-slate-800 space-y-2.5">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    {selectedBatchForReorder.medicineName}
                  </h4>
                  {selectedBatchForReorder.genericName && (
                    <p className="text-[11px] text-slate-500 italic">
                      {selectedBatchForReorder.genericName}
                    </p>
                  )}
                </div>
                <span className="rounded-lg bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 px-2.5 py-0.5 text-[11px] font-black border border-indigo-200 dark:border-indigo-800">
                  {formatCurrency(selectedBatchForReorder.rate)} / unit
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Expiring Batch</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedBatchForReorder.batchNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Shelf Horizon</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    {selectedBatchForReorder.daysLeft <= 0 ? 'Expired' : `${selectedBatchForReorder.daysLeft} days left`} ({selectedBatchForReorder.expiryDate})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Units to Replenish</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{selectedBatchForReorder.stockQuantity} units</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Primary Distributor</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                    {selectedBatchForReorder.supplier || 'Main Distributor'}
                  </span>
                </div>
              </div>
            </div>

            {/* Target Module Action Options */}
            <div className="mt-5 space-y-3">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Choose destination module to pre-select this medicine:
              </p>

              {/* Option 1: Inventory Module (Recommended) */}
              <button
                type="button"
                id="reorder-target-inventory"
                onClick={() => handleExecuteReorder('inventory', selectedBatchForReorder)}
                className="group w-full text-left p-4 rounded-2xl border-2 border-indigo-300 dark:border-indigo-700/80 bg-indigo-50/70 hover:bg-indigo-100/80 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/80 transition-all cursor-pointer shadow-xs hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30 group-hover:scale-105 transition-transform">
                      <Package size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-indigo-950 dark:text-indigo-100">
                          Inventory Module
                        </span>
                        <span className="rounded-md bg-indigo-600 text-white px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider">
                          Recommended
                        </span>
                      </div>
                      <p className="text-xs text-indigo-800/90 dark:text-indigo-300/90 mt-0.5">
                        Pre-selects {selectedBatchForReorder.medicineName} and opens Add Restock Batch form with suggested replenishment quantities
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={18} className="text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform shrink-0" />
                </div>
              </button>

              {/* Option 2: POS Module */}
              <button
                type="button"
                id="reorder-target-pos"
                onClick={() => handleExecuteReorder('pos', selectedBatchForReorder)}
                className="group w-full text-left p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/60 transition-all cursor-pointer shadow-xs hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-white dark:bg-slate-700 shadow-md group-hover:scale-105 transition-transform">
                      <ShoppingCart size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900 dark:text-slate-100">
                          POS Counter & Billing
                        </span>
                        <span className="rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider">
                          Quick Reorder
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Pre-selects {selectedBatchForReorder.medicineName} in search and automatically adds it to the active register cart
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={18} className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 group-hover:translate-x-1 transition-transform shrink-0" />
                </div>
              </button>
            </div>

            {/* Footer */}
            <div className="mt-5 flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-400">
                Navigation automatically prepares the medicine for restock
              </span>
              <button
                type="button"
                onClick={() => setSelectedBatchForReorder(null)}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-3 py-1.5 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="p-6 max-h-[88vh] overflow-y-auto">
        {content}
      </div>
    );
  }

  return content;
};

export default ExpiryAuditReport;
