import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Rocket, 
  Lightbulb, 
  ArrowRight, 
  TrendingUp, 
  CheckCircle2, 
  RefreshCw, 
  Check, 
  MessageSquare,
  IndianRupee,
  Star,
  Layers,
  ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  getInstalledRelease, 
  getMonthlyUpdateConfig, 
  toggleAdoptIdea, 
  checkAndApplyMonthlyUpdate,
  MonthlyRelease,
  MonthlyUpdateConfig
} from '../lib/monthlyUpdates';
import { cn } from '../lib/utils';

interface MonthlyIdeaDashboardWidgetProps {
  onOpenHub?: () => void;
}

export const MonthlyIdeaDashboardWidget: React.FC<MonthlyIdeaDashboardWidgetProps> = ({ onOpenHub }) => {
  const [release, setRelease] = useState<MonthlyRelease>(getInstalledRelease());
  const [config, setConfig] = useState<MonthlyUpdateConfig>(getMonthlyUpdateConfig());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    // Automatically check for monthly updates when widget mounts
    const checkResult = checkAndApplyMonthlyUpdate(false);
    setRelease(getInstalledRelease());
    setConfig(getMonthlyUpdateConfig());

    const handleUpdateApplied = () => {
      setRelease(getInstalledRelease());
      setConfig(getMonthlyUpdateConfig());
    };

    const handleSettingsUpdated = (e: any) => {
      if (e?.detail) setConfig(e.detail);
    };

    window.addEventListener('monthly-update-applied', handleUpdateApplied);
    window.addEventListener('monthly-settings-updated', handleSettingsUpdated);
    return () => {
      window.removeEventListener('monthly-update-applied', handleUpdateApplied);
      window.removeEventListener('monthly-settings-updated', handleSettingsUpdated);
    };
  }, []);

  const topIdea = release.businessIdeas[0];
  const isAdopted = topIdea && config.adoptedIdeaIds.includes(topIdea.id);

  const handleAdopt = () => {
    if (!topIdea) return;
    toggleAdoptIdea(topIdea.id);
    setConfig(getMonthlyUpdateConfig());
  };

  const handleCopyWhatsapp = (template: string, id: string) => {
    navigator.clipboard.writeText(template);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  if (!topIdea) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/40 p-5 shadow-sm">
      {/* Decorative accent */}
      <div className="absolute top-0 right-0 h-32 w-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left Side: Monthly Release & Strategic Highlight */}
        <div className="space-y-2 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-xs">
              <Sparkles size={12} className="text-amber-300 animate-pulse" />
              <span>{release.monthName} Innovation</span>
            </span>

            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-950/80 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800">
              <Rocket size={11} />
              <span>{release.version} OTA Active</span>
            </span>

            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1">
              <TrendingUp size={12} />
              <span>{topIdea.estimatedMarginBoost}</span>
            </span>
          </div>

          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Lightbulb size={16} className="text-amber-500 shrink-0" />
              <span>Monthly Business Strategy: {topIdea.title}</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-2 max-w-3xl leading-relaxed">
              {topIdea.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">High-Margin Essentials:</span>
            {topIdea.recommendedProducts.slice(0, 3).map((prod, idx) => (
              <span key={idx} className="rounded-md bg-white dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {prod}
              </span>
            ))}
          </div>
        </div>

        {/* Right Side: Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start lg:self-center">
          {topIdea.whatsappMarketingTemplate && (
            <button
              onClick={() => handleCopyWhatsapp(topIdea.whatsappMarketingTemplate!, topIdea.id)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
              title="Copy WhatsApp Promo"
            >
              {copiedId === topIdea.id ? (
                <>
                  <Check size={13} className="text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">Promo Copied!</span>
                </>
              ) : (
                <>
                  <MessageSquare size={13} className="text-emerald-600" />
                  <span>WhatsApp Promo</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={handleAdopt}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer",
              isAdopted
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-blue-600 text-white hover:bg-blue-700"
            )}
          >
            {isAdopted ? (
              <>
                <CheckCircle2 size={14} />
                <span>Strategy Adopted</span>
              </>
            ) : (
              <>
                <span>Adopt Strategy</span>
                <ArrowRight size={13} />
              </>
            )}
          </button>

          {onOpenHub && (
            <button
              onClick={onOpenHub}
              id="view-all-monthly-innovations-btn"
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition-all shadow-xs cursor-pointer"
            >
              <span>Explore All Ideas ({release.businessIdeas.length})</span>
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MonthlyIdeaDashboardWidget;
