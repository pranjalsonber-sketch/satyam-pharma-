import { useEffect, useRef, useState, useCallback } from 'react';

export interface BarcodeKeystrokeListenerOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
  minBarcodeLength?: number;
  maxKeyIntervalMs?: number; // threshold between chars in scanner stream (default 65ms)
  playSound?: boolean;
}

/**
 * Web Audio API synthesizer for realistic POS barcode scanner feedback
 */
export const playScannerSound = (type: 'success' | 'error' | 'warning' = 'success') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'success') {
      // Crisp POS retail scanner beep (880Hz A5, 75ms)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(920, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'warning') {
      // Double medium beep for low stock or special alert
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.setValueAtTime(750, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else {
      // Low dual error tone (300Hz, 120ms)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    }
  } catch (e) {
    // Audio context may be restricted by browser policy before first interaction
  }
};

/**
 * Custom React hook that listens globally for keystrokes from USB / Bluetooth / 2.4G
 * hardware barcode scanners (keyboard wedge) and triggers `onScan` when a full barcode is received.
 */
export const useBarcodeKeystrokeListener = ({
  onScan,
  enabled = true,
  minBarcodeLength = 3,
  maxKeyIntervalMs = 65,
  playSound = true,
}: BarcodeKeystrokeListenerOptions) => {
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [lastScanTime, setLastScanTime] = useState<number | null>(null);
  const [isScanningBurst, setIsScanningBurst] = useState(false);

  const bufferRef = useRef<string>('');
  const keyTimesRef = useRef<number[]>([]);
  const timeoutTimerRef = useRef<any>(null);
  const burstResetTimerRef = useRef<any>(null);

  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const processBuffer = useCallback(() => {
    const code = bufferRef.current.trim();
    const times = keyTimesRef.current;

    // Reset buffer immediately
    bufferRef.current = '';
    keyTimesRef.current = [];

    if (code.length < minBarcodeLength) {
      return false;
    }

    // Calculate average time between keys to verify it's a hardware scanner burst
    let isFastBurst = true;
    if (times.length >= 3) {
      let totalDiff = 0;
      for (let i = 1; i < times.length; i++) {
        totalDiff += times[i] - times[i - 1];
      }
      const avgInterval = totalDiff / (times.length - 1);
      // Hardware scanners typically transmit characters in 5-45ms
      isFastBurst = avgInterval <= maxKeyIntervalMs;
    }

    setLastScannedCode(code);
    setLastScanTime(Date.now());
    if (playSound) {
      playScannerSound('success');
    }

    onScanRef.current(code);
    return true;
  }, [minBarcodeLength, maxKeyIntervalMs, playSound]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      const isSearchInput = target && target.getAttribute('type') === 'text' && target.classList.contains('pos-search-input');

      // Ignore standard non-character control keys (except Enter, Tab)
      if (
        e.key === 'Shift' || 
        e.key === 'Control' || 
        e.key === 'Alt' || 
        e.key === 'Meta' || 
        e.key === 'CapsLock' ||
        e.key === 'Escape'
      ) {
        return;
      }

      // Check if scanner terminated code with Enter or Tab
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (bufferRef.current.length >= minBarcodeLength) {
          e.preventDefault();
          e.stopPropagation();
          processBuffer();
          setIsScanningBurst(false);
          return;
        }

        // If user is in the search input and presses Enter, treat the input value as a scanned/submitted code
        if (isInput && (target as HTMLInputElement).value?.trim().length >= minBarcodeLength) {
          const inputValue = (target as HTMLInputElement).value.trim();
          // Let consumer handle if needed
        }
        return;
      }

      // Only accept single printable characters
      if (e.key.length !== 1) {
        return;
      }

      // Measure time since last keystroke
      const lastKeyTime = keyTimesRef.current[keyTimesRef.current.length - 1] || 0;
      const interval = now - lastKeyTime;

      // If this is a new stroke after a long pause (> 150ms), reset buffer
      if (lastKeyTime > 0 && interval > 150) {
        bufferRef.current = '';
        keyTimesRef.current = [];
      }

      // If key interval is fast (< maxKeyIntervalMs), it's likely a hardware scanner
      if (keyTimesRef.current.length === 0 || interval <= maxKeyIntervalMs) {
        bufferRef.current += e.key;
        keyTimesRef.current.push(now);

        setIsScanningBurst(true);
        if (burstResetTimerRef.current) clearTimeout(burstResetTimerRef.current);
        burstResetTimerRef.current = setTimeout(() => setIsScanningBurst(false), 300);

        // Reset any auto-finish timeout
        if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);

        // Auto-finish after 80ms silence if buffer has substantial length
        timeoutTimerRef.current = setTimeout(() => {
          if (bufferRef.current.length >= minBarcodeLength && keyTimesRef.current.length >= minBarcodeLength) {
            // Verify if keypresses were fast
            let totalDiff = 0;
            const times = keyTimesRef.current;
            for (let i = 1; i < times.length; i++) {
              totalDiff += times[i] - times[i - 1];
            }
            const avg = totalDiff / (times.length - 1);
            if (avg <= maxKeyIntervalMs) {
              processBuffer();
              setIsScanningBurst(false);
            }
          }
        }, 80);
      } else {
        // Human typing slowly
        // If not in input, still accumulate to allow manual keypad barcode typing followed by Enter
        if (!isInput) {
          bufferRef.current += e.key;
          keyTimesRef.current.push(now);
        } else {
          // In input with slow typing, clear scanner buffer
          bufferRef.current = '';
          keyTimesRef.current = [];
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
      if (burstResetTimerRef.current) clearTimeout(burstResetTimerRef.current);
    };
  }, [enabled, minBarcodeLength, maxKeyIntervalMs, processBuffer]);

  return {
    lastScannedCode,
    lastScanTime,
    isScanningBurst,
  };
};

export default useBarcodeKeystrokeListener;
