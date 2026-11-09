import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale, SaleItem } from '../types';
import { formatCurrency } from './utils';

export interface InvoiceData {
  id?: string;
  invoiceNo?: string;
  timestamp: string;
  customerName?: string;
  customerMobile?: string;
  doctorName?: string;
  doctorRegNo?: string;
  items: SaleItem[];
  totalAmount: number;
  subtotal?: number;
  discountAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  taxAmount?: number;
  paymentMethod: 'cash' | 'card' | 'upi' | 'credit' | string;
  billingType: 'retail' | 'gst' | 'tax_invoice' | string;
  staffName?: string;
  staffEmail?: string;
  pharmacyName?: string;
  pharmacyAddress?: string;
  gstin?: string;
  dlNumber?: string;
  contactNumber?: string;
  email?: string;
  notes?: string;
}

/**
 * Converts a numeric amount into words in Indian Numbering System (e.g. Rupees Four Hundred Fifty Only)
 */
export function numberToWordsIndian(num: number): string {
  const rounded = Math.round(num);
  if (rounded === 0) return 'Rupees Zero Only';

  const a = [
    '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ',
    'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n: number): string => {
    let str = '';
    if (n > 99) {
      str += a[Math.floor(n / 100)] + 'Hundred ';
      n %= 100;
      if (n > 0) str += 'and ';
    }
    if (n > 19) {
      str += b[Math.floor(n / 10)] + ' ' + a[n % 10];
    } else if (n > 0) {
      str += a[n];
    }
    return str;
  };

  let result = '';
  const crore = Math.floor(rounded / 10000000);
  let rem = rounded % 10000000;
  const lakh = Math.floor(rem / 100000);
  rem %= 100000;
  const thousand = Math.floor(rem / 1000);
  rem %= 1000;

  if (crore > 0) result += inWords(crore) + 'Crore ';
  if (lakh > 0) result += inWords(lakh) + 'Lakh ';
  if (thousand > 0) result += inWords(thousand) + 'Thousand ';
  if (rem > 0) result += inWords(rem);

  return `Rupees ${result.trim()} Only`;
}

/**
 * Generates a jsPDF instance configured for professional pharmacy invoices
 */
export function createInvoicePDFDoc(data: InvoiceData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const invoiceNo = data.invoiceNo || (data.id ? `INV-${data.id.slice(-6).toUpperCase()}` : `INV-${Date.now().toString().slice(-6)}`);
  const dateObj = data.timestamp ? new Date(data.timestamp) : new Date();
  const dateStr = dateObj.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = dateObj.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const pharmacyName = data.pharmacyName || 'SATYAM PHARMA & MEDICAL STORES';
  const pharmacyAddress = data.pharmacyAddress || '123 Healthcare Complex, Station Road, Raipur (C.G.) - 492001';
  const dlNo = data.dlNumber || 'DL: 20B/21B-CG-2024-8849';
  const gstin = data.gstin || 'GSTIN: 22AAAAA0000A1Z5';
  const contact = data.contactNumber || 'Ph: +91 98765 43210 | Email: contact@satyampharma.com';

  const billingTitle = 
    data.billingType === 'gst' || data.billingType === 'tax_invoice'
      ? 'TAX INVOICE (GST COMPLIANT)'
      : 'RETAIL PHARMACY CASH MEMO';

  // --- HEADER DECORATION ---
  // Top header bar (Navy / Slate-900)
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 36, 'F');

  // Pharmacy Brand Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(pharmacyName, 14, 12);

  // Pharmacy Sub-text & Credentials
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(pharmacyAddress, 14, 18);
  doc.text(`${dlNo}  |  ${gstin}`, 14, 24);
  doc.text(contact, 14, 30);

  // Header Right: Title Badge
  doc.setFillColor(30, 41, 59); // slate-800
  doc.roundedRect(132, 7, 68, 22, 2, 2, 'F');
  doc.setTextColor(56, 189, 248); // sky-400
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(billingTitle, 166, 14, { align: 'center' });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text(invoiceNo, 166, 22, { align: 'center' });

  // --- METADATA SECTION BOX ---
  let startY = 42;
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(14, startY, 182, 28, 2, 2, 'FD');

  // Customer / Patient Column (Left)
  doc.setTextColor(100, 116, 139); // slate-500
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('PATIENT / CUSTOMER DETAILS:', 20, startY + 6);

  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text(data.customerName || 'Walk-in Customer', 20, startY + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Mobile: ${data.customerMobile || 'Not Provided'}`, 20, startY + 19);
  doc.text(`Doctor: ${data.doctorName || 'Self / General OPD'}`, 20, startY + 24);

  // Vertical Divider
  doc.setDrawColor(226, 232, 240);
  doc.line(110, startY + 3, 110, startY + 25);

  // Invoice & Payment Details (Right)
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('BILLING & PAYMENT INFO:', 116, startY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Date & Time: ${dateStr}, ${timeStr}`, 116, startY + 12);
  doc.text(`Payment Mode: ${(data.paymentMethod || 'CASH').toUpperCase()}`, 116, startY + 18);
  doc.text(`Dispensed By: ${data.staffName || 'Registered Pharmacist'}`, 116, startY + 24);

  // --- ITEMS TABLE ---
  const tableRows = data.items.map((item, index) => {
    const itemTotal = (item.price || item.rate || 0) * item.quantity;
    const batch = item.batchNumber || 'GEN-01';
    const hsn = '3004';
    const rateFormatted = formatCurrency(item.price || item.rate || 0);
    const amountFormatted = formatCurrency(itemTotal);

    return [
      (index + 1).toString(),
      item.name || item.medicineName || 'Medicine Item',
      hsn,
      batch,
      `${item.quantity} ${item.unit || 'Units'}`,
      rateFormatted,
      '0%',
      amountFormatted,
    ];
  });

  const tableStartY = startY + 33;

  autoTable(doc, {
    startY: tableStartY,
    head: [['#', 'Item Description', 'HSN', 'Batch', 'Qty', 'MRP/Rate', 'Disc', 'Net Amount']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'left', cellWidth: 70 },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'center', cellWidth: 20 },
      4: { halign: 'center', cellWidth: 16 },
      5: { halign: 'right', cellWidth: 22 },
      6: { halign: 'center', cellWidth: 12 },
      7: { halign: 'right', cellWidth: 24 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
  });

  const finalTableY = (doc as any).lastAutoTable?.finalY || (tableStartY + 40);

  // --- FINANCIAL BREAKDOWN BOX & AMOUNT IN WORDS ---
  const totalsBoxY = finalTableY + 4;
  const taxableSubtotal = data.subtotal || data.totalAmount;
  const gstRate = 0.12; // 12% GST average pharma standard for tax invoice breakdown display
  const isGstBill = data.billingType === 'gst' || data.billingType === 'tax_invoice';
  const cgstVal = isGstBill ? (taxableSubtotal * (gstRate / 2)) : 0;
  const sgstVal = isGstBill ? (taxableSubtotal * (gstRate / 2)) : 0;
  const grandTotal = isGstBill ? (taxableSubtotal + cgstVal + sgstVal) : data.totalAmount;

  // Left Box: Amount in Words & Notes
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, totalsBoxY, 110, 36, 1.5, 1.5, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('AMOUNT IN WORDS:', 18, totalsBoxY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const words = numberToWordsIndian(grandTotal);
  doc.text(words, 18, totalsBoxY + 12, { maxWidth: 102 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Payment Status: `, 18, totalsBoxY + 22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129); // emerald-600
  doc.text(`COMPLETED / PAID (${(data.paymentMethod || 'CASH').toUpperCase()})`, 44, totalsBoxY + 22);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Thank you for trusting Satyam Pharma for your healthcare.', 18, totalsBoxY + 30);

  // Right Box: Financial Calculation Totals
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(128, totalsBoxY, 68, 36, 1.5, 1.5, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  let curY = totalsBoxY + 6;
  doc.text('Subtotal (Gross):', 132, curY);
  doc.text(formatCurrency(taxableSubtotal), 192, curY, { align: 'right' });

  if (isGstBill) {
    curY += 5;
    doc.text('CGST (6%):', 132, curY);
    doc.text(formatCurrency(cgstVal), 192, curY, { align: 'right' });

    curY += 5;
    doc.text('SGST (6%):', 132, curY);
    doc.text(formatCurrency(sgstVal), 192, curY, { align: 'right' });
  } else {
    curY += 5;
    doc.text('Discount / Roundoff:', 132, curY);
    doc.text(formatCurrency(0), 192, curY, { align: 'right' });

    curY += 5;
    doc.text('Tax Included (MRP):', 132, curY);
    doc.text('Incl. in MRP', 192, curY, { align: 'right' });
  }

  // Grand Total Highlight Ribbon
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(128, totalsBoxY + 24, 68, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('NET PAYABLE:', 132, totalsBoxY + 31.5);
  doc.setFontSize(10.5);
  doc.setTextColor(56, 189, 248); // sky-400
  doc.text(formatCurrency(grandTotal), 192, totalsBoxY + 31.5, { align: 'right' });

  // --- STATUTORY TERMS & PHARMACIST SIGNATURE ---
  const footerY = totalsBoxY + 42;

  // Terms (Left)
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('TERMS & CONDITIONS:', 14, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('1. Goods once sold cannot be returned without original cash memo/bill.', 14, footerY + 4);
  doc.text('2. Refrigerated products & opened strips/syrups are strictly non-returnable.', 14, footerY + 8);
  doc.text('3. Schedule H/H1 drugs are dispensed only against valid medical prescription.', 14, footerY + 12);
  doc.text('4. Store all medications in a cool, dry place away from direct sunlight.', 14, footerY + 16);

  // Signature Block (Right)
  doc.setDrawColor(203, 213, 225);
  doc.line(140, footerY + 14, 196, footerY + 14);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('For SATYAM PHARMA', 168, footerY + 5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Authorized Signatory / Reg. Pharmacist', 168, footerY + 18, { align: 'center' });

  // Bottom Computer Generated Note
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`This is a computer generated tax invoice. Generated on ${dateStr} ${timeStr}.`, 105, 288, { align: 'center' });

  return doc;
}

/**
 * Generates an object URL for embedding PDF in iframe/modal preview
 */
export function generateInvoicePdfBlobUrl(data: InvoiceData): string {
  const doc = createInvoicePDFDoc(data);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}

/**
 * Direct file download trigger for invoice PDF
 */
export function downloadInvoicePDF(data: InvoiceData): string {
  const doc = createInvoicePDFDoc(data);
  const invoiceNo = data.invoiceNo || (data.id ? `INV-${data.id.slice(-6).toUpperCase()}` : `INV-${Date.now().toString().slice(-6)}`);
  const filename = `Invoice_${invoiceNo}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * Triggers native browser print dialog for the generated invoice PDF
 */
export function printInvoicePDF(data: InvoiceData): void {
  const doc = createInvoicePDFDoc(data);
  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = blobUrl;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.warn('Print dialog notice:', e);
      }
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
        URL.revokeObjectURL(blobUrl);
      }, 2000);
    }, 400);
  };
}

/**
 * Formats a clean WhatsApp text receipt message
 */
export function formatWhatsAppInvoiceText(data: InvoiceData): string {
  const invoiceNo = data.invoiceNo || (data.id ? `INV-${data.id.slice(-6).toUpperCase()}` : `INV-${Date.now().toString().slice(-6)}`);
  const dateStr = new Date(data.timestamp || Date.now()).toLocaleDateString('en-IN');
  
  let msg = `🏥 *SATYAM PHARMA & MEDICAL STORES*\n`;
  msg += `📄 *Invoice:* ${invoiceNo}\n`;
  msg += `📅 *Date:* ${dateStr}\n`;
  msg += `👤 *Customer:* ${data.customerName || 'Customer'}\n\n`;
  msg += `*Prescribed Items:*\n`;

  data.items.forEach((item, i) => {
    msg += `${i + 1}. ${item.name} (x${item.quantity}) - ${formatCurrency((item.price || item.rate || 0) * item.quantity)}\n`;
  });

  msg += `\n💰 *Total Amount:* ${formatCurrency(data.totalAmount)}\n`;
  msg += `💳 *Payment Mode:* ${(data.paymentMethod || 'CASH').toUpperCase()}\n\n`;
  msg += `Thank you for your visit! Wishing you good health. 🌿`;

  return encodeURIComponent(msg);
}
