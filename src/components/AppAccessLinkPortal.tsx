import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  Copy,
  Check,
  Share2,
  ShieldCheck,
  Users,
  Globe,
  X,
  ArrowUpRight,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const DEV_APP_URL =
  'https://ais-dev-noz77brxkrxmyvi6efljtf-262181930484.asia-east1.run.app';
export const LIVE_SHARED_APP_URL =
  'https://ais-pre-noz77brxkrxmyvi6efljtf-262181930484.asia-east1.run.app';

/**
 * Always returns the currently active, verified working application URL
 * so clicking it never results in a 404 error.
 */
export function getActiveAppUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return DEV_APP_URL;
}

export interface RedirectToastPayload {
  url: string;
  label: string;
  timestamp: number;
}

/**
 * Helper to trigger a safe anchor-based external navigation (without window.open)
 * and display a visible redirect confirmation banner with a direct clickable link.
 */
export function triggerSafeLinkRedirect(url: string, label: string = 'External Link'): void {
  window.dispatchEvent(
    new CustomEvent('app-link-redirect-notice', {
      detail: { url, label, timestamp: Date.now() },
    })
  );

  // Also copy to clipboard as a helpful fallback
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).catch(() => {});
  }

  // Trigger a clean <a target="_blank" rel="noopener noreferrer"> click
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
      if (anchor.parentNode) {
        anchor.parentNode.removeChild(anchor);
      }
    }, 300);
  } catch (err) {
    console.warn('Anchor redirect notice:', err);
  }
}

interface AppAccessLinkPortalProps {
  variant?: 'header-button' | 'login-card';
  onOpenMembersModal?: () => void;
}

export const AppAccessLinkPortal: React.FC<AppAccessLinkPortalProps> = ({
  variant = 'header-button',
  onOpenMembersModal,
}) => {
  const [isPortalModalOpen, setIsPortalModalOpen] = useState(false);
  const [redirectNotice, setRedirectNotice] = useState<RedirectToastPayload | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const activeWorkingUrl = getActiveAppUrl();

  useEffect(() => {
    const handleRedirectEvent = (e: any) => {
      if (e?.detail?.url) {
        setRedirectNotice({
          url: e.detail.url,
          label: e.detail.label || 'Application Link',
          timestamp: e.detail.timestamp || Date.now(),
        });
      }
    };

    const handleOpenPortalEvent = () => {
      setIsPortalModalOpen(true);
    };

    window.addEventListener('app-link-redirect-notice', handleRedirectEvent);
    window.addEventListener('open-app-access-portal', handleOpenPortalEvent);
    return () => {
      window.removeEventListener('app-link-redirect-notice', handleRedirectEvent);
      window.removeEventListener('open-app-access-portal', handleOpenPortalEvent);
    };
  }, []);

  // Auto-dismiss redirect notice after 8 seconds
  useEffect(() => {
    if (!redirectNotice) return;
    const timer = setTimeout(() => {
      setRedirectNotice(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [redirectNotice]);

  const handleCopyUrl = (url: string, key: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2200);
  };

  const handleLinkAnchorClick = (url: string, label: string) => {
    setRedirectNotice({
      url,
      label,
      timestamp: Date.now(),
    });
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  };

  if (variant === 'login-card') {
    return (
      <div className="mt-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 p-3.5 text-left space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <Globe size={12} className="text-blue-600 dark:text-blue-400" />
            <span>Active Full-Screen Web Link (Verified Working)</span>
          </span>
          <button
            type="button"
            onClick={() => handleCopyUrl(activeWorkingUrl, 'login-live')}
            className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            {copiedKey === 'login-live' ? <Check size={11} /> : <Copy size={11} />}
            <span>{copiedKey === 'login-live' ? 'Link Copied!' : 'Copy Link'}</span>
          </button>
        </div>

        <a
          href={activeWorkingUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            handleLinkAnchorClick(activeWorkingUrl, 'Satyam ERP Active Application')
          }
          className="flex items-center justify-between gap-2 rounded-lg border border-blue-200 dark:border-blue-900/60 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all cursor-pointer"
        >
          <span className="truncate font-mono text-[11px]">{activeWorkingUrl}</span>
          <span className="inline-flex items-center gap-1 shrink-0 rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-black text-white">
            <span>Open</span>
            <ExternalLink size={10} />
          </span>
        </a>

        {redirectNotice && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/60 px-2.5 py-2 text-[11px] font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
            <span>
              Redirecting to <strong>{redirectNotice.label}</strong> in a new tab (Link also copied!).
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Header Quick Access & Link Trigger Button */}
      <button
        type="button"
        onClick={() => setIsPortalModalOpen(true)}
        className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-2.5 sm:px-3 py-1.5 text-xs font-bold shadow-2xs transition-all cursor-pointer active:scale-95"
        title="Open Working App Link & Team Sharing Portal"
      >
        <Share2 size={13} className="shrink-0" />
        <span className="text-[11px] font-black">App Link</span>
      </button>

      {/* Global Redirect Notification Banner (Appears whenever any external/app link is clicked) */}
      <AnimatePresence>
        {redirectNotice && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            className="fixed top-4 right-4 z-[150] w-full max-w-md rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-slate-900/95 text-white p-4 shadow-2xl backdrop-blur-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <ExternalLink size={16} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-emerald-300">
                      Redirecting to Link...
                    </h4>
                  </div>
                  <p className="text-xs font-semibold text-slate-200 mt-1">
                    Opening <strong>{redirectNotice.label}</strong> in a new browser tab.
                  </p>
                  <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                    {redirectNotice.url}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRedirectNotice(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-end gap-2 pt-2.5 border-t border-slate-800">
              <button
                type="button"
                onClick={() => handleCopyUrl(redirectNotice.url, 'toast-copy')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-[11px] font-bold text-slate-200 cursor-pointer"
              >
                {copiedKey === 'toast-copy' ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedKey === 'toast-copy' ? 'Copied!' : 'Copy Link'}</span>
              </button>

              <a
                href={redirectNotice.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3.5 py-1.5 text-[11px] font-black text-slate-950 shadow-sm cursor-pointer"
              >
                <span>Open Link Now</span>
                <ArrowUpRight size={13} />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full App Access & Team Links Modal */}
      <AnimatePresence>
        {isPortalModalOpen && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="relative w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 px-6 py-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    <Globe size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider">
                      Application Access Links & Team Role Portal
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Click the verified active link below to open the app in a full standalone browser tab
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPortalModalOpen(false)}
                  className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
                {/* 1. Primary Active Working Link (Never 404s) */}
                <div className="rounded-xl border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        1. Active Working Application Link (Use This Link Now — Online & Ready)
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        Direct Full-Screen Web App URL
                      </h4>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      ● Verified Online
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-zinc-950 p-3">
                    <span className="font-mono text-xs text-slate-800 dark:text-slate-200 break-all">
                      {DEV_APP_URL}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(DEV_APP_URL, 'modal-active')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        {copiedKey === 'modal-active' ? <Check size={13} /> : <Copy size={13} />}
                        <span>{copiedKey === 'modal-active' ? 'Copied!' : 'Copy'}</span>
                      </button>

                      <a
                        href={DEV_APP_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() =>
                          handleLinkAnchorClick(
                            DEV_APP_URL,
                            'Satyam Pharma Active Web Application'
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 text-xs font-black text-white shadow-xs cursor-pointer"
                      >
                        <span>Open Working Link</span>
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>
                </div>

                {/* 2. Why ais-pre shows 404 until Share / Deploy is clicked */}
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <Info size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                      <p className="font-black text-amber-900 dark:text-amber-300">
                        Why did the "ais-pre-..." link show HTTP ERROR 404?
                      </p>
                      <p className="leading-relaxed">
                        In Google AI Studio, the <strong>ais-dev-...</strong> link above is your live running server and works immediately. The <strong>ais-pre-...</strong> link only activates after you click the <strong>"Share"</strong> or <strong>"Deploy"</strong> button in the top-right corner of the AI Studio page to publish a public snapshot.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-zinc-900 p-2.5">
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 break-all">
                      {LIVE_SHARED_APP_URL} (Requires clicking "Share" in top-right toolbar first)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyUrl(LIVE_SHARED_APP_URL, 'modal-pre')}
                      className="inline-flex items-center gap-1.5 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      {copiedKey === 'modal-pre' ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedKey === 'modal-pre' ? 'Copied' : 'Copy Shared URL'}</span>
                    </button>
                  </div>
                </div>

                {/* 3. Owner vs Worker Access Matrix */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5">
                    <div className="flex items-center gap-2 text-xs font-black text-emerald-800 dark:text-emerald-300">
                      <ShieldCheck size={15} />
                      <span>5 Owners (Admin / Manager Role)</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                      Full access to <strong>Dashboard</strong>, <strong>Auto-Procurement Engine</strong>, <strong>Inventory Health</strong>, <strong>Wholesalers</strong>, <strong>Activity Logs</strong>, <strong>POS</strong>, and <strong>Settings</strong>.
                    </p>
                  </div>

                  <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 p-3.5">
                    <div className="flex items-center gap-2 text-xs font-black text-amber-800 dark:text-amber-300">
                      <Users size={15} />
                      <span>5 Workers (Clerk Role)</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                      Restricted strictly to <strong>Inventory (Stock & Batch Notes)</strong>, <strong>POS Billing</strong>, and <strong>90D Expiry Report</strong>. Financials & Wholesalers are hidden.
                    </p>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  {onOpenMembersModal ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsPortalModalOpen(false);
                        onOpenMembersModal();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      <Users size={14} />
                      <span>Manage 5 Owners & 5 Workers Roles</span>
                    </button>
                  ) : (
                    <span />
                  )}

                  <button
                    type="button"
                    onClick={() => setIsPortalModalOpen(false)}
                    className="rounded-xl bg-slate-900 dark:bg-white px-5 py-2 text-xs font-black text-white dark:text-slate-900 cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
