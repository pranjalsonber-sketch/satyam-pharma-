import React, { useEffect, useState } from 'react';
import { Newspaper, Bell, Search, ExternalLink, RefreshCw, Sparkles, BookOpen, HeartPulse, UserCheck, Quote, ShieldCheck, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { useLanguage } from '../context/LanguageContext';
import { cn } from '../lib/utils';
import { getDailyQuote } from '../lib/dailyQuotes';

const Regulatory: React.FC = () => {
  const { t, isHindi } = useLanguage();
  const todayQuote = getDailyQuote(new Date());
  const [news, setNews] = useState<string>('');
  const [insights, setInsights] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryContent, setCategoryContent] = useState<string>('');
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [categoryTips, setCategoryTips] = useState<Record<string, string>>({});

  const fetchNews = async (signal?: AbortSignal) => {
    setLoading(true);
    let timeoutId: any = null;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 60000);

      // If an external signal aborts, abort our internal controller too
      if (signal) {
        if (signal.aborted) {
          controller.abort();
        } else {
          signal.addEventListener('abort', () => controller.abort(), { once: true });
        }
      }

      const fetchSignal = controller.signal;

      try {
        const res = await fetch(`/api/ai/regulatory-hub`, { signal: fetchSignal });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        
        const data = await res.json();
        
        if (!fetchSignal.aborted && (!signal || !signal.aborted)) {
          if (data.news) setNews(data.news);
          if (data.insights) setInsights(data.insights);
          if (data.tips) setCategoryTips(data.tips);

          setLastUpdated(new Date().toLocaleString('en-IN', { 
            day: 'numeric', 
            month: 'short', 
            hour: '2-digit', 
            minute: '2-digit' 
          }));
        }
      } catch (e: any) {
        clearTimeout(timeoutId);
        const isAbort = 
          e?.name === 'AbortError' || 
          fetchSignal.aborted || 
          (signal && signal.aborted) ||
          (typeof e === 'string' && (e.includes('unmount') || e.includes('abort'))) ||
          (e?.message && (e.message.includes('unmount') || e.message.includes('abort') || e.message.includes('aborted')));

        if (isAbort) {
          // Clean unmount / timeout abort - no error to log
          return;
        }
        console.warn("Regulatory hub fetch notice:", e?.message || e);
      }
    } catch (error: any) {
      if (signal && signal.aborted) return;
      console.warn("Regulatory hub request notice:", error?.message || error);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      if (!signal || !signal.aborted) {
        setLoading(false);
      }
    }
  };

  const handleCategoryClick = async (category: string) => {
    console.log(`[Regulatory] Deep dive requested for: ${category}`);
    setSelectedCategory(category);
    setCategoryLoading(true);
    setCategoryContent('');
    try {
      const res = await fetch('/api/ai/deep-dive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category })
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Server error (${res.status}): ${errorText}`);
      }
      
      const data = await res.json();
      console.log(`[Regulatory] Deep dive data received:`, data);
      setCategoryContent(data.result || "No content returned from server.");
    } catch (error: any) {
      console.error(`[Regulatory] Deep dive error:`, error);
      setCategoryContent(`### Connection Issue\n\nI'm having trouble fetching the latest clinical data for **${category}** right now.\n\n**Error details:** ${error.message}\n\nPlease try again in a moment.`);
    } finally {
      setCategoryLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchNews(controller.signal);
    return () => {
      controller.abort();
    };
  }, []);

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t('regulatory')}</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            {lastUpdated ? `Refreshed: ${lastUpdated}` : 'Daily Updates & Clinical Knowledge'}
          </p>
        </div>
        <button 
          onClick={() => fetchNews()}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-white"
        >
          <RefreshCw size={14} className={cn(loading && "animate-spin")} />
          <span>{t('sync')}</span>
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Regulatory News */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="bg-slate-900 p-6 text-white dark:bg-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <Newspaper size={20} className="text-blue-400" />
              <h3 className="text-sm font-black uppercase tracking-widest">PCI & Regulatory Updates</h3>
            </div>
            <p className="text-[10px] uppercase font-bold tracking-tight opacity-70">Official Pharmacy Council Notifications</p>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="space-y-4 py-8">
                <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                <div className="h-4 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
              </div>
            ) : (
              <div className="markdown-body text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                <ReactMarkdown>{news}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>

        {/* Daily Smart Insights */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="bg-blue-600 p-6 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={20} />
              <h3 className="text-sm font-black uppercase tracking-widest">Growth & Safety Insights</h3>
            </div>
            <p className="text-[10px] uppercase font-bold tracking-tight opacity-90">Daily Clinical & Business Tips</p>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="space-y-4 py-8">
                <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                <div className="h-4 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
              </div>
            ) : (
              <div className="markdown-body text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                <ReactMarkdown>{insights}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Motivational Quote Section */}
      <div className="rounded-xl bg-slate-900 p-10 text-center text-white shadow-2xl dark:bg-slate-800">
        <Quote size={40} className="mx-auto mb-6 text-blue-500 opacity-30" />
        <p className="text-xl font-bold italic leading-tight md:text-2xl lg:text-3xl max-w-2xl mx-auto tracking-tight text-slate-100">
          "{isHindi ? todayQuote.hi : todayQuote.en}"
        </p>
        <p className="mt-3 text-sm font-semibold text-amber-300">
          — {isHindi ? todayQuote.authorHi : todayQuote.authorEn}
        </p>
        <div className="mt-6 flex items-center justify-center gap-4">
          <div className="h-px w-8 bg-blue-500/50" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">
            {isHindi ? todayQuote.categoryLabelHi : todayQuote.categoryLabelEn} • Satyam Daily Mindset
          </p>
          <div className="h-px w-8 bg-blue-500/50" />
        </div>
      </div>

      {/* Resource Quick Links */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        {[
          { label: 'Growth Strategy', icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/10' },
          { label: 'Patient Care', icon: UserCheck, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/10' },
          { label: 'GCP Guidelines', icon: ShieldCheck, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/10' },
        ].map((item) => (
          <button 
            key={item.label} 
            onClick={() => handleCategoryClick(item.label)}
            className="flex flex-col items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:scale-[1.02] hover:shadow-md active:scale-95 dark:border-slate-800 dark:bg-slate-900 text-left"
          >
            <div className="flex items-center gap-3">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-sm", item.bg)}>
                <item.icon className={item.color} size={20} />
              </div>
              <span className="text-[11px] font-black uppercase tracking-tight text-slate-800 dark:text-slate-200">{item.label}</span>
            </div>
            {categoryTips[item.label] && (
              <p className="text-[10px] font-medium leading-relaxed text-slate-500 dark:text-slate-400 italic">
                "{categoryTips[item.label]}"
              </p>
            )}
          </button>
        ))}
      </div>

      {/* Deep Dive Modal */}
      <AnimatePresence>
        {selectedCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSelectedCategory(null)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl dark:bg-slate-900"
            >
              <div className="sticky top-0 mb-6 flex items-center justify-between border-b border-slate-100 bg-white/80 pb-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
                <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
                  {selectedCategory}
                </h2>
                <button 
                  onClick={() => setSelectedCategory(null)}
                  className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X size={20} />
                </button>
              </div>

              {categoryLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                  <Loader2 className="mb-4 animate-spin" size={32} />
                  <p className="text-xs font-bold uppercase tracking-widest">Generating Insight...</p>
                </div>
              ) : (
                <div className="markdown-body text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  <ReactMarkdown>{categoryContent}</ReactMarkdown>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Regulatory;
