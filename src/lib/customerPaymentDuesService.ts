/**
 * Customer Payment Dues & Reminders Service
 * Manages pending customer credit balances and due dates in Firestore.
 */

import { collection, addDoc, getDocs, updateDoc, doc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

export interface CustomerDue {
  id: string;
  customerName: string;
  customerMobile: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  invoiceNo?: string;
  saleId?: string;
  status: 'pending' | 'paid' | 'overdue';
  notes?: string;
  createdAt: string;
  paidAt?: string;
}

const COLLECTION_NAME = 'customer_dues';
const LOCAL_STORAGE_KEY = 'satyam_customer_dues_cache';

/**
 * Creates a new pending customer payment with due date in the database
 */
export async function createCustomerDue(dueData: Omit<CustomerDue, 'id' | 'createdAt' | 'status'> & { status?: 'pending' | 'paid' | 'overdue' }): Promise<string> {
  const payload = {
    customerName: dueData.customerName || 'Walk-in Customer',
    customerMobile: dueData.customerMobile || '',
    amount: Number(dueData.amount) || 0,
    dueDate: dueData.dueDate,
    invoiceNo: dueData.invoiceNo || '',
    saleId: dueData.saleId || '',
    status: dueData.status || 'pending',
    notes: dueData.notes || '',
    createdAt: new Date().toISOString(),
  };

  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), payload);
    return docRef.id;
  } catch (err) {
    console.warn('Could not save due to Firestore, persisting to local cache:', err);
    const existing = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    const id = `local-due-${Date.now()}`;
    existing.unshift({ id, ...payload });
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existing));
    return id;
  }
}

/**
 * Fetches all customer payment dues
 */
export async function fetchCustomerDues(): Promise<CustomerDue[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('dueDate', 'asc'));
    const snap = await getDocs(q);
    const dues = snap.docs.map(d => {
      const data = d.data();
      const today = new Date().toISOString().split('T')[0];
      let currentStatus: 'pending' | 'paid' | 'overdue' = data.status || 'pending';
      if (currentStatus !== 'paid' && data.dueDate < today) {
        currentStatus = 'overdue';
      }
      return {
        id: d.id,
        ...data,
        status: currentStatus
      } as CustomerDue;
    });

    if (dues.length > 0) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dues));
      return dues;
    }
  } catch (err) {
    console.warn('Failed to fetch dues from Firestore:', err);
  }

  // Fallback to local cache
  const localDues: CustomerDue[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
  const today = new Date().toISOString().split('T')[0];
  return localDues.map(d => ({
    ...d,
    status: d.status !== 'paid' && d.dueDate < today ? 'overdue' : d.status
  }));
}

/**
 * Marks a due as paid in the database
 */
export async function markCustomerDueAsPaid(id: string): Promise<void> {
  try {
    if (!id.startsWith('local-due-')) {
      const dueRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(dueRef, {
        status: 'paid',
        paidAt: new Date().toISOString()
      });
    }
  } catch (err) {
    console.warn('Error updating due in Firestore:', err);
  }

  // Update local cache
  const existing: CustomerDue[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
  const updated = existing.map(d => d.id === id ? { ...d, status: 'paid' as const, paidAt: new Date().toISOString() } : d);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
}
