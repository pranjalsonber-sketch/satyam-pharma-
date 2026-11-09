import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  ShoppingCart, 
  Package, 
  Bot, 
  Users, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  X, 
  HelpCircle,
  Zap,
  ShieldCheck,
  Printer,
  Barcode,
  Search,
  Activity,
  Layers,
  Compass
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../lib/utils';

export interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tabId: string) => void;
  currentActiveTab?: string;
}

export const ONBOARDING_STORAGE_KEY = 'satyam_erp_onboarding_completed_v1';

export const isFirstTimeUser = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !localStorage.getItem(ONBOARDING_STORAGE_KEY);
};

export const setOnboardingCompleted = (completed = true): void => {
  if (typeof window === 'undefined') return;
  if (completed) {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
  } else {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  }
};

interface StepItem {
  id: string;
  tabTarget?: string;
  titleEn: string;
  titleHi: string;
  subtitleEn: string;
  subtitleHi: string;
  badgeEn: string;
  badgeHi: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  highlightsEn: { title: string; desc: string; icon: React.ElementType }[];
  highlightsHi: { title: string; desc: string; icon: React.ElementType }[];
  proTipEn: string;
  proTipHi: string;
  actionTextEn: string;
  actionTextHi: string;
}

const TOUR_STEPS: StepItem[] = [
  {
    id: 'welcome',
    titleEn: 'Welcome to Satyam ERP Pharmacy Suite',
    titleHi: 'सत्यम ईआरपी फार्मेसी सुइट में आपका स्वागत है',
    subtitleEn: 'An all-in-one professional system for high-speed billing, smart stock management, and AI-assisted dispensing.',
    subtitleHi: 'सुपरफास्ट बिलिंग, स्मार्ट स्टॉक प्रबंधन और एआई-संचालित दवा परामर्श के लिए एक संपूर्ण समाधान।',
    badgeEn: 'Getting Started',
    badgeHi: 'शुरुआत करें',
    icon: Compass,
    iconColor: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
    highlightsEn: [
      { title: 'Bilingual Interface', desc: 'Seamlessly switch between English and हिन्दी anytime from the top bar.', icon: Layers },
      { title: 'Offline-First & Auto Sync', desc: 'All billing, stock, and transactions are synchronized in real-time.', icon: Zap },
      { title: 'Compliance & Audit Ready', desc: 'Built-in batch tracking, Schedule H1 alerts, and expiry management.', icon: ShieldCheck },
    ],
    highlightsHi: [
      { title: 'द्विभाषी इंटरफ़ेस', desc: 'शीर्ष बार से कभी भी अंग्रेजी और हिन्दी के बीच आसानी से स्विच करें।', icon: Layers },
      { title: 'ऑफ़लाइन-सक्षम व रीयल-टाइम सिंक', desc: 'सभी बिलिंग, स्टॉक और लेनदेन तुरंत सिंक होते हैं।', icon: Zap },
      { title: 'नियामक व ऑडिट तैयार', desc: 'बैच ट्रैकिंग, शेड्यूल H1 अलर्ट और एक्सपायरी प्रबंधन की पूरी सुविधा।', icon: ShieldCheck },
    ],
    proTipEn: 'Take this 60-second interactive tour to master your counter and operations.',
    proTipHi: 'अपने काउंटर व संचालन को तेजी से समझने के लिए यह 60 सेकंड का टूर देखें।',
    actionTextEn: 'Explore Key Features',
    actionTextHi: 'मुख्य विशेषताएं देखें',
  },
  {
    id: 'pos',
    tabTarget: 'pos',
    titleEn: 'POS & Ultra-Fast Barcode Billing',
    titleHi: 'पीओएस (POS) और अल्ट्रा-फास्ट बारकोड बिलिंग',
    subtitleEn: 'Create clean, compliant customer invoices in seconds with barcode/QR scanning and auto-tax calculation.',
    subtitleHi: 'बारकोड/क्यूआर स्कैनिंग और स्वचालित टैक्स गणना के साथ सेकंडों में पक्का बिल तैयार करें।',
    badgeEn: 'Core Module #1',
    badgeHi: 'मुख्य मॉड्यूल #1',
    icon: ShoppingCart,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    highlightsEn: [
      { title: 'Camera & USB Barcode Scanning', desc: 'Scan items using your device camera, USB gun scanner, or photo upload.', icon: Barcode },
      { title: 'Instant Bill Printing & Share', desc: 'Generate thermal 3-inch or full A4 GST invoices with custom discounts.', icon: Printer },
      { title: 'Patient Credit & Split Pay', desc: 'Support Cash, UPI/QR, Card, and Udhar (credit) ledger tracking.', icon: Zap },
    ],
    highlightsHi: [
      { title: 'कैमरा व यूएसबी बारकोड स्कैनिंग', desc: 'डिवाइस कैमरा, गन स्कैनर या फोटो अपलोड से तुरंत उत्पाद जोड़ें।', icon: Barcode },
      { title: 'तुरंत प्रिंट व इनवॉइस', desc: '3-इंच थर्मल रसीद या पूर्ण A4 जीएसटी बिल तैयार करें।', icon: Printer },
      { title: 'उधार व बहु-भुगतान', desc: 'नकद, यूपीआई (UPI), कार्ड और मरीज क्रेडिट बहीखाता प्रबंधित करें।', icon: Zap },
    ],
    proTipEn: 'Press the "Scan Barcode" button in POS or use the manual search box to add items instantly.',
    proTipHi: 'पीओएस में "बारकोड स्कैन" बटन दबाएं या तुरंत नाम/साल्ट टाइप करके दवा जोड़ें।',
    actionTextEn: 'Next: Inventory Management',
    actionTextHi: 'आगे: इन्वेंटरी प्रबंधन',
  },
  {
    id: 'inventory',
    tabTarget: 'inventory',
    titleEn: 'Smart Inventory & Batch Expiry Tracking',
    titleHi: 'स्मार्ट इन्वेंटरी और बैच एक्सपायरी ट्रैकिंग',
    subtitleEn: 'Stay on top of medicine stock levels, batch numbers, MRP/PTR margins, and upcoming expiries.',
    subtitleHi: 'दवा स्टॉक की मात्रा, बैच नंबर, एमआरपी/पीटीआर मार्जिन और एक्सपायरी अलर्ट पर हमेशा नियंत्रण रखें।',
    badgeEn: 'Core Module #2',
    badgeHi: 'मुख्य मॉड्यूल #2',
    icon: Package,
    iconColor: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    highlightsEn: [
      { title: 'Expiry Warnings (<30, <60, <90 Days)', desc: 'Colour-coded alerts prevent selling expired stock and save financial losses.', icon: ShieldCheck },
      { title: 'Low Stock Auto-Alerts', desc: 'Customizable thresholds alert you when essential drugs need re-ordering.', icon: Activity },
      { title: 'Wholesaler Purchase Linking', desc: 'Map medicines to specific distributors with purchase rates and invoice histories.', icon: Layers },
    ],
    highlightsHi: [
      { title: 'एक्सपायरी चेतावनी (<30, <60, <90 दिन)', desc: 'रंग-कोडित अलर्ट से खराब स्टॉक के नुकसान से बचें।', icon: ShieldCheck },
      { title: 'कम स्टॉक अलर्ट', desc: 'जरूरी दवाओं के खत्म होने से पहले ही री-ऑर्डर सूचना पाएं।', icon: Activity },
      { title: 'थोक विक्रेता लिंकिंग', desc: 'वितरकों की खरीद दर और इनवॉइस इतिहास के साथ दवाओं को मैप करें।', icon: Layers },
    ],
    proTipEn: 'Click the "Expiring Soon" widget on your dashboard to review items needing clearance or supplier return.',
    proTipHi: 'डैशबोर्ड पर "एक्सपायरी जल्द" विजेट पर क्लिक करके वापसी योग्य स्टॉक देखें।',
    actionTextEn: 'Next: AI Clinical Assistant',
    actionTextHi: 'आगे: एआई क्लिनिकल सहायक',
  },
  {
    id: 'ai',
    tabTarget: 'ai',
    titleEn: 'AI Clinical Pharmacist Assistant',
    titleHi: 'एआई क्लिनिकल फार्मासिस्ट सहायक',
    subtitleEn: 'Instant clinical pharmacology intelligence at your dispensing counter powered by Google Gemini.',
    subtitleHi: 'गूगल जेमिनी द्वारा संचालित क्लिनिकल फार्मेसी और दवा साल्ट विश्लेषण आपके काउंटर पर उपलब्ध।',
    badgeEn: 'AI-Powered Module #3',
    badgeHi: 'एआई संचालित #3',
    icon: Bot,
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/40',
    highlightsEn: [
      { title: 'Salt Composition & Equivalents', desc: 'Find generic brand substitutes when an original prescribed brand is out of stock.', icon: Search },
      { title: 'Dosage & Contraindication Checks', desc: 'Verify pediatric, adult, and geriatric dosages, kidney/liver warnings.', icon: ShieldCheck },
      { title: 'Patient Counseling Advice', desc: 'Get plain-language instructions on food interactions, timing, and side effects.', icon: Sparkles },
    ],
    highlightsHi: [
      { title: 'समान साल्ट व जेनेरिक विकल्प', desc: 'स्टॉक में दवा न होने पर तुरंत सुरक्षित जेनेरिक ब्रांड खोजें।', icon: Search },
      { title: 'खुराक और दुष्प्रभाव जांच', desc: 'बच्चों और वयस्कों की सही खुराक व सावधानी संबंधी जानकारी प्राप्त करें।', icon: ShieldCheck },
      { title: 'रोगी परामर्श निर्देश', desc: 'दवा खाने का समय, परहेज और आम साइड इफेक्ट्स की आसान सलाह।', icon: Sparkles },
    ],
    proTipEn: 'Ask questions like "Substitute for Augmentin 625 with exact salt" or "Pediatric dose for Paracetamol 250".',
    proTipHi: 'सटीक साल्ट विकल्प या बच्चों के लिए खुराक पूछने के लिए "Ask AI" का प्रयोग करें।',
    actionTextEn: 'Next: Patients & Health Logs',
    actionTextHi: 'आगे: मरीज व स्वास्थ्य रिकॉर्ड्स',
  },
  {
    id: 'patients',
    tabTarget: 'patients',
    titleEn: 'Patients & Chronic Care Records',
    titleHi: 'मरीज व क्रॉनिक केयर रिकॉर्ड्स',
    subtitleEn: 'Digital patient health records, vital signs charting (BP, Weight), and voice-dictated observation logs.',
    subtitleHi: 'डिजिटल मरीज प्रोफाइल, ब्लड प्रेशर/वजन चार्टिंग और वॉइस डिक्टेशन द्वारा क्लिनिकल नोट्स।',
    badgeEn: 'Clinical Care #4',
    badgeHi: 'क्लिनिकल केयर #4',
    icon: Users,
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    iconBg: 'bg-cyan-100 dark:bg-cyan-900/40',
    highlightsEn: [
      { title: 'Health Trends & Vitals Graphs', desc: 'Track blood pressure and body weight over time to assess medicine efficacy.', icon: Activity },
      { title: 'Voice-to-Text Clinical Dictation', desc: 'Speak to log patient observations and prescription notes hands-free.', icon: Zap },
      { title: 'Purchase History & Balances', desc: 'Review chronic refill history and maintain loyalty with personalized care.', icon: CheckCircle2 },
    ],
    highlightsHi: [
      { title: 'स्वास्थ्य ट्रेंड व वाइटल्स ग्राफ', desc: 'दवा के प्रभाव का आकलन करने के लिए बीपी (BP) और वजन का ग्राफ देखें।', icon: Activity },
      { title: 'बोलकर नोट्स लिखें (Voice Dictation)', desc: 'माइक चालू करके मरीज की टिप्पणियां और प्रिस्क्रिप्शन बिना टाइप किए दर्ज करें।', icon: Zap },
      { title: 'खरीद इतिहास व खाता', desc: 'नियमित दवाओं का इतिहास देखें और बेहतर ग्राहक सेवा प्रदान करें।', icon: CheckCircle2 },
    ],
    proTipEn: 'Use the microphone button in Patients to dictate observations in English or Hindi.',
    proTipHi: 'मरीज रिकॉर्ड में माइक बटन दबाकर बोलकर अवलोकन नोट दर्ज करें।',
    actionTextEn: 'Ready to Dispense!',
    actionTextHi: 'शुरू करने के लिए तैयार!',
  },
  {
    id: 'ready',
    tabTarget: 'dashboard',
    titleEn: "You're Ready to Experience Satyam ERP!",
    titleHi: 'आप सत्यम ईआरपी शुरू करने के लिए तैयार हैं!',
    subtitleEn: 'Select any module below to start dispensing, managing stock, or consulting the AI Assistant.',
    subtitleHi: 'दवा बिलिंग, स्टॉक प्रबंधन या एआई परामर्श शुरू करने के लिए नीचे दिए गए विकल्प चुनें।',
    badgeEn: 'Setup Complete',
    badgeHi: 'टूर समाप्त',
    icon: Sparkles,
    iconColor: 'text-amber-500',
    iconBg: 'bg-amber-100 dark:bg-amber-950/60',
    highlightsEn: [
      { title: 'Open POS Counter', desc: 'Start creating new customer bills and scan barcodes.', icon: ShoppingCart },
      { title: 'Browse Inventory', desc: 'Add new medicines, adjust thresholds, and check batch expiries.', icon: Package },
      { title: 'Ask Clinical AI', desc: 'Look up pharmacology interactions and salt equivalents.', icon: Bot },
    ],
    highlightsHi: [
      { title: 'पीओएस काउंटर खोलें', desc: 'ग्राहकों के नए बिल बनाना और बारकोड स्कैन करना शुरू करें।', icon: ShoppingCart },
      { title: 'इन्वेंटरी देखें', desc: 'नई दवाएं जोड़ें, स्टॉक अपडेट करें और एक्सपायरी जांचें।', icon: Package },
      { title: 'क्लिनिकल एआई से पूछें', desc: 'दवा साल्ट, विकल्प और खुराक की जानकारी तुरंत पाएं।', icon: Bot },
    ],
    proTipEn: 'You can replay this walkthrough anytime from the top navigation bar or Settings menu.',
    proTipHi: 'आप इस गाइड को कभी भी शीर्ष नेविगेशन बार या सेटिंग्स से दोबारा खोल सकते हैं।',
    actionTextEn: 'Start Using Satyam ERP',
    actionTextHi: 'सत्यम ईआरपी शुरू करें',
  }
];

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  currentActiveTab
}) => {
  const { isHindi, tText } = useLanguage();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [previewTabSync, setPreviewTabSync] = useState(true);

  const step = TOUR_STEPS[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === TOUR_STEPS.length - 1;

  // Sync background active tab as user navigates steps
  useEffect(() => {
    if (isOpen && previewTabSync && step.tabTarget) {
      onNavigateTab(step.tabTarget);
    }
  }, [isOpen, currentStepIndex, previewTabSync]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (!isLastStep) {
          handleNext();
        } else {
          handleFinish();
        }
      } else if (e.key === 'ArrowLeft') {
        if (!isFirstStep) {
          handlePrev();
        }
      } else if (e.key === 'Escape') {
        handleFinish();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStepIndex, isFirstStep, isLastStep]);

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleFinish = (targetTab?: string) => {
    setOnboardingCompleted(true);
    if (targetTab) {
      onNavigateTab(targetTab);
    }
    onClose();
  };

  const handleStepClick = (index: number) => {
    setCurrentStepIndex(index);
  };

  if (!isOpen) return null;

  const IconComponent = step.icon;
  const highlights = isHindi ? step.highlightsHi : step.highlightsEn;

  return (
    <AnimatePresence>
      <div 
        id="onboarding-tour-modal"
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md overflow-y-auto"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 dark:border-slate-800/80 dark:bg-slate-900/95 shadow-2xl backdrop-blur-xl"
        >
          {/* Top Decorative Gradient Line */}
          <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500" />

          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl shadow-sm", step.iconBg)}>
                <IconComponent size={20} className={step.iconColor} />
              </div>
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
                  {tText(step.badgeEn, step.badgeHi)}
                </span>
                <span className="ml-2 text-[11px] font-bold text-slate-400">
                  {tText(`Step ${currentStepIndex + 1} of ${TOUR_STEPS.length}`, `कदम ${currentStepIndex + 1} / ${TOUR_STEPS.length}`)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleFinish()}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                title={tText('Close Tour', 'टूर बंद करें')}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Modal Body with Animated Step Switch */}
          <div className="p-6 sm:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Title & Description */}
                <div>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                    {tText(step.titleEn, step.titleHi)}
                  </h2>
                  <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {tText(step.subtitleEn, step.subtitleHi)}
                  </p>
                </div>

                {/* Feature Highlights Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {highlights.map((h, i) => {
                    const HIcon = h.icon;
                    return (
                      <div 
                        key={i}
                        className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 transition-all hover:border-blue-200 dark:hover:border-blue-800 hover:bg-white dark:hover:bg-slate-800/70 shadow-2xs flex flex-col justify-between"
                      >
                        <div>
                          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs border border-slate-100 dark:border-slate-600">
                            <HIcon size={16} />
                          </div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {h.title}
                          </h4>
                          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                            {h.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pro-Tip Box */}
                <div className="flex items-start gap-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 p-3.5">
                  <Sparkles size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                    <span className="font-black uppercase tracking-wider text-[10px] text-amber-700 dark:text-amber-400 mr-1.5">
                      {tText('Pro Tip:', 'सुझाव:')}
                    </span>
                    {tText(step.proTipEn, step.proTipHi)}
                  </div>
                </div>

                {/* Direct Module Launch Shortcuts on Final Step */}
                {isLastStep && (
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {tText('Jump Straight to a Module:', 'सीधे किसी मॉड्यूल पर जाएं:')}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleFinish('pos')}
                        className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition-all cursor-pointer shadow-sm active:scale-95"
                      >
                        <ShoppingCart size={14} />
                        <span>{tText('Start POS Bill', 'पीओएस बिलिंग')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFinish('inventory')}
                        className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition-all cursor-pointer shadow-sm active:scale-95"
                      >
                        <Package size={14} />
                        <span>{tText('Open Inventory', 'इन्वेंटरी खोलें')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFinish('ai')}
                        className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition-all cursor-pointer shadow-sm active:scale-95"
                      >
                        <Bot size={14} />
                        <span>{tText('Ask AI Clinical', 'एआई क्लिनिकल')}</span>
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Modal Footer & Navigation Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/30 px-6 py-4 gap-4">
            {/* Step Dots Track */}
            <div className="flex items-center gap-1.5">
              {TOUR_STEPS.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleStepClick(idx)}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300 cursor-pointer",
                    currentStepIndex === idx 
                      ? "w-6 bg-blue-600 dark:bg-blue-500 shadow-xs" 
                      : "w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400"
                  )}
                  title={tText(s.titleEn, s.titleHi)}
                />
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              {!isFirstStep && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-2xs"
                >
                  <ArrowLeft size={14} />
                  <span>{tText('Back', 'पीछे')}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleFinish()}
                className="rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                {tText('Skip Tour', 'छोड़ें')}
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-black text-white hover:bg-blue-700 transition-all cursor-pointer shadow-md hover:shadow-blue-500/25 active:scale-95"
              >
                <span>{tText(step.actionTextEn, step.actionTextHi)}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default OnboardingTour;
