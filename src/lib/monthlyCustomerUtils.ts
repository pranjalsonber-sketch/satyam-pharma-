import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Patient, MonthlyMedicineItem, MonthlyDispensationRecord, Medicine } from '../types';
import { formatCurrency } from './utils';

export interface MonthRefillStatus {
  status: 'dispensed' | 'due' | 'overdue' | 'upcoming';
  label: string;
  badgeClass: string;
  daysRemainingOrOverdue: number;
  scheduledDate: Date;
  dispensationRecord?: MonthlyDispensationRecord;
}

/**
 * Calculates the refill status of a monthly customer for a specific month
 * @param patient The patient object
 * @param targetMonthDate Date object representing the month (defaults to current date)
 */
export function getMonthlyRefillStatus(
  patient: Patient,
  targetMonthDate: Date = new Date()
): MonthRefillStatus {
  const year = targetMonthDate.getFullYear();
  const month = targetMonthDate.getMonth(); // 0-indexed
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  
  // Check if already dispensed in this target month
  const disp = patient.monthlyDispensations?.find(d => d.monthKey === monthKey && d.status === 'dispensed');
  if (disp) {
    const dispDate = new Date(disp.dispensedDate);
    return {
      status: 'dispensed',
      label: `Dispensed on ${dispDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}`,
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800',
      daysRemainingOrOverdue: 0,
      scheduledDate: dispDate,
      dispensationRecord: disp
    };
  }

  const preferredDay = Math.min(Math.max(1, patient.preferredDayOfMonth || 1), 28);
  const scheduledDate = new Date(year, month, preferredDay, 12, 0, 0);
  const now = new Date();
  
  // Set both to midnight for day comparison
  const schedMidnight = new Date(year, month, preferredDay).setHours(0, 0, 0, 0);
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).setHours(0, 0, 0, 0);
  
  const diffDays = Math.round((schedMidnight - nowMidnight) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: 'overdue',
      label: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`,
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800',
      daysRemainingOrOverdue: Math.abs(diffDays),
      scheduledDate
    };
  } else if (diffDays === 0) {
    return {
      status: 'due',
      label: 'Due Today',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800 animate-pulse',
      daysRemainingOrOverdue: 0,
      scheduledDate
    };
  } else if (diffDays <= 5) {
    return {
      status: 'due',
      label: `Due in ${diffDays} day${diffDays === 1 ? '' : 's'} (${scheduledDate.toLocaleDateString([], { month: 'short', day: 'numeric' })})`,
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
      daysRemainingOrOverdue: diffDays,
      scheduledDate
    };
  } else {
    return {
      status: 'upcoming',
      label: `Scheduled on ${scheduledDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}`,
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      daysRemainingOrOverdue: diffDays,
      scheduledDate
    };
  }
}

/**
 * Calculates total estimated monthly package value for a patient
 */
export function calculateMonthlyPackageTotal(items?: MonthlyMedicineItem[]): number {
  if (!items || items.length === 0) return 0;
  return items
    .filter(i => i.isActive !== false)
    .reduce((sum, item) => sum + ((item.estimatedRate || 0) * (item.monthlyQuantity || 1)), 0);
}

/**
 * Generates formatted WhatsApp text for Monthly Customer reminder / medicine list
 */
export function generateMonthlyCustomerWhatsAppText(
  patient: Patient,
  monthLabel: string = new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
  pharmacyName: string = 'Satyam Medical & Pharmacy Store'
): string {
  const activeItems = (patient.monthlyMedicines || []).filter(i => i.isActive !== false);
  const totalVal = calculateMonthlyPackageTotal(activeItems);

  let msg = `🏥 *${pharmacyName}*\n`;
  msg += `📋 *Monthly Medicine Refill Schedule - ${monthLabel}*\n\n`;
  msg += `Namaste *${patient.name}* ji 🙏,\n`;
  msg += `Here is your recurring monthly medication package schedule for *${monthLabel}*:\n\n`;

  if (activeItems.length > 0) {
    activeItems.forEach((item, index) => {
      msg += `${index + 1}. *${item.name}*\n`;
      msg += `   • Dosage: ${item.dosage || 'As prescribed'}\n`;
      msg += `   • Monthly Qty: *${item.monthlyQuantity} ${item.unit || 'Units'}*`;
      if (item.estimatedRate) {
        msg += ` (₹${(item.estimatedRate * item.monthlyQuantity).toFixed(2)})`;
      }
      if (item.instructions) {
        msg += `\n   • Note: _${item.instructions}_`;
      }
      msg += `\n`;
    });

    if (totalVal > 0) {
      msg += `\n💰 *Total Estimated Amount: ₹${totalVal.toFixed(2)}*\n`;
    }
  } else {
    msg += `No active monthly medicines currently listed.\n`;
  }

  const preferredDay = patient.preferredDayOfMonth || 5;
  msg += `\n📅 *Preferred Refill Date:* ${preferredDay}th of the month\n`;
  msg += `\nYour medication package is ready for collection or dispatch. Please reply here or call us if you need any adjustments or free doorstep delivery.\n\n`;
  msg += `📞 Contact: +91 98765 43210\nStay Healthy & Take Care! ✨`;

  return msg;
}

/**
 * Generates a clean PDF Refill Slip for printing / packing
 */
export function generateMonthlyRefillSlipPDF(
  patient: Patient,
  monthLabel: string = new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
  pharmacyName: string = 'SATYAM PHARMA & MEDICAL STORE'
) {
  const activeItems = (patient.monthlyMedicines || []).filter(i => i.isActive !== false);
  const totalVal = calculateMonthlyPackageTotal(activeItems);

  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(pharmacyName, 105, 18, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('123 Healthcare Complex, Main Road • Contact: +91 98765 43210 • GSTIN: 24AAAAA0000A1Z5', 105, 24, { align: 'center' });
  doc.text(`MONTHLY PATIENT MEDICATION REFILL SCHEDULE - ${monthLabel.toUpperCase()}`, 105, 30, { align: 'center' });

  doc.setDrawColor(203, 213, 225);
  doc.line(14, 34, 196, 34);

  // Patient Details Box
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(14, 38, 182, 28, 3, 3, 'F');

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Patient Name: ${patient.name}`, 20, 46);
  doc.text(`Mobile: ${patient.mobile || 'N/A'}`, 120, 46);

  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Age/Gender: ${patient.age ? `${patient.age} Yrs` : 'N/A'} / ${patient.gender || 'Patient'}`, 20, 54);
  doc.text(`Refill Day: ${patient.preferredDayOfMonth || 5}th of every month`, 120, 54);

  if (patient.chronicConditions && patient.chronicConditions.length > 0) {
    doc.text(`Chronic Conditions: ${patient.chronicConditions.join(', ')}`, 20, 62);
  } else {
    doc.text(`Refill Cycle: Monthly Recurring Package`, 20, 62);
  }

  if (patient.allergies && patient.allergies.length > 0) {
    doc.setTextColor(220, 38, 38);
    doc.text(`Known Allergies: ${patient.allergies.join(', ')}`, 120, 62);
    doc.setTextColor(71, 85, 105);
  }

  // Table of Monthly Medicines
  const tableData = activeItems.map((item, idx) => [
    idx + 1,
    item.name,
    item.dosage || 'As advised',
    `${item.monthlyQuantity} ${item.unit || 'Units'}`,
    item.estimatedRate ? `Rs. ${item.estimatedRate.toFixed(2)}` : '-',
    item.estimatedRate ? `Rs. ${(item.estimatedRate * item.monthlyQuantity).toFixed(2)}` : '-',
    item.instructions || '-'
  ]);

  autoTable(doc, {
    startY: 72,
    head: [['#', 'Medicine Name', 'Dosage / Timing', 'Monthly Qty', 'Unit Rate', 'Subtotal', 'Special Advice']],
    body: tableData.length > 0 ? tableData : [['-', 'No medicines currently listed', '-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: {
      fillColor: [37, 99, 235], // blue-600
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3.5,
      textColor: [30, 41, 59]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 140;

  // Summary box
  doc.setFillColor(239, 246, 255); // blue-50
  doc.roundedRect(14, finalY + 6, 182, 16, 2, 2, 'F');
  doc.setFontSize(10);
  doc.setTextColor(30, 58, 138); // blue-900
  doc.text(`Total Medicines: ${activeItems.length} item(s)`, 20, finalY + 16);
  if (totalVal > 0) {
    doc.text(`Estimated Monthly Package Total: Rs. ${totalVal.toFixed(2)}`, 120, finalY + 16);
  }

  // Instructions & Signature
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Important: Store medications in a cool, dry place away from direct sunlight. Take strictly as advised by your physician.', 14, finalY + 30);

  doc.setDrawColor(203, 213, 225);
  doc.line(14, finalY + 45, 70, finalY + 45);
  doc.line(140, finalY + 45, 196, finalY + 45);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Pharmacist Signature & Stamp', 14, finalY + 50);
  doc.text('Customer Acknowledgement', 140, finalY + 50);

  doc.save(`Monthly_Refill_${patient.name.replace(/\s+/g, '_')}_${monthLabel.replace(/\s+/g, '_')}.pdf`);
}
