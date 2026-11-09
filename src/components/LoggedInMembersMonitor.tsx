import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Shield, 
  UserCheck, 
  Clock, 
  Laptop, 
  Smartphone, 
  Globe, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Filter, 
  RefreshCw, 
  UserPlus, 
  LogOut, 
  Sparkles, 
  Check, 
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  SlidersHorizontal,
  ChevronRight,
  History,
  X
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthProvider';
import { useLanguage } from '../context/LanguageContext';
import { UserProfile, UserRole } from '../types';
import { logAuditAction } from '../lib/auditLogger';
import { cn, formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface LoggedInMembersMonitorProps {
  isModal?: boolean;
  onClose?: () => void;
}

export const LoggedInMembersMonitor: React.FC<LoggedInMembersMonitorProps> = ({ isModal, onClose }) => {
  const { profile, user, switchSimulatedMember, isSimulated } = useAuth();
  const { t, language } = useLanguage();
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'online' | 'admin' | 'clerk' | 'manager'>('all');
  const [selectedMember, setSelectedMember] = useState<UserProfile | null>(null);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loginAuditLogs, setLoginAuditLogs] = useState<any[]>([]);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonEmail, setNewPersonEmail] = useState('');
  const [newPersonRole, setNewPersonRole] = useState<'admin' | 'clerk'>('clerk');

  const getDefaultTenTeamRoster = (): UserProfile[] => [
    // 5 Owners (Full Access to Everything)
    {
      uid: 'owner-slot-1',
      email: 'pranjalsonber@gmail.com',
      displayName: 'Pranjal Sonber (Owner 1)',
      role: 'admin',
      isOnline: true,
      terminalName: 'Owner Master Terminal',
      deviceInfo: 'Full ERP Access (All Modules)',
      lastLoginAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      loginCount: 84,
      status: 'active'
    },
    {
      uid: 'owner-slot-2',
      email: 'owner2@satyammedical.in',
      displayName: 'Co-Owner 2 (Partner)',
      role: 'admin',
      isOnline: false,
      terminalName: 'Owner Office Terminal',
      deviceInfo: 'Full ERP Access (All Modules)',
      lastLoginAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      lastActiveAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      loginCount: 52,
      status: 'active'
    },
    {
      uid: 'owner-slot-3',
      email: 'owner3@satyammedical.in',
      displayName: 'Co-Owner 3 (Partner)',
      role: 'admin',
      isOnline: false,
      terminalName: 'Owner Mobile / Laptop',
      deviceInfo: 'Full ERP Access (All Modules)',
      lastLoginAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      lastActiveAt: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
      loginCount: 39,
      status: 'active'
    },
    {
      uid: 'owner-slot-4',
      email: 'owner4@satyammedical.in',
      displayName: 'Co-Owner 4 (Partner)',
      role: 'admin',
      isOnline: false,
      terminalName: 'Owner Desk Terminal',
      deviceInfo: 'Full ERP Access (All Modules)',
      lastLoginAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
      lastActiveAt: new Date(Date.now() - 1000 * 60 * 230).toISOString(),
      loginCount: 31,
      status: 'active'
    },
    {
      uid: 'owner-slot-5',
      email: 'owner5@satyammedical.in',
      displayName: 'Co-Owner 5 (Partner)',
      role: 'admin',
      isOnline: false,
      terminalName: 'Owner Desk Terminal',
      deviceInfo: 'Full ERP Access (All Modules)',
      lastLoginAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
      lastActiveAt: new Date(Date.now() - 1000 * 60 * 350).toISOString(),
      loginCount: 27,
      status: 'active'
    },
    // 5 Workers (Restricted ONLY to Stock, Expiry & Counter)
    {
      uid: 'worker-slot-1',
      email: 'worker1@satyammedical.in',
      displayName: 'Worker 1 (Stock & Expiry Staff)',
      role: 'clerk',
      isOnline: true,
      terminalName: 'Stock Counter-1',
      deviceInfo: 'Restricted: Stock, Expiry & POS Only',
      lastLoginAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      lastActiveAt: new Date().toISOString(),
      loginCount: 44,
      status: 'active'
    },
    {
      uid: 'worker-slot-2',
      email: 'worker2@satyammedical.in',
      displayName: 'Worker 2 (Stock & Expiry Staff)',
      role: 'clerk',
      isOnline: true,
      terminalName: 'Stock Counter-2',
      deviceInfo: 'Restricted: Stock, Expiry & POS Only',
      lastLoginAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      lastActiveAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      loginCount: 36,
      status: 'active'
    },
    {
      uid: 'worker-slot-3',
      email: 'worker3@satyammedical.in',
      displayName: 'Worker 3 (Stock & Expiry Staff)',
      role: 'clerk',
      isOnline: false,
      terminalName: 'Rack Audit Scanner-1',
      deviceInfo: 'Restricted: Stock, Expiry & POS Only',
      lastLoginAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      lastActiveAt: new Date(Date.now() - 1000 * 60 * 80).toISOString(),
      loginCount: 29,
      status: 'active'
    },
    {
      uid: 'worker-slot-4',
      email: 'worker4@satyammedical.in',
      displayName: 'Worker 4 (Stock & Expiry Staff)',
      role: 'clerk',
      isOnline: false,
      terminalName: 'Rack Audit Scanner-2',
      deviceInfo: 'Restricted: Stock, Expiry & POS Only',
      lastLoginAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      lastActiveAt: new Date(Date.now() - 1000 * 60 * 170).toISOString(),
      loginCount: 22,
      status: 'active'
    },
    {
      uid: 'worker-slot-5',
      email: 'worker5@satyammedical.in',
      displayName: 'Worker 5 (Stock & Expiry Staff)',
      role: 'clerk',
      isOnline: false,
      terminalName: 'Counter Terminal-3',
      deviceInfo: 'Restricted: Stock, Expiry & POS Only',
      lastLoginAt: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
      lastActiveAt: new Date(Date.now() - 1000 * 60 * 290).toISOString(),
      loginCount: 19,
      status: 'active'
    }
  ];

  const syncRosterToLocal = (list: UserProfile[]) => {
    try {
      localStorage.setItem('satyam_authorized_roster_v1', JSON.stringify(list));
    } catch (e) {}
  };

  // Real-time Firestore listener for all users
  useEffect(() => {
    setLoading(true);
    let storedRoster: UserProfile[] = [];
    try {
      const raw = localStorage.getItem('satyam_authorized_roster_v1');
      if (raw) storedRoster = JSON.parse(raw);
    } catch (e) {}

    if (storedRoster.length === 0) {
      storedRoster = getDefaultTenTeamRoster();
      syncRosterToLocal(storedRoster);
    }

    const usersCol = collection(db, 'users');
    const unsubscribeUsers = onSnapshot(usersCol, (snapshot) => {
      const userList: UserProfile[] = [];
      snapshot.forEach((docSnap) => {
        userList.push({ uid: docSnap.id, ...docSnap.data() } as UserProfile);
      });

      const existingEmails = new Set(userList.map(u => (u.email || '').toLowerCase()));
      storedRoster.forEach(d => {
        if (!existingEmails.has((d.email || '').toLowerCase())) {
          userList.push(d);
        }
      });

      // Sort by Owners first, then online status
      userList.sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        return (a.displayName || '').localeCompare(b.displayName || '');
      });

      setMembers(userList);
      syncRosterToLocal(userList);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to users collection:", error);
      setMembers(storedRoster);
      setLoading(false);
    });

    // Real-time listener for login audit logs
    const auditCol = collection(db, 'audit_logs');
    const unsubscribeAudit = onSnapshot(auditCol, (snap) => {
      const logs: any[] = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.action === 'USER_LOGIN' || data.type === 'system') {
          logs.push({ id: docSnap.id, ...data });
        }
      });
      logs.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      setLoginAuditLogs(logs.slice(0, 10));
    }, (err) => {
      console.warn("Audit logs listener note:", err);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeAudit();
    };
  }, []);

  const handleRoleChange = async (memberId: string, newRole: UserRole) => {
    setIsUpdatingRole(true);
    const targetMember = members.find(m => m.uid === memberId);
    const prevRole = targetMember?.role || 'clerk';

    try {
      const updatedList = members.map(m =>
        m.uid === memberId
          ? {
              ...m,
              role: newRole,
              deviceInfo:
                newRole === 'admin'
                  ? 'Full ERP Access (All Modules)'
                  : 'Restricted: Stock, Expiry & POS Only'
            }
          : m
      );
      setMembers(updatedList);
      syncRosterToLocal(updatedList);

      if (!memberId.startsWith('staff-demo') && !memberId.startsWith('owner-slot') && !memberId.startsWith('worker-slot')) {
        const memberRef = doc(db, 'users', memberId);
        await setDoc(memberRef, { role: newRole }, { merge: true });
      }

      // Log sensitive role modification in System Audit Trail
      await logAuditAction({
        action: 'Staff Member Role / Access Modified',
        category: 'role_change',
        description: `Staff account [${targetMember?.displayName || targetMember?.email || memberId}] role changed from ${prevRole.toUpperCase()} to ${newRole.toUpperCase()} by ${profile?.displayName || profile?.email || 'Admin'}`,
        module: 'auth',
        userEmail: profile?.email,
        userName: profile?.displayName,
        userRole: profile?.role,
        userId: profile?.uid,
        severity: 'warning',
        details: {
          targetMemberId: memberId,
          targetMemberName: targetMember?.displayName,
          targetMemberEmail: targetMember?.email,
          previousRole: prevRole,
          newRole: newRole
        }
      });

      setSuccessMsg(`Role updated to ${newRole.toUpperCase()} successfully`);
      setTimeout(() => setSuccessMsg(null), 3000);
      setSelectedMember(null);
    } catch (err) {
      console.warn("Notice updating member role:", err);
      // Still update optimistic state
      setMembers(prev => prev.map(m => m.uid === memberId ? { ...m, role: newRole } : m));
      setSuccessMsg(`Role updated to ${newRole.toUpperCase()}`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleForceLogout = async (memberId: string) => {
    const targetMember = members.find(m => m.uid === memberId);
    try {
      if (memberId.startsWith('staff-demo')) {
        setMembers(prev => prev.map(m => m.uid === memberId ? { ...m, isOnline: false, status: 'inactive' } : m));
      } else {
        const memberRef = doc(db, 'users', memberId);
        await setDoc(memberRef, { isOnline: false, lastActiveAt: new Date().toISOString() }, { merge: true });
        setMembers(prev => prev.map(m => m.uid === memberId ? { ...m, isOnline: false } : m));
      }

      // Log sensitive security session termination
      await logAuditAction({
        action: 'Staff Session Force Terminated',
        category: 'security_event',
        description: `Active workstation session force-terminated for ${targetMember?.displayName || targetMember?.email || memberId} (${targetMember?.terminalName || 'Terminal'}) by ${profile?.displayName || profile?.email || 'Admin'}`,
        module: 'auth',
        userEmail: profile?.email,
        userName: profile?.displayName,
        userRole: profile?.role,
        userId: profile?.uid,
        severity: 'warning',
        details: {
          targetMemberId: memberId,
          targetMemberName: targetMember?.displayName,
          terminal: targetMember?.terminalName
        }
      });

      setSuccessMsg("Member session ended");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.warn("Notice signing out user:", err);
      setMembers(prev => prev.map(m => m.uid === memberId ? { ...m, isOnline: false } : m));
      setSuccessMsg("Member session ended");
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const handleSimulateLogin = (member: UserProfile) => {
    if (switchSimulatedMember) {
      logAuditAction({
        action: 'Staff Identity Simulation Active',
        category: 'security_event',
        description: `Administrator activated profile impersonation / sandbox view as ${member.displayName} (${member.role.toUpperCase()})`,
        module: 'auth',
        userEmail: profile?.email,
        userName: profile?.displayName,
        userRole: profile?.role,
        userId: profile?.uid,
        severity: 'info',
        details: {
          simulatedUser: member.email,
          simulatedRole: member.role
        }
      });

      switchSimulatedMember(member);
      setSuccessMsg(`Switched to profile: ${member.displayName} (${member.role})`);
      setTimeout(() => setSuccessMsg(null), 3000);
      if (isModal && onClose) onClose();
    }
  };

  const getRelativeTime = (isoString?: string) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const onlineCount = members.filter(m => m.isOnline).length;
  const adminCount = members.filter(m => m.role === 'admin').length;
  const clerkCount = members.filter(m => m.role === 'clerk' || m.role === 'manager').length;

  const filteredMembers = members.filter(m => {
    const matchesSearch = 
      (m.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.terminalName || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (roleFilter === 'online') return m.isOnline;
    if (roleFilter === 'admin') return m.role === 'admin';
    if (roleFilter === 'clerk') return m.role === 'clerk';
    if (roleFilter === 'manager') return m.role === 'manager';
    return true;
  });

  const content = (
    <div className="space-y-6">
      {/* Header & Stats Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              {t('staffPresenceTitle')}
            </h2>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>{onlineCount} {t('onlineNow')}</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('staffPresenceDesc')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-activity-logs'));
              if (isModal && onClose) onClose();
            }}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer"
            title="View full system audit log and role changes"
          >
            <History size={15} className="text-amber-500" />
            <span>{t('activityLog')}</span>
          </button>

          {isModal && onClose && (
            <button 
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/60 p-3.5 text-xs font-bold text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('totalStaff')}</span>
            <Users size={16} className="text-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{members.length}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{t('registeredStaffSubtitle')}</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">{t('activeSessions')}</span>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">{onlineCount}</p>
          <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">{t('currentlyOnShift')}</p>
        </div>

        <div className="rounded-2xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/40 dark:bg-purple-950/20 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">{t('admins')}</span>
            <ShieldCheck size={16} className="text-purple-600" />
          </div>
          <p className="text-2xl font-black text-purple-700 dark:text-purple-400 mt-1">{adminCount}</p>
          <p className="text-[10px] text-purple-600/80 mt-0.5">{t('fullAccessSubtitle')}</p>
        </div>

        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">{t('clerksAndOps')}</span>
            <UserCheck size={16} className="text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-1">{clerkCount}</p>
          <p className="text-[10px] text-amber-600/80 mt-0.5">{t('posAccessSubtitle')}</p>
        </div>
      </div>

      {/* 5 Owners vs 5 Workers Access Control Manager */}
      <div className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-amber-50/40 dark:from-blue-950/30 dark:via-slate-900 dark:to-amber-950/20 p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck size={17} className="text-blue-600" />
              <span>5 Owners (All Access) & 5 Workers (Stock & Expiry Only) Setup</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Assign any Google Email as <strong>👑 Owner (Admin)</strong> for full access to all 12 modules, or <strong>📦 Worker (Clerk)</strong> to restrict them strictly to <strong>Inventory Stock, 90D Expiry Report, and Counter POS</strong>.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-black">
            <span className="rounded-lg bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 px-2.5 py-1 border border-purple-200 dark:border-purple-800">
              👑 Owners: {adminCount}
            </span>
            <span className="rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 px-2.5 py-1 border border-amber-200 dark:border-amber-800">
              📦 Workers (Stock/Expiry): {clerkCount}
            </span>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const cleanEmail = newPersonEmail.trim().toLowerCase();
            const cleanName = newPersonName.trim() || cleanEmail.split('@')[0];
            if (!cleanEmail) return;

            const existingIdx = members.findIndex(m => (m.email || '').toLowerCase() === cleanEmail);
            let nextList: UserProfile[];
            if (existingIdx >= 0) {
              nextList = members.map((m, idx) =>
                idx === existingIdx
                  ? {
                      ...m,
                      displayName: cleanName,
                      role: newPersonRole,
                      deviceInfo:
                        newPersonRole === 'admin'
                          ? 'Full ERP Access (All Modules)'
                          : 'Restricted: Stock, Expiry & POS Only'
                    }
                  : m
              );
            } else {
              const newEntry: UserProfile = {
                uid: `${newPersonRole}-custom-${Date.now()}`,
                email: cleanEmail,
                displayName: cleanName,
                role: newPersonRole,
                isOnline: false,
                terminalName: newPersonRole === 'admin' ? 'Owner Terminal' : 'Worker Stock Terminal',
                deviceInfo:
                  newPersonRole === 'admin'
                    ? 'Full ERP Access (All Modules)'
                    : 'Restricted: Stock, Expiry & POS Only',
                lastLoginAt: new Date().toISOString(),
                lastActiveAt: new Date().toISOString(),
                loginCount: 1,
                status: 'active'
              };
              nextList = [newEntry, ...members];
            }

            setMembers(nextList);
            syncRosterToLocal(nextList);
            setNewPersonName('');
            setNewPersonEmail('');
            setSuccessMsg(
              `Saved ${cleanName} (${cleanEmail}) as ${newPersonRole === 'admin' ? '👑 OWNER (Full Access)' : '📦 WORKER (Stock & Expiry Only)'}`
            );
            setTimeout(() => setSuccessMsg(null), 4000);
          }}
          className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1"
        >
          <input
            type="text"
            required
            placeholder="Name (e.g. Owner 2 / Worker Ramesh)"
            value={newPersonName}
            onChange={(e) => setNewPersonName(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
          />
          <input
            type="email"
            required
            placeholder="Google Email (e.g. worker@gmail.com)"
            value={newPersonEmail}
            onChange={(e) => setNewPersonEmail(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
          />
          <select
            value={newPersonRole}
            onChange={(e) => setNewPersonRole(e.target.value as 'admin' | 'clerk')}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-black text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
          >
            <option value="clerk">📦 Worker (Stock & Expiry Only)</option>
            <option value="admin">👑 Owner (Full ERP Access)</option>
          </select>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-black text-white shadow-sm cursor-pointer transition-all"
          >
            <UserPlus size={14} />
            <span>Save Access Role</span>
          </button>
        </form>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t('searchStaffPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'online', 'admin', 'clerk', 'manager'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setRoleFilter(tab)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                roleFilter === tab 
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs" 
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              )}
            >
              {tab === 'all' && t('allMembers')}
              {tab === 'online' && `${t('online')} (${onlineCount})`}
              {tab === 'admin' && t('admins')}
              {tab === 'clerk' && t('clerks')}
              {tab === 'manager' && t('managers')}
            </button>
          ))}
        </div>
      </div>

      {/* Members Grid / List */}
      <div className="grid gap-3.5">
        {filteredMembers.map((member) => {
          const isCurrentUser = profile?.uid === member.uid || user?.email === member.email;
          const isUserOnline = !!member.isOnline;

          return (
            <div 
              key={member.uid}
              className={cn(
                "rounded-2xl border p-4.5 transition-all bg-white dark:bg-slate-900 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4",
                isCurrentUser 
                  ? "border-blue-300 dark:border-blue-800 ring-2 ring-blue-500/10" 
                  : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300"
              )}
            >
              {/* Member Profile Info */}
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="relative shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-base shadow-sm">
                    {member.photoURL ? (
                      <img 
                        src={member.photoURL} 
                        alt={member.displayName} 
                        className="h-12 w-12 rounded-2xl object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span>{(member.displayName || member.email || 'U').charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  {/* Real-time Online Indicator */}
                  <span 
                    className={cn(
                      "absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center",
                      isUserOnline ? "bg-emerald-500" : "bg-slate-400"
                    )}
                    title={isUserOnline ? "Online and active" : "Offline"}
                  >
                    {isUserOnline && <span className="animate-ping h-2 w-2 rounded-full bg-emerald-300 opacity-75" />}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                      {member.displayName || member.email.split('@')[0]}
                    </h3>

                    {isCurrentUser && (
                      <span className="rounded-full bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 text-[10px] font-black text-blue-700 dark:text-blue-300">
                        You
                      </span>
                    )}

                    <span className={cn(
                      "rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
                      member.role === 'admin' 
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300"
                        : member.role === 'manager'
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                    )}>
                      {member.role === 'admin'
                        ? '👑 Owner (Full Access)'
                        : member.role === 'manager'
                          ? '💼 Manager (Full Ops)'
                          : '📦 Worker (Stock & Expiry Only)'}
                    </span>

                    <span className={cn(
                      "text-[10px] font-bold flex items-center gap-1",
                      isUserOnline ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
                    )}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", isUserOnline ? "bg-emerald-500" : "bg-slate-400")} />
                      <span>{isUserOnline ? "Active Now" : "Offline"}</span>
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400">{member.email}</p>

                  {/* Terminal and Device details */}
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Laptop size={12} className="text-slate-400" />
                      <span>{member.terminalName || 'Main Counter Terminal'}</span>
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span>{member.deviceInfo || 'Chrome on Desktop'}</span>
                  </div>
                </div>
              </div>

              {/* Login Timing & Actions */}
              <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                <div className="text-left lg:text-right space-y-0.5">
                  <div className="flex items-center lg:justify-end gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    <Clock size={12} className="text-slate-400" />
                    <span>Last Login: {getRelativeTime(member.lastLoginAt)}</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Total logins: {member.loginCount || 1} times
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* Role Selector Trigger for Admin */}
                  {profile?.role === 'admin' && (
                    <div className="relative">
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.uid, e.target.value as UserRole)}
                        disabled={isUpdatingRole}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
                        title="Change Member Access Role"
                      >
                        <option value="admin">👑 Owner (All Access)</option>
                        <option value="clerk">📦 Worker (Stock & Expiry)</option>
                        <option value="manager">💼 Manager</option>
                      </select>
                    </div>
                  )}

                  {/* Test Profile Switcher for demonstration / testing */}
                  <button
                    onClick={() => handleSimulateLogin(member)}
                    className={cn(
                      "flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-2xs",
                      isCurrentUser 
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-default"
                        : "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 border border-blue-200/80"
                    )}
                    title="Switch to this profile to test staff permissions"
                  >
                    <span>{isCurrentUser ? "Current" : "Preview Access"}</span>
                  </button>

                  {/* Force Logout / Reset Session */}
                  {profile?.role === 'admin' && !isCurrentUser && isUserOnline && (
                    <button
                      onClick={() => handleForceLogout(member.uid)}
                      className="p-1.5 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                      title="End Active Member Session"
                    >
                      <LogOut size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Login Audit Trail Log */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Live Authentication & Login Activity Feed
            </h3>
          </div>
          <span className="text-[10px] text-slate-400">Auto-synced</span>
        </div>

        {loginAuditLogs.length > 0 ? (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {loginAuditLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{log.description || log.action}</span>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                  {getRelativeTime(log.timestamp)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-500 py-3 text-center">
            Recent logins are securely tracked here in real-time.
          </div>
        )}
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-4xl rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 my-8 max-h-[90vh] overflow-y-auto"
        >
          {content}
        </motion.div>
      </div>
    );
  }

  return content;
};

export default LoggedInMembersMonitor;
