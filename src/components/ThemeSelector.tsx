import React, { useState, useRef, useEffect } from 'react';
import { 
  Sun, 
  Moon, 
  Sparkles, 
  Clock, 
  Check, 
  Eye, 
  Shield, 
  Zap, 
  Palette, 
  Sliders, 
  MoonStar, 
  Activity, 
  Package, 
  Layers,
  Wand2,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  useTheme, 
  ThemeMode, 
  AestheticThemeId, 
  AESTHETIC_THEMES, 
  checkIsNightShiftTime 
} from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../lib/utils';

interface ThemeSelectorProps {
  variant?: 'card' | 'compact' | 'header-popover';
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ variant = 'card' }) => {
  const { 
    theme, 
    setTheme, 
    toggleTheme,
    aestheticTheme, 
    setAestheticTheme, 
    ambientGlow,
    setAmbientGlow,
    oledPureBlack, 
    setOledPureBlack, 
    autoMidnightEnabled, 
    setAutoMidnightEnabled,
    highContrastText, 
    setHighContrastText,
    isNightShiftActive,
    currentAestheticConfig
  } = useTheme();

  const { language, tText } = useLanguage();
  const isHindi = language === 'hi';

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsPopoverOpen(false);
      }
    };
    if (isPopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPopoverOpen]);

  const baseThemeModes: Array<{
    id: ThemeMode;
    label: string;
    hindiLabel: string;
    description: string;
    hindiDescription: string;
    icon: typeof Sun;
    badge: string;
    badgeHindi: string;
  }> = [
    {
      id: 'light',
      label: 'Daylight Mode',
      hindiLabel: 'डे-लाइट (दिन का मोड)',
      description: 'Luminous, crisp medical white canvas with high ambient readability.',
      hindiDescription: 'दिन के उजले समय के लिए स्पष्ट और स्वच्छ लाइट थीम।',
      icon: Sun,
      badge: 'Daytime',
      badgeHindi: 'दिन'
    },
    {
      id: 'dark',
      label: 'Classic Slate',
      hindiLabel: 'क्लासिक डार्क',
      description: 'Sophisticated deep slate with balanced contrast for all-day focus.',
      hindiDescription: 'संतुलित डार्क स्लेट बैकग्राउंड।',
      icon: Moon,
      badge: 'Balanced',
      badgeHindi: 'डार्क'
    },
    {
      id: 'midnight',
      label: 'Midnight OLED',
      hindiLabel: 'मिडनाइट हाई-कंट्रास्ट',
      description: 'Ultra-deep nocturnal void canvas with low-glare high-vis glowing accents.',
      hindiDescription: 'रात्रि ड्यूटी फार्मासिस्टों हेतु विशेष रूप से अनुकूलित आंखों को राहत देने वाली थीम।',
      icon: Sparkles,
      badge: 'Night Shift',
      badgeHindi: 'नाइट शिफ्ट'
    }
  ];

  // Header quick palette switcher popover
  if (variant === 'header-popover') {
    return (
      <div className="relative" ref={popoverRef}>
        <button
          type="button"
          onClick={() => setIsPopoverOpen(!isPopoverOpen)}
          className={cn(
            "flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 transition-all cursor-pointer shadow-2xs border",
            theme === 'midnight' 
              ? "bg-slate-900/90 border-slate-700/80 text-white hover:border-slate-600" 
              : theme === 'dark' 
                ? "bg-slate-800/90 border-slate-700 text-white hover:bg-slate-750" 
                : "bg-white/90 border-slate-200 text-slate-800 hover:bg-slate-50"
          )}
          title={tText('Quick Aesthetic Theme Switcher', 'थीम व कलर पैलेट बदलें')}
        >
          <span 
            className="h-3 w-3 rounded-full shadow-xs transition-transform group-hover:scale-110"
            style={{ 
              backgroundColor: currentAestheticConfig.primaryColor,
              boxShadow: `0 0 6px ${currentAestheticConfig.glowColor}`
            }}
          />
          <span className="hidden sm:inline text-[11px] font-bold">
            {isHindi ? currentAestheticConfig.hindiName.split(' ')[0] : currentAestheticConfig.name.split(' ')[0]}
          </span>
          <ChevronDown size={12} className={cn("text-slate-400 transition-transform duration-200", isPopoverOpen && "rotate-180")} />
        </button>

        <AnimatePresence>
          {isPopoverOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-2xl z-50 space-y-3"
            >
              {/* Header inside popover */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-1.5">
                  <Palette size={14} className="text-slate-400" style={{ color: currentAestheticConfig.primaryColor }} />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    {tText('Aesthetic Palettes', 'थीम व रंग')}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {baseThemeModes.map((mode) => {
                    const Icon = mode.icon;
                    const isSelected = theme === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setTheme(mode.id)}
                        className={cn(
                          "p-1.5 rounded-lg text-xs transition-all cursor-pointer",
                          isSelected 
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs" 
                            : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        )}
                        title={isHindi ? mode.hindiLabel : mode.label}
                      >
                        <Icon size={13} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 6 Curated Palettes Grid */}
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(AESTHETIC_THEMES) as AestheticThemeId[]).map((themeKey) => {
                  const palette = AESTHETIC_THEMES[themeKey];
                  const isCurrent = aestheticTheme === themeKey;

                  return (
                    <button
                      key={themeKey}
                      type="button"
                      onClick={() => {
                        setAestheticTheme(themeKey);
                      }}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-xl border text-left transition-all cursor-pointer text-xs",
                        isCurrent
                          ? "border-slate-400 dark:border-slate-500 bg-slate-50 dark:bg-slate-800/80 font-bold shadow-2xs"
                          : "border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-transparent text-slate-600 dark:text-slate-400"
                      )}
                    >
                      <span 
                        className="h-3.5 w-3.5 rounded-full shrink-0 shadow-2xs"
                        style={{ 
                          backgroundColor: palette.primaryColor,
                          boxShadow: isCurrent ? `0 0 8px ${palette.glowColor}` : 'none'
                        }}
                      />
                      <span className="truncate text-[11px]">
                        {isHindi ? palette.hindiName.split(' ')[0] : palette.name.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Quick Ambient Glow toggle inside popover */}
              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2 text-[10px]">
                <span className="text-slate-500 dark:text-slate-400 font-medium">
                  {tText('Ambient Background Depth', 'एंबिएंट बैकड्रॉप ग्लो')}
                </span>
                <button
                  type="button"
                  onClick={() => setAmbientGlow(!ambientGlow)}
                  className={cn(
                    "px-2 py-0.5 rounded-md font-bold transition-all text-[9px] uppercase cursor-pointer",
                    ambientGlow 
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" 
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  )}
                >
                  {ambientGlow ? 'ON' : 'OFF'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-800/80 p-1">
        {baseThemeModes.map((opt) => {
          const Icon = opt.icon;
          const isSelected = theme === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTheme(opt.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer",
                isSelected 
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs" 
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
              title={isHindi ? opt.hindiLabel : opt.label}
            >
              <Icon size={14} className={cn(opt.id === 'midnight' && "text-emerald-400")} />
              <span className="text-[10px] font-bold">{isHindi ? opt.badgeHindi : opt.badge}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Full Settings Card variant
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div 
            className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md transition-all duration-300"
            style={{ 
              backgroundColor: currentAestheticConfig.primaryColor,
              boxShadow: `0 4px 14px ${currentAestheticConfig.glowColor}`
            }}
          >
            <Palette size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-tight text-slate-900 dark:text-slate-100">
                {tText('Aesthetic Medical Themes & Shift Ergonomics', 'आधुनिक मेडिकल थीम्स व विजुअल सेटिंग्स')}
              </h2>
              {isNightShiftActive && (
                <span className="flex items-center gap-1 rounded-full bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 text-[9px] font-black uppercase text-indigo-700 dark:text-indigo-300 animate-pulse">
                  <Clock size={10} />
                  {tText('Night Shift Window (8 PM – 7 AM)', 'रात्रि शिफ्ट (8 PM – 7 AM)')}
                </span>
              )}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {tText('Personalized aesthetic palettes, contrast boosts & ambient atmosphere', 'कस्टम क्लीनिकल कलर पैलेट्स, कंट्रास्ट बूस्ट व आंखों की सुरक्षा')}
            </p>
          </div>
        </div>
      </div>

      {/* 3 Base Theme Modes */}
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
          {tText('1. Base Lighting Environment', '1. बेस लाइटिंग मोड')}
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          {baseThemeModes.map((opt) => {
            const Icon = opt.icon;
            const isSelected = theme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTheme(opt.id)}
                className={cn(
                  "relative flex flex-col justify-between rounded-xl border p-4 text-left transition-all active:scale-[0.98] cursor-pointer",
                  isSelected
                    ? "border-slate-800 dark:border-white/40 bg-slate-50 dark:bg-slate-800/60 shadow-md ring-2 ring-slate-400/30"
                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700"
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                    <Icon size={16} />
                  </div>
                  {isSelected && (
                    <div 
                      className="flex h-5 w-5 items-center justify-center rounded-full text-white shadow-xs"
                      style={{ backgroundColor: currentAestheticConfig.primaryColor }}
                    >
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {isHindi ? opt.hindiLabel : opt.label}
                    </span>
                    <span className="rounded-md bg-slate-200/70 dark:bg-slate-700/60 px-1.5 py-0.2 text-[9px] font-black uppercase text-slate-600 dark:text-slate-300">
                      {isHindi ? opt.badgeHindi : opt.badge}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {isHindi ? opt.hindiDescription : opt.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 6 Curated Aesthetic Color Palettes */}
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
          {tText('2. Curated Aesthetic Color Palette', '2. पसंदीदा एस्थेटिक कलर पैलेट')}
        </label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(AESTHETIC_THEMES) as AestheticThemeId[]).map((themeKey) => {
            const palette = AESTHETIC_THEMES[themeKey];
            const isCurrent = aestheticTheme === themeKey;

            return (
              <button
                key={themeKey}
                type="button"
                onClick={() => setAestheticTheme(themeKey)}
                className={cn(
                  "relative flex flex-col justify-between rounded-xl border p-4 text-left transition-all active:scale-[0.98] cursor-pointer",
                  isCurrent
                    ? "border-slate-800 dark:border-white/50 bg-slate-50/90 dark:bg-slate-800/80 shadow-md ring-2 ring-slate-400/20"
                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-slate-700"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <span 
                      className="h-4 w-4 rounded-full shadow-xs transition-transform"
                      style={{ 
                        backgroundColor: palette.primaryColor,
                        boxShadow: `0 0 10px ${palette.glowColor}`
                      }}
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        {isHindi ? palette.hindiName : palette.name}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400">
                        {palette.tagline}
                      </span>
                    </div>
                  </div>
                  {isCurrent && (
                    <div 
                      className="flex h-5 w-5 items-center justify-center rounded-full text-white shadow-xs"
                      style={{ backgroundColor: palette.primaryColor }}
                    >
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug mt-2">
                  {isHindi ? palette.hindiDescription : palette.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Atmospheric & Ergonomic Options */}
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
          {tText('3. Atmosphere & Display Ergonomics', '3. विजुअल इफेक्ट्स व डिस्प्ले प्राथमिकताएं')}
        </label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Ambient Glow Toggle */}
          <div className="flex items-start justify-between gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-3.5">
            <div>
              <div className="flex items-center gap-1.5">
                <Wand2 size={13} className="text-emerald-500" />
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                  {tText('Ambient Glow Mesh', 'एंबिएंट बैकड्रॉप ग्लो')}
                </span>
              </div>
              <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">
                {tText('Subtle atmospheric depth gradient', 'बैकग्राउंड में सॉफ्ट एस्थेटिक डेप्थ इफेक्ट')}
              </p>
            </div>
            <input
              type="checkbox"
              checked={ambientGlow}
              onChange={(e) => setAmbientGlow(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
          </div>

          {/* Auto-Midnight by Time */}
          <div className="flex items-start justify-between gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-3.5">
            <div>
              <div className="flex items-center gap-1.5">
                <Clock size={13} className="text-indigo-500" />
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                  {tText('Auto Night Shift', 'ऑटो नाइट शिफ्ट')}
                </span>
              </div>
              <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">
                {tText('Auto-activate 8:00 PM – 7:00 AM', 'रात्रि 8 बजे से सुबह 7 बजे तक स्वतः सक्रिय')}
              </p>
            </div>
            <input
              type="checkbox"
              checked={autoMidnightEnabled}
              onChange={(e) => setAutoMidnightEnabled(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
          </div>

          {/* OLED Pure Black Mode */}
          <div className="flex items-start justify-between gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-3.5">
            <div>
              <div className="flex items-center gap-1.5">
                <MoonStar size={13} className="text-emerald-500" />
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                  {tText('OLED True Black', 'ओएलईडी ट्रू ब्लैक')}
                </span>
              </div>
              <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">
                {tText('#000000 pure black canvas in midnight', 'गहरी डार्कनेस व टैबलेट बैटरी बचत')}
              </p>
            </div>
            <input
              type="checkbox"
              checked={oledPureBlack}
              onChange={(e) => setOledPureBlack(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
          </div>

          {/* High-Contrast Text Mode */}
          <div className="flex items-start justify-between gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-3.5">
            <div>
              <div className="flex items-center gap-1.5">
                <Eye size={13} className="text-amber-500" />
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                  {tText('High-Contrast Text', 'शार्प हाई-कंट्रास्ट टेक्स्ट')}
                </span>
              </div>
              <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">
                {tText('Razor-sharp titles & label rendering', 'दवा का नाम व साल्ट पढ़ने में पूर्ण स्पष्टता')}
              </p>
            </div>
            <input
              type="checkbox"
              checked={highContrastText}
              onChange={(e) => setHighContrastText(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Live Interactive Aesthetic Terminal Preview */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060a14] p-4 space-y-3">
        <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400">
          <span className="flex items-center gap-1.5">
            <Activity size={12} style={{ color: currentAestheticConfig.primaryColor }} />
            {tText('Live Aesthetic UI & Terminal Preview', 'लाइव एस्थेटिक टर्मिनल प्रिव्यू')}
          </span>
          <span className="rounded bg-slate-200 dark:bg-slate-800 px-2 py-0.5 font-mono text-[9px] text-slate-700 dark:text-slate-300">
            Active: {currentAestheticConfig.name}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs">
          <div className="flex items-center gap-3">
            <div 
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white font-bold text-xs shadow-xs"
              style={{ backgroundColor: currentAestheticConfig.primaryColor }}
            >
              <Package size={18} />
            </div>
            <div>
              <div className="text-xs font-black text-slate-900 dark:text-white">Augmentin 625 Duo Tablet</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Amoxycillin &amp; Clavulanic Acid • Batch: AG-9021</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span 
              className="rounded-full px-2.5 py-0.5 text-[10px] font-black"
              style={{ 
                backgroundColor: currentAestheticConfig.badgeBg,
                color: currentAestheticConfig.badgeText
              }}
            >
              Stock: 420 Strips
            </span>
            <span 
              className="rounded-lg px-3 py-1.5 text-xs font-black text-white shadow-xs"
              style={{ backgroundColor: currentAestheticConfig.primaryColor }}
            >
              ₹182.40
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ThemeSelector;
