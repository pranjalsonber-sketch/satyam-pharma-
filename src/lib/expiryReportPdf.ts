import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExpiryReportItem {
  id: string;
  medicineId: string;
  medicineName: string;
  genericName?: string;
  salt?: string;
  manufacturer?: string;
  supplier?: string;
  batchNumber: string;
  expiryDate: string;
  stockQuantity: number;
  rate: number;
  totalValue: number;
  daysLeft: number;
  urgencyLevel: 'expired' | 'critical' | 'urgent' | 'approaching';
  recommendedAction: string;
  returnEligibility: string;
}

export interface ExpiryReportSummary {
  generatedAt: Date;
  generatedBy: string;
  userRole: string;
  totalFlaggedCount: number;
  totalUnitsAtRisk: number;
  totalFinancialValue: number;
  expiredCount: number;
  expiredUnits: number;
  expiredValue: number;
  criticalCount: number; // 1-30 days
  criticalUnits: number;
  criticalValue: number;
  urgentCount: number; // 31-60 days
  urgentUnits: number;
  urgentValue: number;
  approachingCount: number; // 61-90 days
  approachingUnits: number;
  approachingValue: number;
  pharmacyName?: string;
  pharmacyAddress?: string;
  gstin?: string;
  dlNumber?: string;
}

export const formatINR = (val: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(val);
};

export const generateExpiryReportPDF = (
  items: ExpiryReportItem[],
  summary: ExpiryReportSummary,
  filterType: string = 'all',
  timeframeDays: number = 90
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryColor = [15, 23, 42]; // Slate 900
  const accentColor = [225, 29, 72]; // Rose 600
  const subTextColor = [100, 116, 139]; // Slate 500

  const reportId = `EXP-${timeframeDays}D-${Date.now().toString().slice(-6)}`;
  const dateStr = summary.generatedAt.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // --- HEADER SECTION ---
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 28, 'F');

  // Title & Pharmacy Info
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(summary.pharmacyName || 'SATYAM MEDICAL & PHARMA ERP', 14, 11);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  doc.text(
    `DL: ${summary.dlNumber || '20B/21B-MH-102948'} | GSTIN: ${summary.gstin || '27AAAAA0000A1Z5'} | ${summary.pharmacyAddress || 'Central Healthcare Complex, Station Road'}`,
    14,
    17
  );

  doc.setFontSize(8);
  doc.setTextColor(244, 63, 94);
  doc.setFont('helvetica', 'bold');
  doc.text(`AUTOMATED ${timeframeDays}-DAY MEDICATION EXPIRY RISK & URGENCY REPORT`, 14, 23);

  // Reference Code & Date in Header (Right aligned)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(`Ref: ${reportId}`, 196, 11, { align: 'right' });
  doc.text(`Date: ${dateStr}`, 196, 17, { align: 'right' });
  doc.text(`Auditor: ${summary.generatedBy} (${summary.userRole.toUpperCase()})`, 196, 23, { align: 'right' });

  // --- EXECUTIVE SUMMARY CARDS (Y: 34 to 68) ---
  const startY = 34;

  // Outer summary box
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, startY, 182, 34, 3, 3, 'FD');

  // Summary Title
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('EXECUTIVE RISK ASSESSMENT (MEDICATIONS EXPIRING ≤ 90 DAYS)', 18, startY + 6);

  // Filter indicator badge
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(`Filter Scope: ${filterType.toUpperCase()}`, 190, startY + 6, { align: 'right' });

  // Divider inside summary
  doc.setDrawColor(226, 232, 240);
  doc.line(18, startY + 8, 192, startY + 8);

  // 4 Column Grid for Urgency Breakdowns
  const colWidth = 42;
  const colY = startY + 14;

  // Col 1: Expired
  doc.setFillColor(254, 242, 242);
  doc.roundedRect(18, colY, colWidth, 16, 2, 2, 'FD');
  doc.setTextColor(185, 28, 28);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('EXPIRED (≤ 0d)', 22, colY + 5);
  doc.setFontSize(10);
  doc.text(`${summary.expiredCount} items (${summary.expiredUnits} units)`, 22, colY + 10);
  doc.setFontSize(7.5);
  doc.text(`Loss: ${formatINR(summary.expiredValue)}`, 22, colY + 14);

  // Col 2: Critical (1-30d)
  doc.setFillColor(255, 241, 242);
  doc.roundedRect(18 + colWidth + 2.5, colY, colWidth, 16, 2, 2, 'FD');
  doc.setTextColor(225, 29, 72);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('CRITICAL (1-30d)', 22 + colWidth + 2.5, colY + 5);
  doc.setFontSize(10);
  doc.text(`${summary.criticalCount} items (${summary.criticalUnits} units)`, 22 + colWidth + 2.5, colY + 10);
  doc.setFontSize(7.5);
  doc.text(`Value: ${formatINR(summary.criticalValue)}`, 22 + colWidth + 2.5, colY + 14);

  // Col 3: Urgent (31-60d)
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(18 + (colWidth + 2.5) * 2, colY, colWidth, 16, 2, 2, 'FD');
  doc.setTextColor(180, 83, 9);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('URGENT (31-60d)', 22 + (colWidth + 2.5) * 2, colY + 5);
  doc.setFontSize(10);
  doc.text(`${summary.urgentCount} items (${summary.urgentUnits} units)`, 22 + (colWidth + 2.5) * 2, colY + 10);
  doc.setFontSize(7.5);
  doc.text(`Value: ${formatINR(summary.urgentValue)}`, 22 + (colWidth + 2.5) * 2, colY + 14);

  // Col 4: Approaching (61-90d)
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(18 + (colWidth + 2.5) * 3, colY, colWidth, 16, 2, 2, 'FD');
  doc.setTextColor(29, 78, 216);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('APPROACHING (61-90d)', 22 + (colWidth + 2.5) * 3, colY + 5);
  doc.setFontSize(10);
  doc.text(`${summary.approachingCount} items (${summary.approachingUnits} units)`, 22 + (colWidth + 2.5) * 3, colY + 10);
  doc.setFontSize(7.5);
  doc.text(`Value: ${formatINR(summary.approachingValue)}`, 22 + (colWidth + 2.5) * 3, colY + 14);

  // Total At-Risk Banner
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const totalSummaryText = `TOTAL AT-RISK (<=90 DAYS): ${summary.totalFlaggedCount} Batches | ${summary.totalUnitsAtRisk} Units | Total Inventory Capital at Risk: ${formatINR(summary.totalFinancialValue)}`;
  doc.text(totalSummaryText, 18, startY + 32);

  // --- DETAILED TABLE ---
  const tableData = items.map((item, idx) => {
    let daysLabel = `${item.daysLeft}d left`;
    if (item.daysLeft <= 0) {
      daysLabel = item.daysLeft === 0 ? 'EXPIRES TODAY' : `EXPIRED (${Math.abs(item.daysLeft)}d ago)`;
    }

    const medInfo = item.salt 
      ? `${item.medicineName}\n(${item.salt.slice(0, 32)})` 
      : item.medicineName;

    const formattedExp = new Date(item.expiryDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    return [
      (idx + 1).toString(),
      medInfo,
      item.batchNumber || 'N/A',
      formattedExp,
      daysLabel,
      item.stockQuantity.toString(),
      `₹${item.rate.toFixed(2)}`,
      `₹${item.totalValue.toFixed(2)}`,
      item.supplier || item.manufacturer || 'Main Dist.',
      item.recommendedAction
    ];
  });

  autoTable(doc, {
    startY: startY + 37,
    head: [[
      '#',
      'Medicine & Salt',
      'Batch No',
      'Expiry',
      'Days Left / Urgency',
      'Stock',
      'MRP/Rate',
      'Value (INR)',
      'Distributor',
      'Recommended Action'
    ]],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
      cellPadding: 2,
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { cellWidth: 38 },
      2: { halign: 'center', cellWidth: 16 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'center', cellWidth: 24, fontStyle: 'bold' },
      5: { halign: 'center', cellWidth: 12 },
      6: { halign: 'right', cellWidth: 14 },
      7: { halign: 'right', cellWidth: 18, fontStyle: 'bold' },
      8: { cellWidth: 20 },
      9: { cellWidth: 24, fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      // Color-code urgency column and row backgrounds
      if (data.section === 'body') {
        const item = items[data.row.index];
        if (item) {
          if (item.daysLeft <= 0) {
            if (data.column.index === 4) {
              data.cell.styles.textColor = [185, 28, 28]; // Dark Red
              data.cell.styles.fillColor = [254, 226, 226];
            }
            if (data.column.index === 9) {
              data.cell.styles.textColor = [185, 28, 28];
            }
          } else if (item.daysLeft <= 30) {
            if (data.column.index === 4) {
              data.cell.styles.textColor = [225, 29, 72]; // Rose
              data.cell.styles.fillColor = [255, 228, 230];
            }
            if (data.column.index === 9) {
              data.cell.styles.textColor = [225, 29, 72];
            }
          } else if (item.daysLeft <= 60) {
            if (data.column.index === 4) {
              data.cell.styles.textColor = [180, 83, 9]; // Amber
              data.cell.styles.fillColor = [254, 243, 199];
            }
          } else if (item.daysLeft <= 90) {
            if (data.column.index === 4) {
              data.cell.styles.textColor = [29, 78, 216]; // Blue
              data.cell.styles.fillColor = [239, 246, 255];
            }
          }
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  // --- FOOTER & SIGN-OFF SECTION ---
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Footer divider line
    doc.setDrawColor(203, 213, 225);
    doc.line(14, 278, 196, 278);

    // Compliance Disclaimer & Page info
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Regulatory Notice: Expired formulations must be segregated immediately under Schedule M/H guidelines. Return claims must be filed before 60-day vendor cutoff.',
      14,
      282
    );

    doc.text(
      `Satyam ERP v2.4 Automated Audit | Page ${i} of ${pageCount} | Generated on ${dateStr}`,
      14,
      286
    );

    // Sign off lines on last page
    if (i === pageCount) {
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text('Pharmacist-in-Charge Signature: _______________________', 14, 273);
      doc.text('Store Manager Verification: _______________________', 125, 273);
    }
  }

  // Save PDF
  const filename = `Satyam_Pharma_${timeframeDays}Day_Expiry_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
  return filename;
};

export const exportExpiryReportCSV = (items: ExpiryReportItem[], timeframeDays: number = 90) => {
  const headers = [
    'Sl No',
    'Medicine Name',
    'Generic Salt',
    'Batch Number',
    'Expiry Date',
    'Days Left',
    'Urgency Level',
    'Stock Quantity',
    'Unit MRP (INR)',
    'Total Value (INR)',
    'Supplier / Distributor',
    'Return Eligibility',
    'Recommended Action'
  ];

  const rows = items.map((item, idx) => [
    idx + 1,
    `"${(item.medicineName || '').replace(/"/g, '""')}"`,
    `"${(item.salt || item.genericName || '').replace(/"/g, '""')}"`,
    `"${(item.batchNumber || '').replace(/"/g, '""')}"`,
    item.expiryDate,
    item.daysLeft,
    item.urgencyLevel.toUpperCase(),
    item.stockQuantity,
    item.rate,
    item.totalValue.toFixed(2),
    `"${(item.supplier || item.manufacturer || 'Main Dist.').replace(/"/g, '""')}"`,
    `"${item.returnEligibility}"`,
    `"${item.recommendedAction.replace(/"/g, '""')}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [
    headers.join(','),
    ...rows.map(e => e.join(','))
  ].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Satyam_Pharma_${timeframeDays}Day_Expiry_Export_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
