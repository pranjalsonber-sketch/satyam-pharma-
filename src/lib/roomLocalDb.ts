/**
 * Room Database / Local IndexedDB Store for Inventory & Products
 * Provides local SQLite/Room-style persistent caching and queries for medicines.
 */

import { Medicine } from '../types';

const DB_NAME = 'satyam_room_db';
const DB_VERSION = 2;
const STORE_MEDICINES = 'medicines_entity';
const STORE_STOCK_MOVEMENTS = 'stock_movements_entity';

export function openRoomDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB (Room Database) not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Medicines entity table
      if (!db.objectStoreNames.contains(STORE_MEDICINES)) {
        const medicineStore = db.createObjectStore(STORE_MEDICINES, { keyPath: 'id' });
        medicineStore.createIndex('name', 'name', { unique: false });
        medicineStore.createIndex('barcode', 'barcode', { unique: false });
        medicineStore.createIndex('genericName', 'genericName', { unique: false });
        medicineStore.createIndex('type', 'type', { unique: false });
      }

      // Stock movements entity table
      if (!db.objectStoreNames.contains(STORE_STOCK_MOVEMENTS)) {
        const movementStore = db.createObjectStore(STORE_STOCK_MOVEMENTS, { keyPath: 'id' });
        movementStore.createIndex('medicineId', 'medicineId', { unique: false });
        movementStore.createIndex('timestamp', 'timestamp', { unique: false });
        movementStore.createIndex('type', 'type', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Inserts or updates an item in the local Room database
 */
export async function roomInsertItem(item: Medicine): Promise<void> {
  const db = await openRoomDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MEDICINES, 'readwrite');
    const store = tx.objectStore(STORE_MEDICINES);
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Bulk syncs medicines into the local Room database
 */
export async function roomSyncAllItems(items: Medicine[]): Promise<void> {
  if (!items || items.length === 0) return;
  const db = await openRoomDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MEDICINES, 'readwrite');
    const store = tx.objectStore(STORE_MEDICINES);
    for (const item of items) {
      store.put(item);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Gets all items from the local Room database
 */
export async function roomGetAllItems(): Promise<Medicine[]> {
  const db = await openRoomDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MEDICINES, 'readonly');
    const store = tx.objectStore(STORE_MEDICINES);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Queries items from the local Room database using search text
 */
export async function roomSearchItems(searchQuery: string): Promise<Medicine[]> {
  const all = await roomGetAllItems();
  const q = searchQuery.toLowerCase().trim();
  if (!q) return all;
  return all.filter(item => 
    item.name?.toLowerCase().includes(q) ||
    item.genericName?.toLowerCase().includes(q) ||
    item.salt?.toLowerCase().includes(q) ||
    item.barcode?.toLowerCase().includes(q) ||
    item.type?.toLowerCase().includes(q)
  );
}

/**
 * Deletes an item from the local Room database
 */
export async function roomDeleteItem(id: string): Promise<void> {
  const db = await openRoomDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MEDICINES, 'readwrite');
    const store = tx.objectStore(STORE_MEDICINES);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
