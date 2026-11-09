import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Languages, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface LanguageToggleProps {
  variant?: 'pill' | 'button' | 'dropdown' | 'card' | 'compact';
  className?: string;
  showLabel?: boolean;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({
  variant = 'pill',
  className = '',
  showLabel = true,
}) => {
  const { language, setLanguage, toggleLanguage, isHindi, t } = useLanguage();

  if (variant === 'pill') {
    return (
      <div
        className={cn(
          "inline-flex items-center rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs",
          className
        )}
        role="group"
        aria-label="Language Selector"
      >
        <button
          type="button"
          onClick={() => setLanguage('en')}
          className={cn(
            "relative flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-black transition-all cursor-pointer select-none",
            !isHindi
              ? "bg-white text-blue-600 shadow-sm dark:bg-blue-600 dark:text-white"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          )}
          title="Switch to English"
        >
          <span className="text-xs">🇬🇧</span>
          <span>EN</span>
        </button>

        <button
          type="button"
          onClick={() => setLanguage('hi')}
          className={cn(
            "relative flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-black transition-all cursor-pointer select-none",
            isHindi
              ? "bg-white text-orange-600 shadow-sm dark:bg-orange-600 dark:text-white"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          )}
          title="हिन्दी में बदलें (Switch to Hindi)"
        >
          <span className="text-xs">🇮🇳</span>
          <span>हिन्दी</span>
        </button>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={toggleLanguage}
        className={cn(
          "flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-black transition-all cursor-pointer select-none active:scale-95 shadow-2xs",
          isHindi
            ? "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800/80 dark:bg-orange-950/60 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/60"
            : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/80 dark:bg-blue-950/60 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60",
          className
        )}
        title={isHindi ? "Switch to English" : "हिन्दी में बदलें"}
      >
        <Languages size={14} className={isHindi ? "text-orange-600 dark:text-orange-400" : "text-blue-600 dark:text-blue-400"} />
        <span className="font-extrabold">{isHindi ? "🇮🇳 हिन्दी" : "🇬🇧 English"}</span>
      </button>
    );
  }

  if (variant === 'card') {
    return (
      <div className={cn("rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900", className)}>
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400">
              <Globe size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t('language')}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isHindi ? "पूरी प्रणाली को अंग्रेजी या हिन्दी में देखें" : "Translate the entire ERP system into Hindi or English"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <span>{isHindi ? "🇮🇳 हिन्दी सक्रिय" : "🇬🇧 English Active"}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={cn(
              "flex items-center justify-between rounded-xl border p-3.5 text-left transition-all cursor-pointer",
              !isHindi
                ? "border-blue-500 bg-blue-50/70 dark:border-blue-500 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100 ring-2 ring-blue-500/20"
                : "border-slate-200 hover:border-slate-300 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300"
            )}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🇬🇧</span>
              <div>
                <p className="text-xs font-black">English</p>
                <p className="text-[10px] text-slate-500">Standard English UI</p>
              </div>
            </div>
            {!isHindi && <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />}
          </button>

          <button
            type="button"
            onClick={() => setLanguage('hi')}
            className={cn(
              "flex items-center justify-between rounded-xl border p-3.5 text-left transition-all cursor-pointer",
              isHindi
                ? "border-orange-500 bg-orange-50/70 dark:border-orange-500 dark:bg-orange-950/40 text-orange-950 dark:text-orange-100 ring-2 ring-orange-500/20"
                : "border-slate-200 hover:border-slate-300 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300"
            )}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🇮🇳</span>
              <div>
                <p className="text-xs font-black">हिन्दी (Hindi)</p>
                <p className="text-[10px] text-slate-500">सम्पूर्ण हिन्दी अनुवाद</p>
              </div>
            </div>
            {isHindi && <div className="h-2 w-2 rounded-full bg-orange-600 animate-pulse" />}
          </button>
        </div>
      </div>
    );
  }

  // Default interactive toggle button
  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={cn(
        "group relative flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95",
        isHindi
          ? "border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 text-orange-800 dark:border-orange-800 dark:from-orange-950/70 dark:to-amber-950/50 dark:text-orange-200"
          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750",
        className
      )}
      title={isHindi ? "Switch to English UI" : "सम्पूर्ण प्रणाली हिन्दी में बदलें"}
    >
      <Languages size={15} className={cn("transition-transform group-hover:rotate-12", isHindi ? "text-orange-600 dark:text-orange-400" : "text-blue-600 dark:text-blue-400")} />
      {showLabel && (
        <span className="font-black tracking-tight">
          {isHindi ? "🇮🇳 हिन्दी" : "🇬🇧 English"}
        </span>
      )}
    </button>
  );
};

export default LanguageToggle;
