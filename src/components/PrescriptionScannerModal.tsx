import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Sparkles, 
  FileText, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart, 
  User, 
  Building, 
  Calendar, 
  Stethoscope, 
  Info,
  CheckSquare,
  Square,
  ArrowRight,
  HelpCircle,
  Eye,
  Check
} from 'lucide-react';
import { Medicine, SaleItem } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export interface ParsedDoctor {
  name: string;
  qualification?: string;
  clinicOrHospital?: string;
  registrationNumber?: string;
  date?: string;
}

export interface ParsedPatient {
  name: string;
  age?: string;
  gender?: string;
  diagnosisOrSymptoms?: string;
}

export interface ParsedMedicineItem {
  id: string;
  selected: boolean;
  medicineName: string;
  strength?: string;
  form?: string;
  dosage?: string;
  timing?: string;
  duration?: string;
  suggestedQuantity: number;
  estimatedUnitPrice: number;
  matchedInventoryId?: string | null;
  matchedInventoryName?: string | null;
  matchedStock?: number;
  instructions?: string;
}

export interface ParsedPrescriptionResult {
  doctor: ParsedDoctor;
  patient: ParsedPatient;
  medicines: ParsedMedicineItem[];
  generalAdvice?: string;
  followUp?: string;
  confidenceScore?: number;
  rawHandwritingDecipheredText?: string;
}

interface PrescriptionScannerModalProps {
  onClose: () => void;
  onImportToCart?: (items: SaleItem[], patientInfo?: { name: string; mobile?: string }) => void;
  onSaveToPatientNotes?: (prescriptionData: ParsedPrescriptionResult, rawImage?: string) => void;
  availableMedicines?: Medicine[];
  patientContextName?: string;
}

// Demo Prescriptions for instant 1-click testing
const DEMO_PRESCRIPTIONS = [
  {
    id: 'demo-fever',
    title: 'General OPD (Fever, Antibiotic & GI)',
    doctor: 'Dr. Alok Verma, MD (Med)',
    clinic: 'Apollo Lifecare Clinic',
    patient: 'Rahul Sharma (32M)',
    medicines: [
      { name: 'Paracetamol 650mg', dosage: '1-0-1 x 5d', qty: 10, rate: 3.50, form: 'Tablet', instructions: 'After meals with water' },
      { name: 'Amoxicillin & Clav 625mg', dosage: '1-0-1 x 5d', qty: 10, rate: 18.50, form: 'Tablet', instructions: 'Complete 5-day course' },
      { name: 'Pantoprazole 40mg', dosage: '1-0-0 x 5d', qty: 5, rate: 8.00, form: 'Tablet', instructions: 'Empty stomach 30m before breakfast' },
      { name: 'Levocetirizine 5mg', dosage: '0-0-1 x 3d', qty: 3, rate: 4.20, form: 'Tablet', instructions: 'Bedtime dose' }
    ],
    advice: 'Drink warm water, take steam inhalation twice daily, rest well.'
  },
  {
    id: 'demo-cardio',
    title: 'Cardiology & Diabetes Refill',
    doctor: 'Dr. Priya Mehta, DM (Cardio)',
    clinic: 'City Heart & Vascular Institute',
    patient: 'Suresh Patel (58M)',
    medicines: [
      { name: 'Telmisartan 40mg', dosage: '1-0-0 x 30d', qty: 30, rate: 12.00, form: 'Tablet', instructions: 'Morning after breakfast' },
      { name: 'Metformin 500mg SR', dosage: '1-0-1 x 30d', qty: 60, rate: 5.50, form: 'Tablet', instructions: 'Immediately after meals' },
      { name: 'Atorvastatin 20mg', dosage: '0-0-1 x 30d', qty: 30, rate: 14.20, form: 'Tablet', instructions: 'At bedtime' },
      { name: 'Ecosprin 75mg', dosage: '0-1-0 x 30d', qty: 30, rate: 2.10, form: 'Tablet', instructions: 'After lunch with water' }
    ],
    advice: 'Low salt, low sugar diet. Daily 30-minute brisk walk. Monthly BP & HbA1c check.'
  },
  {
    id: 'demo-paediatric',
    title: 'Pediatric (Cold, Cough & Infection)',
    doctor: 'Dr. Rajesh Gupta, MD (Pediatrics)',
    clinic: 'Child Care Hospital',
    patient: 'Aarav Kumar (4Y)',
    medicines: [
      { name: 'Paracetamol Paediatric Suspension 250mg/5ml', dosage: '5 ml TDS x 3d', qty: 1, rate: 45.00, form: 'Syrup', instructions: 'Give with calibrated dropper' },
      { name: 'Amoxicillin Dry Syrup 125mg', dosage: '5 ml BD x 5d', qty: 1, rate: 65.00, form: 'Syrup', instructions: 'Shake well before use. Reconstitute with boiled cool water.' },
      { name: 'Cetirizine Syrup 5mg/5ml', dosage: '2.5 ml HS x 5d', qty: 1, rate: 38.00, form: 'Syrup', instructions: 'Night time only' }
    ],
    advice: 'Keep child warm, offer plenty of lukewarm oral fluids.'
  }
];

export const PrescriptionScannerModal: React.FC<PrescriptionScannerModalProps> = ({
  onClose,
  onImportToCart,
  onSaveToPatientNotes,
  availableMedicines = [],
  patientContextName
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'demo'>('camera');
  const [cameraState, setCameraState] = useState<'initializing' | 'active' | 'error' | 'denied'>('initializing');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<ParsedPrescriptionResult | null>(null);
  const [selectedImageName, setSelectedImageName] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize camera stream
  const startCamera = async (targetFacing: 'environment' | 'user') => {
    setCameraState('initializing');
    setErrorMessage(null);

    // Stop existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: targetFacing,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            await playPromise;
          }
        } catch (playErr: any) {
          // Play request might be cancelled if the modal is closed or tab is switched before playback begins
          if (playErr?.name !== 'AbortError') {
            console.warn("Video playback notice:", playErr);
          }
        }
      }
      setCameraState('active');
    } catch (err: any) {
      console.warn("Camera start warning:", err);
      const errStr = String(err).toLowerCase();
      if (errStr.includes('notallowed') || errStr.includes('permission') || errStr.includes('denied')) {
        setCameraState('denied');
        setErrorMessage("Camera access permission was denied. Please allow camera access in browser settings or upload an image.");
      } else {
        setCameraState('error');
        setErrorMessage("Camera device unavailable. You can upload a photo of the prescription or try a demo prescription.");
      }
    }
  };

  useEffect(() => {
    if (activeTab === 'camera' && !capturedImage && !parsedResult) {
      startCamera(facingMode);
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [activeTab, facingMode, capturedImage, parsedResult]);

  // Capture frame from live video
  const handleSnapPhoto = () => {
    if (!videoRef.current || cameraState !== 'active') return;

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

      // Stop camera
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      setCapturedImage(dataUrl);
      setSelectedImageName(`Prescription_${new Date().toISOString().slice(0, 10)}.jpg`);
      processPrescriptionImage(dataUrl, 'image/jpeg');
    } catch (e) {
      console.error("Capture photo error:", e);
      setErrorMessage("Could not capture image from camera stream.");
    }
  };

  // Upload file handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedImageName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setCapturedImage(dataUrl);
        processPrescriptionImage(dataUrl, file.type || 'image/jpeg');
      }
    };
    reader.readAsDataURL(file);
  };

  // Process Prescription Image with AI endpoint
  const processPrescriptionImage = async (base64Img: string, mimeType: string) => {
    setIsAnalyzing(true);
    setErrorMessage(null);
    setParsedResult(null);

    // Progress simulation steps
    setAnalysisStep("📸 Preprocessing & Enhancing Medical Image...");
    const t1 = setTimeout(() => setAnalysisStep("🧠 Deciphering Doctor's Handwriting & Rx Abbreviations..."), 900);
    const t2 = setTimeout(() => setAnalysisStep("🧪 Extracting Medicine Names, Strengths, Dosages (1-0-1) & Durations..."), 1900);
    const t3 = setTimeout(() => setAnalysisStep("📦 Matching against Pharmacy Inventory & Calculating Quantities..."), 2900);

    try {
      // Prepare simplified inventory list for matching
      const inventoryCatalog = availableMedicines.map(m => ({
        id: m.id,
        name: m.name,
        genericName: m.genericName,
        salt: m.salt,
        rate: m.rate,
        stockQuantity: m.stockQuantity
      }));

      const res = await fetch('/api/ai/parse-prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Img,
          mimeType: mimeType || 'image/jpeg',
          inventoryList: inventoryCatalog
        })
      });

      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);

      if (!res.ok) {
        throw new Error(`Server returned error ${res.status}`);
      }

      const data = await res.json();
      
      // Format items with selection and IDs
      const formattedMedicines: ParsedMedicineItem[] = (data.medicines || []).map((m: any, idx: number) => {
        // Find matching medicine in available medicines if not already matched
        let matched = availableMedicines.find(inv => inv.id === m.matchedInventoryId);
        if (!matched && m.medicineName) {
          matched = availableMedicines.find(inv => 
            inv.name.toLowerCase().includes(m.medicineName.toLowerCase()) ||
            (inv.genericName && inv.genericName.toLowerCase().includes(m.medicineName.toLowerCase())) ||
            (inv.salt && inv.salt.toLowerCase().includes(m.medicineName.toLowerCase()))
          );
        }

        return {
          id: `med-${Date.now()}-${idx}`,
          selected: true,
          medicineName: m.medicineName || `Medicine #${idx + 1}`,
          strength: m.strength || '',
          form: m.form || 'Tablet',
          dosage: m.dosage || '1-0-1',
          timing: m.timing || 'After Meals',
          duration: m.duration || '5 Days',
          suggestedQuantity: Number(m.suggestedQuantity) || 10,
          estimatedUnitPrice: matched ? matched.rate : (Number(m.estimatedUnitPrice) || 10),
          matchedInventoryId: matched ? matched.id : m.matchedInventoryId || null,
          matchedInventoryName: matched ? matched.name : m.matchedInventoryName || null,
          matchedStock: matched ? matched.stockQuantity : m.matchedStock,
          instructions: m.instructions || ''
        };
      });

      setParsedResult({
        doctor: data.doctor || { name: 'Doctor' },
        patient: {
          name: patientContextName || data.patient?.name || 'Walk-in Patient',
          age: data.patient?.age || '',
          gender: data.patient?.gender || '',
          diagnosisOrSymptoms: data.patient?.diagnosisOrSymptoms || ''
        },
        medicines: formattedMedicines,
        generalAdvice: data.generalAdvice,
        followUp: data.followUp,
        confidenceScore: data.confidenceScore || 95,
        rawHandwritingDecipheredText: data.rawHandwritingDecipheredText
      });
    } catch (err: any) {
      console.error("Prescription parsing error:", err);
      setErrorMessage(err?.message || "Failed to parse prescription. You can try a demo prescription or retry.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Generate Canvas Prescription for Demo Presets
  const handleSelectDemo = (demo: typeof DEMO_PRESCRIPTIONS[0]) => {
    // Generate a realistic synthetic Rx canvas image
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1200;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border & Letterhead
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    // Header
    ctx.fillStyle = '#1e3a8a';
    ctx.font = 'bold 30px serif';
    ctx.fillText(demo.doctor, 50, 80);

    ctx.fillStyle = '#475569';
    ctx.font = '18px sans-serif';
    ctx.fillText(demo.clinic, 50, 115);
    ctx.fillText('Reg. No: MCI-2024-8991 | Ph: +91 98765 43210', 50, 140);

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 160);
    ctx.lineTo(850, 160);
    ctx.stroke();

    // Patient Info
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`Patient: ${demo.patient}`, 50, 200);
    ctx.font = '18px sans-serif';
    ctx.fillText(`Date: ${new Date().toLocaleDateString('en-IN')}`, 650, 200);

    ctx.beginPath();
    ctx.moveTo(50, 220);
    ctx.lineTo(850, 220);
    ctx.stroke();

    // Rx Symbol
    ctx.fillStyle = '#2563eb';
    ctx.font = 'bold 44px serif';
    ctx.fillText('℞', 50, 280);

    // Medicines
    let yPos = 330;
    demo.medicines.forEach((med, idx) => {
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(`${idx + 1}. ${med.name} (${med.form})`, 70, yPos);

      ctx.fillStyle = '#334155';
      ctx.font = 'italic 18px sans-serif';
      ctx.fillText(`Dosage: ${med.dosage} • Qty: ${med.qty} units`, 90, yPos + 28);
      ctx.font = '16px sans-serif';
      ctx.fillText(`Note: ${med.instructions}`, 90, yPos + 52);

      yPos += 90;
    });

    // Advice
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Advice / Instructions:', 50, yPos + 20);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText(demo.advice, 50, yPos + 50);

    // Doctor Signature
    ctx.fillStyle = '#1e3a8a';
    ctx.font = 'italic 24px cursive';
    ctx.fillText('Dr. Signature', 650, canvas.height - 100);
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(demo.doctor, 650, canvas.height - 70);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedImage(dataUrl);
    setSelectedImageName(`${demo.title}.jpg`);
    processPrescriptionImage(dataUrl, 'image/jpeg');
  };

  // Medicine Item Selection Toggle
  const toggleMedicineSelect = (id: string) => {
    if (!parsedResult) return;
    setParsedResult({
      ...parsedResult,
      medicines: parsedResult.medicines.map(m => 
        m.id === id ? { ...m, selected: !m.selected } : m
      )
    });
  };

  // Select/Deselect All
  const toggleSelectAll = () => {
    if (!parsedResult) return;
    const allSelected = parsedResult.medicines.every(m => m.selected);
    setParsedResult({
      ...parsedResult,
      medicines: parsedResult.medicines.map(m => ({ ...m, selected: !allSelected }))
    });
  };

  // Quantity Change
  const handleQuantityChange = (id: string, delta: number) => {
    if (!parsedResult) return;
    setParsedResult({
      ...parsedResult,
      medicines: parsedResult.medicines.map(m => {
        if (m.id === id) {
          const next = Math.max(1, m.suggestedQuantity + delta);
          return { ...m, suggestedQuantity: next };
        }
        return m;
      })
    });
  };

  // Direct Quantity Input
  const handleQuantityInput = (id: string, val: number) => {
    if (!parsedResult) return;
    setParsedResult({
      ...parsedResult,
      medicines: parsedResult.medicines.map(m => 
        m.id === id ? { ...m, suggestedQuantity: Math.max(1, val || 1) } : m
      )
    });
  };

  // Delete Item
  const handleDeleteItem = (id: string) => {
    if (!parsedResult) return;
    setParsedResult({
      ...parsedResult,
      medicines: parsedResult.medicines.filter(m => m.id !== id)
    });
  };

  // Add Custom Medication Row
  const handleAddCustomRow = () => {
    if (!parsedResult) return;
    const newRow: ParsedMedicineItem = {
      id: `med-${Date.now()}`,
      selected: true,
      medicineName: 'Additional Medicine / Salt',
      strength: '500 mg',
      form: 'Tablet',
      dosage: '1-0-1',
      timing: 'After Food',
      duration: '5 Days',
      suggestedQuantity: 10,
      estimatedUnitPrice: 10.00,
      instructions: 'Take as directed'
    };
    setParsedResult({
      ...parsedResult,
      medicines: [...parsedResult.medicines, newRow]
    });
  };

  // Calculated Totals
  const selectedMedicines = parsedResult?.medicines.filter(m => m.selected) || [];
  const totalOrderAmount = selectedMedicines.reduce((sum, m) => sum + (m.estimatedUnitPrice * m.suggestedQuantity), 0);
  const totalUnits = selectedMedicines.reduce((sum, m) => sum + m.suggestedQuantity, 0);

  // Import to Cart
  const handleImportToCart = () => {
    if (!parsedResult || selectedMedicines.length === 0) return;

    const cartItems: SaleItem[] = selectedMedicines.map(m => {
      // If matched with real inventory ID, use that, else create a custom item ID
      return {
        medicineId: m.matchedInventoryId || `rx-custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: m.matchedInventoryName || m.medicineName,
        quantity: m.suggestedQuantity,
        price: m.estimatedUnitPrice
      };
    });

    if (onImportToCart) {
      onImportToCart(cartItems, {
        name: parsedResult.patient.name,
      });
    }

    if (onSaveToPatientNotes) {
      onSaveToPatientNotes(parsedResult, capturedImage || undefined);
    }

    onClose();
  };

  // Save to Patient Record Only
  const handleSaveToPatientOnly = () => {
    if (!parsedResult) return;
    if (onSaveToPatientNotes) {
      onSaveToPatientNotes(parsedResult, capturedImage || undefined);
    }
    onClose();
  };

  // Reset Scanner
  const handleReset = () => {
    setCapturedImage(null);
    setParsedResult(null);
    setErrorMessage(null);
    setActiveTab('camera');
    startCamera(facingMode);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[94vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-4 sm:p-5 bg-gradient-to-r from-blue-50/70 via-slate-50 to-indigo-50/50 dark:from-slate-900 dark:via-slate-800/80 dark:to-indigo-950/30">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md">
              <Stethoscope size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Doctor's Prescription AI Scanner
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-extrabold text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                  <Sparkles size={11} /> Gemini Vision OCR
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Snap doctor prescription photo, decipher handwriting, and convert into POS order list
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {parsedResult && (
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <RefreshCw size={13} />
                <span>Scan Another</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          
          {/* STEP 1: CAPTURE / UPLOAD / DEMO (When not parsed yet) */}
          {!parsedResult && (
            <div className="space-y-4">
              
              {/* Tab Selector */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('camera')}
                    className={cn(
                      "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      activeTab === 'camera' 
                        ? "bg-blue-600 text-white shadow-sm" 
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    )}
                  >
                    <Camera size={14} />
                    <span>Live Camera</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('upload')}
                    className={cn(
                      "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      activeTab === 'upload' 
                        ? "bg-blue-600 text-white shadow-sm" 
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    )}
                  >
                    <Upload size={14} />
                    <span>Upload Image</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('demo')}
                    className={cn(
                      "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      activeTab === 'demo' 
                        ? "bg-blue-600 text-white shadow-sm" 
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    )}
                  >
                    <Sparkles size={14} className="text-amber-500" />
                    <span>Sample Rx (Instant Test)</span>
                  </button>
                </div>

                {activeTab === 'camera' && (
                  <button
                    type="button"
                    onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                    title="Flip camera"
                  >
                    <RefreshCw size={13} />
                    <span>Flip Lens</span>
                  </button>
                )}
              </div>

              {/* CAMERA TAB */}
              {activeTab === 'camera' && (
                <div className="relative rounded-2xl bg-slate-950 overflow-hidden min-h-[320px] flex flex-col items-center justify-center border border-slate-800 shadow-inner">
                  {/* Live Video Feed */}
                  <video 
                    ref={videoRef} 
                    playsInline 
                    muted 
                    className={cn(
                      "w-full max-h-[380px] object-cover transition-opacity duration-300",
                      cameraState === 'active' ? "opacity-100" : "opacity-0"
                    )}
                  />

                  {/* Alignment Frame & Laser overlay */}
                  {cameraState === 'active' && !isAnalyzing && (
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                      <div className="relative w-full max-w-md h-52 sm:h-64 rounded-2xl border-2 border-dashed border-blue-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] flex items-center justify-center">
                        {/* Scanning beam animation */}
                        <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_12px_#3b82f6] animate-pulse top-1/2 -translate-y-1/2" />
                        
                        {/* Corner accents */}
                        <div className="absolute top-0 left-0 h-5 w-5 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
                        <div className="absolute top-0 right-0 h-5 w-5 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
                        <div className="absolute bottom-0 left-0 h-5 w-5 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
                        <div className="absolute bottom-0 right-0 h-5 w-5 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />

                        <div className="text-center p-3 bg-black/60 rounded-xl backdrop-blur-xs border border-white/10">
                          <p className="text-xs font-bold text-white">Align Doctor's Prescription Within Box</p>
                          <p className="text-[10px] text-slate-300">Ensure good lighting and keep camera steady</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Initializing State */}
                  {cameraState === 'initializing' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 p-6 bg-slate-900/90">
                      <RefreshCw size={32} className="animate-spin text-blue-500" />
                      <p className="text-sm font-bold">Initializing Prescription Camera Feed...</p>
                      <p className="text-xs text-slate-400 text-center max-w-sm">
                        Requesting browser video permissions to capture doctor slip.
                      </p>
                    </div>
                  )}

                  {/* Camera Error / Permission Denied */}
                  {(cameraState === 'error' || cameraState === 'denied') && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 p-6 bg-slate-900/95 text-center">
                      <AlertCircle size={36} className="text-amber-400" />
                      <p className="text-sm font-bold text-amber-300">Camera Feed Not Available</p>
                      <p className="text-xs text-slate-300 max-w-md">{errorMessage}</p>
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => startCamera(facingMode)}
                          className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
                        >
                          <RefreshCw size={13} />
                          <span>Retry Camera</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('upload')}
                          className="rounded-xl bg-slate-800 border border-slate-700 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Upload size={13} />
                          <span>Upload File Instead</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Camera Snap Controls */}
                  {cameraState === 'active' && !isAnalyzing && (
                    <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-4 z-20">
                      <button
                        type="button"
                        onClick={handleSnapPhoto}
                        className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-xl hover:shadow-blue-500/25 active:scale-95 transition-all cursor-pointer border-2 border-white/30"
                      >
                        <Camera size={18} className="group-hover:scale-110 transition-transform" />
                        <span>Capture & Parse with AI</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* UPLOAD TAB */}
              {activeTab === 'upload' && (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-all group"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 mb-4 group-hover:scale-110 transition-transform shadow-sm">
                    <Upload size={28} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Click to Upload Doctor's Prescription Photo
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                    Supports JPG, PNG, WEBP files or camera roll photos of doctor slips, OPD sheets, and discharge notes.
                  </p>
                  <span className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md group-hover:bg-blue-700 transition-colors">
                    Browse Document Photo
                  </span>

                  <input 
                    ref={fileInputRef} 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileUpload} 
                    className="hidden" 
                  />
                </div>
              )}

              {/* DEMO / TEST SAMPLES TAB */}
              {activeTab === 'demo' && (
                <div className="space-y-3">
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3.5 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2.5">
                    <Info size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-900 dark:text-amber-200">
                      <strong>Instant Testing Mode:</strong> Select any realistic doctor prescription below to test handwriting OCR, dosage calculations, and inventory mapping without needing physical paper on hand.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {DEMO_PRESCRIPTIONS.map((demo) => (
                      <div
                        key={demo.id}
                        onClick={() => handleSelectDemo(demo)}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 p-4 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded-md">
                              {demo.medicines.length} Medicines
                            </span>
                            <Sparkles size={13} className="text-amber-500" />
                          </div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition-colors">
                            {demo.title}
                          </h4>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                            {demo.doctor}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-400">
                            Patient: {demo.patient}
                          </p>

                          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 space-y-1">
                            {demo.medicines.slice(0, 2).map((m, idx) => (
                              <div key={idx} className="text-[10px] text-slate-600 dark:text-slate-400 truncate">
                                • {m.name} ({m.dosage})
                              </div>
                            ))}
                            {demo.medicines.length > 2 && (
                              <div className="text-[10px] font-semibold text-blue-500">
                                +{demo.medicines.length - 2} more items...
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="mt-3 w-full rounded-lg bg-blue-50 dark:bg-blue-950/60 py-1.5 text-center text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-2xs"
                        >
                          Parse this Rx ➔
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ANALYZING OVERLAY */}
              {isAnalyzing && (
                <div className="rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-gradient-to-b from-blue-50/80 to-indigo-50/80 dark:from-slate-900 dark:to-blue-950/40 p-8 flex flex-col items-center justify-center text-center space-y-4 shadow-lg">
                  <div className="relative">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xl animate-pulse">
                      <Stethoscope size={30} />
                    </div>
                    <RefreshCw size={24} className="animate-spin text-indigo-500 absolute -top-2 -right-2" />
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Gemini Vision Clinical Parser Active
                    </h3>
                    <p className="text-xs font-bold text-blue-700 dark:text-blue-300 mt-1 animate-fade-in">
                      {analysisStep || "Deciphering Doctor's Medical Handwriting..."}
                    </p>
                  </div>

                  <div className="w-full max-w-xs bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full animate-indeterminate" />
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm">
                    Translating Latin medical abbreviations (Rx, OD, BD, TDS, SOS, PC, AC) and correlating with pharmacy stock.
                  </p>
                </div>
              )}

              {/* Error Message Toast */}
              {errorMessage && !isAnalyzing && (
                <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/50 p-4 flex items-start gap-3">
                  <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-rose-900 dark:text-rose-200">Processing Error</p>
                    <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">{errorMessage}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: PARSED RESULTS & ORDER LIST BUILDER */}
          {parsedResult && (
            <div className="space-y-5">
              
              {/* Doctor & Patient Metadata Banner */}
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Doctor Details */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                    <Stethoscope size={14} />
                    <span>Prescribing Physician</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {parsedResult.doctor.name || 'Medical Doctor'}
                  </h4>
                  <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
                    {parsedResult.doctor.qualification && <p>{parsedResult.doctor.qualification}</p>}
                    {parsedResult.doctor.clinicOrHospital && (
                      <p className="flex items-center gap-1">
                        <Building size={12} /> {parsedResult.doctor.clinicOrHospital}
                      </p>
                    )}
                    {parsedResult.doctor.date && (
                      <p className="flex items-center gap-1">
                        <Calendar size={12} /> Date: {parsedResult.doctor.date}
                      </p>
                    )}
                  </div>
                </div>

                {/* Patient Details */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                      <User size={14} />
                      <span>Patient Details</span>
                    </div>
                    {parsedResult.confidenceScore && (
                      <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                        <CheckCircle2 size={11} /> {parsedResult.confidenceScore}% AI Confidence
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {parsedResult.patient.name || 'Walk-in Patient'}
                    {parsedResult.patient.age && ` • ${parsedResult.patient.age}`}
                    {parsedResult.patient.gender && ` (${parsedResult.patient.gender})`}
                  </h4>
                  {parsedResult.patient.diagnosisOrSymptoms && (
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      <strong>Clinical Notes / Diagnosis:</strong> {parsedResult.patient.diagnosisOrSymptoms}
                    </p>
                  )}
                </div>
              </div>

              {/* Medicines Order List Table */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                
                {/* Table Header Controls */}
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 p-4 bg-slate-50/70 dark:bg-slate-800/40">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-blue-600 cursor-pointer"
                    >
                      {parsedResult.medicines.every(m => m.selected) ? (
                        <CheckSquare size={16} className="text-blue-600" />
                      ) : (
                        <Square size={16} className="text-slate-400" />
                      )}
                      <span>Select All ({selectedMedicines.length}/{parsedResult.medicines.length})</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAddCustomRow}
                      className="rounded-lg bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>Add Medicine</span>
                    </button>
                  </div>
                </div>

                {/* Items List */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {parsedResult.medicines.map((item) => (
                    <div 
                      key={item.id}
                      className={cn(
                        "p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                        item.selected ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-900/40 opacity-60"
                      )}
                    >
                      {/* Left: Checkbox + Medicine Info */}
                      <div className="flex items-start gap-3 flex-1">
                        <button
                          type="button"
                          onClick={() => toggleMedicineSelect(item.id)}
                          className="mt-1 text-blue-600 cursor-pointer"
                        >
                          {item.selected ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-400" />}
                        </button>

                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                              {item.medicineName}
                            </h4>
                            {item.strength && (
                              <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                                {item.strength}
                              </span>
                            )}
                            <span className="rounded-md bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                              {item.form || 'Tablet'}
                            </span>

                            {/* Inventory Stock Matching Badge */}
                            {item.matchedInventoryId ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                <Check size={11} /> Matched Stock ({item.matchedStock ?? 0} avail)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                                Direct Custom Item
                              </span>
                            )}
                          </div>

                          {/* Dosage & Instructions */}
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                            <span className="font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded">
                              Dosage: {item.dosage}
                            </span>
                            {item.timing && <span>• {item.timing}</span>}
                            {item.duration && <span>• {item.duration}</span>}
                          </div>

                          {item.instructions && (
                            <p className="text-[11px] text-slate-500 italic">
                              Note: {item.instructions}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Quantity Stepper & Price */}
                      <div className="flex items-center justify-between sm:justify-end gap-4 pl-8 sm:pl-0">
                        {/* Quantity Stepper */}
                        <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-800">
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item.id, -1)}
                            className="px-2.5 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                          >
                            <Minus size={13} />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.suggestedQuantity}
                            onChange={(e) => handleQuantityInput(item.id, parseInt(e.target.value))}
                            className="w-12 text-center text-xs font-bold bg-transparent outline-none py-1 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item.id, 1)}
                            className="px-2.5 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                          >
                            <Plus size={13} />
                          </button>
                        </div>

                        {/* Price & Subtotal */}
                        <div className="text-right min-w-[70px]">
                          <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                            {formatCurrency(item.estimatedUnitPrice * item.suggestedQuantity)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            @{formatCurrency(item.estimatedUnitPrice)}/ea
                          </div>
                        </div>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* General Clinical Advice */}
                {parsedResult.generalAdvice && (
                  <div className="border-t border-slate-100 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-800/30 text-xs">
                    <p className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Info size={14} className="text-blue-500" />
                      <span>Doctor's General Dietary & Lifestyle Advice:</span>
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 mt-1 pl-5">
                      {parsedResult.generalAdvice}
                    </p>
                  </div>
                )}
              </div>

              {/* Deciphered Handwriting Transcription (Expandable) */}
              {parsedResult.rawHandwritingDecipheredText && (
                <details className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3.5 text-xs">
                  <summary className="font-bold text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-1.5">
                    <FileText size={14} className="text-indigo-500" />
                    <span>View Raw Deciphered Doctor's Handwriting Transcript</span>
                  </summary>
                  <pre className="mt-2.5 p-3 rounded-lg bg-slate-100 dark:bg-slate-900 font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {parsedResult.rawHandwritingDecipheredText}
                  </pre>
                </details>
              )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-100 dark:border-slate-800 p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          {parsedResult ? (
            <>
              <div className="flex items-center gap-4 text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>Selected: <strong className="text-blue-600 dark:text-blue-400">{selectedMedicines.length}</strong> items ({totalUnits} units)</span>
                <span>Total Est: <strong className="text-emerald-600 dark:text-emerald-400 text-sm">{formatCurrency(totalOrderAmount)}</strong></span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {onSaveToPatientNotes && (
                  <button
                    type="button"
                    onClick={handleSaveToPatientOnly}
                    className="flex-1 sm:flex-none rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    Save to Patient Record
                  </button>
                )}

                {onImportToCart && (
                  <button
                    type="button"
                    onClick={handleImportToCart}
                    disabled={selectedMedicines.length === 0}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg hover:shadow-blue-500/25 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <ShoppingCart size={15} />
                    <span>Import {selectedMedicines.length} Items into POS Cart ➔</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="w-full flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" />
                <span>Powered by Multimodal Gemini Vision API</span>
              </span>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default PrescriptionScannerModal;
