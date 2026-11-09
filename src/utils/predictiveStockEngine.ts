import { Medicine, Sale, MedicineStockPrediction, PredictiveRefillSummary, StockoutUrgency } from '../types';

export interface PredictionOptions {
  planningHorizonDays?: number; // default: 30 days
  vendorLeadTimeDays?: number;   // default: 4 days (days required for vendor delivery)
  safetyStockDays?: number;      // default: 7 days safety buffer
  surgeMultiplier?: number;      // default: 1.0 (e.g. 1.25 during seasonal rush)
}

/**
 * Calculates historical daily consumption and projects stock-out dates for inventory medicines
 */
export function calculateMedicineStockPredictions(
  medicines: Medicine[],
  sales: Sale[] = [],
  options: PredictionOptions = {}
): { summary: PredictiveRefillSummary; predictions: MedicineStockPrediction[] } {
  const {
    planningHorizonDays = 30,
    vendorLeadTimeDays = 4,
    safetyStockDays = 7,
    surgeMultiplier = 1.0
  } = options;

  const now = new Date();
  const todayMs = now.getTime();

  // 1. Build a sales map aggregated by medicineId and medicine name
  const salesByMedicineId: Record<string, { totalQty: number; recent30dQty: number; recent7dQty: number; lastSaleDate?: string }> = {};

  const sevenDaysAgoMs = todayMs - (7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgoMs = todayMs - (30 * 24 * 60 * 60 * 1000);

  sales.forEach((sale) => {
    const saleTime = sale.timestamp ? new Date(sale.timestamp).getTime() : todayMs;
    const isWithin30d = saleTime >= thirtyDaysAgoMs;
    const isWithin7d = saleTime >= sevenDaysAgoMs;

    if (Array.isArray(sale.items)) {
      sale.items.forEach((item) => {
        const qty = Number(item.quantity) || 0;
        const key = item.medicineId || item.medicineName || item.name;
        if (!key) return;

        if (!salesByMedicineId[key]) {
          salesByMedicineId[key] = { totalQty: 0, recent30dQty: 0, recent7dQty: 0 };
        }

        salesByMedicineId[key].totalQty += qty;
        if (isWithin30d) salesByMedicineId[key].recent30dQty += qty;
        if (isWithin7d) salesByMedicineId[key].recent7dQty += qty;
        salesByMedicineId[key].lastSaleDate = sale.timestamp;
      });
    }
  });

  const predictions: MedicineStockPrediction[] = [];

  let stockedOutCount = 0;
  let criticalStockoutCount = 0;
  let warningStockoutCount = 0;
  let moderateStockoutCount = 0;
  let healthyCount = 0;
  let totalDailyDepletionUnits = 0;
  let totalRecommendedRefillUnits = 0;
  let totalEstimatedRefillCost = 0;
  let cumulativeDaysRemaining = 0;

  medicines.forEach((med) => {
    const currentStock = Number(med.stockQuantity) || 0;
    const minThreshold = Number(med.minThreshold) || 10;
    const unitRate = Number(med.rate) || 0;

    // Find sales matching this medicine by ID or exact name
    const salesRecord = salesByMedicineId[med.id] || salesByMedicineId[med.name] || { totalQty: 0, recent30dQty: 0, recent7dQty: 0 };
    
    // Calculate daily burn rate
    let dailyBurnRate = 0;
    let velocityTrend: 'accelerating' | 'stable' | 'declining' = 'stable';

    if (salesRecord.recent7dQty > 0) {
      // 7-day average daily burn
      const rate7d = salesRecord.recent7dQty / 7;
      const rate30d = salesRecord.recent30dQty > 0 ? salesRecord.recent30dQty / 30 : rate7d;

      // Weighted blend (60% 7-day trend, 40% 30-day baseline)
      dailyBurnRate = (rate7d * 0.6) + (rate30d * 0.4);

      if (rate7d > rate30d * 1.25) {
        velocityTrend = 'accelerating';
      } else if (rate7d < rate30d * 0.75) {
        velocityTrend = 'declining';
      }
    } else if (salesRecord.recent30dQty > 0) {
      dailyBurnRate = salesRecord.recent30dQty / 30;
    } else if (salesRecord.totalQty > 0) {
      dailyBurnRate = Math.max(0.3, salesRecord.totalQty / 60);
    } else {
      // Fallback calibrated heuristic for medicines without active sales history
      // e.g. An item with minThreshold 10 typically dispenses ~0.5 units/day
      dailyBurnRate = Math.max(0.2, minThreshold / 20);
    }

    // Apply surge multiplier (e.g. monsoon / seasonal rush)
    dailyBurnRate = dailyBurnRate * surgeMultiplier;
    dailyBurnRate = Math.max(0.1, parseFloat(dailyBurnRate.toFixed(2)));

    // Calculate days until stockout
    let daysUntilStockOut = 0;
    if (currentStock <= 0) {
      daysUntilStockOut = 0;
    } else {
      daysUntilStockOut = parseFloat((currentStock / dailyBurnRate).toFixed(1));
    }

    // Compute projected stock-out date
    const stockOutDateObj = new Date(todayMs + (daysUntilStockOut * 24 * 60 * 60 * 1000));
    const projectedStockOutDate = stockOutDateObj.toISOString().split('T')[0];
    const projectedStockOutFormatted = stockOutDateObj.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    // Recommended order date (Must order before: stockout date minus vendor lead time)
    const orderDeadlineDays = Math.max(0, Math.floor(daysUntilStockOut - vendorLeadTimeDays));
    const orderDateObj = new Date(todayMs + (orderDeadlineDays * 24 * 60 * 60 * 1000));
    const recommendedOrderDate = orderDateObj.toISOString().split('T')[0];

    // Determine Urgency Category
    let urgency: StockoutUrgency = 'healthy';
    let urgencyLabel = 'Well Stocked';

    if (currentStock <= 0) {
      urgency = 'stockout';
      urgencyLabel = 'Depleted (Out of Stock)';
      stockedOutCount++;
    } else if (daysUntilStockOut <= 7) {
      urgency = 'critical';
      urgencyLabel = `Critical (${daysUntilStockOut}d left)`;
      criticalStockoutCount++;
    } else if (daysUntilStockOut <= 15) {
      urgency = 'warning';
      urgencyLabel = `Refill Soon (${daysUntilStockOut}d left)`;
      warningStockoutCount++;
    } else if (daysUntilStockOut <= 30) {
      urgency = 'moderate';
      urgencyLabel = `Adequate (${daysUntilStockOut}d left)`;
      moderateStockoutCount++;
    } else if (daysUntilStockOut > 120) {
      urgency = 'overstocked';
      urgencyLabel = `Overstocked (${Math.round(daysUntilStockOut)}d stock)`;
      healthyCount++;
    } else {
      urgency = 'healthy';
      urgencyLabel = `Healthy (${Math.round(daysUntilStockOut)}d stock)`;
      healthyCount++;
    }

    // Compute recommended refill quantity
    // Target stock = (Planning Horizon + Safety Buffer) * Daily Burn Rate
    const targetStock = Math.ceil((planningHorizonDays + safetyStockDays) * dailyBurnRate);
    let recommendedRefillQty = 0;

    if (currentStock < targetStock || daysUntilStockOut <= planningHorizonDays) {
      const needed = Math.max(0, targetStock - currentStock);
      // Round to packaging standard batches
      if (med.type === 'tablet' || med.type === 'capsule') {
        recommendedRefillQty = Math.ceil(needed / 10) * 10;
      } else if (med.type === 'syrup' || med.type === 'injection') {
        recommendedRefillQty = Math.ceil(needed / 5) * 5;
      } else {
        recommendedRefillQty = Math.ceil(needed);
      }
    }

    const estimatedRefillCost = parseFloat((recommendedRefillQty * unitRate).toFixed(2));

    // Expiry vs Stockout Analysis
    let daysUntilExpiry = 999;
    let expiryConflict: 'stockout_before_expiry' | 'expiry_before_stockout' | 'balanced' = 'balanced';
    if (med.expiryDate) {
      const expDate = new Date(med.expiryDate).getTime();
      daysUntilExpiry = Math.ceil((expDate - todayMs) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry < 0) {
        expiryConflict = 'expiry_before_stockout';
      } else if (daysUntilExpiry < daysUntilStockOut) {
        // Stock will expire before completely running out! Warning of dead stock
        expiryConflict = 'expiry_before_stockout';
      } else {
        expiryConflict = 'stockout_before_expiry';
      }
    }

    // Clinical rationale & notes
    let rationale = '';
    if (currentStock <= 0) {
      rationale = `Zero stock on shelf. Immediate patient supply disruption risk. Vendor dispatch needed immediately.`;
    } else if (daysUntilStockOut <= 7) {
      rationale = `Depleting rapidly at ${dailyBurnRate} units/day. Reorder needed within ${orderDeadlineDays} days to avert stockout.`;
    } else if (expiryConflict === 'expiry_before_stockout' && daysUntilExpiry <= 60) {
      rationale = `Batch expires in ${daysUntilExpiry} days before natural stockout in ${daysUntilStockOut} days. Prioritize dispensing or return to wholesaler.`;
    } else {
      rationale = `Steady consumption (${dailyBurnRate} units/day). Buffer adequate for ~${Math.round(daysUntilStockOut)} days.`;
    }

    totalDailyDepletionUnits += dailyBurnRate;
    totalRecommendedRefillUnits += recommendedRefillQty;
    totalEstimatedRefillCost += estimatedRefillCost;
    cumulativeDaysRemaining += daysUntilStockOut;

    predictions.push({
      medicineId: med.id,
      medicineName: med.name,
      genericName: med.genericName,
      salt: med.salt,
      type: med.type || 'tablet',
      currentStock,
      minThreshold,
      rate: unitRate,
      dailyBurnRate,
      historicalSalesTotal: salesRecord.totalQty,
      salesVelocityTrend: velocityTrend,
      daysUntilStockOut,
      projectedStockOutDate,
      projectedStockOutFormatted,
      urgency,
      urgencyLabel,
      recommendedRefillQty,
      recommendedOrderDate,
      estimatedRefillCost,
      expiryDate: med.expiryDate,
      daysUntilExpiry,
      expiryConflict,
      clinicalRationale: rationale
    });
  });

  // Sort predictions with most urgent stockouts first
  const urgencyWeight: Record<StockoutUrgency, number> = {
    stockout: 0,
    critical: 1,
    warning: 2,
    moderate: 3,
    healthy: 4,
    overstocked: 5
  };

  predictions.sort((a, b) => {
    if (urgencyWeight[a.urgency] !== urgencyWeight[b.urgency]) {
      return urgencyWeight[a.urgency] - urgencyWeight[b.urgency];
    }
    return a.daysUntilStockOut - b.daysUntilStockOut;
  });

  const totalMedicinesAnalyzed = medicines.length;
  const averageDaysRemaining = totalMedicinesAnalyzed > 0 
    ? Math.round(cumulativeDaysRemaining / totalMedicinesAnalyzed) 
    : 0;

  const summary: PredictiveRefillSummary = {
    totalMedicinesAnalyzed,
    stockedOutCount,
    criticalStockoutCount,
    warningStockoutCount,
    moderateStockoutCount,
    healthyCount,
    totalDailyDepletionUnits: parseFloat(totalDailyDepletionUnits.toFixed(1)),
    totalRecommendedRefillUnits,
    totalEstimatedRefillCost: Math.round(totalEstimatedRefillCost),
    immediateActionRequiredCount: stockedOutCount + criticalStockoutCount,
    averageDaysRemaining,
    generatedAt: new Date().toISOString()
  };

  return { summary, predictions };
}
