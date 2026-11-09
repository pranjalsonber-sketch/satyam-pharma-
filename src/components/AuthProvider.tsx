import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, setDoc, onSnapshot, collection, addDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile } from '../types';
import { getDeviceInfo, getTerminalName } from '../lib/deviceUtils';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  switchSimulatedMember?: (member: UserProfile) => void;
  exitSimulation?: () => void;
  isSimulated?: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function resolveRoleByEmail(email?: string | null, uid?: string): 'admin' | 'manager' | 'clerk' {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (cleanEmail === 'pranjalsonber@gmail.com') return 'admin';

  try {
    const rawRoster = localStorage.getItem('satyam_authorized_roster_v1');
    if (rawRoster) {
      const parsed: UserProfile[] = JSON.parse(rawRoster);
      const matched = parsed.find(m => (m.email || '').trim().toLowerCase() === cleanEmail);
      if (matched && matched.role) {
        return matched.role;
      }
    }
  } catch (e) {}

  if (uid) {
    const cached = localStorage.getItem(`satyam_user_role_${uid}`) as any;
    if (cached === 'admin' || cached === 'manager' || cached === 'clerk') {
      return cached;
    }
  }

  // Default any unrecognized worker login to 'clerk' (Stock & Expiry access only)
  // while known owners get 'admin'
  return cleanEmail === 'pranjalsonber@gmail.com' ? 'admin' : 'clerk';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [realOwnerProfile, setRealOwnerProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSimulated, setIsSimulated] = useState(false);

  useEffect(() => {
    let unsubProfileSnapshot: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (unsubProfileSnapshot) {
        unsubProfileSnapshot();
        unsubProfileSnapshot = null;
      }

      if (currentUser) {
        const deviceInfo = getDeviceInfo();
        const terminalName = getTerminalName();
        const nowIso = new Date().toISOString();

        // Check roster & local storage for cached role/profile
        const resolvedRole = resolveRoleByEmail(currentUser.email, currentUser.uid);

        const initialProfile: UserProfile = {
          uid: currentUser.uid,
          email: currentUser.email || '',
          displayName: currentUser.displayName || (currentUser.email?.split('@')[0] ?? 'Staff Member'),
          photoURL: currentUser.photoURL || '',
          role: resolvedRole,
          lastLoginAt: nowIso,
          lastActiveAt: nowIso,
          isOnline: true,
          deviceInfo,
          terminalName,
          loginCount: 1,
          status: 'active',
        };

        // Immediately set profile so UI is never blocked by network/offline issues
        setRealOwnerProfile(initialProfile);
        if (!isSimulated) {
          setProfile(initialProfile);
        }
        setLoading(false);

        // Asynchronously sync profile to Firestore & listen for real-time changes
        try {
          const docRef = doc(db, 'users', currentUser.uid);

          // Listen for profile changes in Firestore
          unsubProfileSnapshot = onSnapshot(
            docRef,
            (snap) => {
              if (snap.exists() && !isSimulated) {
                const data = snap.data() as UserProfile;
                const finalRole = currentUser.email === 'pranjalsonber@gmail.com' ? 'admin' : (data.role || resolvedRole);
                const merged = {
                  ...(initialProfile),
                  ...data,
                  role: finalRole,
                  isOnline: true,
                };
                setRealOwnerProfile(merged);
                setProfile(merged);
                if (finalRole) {
                  localStorage.setItem(`satyam_user_role_${currentUser.uid}`, finalRole);
                }
              }
            },
            (error) => {
              // Silently handle offline notice without crashing
              console.warn("Firestore profile snapshot sync (offline mode):", error.message);
            }
          );

          // Non-blocking write to Firestore
          const profilePayload: Partial<UserProfile> = {
            uid: currentUser.uid,
            email: currentUser.email || '',
            displayName: currentUser.displayName || (currentUser.email?.split('@')[0] ?? 'Staff Member'),
            photoURL: currentUser.photoURL || '',
            role: resolvedRole,
            lastLoginAt: nowIso,
            lastActiveAt: nowIso,
            isOnline: true,
            deviceInfo,
            terminalName,
            status: 'active',
          };

          setDoc(docRef, profilePayload, { merge: true }).catch((err) => {
            console.warn("Firestore profile write postponed (offline mode):", err.message);
          });

          // Non-blocking audit log
          addDoc(collection(db, 'audit_logs'), {
            action: 'USER_LOGIN',
            description: `${currentUser.displayName || currentUser.email} logged into ${terminalName} (${deviceInfo})`,
            timestamp: nowIso,
            userEmail: currentUser.email || 'unknown',
            type: 'system',
          }).catch(() => {
            // Ignore audit log error if offline
          });

        } catch (err) {
          console.warn("Firestore initialization caught:", err);
        }
      } else {
        setProfile(null);
        setRealOwnerProfile(null);
        setLoading(false);
      }
    });

    // Heartbeat & Online Presence
    const heartbeatInterval = setInterval(() => {
      if (auth.currentUser && !isSimulated) {
        try {
          const docRef = doc(db, 'users', auth.currentUser.uid);
          setDoc(
            docRef,
            {
              lastActiveAt: new Date().toISOString(),
              isOnline: true,
            },
            { merge: true }
          ).catch(() => {});
        } catch (e) {}
      }
    }, 45000);

    // Set offline on unload
    const handleBeforeUnload = () => {
      if (auth.currentUser) {
        try {
          const docRef = doc(db, 'users', auth.currentUser.uid);
          setDoc(
            docRef,
            {
              isOnline: false,
              lastActiveAt: new Date().toISOString(),
            },
            { merge: true }
          ).catch(() => {});
        } catch (e) {}
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsubscribe();
      if (unsubProfileSnapshot) unsubProfileSnapshot();
      clearInterval(heartbeatInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isSimulated]);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    if (auth.currentUser) {
      try {
        const docRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(
          docRef,
          {
            isOnline: false,
            lastActiveAt: new Date().toISOString(),
          },
          { merge: true }
        ).catch(() => {});
      } catch (e) {}
    }
    setIsSimulated(false);
    await signOut(auth);
  };

  const switchSimulatedMember = (member: UserProfile) => {
    setProfile(member);
    setIsSimulated(true);
  };

  const exitSimulation = () => {
    setIsSimulated(false);
    if (realOwnerProfile) {
      setProfile(realOwnerProfile);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, switchSimulatedMember, exitSimulation, isSimulated }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
