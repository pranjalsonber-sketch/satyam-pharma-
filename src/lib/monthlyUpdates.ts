export interface SoftwareFeature {
  id: string;
  title: string;
  category: 'pos' | 'inventory' | 'ai' | 'compliance' | 'security' | 'reports' | 'patients';
  description: string;
  badge?: string;
  highlights: string[];
}

export interface BusinessIdea {
  id: string;
  title: string;
  category: 'revenue_boost' | 'patient_retention' | 'margin_expansion' | 'seasonal_campaign' | 'service_extension';
  tagline: string;
  description: string;
  estimatedMarginBoost: string; // e.g. "+15-25% margin"
  estimatedMonthlyRevenue: string; // e.g. "₹25,000 - ₹45,000"
  implementationEffort: 'Low (1 Day)' | 'Medium (2-3 Days)' | 'Advanced (1 Week)';
  actionSteps: string[];
  recommendedProducts: string[];
  whatsappMarketingTemplate?: string;
  patientTargetGroup: string;
}

export interface SeasonalDemandItem {
  category: string;
  medicines: string[];
  surgeReason: string;
  marginAdvice: string;
  stockingRecommendation: string;
}

export interface MonthlyRelease {
  version: string; // e.g. "v2026.08"
  releaseName: string;
  monthName: string; // "August 2026"
  yearMonth: string; // "2026-08"
  status: 'installed' | 'available' | 'upcoming' | 'archived';
  releaseDate: string;
  summary: string;
  softwareFeatures: SoftwareFeature[];
  businessIdeas: BusinessIdea[];
  seasonalDemand: SeasonalDemandItem[];
  regulatoryHighlights: string[];
}

export interface MonthlyUpdateConfig {
  autoUpdateEnabled: boolean;
  updateFrequency: 'monthly' | 'bi-weekly' | 'manual';
  updateChannel: 'stable' | 'innovation';
  autoApplyDay: number; // e.g. 1 (1st of month)
  autoApplyTime: string; // e.g. "02:00"
  notifyOnNewRelease: boolean;
  installedVersion: string;
  lastCheckedDate: string;
  adoptedIdeaIds: string[];
  favoriteIdeaIds: string[];
}

const STORAGE_KEY = 'satyam_monthly_update_config_v1';

export const MONTHLY_RELEASES: MonthlyRelease[] = [
  {
    version: 'v2026.08',
    releaseName: 'Monsoon Care & Smart POS Barcode Suite',
    monthName: 'August 2026',
    yearMonth: '2026-08',
    status: 'installed',
    releaseDate: '2026-08-01',
    summary: 'August monthly edition featuring high-speed Camera Barcode/QR scanning in POS, Customizable Expiry Alert thresholds, Audit CSV exports, and Monsoon Season Immunity & Waterborne illness business strategy packs.',
    softwareFeatures: [
      {
        id: 'feat-202608-01',
        title: 'Integrated Camera Barcode & QR Code Scanner in POS',
        category: 'pos',
        badge: 'High Speed',
        description: 'Instant optical barcode and 2D QR code detection directly through device camera with audio beep confirmation and multi-field SKU matching.',
        highlights: [
          'Live laser frame overlay with auto-scan throttle',
          'Automatic shopping cart addition with live stock validation',
          'Front/Back camera switching and USB scanner fallback'
        ]
      },
      {
        id: 'feat-202608-02',
        title: 'Audit-Grade CSV Stock & Medicine Valuation Exporter',
        category: 'reports',
        badge: 'New Tool',
        description: 'Export comprehensive pharmaceutical stock audits formatted with Byte Order Mark for flawless Excel/Sheets compatibility.',
        highlights: [
          'Calculates total inventory valuation in INR in real-time',
          'Detailed batch breakdowns, reorder thresholds & days-to-expiry',
          'Automatic audit trail logging for every export action'
        ]
      },
      {
        id: 'feat-202608-03',
        title: 'Configurable Expiry Alert Settings & Urgency Thresholds',
        category: 'inventory',
        badge: 'Admin Control',
        description: 'Empowers pharmacy managers to tune advance notification windows (15 to 120 days) and customize critical urgency highlighting.',
        highlights: [
          'Interactive slider and instant preset pills (15d, 30d, 45d, 60d, 90d)',
          'Role-based admin permission lock',
          'System-wide real-time widget reactivity'
        ]
      },
      {
        id: 'feat-202608-04',
        title: 'Automated Monthly Software & Business Idea Engine',
        category: 'ai',
        badge: 'Monthly OTA',
        description: 'Continuous monthly software evolution delivering new ERP workflows, seasonal health packs, and revenue-maximizing business strategies every 30 days.',
        highlights: [
          'Automatic monthly OTA version checks and scheduling',
          'Curated pharmacy expansion ideas with ROI calculators',
          'AI-powered custom marketing & bundling planner'
        ]
      }
    ],
    businessIdeas: [
      {
        id: 'idea-202608-01',
        title: 'Monsoon Immunity & Waterborne Infection Defense Kit',
        category: 'seasonal_campaign',
        tagline: 'Bundle high-margin OTC essentials into a grab-and-go family rainy season kit',
        description: 'During August monsoon season, patient footfall surges for gastrointestinal infections, viral fevers, and fungal ailments. Pre-packaging a branded "Family Monsoon Care Pack" increases average basket size by 35% with 28-40% retailer gross margins.',
        estimatedMarginBoost: '+28% to +42% Gross Margin',
        estimatedMonthlyRevenue: '₹32,000 - ₹55,000 Additional Sales',
        implementationEffort: 'Low (1 Day)',
        patientTargetGroup: 'Families with school-going children & working professionals',
        actionSteps: [
          'Create bundled display baskets near POS counter with a clear ₹399 / ₹599 value offer.',
          'Train sales staff to ask: "Are you stocked for monsoon water purifier drops & ORS sachets?" with every fever prescription.',
          'Broadcast seasonal care reminder to registered patient WhatsApp database.',
          'Provide 1 free waterproof pill pouch with every kit purchase.'
        ],
        recommendedProducts: [
          'ORS Hydration Sachets (Electral / Prolyte)',
          'Paracetamol 650mg & Ibuprofen suspensions',
          'Zincovit / Multivitamin + Zinc tablets',
          'Antifungal Powders (Clotrimazole / Terbinafine)',
          'Water Purification Chlorine Tablets / Liquid Drops',
          'Digital Thermometer & Waterproof Bandages'
        ],
        whatsappMarketingTemplate: `🌧️ *Satyam Pharmacy - Monsoon Health Alert!* 🌧️\n\nDear [Patient Name], rainy season increases the risk of viral fever, waterborne infections & humidity skin issues.\n\n🛡️ Get our *All-in-One Monsoon Family Health Kit* at a special 15% combo savings:\n✅ Fever & Pain Relief Essentials\n✅ Instant Electrolyte & Zinc Boosters\n✅ Anti-fungal Hygiene Care\n✅ Water Purifier Drops\n\n📍 Visit Satyam Medicos today or reply to this message for free doorstep delivery!`
      },
      {
        id: 'idea-202608-02',
        title: 'Chronic Care 30-Day Auto-Refill & WhatsApp Loyalty Club',
        category: 'patient_retention',
        tagline: 'Lock in recurring monthly revenue for Diabetes, BP, and Thyroid patients',
        description: 'Chronic disease patients consume medications predictably every 30 days. Creating an automated reminder & reserved refill queue ensures 95%+ patient adherence while preventing customer churn to discount online pharmacies.',
        estimatedMarginBoost: '+18% Steady Monthly Volume',
        estimatedMonthlyRevenue: '₹40,000 - ₹75,000 Recurring Base',
        implementationEffort: 'Medium (2-3 Days)',
        patientTargetGroup: 'Hypertension, Type-2 Diabetes, Cardiac & Thyroid patients (Age 45+)',
        actionSteps: [
          'Tag chronic prescriptions in the ERP Patients module with a 25-day reminder trigger.',
          'Offer free monthly Blood Pressure & Random Blood Sugar check with refill pickup.',
          'Reserve monthly batches in advance with the wholesaler to avoid stockout friction.',
          'Send personalized 5-day advance WhatsApp refill dispatch alerts.'
        ],
        recommendedProducts: [
          'Telmisartan + Amlodipine combinations',
          'Metformin 500mg/1000mg SR + Glimepiride',
          'Thyroxine Sodium (25mcg - 100mcg)',
          'Atorvastatin 10mg/20mg',
          'Accu-Chek / Contour Glucometer Test Strips',
          'Omega-3 Fish Oil & Calcium D3 softgels'
        ],
        whatsappMarketingTemplate: `🩺 *Satyam Pharmacy - Monthly Medication Refill Reminder*\n\nHello [Patient Name],\nYour monthly supply for *[Medicine Name]* is due for refill in 4 days.\n\n✨ Your prescription batch is pre-packed and ready for pickup. We also have complimentary Blood Pressure & Sugar testing available this week.\n\nReply *YES* to dispatch home delivery or *HOLD* to collect in person. Thank you!`
      },
      {
        id: 'idea-202608-03',
        title: 'Branded vs Ethical Generic Salt Substitution Consultation',
        category: 'margin_expansion',
        tagline: 'Save 30% for price-conscious patients while doubling pharmacy margin percentage',
        description: 'Using Satyam ERP\'s AI Salt Composition & Generic Matching matrix, proactively suggest certified IP/BP grade generic substitutes for expensive branded drugs. Patients save money while retailer margin jumps from 16-20% on branded to 45-60% on branded generics.',
        estimatedMarginBoost: '+45% to +60% Retailer Margin',
        estimatedMonthlyRevenue: '₹28,000 - ₹48,000 Extra Net Profit',
        implementationEffort: 'Low (1 Day)',
        patientTargetGroup: 'Uninsured chronic patients, self-paying daily wage earners & elderly pensioners',
        actionSteps: [
          'Use the AI Assistant tab to verify exact salt composition and therapeutic equivalence.',
          'Transparently show the patient: "This tablet contains the exact same active salt formula approved by DCGI at half the cost".',
          'Stock high-quality certified generic alternatives (Cipla Generics, Mankind, Alkem, Zydus).',
          'Provide transparent bill showing exact savings made by the customer.'
        ],
        recommendedProducts: [
          'Pantoprazole 40mg + Domperidone 30mg SR',
          'Montelukast 10mg + Levocetirizine 5mg',
          'Amoxicillin + Clavulanic Acid 625mg',
          'Aceclofenac + Paracetamol + Serratiopeptidase',
          'Rosuvastatin + Fenofibrate'
        ]
      }
    ],
    seasonalDemand: [
      {
        category: 'Monsoon Fevers & Antipyretics',
        medicines: ['Paracetamol 650mg', 'Mefenamic Acid', 'Ibuprofen + Paracetamol', 'Dolo-650', 'Crocin Advance'],
        surgeReason: 'Seasonal viral infections, waterborne fevers, and flu outbreaks during high humidity.',
        marginAdvice: 'Maintain 30-day stock buffer; procure generic strips in 100s box packs for maximum wholesale rebate.',
        stockingRecommendation: 'Increase stock by +40% over baseline.'
      },
      {
        category: 'Electrolytes & Anti-Diarrheal Formulations',
        medicines: ['Electral WHO Formula', 'Prolyte ORS', 'Loperamide 2mg', 'Ofloxacin + Ornidazole', 'Bacillus Clausii Spores'],
        surgeReason: 'Contaminated street water and rainy food pathogens triggering acute gastroenteritis.',
        marginAdvice: 'Place ORS ready-to-drink tetra packs at counter checkout display.',
        stockingRecommendation: 'Increase stock by +60% over baseline.'
      },
      {
        category: 'Topical Antifungals & Dusting Powders',
        medicines: ['Clotrimazole 1% Dusting Powder', 'Terbinafine 1% Cream', 'Ketoconazole Soap', 'Luliconazole 1% Lotion'],
        surgeReason: 'Sweat stagnation and wet footwear causing ringworm, athlete\'s foot, and groin tinea.',
        marginAdvice: 'Bundle dusting powder with every antifungal cream prescription (average +₹110 margin per sale).',
        stockingRecommendation: 'Increase stock by +50% over baseline.'
      }
    ],
    regulatoryHighlights: [
      'CDSCO notification on Good Distribution Practices (GDP) compliance and temperature log audits.',
      'Mandatory QR code verification on top 300 active pharmaceutical formulations (APIs).',
      'Schedule H1 register digital maintenance protocol reminder.'
    ]
  },
  {
    version: 'v2026.09',
    releaseName: 'Autumn Dengue Defense & Multi-Batch Matrix Suite',
    monthName: 'September 2026',
    yearMonth: '2026-09',
    status: 'available',
    releaseDate: '2026-09-01',
    summary: 'Upcoming September edition featuring Vector-Borne Fever Defense Hub, Wholesale Multi-Vendor Price Comparison Matrix, Automated GST Reconciliation v2, and Senior Citizen Loyalty Card program.',
    softwareFeatures: [
      {
        id: 'feat-202609-01',
        title: 'Vector-Borne Disease Rapid Diagnostic & Platelet Tracker',
        category: 'pos',
        badge: 'Upcoming',
        description: 'Direct POS bundling for Dengue NS1 / IgM-IgG test kits, Carica Papaya extract syrups, and hydration management logs.',
        highlights: [
          'Pre-configured Dengue & Malaria OTC recommendation protocol',
          'Automatic prescription warning for NSAIDs in suspected dengue (recommending Paracetamol only)',
          'Wholesale supplier stock availability bridge'
        ]
      },
      {
        id: 'feat-202609-02',
        title: 'Multi-Wholesaler Competitive Purchase Order Generator',
        category: 'inventory',
        badge: 'Cost Saver',
        description: 'Compares wholesale rates across registered suppliers and automatically generates purchase orders to the lowest-cost vendor.',
        highlights: [
          'Margin percentage delta analyzer per distributor',
          'Instant WhatsApp purchase order export with 1-click dispatch',
          'Credit period & payment due date tracking integration'
        ]
      },
      {
        id: 'feat-202609-03',
        title: 'Automated Patient Prescription Refill SMS/WhatsApp Engine',
        category: 'patients',
        badge: 'Engagement',
        description: 'Auto-schedules personalized refill notifications 4 days before patient medicine depletion.',
        highlights: [
          'Direct integration with browser WhatsApp Web and SMS gateways',
          'Customizable Hindi/English message templates',
          'Refill conversion analytics tracking'
        ]
      }
    ],
    businessIdeas: [
      {
        id: 'idea-202609-01',
        title: 'Post-Monsoon Dengue & Platelet Care Express Counter',
        category: 'revenue_boost',
        tagline: 'Set up an express care station for mosquito-borne illness defense',
        description: 'September is the peak season for vector-borne Dengue, Malaria, and Chikungunya. Setting up a dedicated "Dengue & Immunity Defense Desk" with rapid test kits, Carica Papaya, Tinospora (Giloy), and Mosquito repellents captures high seasonal urgency.',
        estimatedMarginBoost: '+35% Seasonal Surge Revenue',
        estimatedMonthlyRevenue: '₹45,000 - ₹80,000 Added Revenue',
        implementationEffort: 'Low (1 Day)',
        patientTargetGroup: 'Patients with sudden high fever, body aches, low platelet alerts',
        actionSteps: [
          'Stock Carica Papaya Leaf Extract tablets/syrups (Platmax / Caripill equivalents) with 40%+ margins.',
          'Stock personal mosquito repellent sprays, roll-ons, and fabric patches near entrance.',
          'Never recommend Aspirin or Brufen for unknown fevers; provide clear medical guidance on Paracetamol + hydration only.',
          'Keep rapid Dengue NS1 antigen card tests available for doctor-prescribed walk-ins.'
        ],
        recommendedProducts: [
          'Carica Papaya Leaf Extract (1100mg Tablets / Syrups)',
          'Giloy / Tinospora Cordifolia Juice & Extracts',
          'DEET & Fabric Mosquito Repellents (Odomos / GoodKnight roll-on)',
          'Paracetamol 650mg plain formulations',
          'Electrolyte effervescent tablets & Coconut water powders'
        ]
      },
      {
        id: 'idea-202609-02',
        title: 'Senior Citizen "Swasthya Card" Privilege Loyalty Club',
        category: 'patient_retention',
        tagline: 'Create a sticky, high-trust community club for elderly neighbourhood patients',
        description: 'Elderly patients value personal care and respect over impersonal online discounts. A formal "Senior Citizen Health Card" providing free quarterly vitals check, priority doorstep delivery, and 7% flat savings creates lifelong customer loyalty that competitors cannot steal.',
        estimatedMarginBoost: '+22% Customer Lifetime Value',
        estimatedMonthlyRevenue: '₹35,000 - ₹60,000 Reliable Monthly Revenue',
        implementationEffort: 'Medium (2-3 Days)',
        patientTargetGroup: 'Neighbourhood seniors (Age 60+) on multi-drug regimens',
        actionSteps: [
          'Issue simple printed or digital "Satyam Senior Privilege" membership numbers.',
          'Offer free digital blood pressure, pulse oximetry & BMI readings on every visit.',
          'Provide a free weekly pill organizer box (7-day morning/noon/night) on first ₹2000 order.',
          'Offer free WhatsApp prescription pickup and home delivery by pharmacy staff.'
        ],
        recommendedProducts: [
          'Weekly 7-Day Pill Organizers & Splitters',
          'Knee & Joint Pain Relief Gels + Heating Pads',
          'Calcium Citrate + Vitamin D3 + K2-7 tablets',
          'Ayurvedic Joint Pain Oils (Orthofit / Rumalaya)',
          'Digital Blood Pressure Monitors (Omron / Dr. Morepen)'
        ]
      }
    ],
    seasonalDemand: [
      {
        category: 'Vector Borne & Platelet Enhancers',
        medicines: ['Caripill 1100mg', 'Platmax Syrup', 'Giloy Ghanvati', 'Papaya Leaf Drops'],
        surgeReason: 'Post-rain stagnant water breeding Aedes mosquitoes.',
        marginAdvice: 'Procure directly from top distributors in 20-box master cartons for extra 8% cash discount.',
        stockingRecommendation: 'Increase stock by +75% over normal baseline.'
      },
      {
        category: 'Mosquito Repellents & Personal Protection',
        medicines: ['Odomos Cream/Spray', 'Good Knight Fabric Roll-on', 'Mosquito Vaporizer Refills', 'Citronella Patches'],
        surgeReason: 'High demand for school kids and evening outdoor protection.',
        marginAdvice: 'Position prominently on cash register impulse rack.',
        stockingRecommendation: 'Increase stock by +100%.'
      }
    ],
    regulatoryHighlights: [
      'Revised Good Manufacturing Practice (GMP) Schedule M enforcement guidelines.',
      'Updated NDPS drug storage double-lock audit compliance checklist.'
    ]
  },
  {
    version: 'v2026.10',
    releaseName: 'Diwali Wellness, Diabetic Care & Festival Gifting Suite',
    monthName: 'October 2026',
    yearMonth: '2026-10',
    status: 'upcoming',
    releaseDate: '2026-10-01',
    summary: 'Upcoming October edition featuring Festive Diabetic Protection Desk, Ayurvedic Wellness Hamper Billing, and Corporate First-Aid Kit Annual Service contracts.',
    softwareFeatures: [
      {
        id: 'feat-202610-01',
        title: 'Festival Health Hamper & Custom Bundle Barcode Engine',
        category: 'pos',
        badge: 'Roadmap',
        description: 'Create multi-item gift hampers (e.g. Sugar-free sweets, Green tea, Dry fruits, Multivitamins) with single scan combo barcodes.',
        highlights: [
          'Pre-packaged festive health gifting presets',
          'Automatic inventory depletion across all constituent items',
          'Custom festive invoice branding for corporate gifting'
        ]
      },
      {
        id: 'feat-202610-02',
        title: 'Diabetic Health Profile & Glycemic Monitoring Log',
        category: 'patients',
        badge: 'Roadmap',
        description: 'Track patient HbA1c history, fasting sugar logs, and automatic glucometer strip reorder reminders.',
        highlights: [
          'Visual HbA1c progress graph inside Patient records',
          'Integration with dietary sugar-free wellness advice',
          'Automated insulin cold-chain storage safety guidelines'
        ]
      }
    ],
    businessIdeas: [
      {
        id: 'idea-202610-01',
        title: 'Diwali "Sweet-Season" Diabetic Protection & Sugar-Free Counter',
        category: 'seasonal_campaign',
        tagline: 'Capitalize on festival sweet consumption with proactive diabetic care',
        description: 'During festive weeks, diabetic patients struggle with sugar spikes and diet indiscretions. Creating a dedicated "Festive Sugar-Safe Counter" with Stevia sweeteners, Glucometer strip combos, and digestive aids captures immediate high-margin holiday spend.',
        estimatedMarginBoost: '+30% Festive Wellness Revenue',
        estimatedMonthlyRevenue: '₹40,000 - ₹70,000 Seasonal Volume',
        implementationEffort: 'Low (1 Day)',
        patientTargetGroup: 'Diabetic & Pre-diabetic individuals and family members buying health gifts',
        actionSteps: [
          'Stock plant-based 100% Stevia & Erythritol sweeteners in bulk.',
          'Offer a "Festive Sugar-Check Combo": Glucometer + 50 Strips + 1 Pack Stevia at special bundled price.',
          'Display Digestive Enzyme syrups & Ayurvedic Churna next to the POS.',
          'Send festive wellness greeting with sugar-safe festive eating tips on WhatsApp.'
        ],
        recommendedProducts: [
          'Stevia Natural Sweetener Drops & Powder (Zevic / Sugar-Free Green)',
          'Glucometer Test Strips 50s Pack',
          'Digestive Enzymes (Aristozyme / Unienzyme)',
          'Antacid Gels (Digene / Gelusil)',
          'Diabetic Foot Moisturizing Cream (Diata / Moisturex)'
        ]
      }
    ],
    seasonalDemand: [
      {
        category: 'Diabetic Care & Sugar Substitutes',
        medicines: ['Stevia Sweetener', 'Glucometer Strips', 'Metformin Combinations', 'Digestive Enzymes'],
        surgeReason: 'Festival sweet intake causing glycemic spikes and indigestion.',
        marginAdvice: 'Bundle glucometer strips with free lancets for 35% margin.',
        stockingRecommendation: 'Increase stock by +40%.'
      }
    ],
    regulatoryHighlights: [
      'Cold-chain vaccine & insulin temperature continuous data logger mandate update.'
    ]
  },
  {
    version: 'v2026.07',
    releaseName: 'Summer Heatstroke, Hydration & Patient Vitals Suite',
    monthName: 'July 2026',
    yearMonth: '2026-07',
    status: 'archived',
    releaseDate: '2026-07-01',
    summary: 'July edition introduced Patient Vitals Tracking (Blood Pressure & Weight), Glucose energy hydration drinks display, and Wholesaler credit ledger.',
    softwareFeatures: [
      {
        id: 'feat-202607-01',
        title: 'Patient Clinical Vitals & Notes Logging',
        category: 'patients',
        description: 'Record patient blood pressure, weight, and clinical prescription history with audit timestamps.',
        highlights: ['Timestamped vital records', 'Searchable patient notes', 'Historical tracking']
      },
      {
        id: 'feat-202607-02',
        title: 'Wholesaler Invoice Image Upload & Ledger',
        category: 'inventory',
        description: 'Upload distributor bills and track pending payment due dates.',
        highlights: ['Due date status badges', 'Supplier bill storage', 'Expense summary']
      }
    ],
    businessIdeas: [
      {
        id: 'idea-202607-01',
        title: 'Summer Heat Exhaustion & Instant Energy Drink Station',
        category: 'seasonal_campaign',
        tagline: 'Hydration energy boosters for summer afternoon footfall',
        description: 'Position Glucose-D, Vitamin C effervescents, and chilled electrolyte tetra packs at store entrance during hot months.',
        estimatedMarginBoost: '+20% Cash Flow',
        estimatedMonthlyRevenue: '₹20,000 - ₹35,000',
        implementationEffort: 'Low (1 Day)',
        patientTargetGroup: 'Daily commuters, outdoor workers, athletes',
        actionSteps: ['Keep cold storage electrolyte drinks ready', 'Offer instant Vitamin C fizzy drink samples'],
        recommendedProducts: ['Glucose-D', 'Enerzal', 'Prolyte 200ml', 'Limcee Chewable']
      }
    ],
    seasonalDemand: [
      {
        category: 'Instant Electrolytes & Heat Care',
        medicines: ['Glucose Powder', 'Electral', 'Caladryl Lotion', 'Prickly Heat Powder'],
        surgeReason: 'Extreme heat, dehydration, and sun allergy rashes.',
        marginAdvice: 'Procure bulk 500g glucose cartons.',
        stockingRecommendation: 'Normal summer baseline.'
      }
    ],
    regulatoryHighlights: [
      'National Health Authority (NHA) ABDM digital prescription standards alignment.'
    ]
  }
];

export function getMonthlyUpdateConfig(): MonthlyUpdateConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load monthly update config from storage:', e);
  }

  // Default initial configuration
  const defaultConfig: MonthlyUpdateConfig = {
    autoUpdateEnabled: true,
    updateFrequency: 'monthly',
    updateChannel: 'stable',
    autoApplyDay: 1,
    autoApplyTime: '02:00',
    notifyOnNewRelease: true,
    installedVersion: 'v2026.08',
    lastCheckedDate: new Date().toISOString(),
    adoptedIdeaIds: ['idea-202608-01'],
    favoriteIdeaIds: ['idea-202608-02']
  };

  saveMonthlyUpdateConfig(defaultConfig);
  return defaultConfig;
}

export function saveMonthlyUpdateConfig(config: MonthlyUpdateConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('monthly-settings-updated', { detail: config }));
  } catch (e) {
    console.error('Failed to save monthly update config to storage:', e);
  }
}

export function getInstalledRelease(): MonthlyRelease {
  const config = getMonthlyUpdateConfig();
  return MONTHLY_RELEASES.find(r => r.version === config.installedVersion) || MONTHLY_RELEASES[0];
}

export function getAvailableReleases(): MonthlyRelease[] {
  return MONTHLY_RELEASES;
}

export function toggleAdoptIdea(ideaId: string): boolean {
  const config = getMonthlyUpdateConfig();
  const exists = config.adoptedIdeaIds.includes(ideaId);
  if (exists) {
    config.adoptedIdeaIds = config.adoptedIdeaIds.filter(id => id !== ideaId);
  } else {
    config.adoptedIdeaIds = [...config.adoptedIdeaIds, ideaId];
  }
  saveMonthlyUpdateConfig(config);
  return !exists;
}

export function toggleFavoriteIdea(ideaId: string): boolean {
  const config = getMonthlyUpdateConfig();
  const exists = config.favoriteIdeaIds.includes(ideaId);
  if (exists) {
    config.favoriteIdeaIds = config.favoriteIdeaIds.filter(id => id !== ideaId);
  } else {
    config.favoriteIdeaIds = [...config.favoriteIdeaIds, ideaId];
  }
  saveMonthlyUpdateConfig(config);
  return !exists;
}

export function checkAndApplyMonthlyUpdate(force = false): {
  hasNewUpdate: boolean;
  newRelease?: MonthlyRelease;
  message: string;
} {
  const config = getMonthlyUpdateConfig();
  const today = new Date();
  const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  // Find if there is a release for the current or newer month that is not installed
  const targetRelease = MONTHLY_RELEASES.find(r => r.yearMonth === currentYearMonth) || MONTHLY_RELEASES[0];

  config.lastCheckedDate = today.toISOString();

  if (targetRelease && (targetRelease.version !== config.installedVersion || force)) {
    if (config.autoUpdateEnabled || force) {
      config.installedVersion = targetRelease.version;
      saveMonthlyUpdateConfig(config);

      window.dispatchEvent(new CustomEvent('monthly-update-applied', {
        detail: {
          release: targetRelease,
          timestamp: today.toISOString()
        }
      }));

      return {
        hasNewUpdate: true,
        newRelease: targetRelease,
        message: `Successfully applied monthly software update ${targetRelease.version} (${targetRelease.monthName} Edition) with ${targetRelease.softwareFeatures.length} new features and ${targetRelease.businessIdeas.length} growth strategies!`
      };
    } else {
      return {
        hasNewUpdate: true,
        newRelease: targetRelease,
        message: `A new monthly software update ${targetRelease.version} (${targetRelease.monthName}) is available for manual installation.`
      };
    }
  }

  saveMonthlyUpdateConfig(config);
  return {
    hasNewUpdate: false,
    newRelease: targetRelease,
    message: `Satyam ERP is running the latest monthly release ${config.installedVersion} (${targetRelease.monthName} Edition). Next automatic update scheduled for 1st of next month.`
  };
}
