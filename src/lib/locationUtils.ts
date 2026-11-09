import { Medicine, StorageLocation } from '../types';

// Simple deterministic hash code for string
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export const AISLE_PRESETS = [
  { id: 'Aisle A', name: 'Aisle A (Oral Solids & Tablets)', shortName: 'Aisle A', zone: 'tablets' as const, temp: '15°C - 25°C', color: 'emerald' },
  { id: 'Aisle B', name: 'Aisle B (Liquids, Syrups & Suspensions)', shortName: 'Aisle B', zone: 'liquids' as const, temp: '15°C - 25°C', color: 'blue' },
  { id: 'Aisle C', name: 'Aisle C (Cold Chain / Medical Fridge 2-8°C)', shortName: 'Cold Storage (Aisle C)', zone: 'cold_storage' as const, temp: '2°C - 8°C', color: 'cyan' },
  { id: 'Aisle D', name: 'Aisle D (Topicals, Drops & First Aid)', shortName: 'Aisle D', zone: 'general' as const, temp: '15°C - 25°C', color: 'amber' },
  { id: 'Front Counter', name: 'Front OTC Counter (Fast Moving / Immediate Pick)', shortName: 'OTC Counter', zone: 'fast_moving' as const, temp: 'Room Temp', color: 'purple' },
  { id: 'Secure Safe', name: 'Schedule H / H1 Restricted Lockbox', shortName: 'Secure Lockbox', zone: 'schedule_h' as const, temp: 'Locked Cabinet', color: 'rose' },
];

export const RACK_PRESETS = ['Rack R-01', 'Rack R-02', 'Rack R-03', 'Rack R-04'];

export const SHELF_PRESETS = [
  { id: 'Shelf Level 1', name: 'Shelf 1 (Top Tier / Buffer Stock)', level: 1, label: 'Top Tier' },
  { id: 'Shelf Level 2', name: 'Shelf 2 (Eye Level / Fast Pick)', level: 2, label: 'Eye Level (Fast Pick)' },
  { id: 'Shelf Level 3', name: 'Shelf 3 (Mid Tier / Standard)', level: 3, label: 'Mid Tier' },
  { id: 'Shelf Level 4', name: 'Shelf 4 (Base Tier / Heavy Stock)', level: 4, label: 'Base Tier' },
];

export const BIN_PRESETS = [
  'Bin 01', 'Bin 02', 'Bin 03', 'Bin 04', 'Bin 05', 'Bin 06', 'Bin 07', 'Bin 08'
];

/**
 * Returns the exact configured storage location or generates an intelligent, deterministic
 * physical pharmacy shelf position based on medication category, name, and pharmaceutical form.
 */
export function getMedicineLocation(medicine: Medicine): StorageLocation {
  if (medicine.location && medicine.location.aisle && medicine.location.rack && medicine.location.shelf) {
    return medicine.location;
  }

  const nameUpper = (medicine.name || '').toUpperCase();
  const genericUpper = (medicine.genericName || '').toUpperCase();
  const saltUpper = (medicine.salt || '').toUpperCase();
  const h = hashString(medicine.name || medicine.id || 'MED');

  // 1. Cold Storage Check (Insulin, Vaccines, Biologics, Injections)
  if (
    medicine.type === 'injection' ||
    nameUpper.includes('INSULIN') ||
    nameUpper.includes('VACCINE') ||
    nameUpper.includes('INJ') ||
    saltUpper.includes('INSULIN') ||
    genericUpper.includes('INJECTION')
  ) {
    const shelfNum = (h % 3) + 1;
    const binNum = (h % 6) + 1;
    return {
      aisle: 'Aisle C',
      rack: 'Rack R-01',
      shelf: `Shelf Level ${shelfNum}`,
      bin: `Bin C-0${binNum}`,
      zone: 'cold_storage',
      temperature: '2°C - 8°C (Medical Cooler)',
      notes: 'Cold chain item: Verify refrigerator temperature log before dispensing.'
    };
  }

  // 2. Schedule H / Restricted / Controlled
  if (
    nameUpper.includes('ALPRAZOLAM') ||
    nameUpper.includes('CLONAZEPAM') ||
    nameUpper.includes('DIAZEPAM') ||
    nameUpper.includes('TRAMADOL') ||
    saltUpper.includes('NARCOTIC') ||
    nameUpper.includes('SEDATIVE')
  ) {
    const binNum = (h % 4) + 1;
    return {
      aisle: 'Secure Safe',
      rack: 'Rack R-01',
      shelf: 'Shelf Level 2',
      bin: `Bin SH-0${binNum}`,
      zone: 'schedule_h',
      temperature: 'Locked Safe (15°C - 25°C)',
      notes: 'Schedule H1 Drug: Mandatory prescription record & doctor register entry required.'
    };
  }

  // 3. Syrups & Suspensions (Liquids)
  if (medicine.type === 'syrup' || nameUpper.includes('SYRUP') || nameUpper.includes('SUSPENSION') || nameUpper.includes('DROPS')) {
    const rackIndex = (h % 3) + 1;
    const shelfNum = ((h % 2) + 3); // Syrups usually lower tier 3 or 4
    const binNum = (h % 8) + 1;
    return {
      aisle: 'Aisle B',
      rack: `Rack R-0${rackIndex}`,
      shelf: `Shelf Level ${shelfNum}`,
      bin: `Bin S-0${binNum}`,
      zone: 'liquids',
      temperature: '15°C - 25°C (Away from direct light)',
      notes: 'Keep upright. Check seal integrity before dispensing.'
    };
  }

  // 4. Fast-Moving OTC / Pain Relief / Antacids
  if (
    nameUpper.includes('PARACETAMOL') ||
    nameUpper.includes('DOLO') ||
    nameUpper.includes('CROCIN') ||
    nameUpper.includes('COMBIFLAM') ||
    nameUpper.includes('PANTOP') ||
    nameUpper.includes('DIGENE') ||
    nameUpper.includes('ORAL REHYDRATION')
  ) {
    const binNum = (h % 6) + 1;
    return {
      aisle: 'Front Counter',
      rack: 'Rack R-01',
      shelf: 'Shelf Level 2',
      bin: `Bin OTC-0${binNum}`,
      zone: 'fast_moving',
      temperature: '15°C - 25°C (Fast Retrieval)',
      notes: 'High velocity OTC: Top-up daily from primary warehouse stock.'
    };
  }

  // 5. General Tablets & Capsules (Categorized Alphabetically across Racks 1-4)
  const firstLetter = (medicine.name || 'A').toUpperCase().charCodeAt(0);
  let rackNum = 1;
  if (firstLetter <= 69) rackNum = 1; // A - E
  else if (firstLetter <= 75) rackNum = 2; // F - K
  else if (firstLetter <= 81) rackNum = 3; // L - Q
  else rackNum = 4; // R - Z

  const shelfNum = (h % 3) + 2; // Shelf 2 or 3 (Eye Level / Mid)
  const binNum = (h % 12) + 1;

  return {
    aisle: 'Aisle A',
    rack: `Rack R-0${rackNum}`,
    shelf: `Shelf Level ${shelfNum}`,
    bin: `Bin T-${binNum.toString().padStart(2, '0')}`,
    zone: 'tablets',
    temperature: '15°C - 25°C (Dry & Cool)',
    notes: 'Alphabetical sorting. Pick earliest expiry batch first (FIFO).'
  };
}

export interface PharmacyZoneLayout {
  id: string;
  name: string;
  aisleCode: string;
  gridX: number; // 0 to 100 percentage
  gridY: number; // 0 to 100 percentage
  width: number;
  height: number;
  color: string;
  description: string;
  racks: string[];
}

export const PHARMACY_FLOOR_ZONES: PharmacyZoneLayout[] = [
  {
    id: 'Aisle A',
    name: 'Aisle A: Tablets & Capsules',
    aisleCode: 'AISLE A',
    gridX: 8,
    gridY: 18,
    width: 26,
    height: 48,
    color: 'emerald',
    description: 'Oral Solid Dosage (Tablets, Capsules, Strips) • Alphabetical R1-R4',
    racks: ['Rack R-01', 'Rack R-02', 'Rack R-03', 'Rack R-04']
  },
  {
    id: 'Aisle B',
    name: 'Aisle B: Liquids & Suspensions',
    aisleCode: 'AISLE B',
    gridX: 38,
    gridY: 18,
    width: 24,
    height: 48,
    color: 'blue',
    description: 'Cough Syrups, Pediatric Suspensions, Antacids & Tonics',
    racks: ['Rack R-01', 'Rack R-02', 'Rack R-03']
  },
  {
    id: 'Aisle C',
    name: 'Aisle C: Cold Storage & Refrigerator',
    aisleCode: 'COLD ROOM',
    gridX: 66,
    gridY: 18,
    width: 26,
    height: 22,
    color: 'cyan',
    description: 'Medical Coolers (2°C - 8°C) • Insulin, Vaccines, Injections & Biologics',
    racks: ['Rack R-01', 'Rack R-02']
  },
  {
    id: 'Secure Safe',
    name: 'Schedule H / Narcotics Safe',
    aisleCode: 'LOCKBOX',
    gridX: 66,
    gridY: 44,
    width: 26,
    height: 22,
    color: 'rose',
    description: 'High-Alert Controlled & Scheduled Substances • Biometric / Key Access',
    racks: ['Rack R-01']
  },
  {
    id: 'Front Counter',
    name: 'Front OTC & Billing Counter',
    aisleCode: 'COUNTER',
    gridX: 8,
    gridY: 74,
    width: 54,
    height: 18,
    color: 'purple',
    description: 'Point of Sale, Daily Fast-Pick OTC, First-Aid & Patient Handover',
    racks: ['Rack R-01']
  },
  {
    id: 'Aisle D',
    name: 'Aisle D: Topicals & Eye/Ear Drops',
    aisleCode: 'AISLE D',
    gridX: 66,
    gridY: 74,
    width: 26,
    height: 18,
    color: 'amber',
    description: 'Ointments, Creams, Gels, Eye/Ear Drops & Surgical Supplies',
    racks: ['Rack R-01', 'Rack R-02']
  }
];
