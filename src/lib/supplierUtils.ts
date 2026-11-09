import { Medicine } from '../types';

export interface SupplierInfo {
  id: string;
  name: string;
  code: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  leadTimeDays: number;
  rating?: number;
}

export const PHARMACY_SUPPLIERS: SupplierInfo[] = [
  { id: 'cipla', name: 'Cipla Ltd', code: 'CIP', leadTimeDays: 2, contactPerson: 'Rajesh Sharma', phone: '+91 98200 12345' },
  { id: 'sun_pharma', name: 'Sun Pharmaceutical Industries', code: 'SUN', leadTimeDays: 3, contactPerson: 'Amitabh Verma', phone: '+91 98110 54321' },
  { id: 'dr_reddys', name: "Dr. Reddy's Laboratories", code: 'DRL', leadTimeDays: 2, contactPerson: 'Suresh Reddy', phone: '+91 94400 98765' },
  { id: 'mankind', name: 'Mankind Pharma Ltd', code: 'MAN', leadTimeDays: 2, contactPerson: 'Vikas Juneja', phone: '+91 99990 11223' },
  { id: 'abbott', name: 'Abbott Healthcare India', code: 'ABT', leadTimeDays: 4, contactPerson: 'Priya Nair', phone: '+91 98201 33445' },
  { id: 'torrent', name: 'Torrent Pharmaceuticals', code: 'TOR', leadTimeDays: 3, contactPerson: 'Harsh Patel', phone: '+91 98790 66778' },
  { id: 'lupin', name: 'Lupin Ltd', code: 'LUP', leadTimeDays: 3, contactPerson: 'Karan Gupta', phone: '+91 98330 44556' },
  { id: 'alkem', name: 'Alkem Laboratories', code: 'ALK', leadTimeDays: 3, contactPerson: 'Sanjay Singh', phone: '+91 98210 77889' },
  { id: 'glenmark', name: 'Glenmark Pharmaceuticals', code: 'GLN', leadTimeDays: 4, contactPerson: 'Rahul Saldanha', phone: '+91 98205 99001' },
  { id: 'zydus', name: 'Zydus Lifesciences', code: 'ZYD', leadTimeDays: 3, contactPerson: 'Pankaj Patel', phone: '+91 98250 11334' },
  { id: 'gsk', name: 'GlaxoSmithKline (GSK) India', code: 'GSK', leadTimeDays: 4, contactPerson: 'Meera Rao', phone: '+91 98450 55667' },
  { id: 'sanofi', name: 'Sanofi India Ltd', code: 'SNF', leadTimeDays: 5, contactPerson: 'Vivek Joshi', phone: '+91 98204 88990' },
  { id: 'pfizer', name: 'Pfizer Healthcare India', code: 'PFZ', leadTimeDays: 5, contactPerson: 'Arun Iyer', phone: '+91 98202 77112' },
  { id: 'micro_labs', name: 'Micro Labs Ltd', code: 'MIC', leadTimeDays: 2, contactPerson: 'Dilip Surana', phone: '+91 98451 22334' },
  { id: 'aristo', name: 'Aristo Pharmaceuticals', code: 'ARS', leadTimeDays: 3, contactPerson: 'Mahesh Sharma', phone: '+91 98310 99887' },
  { id: 'alembic', name: 'Alembic Pharmaceuticals', code: 'ALM', leadTimeDays: 3, contactPerson: 'Chirayu Amin', phone: '+91 98240 33221' },
  { id: 'national_distributors', name: 'National Pharma Distributors', code: 'NPD', leadTimeDays: 1, contactPerson: 'Ramesh Agarwal', phone: '+91 98100 44556' }
];

/**
 * Returns the configured supplier or infers a realistic default manufacturer/supplier
 * based on brand names and salts so every medicine has a filterable supplier.
 */
export function getMedicineSupplier(medicine: Medicine): string {
  if (medicine.supplier && medicine.supplier.trim() !== '') {
    return medicine.supplier.trim();
  }
  if (medicine.manufacturer && medicine.manufacturer.trim() !== '') {
    return medicine.manufacturer.trim();
  }

  const nameUpper = (medicine.name || '').toUpperCase();
  const genericUpper = (medicine.genericName || '').toUpperCase();
  const saltUpper = (medicine.salt || '').toUpperCase();

  if (nameUpper.includes('DOLO') || nameUpper.includes('PARACIP') || nameUpper.includes('MICRO')) {
    return 'Micro Labs Ltd';
  }
  if (nameUpper.includes('CROCIN') || nameUpper.includes('AUGMENTIN') || nameUpper.includes('CALPOL') || nameUpper.includes('BETNOVATE')) {
    return 'GlaxoSmithKline (GSK) India';
  }
  if (nameUpper.includes('CIPLOX') || nameUpper.includes('ASTHALIN') || nameUpper.includes('BUDECORT') || nameUpper.includes('FORACORT')) {
    return 'Cipla Ltd';
  }
  if (nameUpper.includes('AZITHRAL') || nameUpper.includes('ALEMBIC') || nameUpper.includes('ROXID')) {
    return 'Alembic Pharmaceuticals';
  }
  if (nameUpper.includes('PANTOCID') || nameUpper.includes('VOLINI') || nameUpper.includes('ROSUVAS') || nameUpper.includes('GEMER')) {
    return 'Sun Pharmaceutical Industries';
  }
  if (nameUpper.includes('OCID') || nameUpper.includes('NIZORAL') || nameUpper.includes('ECONORM') || nameUpper.includes('TELMISARTAN')) {
    return "Dr. Reddy's Laboratories";
  }
  if (nameUpper.includes('MANFORCE') || nameUpper.includes('MOXIKIND') || nameUpper.includes('TELMIKIND') || nameUpper.includes('MAFTAL')) {
    return 'Mankind Pharma Ltd';
  }
  if (nameUpper.includes('PAN-D') || nameUpper.includes('PAN 40') || nameUpper.includes('MONOCEF')) {
    return 'Alkem Laboratories';
  }
  if (nameUpper.includes('PANTOP') || nameUpper.includes('ARISTO') || nameUpper.includes('CEFTAS')) {
    return 'Aristo Pharmaceuticals';
  }
  if (nameUpper.includes('DUPHASTON') || nameUpper.includes('THYRONORM') || nameUpper.includes('CREMAFFIN') || nameUpper.includes('BRUFEN')) {
    return 'Abbott Healthcare India';
  }
  if (nameUpper.includes('CHYMORAL') || nameUpper.includes('SHEL險') || nameUpper.includes('SHELCAL') || nameUpper.includes('TORRENT')) {
    return 'Torrent Pharmaceuticals';
  }
  if (nameUpper.includes('HUMALOG') || nameUpper.includes('LANTUS') || nameUpper.includes('INSULIN') || nameUpper.includes('APIDRA')) {
    return 'Sanofi India Ltd';
  }
  if (nameUpper.includes('TELMA') || nameUpper.includes('ASCORIL') || nameUpper.includes('CANDID')) {
    return 'Glenmark Pharmaceuticals';
  }

  // Deterministic fallback based on first character
  const charCode = (medicine.name || 'A').charCodeAt(0);
  const supplierIndex = charCode % PHARMACY_SUPPLIERS.length;
  return PHARMACY_SUPPLIERS[supplierIndex].name;
}
