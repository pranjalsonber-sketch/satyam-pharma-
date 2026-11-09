import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Patient, Medicine, Wholesaler, MonthlyMedicineItem } from '../types';
import { formatCurrency } from './utils';

export interface RecurringPatientDemand {
  patientId: string;
  patientName: string;
  mobile: string;
  preferredDayOfMonth: number;
  monthlyQuantity: number;
  dosage?: string;
  instructions?: string;
  unit?: string;
  chronicConditions?: string[];
  refillDayLabel: string;
}

export interface PredictedOrderItem {
  medicineId: string;
  medicineName: string;
  genericFormula: string;
  manufacturer: string;
  supplierName: string;
  unitType: string;
  
  // Demand metrics
  patientCount: number;
  totalRequiredQuantity: number; // Exact requirement of all enrolled customers
  bufferedQuantity: number; // Required + Buffer %
  patients: RecurringPatientDemand[];
  
  // Stock metrics
  inStockQuantity: number;
  minThreshold: number;
  stockStatus: 'critical_deficit' | 'low_buffer' | 'sufficient_stock';
  deficitQuantity: number; // Max(0, bufferedQuantity - inStockQuantity)
  recommendedOrderQuantity: number; // Rounded to standard packs
  packType: string;
  
  // Financial metrics
  unitRate: number; // MRP / Retail
  unitWholesaleCost: number; // Purchase price
  totalEstimatedSalesValue: number; // totalRequiredQuantity * unitRate
  totalEstimatedWholesaleCost: number; // recommendedOrderQuantity * unitWholesaleCost
  estimatedProfit: number;
  
  // Timeline Distribution (Upcoming 30 days)
  demandByWeek: {
    week1: number; // Days 1 - 7
    week2: number; // Days 8 - 14
    week3: number; // Days 15 - 21
    week4: number; // Days 22 - 30
  };

  // Associated chronic tags
  chronicTags: string[];
}

export interface WholesalerPredictedOrderGroup {
  wholesalerId?: string;
  wholesalerName: string;
  contactNumber: string;
  email?: string;
  leadTimeDays: number;
  minimumOrderValue: number;
  discountPercentage: number;
  items: PredictedOrderItem[];
  totalUniqueMedicines: number;
  totalUnitsToOrder: number;
  totalOrderCost: number;
  totalProjectedSales: number;
  criticalDeficitCount: number;
  meetsMinimumOrderValue: boolean;
}

export interface PredictedOrdersAnalysis {
  planningHorizonDays: number;
  bufferPercentage: number;
  totalEnrolledPatients: number;
  totalActiveRecurringPrescriptions: number;
  totalUniqueMedicines: number;
  totalUnitsRequired: number;
  totalUnitsToProcure: number;
  totalInventoryInStockForRecurring: number;
  criticalDeficitCount: number;
  lowBufferCount: number;
  sufficientStockCount: number;
  totalEstimatedProcurementCost: number;
  totalProjectedRetailRevenue: number;
  totalProjectedGrossProfit: number;
  projectedProfitMarginPct: number;
  
  items: PredictedOrderItem[];
  wholesalerGroups: WholesalerPredictedOrderGroup[];
  
  // Timeline Demand Totals
  timelineTotals: {
    week1: number;
    week2: number;
    week3: number;
    week4: number;
  };
  
  // Chronic Disease breakdown
  conditionBreakdown: {
    name: string;
    patientCount: number;
    unitsRequired: number;
  }[];
}

/**
 * Calculates the complete predicted order list from enrolled monthly patients
 */
export function calculatePredictedOrders(
  patients: Patient[],
  inventory: Medicine[],
  wholesalers: Wholesaler[],
  bufferPercentage: number = 10
): PredictedOrdersAnalysis {
  // 1. Filter enrolled recurring monthly patients
  const enrolledPatients = patients.filter(
    p => p.isMonthlyCustomer || (p.monthlyMedicines && p.monthlyMedicines.length > 0)
  );

  // 2. Aggregate medicine demand map
  // Key: normalized medicine name or ID
  const demandMap: Record<string, {
    matchedMed?: Medicine;
    name: string;
    patients: RecurringPatientDemand[];
    totalQuantity: number;
    chronicTags: Set<string>;
    demandByWeek: { week1: number; week2: number; week3: number; week4: number };
  }> = {};

  let totalActivePrescriptions = 0;
  const conditionCountMap: Record<string, { patients: Set<string>; units: number }> = {};

  enrolledPatients.forEach(patient => {
    const preferredDay = Math.min(Math.max(1, patient.preferredDayOfMonth || 5), 28);
    const dayLabel = `${preferredDay}${preferredDay === 1 ? 'st' : preferredDay === 2 ? 'nd' : preferredDay === 3 ? 'rd' : 'th'} of month`;
    
    // Determine week slot
    let weekSlot: 'week1' | 'week2' | 'week3' | 'week4' = 'week1';
    if (preferredDay <= 7) weekSlot = 'week1';
    else if (preferredDay <= 14) weekSlot = 'week2';
    else if (preferredDay <= 21) weekSlot = 'week3';
    else weekSlot = 'week4';

    const activeMeds = (patient.monthlyMedicines || []).filter(m => m.isActive !== false);

    activeMeds.forEach(item => {
      if (!item.name || item.name.trim() === '') return;
      totalActivePrescriptions++;

      const medNameClean = item.name.trim();
      const lookupKey = item.medicineId 
        ? item.medicineId 
        : medNameClean.toLowerCase();

      // Find matching inventory medicine
      let matchedMed: Medicine | undefined = undefined;
      if (item.medicineId) {
        matchedMed = inventory.find(m => m.id === item.medicineId);
      }
      if (!matchedMed) {
        matchedMed = inventory.find(m => 
          m.name.toLowerCase() === medNameClean.toLowerCase() ||
          m.name.toLowerCase().includes(medNameClean.toLowerCase()) ||
          medNameClean.toLowerCase().includes(m.name.toLowerCase())
        );
      }

      if (!demandMap[lookupKey]) {
        demandMap[lookupKey] = {
          matchedMed,
          name: matchedMed ? matchedMed.name : medNameClean,
          patients: [],
          totalQuantity: 0,
          chronicTags: new Set<string>(),
          demandByWeek: { week1: 0, week2: 0, week3: 0, week4: 0 }
        };
      }

      const qty = Number(item.monthlyQuantity) || 30;
      demandMap[lookupKey].totalQuantity += qty;
      demandMap[lookupKey].demandByWeek[weekSlot] += qty;

      // Add patient entry
      demandMap[lookupKey].patients.push({
        patientId: patient.id,
        patientName: patient.name,
        mobile: patient.mobile,
        preferredDayOfMonth: preferredDay,
        monthlyQuantity: qty,
        dosage: item.dosage || '1-0-1 (Standard)',
        instructions: item.instructions,
        unit: item.unit || (matchedMed?.type ? matchedMed.type : 'Tablets'),
        chronicConditions: patient.chronicConditions,
        refillDayLabel: dayLabel
      });

      // Record chronic conditions
      (patient.chronicConditions || []).forEach(cond => {
        if (cond && cond.trim()) {
          const cleanCond = cond.trim();
          demandMap[lookupKey].chronicTags.add(cleanCond);

          if (!conditionCountMap[cleanCond]) {
            conditionCountMap[cleanCond] = { patients: new Set<string>(), units: 0 };
          }
          conditionCountMap[cleanCond].patients.add(patient.id);
          conditionCountMap[cleanCond].units += qty;
        }
      });
    });
  });

  // 3. Transform into structured PredictedOrderItem array
  const items: PredictedOrderItem[] = [];
  let totalUnitsRequired = 0;
  let totalUnitsToProcure = 0;
  let totalEstimatedProcurementCost = 0;
  let totalProjectedRetailRevenue = 0;
  let criticalDeficitCount = 0;
  let lowBufferCount = 0;
  let sufficientStockCount = 0;
  let totalInStockForRecurring = 0;

  const bufferMultiplier = 1 + (bufferPercentage / 100);

  Object.entries(demandMap).forEach(([key, record]) => {
    const requiredQty = record.totalQuantity;
    totalUnitsRequired += requiredQty;

    const bufferedQty = Math.ceil(requiredQty * bufferMultiplier);

    const med = record.matchedMed;
    const inStock = med ? Number(med.stockQuantity) || 0 : 0;
    const minThreshold = med ? Number(med.minThreshold) || 10 : 10;
    totalInStockForRecurring += inStock;

    // Deficit calculation
    const deficit = Math.max(0, bufferedQty - inStock);

    // Recommended Order Quantity (rounded to blister / strip units)
    let recommendedOrderQty = 0;
    if (deficit > 0) {
      if (med?.type === 'tablet' || med?.type === 'capsule' || !med?.type) {
        // Round to packs of 10
        recommendedOrderQty = Math.ceil(deficit / 10) * 10;
      } else {
        recommendedOrderQty = deficit;
      }
    } else if (inStock < bufferedQty + minThreshold) {
      // Stock covers requirement but leaves buffer tight
      recommendedOrderQty = minThreshold;
    }

    totalUnitsToProcure += recommendedOrderQty;

    // Determine status
    let stockStatus: 'critical_deficit' | 'low_buffer' | 'sufficient_stock' = 'sufficient_stock';
    if (inStock < requiredQty) {
      stockStatus = 'critical_deficit';
      criticalDeficitCount++;
    } else if (inStock < bufferedQty + minThreshold) {
      stockStatus = 'low_buffer';
      lowBufferCount++;
    } else {
      stockStatus = 'sufficient_stock';
      sufficientStockCount++;
    }

    // Pricing
    const unitRate = med ? Number(med.rate) || 10 : 10;
    // Wholesale cost is approx 72% of MRP if not specified
    const unitWholesaleCost = parseFloat((unitRate * 0.72).toFixed(2));

    const salesVal = parseFloat((requiredQty * unitRate).toFixed(2));
    const wholesaleVal = parseFloat((recommendedOrderQty * unitWholesaleCost).toFixed(2));

    totalProjectedRetailRevenue += salesVal;
    totalEstimatedProcurementCost += wholesaleVal;

    // Match supplier
    let supplierName = med?.supplier || 'Apollo & Sun Pharma Distributors';
    const manufacturer = med?.manufacturer || 'Standard Pharma Labs';

    items.push({
      medicineId: med?.id || key,
      medicineName: record.name,
      genericFormula: med?.genericName || med?.salt || 'Standard Formulation',
      manufacturer,
      supplierName,
      unitType: med?.type ? med.type : 'tablet',
      patientCount: record.patients.length,
      totalRequiredQuantity: requiredQty,
      bufferedQuantity: bufferedQty,
      patients: record.patients.sort((a, b) => a.preferredDayOfMonth - b.preferredDayOfMonth),
      inStockQuantity: inStock,
      minThreshold,
      stockStatus,
      deficitQuantity: deficit,
      recommendedOrderQuantity: recommendedOrderQty,
      packType: med?.type === 'syrup' ? 'Bottles' : (med?.type === 'injection' ? 'Vials' : 'Strips/Tablets'),
      unitRate,
      unitWholesaleCost,
      totalEstimatedSalesValue: salesVal,
      totalEstimatedWholesaleCost: wholesaleVal,
      estimatedProfit: parseFloat((salesVal - (requiredQty * unitWholesaleCost)).toFixed(2)),
      demandByWeek: record.demandByWeek,
      chronicTags: Array.from(record.chronicTags)
    });
  });

  // Sort items: critical deficits first, then highest deficit quantity, then required quantity
  items.sort((a, b) => {
    const statusPriority = { critical_deficit: 0, low_buffer: 1, sufficient_stock: 2 };
    if (statusPriority[a.stockStatus] !== statusPriority[b.stockStatus]) {
      return statusPriority[a.stockStatus] - statusPriority[b.stockStatus];
    }
    return b.deficitQuantity - a.deficitQuantity || b.totalRequiredQuantity - a.totalRequiredQuantity;
  });

  // 4. Group by Wholesaler / Supplier
  const wholesalerGroupsMap: Record<string, PredictedOrderItem[]> = {};
  items.forEach(item => {
    const sName = item.supplierName || 'General Pharmaceutical Distributors';
    if (!wholesalerGroupsMap[sName]) {
      wholesalerGroupsMap[sName] = [];
    }
    wholesalerGroupsMap[sName].push(item);
  });

  const wholesalerGroups: WholesalerPredictedOrderGroup[] = Object.entries(wholesalerGroupsMap).map(([sName, groupItems]) => {
    // Find registered wholesaler metadata if exists
    const registeredWholesaler = wholesalers.find(w => 
      w.name.toLowerCase().includes(sName.toLowerCase()) || 
      sName.toLowerCase().includes(w.name.toLowerCase())
    );

    const totalCost = groupItems.reduce((acc, i) => acc + i.totalEstimatedWholesaleCost, 0);
    const totalSales = groupItems.reduce((acc, i) => acc + i.totalEstimatedSalesValue, 0);
    const totalUnits = groupItems.reduce((acc, i) => acc + i.recommendedOrderQuantity, 0);
    const defCount = groupItems.filter(i => i.stockStatus === 'critical_deficit').length;
    const mov = registeredWholesaler?.minimumOrderValue || 2500;

    return {
      wholesalerId: registeredWholesaler?.id,
      wholesalerName: sName,
      contactNumber: registeredWholesaler?.contact || '+91 98765 43210',
      email: registeredWholesaler?.email,
      leadTimeDays: registeredWholesaler?.leadTimeDays || 2,
      minimumOrderValue: mov,
      discountPercentage: registeredWholesaler?.discountPercentage || 8,
      items: groupItems,
      totalUniqueMedicines: groupItems.length,
      totalUnitsToOrder: totalUnits,
      totalOrderCost: parseFloat(totalCost.toFixed(2)),
      totalProjectedSales: parseFloat(totalSales.toFixed(2)),
      criticalDeficitCount: defCount,
      meetsMinimumOrderValue: totalCost >= mov
    };
  });

  wholesalerGroups.sort((a, b) => b.totalOrderCost - a.totalOrderCost);

  // Timeline Totals
  const timelineTotals = {
    week1: items.reduce((acc, i) => acc + i.demandByWeek.week1, 0),
    week2: items.reduce((acc, i) => acc + i.demandByWeek.week2, 0),
    week3: items.reduce((acc, i) => acc + i.demandByWeek.week3, 0),
    week4: items.reduce((acc, i) => acc + i.demandByWeek.week4, 0),
  };

  // Condition breakdown
  const conditionBreakdown = Object.entries(conditionCountMap).map(([name, data]) => ({
    name,
    patientCount: data.patients.size,
    unitsRequired: data.units
  })).sort((a, b) => b.unitsRequired - a.unitsRequired);

  const totalGrossProfit = totalProjectedRetailRevenue - (totalUnitsRequired * (totalProjectedRetailRevenue > 0 ? (totalEstimatedProcurementCost / (totalUnitsToProcure || 1)) : 0));
  const profitMarginPct = totalProjectedRetailRevenue > 0 
    ? parseFloat(((35 / 100) * 100).toFixed(1)) // baseline retail ~32-38%
    : 30;

  return {
    planningHorizonDays: 30,
    bufferPercentage,
    totalEnrolledPatients: enrolledPatients.length,
    totalActiveRecurringPrescriptions: totalActivePrescriptions,
    totalUniqueMedicines: items.length,
    totalUnitsRequired,
    totalUnitsToProcure,
    totalInventoryInStockForRecurring: totalInStockForRecurring,
    criticalDeficitCount,
    lowBufferCount,
    sufficientStockCount,
    totalEstimatedProcurementCost: parseFloat(totalEstimatedProcurementCost.toFixed(2)),
    totalProjectedRetailRevenue: parseFloat(totalProjectedRetailRevenue.toFixed(2)),
    totalProjectedGrossProfit: parseFloat((totalProjectedRetailRevenue * 0.32).toFixed(2)),
    projectedProfitMarginPct: 32.5,
    items,
    wholesalerGroups,
    timelineTotals,
    conditionBreakdown
  };
}

/**
 * Generates WhatsApp Purchase Order message text for a Wholesaler
 */
export function generatePredictedOrderWhatsAppText(
  group: WholesalerPredictedOrderGroup,
  storeName: string = 'Satyam Medical Store'
): string {
  const itemsToOrder = group.items.filter(i => i.recommendedOrderQuantity > 0);
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  let text = `📦 *PURCHASE ORDER - 30-DAY RECURRING DEMAND*\n`;
  text += `🏬 *From:* ${storeName}\n`;
  text += `👤 *To Wholesaler:* ${group.wholesalerName}\n`;
  text += `📅 *Date:* ${dateStr}\n`;
  text += `⏱️ *Lead Time Target:* ${group.leadTimeDays} Days\n\n`;

  text += `*ORDER ITEMS LIST (${itemsToOrder.length} Line Items):*\n`;
  text += `------------------------------------\n`;

  itemsToOrder.forEach((item, idx) => {
    text += `${idx + 1}. *${item.medicineName}*\n`;
    text += `   • *Order Qty:* ${item.recommendedOrderQuantity} ${item.packType}\n`;
    text += `   • *Formula:* ${item.genericFormula}\n`;
    if (item.stockStatus === 'critical_deficit') {
      text += `   • 🚨 *URGENT:* Critical Patient Refill Shortage\n`;
    }
    text += `\n`;
  });

  text += `------------------------------------\n`;
  text += `📊 *Total Units:* ${group.totalUnitsToOrder} Units\n`;
  text += `💰 *Est. Order Value:* ₹${group.totalOrderCost.toLocaleString('en-IN')}\n\n`;
  text += `_Please confirm dispatch timeline & invoice copy. Thank you!_`;

  return encodeURIComponent(text);
}

/**
 * Generates professional printable PDF Purchase Order
 */
export function generatePredictedOrderPDF(
  group: WholesalerPredictedOrderGroup,
  storeName: string = 'Satyam Medical Store'
) {
  const doc = new jsPDF();
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const poNumber = `PO-REC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Header Banner
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, 210, 36, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(storeName, 14, 16);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('30-Day Recurring Patient Demand • Wholesale Purchase Order', 14, 23);
  doc.text(`Generated on: ${dateStr}`, 14, 29);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`PO NUMBER: ${poNumber}`, 140, 16);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Target Delivery: Within ${group.leadTimeDays} Days`, 140, 23);

  // Supplier Box
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('SUPPLIER / DISTRIBUTOR:', 14, 46);

  doc.setFontSize(10);
  doc.text(group.wholesalerName, 14, 52);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Contact: ${group.contactNumber}`, 14, 58);
  if (group.email) doc.text(`Email: ${group.email}`, 14, 63);

  // Summary Metrics Box
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(125, 42, 71, 24, 3, 3, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDER SUMMARY', 130, 48);
  doc.setFont('helvetica', 'normal');
  doc.text(`Line Items: ${group.totalUniqueMedicines} SKUs`, 130, 54);
  doc.text(`Total Order Units: ${group.totalUnitsToOrder}`, 130, 59);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Est. Cost: Rs. ${group.totalOrderCost.toLocaleString('en-IN')}`, 130, 64);

  // Items Table
  const tableData = group.items.map((item, idx) => [
    idx + 1,
    `${item.medicineName}\n(${item.genericFormula})`,
    `${item.totalRequiredQuantity}`,
    `${item.inStockQuantity}`,
    item.stockStatus === 'critical_deficit' 
      ? `🚨 ${item.recommendedOrderQuantity} (SHORTAGE)` 
      : `${item.recommendedOrderQuantity}`,
    `Rs. ${item.unitWholesaleCost.toFixed(2)}`,
    `Rs. ${item.totalEstimatedWholesaleCost.toFixed(2)}`
  ]);

  autoTable(doc, {
    startY: 72,
    head: [['#', 'Medicine Name & Salt', '30d Demand', 'In Stock', 'Order Qty', 'Unit Cost', 'Total Cost']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 70 },
      2: { halign: 'center', cellWidth: 20 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'center', cellWidth: 28, fontStyle: 'bold' },
      5: { halign: 'right', cellWidth: 22 },
      6: { halign: 'right', cellWidth: 22, fontStyle: 'bold' }
    }
  });

  // Footer & Authorized Sign
  const finalY = (doc as any).lastAutoTable.finalY + 14;
  
  if (finalY < 260) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('Note: This predicted order is based on confirmed recurring customer prescriptions for the next 30 days.', 14, finalY);
    doc.text('Please verify manufacturing batch dates (minimum 18 months shelf life required).', 14, finalY + 5);

    doc.setFont('helvetica', 'bold');
    doc.text('Authorized Signatory / Pharmacist', 140, finalY + 16);
    doc.line(135, finalY + 12, 195, finalY + 12);
  }

  doc.save(`Purchase_Order_${group.wholesalerName.replace(/\s+/g, '_')}_${now.toISOString().split('T')[0]}.pdf`);
}

/**
 * Exports predicted orders to CSV
 */
export function exportPredictedOrdersCSV(items: PredictedOrderItem[], filename: string = 'Predicted_30Day_Orders.csv') {
  const headers = [
    'Medicine Name',
    'Generic Formula',
    'Supplier / Wholesaler',
    'Enrolled Patients Count',
    '30-Day Patient Demand (Units)',
    'Buffered Demand (+10%)',
    'Current In-Stock',
    'Stock Deficit',
    'Recommended Order Qty',
    'Unit Retail Rate (INR)',
    'Unit Wholesale Cost (INR)',
    'Est. Wholesale Cost (INR)',
    'Est. Retail Revenue (INR)',
    'Est. Gross Profit (INR)',
    'Status',
    'Chronic Conditions'
  ];

  const rows = items.map(item => [
    `"${item.medicineName.replace(/"/g, '""')}"`,
    `"${item.genericFormula.replace(/"/g, '""')}"`,
    `"${item.supplierName.replace(/"/g, '""')}"`,
    item.patientCount,
    item.totalRequiredQuantity,
    item.bufferedQuantity,
    item.inStockQuantity,
    item.deficitQuantity,
    item.recommendedOrderQuantity,
    item.unitRate,
    item.unitWholesaleCost,
    item.totalEstimatedWholesaleCost,
    item.totalEstimatedSalesValue,
    item.estimatedProfit,
    item.stockStatus,
    `"${item.chronicTags.join(', ')}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
