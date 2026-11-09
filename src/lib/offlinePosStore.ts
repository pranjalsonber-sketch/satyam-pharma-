import { collection, addDoc, doc, updateDoc, increment, getDoc, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { Medicine } from '../types';
import { logActivity } from './logger';

export interface OfflineSaleItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit?: string;
  batch?: string;
}

export interface OfflineSale {
  id: string;
  timestamp: string;
  customerName?: string;
  customerMobile?: string;
  items: OfflineSaleItem[];
  totalAmount: number;
  paymentMethod: 'cash' | 'upi' | 'card' | string;
  billingType: 'retail' | 'gst' | string;
  staffId?: string;
  staffEmail?: string;
  staffName?: string;
  createdOffline: boolean;
  synced: boolean;
  syncAttempts?: number;
  lastSyncError?: string;
  localCreatedDate: number;
  firestoreId?: string;
}

export interface SyncAuditRecord {
  id: string;
  saleId: string;
  firestoreId: string;
  syncedAt: string;
  totalAmount: number;
  itemCount: number;
  status: 'synced' | 'failed';
  error?: string;
  resolutionNote?: string;
}

export type ConflictType = 'stock_depletion' | 'price_divergence' | 'missing_item' | 'duplicate_record';

export interface OfflineItemConflictAnalysis {
  medicineId: string;
  medicineName: string;
  offlinePrice: number;
  livePrice?: number;
  priceDiscrepancy: boolean;
  priceDelta: number;

  offlineQuantity: number;
  liveAvailableStock?: number;
  stockDepletionConflict: boolean;
  projectedStockAfterDeduction: number;

  isItemMissingInCloud: boolean;
  hasConflict: boolean;
  conflictNotes: string[];
}

export interface OfflineSaleConflictAnalysis {
  sale: OfflineSale;
  hasConflicts: boolean;
  conflicts: OfflineItemConflictAnalysis[];
  conflictTypes: ConflictType[];
  riskLevel: 'clean' | 'moderate' | 'high';
  summaryMessage: string;
}

export interface ConflictResolutionDecision {
  strategy: 'honor_offline' | 'apply_cloud_pricing' | 'cap_to_live_stock' | 'skip_stock_deduction' | 'custom';
  customQuantity?: number;
  customPrice?: number;
  deductStock: boolean;
}

const DB_NAME = 'Satyam_Pharma_Offline_POS_v1';
const DB_VERSION = 1;
const STORE_SALES = 'offline_sales';
const STORE_INVENTORY = 'inventory_cache';
const STORE_AUDIT = 'sync_audit_trail';

let dbInstance: IDBDatabase | null = null;
let isSyncingInProgress = false;

/**
 * Open or upgrade the IndexedDB database instance
 */
export function openOfflineDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Offline Sales Store
      if (!db.objectStoreNames.contains(STORE_SALES)) {
        const salesStore = db.createObjectStore(STORE_SALES, { keyPath: 'id' });
        salesStore.createIndex('synced', 'synced', { unique: false });
        salesStore.createIndex('timestamp', 'timestamp', { unique: false });
        salesStore.createIndex('localCreatedDate', 'localCreatedDate', { unique: false });
      }

      // 2. Inventory Cache Store
      if (!db.objectStoreNames.contains(STORE_INVENTORY)) {
        const invStore = db.createObjectStore(STORE_INVENTORY, { keyPath: 'id' });
        invStore.createIndex('name', 'name', { unique: false });
        invStore.createIndex('barcode', 'barcode', { unique: false });
      }

      // 3. Sync Audit Store
      if (!db.objectStoreNames.contains(STORE_AUDIT)) {
        const auditStore = db.createObjectStore(STORE_AUDIT, { keyPath: 'id' });
        auditStore.createIndex('syncedAt', 'syncedAt', { unique: false });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      dbInstance.onclose = () => {
        dbInstance = null;
      };
      resolve(dbInstance);
    };

    request.onerror = () => {
      console.error('[IndexedDB] Failed to open offline store:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Cache current inventory snapshot in IndexedDB for 100% offline barcode scans and search
 */
export async function cacheInventoryLocally(medicines: Medicine[]): Promise<void> {
  if (!Array.isArray(medicines) || medicines.length === 0) return;

  try {
    const db = await openOfflineDB();
    const tx = db.transaction(STORE_INVENTORY, 'readwrite');
    const store = tx.objectStore(STORE_INVENTORY);

    for (const med of medicines) {
      store.put(med);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        resolve();
      };
      tx.onerror = () => {
        console.warn('[IndexedDB] Error caching inventory:', tx.error);
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn('[IndexedDB] Unable to cache inventory locally:', err);
  }
}

/**
 * Retrieve cached inventory medicines from IndexedDB when offline
 */
export async function getCachedInventory(): Promise<Medicine[]> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(STORE_INVENTORY, 'readonly');
    const store = tx.objectStore(STORE_INVENTORY);
    const request = store.getAll();

    return new Promise((resolve) => {
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => {
        resolve([]);
      };
    });
  } catch (err) {
    console.warn('[IndexedDB] Could not read cached inventory:', err);
    return [];
  }
}

/**
 * Save an offline sale transaction directly into IndexedDB
 */
export async function saveOfflineSale(
  saleInput: Omit<OfflineSale, 'id' | 'synced' | 'createdOffline' | 'localCreatedDate'>
): Promise<OfflineSale> {
  const db = await openOfflineDB();
  const now = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const offlineId = `OFFLINE-INV-${now.toString().slice(-6)}-${randomSuffix}`;

  const offlineSale: OfflineSale = {
    ...saleInput,
    id: offlineId,
    timestamp: saleInput.timestamp || new Date().toISOString(),
    createdOffline: true,
    synced: false,
    syncAttempts: 0,
    localCreatedDate: now,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_SALES, STORE_INVENTORY], 'readwrite');
    const salesStore = tx.objectStore(STORE_SALES);
    const invStore = tx.objectStore(STORE_INVENTORY);

    salesStore.put(offlineSale);

    // Optimistically deduct local inventory so consecutive offline sales don't oversell
    if (Array.isArray(offlineSale.items)) {
      for (const item of offlineSale.items) {
        if (!item.id) continue;
        const getReq = invStore.get(item.id);
        getReq.onsuccess = () => {
          const med = getReq.result;
          if (med) {
            const currentStock = Number(med.stockQuantity) || 0;
            med.stockQuantity = Math.max(0, currentStock - (Number(item.quantity) || 1));
            invStore.put(med);
          }
        };
      }
    }

    tx.oncomplete = () => {
      // Broadcast update event to all app components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('offline-sales-updated', { detail: offlineSale }));
      }
      resolve(offlineSale);
    };

    tx.onerror = () => {
      console.error('[IndexedDB] Failed to save offline sale:', tx.error);
      reject(tx.error);
    };
  });
}

/**
 * Get all pending unsynced sales from IndexedDB
 */
export async function getPendingOfflineSales(): Promise<OfflineSale[]> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(STORE_SALES, 'readonly');
    const store = tx.objectStore(STORE_SALES);
    const index = store.index('synced');
    const request = index.getAll(IDBKeyRange.only(false));

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const results = (request.result || []) as OfflineSale[];
        // Sort oldest first (FIFO order for stock consistency)
        results.sort((a, b) => a.localCreatedDate - b.localCreatedDate);
        resolve(results);
      };
      request.onerror = () => {
        resolve([]);
      };
    });
  } catch (err) {
    console.warn('[IndexedDB] Could not get pending sales:', err);
    return [];
  }
}

/**
 * Get all offline sales (both synced and pending)
 */
export async function getAllOfflineSales(): Promise<OfflineSale[]> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(STORE_SALES, 'readonly');
    const store = tx.objectStore(STORE_SALES);
    const request = store.getAll();

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const results = (request.result || []) as OfflineSale[];
        results.sort((a, b) => b.localCreatedDate - a.localCreatedDate);
        resolve(results);
      };
      request.onerror = () => {
        resolve([]);
      };
    });
  } catch (err) {
    console.warn('[IndexedDB] Could not get all offline sales:', err);
    return [];
  }
}

/**
 * Delete a specific offline sale record from IndexedDB
 */
export async function deleteOfflineSale(id: string): Promise<void> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(STORE_SALES, 'readwrite');
    tx.objectStore(STORE_SALES).delete(id);

    return new Promise((resolve) => {
      tx.oncomplete = () => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('offline-sales-updated'));
        }
        resolve();
      };
      tx.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('[IndexedDB] Could not delete offline sale:', err);
  }
}

/**
 * Synchronize all pending offline sales to Firestore
 */
export async function syncPendingOfflineSales(): Promise<{
  successCount: number;
  failCount: number;
  errors: string[];
  syncedSales: OfflineSale[];
}> {
  if (isSyncingInProgress) {
    return { successCount: 0, failCount: 0, errors: ['Sync is already in progress'], syncedSales: [] };
  }

  // Check network connectivity first
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { successCount: 0, failCount: 0, errors: ['Browser is currently offline'], syncedSales: [] };
  }

  isSyncingInProgress = true;
  const pendingSales = await getPendingOfflineSales();

  if (pendingSales.length === 0) {
    isSyncingInProgress = false;
    return { successCount: 0, failCount: 0, errors: [], syncedSales: [] };
  }

  let successCount = 0;
  let failCount = 0;
  const errors: string[] = [];
  const syncedSales: OfflineSale[] = [];

  const db = await openOfflineDB();

  for (const sale of pendingSales) {
    try {
      // 1. Post to Firestore 'sales' collection
      const salePayload: any = {
        timestamp: sale.timestamp,
        customerName: sale.customerName || 'Walk-in Customer',
        customerMobile: sale.customerMobile || '',
        items: sale.items,
        totalAmount: sale.totalAmount,
        paymentMethod: sale.paymentMethod,
        billingType: sale.billingType,
        staffId: sale.staffId || '',
        createdOffline: true,
        offlineLocalId: sale.id,
        syncedAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(dbInstance as any || db, 'sales'), salePayload);
      const firestoreId = docRef.id;

      // 2. Reduce stock in Firestore inventory documents
      if (Array.isArray(sale.items)) {
        for (const item of sale.items) {
          if (!item.id) continue;
          try {
            const medDocRef = doc(dbInstance as any || db, 'inventory', item.id);
            const qty = Number(item.quantity) || 1;
            await updateDoc(medDocRef, {
              stockQuantity: increment(-qty),
            });
          } catch (invErr) {
            console.warn(`[Offline Sync] Could not adjust stock for item ${item.id}:`, invErr);
          }
        }
      }

      // 3. Log Activity for audit accountability
      logActivity({
        type: 'sale',
        action: 'Offline Sale Synchronized',
        description: `Synced offline ${sale.billingType?.toUpperCase() || 'POS'} sale #${sale.id} (${sale.items.length} items, ₹${sale.totalAmount}) to cloud.`,
        module: 'pos',
        severity: 'success',
        userEmail: sale.staffEmail || 'staff@satyampharma.com',
        userName: sale.staffName || 'Pharmacist (Offline POS)',
        details: {
          offlineId: sale.id,
          firestoreId,
          totalAmount: sale.totalAmount,
          itemCount: sale.items.length,
          paymentMethod: sale.paymentMethod,
          billingType: sale.billingType,
        },
      });

      // 4. Update IndexedDB record to synced: true
      const tx = db.transaction([STORE_SALES, STORE_AUDIT], 'readwrite');
      const salesStore = tx.objectStore(STORE_SALES);
      const auditStore = tx.objectStore(STORE_AUDIT);

      sale.synced = true;
      sale.firestoreId = firestoreId;
      salesStore.put(sale);

      const auditEntry: SyncAuditRecord = {
        id: `audit_${Date.now()}_${sale.id}`,
        saleId: sale.id,
        firestoreId,
        syncedAt: new Date().toISOString(),
        totalAmount: sale.totalAmount,
        itemCount: sale.items.length,
        status: 'synced',
      };
      auditStore.put(auditEntry);

      await new Promise<void>((res) => {
        tx.oncomplete = () => res();
        tx.onerror = () => res();
      });

      successCount++;
      syncedSales.push(sale);
    } catch (err: any) {
      failCount++;
      const errMsg = err?.message || 'Firestore write error during sync';
      errors.push(`Sale ${sale.id}: ${errMsg}`);

      // Increment sync attempt count in IndexedDB
      try {
        const tx = db.transaction(STORE_SALES, 'readwrite');
        sale.syncAttempts = (sale.syncAttempts || 0) + 1;
        sale.lastSyncError = errMsg;
        tx.objectStore(STORE_SALES).put(sale);
      } catch (saveErr) {
        console.warn('[Offline Sync] Error recording failure in IndexedDB:', saveErr);
      }
    }
  }

  isSyncingInProgress = false;

  // Broadcast sync finished event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('offline-sync-completed', {
        detail: { successCount, failCount, errors, syncedSales },
      })
    );
    window.dispatchEvent(new CustomEvent('offline-sales-updated'));
  }

  return { successCount, failCount, errors, syncedSales };
}

/**
 * Get summary stats about current offline queue
 */
export async function getOfflineQueueStats(): Promise<{
  pendingCount: number;
  totalPendingAmount: number;
  totalOfflineSalesCount: number;
}> {
  try {
    const pending = await getPendingOfflineSales();
    const all = await getAllOfflineSales();

    let totalPendingAmount = 0;
    pending.forEach((s) => {
      totalPendingAmount += Number(s.totalAmount) || 0;
    });

    return {
      pendingCount: pending.length,
      totalPendingAmount: Math.round(totalPendingAmount * 100) / 100,
      totalOfflineSalesCount: all.length,
    };
  } catch (err) {
    return { pendingCount: 0, totalPendingAmount: 0, totalOfflineSalesCount: 0 };
  }
}

/**
 * Initialize automatic background sync on 'online' network event
 */
export function setupAutoOfflineSync(): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = async () => {
    console.log('[Offline Engine] Network restored. Checking for pending offline sales to sync...');
    try {
      const stats = await getOfflineQueueStats();
      if (stats.pendingCount > 0) {
        await syncPendingOfflineSales();
      }
    } catch (err) {
      console.warn('[Offline Engine] Auto-sync encountered an issue:', err);
    }
  };

  window.addEventListener('online', handleOnline);

  // Periodic safety check every 45 seconds if online
  const interval = setInterval(() => {
    if (navigator.onLine && !isSyncingInProgress) {
      getOfflineQueueStats().then((stats) => {
        if (stats.pendingCount > 0) {
          syncPendingOfflineSales();
        }
      });
    }
  }, 45000);

  // Initial check on mount
  if (navigator.onLine) {
    setTimeout(() => {
      syncPendingOfflineSales().catch(() => {});
    }, 3000);
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    clearInterval(interval);
  };
}

/**
 * Perform a deep conflict analysis comparing an offline sale with live Firestore database
 */
export async function diagnoseSaleConflicts(
  sale: OfflineSale,
  preloadedMedicines?: Record<string, Medicine>
): Promise<OfflineSaleConflictAnalysis> {
  const conflicts: OfflineItemConflictAnalysis[] = [];
  const conflictTypesSet = new Set<ConflictType>();

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  for (const item of sale.items) {
    let liveMed: Medicine | null = null;

    if (preloadedMedicines && preloadedMedicines[item.id]) {
      liveMed = preloadedMedicines[item.id];
    } else if (isOnline && item.id) {
      try {
        const snap = await getDoc(doc(dbInstance as any || db, 'inventory', item.id));
        if (snap.exists()) {
          liveMed = { id: snap.id, ...snap.data() } as Medicine;
        }
      } catch (err) {
        console.warn(`[Conflict Engine] Could not fetch live doc for item ${item.id}:`, err);
      }
    }

    const itemConflictNotes: string[] = [];
    const isMissing = !liveMed;

    if (isMissing) {
      conflictTypesSet.add('missing_item');
      itemConflictNotes.push('Medicine is missing or removed from Cloud Database.');
    }

    const livePrice = liveMed ? Number(liveMed.rate) || 0 : undefined;
    const offlinePrice = Number(item.price) || 0;
    const priceDelta = livePrice !== undefined ? Math.round((offlinePrice - livePrice) * 100) / 100 : 0;
    const priceDiscrepancy = livePrice !== undefined && Math.abs(priceDelta) > 0.01;

    if (priceDiscrepancy) {
      conflictTypesSet.add('price_divergence');
      if (priceDelta < 0) {
        itemConflictNotes.push(`Sold offline at ₹${offlinePrice}, but live cloud rate increased to ₹${livePrice} (Undercharged ₹${Math.abs(priceDelta)})`);
      } else {
        itemConflictNotes.push(`Sold offline at ₹${offlinePrice}, but live cloud rate is ₹${livePrice} (Overcharged ₹${priceDelta})`);
      }
    }

    const liveStock = liveMed ? Number(liveMed.stockQuantity) || 0 : undefined;
    const offlineQty = Number(item.quantity) || 1;
    const projectedStock = liveStock !== undefined ? liveStock - offlineQty : -offlineQty;
    const stockDepletion = liveStock !== undefined && liveStock < offlineQty;

    if (stockDepletion) {
      conflictTypesSet.add('stock_depletion');
      itemConflictNotes.push(`Cloud stock has only ${liveStock} units available, but offline checkout sold ${offlineQty} units (${Math.abs(projectedStock)} unit deficit).`);
    }

    const hasItemConflict = isMissing || priceDiscrepancy || stockDepletion;

    conflicts.push({
      medicineId: item.id,
      medicineName: item.name,
      offlinePrice,
      livePrice,
      priceDiscrepancy,
      priceDelta,
      offlineQuantity: offlineQty,
      liveAvailableStock: liveStock,
      stockDepletionConflict: stockDepletion,
      projectedStockAfterDeduction: projectedStock,
      isItemMissingInCloud: isMissing,
      hasConflict: hasItemConflict,
      conflictNotes: itemConflictNotes,
    });
  }

  const hasConflicts = conflicts.some(c => c.hasConflict);
  const conflictTypes = Array.from(conflictTypesSet);

  let riskLevel: 'clean' | 'moderate' | 'high' = 'clean';
  let summaryMessage = 'All inventory items and prices match live database. Safe to merge.';

  if (conflictTypesSet.has('missing_item') || conflictTypesSet.has('stock_depletion')) {
    riskLevel = 'high';
    summaryMessage = 'High Priority: Stock depletion or missing item detected. Review required before merging.';
  } else if (conflictTypesSet.has('price_divergence')) {
    riskLevel = 'moderate';
    summaryMessage = 'Price divergence detected. Verify whether to honor offline price or re-rate.';
  }

  return {
    sale,
    hasConflicts,
    conflicts,
    conflictTypes,
    riskLevel,
    summaryMessage,
  };
}

/**
 * Diagnose all pending unsynced sales in IndexedDB
 */
export async function diagnoseAllPendingConflicts(): Promise<OfflineSaleConflictAnalysis[]> {
  const pending = await getPendingOfflineSales();
  if (pending.length === 0) return [];

  // Pre-fetch all live inventory items for high performance batch comparison
  const itemIds = new Set<string>();
  pending.forEach(sale => {
    sale.items.forEach(it => {
      if (it.id) itemIds.add(it.id);
    });
  });

  const preloaded: Record<string, Medicine> = {};
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const snap = await getDocs(collection(dbInstance as any || db, 'inventory'));
      snap.forEach(d => {
        if (itemIds.has(d.id)) {
          preloaded[d.id] = { id: d.id, ...d.data() } as Medicine;
        }
      });
    } catch (err) {
      console.warn('[Conflict Engine] Could not batch fetch live inventory:', err);
    }
  }

  const analyses: OfflineSaleConflictAnalysis[] = [];
  for (const sale of pending) {
    const analysis = await diagnoseSaleConflicts(sale, preloaded);
    analyses.push(analysis);
  }

  return analyses;
}

/**
 * Manually review and merge an offline sale into Firestore with resolved decisions
 */
export async function resolveAndMergeOfflineSale(
  saleId: string,
  decisions: Record<string, ConflictResolutionDecision> = {},
  resolutionNotes?: string,
  staffProfile?: { uid?: string; email?: string; displayName?: string }
): Promise<{ success: boolean; firestoreId?: string; error?: string }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { success: false, error: 'Cannot merge while offline. Internet connection is required.' };
  }

  try {
    const db = await openOfflineDB();
    const pendingSales = await getPendingOfflineSales();
    const sale = pendingSales.find(s => s.id === saleId);

    if (!sale) {
      return { success: false, error: `Sale record ${saleId} not found in pending offline ledger.` };
    }

    // Build finalized items based on resolution decisions
    let recalculatedTotal = 0;
    const finalItems: OfflineSaleItem[] = [];
    const auditDifferences: any[] = [];

    for (const item of sale.items) {
      const decision = decisions[item.id] || {
        strategy: 'honor_offline',
        deductStock: true,
      };

      let finalQty = item.quantity;
      let finalPrice = item.price;

      if (decision.strategy === 'apply_cloud_pricing' && decision.customPrice !== undefined) {
        finalPrice = decision.customPrice;
      } else if (decision.strategy === 'cap_to_live_stock' && decision.customQuantity !== undefined) {
        finalQty = Math.max(0, decision.customQuantity);
      } else if (decision.strategy === 'custom') {
        if (decision.customQuantity !== undefined) finalQty = decision.customQuantity;
        if (decision.customPrice !== undefined) finalPrice = decision.customPrice;
      }

      const itemTotal = Math.round(finalQty * finalPrice * 100) / 100;
      recalculatedTotal += itemTotal;

      finalItems.push({
        ...item,
        quantity: finalQty,
        price: finalPrice,
      });

      auditDifferences.push({
        itemId: item.id,
        name: item.name,
        offlineQty: item.quantity,
        finalQty,
        offlinePrice: item.price,
        finalPrice,
        deductStock: decision.deductStock,
        strategy: decision.strategy,
      });
    }

    // 1. Post to Firestore
    const salePayload: any = {
      timestamp: sale.timestamp,
      customerName: sale.customerName || 'Walk-in Customer',
      customerMobile: sale.customerMobile || '',
      items: finalItems,
      totalAmount: Math.round(recalculatedTotal * 100) / 100,
      paymentMethod: sale.paymentMethod,
      billingType: sale.billingType,
      staffId: staffProfile?.uid || sale.staffId || '',
      createdOffline: true,
      offlineLocalId: sale.id,
      syncedAt: new Date().toISOString(),
      resolvedManually: true,
      resolutionNotes: resolutionNotes || 'Manually merged via Sync Conflict Resolver',
      resolutionAudit: auditDifferences,
    };

    const docRef = await addDoc(collection(dbInstance as any || db, 'sales'), salePayload);
    const firestoreId = docRef.id;

    // 2. Adjust live stock according to resolution
    for (const diff of auditDifferences) {
      if (diff.deductStock && diff.itemId && diff.finalQty > 0) {
        try {
          const medDocRef = doc(dbInstance as any || db, 'inventory', diff.itemId);
          await updateDoc(medDocRef, {
            stockQuantity: increment(-diff.finalQty),
          });
        } catch (invErr) {
          console.warn(`[Conflict Resolver] Stock deduction skipped or failed for ${diff.itemId}:`, invErr);
        }
      }
    }

    // 3. Log Activity for traceability
    logActivity({
      type: 'sale',
      action: 'Offline POS Conflict Resolved & Merged',
      description: `Resolved & merged offline ${sale.billingType?.toUpperCase() || 'POS'} sale #${sale.id} (${finalItems.length} items, ₹${recalculatedTotal}). ${resolutionNotes ? `Note: ${resolutionNotes}` : ''}`,
      module: 'pos',
      severity: 'success',
      userEmail: staffProfile?.email || sale.staffEmail || 'staff@satyampharma.com',
      userName: staffProfile?.displayName || sale.staffName || 'Pharmacy Staff',
      details: {
        offlineId: sale.id,
        firestoreId,
        totalAmount: recalculatedTotal,
        resolutionNotes,
        auditDifferences,
      },
    });

    // 4. Update IndexedDB record
    const tx = db.transaction([STORE_SALES, STORE_AUDIT], 'readwrite');
    const salesStore = tx.objectStore(STORE_SALES);
    const auditStore = tx.objectStore(STORE_AUDIT);

    sale.synced = true;
    sale.firestoreId = firestoreId;
    salesStore.put(sale);

    const auditEntry: SyncAuditRecord = {
      id: `audit_${Date.now()}_${sale.id}`,
      saleId: sale.id,
      firestoreId,
      syncedAt: new Date().toISOString(),
      totalAmount: recalculatedTotal,
      itemCount: finalItems.length,
      status: 'synced',
      resolutionNote: resolutionNotes,
    };
    auditStore.put(auditEntry);

    await new Promise<void>((res) => {
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });

    // Dispatch broadcast events
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('offline-sales-updated'));
      window.dispatchEvent(
        new CustomEvent('offline-sync-completed', {
          detail: { successCount: 1, failCount: 0, errors: [], syncedSales: [sale] },
        })
      );
    }

    return { success: true, firestoreId };
  } catch (err: any) {
    console.error('[Conflict Resolver] Merge error:', err);
    return { success: false, error: err?.message || 'Error occurred during Firestore merge' };
  }
}

/**
 * Fast 1-click merge for all clean pending sales (0 conflicts)
 */
export async function mergeAllCleanSales(): Promise<{ successCount: number; failCount: number; errors: string[] }> {
  const analyses = await diagnoseAllPendingConflicts();
  const cleanAnalyses = analyses.filter(a => !a.hasConflicts);

  if (cleanAnalyses.length === 0) {
    return { successCount: 0, failCount: 0, errors: ['No clean pending sales found.'] };
  }

  let successCount = 0;
  let failCount = 0;
  const errors: string[] = [];

  for (const item of cleanAnalyses) {
    const res = await resolveAndMergeOfflineSale(item.sale.id, {}, 'Auto-merged clean verified transaction');
    if (res.success) {
      successCount++;
    } else {
      failCount++;
      if (res.error) errors.push(res.error);
    }
  }

  return { successCount, failCount, errors };
}

/**
 * Standard Pharmacy Policy: Auto-resolve and merge all pending offline transactions
 * (Honors offline billed price to respect customer receipt, force-deducts inventory, records discrepancy log)
 */
export async function batchAutoResolveAndMergeAll(): Promise<{ successCount: number; failCount: number; errors: string[] }> {
  const pending = await getPendingOfflineSales();
  let successCount = 0;
  let failCount = 0;
  const errors: string[] = [];

  for (const sale of pending) {
    const res = await resolveAndMergeOfflineSale(
      sale.id,
      {},
      'Standard Auto-Merge Policy: Honored offline receipt rates and deducted inventory'
    );
    if (res.success) {
      successCount++;
    } else {
      failCount++;
      if (res.error) errors.push(res.error);
    }
  }

  return { successCount, failCount, errors };
}

/**
 * Create a simulated offline transaction with intentional conflicts for testing & verification
 */
export async function createSimulatedOfflineConflictSale(
  scenario: 'stock_conflict' | 'price_conflict' | 'clean' = 'stock_conflict'
): Promise<OfflineSale> {
  let sampleMedicine: Medicine | null = null;

  try {
    const snap = await getDocs(collection(dbInstance as any || db, 'inventory'));
    if (!snap.empty) {
      sampleMedicine = { id: snap.docs[0].id, ...snap.docs[0].data() } as Medicine;
    }
  } catch (e) {
    console.warn('[Simulation] Using fallback item:', e);
  }

  const baseItem: OfflineSaleItem = {
    id: sampleMedicine?.id || 'med_paracetamol_650',
    name: sampleMedicine?.name || 'Paracetamol 650mg Tabs',
    price: scenario === 'price_conflict' 
      ? (Number(sampleMedicine?.rate || 30) - 8) // Divergent price
      : Number(sampleMedicine?.rate || 30),
    quantity: scenario === 'stock_conflict' 
      ? (Number(sampleMedicine?.stockQuantity || 5) + 20) // Exceeds cloud stock!
      : 2,
    batch: sampleMedicine?.batchNumber || 'BATCH-2026-X',
    unit: sampleMedicine?.type || 'strip',
  };

  const simulatedSale = await saveOfflineSale({
    timestamp: new Date().toISOString(),
    customerName: scenario === 'stock_conflict' ? 'Ramesh Patel (Test Conflict)' : scenario === 'price_conflict' ? 'Sunita Sharma (Test Rate Diff)' : 'Walk-in Customer (Offline)',
    customerMobile: '9876543210',
    items: [baseItem],
    totalAmount: baseItem.price * baseItem.quantity,
    paymentMethod: 'cash',
    billingType: 'retail',
    staffName: 'Pharmacist (Simulated Offline)',
    staffEmail: 'pharmacist@satyampharma.com',
  });

  return simulatedSale;
}
