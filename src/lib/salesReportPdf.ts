import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale } from '../types';

export interface SalesReportSummary {
  dateRangeLabel: string;
  startDate?: string;
  endDate?: string;
  generatedAt: Date;
  generatedBy: string;
  userRole: string;
  totalRevenue: number;
  totalTransactions: number;
  averageOrderValue: number;
  totalItemsSold: number;
  paymentBreakdown: {
    cash: number;
    cashCount: number;
    upi: number;
    upiCount: number;
    card: number;
    cardCount: number;
  };
  billingBreakdown: {
    retail: number;
    gst: number;
    tax_invoice: number;
  };
  topSellingMedicines: {
    name: string;
    quantity: number;
    revenue: number;
  }[];
  pharmacyName?: string;
  pharmacyAddress?: string;
  gstin?: string;
  dlNumber?: string;
  contactNumber?: string;
}

export const formatINR = (val: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(val);
};

export const generateSalesReportPDF = (
  sales: Sale[],
  summary: SalesReportSummary,
  filterType: string = 'all'
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const reportId = `SALES-REP-${Date.now().toString().slice(-6)}`;
  const dateStr = summary.generatedAt.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // --- HEADER SECTION ---
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, 210, 30, 'F');

  // Title & Pharmacy Info
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(summary.pharmacyName || 'SATYAM MEDICAL & PHARMACY ERP', 14, 11);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(
    `DL: ${summary.dlNumber || '20B/21B-MH-102948'} | GSTIN: ${summary.gstin || '27AAAAA0000A1Z5'} | Ph: ${summary.contactNumber || '+91 98765 43210'}`,
    14,
    17
  );
  doc.text(
    summary.pharmacyAddress || 'Central Healthcare Complex, Station Road, Raipur (C.G.)',
    14,
    22
  );

  doc.setFontSize(7.5);
  doc.setTextColor(56, 189, 248); // sky-400
  doc.text(`OFFICIAL REVENUE & SALES AUDIT STATEMENT`, 14, 27);

  // Top Right Report Metadata
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(`REPORT #${reportId}`, 196, 11, { align: 'right' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`Period: ${summary.dateRangeLabel}`, 196, 16, { align: 'right' });
  doc.text(`Generated: ${dateStr}`, 196, 21, { align: 'right' });
  doc.text(`Auditor: ${summary.generatedBy} (${summary.userRole.toUpperCase()})`, 196, 26, { align: 'right' });

  // --- EXECUTIVE SUMMARY METRICS BANNER ---
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 34, 182, 22, 2, 2, 'FD');

  // Metric 1: Total Revenue
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('GROSS SALES REVENUE', 18, 40);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatINR(summary.totalRevenue), 18, 47);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(16, 185, 129); // emerald-500
  doc.text(`${summary.totalTransactions} Invoices Billed`, 18, 52);

  // Metric 2: Average Order Value (AOV)
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('AVG BASKET VALUE (AOV)', 66, 40);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 99, 235); // blue-600
  doc.text(formatINR(summary.averageOrderValue), 66, 47);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Per completed sale', 66, 52);

  // Metric 3: Total Units Sold
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL UNITS SOLD', 114, 40);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${summary.totalItemsSold} Units`, 114, 47);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Dispensed inventory', 114, 52);

  // Metric 4: Top Payment Mode
  const topPayment = summary.paymentBreakdown.upi >= summary.paymentBreakdown.cash ? 'UPI / Digital' : 'Cash Counter';
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('DOMINANT CHANNEL', 158, 40);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(topPayment, 158, 47);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`UPI: ${formatINR(summary.paymentBreakdown.upi)} | Cash: ${formatINR(summary.paymentBreakdown.cash)}`, 158, 52);

  // --- PAYMENT & BILLING MODE BREAKDOWN BAR ---
  doc.setFillColor(241, 245, 249);
  doc.rect(14, 58, 182, 10, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Payment Mix:  UPI: ${formatINR(summary.paymentBreakdown.upi)} (${summary.paymentBreakdown.upiCount})  |  Cash: ${formatINR(summary.paymentBreakdown.cash)} (${summary.paymentBreakdown.cashCount})  |  Card: ${formatINR(summary.paymentBreakdown.card)} (${summary.paymentBreakdown.cardCount})`,
    18,
    64.5
  );

  // --- TOP FAST MOVING PRODUCTS TABLE (IF AVAILABLE) ---
  let nextStartY = 72;
  if (summary.topSellingMedicines && summary.topSellingMedicines.length > 0) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Fast-Moving / High Revenue Medications (Top Sellers):', 14, nextStartY);

    const topMedRows = summary.topSellingMedicines.slice(0, 4).map((m, idx) => [
      `#${idx + 1}`,
      m.name,
      `${m.quantity} units`,
      formatINR(m.revenue),
      `${((m.revenue / (summary.totalRevenue || 1)) * 100).toFixed(1)}% of Revenue`
    ]);

    autoTable(doc, {
      startY: nextStartY + 2,
      head: [['Rank', 'Medicine Name', 'Volume Sold', 'Total Revenue', 'Share']],
      body: topMedRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        cellPadding: 2,
      },
      styles: {
        fontSize: 7,
        cellPadding: 1.8,
        textColor: [51, 65, 85],
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 70, fontStyle: 'bold' },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 35, halign: 'right' },
        4: { cellWidth: 35, halign: 'right' },
      },
      margin: { left: 14, right: 14 },
    });

    nextStartY = (doc as any).lastAutoTable.finalY + 8;
  }

  // --- MAIN ITEMIZED SALES TRANSACTION TABLE ---
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Itemized Invoice Ledger (${sales.length} Records):`, 14, nextStartY);

  const tableHead = [
    'Date & Time',
    'Invoice / ID',
    'Customer',
    'Prescribed Items',
    'Mode',
    'Type',
    'Amount (INR)'
  ];

  const tableRows = sales.map((sale) => {
    const dt = new Date(sale.timestamp);
    const dateFormatted = isNaN(dt.getTime())
      ? sale.timestamp
      : dt.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });

    const itemsSummary = Array.isArray(sale.items)
      ? sale.items.map((it) => `${it.name || it.medicineName || 'Med'} (x${it.quantity})`).join(', ')
      : 'Medicines';

    return [
      dateFormatted,
      (sale as any).invoiceNumber || sale.id.slice(0, 8).toUpperCase(),
      sale.customerName || 'Walk-in',
      itemsSummary,
      (sale.paymentMethod || 'cash').toUpperCase(),
      ((sale as any).billingType || 'retail').toUpperCase(),
      formatINR(sale.totalAmount)
    ];
  });

  autoTable(doc, {
    startY: nextStartY + 3,
    head: [tableHead],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      cellPadding: 2.5,
    },
    styles: {
      fontSize: 6.8,
      cellPadding: 2,
      textColor: [51, 65, 85],
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 22, fontStyle: 'bold' },
      2: { cellWidth: 26 },
      3: { cellWidth: 54 },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 16, halign: 'center' },
      6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14, bottom: 24 },
    didDrawPage: (data) => {
      // Running Page Footer on every page
      const pageNumber = (doc as any).internal.getNumberOfPages();
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.height || pageSize.getHeight();

      doc.setDrawColor(226, 232, 240);
      doc.line(14, pageHeight - 12, 196, pageHeight - 12);

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Satyam Medical ERP • Confidential Sales Audit Report #${reportId} • Page ${pageNumber}`,
        14,
        pageHeight - 7
      );

      doc.text(
        `Authorized Pharmacist Signature / Verification Stamp: ______________________`,
        196,
        pageHeight - 7,
        { align: 'right' }
      );
    },
  });

  const fileName = `Satyam_Sales_Report_${summary.dateRangeLabel.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
  return fileName;
};

export const exportSalesReportCSV = (sales: Sale[], summary: SalesReportSummary) => {
  const headers = [
    'Invoice Number / ID',
    'Timestamp (ISO)',
    'Date Time Formatted',
    'Customer Name',
    'Customer Mobile',
    'Doctor Name',
    'Payment Method',
    'Billing Type',
    'Total Items Count',
    'Item Details Breakdown',
    'Gross Total Amount (INR)'
  ];

  const rows = sales.map((sale) => {
    const escape = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const dt = new Date(sale.timestamp);
    const dateFormatted = isNaN(dt.getTime()) ? sale.timestamp : dt.toLocaleString('en-IN');
    const itemsDetail = Array.isArray(sale.items)
      ? sale.items.map(it => `${it.name || it.medicineName || 'Item'} (Qty: ${it.quantity}, Rate: ₹${it.price || it.rate || 0})`).join('; ')
      : '';
    const totalQty = Array.isArray(sale.items)
      ? sale.items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0)
      : 0;

    return [
      escape((sale as any).invoiceNumber || sale.id),
      escape(sale.timestamp),
      escape(dateFormatted),
      escape(sale.customerName || 'Walk-in'),
      escape(sale.customerMobile || '-'),
      escape((sale as any).doctorName || '-'),
      escape(sale.paymentMethod || 'cash'),
      escape((sale as any).billingType || 'retail'),
      escape(totalQty),
      escape(itemsDetail),
      escape(sale.totalAmount || 0)
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Satyam_Sales_Ledger_${summary.dateRangeLabel.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
