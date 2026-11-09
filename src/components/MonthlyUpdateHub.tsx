import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Rocket, 
  Calendar, 
  CheckCircle2, 
  ArrowRight, 
  TrendingUp, 
  Package, 
  Zap, 
  Layers, 
  Bot, 
  Copy, 
  Check, 
  RefreshCw, 
  ShieldCheck, 
  Clock, 
  Sliders, 
  SlidersHorizontal,
  ChevronRight, 
  Share2, 
  MessageSquare, 
  IndianRupee, 
  AlertTriangle, 
  FileText, 
  Download, 
  Star,
  ExternalLink,
  Lightbulb,
  Bell,
  Cpu,
  ShoppingCart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from './AuthProvider';
import { cn, formatCurrency } from '../lib/utils';
import { 
  MonthlyRelease, 
  BusinessIdea, 
  SoftwareFeature, 
  getMonthlyUpdateConfig, 
  saveMonthlyUpdateConfig, 
  getInstalledRelease, 
  getAvailableReleases, 
  checkAndApplyMonthlyUpdate, 
  toggleAdoptIdea, 
  toggleFavoriteIdea,
  MonthlyUpdateConfig
} from '../lib/monthlyUpdates';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PredictedOrderList from './PredictedOrderList';

interface MonthlyUpdateHubProps {
  onNavigate?: (tab: string) => void;
  isModal?: boolean;
  onClose?: () => void;
  initialSubTab?: 'predicted_orders' | 'innovations' | 'ai_strategist' | 'seasonal_demand' | 'roadmap' | 'settings';
}

export const MonthlyUpdateHub: React.FC<MonthlyUpdateHubProps> = ({ 
  onNavigate, 
  isModal = false, 
  onClose,
  initialSubTab = 'predicted_orders'
}) => {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [config, setConfig] = useState<MonthlyUpdateConfig>(getMonthlyUpdateConfig());
  const [selectedRelease, setSelectedRelease] = useState<MonthlyRelease>(getInstalledRelease());
  const [activeSubTab, setActiveSubTab] = useState<'predicted_orders' | 'innovations' | 'ai_strategist' | 'seasonal_demand' | 'roadmap' | 'settings'>(initialSubTab);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateNotification, setUpdateNotification] = useState<string | null>(null);
  const [copiedIdeaId, setCopiedIdeaId] = useState<string | null>(null);

  // AI Strategist State
  const [aiFocusArea, setAiFocusArea] = useState('High Margin OTC & Seasonal Illness Bundling');
  const [aiTargetPatients, setAiTargetPatients] = useState('Family households, Chronic Patients, Walk-in Acute Cases');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiCustomStrategy, setAiCustomStrategy] = useState<string | null>(null);
  const [strategyMonth, setStrategyMonth] = useState('August 2026');

  // ROI Calculator state
  const [calculatedBasketSize, setCalculatedBasketSize] = useState<number>(350);
  const [calculatedDailyWalkins, setCalculatedDailyWalkins] = useState<number>(45);

  const availableReleases = getAvailableReleases();
  const installedRelease = getInstalledRelease();

  useEffect(() => {
    const handleSettingsUpdate = (e: any) => {
      if (e?.detail) {
        setConfig(e.detail);
      } else {
        setConfig(getMonthlyUpdateConfig());
      }
    };
    window.addEventListener('monthly-settings-updated', handleSettingsUpdate);
    return () => window.removeEventListener('monthly-settings-updated', handleSettingsUpdate);
  }, []);

  const handleManualCheckUpdate = () => {
    setIsCheckingUpdate(true);
    setUpdateNotification(null);

    setTimeout(() => {
      const result = checkAndApplyMonthlyUpdate(false);
      setIsCheckingUpdate(false);
      setConfig(getMonthlyUpdateConfig());
      setUpdateNotification(result.message);
      if (result.newRelease) {
        setSelectedRelease(result.newRelease);
      }
    }, 1200);
  };

  const handleAdoptToggle = (ideaId: string) => {
    toggleAdoptIdea(ideaId);
    setConfig(getMonthlyUpdateConfig());
  };

  const handleFavoriteToggle = (ideaId: string) => {
    toggleFavoriteIdea(ideaId);
    setConfig(getMonthlyUpdateConfig());
  };

  const handleCopyTemplate = (template: string, ideaId: string) => {
    navigator.clipboard.writeText(template);
    setCopiedIdeaId(ideaId);
    setTimeout(() => setCopiedIdeaId(null), 2500);
  };

  const handleGenerateAIStrategy = async () => {
    setAiLoading(true);
    try {
      const response = await fetch('/api/ai/monthly-innovations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: strategyMonth,
          focusArea: aiFocusArea,
          targetPatients: aiTargetPatients
        })
      });
      const data = await response.json();
      setAiCustomStrategy(data.result);
    } catch (e) {
      console.error('Failed to generate AI custom strategy:', e);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveSettings = (newConfig: Partial<MonthlyUpdateConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    saveMonthlyUpdateConfig(updated);
  };

  // Calculate estimated monthly boost
  const monthlyRevenueBoost = Math.round(calculatedDailyWalkins * (calculatedBasketSize * 0.35) * 26);
  const monthlyProfitBoost = Math.round(monthlyRevenueBoost * 0.38);

  const containerContent = (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 p-6 sm:p-8 text-white shadow-xl border border-blue-900/40">
        {/* Glow ambient effects */}
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 border border-blue-400/40 px-3 py-1 text-xs font-bold text-blue-200">
                <Sparkles size={14} className="text-amber-300 animate-spin" style={{ animationDuration: '4s' }} />
                <span>Monthly Auto-Update Engine</span>
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-3 py-1 text-xs font-bold text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Version {config.installedVersion} Active</span>
              </span>

              {config.autoUpdateEnabled && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                  <Clock size={12} className="text-blue-300" />
                  Auto-Updates on 1st of Month
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Monthly Innovations & Business Growth Hub
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Every month, Satyam ERP automatically updates your pharmacy with new software workflows, high-margin seasonal business ideas, and clinical operational tools.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleManualCheckUpdate}
              disabled={isCheckingUpdate}
              id="check-monthly-updates-btn"
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-900/40 transition-all hover:bg-blue-500 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={15} className={cn(isCheckingUpdate && "animate-spin")} />
              <span>{isCheckingUpdate ? "Scanning OTA Channel..." : "Check for Updates"}</span>
            </button>

            {isModal && onClose && (
              <button
                onClick={onClose}
                className="rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20 transition-all cursor-pointer"
              >
                Close Hub
              </button>
            )}
          </div>
        </div>

        {/* Update Notification Banner */}
        {updateNotification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-xl bg-blue-500/20 border border-blue-400/30 p-3.5 text-xs text-blue-100 flex items-start gap-3"
          >
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-white">Update Status Alert</p>
              <p className="text-[11px] text-blue-200 mt-0.5">{updateNotification}</p>
            </div>
            <button
              onClick={() => setUpdateNotification(null)}
              className="text-xs font-bold text-blue-300 hover:text-white"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex overflow-x-auto gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 scrollbar-none">
        <button
          onClick={() => setActiveSubTab('predicted_orders')}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all shrink-0 cursor-pointer",
            activeSubTab === 'predicted_orders'
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
          )}
        >
          <ShoppingCart size={15} />
          <span>Predicted 30-Day Orders</span>
          <span className="rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider">
            Customer Demand
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('innovations')}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all shrink-0 cursor-pointer",
            activeSubTab === 'innovations'
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
          )}
        >
          <Lightbulb size={15} />
          <span>{selectedRelease.monthName} Innovations & Ideas</span>
          <span className="rounded-full bg-white/20 px-2 py-0.2 text-[10px] font-black">
            {selectedRelease.businessIdeas.length + selectedRelease.softwareFeatures.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('ai_strategist')}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all shrink-0 cursor-pointer",
            activeSubTab === 'ai_strategist'
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
          )}
        >
          <Bot size={15} className="text-amber-500" />
          <span>AI Monthly Strategist</span>
          <span className="rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 px-1.5 py-0.2 text-[9px] font-bold">
            Gemini
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('seasonal_demand')}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all shrink-0 cursor-pointer",
            activeSubTab === 'seasonal_demand'
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
          )}
        >
          <TrendingUp size={15} />
          <span>Seasonal Demand Matrix</span>
        </button>

        <button
          onClick={() => setActiveSubTab('roadmap')}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all shrink-0 cursor-pointer",
            activeSubTab === 'roadmap'
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
          )}
        >
          <Calendar size={15} />
          <span>Monthly Release Timeline</span>
        </button>

        <button
          onClick={() => setActiveSubTab('settings')}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all shrink-0 cursor-pointer",
            activeSubTab === 'settings'
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
          )}
        >
          <SlidersHorizontal size={15} />
          <span>Update Settings</span>
        </button>
      </div>

      {/* SUB-TAB 0: PREDICTED ORDER LIST (30-DAY RECURRING CUSTOMER DEMAND) */}
      {activeSubTab === 'predicted_orders' && (
        <PredictedOrderList onNavigateTab={onNavigate} />
      )}

      {/* SUB-TAB 1: CURRENT MONTH INNOVATIONS & BUSINESS IDEAS */}
      {activeSubTab === 'innovations' && (
        <div className="space-y-6">
          {/* Release Quick Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-3 w-3 rounded-full bg-blue-600" />
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {selectedRelease.monthName} Edition ({selectedRelease.version})
                </h2>
                <span className="rounded-full bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {selectedRelease.releaseName}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {selectedRelease.summary}
              </p>
            </div>

            {/* Quick Switch Month selector */}
            <div className="flex items-center gap-2 shrink-0">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Browse Release:</label>
              <select
                value={selectedRelease.version}
                onChange={(e) => {
                  const target = availableReleases.find(r => r.version === e.target.value);
                  if (target) setSelectedRelease(target);
                }}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold dark:border-slate-800 dark:bg-slate-800 dark:text-white"
              >
                {availableReleases.map(r => (
                  <option key={r.version} value={r.version}>
                    {r.monthName} ({r.version}) {r.version === config.installedVersion ? '★ Active' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section: Business Ideas of the Month */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Lightbulb size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-slate-100">
                    High-Margin Pharmacy Business Ideas of the Month
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Actionable strategies to boost retail margins, patient retention, and average basket size
                  </p>
                </div>
              </div>
              
              <span className="text-xs font-bold text-slate-500">
                {config.adoptedIdeaIds.length} Strategies Adopted
              </span>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {selectedRelease.businessIdeas.map((idea) => {
                const isAdopted = config.adoptedIdeaIds.includes(idea.id);
                const isFavorite = config.favoriteIdeaIds.includes(idea.id);

                return (
                  <motion.div
                    key={idea.id}
                    layout
                    className={cn(
                      "group flex flex-col justify-between rounded-2xl border p-5 transition-all shadow-sm",
                      isAdopted 
                        ? "border-emerald-300 bg-emerald-50/40 dark:border-emerald-800/80 dark:bg-emerald-950/20" 
                        : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 hover:border-blue-300 dark:hover:border-slate-700"
                    )}
                  >
                    <div className="space-y-3">
                      {/* Idea Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <span className={cn(
                            "inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider",
                            idea.category === 'seasonal_campaign' ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300" :
                            idea.category === 'margin_expansion' ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300" :
                            "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300"
                          )}>
                            {idea.category.replace('_', ' ')}
                          </span>
                          <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 leading-snug">
                            {idea.title}
                          </h4>
                        </div>

                        <button
                          onClick={() => handleFavoriteToggle(idea.id)}
                          className={cn(
                            "rounded-lg p-1.5 transition-colors cursor-pointer",
                            isFavorite ? "text-amber-500" : "text-slate-300 hover:text-slate-500"
                          )}
                          title="Save to favorites"
                        >
                          <Star size={16} fill={isFavorite ? "currentColor" : "none"} />
                        </button>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {idea.description}
                      </p>

                      {/* Metrics Delta */}
                      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2.5 text-xs">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Margin Impact</p>
                          <p className="font-extrabold text-emerald-600 dark:text-emerald-400">{idea.estimatedMarginBoost}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Monthly Revenue</p>
                          <p className="font-extrabold text-blue-600 dark:text-blue-400">{idea.estimatedMonthlyRevenue}</p>
                        </div>
                      </div>

                      {/* Action Steps */}
                      <div className="space-y-1.5 pt-1">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Rapid Execution Steps:
                        </p>
                        <ul className="space-y-1">
                          {idea.actionSteps.slice(0, 3).map((step, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/60 text-[10px] font-bold text-blue-700 dark:text-blue-300 mt-0.5">
                                {idx + 1}
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Recommended Products */}
                      <div className="pt-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Key Stock Items:
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {idea.recommendedProducts.slice(0, 3).map((prod, idx) => (
                            <span key={idx} className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                              {prod}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Idea Card Footer */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      {idea.whatsappMarketingTemplate ? (
                        <button
                          onClick={() => handleCopyTemplate(idea.whatsappMarketingTemplate!, idea.id)}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Copy ready-to-send WhatsApp patient promotion message"
                        >
                          {copiedIdeaId === idea.id ? (
                            <>
                              <Check size={13} className="text-emerald-500" />
                              <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                            </>
                          ) : (
                            <>
                              <MessageSquare size={13} className="text-emerald-600" />
                              <span>WhatsApp Copy</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400">{idea.implementationEffort}</span>
                      )}

                      <button
                        onClick={() => handleAdoptToggle(idea.id)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95",
                          isAdopted
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        )}
                      >
                        {isAdopted ? (
                          <>
                            <CheckCircle2 size={14} />
                            <span>Adopted</span>
                          </>
                        ) : (
                          <>
                            <span>Adopt Strategy</span>
                            <ArrowRight size={13} />
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Section: Software Features Delivered in this Release */}
          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Rocket size={18} />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-slate-100">
                  New Software Features & Workflows in {selectedRelease.version}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Automated monthly ERP software enhancements and operational modules
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {selectedRelease.softwareFeatures.map((feat) => (
                <div
                  key={feat.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 space-y-2.5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider border border-blue-200/60 dark:border-blue-900">
                      {feat.category.toUpperCase()}
                    </span>
                    {feat.badge && (
                      <span className="rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[10px] font-bold border border-amber-200 dark:border-amber-900">
                        {feat.badge}
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {feat.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {feat.description}
                  </p>

                  <ul className="space-y-1 pt-1">
                    {feat.highlights.map((h, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: AI MONTHLY STRATEGIST & CUSTOM IDEA GENERATOR */}
      {activeSubTab === 'ai_strategist' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                    AI Monthly Business Strategist (Gemini Intelligence)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Generate customized, season-specific business expansion plans, medicine bundling formulas, and WhatsApp promotions.
                  </p>
                </div>
              </div>

              <button
                onClick={handleGenerateAIStrategy}
                disabled={aiLoading}
                id="generate-ai-monthly-strategy-btn"
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 cursor-pointer active:scale-95"
              >
                <Sparkles size={15} className={cn(aiLoading && "animate-spin")} />
                <span>{aiLoading ? "Consulting AI Strategist..." : "Generate Custom Monthly Strategy"}</span>
              </button>
            </div>

            {/* Custom Input Controls */}
            <div className="grid gap-4 sm:grid-cols-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Target Month & Season:
                </label>
                <select
                  value={strategyMonth}
                  onChange={(e) => setStrategyMonth(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold dark:border-slate-800 dark:bg-slate-800 dark:text-white"
                >
                  <option value="August 2026">August 2026 (Monsoon Peak)</option>
                  <option value="September 2026">September 2026 (Post-Monsoon Dengue)</option>
                  <option value="October 2026">October 2026 (Festive Diabetic Care)</option>
                  <option value="November 2026">November 2026 (Winter Respiratory)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Strategic Focus Area:
                </label>
                <select
                  value={aiFocusArea}
                  onChange={(e) => setAiFocusArea(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold dark:border-slate-800 dark:bg-slate-800 dark:text-white"
                >
                  <option value="High Margin OTC & Seasonal Illness Bundling">High Margin OTC & Seasonal Illness Bundling</option>
                  <option value="Chronic Patient WhatsApp Refill & Loyalty Club">Chronic Patient WhatsApp Refill & Loyalty Club</option>
                  <option value="Branded vs Generic Salt Substitution Profits">Branded vs Generic Salt Substitution Profits</option>
                  <option value="Local Doctor & Polyclinic Referral Partnerships">Local Doctor & Polyclinic Referral Partnerships</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Primary Patient Demographics:
                </label>
                <input
                  type="text"
                  value={aiTargetPatients}
                  onChange={(e) => setAiTargetPatients(e.target.value)}
                  placeholder="e.g. Elderly chronic patients, families..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold dark:border-slate-800 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            {/* AI Generated Result Display */}
            {aiLoading ? (
              <div className="flex flex-col items-center justify-center p-12 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-3">
                <RefreshCw size={32} className="animate-spin text-blue-600 dark:text-blue-400" />
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  AI Strategist is analyzing seasonal demand, product margins, and marketing plans for {strategyMonth}...
                </p>
                <p className="text-xs text-slate-500">Formulating executable retail playbook and bundle formulas.</p>
              </div>
            ) : aiCustomStrategy ? (
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-6 border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-amber-500" />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      AI Strategic Blueprint for {strategyMonth}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(aiCustomStrategy);
                      alert('Strategic plan copied to clipboard!');
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <Copy size={13} />
                    <span>Copy Full Plan</span>
                  </button>
                </div>

                <div className="prose dark:prose-invert max-w-none text-xs sm:text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {aiCustomStrategy}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <Lightbulb size={28} className="mx-auto text-amber-500" />
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Ready to Generate Custom Strategy for {strategyMonth}
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Click the button above to receive customized product recommendations, margin calculations, and WhatsApp promotion copy tailored to your pharmacy.
                </p>
              </div>
            )}
          </div>

          {/* Interactive ROI & Revenue Impact Simulator */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <IndianRupee size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  Monthly Business Idea ROI Simulator
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Estimate additional monthly revenue and gross profit from adopting monthly bundling & refill strategies
                </p>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Average Daily Walk-ins: <span className="text-blue-600">{calculatedDailyWalkins} Customers</span>
                </label>
                <input
                  type="range"
                  min="15"
                  max="150"
                  value={calculatedDailyWalkins}
                  onChange={(e) => setCalculatedDailyWalkins(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Average Prescription Value: <span className="text-blue-600">₹{calculatedBasketSize}</span>
                </label>
                <input
                  type="range"
                  min="100"
                  max="1500"
                  step="50"
                  value={calculatedBasketSize}
                  onChange={(e) => setCalculatedBasketSize(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 p-3.5 border border-blue-200 dark:border-blue-900">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                  Est. Additional Monthly Sales
                </p>
                <p className="text-xl font-black text-blue-900 dark:text-blue-100 mt-0.5">
                  ₹{monthlyRevenueBoost.toLocaleString('en-IN')}
                </p>
                <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">+35% Basket Upsell</p>
              </div>

              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-3.5 border border-emerald-200 dark:border-emerald-900">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Est. Net Profit Margin Boost
                </p>
                <p className="text-xl font-black text-emerald-900 dark:text-emerald-100 mt-0.5">
                  ₹{monthlyProfitBoost.toLocaleString('en-IN')}
                </p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">~38% Gross Margin Realized</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: SEASONAL DEMAND MATRIX */}
      {activeSubTab === 'seasonal_demand' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Seasonal High-Surge Medication Demand Matrix ({selectedRelease.monthName})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Top medicine categories requiring pre-emptive wholesale procurement, buffer stock, and FEFO expiry rotation.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {selectedRelease.seasonalDemand.map((item, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {item.category}
                  </h4>
                  <span className="rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 px-2 py-0.5 text-[10px] font-extrabold border border-rose-200 dark:border-rose-900">
                    Surge
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">High-Velocity Medicines:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.medicines.map((m, i) => (
                      <span key={i} className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-1 pt-1 text-xs">
                  <p className="text-slate-600 dark:text-slate-300">
                    <strong>Surge Trigger:</strong> {item.surgeReason}
                  </p>
                  <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                    <strong>Wholesale Advice:</strong> {item.marginAdvice}
                  </p>
                  <p className="text-blue-700 dark:text-blue-300 font-bold">
                    <strong>Buffer:</strong> {item.stockingRecommendation}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: RELEASE ROADMAP & TIMELINE */}
      {activeSubTab === 'roadmap' && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Monthly Release Schedule & Continuous Evolution Roadmap
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Satyam ERP delivers automated monthly software updates on the 1st of every month. Browse past archives and upcoming releases.
            </p>
          </div>

          <div className="relative border-l-2 border-blue-500/40 ml-4 pl-6 space-y-8">
            {availableReleases.map((release) => {
              const isCurrent = release.version === config.installedVersion;

              return (
                <div key={release.version} className="relative space-y-3">
                  {/* Timeline Node */}
                  <div className={cn(
                    "absolute -left-[33px] top-0 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-white dark:bg-slate-900",
                    isCurrent ? "border-emerald-500 text-emerald-500 shadow-md ring-4 ring-emerald-500/20" : "border-blue-500 text-blue-500"
                  )}>
                    {isCurrent ? <Check size={12} strokeWidth={3} /> : <div className="h-2 w-2 rounded-full bg-blue-500" />}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-sm space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900 dark:text-slate-100">
                          {release.monthName} ({release.version})
                        </span>
                        <span className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider",
                          isCurrent ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                          release.status === 'upcoming' ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300" :
                          "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        )}>
                          {isCurrent ? "Installed & Active" : release.status.toUpperCase()}
                        </span>
                      </div>

                      <span className="text-xs text-slate-400">Release Date: {release.releaseDate}</span>
                    </div>

                    <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400">
                      {release.releaseName}
                    </h4>

                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {release.summary}
                    </p>

                    <div className="grid gap-2 sm:grid-cols-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Features Included ({release.softwareFeatures.length}):</p>
                        <ul className="mt-1 space-y-1">
                          {release.softwareFeatures.map(f => (
                            <li key={f.id} className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                              <span>{f.title}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Business Strategies ({release.businessIdeas.length}):</p>
                        <ul className="mt-1 space-y-1">
                          {release.businessIdeas.map(b => (
                            <li key={b.id} className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                              <span>{b.title}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 5: AUTO-UPDATE AUTOMATION SETTINGS */}
      {activeSubTab === 'settings' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30">
                  <SlidersHorizontal size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                    Automated Monthly Software Update Preferences
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Configure automated OTA software updates, release channels, and notification alerts
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {config.autoUpdateEnabled ? "Auto-Updates ON" : "Auto-Updates OFF"}
                </span>
                <button
                  type="button"
                  onClick={() => handleSaveSettings({ autoUpdateEnabled: !config.autoUpdateEnabled })}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden",
                    config.autoUpdateEnabled ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                      config.autoUpdateEnabled ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              {/* Channel Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Release Channel:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveSettings({ updateChannel: 'stable' })}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-all cursor-pointer",
                      config.updateChannel === 'stable'
                        ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 font-bold"
                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    )}
                  >
                    <p className="text-xs font-bold">Stable Enterprise</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Tested monthly release</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveSettings({ updateChannel: 'innovation' })}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-all cursor-pointer",
                      config.updateChannel === 'innovation'
                        ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 font-bold"
                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    )}
                  >
                    <p className="text-xs font-bold">Innovation Preview</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Early access to new tools</p>
                  </button>
                </div>
              </div>

              {/* Schedule Day */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Automated Monthly Apply Day:
                </label>
                <select
                  value={config.autoApplyDay}
                  onChange={(e) => handleSaveSettings({ autoApplyDay: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold dark:border-slate-800 dark:bg-slate-800 dark:text-white"
                >
                  <option value={1}>1st of Every Month (Recommended)</option>
                  <option value={5}>5th of Every Month</option>
                  <option value={10}>10th of Every Month</option>
                </select>
                <p className="text-[11px] text-slate-500">
                  Updates apply in the background with zero terminal downtime.
                </p>
              </div>
            </div>

            {/* Notification Toggle */}
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Notify Staff on Monthly Feature Release
                </p>
                <p className="text-[11px] text-slate-500">
                  Display an in-app banner highlighting new tools and business ideas when a new month begins.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleSaveSettings({ notifyOnNewRelease: !config.notifyOnNewRelease })}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden",
                  config.notifyOnNewRelease ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                    config.notifyOnNewRelease ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
        <div className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl bg-slate-50 dark:bg-slate-950 p-6 border border-slate-200 dark:border-slate-800 shadow-2xl">
          {containerContent}
        </div>
      </div>
    );
  }

  return containerContent;
};

export default MonthlyUpdateHub;
