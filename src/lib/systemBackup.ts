import { collection, getDocs, setDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { Medicine, Patient, Wholesaler } from '../types';
import { logActivity } from './logger';

export interface SystemStateMetadata {
  version: string;
  schemaVersion: number;
  appName: string;
  timestamp: string;
  generatedAt: string;
  userEmail?: string;
  medicinesCount: number;
  patientsCount: number;
  wholesalersCount: number;
  totalStockUnits: number;
  totalStockValue: number;
  id?: string;
  notes?: string;
}

export interface SystemStateSnapshot {
  meta: SystemStateMetadata;
  inventory: Medicine[];
  patients: Patient[];
  wholesalers: Wholesaler[];
}

export interface RestoreOptions {
  restoreInventory: boolean;
  restorePatients: boolean;
  restoreWholesalers?: boolean;
  mode: 'merge' | 'replace';
}

export interface RestoreResult {
  success: boolean;
  medicinesRestored: number;
  patientsRestored: number;
  wholesalersRestored: number;
  message: string;
  error?: string;
}

const LOCAL_STORAGE_KEY_LATEST = 'pharmacy_latest_system_snapshot';
const LOCAL_STORAGE_KEY_HISTORY = 'pharmacy_system_snapshots_history';
const MAX_LOCAL_SNAPSHOTS = 5;

/**
 * Creates a complete JSON snapshot of the system state (Inventory, Patients, Wholesalers)
 * and triggers a browser file download while maintaining local emergency recovery points.
 */
export async function createSystemStateBackup(userEmail?: string, notes?: string): Promise<{ snapshot: SystemStateSnapshot; filename: string }> {
  try {
    // 1. Fetch Inventory Collection
    const invSnap = await getDocs(collection(db, 'inventory'));
    const inventory: Medicine[] = invSnap.docs.map(d => ({ id: d.id, ...d.data() } as Medicine));

    // 2. Fetch Patients Collection
    const patientsSnap = await getDocs(collection(db, 'patients'));
    const patients: Patient[] = patientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Patient));

    // 3. Fetch Wholesalers Collection
    const wholesalersSnap = await getDocs(collection(db, 'wholesalers'));
    const wholesalers: Wholesaler[] = wholesalersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Wholesaler));

    // Calculate aggregated metrics
    let totalStockUnits = 0;
    let totalStockValue = 0;

    inventory.forEach(med => {
      const units = Number(med.stockQuantity) || 0;
      const rate = Number(med.rate) || 0;
      totalStockUnits += units;
      totalStockValue += units * rate;
    });

    const now = new Date();
    const timestampStr = now.toISOString();
    const snapshotId = `snap_${Date.now()}`;

    const metadata: SystemStateMetadata = {
      version: '2.5.0',
      schemaVersion: 2,
      appName: 'Satyam Medical Store & Pharmacy ERP',
      timestamp: timestampStr,
      generatedAt: now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      userEmail: userEmail || 'Pharmacist Admin',
      medicinesCount: inventory.length,
      patientsCount: patients.length,
      wholesalersCount: wholesalers.length,
      totalStockUnits,
      totalStockValue: Math.round(totalStockValue * 100) / 100,
      id: snapshotId,
      notes: notes || 'Manual 1-click snapshot for data sync safety',
    };

    const snapshot: SystemStateSnapshot = {
      meta: metadata,
      inventory,
      patients,
      wholesalers,
    };

    // 4. Download file to user device
    const dateFormatted = now.toISOString().slice(0, 10);
    const timeFormatted = now.toTimeString().slice(0, 5).replace(':', '');
    const filename = `system_state_backup_${dateFormatted}_${timeFormatted}.json`;

    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // 5. Store snapshot in local emergency cache for instant recovery
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_LATEST, JSON.stringify(snapshot));
      localStorage.setItem('last_backup_timestamp', Date.now().toString());

      // Update history list
      const existingHistoryStr = localStorage.getItem(LOCAL_STORAGE_KEY_HISTORY);
      let history: SystemStateSnapshot[] = [];
      if (existingHistoryStr) {
        try {
          history = JSON.parse(existingHistoryStr);
          if (!Array.isArray(history)) history = [];
        } catch {
          history = [];
        }
      }

      // Add to front of history, keeping up to MAX_LOCAL_SNAPSHOTS
      history = [snapshot, ...history.filter(s => s.meta.id !== snapshotId)].slice(0, MAX_LOCAL_SNAPSHOTS);
      localStorage.setItem(LOCAL_STORAGE_KEY_HISTORY, JSON.stringify(history));
    } catch (storageErr) {
      console.warn("Could not save snapshot to localStorage (quota or disabled):", storageErr);
    }

    // 6. Log activity for audit trail
    logActivity({
      type: 'system',
      action: 'System State Backup Created',
      description: `Exported JSON snapshot with ${inventory.length} medicines, ${patients.length} patients, and ${wholesalers.length} wholesalers.`,
      module: 'settings',
      severity: 'success',
      userEmail,
      details: {
        medicinesCount: inventory.length,
        patientsCount: patients.length,
        totalStockValue,
        filename,
      }
    });

    return { snapshot, filename };
  } catch (error: any) {
    console.error("System backup error:", error);
    throw new Error(error?.message || "Failed to create system state backup");
  }
}

/**
 * Validates a parsed JSON object to verify if it is a compatible SystemStateSnapshot
 */
export function validateSnapshotData(data: any): { valid: boolean; error?: string; snapshot?: SystemStateSnapshot } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Uploaded file is not a valid JSON object.' };
  }

  // Check if legacy backup format (without meta block)
  if (!data.meta && (Array.isArray(data.inventory) || Array.isArray(data.patients))) {
    const syntheticSnapshot: SystemStateSnapshot = {
      meta: {
        version: 'legacy',
        schemaVersion: 1,
        appName: 'Satyam Medical Store & Pharmacy ERP',
        timestamp: new Date().toISOString(),
        generatedAt: 'Imported from legacy backup',
        medicinesCount: Array.isArray(data.inventory) ? data.inventory.length : 0,
        patientsCount: Array.isArray(data.patients) ? data.patients.length : 0,
        wholesalersCount: Array.isArray(data.wholesalers) ? data.wholesalers.length : 0,
        totalStockUnits: 0,
        totalStockValue: 0,
      },
      inventory: Array.isArray(data.inventory) ? data.inventory : [],
      patients: Array.isArray(data.patients) ? data.patients : [],
      wholesalers: Array.isArray(data.wholesalers) ? data.wholesalers : [],
    };
    return { valid: true, snapshot: syntheticSnapshot };
  }

  if (!data.meta || typeof data.meta !== 'object') {
    return { valid: false, error: 'Snapshot is missing header metadata block.' };
  }

  if (!Array.isArray(data.inventory) && !Array.isArray(data.patients)) {
    return { valid: false, error: 'Snapshot does not contain valid inventory or patient records.' };
  }

  const snapshot: SystemStateSnapshot = {
    meta: {
      version: data.meta.version || '1.0',
      schemaVersion: data.meta.schemaVersion || 1,
      appName: data.meta.appName || 'Pharmacy ERP',
      timestamp: data.meta.timestamp || new Date().toISOString(),
      generatedAt: data.meta.generatedAt || new Date().toLocaleString(),
      userEmail: data.meta.userEmail,
      medicinesCount: Array.isArray(data.inventory) ? data.inventory.length : 0,
      patientsCount: Array.isArray(data.patients) ? data.patients.length : 0,
      wholesalersCount: Array.isArray(data.wholesalers) ? data.wholesalers.length : 0,
      totalStockUnits: data.meta.totalStockUnits || 0,
      totalStockValue: data.meta.totalStockValue || 0,
      id: data.meta.id || `imported_${Date.now()}`,
      notes: data.meta.notes,
    },
    inventory: Array.isArray(data.inventory) ? data.inventory : [],
    patients: Array.isArray(data.patients) ? data.patients : [],
    wholesalers: Array.isArray(data.wholesalers) ? data.wholesalers : [],
  };

  return { valid: true, snapshot };
}

/**
 * Restores system state from a verified snapshot into Firestore
 */
export async function restoreSystemState(
  snapshot: SystemStateSnapshot,
  options: RestoreOptions,
  userEmail?: string,
  onProgress?: (progressText: string, percentage: number) => void
): Promise<RestoreResult> {
  let medicinesRestored = 0;
  let patientsRestored = 0;
  let wholesalersRestored = 0;

  try {
    const totalSteps = 
      (options.restoreInventory ? snapshot.inventory.length : 0) +
      (options.restorePatients ? snapshot.patients.length : 0) +
      (options.restoreWholesalers ? snapshot.wholesalers.length : 0);

    let completedSteps = 0;

    const reportProgress = (msg: string) => {
      completedSteps++;
      const pct = totalSteps > 0 ? Math.min(100, Math.round((completedSteps / totalSteps) * 100)) : 100;
      if (onProgress) onProgress(msg, pct);
    };

    // 1. Restore Inventory Items
    if (options.restoreInventory && snapshot.inventory.length > 0) {
      if (onProgress) onProgress(`Restoring ${snapshot.inventory.length} inventory medicines...`, 5);
      
      // Batch writes in chunks of 300 to stay within Firestore limits
      const chunkSize = 300;
      for (let i = 0; i < snapshot.inventory.length; i += chunkSize) {
        const chunk = snapshot.inventory.slice(i, i + chunkSize);
        const batch = writeBatch(db);

        for (const item of chunk) {
          const docId = item.id || `med_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          const docRef = doc(db, 'inventory', docId);
          // Clone to prevent mutating input
          const cleanItem = { ...item };
          delete (cleanItem as any).id;
          
          batch.set(docRef, cleanItem, { merge: options.mode === 'merge' });
          medicinesRestored++;
          reportProgress(`Restoring inventory: ${item.name || docId}`);
        }

        await batch.commit();
      }
    }

    // 2. Restore Patients
    if (options.restorePatients && snapshot.patients.length > 0) {
      if (onProgress) onProgress(`Restoring ${snapshot.patients.length} patient clinical records...`, 50);

      const chunkSize = 300;
      for (let i = 0; i < snapshot.patients.length; i += chunkSize) {
        const chunk = snapshot.patients.slice(i, i + chunkSize);
        const batch = writeBatch(db);

        for (const patient of chunk) {
          const docId = patient.id || `patient_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          const docRef = doc(db, 'patients', docId);
          const cleanPatient = { ...patient };
          delete (cleanPatient as any).id;

          batch.set(docRef, cleanPatient, { merge: options.mode === 'merge' });
          patientsRestored++;
          reportProgress(`Restoring patient: ${patient.name || docId}`);
        }

        await batch.commit();
      }
    }

    // 3. Restore Wholesalers (if requested)
    if (options.restoreWholesalers && snapshot.wholesalers.length > 0) {
      if (onProgress) onProgress(`Restoring ${snapshot.wholesalers.length} wholesaler distributors...`, 85);

      const chunkSize = 300;
      for (let i = 0; i < snapshot.wholesalers.length; i += chunkSize) {
        const chunk = snapshot.wholesalers.slice(i, i + chunkSize);
        const batch = writeBatch(db);

        for (const wholesaler of chunk) {
          const docId = wholesaler.id || `wholesaler_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          const docRef = doc(db, 'wholesalers', docId);
          const cleanWholesaler = { ...wholesaler };
          delete (cleanWholesaler as any).id;

          batch.set(docRef, cleanWholesaler, { merge: options.mode === 'merge' });
          wholesalersRestored++;
          reportProgress(`Restoring wholesaler: ${wholesaler.name || docId}`);
        }

        await batch.commit();
      }
    }

    if (onProgress) onProgress('System state recovery completed successfully!', 100);

    // 4. Log recovery in audit trail
    logActivity({
      type: 'system',
      action: 'System State Recovered from Snapshot',
      description: `Restored ${medicinesRestored} medicines, ${patientsRestored} patients, and ${wholesalersRestored} wholesalers (Mode: ${options.mode}).`,
      module: 'settings',
      severity: 'warning',
      userEmail,
      details: {
        medicinesRestored,
        patientsRestored,
        wholesalersRestored,
        mode: options.mode,
        snapshotDate: snapshot.meta.generatedAt,
      }
    });

    return {
      success: true,
      medicinesRestored,
      patientsRestored,
      wholesalersRestored,
      message: `Successfully restored ${medicinesRestored} medicines and ${patientsRestored} patient profiles.`,
    };
  } catch (err: any) {
    console.error("System state restore failed:", err);
    return {
      success: false,
      medicinesRestored,
      patientsRestored,
      wholesalersRestored,
      message: 'Failed to restore database state from snapshot.',
      error: err?.message || 'Database error occurred during restoration',
    };
  }
}

/**
 * Retrieves the list of emergency recovery points stored locally in the browser
 */
export function getLocalRecoverySnapshots(): SystemStateSnapshot[] {
  try {
    const historyStr = localStorage.getItem(LOCAL_STORAGE_KEY_HISTORY);
    if (historyStr) {
      const history = JSON.parse(historyStr);
      if (Array.isArray(history) && history.length > 0) {
        return history;
      }
    }

    // Fallback to latest single snapshot
    const latestStr = localStorage.getItem(LOCAL_STORAGE_KEY_LATEST);
    if (latestStr) {
      const single = JSON.parse(latestStr);
      if (single?.meta) return [single];
    }
  } catch (err) {
    console.warn("Could not read local recovery snapshots:", err);
  }
  return [];
}

/**
 * Deletes a snapshot from local storage history
 */
export function deleteLocalRecoverySnapshot(snapshotId: string): void {
  try {
    const history = getLocalRecoverySnapshots().filter(s => s.meta.id !== snapshotId);
    localStorage.setItem(LOCAL_STORAGE_KEY_HISTORY, JSON.stringify(history));
    if (history.length === 0) {
      localStorage.removeItem(LOCAL_STORAGE_KEY_LATEST);
    } else {
      localStorage.setItem(LOCAL_STORAGE_KEY_LATEST, JSON.stringify(history[0]));
    }
  } catch (err) {
    console.warn("Could not delete local snapshot:", err);
  }
}
