/**
 * Stock Movement Audit Service
 * Records and retrieves all inventory additions and subtractions across the system.
 */

import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';

export interface StockMovement {
  id: string;
  medicineId: string;
  medicineName: string;
  batchNumber?: string;
  type: 'addition' | 'subtraction';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  referenceId?: string;
  userName?: string;
  userRole?: string;
  timestamp: string;
}

const COLLECTION_NAME = 'stock_movements';

/**
 * Logs an inventory addition or subtraction to Firestore and local storage
 */
export async function logStockMovement(movement: Omit<StockMovement, 'id' | 'timestamp'> & { timestamp?: string }): Promise<string> {
  const timestamp = movement.timestamp || new Date().toISOString();
  const payload = {
    medicineId: movement.medicineId || 'unknown',
    medicineName: movement.medicineName || 'Medicine',
    batchNumber: movement.batchNumber || 'N/A',
    type: movement.type,
    quantity: Math.abs(movement.quantity),
    previousStock: Number(movement.previousStock) || 0,
    newStock: Number(movement.newStock) || 0,
    reason: movement.reason || 'Inventory adjustment',
    referenceId: movement.referenceId || '',
    userName: movement.userName || 'Pharmacist',
    userRole: movement.userRole || 'staff',
    timestamp,
  };

  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), payload);
    return docRef.id;
  } catch (err) {
    console.warn('Could not write stock movement to Firestore, saving to localStorage:', err);
    const localKey = 'satyam_stock_movements_fallback';
    const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
    const id = `local-${Date.now()}`;
    existing.unshift({ id, ...payload });
    localStorage.setItem(localKey, JSON.stringify(existing.slice(0, 500)));
    return id;
  }
}

/**
 * Fetches recent stock movements
 */
export async function fetchStockMovements(maxRecords: number = 300): Promise<StockMovement[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('timestamp', 'desc'), limit(maxRecords));
    const snap = await getDocs(q);
    const items: StockMovement[] = snap.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Omit<StockMovement, 'id'>)
    }));

    if (items.length > 0) {
      return items;
    }
  } catch (err) {
    console.warn('Failed to query Firestore stock_movements:', err);
  }

  // Fallback to local storage if Firestore is empty or unavailable
  const localKey = 'satyam_stock_movements_fallback';
  return JSON.parse(localStorage.getItem(localKey) || '[]');
}
