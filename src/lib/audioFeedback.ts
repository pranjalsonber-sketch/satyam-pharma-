// Professional Studio-Grade Audio Cue Synthesizer for Pharmacy ERP & Barcode Intake
// Uses Web Audio API with frequency envelopes tuned for high-noise clinical and retail environments.

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!sharedAudioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        sharedAudioCtx = new AudioCtxClass();
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch (err) {
    console.warn('AudioContext initialization notice:', err);
    return null;
  }
}

/**
 * 1. Rapid POS Laser Scan Capture Beep
 * Dual-harmonic sharp impulse (1850Hz + 2775Hz) modeled after enterprise Honeywell/Zebra scanners.
 * Pierces ambient pharmacy and store background chatter.
 */
export function playScanCaptureBeep(volume = 0.22) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume, now);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    masterGain.connect(ctx.destination);

    // Primary High Frequency Oscillator
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1850, now);
    osc1.connect(masterGain);

    // Harmonic Overtone for crisp acoustic penetration
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(2775, now);
    gain2.gain.setValueAtTime(0.35, now);
    osc2.connect(gain2);
    gain2.connect(masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.09);
    osc2.stop(now + 0.09);
  } catch (e) {
    console.warn('Scan beep error:', e);
  }
}

/**
 * 2. Medicine Identification / AI Resolution Confirmation
 * Ascending crisp 2-tone melodic chirp (1250Hz -> 1760Hz) signifying chemical & catalog data matched.
 */
export function playMedicineIdentifiedBeep(volume = 0.22) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume, now);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    masterGain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1250, now);
    osc.frequency.setValueAtTime(1760, now + 0.06);

    osc.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
  } catch (e) {
    console.warn('Identify audio cue error:', e);
  }
}

/**
 * 3. Product Added / Inventory Restock Success Chime
 * Uplifting 3-note ascending major arpeggio (C6 1046.5Hz -> E6 1318.5Hz -> G6 1568Hz)
 * Gives unambiguous, pleasant confirmation that the product record is committed to Firestore database.
 */
export function playProductAddedChime(volume = 0.26) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const notes = [
      { freq: 1046.5, time: 0.00, dur: 0.12 }, // C6
      { freq: 1318.5, time: 0.07, dur: 0.12 }, // E6
      { freq: 1568.0, time: 0.14, dur: 0.22 }, // G6
    ];

    notes.forEach(({ freq, time, dur }) => {
      const noteTime = now + time;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0, noteTime);
      gain.gain.linearRampToValueAtTime(volume, noteTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + dur);
    });
  } catch (e) {
    console.warn('Product added chime error:', e);
  }
}

/**
 * 4. Error / Warning Alert Cue
 * Dual low-frequency pulse (330Hz -> 220Hz) for invalid codes or expired stocks.
 */
export function playErrorAlertBeep(volume = 0.20) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(330, now);
    osc.frequency.setValueAtTime(220, now + 0.1);

    gain.gain.setValueAtTime(volume * 0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.24);
  } catch (e) {
    console.warn('Error alert beep error:', e);
  }
}
