import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Sparkles, 
  RefreshCw, 
  Heart, 
  Share2, 
  Copy, 
  Check, 
  Maximize2, 
  X, 
  BookOpen, 
  Lightbulb, 
  Quote as QuoteIcon, 
  ChevronRight, 
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Calendar,
  Layers,
  Search,
  HeartPulse,
  Award,
  Sliders,
  Bot,
  Zap,
  ShieldCheck,
  Smile,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';
import { 
  DAILY_QUOTES, 
  DailyQuote, 
  getDailyQuote, 
  getFormattedTodayDate, 
  getFavoriteQuoteIds, 
  toggleFavoriteQuote,
  getDayOfYear,
  AiDailyWisdom,
  fetchAiDailyWisdom
} from '../lib/dailyQuotes';
import { cn } from '../lib/utils';

interface MindRefreshmentWidgetProps {
  className?: string;
  variant?: 'sidebar' | 'header-pill' | 'compact';
  onLocationChange?: (location: 'sidebar' | 'header' | 'both') => void;
}

export const MindRefreshmentWidget: React.FC<MindRefreshmentWidgetProps> = ({
  className,
  variant = 'sidebar',
  onLocationChange
}) => {
  const { isHindi, tText } = useLanguage();
  
  // AI Affirmation & Wisdom State
  const [aiWisdom, setAiWisdom] = useState<AiDailyWisdom | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [selectedAiTheme, setSelectedAiTheme] = useState<string>('affirmation');
  const [customFocusTopic, setCustomFocusTopic] = useState<string>('');
  const [displayMode, setDisplayMode] = useState<'ai' | 'curated'>('ai');

  // Manual browsing offset from today's natural quote for curated library
  const [manualOffset, setManualOffset] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [savedAiAffirmations, setSavedAiAffirmations] = useState<AiDailyWisdom[]>(() => {
    try {
      const saved = localStorage.getItem('satyam_saved_ai_affirmations');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  const [animating, setAnimating] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'today' | 'ai_generator' | 'all' | 'favorites'>('today');
  
  // Widget customization settings (persisted)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('satyam_quote_collapsed');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [showTip, setShowTip] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('satyam_quote_show_tip');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [placement, setPlacement] = useState<'sidebar' | 'header' | 'both'>(() => {
    try {
      const saved = localStorage.getItem('satyam_quote_placement');
      return (saved as 'sidebar' | 'header' | 'both') || 'both';
    } catch {
      return 'both';
    }
  });

  const [showAdjustMenu, setShowAdjustMenu] = useState<boolean>(false);

  // Load Initial Daily AI Wisdom
  const loadDailyWisdom = useCallback(async (theme: string = 'affirmation', force: boolean = false) => {
    setIsAiLoading(true);
    try {
      const result = await fetchAiDailyWisdom({
        theme,
        focusTopic: customFocusTopic.trim() || undefined,
        forceRefresh: force
      });
      setAiWisdom(result);
      setDisplayMode('ai');
    } catch (err) {
      console.warn("Error fetching daily wisdom:", err);
    } finally {
      setIsAiLoading(false);
    }
  }, [customFocusTopic]);

  useEffect(() => {
    loadDailyWisdom('affirmation', false);
    setFavorites(getFavoriteQuoteIds());
  }, [loadDailyWisdom]);

  const toggleCollapsed = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    try {
      localStorage.setItem('satyam_quote_collapsed', JSON.stringify(next));
    } catch {}
  };

  const toggleShowTip = (val?: boolean) => {
    const next = typeof val === 'boolean' ? val : !showTip;
    setShowTip(next);
    try {
      localStorage.setItem('satyam_quote_show_tip', JSON.stringify(next));
    } catch {}
  };

  const handlePlacementChange = (newPlacement: 'sidebar' | 'header' | 'both') => {
    setPlacement(newPlacement);
    try {
      localStorage.setItem('satyam_quote_placement', newPlacement);
    } catch {}
    if (onLocationChange) {
      onLocationChange(newPlacement);
    }
  };

  // Today's curated quote with current offset
  const currentCuratedQuote: DailyQuote = useMemo(() => {
    return getDailyQuote(new Date(), manualOffset);
  }, [manualOffset]);

  // Current active display quote (AI or Curated)
  const currentDisplay = useMemo(() => {
    if (displayMode === 'ai' && aiWisdom) {
      return {
        textEn: aiWisdom.affirmationEn,
        textHi: aiWisdom.affirmationHi,
        authorEn: aiWisdom.authorEn,
        authorHi: aiWisdom.authorHi,
        category: aiWisdom.category,
        categoryLabelEn: aiWisdom.categoryLabelEn,
        categoryLabelHi: aiWisdom.categoryLabelHi,
        tipEn: aiWisdom.tipEn,
        tipHi: aiWisdom.tipHi,
        charCountEn: aiWisdom.affirmationEn.length,
        charCountHi: aiWisdom.affirmationHi.length,
        isAi: true,
        engine: aiWisdom.engine
      };
    }
    return {
      textEn: currentCuratedQuote.en,
      textHi: currentCuratedQuote.hi,
      authorEn: currentCuratedQuote.authorEn,
      authorHi: currentCuratedQuote.authorHi,
      category: currentCuratedQuote.category,
      categoryLabelEn: currentCuratedQuote.categoryLabelEn,
      categoryLabelHi: currentCuratedQuote.categoryLabelHi,
      tipEn: currentCuratedQuote.tipEn,
      tipHi: currentCuratedQuote.tipHi,
      charCountEn: currentCuratedQuote.en.length,
      charCountHi: currentCuratedQuote.hi.length,
      isAi: false,
      engine: 'curated_library'
    };
  }, [displayMode, aiWisdom, currentCuratedQuote]);

  const isFavorite = favorites.includes(currentCuratedQuote.id);
  const isAiFavorite = useMemo(() => {
    if (!aiWisdom) return false;
    return savedAiAffirmations.some(a => a.affirmationEn === aiWisdom.affirmationEn);
  }, [aiWisdom, savedAiAffirmations]);

  const dateLabel = getFormattedTodayDate(isHindi);

  // Handle Next / Refresh quote
  const handleNextQuote = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setAnimating(true);
    if (displayMode === 'ai') {
      loadDailyWisdom(selectedAiTheme, true);
    } else {
      setManualOffset(prev => prev + 1);
    }
    setTimeout(() => setAnimating(false), 300);
  };

  const handlePrevQuote = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setAnimating(true);
    if (displayMode === 'ai') {
      loadDailyWisdom(selectedAiTheme, true);
    } else {
      setManualOffset(prev => prev - 1);
    }
    setTimeout(() => setAnimating(false), 300);
  };

  const handleResetToToday = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setAnimating(true);
    setDisplayMode('ai');
    setManualOffset(0);
    loadDailyWisdom('affirmation', false);
    setTimeout(() => setAnimating(false), 300);
  };

  // Toggle favorite for curated quote
  const handleToggleFav = (e?: React.MouseEvent, id: number = currentCuratedQuote.id) => {
    e?.stopPropagation();
    toggleFavoriteQuote(id);
    setFavorites(getFavoriteQuoteIds());
  };

  // Toggle favorite for AI affirmation
  const handleToggleAiFav = (e?: React.MouseEvent, wisdom: AiDailyWisdom | null = aiWisdom) => {
    e?.stopPropagation();
    if (!wisdom) return;
    const exists = savedAiAffirmations.some(a => a.affirmationEn === wisdom.affirmationEn);
    let updated: AiDailyWisdom[];
    if (exists) {
      updated = savedAiAffirmations.filter(a => a.affirmationEn !== wisdom.affirmationEn);
    } else {
      updated = [wisdom, ...savedAiAffirmations];
    }
    setSavedAiAffirmations(updated);
    try {
      localStorage.setItem('satyam_saved_ai_affirmations', JSON.stringify(updated));
    } catch {}
  };

  // Copy quote text
  const handleCopyQuote = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const text = isHindi
      ? `"${currentDisplay.textHi}"\n— ${currentDisplay.authorHi} (${currentDisplay.categoryLabelHi})\n[सत्यम मेडिकोज - दैनिक सुविचार]`
      : `"${currentDisplay.textEn}"\n— ${currentDisplay.authorEn} (${currentDisplay.categoryLabelEn})\n[Satyam Medical - Daily Mind Refreshment]`;
    
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filtered curated quotes list for browse modal
  const filteredQuotes = useMemo(() => {
    return DAILY_QUOTES.filter(q => {
      if (activeTab === 'favorites' && !favorites.includes(q.id)) {
        return false;
      }
      if (selectedCategory !== 'all' && q.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesEn = q.en.toLowerCase().includes(query) || q.authorEn.toLowerCase().includes(query);
        const matchesHi = q.hi.toLowerCase().includes(query) || q.authorHi.toLowerCase().includes(query);
        return matchesEn || matchesHi;
      }
      return true;
    });
  }, [activeTab, favorites, selectedCategory, searchQuery]);

  const aiThemesList = [
    { id: 'affirmation', icon: Sparkles, labelEn: 'Daily Affirmation', labelHi: 'दैनिक संकल्प', desc: 'Positive mindset for pharmacy staff' },
    { id: 'wisdom', icon: BookOpen, labelEn: 'Pharmacy Wisdom', labelHi: 'फार्मेसी विवेक', desc: 'Industry aphorisms and clinical ethics' },
    { id: 'clinical', icon: ShieldCheck, labelEn: 'Drug Safety & Precision', labelHi: 'औषधि सुरक्षा व शुद्धता', desc: 'Dosage accuracy & vigilance' },
    { id: 'empathy', icon: Heart, labelEn: 'Patient Empathy & Care', labelHi: 'रोगी सहानुभूति व सेवा', desc: 'Compassionate healthcare guidance' },
    { id: 'motivation', icon: Zap, labelEn: 'Energy & Excellence', labelHi: 'ऊर्जा व प्रेरणा', desc: 'Service passion & high focus' }
  ];

  // Reusable modal component for both header and sidebar views
  const renderModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 font-black shadow-md">
              <Sparkles size={20} className={isAiLoading ? "animate-spin" : ""} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2 flex-wrap">
                <span>{tText('Mind Refreshment & Pharmacy Wisdom', 'दैनिक सुविचार एवं फार्मेसी प्रेरणा')}</span>
                <span className="rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold px-2 py-0.5">
                  {dateLabel}
                </span>
                <span className="rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-bold px-2 py-0.5 flex items-center gap-1">
                  <Bot size={10} />
                  <span>Gemini AI (≤ 150 Chars)</span>
                </span>
              </h3>
              <p className="text-xs text-slate-300 line-clamp-1">
                {tText(
                  'Daily affirmations and industry wisdom powered by Gemini AI, strictly limited to 150 characters.',
                  'जेमिनी एआई द्वारा संचालित दैनिक संकल्प व फार्मेसी विचार (अधिकतम 150 अक्षर)।'
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
            className="rounded-xl p-2 text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3 sm:px-6">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('today')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                activeTab === 'today'
                  ? "bg-amber-400 text-slate-950 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
              )}
            >
              <Sparkles size={13} />
              <span>{tText('Today\'s Thought', 'आज का विचार')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ai_generator')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                activeTab === 'ai_generator'
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
              )}
            >
              <Bot size={13} />
              <span>{tText('AI Affirmation Lab', 'AI संकल्प जनरेटर')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                activeTab === 'all'
                  ? "bg-amber-400 text-slate-950 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
              )}
            >
              {tText('All 31 Thoughts', 'सभी 31 विचार')}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('favorites')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
                activeTab === 'favorites'
                  ? "bg-amber-400 text-slate-950 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
              )}
            >
              <Heart size={12} className={favorites.length > 0 || savedAiAffirmations.length > 0 ? "fill-rose-500 text-rose-500" : ""} />
              <span>{tText('Favorites', 'पसंदीदा')} ({favorites.length + savedAiAffirmations.length})</span>
            </button>
          </div>

          {activeTab === 'all' && (
            <div className="relative w-full sm:w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tText('Search thoughts...', 'विचार खोजें...')}
                className="w-full pl-8 pr-3 py-1 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-400"
              />
            </div>
          )}
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {activeTab === 'today' ? (
            <div className="space-y-4">
              {/* Active Wisdom Showcase Card */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 p-6 border border-amber-400/30 text-white shadow-xl">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold text-amber-300 border border-amber-400/30 flex items-center gap-1.5">
                      <Sparkles size={12} />
                      {isHindi ? currentDisplay.categoryLabelHi : currentDisplay.categoryLabelEn}
                    </span>

                    {currentDisplay.isAi && (
                      <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-bold text-blue-300 border border-blue-400/30 flex items-center gap-1">
                        <Bot size={10} />
                        <span>Gemini 3.7</span>
                      </span>
                    )}

                    {/* Strict 150 Character Limit Badge */}
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-mono font-bold text-emerald-300 border border-emerald-400/30">
                      {isHindi ? currentDisplay.charCountHi : currentDisplay.charCountEn}/150 chars
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (currentDisplay.isAi && aiWisdom) {
                          handleToggleAiFav(undefined, aiWisdom);
                        } else {
                          handleToggleFav(undefined, currentCuratedQuote.id);
                        }
                      }}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                      title="Toggle Favorite"
                    >
                      <Heart size={16} className={(currentDisplay.isAi ? isAiFavorite : isFavorite) ? "fill-rose-500 text-rose-500" : ""} />
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyQuote}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                    >
                      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      <span>{copied ? tText('Copied!', 'कॉपी हुआ!') : tText('Share', 'साझा')}</span>
                    </button>
                  </div>
                </div>

                <QuoteIcon size={28} className="text-amber-400/40 mb-2" />
                <p className="text-lg sm:text-xl font-bold italic leading-relaxed text-slate-100">
                  "{isHindi ? currentDisplay.textHi : currentDisplay.textEn}"
                </p>

                <div className="mt-4 pt-4 border-t border-slate-700/60 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-xs font-bold text-amber-300">
                      — {isHindi ? currentDisplay.authorHi : currentDisplay.authorEn}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {currentDisplay.isAi 
                        ? tText('Personalized AI Affirmation • Verified ≤ 150 chars', 'व्यक्तिगत AI संकल्प • सत्यापित ≤ 150 अक्षर')
                        : `Thought #${currentCuratedQuote.id} of 31 • Rotating Daily`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isAiLoading}
                      onClick={() => loadDailyWisdom(selectedAiTheme, true)}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
                    >
                      <RefreshCw size={13} className={isAiLoading ? "animate-spin" : ""} />
                      <span>{isAiLoading ? tText('Generating...', 'बना रहा है...') : tText('New AI Affirmation', 'नया AI विचार')}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Pharmacist Micro-Tip Card */}
              {currentDisplay.tipEn && (
                <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-4 text-amber-900 dark:text-amber-200 flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-slate-950">
                    <Lightbulb size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider mb-0.5">
                      {tText('Daily Pharmacist & Staff Action Tip', 'दैनिक फार्मेसी स्टाफ प्रेरणा व सुझाव')}
                    </h4>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                      {isHindi ? currentDisplay.tipHi : currentDisplay.tipEn}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'ai_generator' ? (
            /* Interactive AI Affirmation Generator Lab */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-slate-900/40 border border-blue-500/30">
                <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                  <Bot size={16} className="text-blue-500" />
                  <span>{tText('Gemini AI Affirmation & Wisdom Engine', 'जेमिनी AI फार्मेसी संकल्प एवं विवेक')}</span>
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {tText(
                    'Select a theme below to instantly generate customized wisdom strictly constrained to 150 characters for patient care, staff motivation, and medication precision.',
                    'दवा सुरक्षा, स्टाफ प्रेरणा व रोगी सेवा के लिए 150 अक्षरों में संक्षिप्त विचार उत्पन्न करें।'
                  )}
                </p>
              </div>

              {/* Theme Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {tText('Select Wisdom Theme / Purpose:', 'विषय / उद्देश्य चुनें:')}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {aiThemesList.map((thm) => {
                    const Icon = thm.icon;
                    const isSelected = selectedAiTheme === thm.id;
                    return (
                      <button
                        key={thm.id}
                        type="button"
                        onClick={() => setSelectedAiTheme(thm.id)}
                        className={cn(
                          "p-3 rounded-2xl text-left border transition-all flex items-start gap-3 cursor-pointer",
                          isSelected
                            ? "bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-950 dark:text-blue-100 shadow-xs ring-1 ring-blue-500"
                            : "bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-blue-300 text-slate-700 dark:text-slate-300"
                        )}
                      >
                        <div className={cn(
                          "p-2 rounded-xl shrink-0",
                          isSelected ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                        )}>
                          <Icon size={16} />
                        </div>
                        <div>
                          <div className="text-xs font-bold leading-tight">
                            {isHindi ? thm.labelHi : thm.labelEn}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                            {thm.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional Custom Topic */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>{tText('Optional Focus / Staff Name:', 'वैकल्पिक फोकस / स्टाफ का नाम:')}</span>
                  <span className="text-[10px] text-slate-400">{tText('e.g. Dispensing rush, pediatric dosage, morning motivation', 'उदा. सुबह की ऊर्जा, बाल खुराक सुरक्षा')}</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customFocusTopic}
                    onChange={(e) => setCustomFocusTopic(e.target.value)}
                    placeholder={tText('e.g. Double check look-alike drugs or Monday rush enthusiasm', 'उदा. समान दिखने वाली दवाओं की जांच')}
                    className="flex-1 px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    disabled={isAiLoading}
                    onClick={() => {
                      loadDailyWisdom(selectedAiTheme, true);
                      setActiveTab('today');
                    }}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md transition-all shrink-0"
                  >
                    <Sparkles size={14} className={isAiLoading ? "animate-spin" : ""} />
                    <span>{isAiLoading ? tText('Generating...', 'बना रहा है...') : tText('Generate (≤ 150c)', 'उत्पन्न करें (≤ 150c)')}</span>
                  </button>
                </div>
              </div>

              {/* Character Limit Strict Rule Info */}
              <div className="rounded-xl bg-slate-100 dark:bg-slate-800/80 p-3 text-[11px] text-slate-600 dark:text-slate-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
                  <span>
                    <strong>Strict 150-Character Compliance:</strong> All outputs are verified and capped at maximum 150 characters for rapid reading.
                  </span>
                </div>
                <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">≤ 150 MAX</span>
              </div>
            </div>
          ) : activeTab === 'favorites' ? (
            /* Favorites Tab */
            <div className="space-y-3">
              {favorites.length === 0 && savedAiAffirmations.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  {tText('No favorite thoughts saved yet. Click the heart icon on any thought to save it here.', 'कोई पसंदीदा विचार सहेजा नहीं गया है।')}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Saved AI Affirmations */}
                  {savedAiAffirmations.map((aiItem, idx) => (
                    <div
                      key={`ai-fav-${idx}`}
                      className="rounded-2xl p-4 border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-2">
                          <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                            <Bot size={11} />
                            <span>AI • {isHindi ? aiItem.categoryLabelHi : aiItem.categoryLabelEn}</span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleToggleAiFav(e, aiItem)}
                            className="text-rose-500 hover:text-slate-400 transition-colors p-1"
                          >
                            <Heart size={13} className="fill-rose-500 text-rose-500" />
                          </button>
                        </div>

                        <p className="text-xs font-medium italic text-slate-800 dark:text-slate-200 leading-relaxed">
                          "{isHindi ? aiItem.affirmationHi : aiItem.affirmationEn}"
                        </p>
                      </div>

                      <div className="pt-2 mt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[10px]">
                        <span className="font-bold text-slate-600 dark:text-slate-400 truncate">
                          — {isHindi ? aiItem.authorHi : aiItem.authorEn}
                        </span>

                        <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                          {isHindi ? aiItem.affirmationHi.length : aiItem.affirmationEn.length}/150c
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Saved Curated Quotes */}
                  {DAILY_QUOTES.filter(q => favorites.includes(q.id)).map((quote) => (
                    <div
                      key={quote.id}
                      className="rounded-2xl p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-2">
                          <span className="font-bold text-amber-600 dark:text-amber-400">
                            #{quote.id} • {isHindi ? quote.categoryLabelHi : quote.categoryLabelEn}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleToggleFav(e, quote.id)}
                            className="text-rose-500 hover:text-slate-400 transition-colors p-1"
                          >
                            <Heart size={13} className="fill-rose-500 text-rose-500" />
                          </button>
                        </div>

                        <p className="text-xs font-medium italic text-slate-800 dark:text-slate-200 leading-relaxed">
                          "{isHindi ? quote.hi : quote.en}"
                        </p>
                      </div>

                      <div className="pt-2 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px]">
                        <span className="font-bold text-slate-600 dark:text-slate-400">
                          — {isHindi ? quote.authorHi : quote.authorEn}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            const text = isHindi ? `"${quote.hi}"\n— ${quote.authorHi}` : `"${quote.en}"\n— ${quote.authorEn}`;
                            navigator.clipboard.writeText(text);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer font-bold"
                        >
                          <Copy size={11} />
                          <span>{tText('Copy', 'कॉपी')}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* All Curated Quotes Library */
            <div className="space-y-3">
              {filteredQuotes.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  {tText('No thoughts found matching your criteria.', 'कोई विचार नहीं मिला।')}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredQuotes.map((quote) => {
                    const isFav = favorites.includes(quote.id);
                    return (
                      <div
                        key={quote.id}
                        className="rounded-2xl p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-amber-400/50 transition-all shadow-xs flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-2">
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              #{quote.id} • {isHindi ? quote.categoryLabelHi : quote.categoryLabelEn}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleToggleFav(e, quote.id)}
                              className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                            >
                              <Heart size={13} className={isFav ? "fill-rose-500 text-rose-500" : ""} />
                            </button>
                          </div>

                          <p className="text-xs font-medium italic text-slate-800 dark:text-slate-200 leading-relaxed">
                            "{isHindi ? quote.hi : quote.en}"
                          </p>
                        </div>

                        <div className="pt-2 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px]">
                          <span className="font-bold text-slate-600 dark:text-slate-400">
                            — {isHindi ? quote.authorHi : quote.authorEn}
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              const text = isHindi ? `"${quote.hi}"\n— ${quote.authorHi}` : `"${quote.en}"\n— ${quote.authorEn}`;
                              navigator.clipboard.writeText(text);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            }}
                            className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer font-bold"
                          >
                            <Copy size={11} />
                            <span>{tText('Copy', 'कॉपी')}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-100 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900 text-center text-xs text-slate-500 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Award size={13} className="text-amber-500" />
            <span>Satyam Medical • Daily AI Mind Refreshment (≤ 150c)</span>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
            className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            {tText('Close', 'बंद करें')}
          </button>
        </div>
      </motion.div>
    </div>
  );

  // If user chose header-only placement and this is the sidebar instance
  if (placement === 'header' && variant === 'sidebar') {
    return null;
  }

  // Header Pill Variant (Displayed at Top Navigation Header)
  if (variant === 'header-pill') {
    if (placement === 'sidebar') return null;

    return (
      <>
        <div 
          className={cn(
            "flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500/10 via-slate-800 to-indigo-950/60 px-3 py-1.5 border border-amber-400/30 text-white shadow-2xs transition-all hover:border-amber-400/60",
            className
          )}
        >
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 min-w-0 max-w-sm text-left cursor-pointer group"
            title={isHindi ? currentDisplay.textHi : currentDisplay.textEn}
          >
            <Sparkles size={12} className="text-amber-400 shrink-0 group-hover:rotate-12 transition-transform" />
            <span className="text-[10px] font-bold text-amber-300 shrink-0">
              {currentDisplay.isAi ? 'AI Wisdom:' : tText('Daily Thought:', 'सुविचार:')}
            </span>
            <span className="text-[11px] text-slate-200 italic truncate max-w-[220px]">
              "{isHindi ? currentDisplay.textHi : currentDisplay.textEn}"
            </span>
          </button>

          <div className="flex items-center gap-1 shrink-0 border-l border-slate-700/80 pl-1.5">
            <span className="text-[9px] font-mono text-emerald-400 px-1 py-0.5 rounded bg-emerald-950/50 border border-emerald-800/40">
              {isHindi ? currentDisplay.charCountHi : currentDisplay.charCountEn}c
            </span>
            <button
              type="button"
              disabled={isAiLoading}
              onClick={(e) => {
                e.stopPropagation();
                loadDailyWisdom(selectedAiTheme, true);
              }}
              title={tText('Generate New AI Affirmation', 'नया AI विचार बनाएं')}
              className="p-1 text-slate-300 hover:text-white rounded hover:bg-white/10 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={11} className={cn("transition-transform", (isAiLoading || animating) && "rotate-180")} />
            </button>
          </div>
        </div>

        {/* Modal */}
        <AnimatePresence>
          {isModalOpen && renderModal()}
        </AnimatePresence>
      </>
    );
  }

  // Collapsed compact pill mode in sidebar
  if (isCollapsed && variant === 'sidebar') {
    return (
      <>
        <div 
          className={cn(
            "group relative flex items-center justify-between gap-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 px-2.5 py-1.5 border border-slate-700/60 shadow-xs transition-all",
            className
          )}
        >
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
            title={tText('Click to read thought & tips', 'विचार व सुझाव देखने के लिए क्लिक करें')}
          >
            <Sparkles size={12} className={cn("text-amber-400 shrink-0", isAiLoading && "animate-spin")} />
            <span className="text-[10px] font-bold text-amber-300 shrink-0">
              {currentDisplay.isAi ? 'AI:' : tText('Quote:', 'सुविचार:')}
            </span>
            <span className="text-[10px] text-slate-300 italic truncate">
              "{isHindi ? currentDisplay.textHi : currentDisplay.textEn}"
            </span>
          </button>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              disabled={isAiLoading}
              onClick={(e) => {
                e.stopPropagation();
                loadDailyWisdom(selectedAiTheme, true);
              }}
              title={tText('Next AI Affirmation (≤ 150 chars)', 'नया AI विचार')}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700/60 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={10} className={cn("transition-transform", (isAiLoading || animating) && "rotate-180")} />
            </button>
            <button
              type="button"
              onClick={toggleCollapsed}
              title={tText('Expand Card', 'कार्ड बड़ा करें')}
              className="p-1 text-slate-400 hover:text-amber-300 rounded hover:bg-slate-700/60 cursor-pointer"
            >
              <ChevronDown size={12} />
            </button>
          </div>
        </div>

        {/* Modal */}
        <AnimatePresence>
          {isModalOpen && renderModal()}
        </AnimatePresence>
      </>
    );
  }

  return (
    <>
      {/* Sidebar Widget View (Expanded) */}
      <div 
        className={cn(
          "group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800/95 via-slate-800/90 to-indigo-950/40 p-3 shadow-inner border border-slate-700/60 transition-all hover:border-slate-600/80",
          className
        )}
      >
        {/* Ambient Top Glow */}
        <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-blue-500/10 blur-xl pointer-events-none" />

        {/* Header with Title, Date, and Actions */}
        <div className="relative z-10 flex items-center justify-between gap-1 pb-2 border-b border-slate-700/50">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-amber-400">
              <Sparkles size={11} className={isAiLoading ? "animate-spin" : "animate-pulse"} />
            </span>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block leading-tight flex items-center gap-1">
                <span>{tText('Mind Refreshment', 'दैनिक सुविचार')}</span>
                <span className="text-[8px] font-mono text-emerald-400 bg-emerald-950/60 px-1 py-0.2 rounded border border-emerald-800/40">
                  {isHindi ? currentDisplay.charCountHi : currentDisplay.charCountEn}/150c
                </span>
              </span>
              <span className="text-[9px] text-slate-400 font-medium block leading-tight">
                {currentDisplay.isAi ? `Gemini AI • ${dateLabel}` : `Thought #${currentCuratedQuote.id}/${DAILY_QUOTES.length}`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              disabled={isAiLoading}
              onClick={(e) => {
                e.stopPropagation();
                loadDailyWisdom(selectedAiTheme, true);
              }}
              title={tText('Generate New AI Affirmation (≤ 150 chars)', 'नया AI विचार उत्पन्न करें')}
              className="p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-slate-700/70 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={11} className={cn("transition-transform", (isAiLoading || animating) && "rotate-180")} />
            </button>

            <button
              type="button"
              onClick={(e) => {
                if (currentDisplay.isAi && aiWisdom) {
                  handleToggleAiFav(e, aiWisdom);
                } else {
                  handleToggleFav(e, currentCuratedQuote.id);
                }
              }}
              title={tText('Favorite', 'पसंदीदा')}
              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-700/70 transition-all cursor-pointer"
            >
              <Heart size={11} className={cn((currentDisplay.isAi ? isAiFavorite : isFavorite) && "fill-rose-500 text-rose-500")} />
            </button>

            <button
              type="button"
              onClick={() => setShowAdjustMenu(!showAdjustMenu)}
              title={tText('Adjust Display Settings', 'सेटिंग्स बदलें')}
              className={cn(
                "p-1 rounded transition-all cursor-pointer",
                showAdjustMenu ? "text-amber-400 bg-amber-500/20" : "text-slate-400 hover:text-white hover:bg-slate-700/70"
              )}
            >
              <Sliders size={11} />
            </button>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              title={tText('Expand All Reflections & Daily Tips', 'सभी विचार व सुझाव देखें')}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700/70 transition-all cursor-pointer"
            >
              <Maximize2 size={11} />
            </button>

            <button
              type="button"
              onClick={toggleCollapsed}
              title={tText('Minimize to Slim Pill', 'छोटा करें')}
              className="p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-slate-700/70 transition-all cursor-pointer"
            >
              <ChevronUp size={12} />
            </button>
          </div>
        </div>

        {/* Quick Adjust Popover Menu */}
        {showAdjustMenu && (
          <div className="relative z-20 my-2 rounded-xl bg-slate-900/95 p-2.5 border border-slate-700 shadow-xl space-y-2 text-[10px] text-slate-300 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between font-bold text-slate-200 pb-1 border-b border-slate-800">
              <span>{tText('Display Options', 'प्रदर्शन विकल्प')}</span>
              <button 
                type="button"
                onClick={() => setShowAdjustMenu(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={11} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span>{tText('Show Daily Tip', 'दैनिक सुझाव दिखाएं')}</span>
              <button
                type="button"
                onClick={() => toggleShowTip()}
                className={cn(
                  "px-2 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-colors",
                  showTip ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 border border-slate-700"
                )}
              >
                {showTip ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span>{tText('Placement', 'स्थान')}</span>
              <div className="flex items-center gap-1">
                {(['sidebar', 'header', 'both'] as const).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => handlePlacementChange(loc)}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] font-bold capitalize cursor-pointer transition-colors",
                      placement === loc ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 border border-slate-700"
                    )}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Quote Content Body with Fade Transition */}
        <div 
          onClick={() => setIsModalOpen(true)}
          className="relative z-10 pt-2 cursor-pointer group-hover:opacity-95 transition-opacity"
        >
          <QuoteIcon size={12} className="text-amber-400/60 mb-0.5" />
          
          <p className="text-xs font-medium italic text-slate-100 leading-relaxed tracking-normal">
            "{isHindi ? currentDisplay.textHi : currentDisplay.textEn}"
          </p>

          <div className="mt-1.5 flex items-center justify-between gap-1 text-[9px] text-slate-400">
            <span className="font-semibold text-slate-300 truncate max-w-[130px]">
              — {isHindi ? currentDisplay.authorHi : currentDisplay.authorEn}
            </span>

            <span className="rounded bg-slate-700/60 px-1 py-0.5 text-[8px] font-bold text-amber-300 border border-slate-600/50 shrink-0">
              {isHindi ? currentDisplay.categoryLabelHi : currentDisplay.categoryLabelEn}
            </span>
          </div>

          {/* Pharmacist Micro-Tip Bar */}
          {showTip && currentDisplay.tipEn && (
            <div className="mt-2 rounded-lg bg-slate-900/80 p-1.5 border border-slate-700/60 text-[9px] text-slate-300 flex items-start gap-1.5 shadow-xs">
              <Lightbulb size={11} className="text-amber-400 shrink-0 mt-0.5" />
              <span className="leading-snug">
                <strong className="text-amber-300 font-bold">{tText('Tip:', 'सुझाव:')} </strong>
                {isHindi ? currentDisplay.tipHi : currentDisplay.tipEn}
              </span>
            </div>
          )}
        </div>

        {/* Footer Quick Controls */}
        <div className="relative z-10 mt-2 flex items-center justify-between pt-1.5 border-t border-slate-700/40 text-[9px] text-slate-400">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevQuote}
              className="p-0.5 rounded text-slate-400 hover:text-white cursor-pointer"
              title="Previous"
            >
              <ChevronLeft size={11} />
            </button>
            <button
              type="button"
              onClick={() => {
                setDisplayMode(displayMode === 'ai' ? 'curated' : 'ai');
              }}
              className={cn(
                "px-1 py-0.2 rounded text-[8px] font-bold transition-colors cursor-pointer",
                displayMode === 'ai' ? "bg-blue-500/20 text-blue-300 border border-blue-400/30" : "bg-slate-700 text-slate-300"
              )}
            >
              {displayMode === 'ai' ? 'AI Mode' : 'Curated'}
            </button>
            <button
              type="button"
              onClick={handleNextQuote}
              className="p-0.5 rounded text-slate-400 hover:text-white cursor-pointer"
              title="Next"
            >
              <ChevronRight size={11} />
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyQuote}
            className="flex items-center gap-1 text-[9px] text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
          >
            {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
            <span>{copied ? tText('Copied!', 'कॉपी!') : tText('Share', 'साझा')}</span>
          </button>
        </div>
      </div>

      {/* EXPANDED MODAL */}
      <AnimatePresence>
        {isModalOpen && renderModal()}
      </AnimatePresence>
    </>
  );
};

export default MindRefreshmentWidget;
