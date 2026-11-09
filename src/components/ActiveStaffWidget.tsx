import React, { useState, useEffect } from 'react';
import { Users, Shield, UserCheck, Laptop, Clock, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthProvider';
import { useLanguage } from '../context/LanguageContext';
import { UserProfile } from '../types';
import { cn } from '../lib/utils';

interface ActiveStaffWidgetProps {
  onOpenMembers?: () => void;
}

export const ActiveStaffWidget: React.FC<ActiveStaffWidgetProps> = ({ onOpenMembers }) => {
  const { profile, switchSimulatedMember } = useAuth();
  const { t, language } = useLanguage();
  const [members, setMembers] = useState<UserProfile[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach(doc => {
        list.push({ uid: doc.id, ...doc.data() } as UserProfile);
      });

      if (list.length <= 1) {
        list.push(
          {
            uid: 'staff-demo-1',
            email: 'rahul.pharmacist@satyammedical.in',
            displayName: 'Rahul Sharma (B.Pharm)',
            role: 'manager',
            isOnline: true,
            terminalName: 'POS Counter-1',
            deviceInfo: 'Chrome on Windows',
            lastLoginAt: new Date().toISOString(),
            status: 'active'
          },
          {
            uid: 'staff-demo-2',
            email: 'pooja.cashier@satyammedical.in',
            displayName: 'Pooja Patel (Cashier)',
            role: 'clerk',
            isOnline: true,
            terminalName: 'Billing Counter-2',
            deviceInfo: 'Chrome on Windows',
            lastLoginAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
            status: 'active'
          }
        );
      }

      setMembers(list);
    }, (error) => {
      console.warn("Active staff widget listener note:", error.message);
    });

    return () => unsubscribe();
  }, []);

  const onlineMembers = members.filter(m => m.isOnline);

  const getRelativeTime = (isoString?: string) => {
    if (!isoString) return language === 'hi' ? 'अभी' : 'Just now';
    const date = new Date(isoString);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    if (diffMins < 1) return language === 'hi' ? 'अभी' : 'Just now';
    if (diffMins < 60) return language === 'hi' ? `${diffMins} मि. पहले` : `${diffMins}m ago`;
    return language === 'hi' ? `${Math.floor(diffMins / 60)} घंटे पहले` : `${Math.floor(diffMins / 60)}h ago`;
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-900/30">
            <Users size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {t('activeStaffTitle')}
              </h3>
              <span className="flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:text-emerald-300">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <span>{onlineMembers.length} {t('activeNow')}</span>
              </span>
            </div>
            <p className="text-[10px] text-slate-400">{t('liveCountersSubtitle')}</p>
          </div>
        </div>

        {onOpenMembers && (
          <button
            type="button"
            onClick={onOpenMembers}
            className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            <span>{t('manageAllStaff')} ({members.length})</span>
            <ArrowRight size={13} />
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-4">
        {members.slice(0, 3).map((m) => {
          const isOnline = !!m.isOnline;
          return (
            <div 
              key={m.uid}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-xs">
                    {(m.displayName || m.email).charAt(0).toUpperCase()}
                  </div>
                  <span 
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-slate-800",
                      isOnline ? "bg-emerald-500" : "bg-slate-400"
                    )}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                    {m.displayName || m.email.split('@')[0]}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {m.terminalName || 'Counter 1'} • {m.role === 'admin' ? t('admin') : (m.role === 'manager' ? t('manager') : t('clerk'))}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className={cn(
                  "text-[9px] font-bold px-1.5 py-0.5 rounded-md",
                  isOnline ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                )}>
                  {isOnline ? t('online') : t('offline')}
                </span>
                <p className="text-[9px] text-slate-400 mt-0.5">{getRelativeTime(m.lastLoginAt)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ActiveStaffWidget;
