import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useLanguage } from '../context/LanguageContext';
import { 
  Camera, 
  RefreshCw, 
  Volume2, 
  VolumeX, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  Keyboard, 
  Search, 
  Upload, 
  ShieldAlert,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { playScanCaptureBeep } from '../lib/audioFeedback';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  title?: string;
}

const DEMO_BARCODES = [
  { label: 'Paracetamol 650', code: '8901086001234' },
  { label: 'Amoxicillin 500', code: '8901086005678' },
  { label: 'Pantoprazole 40', code: '8901086009012' },
  { label: 'Azithromycin 500', code: '8901086003456' },
  { label: 'Cetirizine 10', code: '8901086007890' },
];

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose, title }) => {
  const { t } = useLanguage();
  const [cameraState, setCameraState] = useState<'initializing' | 'active' | 'error' | 'denied'>('initializing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [scannedCount, setScannedCount] = useState(0);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);
  const lastScanTimeRef = useRef<number>(0);
  const lastCodeRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

  // Audio Beep generator using Web Audio API
  const playBeep = () => {
    if (!soundEnabled) return;
    playScanCaptureBeep(0.25);
  };

  const handleSuccessfulScan = (decodedText: string) => {
    const now = Date.now();
    // Throttle duplicate scans within 1.2s to prevent spamming
    if (decodedText === lastCodeRef.current && now - lastScanTimeRef.current < 1200) {
      return;
    }

    lastCodeRef.current = decodedText;
    lastScanTimeRef.current = now;

    playBeep();
    setLastScannedCode(decodedText);
    setScannedCount(prev => prev + 1);
    onScan(decodedText);
  };

  const startScanner = async (targetFacingMode: 'environment' | 'user') => {
    setCameraState('initializing');
    setErrorMessage(null);

    const elementId = "reader-camera-view";
    
    // Stop any existing instance first
    if (html5QrcodeRef.current) {
      try {
        if (isScanningRef.current) {
          await html5QrcodeRef.current.stop();
          isScanningRef.current = false;
        }
        html5QrcodeRef.current.clear();
      } catch (e) {
        console.warn('Cleanup warning prior to scanner restart:', e);
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

      html5QrcodeRef.current = scanner;

      const config = {
        fps: 15,
        qrbox: { width: 260, height: 160 },
        aspectRatio: 1.333,
      };

      await scanner.start(
        { facingMode: targetFacingMode },
        config,
        (decodedText) => {
          handleSuccessfulScan(decodedText);
        },
        () => {
          // Frame error (no barcode in current frame) - normal stream tick
        }
      );

      isScanningRef.current = true;
      setCameraState('active');
    } catch (err: any) {
      // Gracefully handle expected camera permission denial or missing hardware
      console.warn("Camera start not available:", err?.name || err?.message || err);
      isScanningRef.current = false;

      const errStr = String(err).toLowerCase();
      if (errStr.includes('notallowederror') || errStr.includes('permission') || errStr.includes('denied')) {
        setCameraState('denied');
        setErrorMessage("Camera access permission was denied or restricted by browser settings.");
      } else if (errStr.includes('notfounderror') || errStr.includes('devices not found')) {
        setCameraState('error');
        setErrorMessage("No video camera device was detected on your system.");
      } else {
        setCameraState('error');
        setErrorMessage(err?.message || "Unable to access device camera feed in current browser environment.");
      }

      // Auto-focus the manual input field so user can immediately type
      setTimeout(() => {
        manualInputRef.current?.focus();
      }, 100);
    }
  };

  useEffect(() => {
    let isMounted = true;
    startScanner(facingMode);

    return () => {
      isMounted = false;
      const scanner = html5QrcodeRef.current;
      if (scanner) {
        if (isScanningRef.current) {
          isScanningRef.current = false;
          scanner.stop()
            .then(() => {
              try {
                scanner.clear();
              } catch (clearErr) {
                // Ignore clear error if DOM node was already removed by React
              }
            })
            .catch(err => {
              console.warn("Stop scanner warning on unmount:", err);
            });
        } else {
          try {
            scanner.clear();
          } catch (clearErr) {
            // Ignore clear error if node unmounted
          }
        }
      }
    };
  }, [facingMode]);

  const handleSwitchCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;

    const cleanCode = manualCode.trim();
    handleSuccessfulScan(cleanCode);
    setManualCode('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingImage(true);
    setImageError(null);

    try {
      // Create dedicated offline scanner instance for file analysis if needed
      let scanner = html5QrcodeRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode("reader-camera-view", {
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
        html5QrcodeRef.current = scanner;
      }

      const decodedText = await scanner.scanFile(file, true);
      if (decodedText) {
        handleSuccessfulScan(decodedText);
        setImageError(null);
      } else {
        setImageError("No clear barcode detected in image. Please try another image or enter code manually.");
      }
    } catch (err: any) {
      console.warn("Barcode image scan notice:", err);
      setImageError("Could not detect barcode in the uploaded image. Please ensure the barcode is clearly visible and well-lit.");
    } finally {
      setIsProcessingImage(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
              <Camera size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {title || t('quickScan') || 'POS Barcode / QR Code Scanner'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Live camera scan, image upload, or manual SKU input
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Audio Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
              title={soundEnabled ? "Mute Scan Audio Beep" : "Enable Scan Audio Beep"}
            >
              {soundEnabled ? <Volume2 size={16} className="text-blue-600 dark:text-blue-400" /> : <VolumeX size={16} />}
            </button>

            {/* Switch Camera */}
            <button
              type="button"
              onClick={handleSwitchCamera}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
              title="Switch Camera (Front/Back)"
            >
              <RefreshCw size={16} />
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scanner Viewport */}
        <div className="relative bg-slate-950 min-h-[240px] flex items-center justify-center overflow-hidden">
          {/* reader container */}
          <div id="reader-camera-view" className="w-full h-full min-h-[240px]" />

          {/* Active Overlay & Target Frame */}
          {cameraState === 'active' && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-6">
              {/* Target Bounding Box */}
              <div className="relative w-64 h-36 rounded-xl border-2 border-blue-500/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] overflow-hidden">
                {/* Laser scan line animation */}
                <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ef4444] animate-pulse top-1/2 -translate-y-1/2" />
                
                {/* Corner Accents */}
                <div className="absolute top-0 left-0 h-4 w-4 border-t-4 border-l-4 border-blue-400 rounded-tl-sm" />
                <div className="absolute top-0 right-0 h-4 w-4 border-t-4 border-r-4 border-blue-400 rounded-tr-sm" />
                <div className="absolute bottom-0 left-0 h-4 w-4 border-b-4 border-l-4 border-blue-400 rounded-bl-sm" />
                <div className="absolute bottom-0 right-0 h-4 w-4 border-b-4 border-r-4 border-blue-400 rounded-br-sm" />
              </div>
              <p className="mt-3 text-[11px] font-bold text-white/90 drop-shadow-md bg-black/50 px-3 py-1 rounded-full border border-white/10">
                Align barcode within target frame
              </p>
            </div>
          )}

          {/* Initializing Loading State */}
          {cameraState === 'initializing' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-white gap-3 p-6">
              <RefreshCw size={28} className="animate-spin text-blue-500" />
              <p className="text-xs font-bold">Connecting to Camera...</p>
              <p className="text-[10px] text-slate-400 text-center max-w-xs">
                Requesting camera access permissions from your browser.
              </p>
            </div>
          )}

          {/* Camera Permission / Fallback State */}
          {(cameraState === 'error' || cameraState === 'denied') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 p-6 text-white text-center gap-3">
              {cameraState === 'denied' ? (
                <ShieldAlert size={32} className="text-amber-400" />
              ) : (
                <AlertCircle size={32} className="text-blue-400" />
              )}
              
              <div>
                <p className="text-xs font-bold text-amber-300">
                  {cameraState === 'denied' ? 'Camera Permission Not Granted' : 'Camera Hardware Unavailable'}
                </p>
                <p className="text-[11px] text-slate-300 mt-1 max-w-sm leading-relaxed">
                  {errorMessage || "Camera access is restricted in browser settings. You can still scan by uploading barcode photos or typing the code below."}
                </p>
              </div>

              <div className="mt-1 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => startScanner(facingMode)}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <RefreshCw size={13} />
                  <span>Retry Camera</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload size={13} className="text-blue-400" />
                  <span>Upload Image</span>
                </button>
              </div>

              <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                <HelpCircle size={11} />
                <span>Tip: You can use USB handheld barcode scanners or manual entry below.</span>
              </div>
            </div>
          )}
        </div>

        {/* Hidden File Input for Barcode Photo Scan */}
        <input 
          type="file" 
          ref={fileInputRef} 
          accept="image/*" 
          onChange={handleFileUpload} 
          className="hidden" 
        />

        {/* Processing Image Notice */}
        {isProcessingImage && (
          <div className="bg-blue-50 dark:bg-blue-950/60 border-y border-blue-200 dark:border-blue-900/50 px-4 py-2 flex items-center justify-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-300">
            <RefreshCw size={14} className="animate-spin text-blue-600" />
            <span>Scanning uploaded image for barcodes & QR codes...</span>
          </div>
        )}

        {/* Image Error Notice */}
        {imageError && (
          <div className="bg-rose-50 dark:bg-rose-950/60 border-y border-rose-200 dark:border-rose-900/50 px-4 py-2 flex items-center gap-2 text-[11px] text-rose-800 dark:text-rose-200">
            <AlertCircle size={14} className="text-rose-600 shrink-0" />
            <span>{imageError}</span>
          </div>
        )}

        {/* Last Scanned Status Banner */}
        {lastScannedCode && (
          <div className="bg-emerald-50 dark:bg-emerald-950/50 border-y border-emerald-200 dark:border-emerald-900/50 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                Scanned Code: <code className="bg-emerald-100 dark:bg-emerald-900 px-1.5 py-0.5 rounded font-mono text-[11px]">{lastScannedCode}</code>
              </span>
            </div>
            <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
              Item #{scannedCount} Added
            </span>
          </div>
        )}

        {/* Manual Barcode Entry & Image Upload Fallback */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <Keyboard size={14} className="text-blue-500" />
              <span>Manual SKU / USB Barcode Input:</span>
            </label>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              <Upload size={12} />
              <span>Scan from Photo</span>
            </button>
          </div>

          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={manualInputRef}
                type="text"
                placeholder="Type or scan Barcode, SKU, Batch # or Medicine Name..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-3 pr-3 text-xs font-bold outline-none focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900 shadow-2xs"
              />
            </div>
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-sm active:scale-95 shrink-0"
            >
              <Search size={14} />
              <span>Add to Cart</span>
            </button>
          </form>

          {/* Quick Demo Barcode Chips for instant 1-click testing */}
          <div className="pt-1">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 whitespace-nowrap flex items-center gap-1 shrink-0">
                <Sparkles size={11} className="text-amber-500" />
                Quick Test:
              </span>
              {DEMO_BARCODES.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSuccessfulScan(item.code)}
                  className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap cursor-pointer transition-colors shadow-2xs"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400">
          <span>Continuous scanning enabled (modal stays open)</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-200 dark:bg-slate-700 px-3 py-1.5 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
          >
            Done Scanning ({scannedCount})
          </button>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;

