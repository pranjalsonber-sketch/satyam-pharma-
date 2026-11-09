import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'midnight';
export type AestheticThemeId = 'emerald' | 'sapphire' | 'amethyst' | 'amber' | 'rose' | 'nordic';
export type MidnightAccent = 'emerald' | 'cobalt' | 'amethyst' | 'amber'; // backwards compatible

export interface AestheticThemeConfig {
  id: AestheticThemeId;
  name: string;
  hindiName: string;
  description: string;
  hindiDescription: string;
  primaryColor: string;
  secondaryColor: string;
  glowColor: string;
  badgeBg: string;
  badgeText: string;
  iconBg: string;
  gradientClass: string;
  tagline: string;
}

export const AESTHETIC_THEMES: Record<AestheticThemeId, AestheticThemeConfig> = {
  emerald: {
    id: 'emerald',
    name: 'Emerald Clinical',
    hindiName: 'एमराल्ड क्लीनिकल (सुखद हरा)',
    tagline: 'Botanical Sage & Mint',
    description: 'Soothing clinical herbal green. Low eye-fatigue, balanced contrast, and organic calming aesthetics.',
    hindiDescription: 'आंखों की थकान दूर करने और प्राकृतिक चिकित्सा अनुभव हेतु शांत हरा रंग।',
    primaryColor: '#10b981',
    secondaryColor: '#059669',
    glowColor: 'rgba(16, 185, 129, 0.35)',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    badgeText: '#059669',
    iconBg: '#064e3b',
    gradientClass: 'from-emerald-500 to-teal-600'
  },
  sapphire: {
    id: 'sapphire',
    name: 'Sapphire Executive',
    hindiName: 'सफायर एग्जीक्यूटिव (हाई-टेक नीला)',
    tagline: 'Nordic Glacier & Deep Indigo',
    description: 'Ultra-modern healthcare aesthetic with razor-sharp contrast, crisp data tables, and professional cobalt hues.',
    hindiDescription: 'आधुनिक स्वास्थ्य सेवा व डेटा एनालिसिस हेतु हाई-विज़िबिलिटी कोबाल्ट नीला।',
    primaryColor: '#2563eb',
    secondaryColor: '#1d4ed8',
    glowColor: 'rgba(37, 99, 235, 0.35)',
    badgeBg: 'rgba(37, 99, 235, 0.15)',
    badgeText: '#2563eb',
    iconBg: '#1e3a8a',
    gradientClass: 'from-blue-600 to-indigo-600'
  },
  amethyst: {
    id: 'amethyst',
    name: 'Amethyst Velvet',
    hindiName: 'एमथिस्ट वेलवेट (रॉयल पर्पल)',
    tagline: 'Royal Orchid & Violet Glow',
    description: 'Sophisticated luxury apothecary vibe. Soft lavender glows with reduced screen glare for comfortable night viewing.',
    hindiDescription: 'शाही बैंगनी टोन जो स्क्रीन को शानदार व प्रीमियम लुक प्रदान करता है।',
    primaryColor: '#8b5cf6',
    secondaryColor: '#7c3aed',
    glowColor: 'rgba(139, 92, 246, 0.35)',
    badgeBg: 'rgba(139, 92, 246, 0.15)',
    badgeText: '#7c3aed',
    iconBg: '#581c87',
    gradientClass: 'from-purple-600 to-pink-600'
  },
  amber: {
    id: 'amber',
    name: 'Apothecary Amber',
    hindiName: 'एपोथेकेरी एम्बर (वार्म टेराकोटा)',
    tagline: 'Warm Terracotta & Circadian Gold',
    description: 'Warm, low blue-light amber and copper palette. Ideal for circadian health and comforting pharmacy counters.',
    hindiDescription: 'वार्म एम्बर टोन जो स्क्रीन की नीली रोशनी कम कर आंखों को राहत देता है।',
    primaryColor: '#d97706',
    secondaryColor: '#b45309',
    glowColor: 'rgba(217, 119, 6, 0.35)',
    badgeBg: 'rgba(217, 119, 6, 0.15)',
    badgeText: '#b45309',
    iconBg: '#78350f',
    gradientClass: 'from-amber-500 to-orange-600'
  },
  rose: {
    id: 'rose',
    name: 'Rose Quartz',
    hindiName: 'रोज़ क्वार्ट्ज़ (वेलनेस पिंक)',
    tagline: 'Calming Wellness & Peony',
    description: 'Gentle, modern wellness palette with warm rose gold undertones. Clean, friendly, and patient-centric.',
    hindiDescription: 'सौम्य और मित्रवत रोज़ टोन जो क्लीनिकल वातावरण में कोमलता और सकारात्मकता लाता है।',
    primaryColor: '#e11d48',
    secondaryColor: '#be123c',
    glowColor: 'rgba(225, 29, 72, 0.35)',
    badgeBg: 'rgba(225, 29, 72, 0.15)',
    badgeText: '#e11d48',
    iconBg: '#881337',
    gradientClass: 'from-rose-500 to-pink-600'
  },
  nordic: {
    id: 'nordic',
    name: 'Nordic Minimalist',
    hindiName: 'नॉर्डिक मिनिमलिस्ट (क्लीन मोनोक्रोम)',
    tagline: 'Monochrome Slate & Pure Glass',
    description: 'Pure Swiss design ethos. High-contrast monochrome slate surfaces with razor-sharp geometric precision.',
    hindiDescription: 'अल्ट्रा-क्लीन और न्यूनतम स्टाइल जो काम में पूर्ण स्पष्टता और फोकस सुनिश्चित करता है।',
    primaryColor: '#0f172a',
    secondaryColor: '#334155',
    glowColor: 'rgba(15, 23, 42, 0.30)',
    badgeBg: 'rgba(15, 23, 42, 0.10)',
    badgeText: '#0f172a',
    iconBg: '#1e293b',
    gradientClass: 'from-slate-800 to-zinc-900'
  }
};

// Backwards compatibility dictionary
export const MIDNIGHT_PALETTES: Record<MidnightAccent, any> = {
  emerald: AESTHETIC_THEMES.emerald,
  cobalt: AESTHETIC_THEMES.sapphire,
  amethyst: AESTHETIC_THEMES.amethyst,
  amber: AESTHETIC_THEMES.amber
};

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  aestheticTheme: AestheticThemeId;
  setAestheticTheme: (theme: AestheticThemeId) => void;
  ambientGlow: boolean;
  setAmbientGlow: (enabled: boolean) => void;
  midnightAccent: MidnightAccent;
  setMidnightAccent: (accent: MidnightAccent) => void;
  oledPureBlack: boolean;
  setOledPureBlack: (enabled: boolean) => void;
  autoMidnightEnabled: boolean;
  setAutoMidnightEnabled: (enabled: boolean) => void;
  highContrastText: boolean;
  setHighContrastText: (enabled: boolean) => void;
  isNightShiftActive: boolean;
  currentAestheticConfig: AestheticThemeConfig;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Helper to check if current time is within night shift hours (8:00 PM to 7:00 AM)
export const checkIsNightShiftTime = (): boolean => {
  const hour = new Date().getHours();
  return hour >= 20 || hour < 7;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('satyam_theme_mode') as ThemeMode;
    if (saved === 'light' || saved === 'dark' || saved === 'midnight') return saved;
    const legacy = localStorage.getItem('theme');
    if (legacy === 'dark') return 'dark';
    return 'light';
  });

  const [aestheticTheme, setAestheticThemeState] = useState<AestheticThemeId>(() => {
    const saved = localStorage.getItem('satyam_aesthetic_theme') as AestheticThemeId;
    if (saved && AESTHETIC_THEMES[saved]) return saved;
    // Check fallback midnight accent
    const oldAccent = localStorage.getItem('satyam_midnight_accent');
    if (oldAccent === 'cobalt') return 'sapphire';
    if (oldAccent && AESTHETIC_THEMES[oldAccent as AestheticThemeId]) return oldAccent as AestheticThemeId;
    return 'emerald';
  });

  const [ambientGlow, setAmbientGlowState] = useState<boolean>(() => {
    return localStorage.getItem('satyam_ambient_glow') !== 'false'; // default true for aesthetic look
  });

  const [oledPureBlack, setOledPureBlackState] = useState<boolean>(() => {
    return localStorage.getItem('satyam_oled_black') === 'true';
  });

  const [autoMidnightEnabled, setAutoMidnightEnabledState] = useState<boolean>(() => {
    return localStorage.getItem('satyam_auto_midnight') === 'true';
  });

  const [highContrastText, setHighContrastTextState] = useState<boolean>(() => {
    return localStorage.getItem('satyam_high_contrast_text') !== 'false';
  });

  const [isNightShiftActive, setIsNightShiftActive] = useState<boolean>(checkIsNightShiftTime);

  // Helper to execute theme updates with a silky smooth cross-fade transition
  const executeWithCrossFade = useCallback((updaterFn: () => void) => {
    if (typeof document !== 'undefined') {
      // 1. Add temporary transition class to apply smooth CSS transitions to all child nodes
      document.documentElement.classList.add('theme-transitioning');
      
      const clearTimer = setTimeout(() => {
        document.documentElement.classList.remove('theme-transitioning');
      }, 450);

      // 2. Use native View Transitions API if supported for GPU-accelerated full-page cross-fade
      if ('startViewTransition' in document && typeof (document as any).startViewTransition === 'function') {
        (document as any).startViewTransition(() => {
          updaterFn();
        });
        return () => clearTimeout(clearTimer);
      }
    }
    updaterFn();
  }, []);

  // Setters with localStorage persistence and smooth cross-fade transition
  const setTheme = useCallback((newTheme: ThemeMode) => {
    executeWithCrossFade(() => {
      setThemeState(newTheme);
      localStorage.setItem('satyam_theme_mode', newTheme);
      localStorage.setItem('theme', newTheme === 'light' ? 'light' : 'dark');
    });
  }, [executeWithCrossFade]);

  const setAestheticTheme = useCallback((themeId: AestheticThemeId) => {
    executeWithCrossFade(() => {
      setAestheticThemeState(themeId);
      localStorage.setItem('satyam_aesthetic_theme', themeId);
      // Sync midnight accent for backwards compatibility
      const midnightEquivalent: MidnightAccent = themeId === 'sapphire' ? 'cobalt' : (themeId === 'rose' || themeId === 'nordic' ? 'emerald' : themeId);
      localStorage.setItem('satyam_midnight_accent', midnightEquivalent);
    });
  }, [executeWithCrossFade]);

  const setAmbientGlow = useCallback((enabled: boolean) => {
    setAmbientGlowState(enabled);
    localStorage.setItem('satyam_ambient_glow', enabled ? 'true' : 'false');
  }, []);

  const setMidnightAccent = useCallback((accent: MidnightAccent) => {
    const mapped: AestheticThemeId = accent === 'cobalt' ? 'sapphire' : accent;
    setAestheticTheme(mapped);
  }, [setAestheticTheme]);

  const setOledPureBlack = useCallback((enabled: boolean) => {
    setOledPureBlackState(enabled);
    localStorage.setItem('satyam_oled_black', enabled ? 'true' : 'false');
  }, []);

  const setAutoMidnightEnabled = useCallback((enabled: boolean) => {
    setAutoMidnightEnabledState(enabled);
    localStorage.setItem('satyam_auto_midnight', enabled ? 'true' : 'false');
    if (enabled && checkIsNightShiftTime()) {
      setTheme('midnight');
    }
  }, [setTheme]);

  const setHighContrastText = useCallback((enabled: boolean) => {
    setHighContrastTextState(enabled);
    localStorage.setItem('satyam_high_contrast_text', enabled ? 'true' : 'false');
  }, []);

  // Check night shift timer periodically
  useEffect(() => {
    const checkTimer = () => {
      const isNight = checkIsNightShiftTime();
      setIsNightShiftActive(isNight);
      if (autoMidnightEnabled) {
        if (isNight && theme !== 'midnight') {
          setTheme('midnight');
        } else if (!isNight && theme === 'midnight') {
          setTheme('light');
        }
      }
    };

    checkTimer();
    const interval = setInterval(checkTimer, 60000);
    return () => clearInterval(interval);
  }, [autoMidnightEnabled, theme, setTheme]);

  // DOM Class and CSS Variable Synchronization
  useEffect(() => {
    const root = document.documentElement;

    // Reset theme classes
    root.classList.remove('dark', 'midnight-theme', 'theme-oled', 'theme-high-contrast', 'theme-ambient-glow');
    root.classList.remove('theme-accent-emerald', 'theme-accent-cobalt', 'theme-accent-sapphire', 'theme-accent-amethyst', 'theme-accent-amber', 'theme-accent-rose', 'theme-accent-nordic');

    const config = AESTHETIC_THEMES[aestheticTheme] || AESTHETIC_THEMES.emerald;

    // Set active aesthetic theme class
    root.classList.add(`theme-accent-${aestheticTheme}`);

    if (ambientGlow) {
      root.classList.add('theme-ambient-glow');
    }

    if (theme === 'midnight') {
      root.classList.add('dark', 'midnight-theme');
      if (oledPureBlack) root.classList.add('theme-oled');
      if (highContrastText) root.classList.add('theme-high-contrast');
    } else if (theme === 'dark') {
      root.classList.add('dark');
      if (highContrastText) root.classList.add('theme-high-contrast');
    }

    // Dynamic CSS Custom Properties for theme accents
    root.style.setProperty('--aesthetic-primary', config.primaryColor);
    root.style.setProperty('--aesthetic-secondary', config.secondaryColor);
    root.style.setProperty('--aesthetic-glow', config.glowColor);
    root.style.setProperty('--aesthetic-badge-bg', config.badgeBg);
    root.style.setProperty('--aesthetic-badge-text', config.badgeText);
    root.style.setProperty('--aesthetic-icon-bg', config.iconBg);

    // Also sync midnight vars for legacy selectors
    root.style.setProperty('--midnight-primary', config.primaryColor);
    root.style.setProperty('--midnight-glow', config.glowColor);
    root.style.setProperty('--midnight-badge-bg', config.badgeBg);
    root.style.setProperty('--midnight-badge-text', config.badgeText);
    root.style.setProperty('--midnight-icon-bg', config.iconBg);
  }, [theme, aestheticTheme, oledPureBlack, highContrastText, ambientGlow]);

  const toggleTheme = useCallback(() => {
    executeWithCrossFade(() => {
      setThemeState(prev => {
        let next: ThemeMode = 'light';
        if (prev === 'light') next = 'dark';
        else if (prev === 'dark') next = 'midnight';
        else next = 'light';

        localStorage.setItem('satyam_theme_mode', next);
        localStorage.setItem('theme', next === 'light' ? 'light' : 'dark');
        return next;
      });
    });
  }, [executeWithCrossFade]);

  const currentAestheticConfig = AESTHETIC_THEMES[aestheticTheme] || AESTHETIC_THEMES.emerald;

  const midnightAccentEquivalent: MidnightAccent = aestheticTheme === 'sapphire' ? 'cobalt' : (aestheticTheme === 'rose' || aestheticTheme === 'nordic' ? 'emerald' : aestheticTheme as MidnightAccent);

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      setTheme, 
      toggleTheme,
      aestheticTheme,
      setAestheticTheme,
      ambientGlow,
      setAmbientGlow,
      midnightAccent: midnightAccentEquivalent,
      setMidnightAccent,
      oledPureBlack,
      setOledPureBlack,
      autoMidnightEnabled,
      setAutoMidnightEnabled,
      highContrastText,
      setHighContrastText,
      isNightShiftActive,
      currentAestheticConfig
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

