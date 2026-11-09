export type UserRole = 'admin' | 'clerk' | 'manager';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: UserRole;
  isMfaEnabled?: boolean;
  lastLoginAt?: string;
  lastActiveAt?: string;
  isOnline?: boolean;
  deviceInfo?: string;
  loginCount?: number;
  status?: 'active' | 'inactive' | 'suspended';
  ipAddress?: string;
  terminalName?: string;
}

export interface LoginSession {
  id: string;
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: UserRole;
  loginTime: string;
  lastActiveTime: string;
  deviceInfo: string;
  ipAddress?: string;
  isOnline: boolean;
  terminalName?: string;
}

export interface Batch {
  id: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  storageCondition?: string;
  notes?: string[];
  latestNote?: string;
}

export interface StorageLocation {
  aisle: string; // e.g. "Aisle A", "Aisle B", "Cold Storage", "Front Counter"
  rack: string;  // e.g. "Rack 1", "R-02", "Bay 3"
  shelf: string; // e.g. "Shelf 1", "Shelf 2 (Eye Level)", "Shelf 3", "Shelf 4 (Bottom)"
  bin?: string;  // e.g. "Bin B-04", "Slot 2", "Box 12"
  zone?: 'tablets' | 'liquids' | 'cold_storage' | 'fast_moving' | 'injectables' | 'schedule_h' | 'general';
  temperature?: string; // e.g. "15°C - 25°C", "2°C - 8°C"
  notes?: string;
}

export interface Medicine {
  id: string;
  name: string;
  genericName?: string;
  salt?: string;
  formula?: string;
  barcode?: string;
  rate: number;
  manufacturer?: string;
  supplier?: string;
  stockQuantity: number;
  expiryDate: string;
  mfgDate?: string;
  batchNumber?: string;
  type: 'tablet' | 'capsule' | 'injection' | 'syrup' | 'others';
  minThreshold: number;
  batches: Batch[];
  location?: StorageLocation;
  storageCondition?: string;
}

export interface FieldDiff {
  field: string;
  label: string;
  oldValue: any;
  newValue: any;
  delta?: number | string;
  unit?: string;
  isShrinkage?: boolean;
}

export interface InventoryItemAuditDiff {
  medicineId: string;
  medicineName: string;
  previousStock?: number;
  newStock?: number;
  stockDelta?: number;
  previousRate?: number;
  newRate?: number;
  rateDelta?: number;
  previousThreshold?: number;
  newThreshold?: number;
  previousLocation?: string;
  newLocation?: string;
  isShrinkage?: boolean;
  shrinkageLoss?: number;
  reason?: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  description: string;
  timestamp: string;
  userEmail?: string;
  userId?: string;
  userName?: string;
  userRole?: UserRole | string;
  module?: 'pos' | 'inventory' | 'patients' | 'wholesalers' | 'regulatory' | 'settings' | 'auth' | string;
  type: 'inventory' | 'sale' | 'patient' | 'system' | 'wholesaler' | 'auth';
  details?: Record<string, any>;
  severity?: 'info' | 'success' | 'warning' | 'danger';
  ipAddress?: string;
}

export interface SaleItem {
  medicineId: string;
  name: string;
  quantity: number;
  price: number;
  medicineName?: string;
  rate?: number;
  unit?: string;
  batchNumber?: string;
}

export interface Sale {
  id: string;
  timestamp: string;
  customerName?: string;
  customerMobile?: string;
  items: SaleItem[];
  totalAmount: number;
  paymentMethod: 'cash' | 'card' | 'upi' | 'credit';
  billingType: 'retail' | 'gst' | 'tax_invoice';
  staffId: string;
}

export interface Wholesaler {
  id: string;
  name: string;
  contact: string;
  email?: string;
  address?: string;
  productTypes?: string[];
  brands?: string[];
  leadTimeDays?: number;
  minimumOrderValue?: number;
  discountPercentage?: number;
  rating?: number;
}

export interface OptimizedOrderItem {
  medicineId: string;
  medicineName: string;
  currentStock: number;
  minThreshold: number;
  monthlySalesVelocity: number;
  burnRatePerDay: number;
  daysOfStockRemaining: number;
  vendorLeadTimeBuffer: number;
  recommendedBatchQuantity: number;
  packType: string;
  unitCost: number;
  totalItemCost: number;
  priority: 'urgent_stockout_risk' | 'optimal_replenishment' | 'bulk_tier_saving' | 'buffer_stock';
  justification: string;
  expirySafetyNote?: string;
}

export interface OptimizedWholesalerOrder {
  wholesalerId: string;
  wholesalerName: string;
  contactNumber: string;
  vendorLeadTimeDays: number;
  totalEstimatedAmount: number;
  totalDiscountSavings: number;
  netPayableAmount: number;
  meetsMinimumOrderValue: boolean;
  orderItems: OptimizedOrderItem[];
  wholesalerSummaryNote: string;
  recommendedDispatchDate: string;
}

export interface BatchOptimizerAnalysis {
  executiveSummary: string;
  totalRecommendedInvestment: number;
  totalEstimatedSavings: number;
  criticalStockoutCount: number;
  planningHorizonDays: number;
  wholesalerOrders: OptimizedWholesalerOrder[];
  strategicInsights: string[];
  seasonalTrendsAndWarnings: string[];
  generatedAt: string;
}

export interface Bill {
  id: string;
  wholesalerId: string;
  wholesalerName?: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid';
  imageUrl?: string;
  uploadedAt: string;
  items?: any[];
  notes?: string;
  receivedDate?: string;
  actualLeadTimeDays?: number;
  promisedLeadTimeDays?: number;
  fulfillmentStatus?: 'on_time' | 'early' | 'delayed' | 'pending';
}

export interface SupplierPurchaseRecord {
  id: string;
  wholesalerId: string;
  wholesalerName: string;
  orderNumber: string;
  orderDate: string; // YYYY-MM-DD
  receivedDate?: string; // YYYY-MM-DD
  promisedLeadTimeDays: number;
  actualLeadTimeDays: number;
  fulfillmentStatus: 'on_time' | 'early' | 'delayed' | 'in_transit';
  totalAmount: number;
  itemsCount: number;
  items?: Array<{ name: string; quantity: number; rate: number; packType?: string }>;
  paymentStatus: 'paid' | 'pending' | 'overdue';
  qualityRating?: number;
  invoiceNumber?: string;
}

export interface SupplierMonthlySpend {
  monthKey: string; // e.g. "2026-05"
  monthLabel: string; // e.g. "May 2026"
  spend: number;
  ordersCount: number;
  avgLeadTime: number;
}

export interface SupplierPerformanceMetrics {
  wholesalerId: string;
  wholesalerName: string;
  contact: string;
  email?: string;
  address?: string;
  promisedLeadTimeDays: number;
  avgActualLeadTimeDays: number;
  minLeadTimeDays: number;
  maxLeadTimeDays: number;
  leadTimeVariance: number; // avg actual - promised
  onTimeDeliveryRate: number; // percentage (0 - 100)
  totalSpend: number;
  totalOrdersCount: number;
  completedOrdersCount: number;
  pendingOrdersCount: number;
  averageOrderValue: number;
  discountPercentage: number;
  minimumOrderValue: number;
  reliabilityGrade: 'A+' | 'A' | 'B+' | 'B' | 'C';
  recentOrders: SupplierPurchaseRecord[];
  monthlySpendHistory: SupplierMonthlySpend[];
}

export interface MonthlyMedicineItem {
  id: string;
  medicineId?: string; // Reference to inventory medicine ID
  name: string;
  dosage?: string; // e.g. "1-0-1 After Food", "1 Tab Morning"
  monthlyQuantity: number; // e.g. 30, 60, 2
  unit?: string; // e.g. "Tablets", "Capsules", "Strips", "Bottles", "Units"
  estimatedRate?: number; // Price per unit
  instructions?: string; // e.g. "Take before meals", "Keep refrigerated"
  isActive?: boolean; // Whether active in monthly list
}

export interface MonthlyDispensationRecord {
  id: string;
  monthKey: string; // e.g. "2026-08" (YYYY-MM)
  monthLabel: string; // e.g. "August 2026"
  dispensedDate: string; // ISO date string
  dispensedBy?: string; // Staff/User name
  items: MonthlyMedicineItem[];
  totalAmount?: number;
  status: 'dispensed' | 'partial' | 'skipped';
  notes?: string;
  invoiceId?: string;
}

export interface Patient {
  id: string;
  name: string;
  mobile: string;
  age?: string;
  gender?: string;
  allergies?: string[];
  notes: PatientNote[];
  vitals?: VitalRecord[];
  createdAt: string;
  // Monthly Customer / Chronic Refill Fields
  isMonthlyCustomer?: boolean;
  preferredDayOfMonth?: number; // 1 to 31 (e.g. 5 means 5th of every month)
  monthlyMedicines?: MonthlyMedicineItem[];
  monthlyDispensations?: MonthlyDispensationRecord[];
  chronicConditions?: string[]; // e.g. ["Diabetes", "Hypertension"]
  monthlyCustomerNotes?: string;
}

export interface VitalRecord {
  id: string;
  timestamp: string;
  weight?: number;
  systolic?: number;
  diastolic?: number;
}

export interface PatientNote {
  id: string;
  content: string;
  timestamp: string;
  type: 'general' | 'observation' | 'prescription';
}

export type StockoutUrgency = 'stockout' | 'critical' | 'warning' | 'moderate' | 'healthy' | 'overstocked';

export interface MedicineStockPrediction {
  medicineId: string;
  medicineName: string;
  genericName?: string;
  salt?: string;
  type: string;
  currentStock: number;
  minThreshold: number;
  rate: number;
  dailyBurnRate: number; // units consumed per day
  historicalSalesTotal: number; // total units sold in sample window
  salesVelocityTrend: 'accelerating' | 'stable' | 'declining';
  daysUntilStockOut: number; // days until 0 stock
  projectedStockOutDate: string; // ISO date string YYYY-MM-DD
  projectedStockOutFormatted: string; // Human-friendly e.g. "Aug 31, 2026"
  urgency: StockoutUrgency;
  urgencyLabel: string;
  recommendedRefillQty: number; // recommended units to buy
  recommendedOrderDate: string; // latest date to place order considering vendor lead time
  estimatedRefillCost: number; // unit rate * recommended qty
  expiryDate: string;
  daysUntilExpiry: number;
  expiryConflict?: 'stockout_before_expiry' | 'expiry_before_stockout' | 'balanced';
  clinicalRationale?: string;
}

export interface PredictiveRefillSummary {
  totalMedicinesAnalyzed: number;
  stockedOutCount: number;
  criticalStockoutCount: number; // <= 7 days
  warningStockoutCount: number;  // 8-15 days
  moderateStockoutCount: number; // 16-30 days
  healthyCount: number;          // > 30 days
  totalDailyDepletionUnits: number;
  totalRecommendedRefillUnits: number;
  totalEstimatedRefillCost: number;
  immediateActionRequiredCount: number;
  averageDaysRemaining: number;
  generatedAt: string;
  engine?: string;
}

export interface PredictiveRefillResponse {
  summary: PredictiveRefillSummary;
  predictions: MedicineStockPrediction[];
  strategicRecommendations?: string[];
  fastestDepletingItems?: MedicineStockPrediction[];
}

export interface ReorderTargetPayload {
  medicineId: string;
  medicineName: string;
  batchNumber?: string;
  expiryDate?: string;
  rate?: number;
  stockQuantity?: number;
  supplier?: string;
  module: 'inventory' | 'pos';
  timestamp: number;
}

export type SalesVelocityClass = 'fast-moving' | 'accelerating' | 'steady' | 'slow-moving' | 'dormant';
export type ProcurementUrgency = 'immediate' | 'high' | 'moderate' | 'planned';

export interface SmartProcurementItem {
  medicineId: string;
  medicineName: string;
  genericName?: string;
  salt?: string;
  type: string;
  currentStock: number;
  minThreshold: number;
  rate: number;
  wholesaleRate: number;
  
  // Historical Sales Velocity
  salesVelocityDaily: number;       // units sold / day
  salesVelocityWeekly: number;      // units sold / week
  velocityClass: SalesVelocityClass;
  velocityTrend: 'accelerating' | 'steady' | 'declining';
  historical30dSold: number;
  historical60dSold: number;
  daysOfInventoryRemaining: number; // currentStock / dailyBurn
  projectedStockoutDate: string;    // YYYY-MM-DD
  
  // Seasonal Trends & Disease Epidemiology
  seasonalFactor: number;           // e.g. 1.4 (+40% surge)
  seasonalTrendName: string;        // e.g. "Post-Monsoon Dengue & Viral Surge"
  seasonalDiseaseContext: string;   // Clinical context description
  
  // Optimal Reorder Suggestions
  suggestedReorderQty: number;      // Calculated optimal units to order
  userAdjustedQty?: number;         // Overridden by user stepper
  suggestedReorderTiming: string;   // e.g. "Order Immediately (Today)" or "Order by Oct 20, 2026"
  urgency: ProcurementUrgency;
  safetyStockUnits: number;
  
  // Supplier & Financials
  preferredSupplier: string;
  supplierLeadTimeDays: number;
  estimatedCost: number;            // Wholesale total
  aiClinicalRationale: string;      // Rationale combining sales velocity and seasonal risk
}

export interface SmartProcurementAnalysis {
  summary: {
    totalItemsAnalyzed: number;
    lowStockCount: number;
    criticalUrgencyCount: number;
    totalRecommendedUnits: number;
    totalEstimatedProcurementCost: number;
    earliestReorderDate: string;
    dominantSeasonName: string;
    seasonalRiskIndex: 'low' | 'moderate' | 'high' | 'critical';
    executiveStrategySummary: string;
  };
  recommendations: SmartProcurementItem[];
  seasonalTrendsIdentified: {
    season: string;
    description: string;
    impactCategories: string[];
    suggestedBufferPercentage: number;
  }[];
  generatedAt: string;
  engine: string;
}

