import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithPopup,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  updateProfile,
  signOut, 
  onAuthStateChanged,
  sendEmailVerification,
  signInAnonymously
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { UserProfile, UserNotificationPreferences } from '../types';
import { customFetch } from '../api';
import { reportSyncStatus, withRetry } from '../utils/retry';
import { executeRecaptcha } from '../utils/recaptcha';
import type { PaymentReceipt } from '../utils/cashfree';

const ADMIN_EMAIL = 'dahiyarahul023@gmail.com';
const STORAGE_SESSION_KEY = 'bse_nexus_auth_session';

const defaultNotificationPreferences: UserNotificationPreferences = {
  resultsAndEarnings: true,
  orderWinsAndExpansion: true,
  dividendsAndBonus: true,
  acquisitionsAndMergers: true,
  creditRatings: true,
  muteRoutineFilings: true,
  stocksHighPriority: true,
  stocksMediumPriority: true,
  stocksLowPriority: false,
  concallsAndInvestorMeets: true,
  boardMeetingsAndOutcomes: true,
  insiderTradingAndSAST: false,
  creditRatingChanges: true,
  annualReportsAndAudits: false,
  telegramAlertsEnabled: true,
  telegramAiSummaryEnabled: true,
  telegramAlertScope: 'WATCHLIST_ONLY',
  alertPriority: 'HIGH_ONLY',
  alertScope: 'WATCHLIST_ONLY',
  alertCategory: 'RESULTS_ONLY',
};

export interface UpdateTelegramOptions {
  chatId?: string | null;
  username?: string | null;
  alertsEnabled?: boolean;
  aiSummaryEnabled?: boolean;
  alertScope?: 'WATCHLIST_ONLY' | 'ALL_MARKET';
  unlink?: boolean;
}

export interface UpdateProfileParams {
  displayName?: string;
  username?: string;
  telegramUsername?: string;
}

export interface ProfileUpdateResult {
  success: boolean;
  error?: string;
  suggestion?: string;
  profile?: UserProfile;
}

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  authLoading: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isPro: boolean;
  proDaysLeft: number;
  adminUnlocked: boolean;
  loginWithGoogle: (forceRedirect?: boolean) => Promise<{ 
    success: boolean; 
    error?: string; 
    code?: string; 
    domain?: string; 
    isIframeBlocked?: boolean 
  }>;
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  signupWithEmail: (email: string, pass: string, name: string, username?: string) => Promise<{ success: boolean; error?: string; needsEmailVerification?: boolean }>;
  quickDemoLogin: (role?: 'user' | 'admin') => Promise<{ success: boolean; error?: string }>;
  loginWithAdminPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  verifyAdminPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  lockAdminSession: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfileInfo: (displayNameOrObj: string | UpdateProfileParams, usernameOrTg?: string, telegramUsername?: string) => Promise<ProfileUpdateResult>;
  checkUsernameAvailability: (username: string) => Promise<{ available: boolean; cleanUsername: string; reason?: string; suggestion?: string }>;
  updateNotificationPreferences: (prefs: Partial<UserNotificationPreferences>) => Promise<boolean>;
  updateTelegramChatId: (chatId: string, username?: string) => Promise<boolean>;
  updateTelegramPreferences: (options: UpdateTelegramOptions) => Promise<boolean>;
  upgradeToPro: (plan?: string) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  isProModalOpen: boolean;
  setIsProModalOpen: (open: boolean) => void;
  isCheckoutOpen: boolean;
  setIsCheckoutOpen: (open: boolean) => void;
  receipt: PaymentReceipt | null;
  setReceipt: (r: PaymentReceipt | null) => void;
  isAdminPinModalOpen: boolean;
  setIsAdminPinModalOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// In-flight concurrency lock for anonymous guest sessions to prevent duplicate calls
let inFlightGuestLoginPromise: Promise<{ success: boolean; error?: string }> | null = null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Read cached session synchronously to allow instant First Contentful Paint without blocking visitors
  // STRICT: Guest/anonymous sessions are NEVER cached or auto-restored
  const getCachedSession = () => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_SESSION_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          const isGuest = !parsed?.user || 
            Boolean(
              parsed.user.isAnonymous ||
              !parsed.user.email ||
              parsed.user.email.endsWith('@bse-trader.local') ||
              parsed.user.uid?.startsWith('guest_') ||
              parsed.user.uid?.startsWith('trader_')
            );
          
          if (isGuest) {
            localStorage.removeItem(STORAGE_SESSION_KEY);
            localStorage.removeItem('bse_nexus_fb_id_token');
            return { user: null, profile: null };
          }

          if (parsed?.user) {
            return { user: parsed.user, profile: parsed.profile || null };
          }
        }
      }
    } catch {}
    return { user: null, profile: null };
  };

  const cached = getCachedSession();
  const [user, setUser] = useState<any | null>(cached.user);
  const [profile, setProfile] = useState<UserProfile | null>(cached.profile);
  const [loading, setLoading] = useState(!cached.user);
  const [authLoading, setAuthLoading] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProModalOpen, setIsProModalOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [isAdminPinModalOpen, setIsAdminPinModalOpen] = useState(false);

  // Helper to persist sanitized session locally for UI convenience (never stores credentials/tokens)
  // STRICT: Guest/anonymous sessions are NEVER saved in localStorage
  const saveLocalSession = (u: any, p: UserProfile) => {
    try {
      if (!u) {
        localStorage.removeItem(STORAGE_SESSION_KEY);
        return;
      }
      const isGuest = Boolean(
        u.isAnonymous ||
        !u.email ||
        u.email.endsWith('@bse-trader.local') ||
        u.uid?.startsWith('guest_') ||
        u.uid?.startsWith('trader_')
      );
      if (isGuest) {
        localStorage.removeItem(STORAGE_SESSION_KEY);
        return;
      }
      const sanitizedUser = {
        uid: u.uid,
        email: u.email || null,
        displayName: u.displayName || null,
        photoURL: u.photoURL || null,
        isAnonymous: false
      };
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify({ user: sanitizedUser, profile: p }));
    } catch (e) {
      console.warn('Could not save auth session locally', e);
    }
  };

  // Sync profile strictly through backend APIs backed by Admin SDK
  const syncUserProfile = async (firebaseUser: any) => {
    if (!firebaseUser || !firebaseUser.uid) {
      return null;
    }

    try {
      const uid = firebaseUser.uid;
      const isEmailAdmin = firebaseUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      const savedLocalUsername = typeof window !== 'undefined' ? localStorage.getItem(`bse_user_handle_${uid}`) : null;
      const savedLocalTgChatId = typeof window !== 'undefined' ? localStorage.getItem(`bse_user_tg_chat_id_${uid}`) : null;
      const savedLocalTgUsername = typeof window !== 'undefined' ? localStorage.getItem(`bse_user_tg_username_${uid}`) : null;
      const emailPrefix = firebaseUser.email ? firebaseUser.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() : 'trader';
      
      const isGuestUser = Boolean(
        firebaseUser.isAnonymous ||
        !firebaseUser.email ||
        firebaseUser.email.endsWith('@bse-trader.local') ||
        uid.startsWith('guest_') ||
        uid.startsWith('trader_')
      );

      const isOwnerAccount = Boolean(
        firebaseUser.email && firebaseUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
      );

      // Extract fresh Firebase ID token (no force) and sync session with backend for authenticated users
      let idToken = '';
      if (!isGuestUser && typeof firebaseUser.getIdToken === 'function') {
        try {
          const rawToken = await firebaseUser.getIdToken(false);
          if (rawToken && rawToken.split('.').length === 3) {
            idToken = rawToken;
            localStorage.setItem('bse_nexus_fb_id_token', idToken);
          } else {
            localStorage.removeItem('bse_nexus_fb_id_token');
          }
        } catch (tokErr) {
          console.warn('Could not get idToken from Firebase User:', tokErr);
        }
      }

      if (idToken && idToken.split('.').length === 3) {
        try {
          await customFetch('/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idToken: idToken,
              uid: uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || 'Trader'
            })
          });
        } catch (sessionErr) {
          console.warn('Backend session exchange error:', sessionErr);
        }
      }

      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      const now = Date.now();

      let userProfile: UserProfile | null = null;
      try {
        const res = await customFetch('/api/users/profile');
        if (res.ok) {
          const data = await res.json();
          if (data && data.profile) {
            const rawFirestoreUsername = typeof data.profile.username === 'string' ? data.profile.username.trim().replace(/^@/, '') : '';
            const resolvedUsername = rawFirestoreUsername || savedLocalUsername || data.profile.telegramUsername?.replace(/^@/, '') || emailPrefix;
            
            if (typeof window !== 'undefined' && resolvedUsername) {
              localStorage.setItem(`bse_user_handle_${uid}`, resolvedUsername);
            }

            // Determine Pro status and 1-week (7-day) trial expiry
            let proExpiresAt = 0;
            let resolvedTier: 'free' | 'pro' | 'admin' = 'free';

            if (isOwnerAccount) {
              resolvedTier = 'admin';
              proExpiresAt = now + 365 * 24 * 60 * 60 * 1000;
            } else if (!isGuestUser) {
              // Real authenticated user (Google / Email)
              if (data.profile.proExpiresAt) {
                proExpiresAt = data.profile.proExpiresAt;
              } else {
                // Initialize 1-week (7-day) Pro trial for new authenticated users
                const storedTrial = typeof window !== 'undefined' ? localStorage.getItem(`bse_pro_expires_${uid}`) : null;
                proExpiresAt = storedTrial ? parseInt(storedTrial, 10) : (now + SEVEN_DAYS_MS);
                if (typeof window !== 'undefined') {
                  localStorage.setItem(`bse_pro_expires_${uid}`, String(proExpiresAt));
                }
              }
              const isTrialActive = proExpiresAt > now;
              resolvedTier = isTrialActive ? 'pro' : 'free';
            } else {
              // Guest user: strictly free, 0 trial
              resolvedTier = 'free';
              proExpiresAt = 0;
            }

            userProfile = {
              uid: uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || data.profile.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'Trader'),
              username: resolvedUsername,
              photoURL: firebaseUser.photoURL || data.profile.photoURL || null,
              tier: resolvedTier,
              proExpiresAt: proExpiresAt,
              telegramChatId: data.profile.telegramChatId || savedLocalTgChatId || null,
              telegramUsername: data.profile.telegramUsername || savedLocalTgUsername || null,
              notificationPreferences: {
                ...defaultNotificationPreferences,
                ...(data.profile.notificationPreferences || {})
              },
              createdAt: data.profile.createdAt || now,
              lastLoginAt: now,
              maxWatchlistStocks: resolvedTier === 'pro' || resolvedTier === 'admin' ? 9999 : 5
            };
          }
        }
      } catch (profileErr) {
        console.warn('Backend profile fetch notice:', profileErr);
      }

      if (!userProfile) {
        const resolvedUsername = savedLocalUsername || emailPrefix;
        if (typeof window !== 'undefined' && resolvedUsername) {
          localStorage.setItem(`bse_user_handle_${uid}`, resolvedUsername);
        }

        let proExpiresAt = 0;
        let resolvedTier: 'free' | 'pro' | 'admin' = 'free';

        if (isOwnerAccount) {
          resolvedTier = 'admin';
          proExpiresAt = now + 365 * 24 * 60 * 60 * 1000;
        } else if (!isGuestUser) {
          const storedTrial = typeof window !== 'undefined' ? localStorage.getItem(`bse_pro_expires_${uid}`) : null;
          proExpiresAt = storedTrial ? parseInt(storedTrial, 10) : (now + SEVEN_DAYS_MS);
          if (typeof window !== 'undefined') {
            localStorage.setItem(`bse_pro_expires_${uid}`, String(proExpiresAt));
          }
          resolvedTier = proExpiresAt > now ? 'pro' : 'free';
        } else {
          resolvedTier = 'free';
          proExpiresAt = 0;
        }

        userProfile = {
          uid: uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'Trader'),
          username: resolvedUsername,
          photoURL: firebaseUser.photoURL || null,
          tier: resolvedTier,
          proExpiresAt: proExpiresAt,
          telegramChatId: savedLocalTgChatId || null,
          telegramUsername: savedLocalTgUsername || null,
          notificationPreferences: defaultNotificationPreferences,
          createdAt: now,
          lastLoginAt: now,
          maxWatchlistStocks: resolvedTier === 'pro' || resolvedTier === 'admin' ? 9999 : 5
        };

        try {
          await customFetch('/api/users/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userProfile)
          });
        } catch (saveErr) {
          console.warn('Backend user profile save notice:', saveErr);
        }
      }

      setUser(firebaseUser);
      setProfile(userProfile);
      saveLocalSession(firebaseUser, userProfile);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { uid, user: firebaseUser, profile: userProfile } }));
      }

      return userProfile;
    } catch (e: any) {
      console.warn("User profile sync error:", e.message);
      return null;
    }
  };

  useEffect(() => {
    // Authoritative source of truth: Firebase onAuthStateChanged with saved local fallback
    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser) {
          // If currentUser is anonymous or guest:
          // Check if the user explicitly clicked guest login in this active browser session
          const hasActiveGuestSession = typeof window !== 'undefined' && sessionStorage.getItem('bse_guest_active_session') === 'true';
          if (currentUser.isAnonymous && !hasActiveGuestSession) {
            // Stale anonymous user persisted in browser cache/IndexedDB from previous visit.
            // Sign out immediately so returning users see the clean landing page!
            try {
              await signOut(auth);
            } catch {}
            try {
              localStorage.removeItem(STORAGE_SESSION_KEY);
              localStorage.removeItem('bse_nexus_fb_id_token');
            } catch {}
            setUser(null);
            setProfile(null);
            setAdminUnlocked(false);
            setLoading(false);
            setAuthLoading(false);
            return;
          }

          try {
            await syncUserProfile(currentUser);
          } catch (err) {
            console.warn('Could not sync user profile:', err);
          }
        } else {
          try {
            const saved = localStorage.getItem(STORAGE_SESSION_KEY);
            if (saved) {
              const parsed = JSON.parse(saved);
              const isRealUser = parsed?.user && 
                !parsed.user.isAnonymous && 
                parsed.user.email && 
                !parsed.user.email.endsWith('@bse-trader.local') &&
                !parsed.user.uid?.startsWith('guest_') && 
                !parsed.user.uid?.startsWith('trader_');

              if (isRealUser && parsed?.profile) {
                setUser(parsed.user);
                setProfile(parsed.profile);
              } else {
                localStorage.removeItem(STORAGE_SESSION_KEY);
                setUser(null);
                setProfile(null);
                setAdminUnlocked(false);
              }
            } else {
              setUser(null);
              setProfile(null);
              setAdminUnlocked(false);
            }
          } catch {
            setUser(null);
            setProfile(null);
            setAdminUnlocked(false);
          }
        }
        setLoading(false);
        setAuthLoading(false);
      });
    } catch (authErr) {
      console.warn('Auth observer initialization warning:', authErr);
      try {
        const saved = localStorage.getItem(STORAGE_SESSION_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          const isRealUser = parsed?.user && 
            !parsed.user.isAnonymous && 
            parsed.user.email && 
            !parsed.user.email.endsWith('@bse-trader.local') &&
            !parsed.user.uid?.startsWith('guest_') && 
            !parsed.user.uid?.startsWith('trader_');

          if (isRealUser && parsed?.profile) {
            setUser(parsed.user);
            setProfile(parsed.profile);
          } else {
            localStorage.removeItem(STORAGE_SESSION_KEY);
            setUser(null);
            setProfile(null);
          }
        }
      } catch {}
      setLoading(false);
      setAuthLoading(false);
    }

    // Check backend status for active admin session
    customFetch('/auth/status')
      .then(res => res.json())
      .then(data => {
        if (data.isAuthenticated && data.isAdmin) {
          setAdminUnlocked(true);
        }
      })
      .catch(() => {});

    return () => {
      try {
        unsubscribe();
      } catch {}
    };
  }, []);

  // Google Sign-In with standard rock-solid popup authentication across Desktop & Mobile
  const loginWithGoogle = async () => {
    const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'current domain';

    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result && result.user) {
        await syncUserProfile(result.user);
        setIsAuthModalOpen(false);
        if (result.user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          setAdminUnlocked(true);
        }
        return { success: true };
      }
      return { success: false, error: 'Google sign-in was cancelled.' };
    } catch (error: any) {
      console.warn('Google Sign In Error:', error?.code || error?.message, error);

      if (error?.code === 'auth/unauthorized-domain') {
        return { 
          success: false, 
          code: 'auth/unauthorized-domain',
          domain: currentHost,
          error: `Domain "${currentHost}" is not added to Firebase Authorized Domains. In Firebase Console > Authentication > Settings > Authorized Domains, please add "${currentHost}".` 
        };
      }
      if (
        error?.code === 'auth/popup-closed-by-user' || 
        error?.code === 'auth/cancelled-popup-request' ||
        error?.message?.includes('Pending promise was never set')
      ) {
        return { 
          success: false, 
          code: error?.code || 'auth/popup-closed-by-user',
          error: 'Google sign-in window was closed. Please click "Sign in with Google" to try again.' 
        };
      }
      if (error?.code === 'auth/popup-blocked') {
        return { 
          success: false, 
          code: 'auth/popup-blocked',
          isIframeBlocked: isInIframe,
          error: isInIframe 
            ? 'Popup was blocked by your browser or the preview frame. Please open the app in a new tab to complete Google sign-in.'
            : 'Popup was blocked by your browser. Please allow popups for this site (click the popup icon in your browser address bar) and try again.' 
        };
      }
      if (isInIframe && (error?.code === 'auth/internal-error' || error?.code === 'auth/network-request-failed')) {
        return {
          success: false,
          code: error?.code,
          isIframeBlocked: true,
          error: 'Browser security prevented sign-in inside the preview frame. Please open the app in a new tab to complete Google sign-in.'
        };
      }
      return { 
        success: false, 
        code: error?.code,
        error: error?.message || 'Google sign-in encountered an error. Please try again.' 
      };
    }
  };

  // Instant Trader Access: Real persistent Firebase anonymous auth with session reuse, in-flight lock, and idempotency
  const quickDemoLogin = async (customName?: string): Promise<{ success: boolean; error?: string }> => {
    // 1. In-flight concurrency lock: return existing pending promise if user clicks multiple times
    if (inFlightGuestLoginPromise) {
      return inFlightGuestLoginPromise;
    }

    const runGuestLogin = async (): Promise<{ success: boolean; error?: string }> => {
      try {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('bse_guest_active_session', 'true');
        }
        const traderName = (typeof customName === 'string' && customName.trim()) ? customName.trim() : 'Pro Trader';

        // 2. Idempotent check: If already authenticated as an anonymous guest in current state, reuse session
        if (user && user.isAnonymous) {
          setIsAuthModalOpen(false);
          return { success: true };
        }

        let firebaseUser: any = null;

        // 3. Existing anonymous user reuse: Re-use auth.currentUser if already an anonymous session
        if (auth?.currentUser && auth.currentUser.isAnonymous) {
          firebaseUser = auth.currentUser;
          if (!firebaseUser.displayName && traderName) {
            await updateProfile(firebaseUser, { displayName: traderName }).catch(() => {});
          }
        } else {
          try {
            const result = await signInAnonymously(auth);
            if (result && result.user) {
              firebaseUser = result.user;
              if (!firebaseUser.displayName && traderName) {
                await updateProfile(firebaseUser, { displayName: traderName }).catch(() => {});
              }
            }
          } catch (fbErr: any) {
            console.info('[Auth] Anonymous firebase auth note:', fbErr?.code || fbErr?.message);
            // Fallback local trader session if offline or blocked
            firebaseUser = {
              uid: 'trader_' + Math.random().toString(36).substring(2, 10),
              displayName: traderName,
              email: `${traderName.toLowerCase().replace(/\s+/g, '_')}@bse-trader.local`,
              isAnonymous: true,
              photoURL: null,
              getIdToken: async () => ''
            };
          }
        }

        if (firebaseUser) {
          await syncUserProfile(firebaseUser);
          setIsAuthModalOpen(false);
          return { success: true };
        }
        return { success: false, error: 'Could not initialize trader session.' };
      } catch (e: any) {
        console.warn('Trader access error:', e?.message || e);
        return { success: false, error: e?.message || 'Login failed' };
      } finally {
        inFlightGuestLoginPromise = null;
      }
    };

    inFlightGuestLoginPromise = runGuestLogin();
    return inFlightGuestLoginPromise;
  };

  const loginWithEmail = async (email: string, pass: string) => {
    let trimmedEmail = email.trim().toLowerCase();
    
    if (!trimmedEmail || !pass) {
      return { success: false, error: 'Please provide both email and password.' };
    }

    // Auto-resolve handle/username if user typed username without domain
    if (!trimmedEmail.includes('@')) {
      if (trimmedEmail === 'admin' || trimmedEmail === 'dahiyarahul023' || trimmedEmail === 'rahul') {
        trimmedEmail = ADMIN_EMAIL.toLowerCase();
      } else {
        trimmedEmail = `${trimmedEmail.replace(/^@/, '')}@gmail.com`;
      }
    }

    try {
      const res = await signInWithEmailAndPassword(auth, trimmedEmail, pass);
      if (res.user) {
        await syncUserProfile(res.user);
        setIsAuthModalOpen(false);
        if (trimmedEmail === ADMIN_EMAIL.toLowerCase()) {
          setIsAdminPinModalOpen(true);
        }
        return { success: true };
      }
      return { success: false, error: 'Invalid credentials. Please check your email and password.' };
    } catch (fbErr: any) {
      console.warn('Firebase email auth notice:', fbErr?.code || fbErr?.message);
      let errorMsg = 'Invalid email or password.';
      const code = fbErr?.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        // If this email is actually linked with Google sign-in (no password provider),
        // point the user to the right door instead of a dead-end password error.
        // This also prevents confusion from duplicate same-email accounts.
        try {
          const methods = await fetchSignInMethodsForEmail(auth, trimmedEmail);
          if (methods.includes('google.com') && !methods.includes('password')) {
            errorMsg = 'This email uses Google sign-in. Please use "Continue with Google" instead of a password.';
          } else if (code === 'auth/user-not-found') {
            errorMsg = 'No account found with this email. Please Sign Up first.';
          } else {
            errorMsg = 'Incorrect password. Please try again.';
          }
        } catch {
          if (code === 'auth/user-not-found') errorMsg = 'No account found with this email. Please Sign Up first.';
          else errorMsg = 'Incorrect password. Please try again.';
        }
      }
      else if (code === 'auth/invalid-email') errorMsg = 'Please enter a valid email address (e.g. name@domain.com).';
      else if (code === 'auth/too-many-requests') errorMsg = 'Too many failed attempts. Please try again in a few minutes.';
      else if (fbErr?.message) errorMsg = fbErr.message;
      return { success: false, error: errorMsg };
    }
  };

  const signupWithEmail = async (email: string, pass: string, name: string, chosenUsername?: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    const cleanUsername = (chosenUsername || trimmedEmail.split('@')[0])
      .toLowerCase()
      .replace(/^@/, '')
      .replace(/[^a-z0-9_]/g, '_');

    if (pass.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }

    try {
      // Prevent duplicate same-email accounts: if this email is already linked
      // with Google sign-in, block password-based signup and point to Google.
      // (Firebase project allows multiple accounts per email, so without this
      // check the same email gets two different UIDs = two "different accounts".)
      try {
        const existingMethods = await fetchSignInMethodsForEmail(auth, trimmedEmail);
        if (existingMethods.includes('google.com')) {
          return { success: false, error: 'This email already uses Google sign-in. Please use "Continue with Google" instead of creating a password account.' };
        }
      } catch (methodErr) {
        console.warn('Could not check existing sign-in methods:', (methodErr as any)?.code || methodErr);
        // Fall through and let Firebase return its own error if any.
      }
      const res = await createUserWithEmailAndPassword(auth, trimmedEmail, pass);
      if (res.user) {
        if (name) {
          await updateProfile(res.user, { displayName: name });
        }
        try {
          await sendEmailVerification(res.user);
        } catch (evErr) {
          console.warn('Could not send verification email:', evErr);
        }
        const p = await syncUserProfile(res.user);
        if (p && cleanUsername) {
          await updateProfileInfo({ displayName: name || p.displayName || '', username: cleanUsername });
        }
        setIsAuthModalOpen(false);
        return { success: true, needsEmailVerification: true };
      }
      return { success: false, error: 'Could not create account.' };
    } catch (fbErr: any) {
      console.warn('Firebase signup notice:', fbErr?.code || fbErr?.message);
      let errorMsg = 'Registration failed. Please try again.';
      if (fbErr?.code === 'auth/email-already-in-use') errorMsg = 'This email is already registered. Please Sign In instead.';
      else if (fbErr?.code === 'auth/weak-password') errorMsg = 'Password should be at least 6 characters.';
      else if (fbErr?.code === 'auth/invalid-email') errorMsg = 'Please enter a valid email address.';
      else if (fbErr?.message) errorMsg = fbErr.message;
      return { success: false, error: errorMsg };
    }
  };

  const loginWithAdminPin = async (pin: string) => {
    try {
      const rc = await executeRecaptcha('ADMIN_PIN');
      const res = await customFetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pin, 
          recaptchaToken: rc.token, 
          recaptchaAction: 'ADMIN_PIN' 
        })
      });
      const data = await res.json();
      if (res.ok && (data.success || data.verified)) {
        setAdminUnlocked(true);
        setIsAuthModalOpen(false);
        setIsAdminPinModalOpen(false);
        return { success: true };
      }
      return { success: false, error: data.error || 'Invalid PIN' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Connection error' };
    }
  };

  const verifyAdminPin = async (pin: string) => {
    try {
      const rc = await executeRecaptcha('ADMIN_PIN');
      const res = await customFetch('/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pin, 
          recaptchaToken: rc.token, 
          recaptchaAction: 'ADMIN_PIN' 
        })
      });
      const data = await res.json();
      if (res.ok && (data.success || data.verified)) {
        setAdminUnlocked(true);
        setIsAdminPinModalOpen(false);
        return { success: true };
      }
      return { success: false, error: data.error || 'Invalid Admin PIN' };
    } catch (e: any) {
      return { success: false, error: e.message || 'PIN verification failed' };
    }
  };

  const lockAdminSession = async () => {
    setAdminUnlocked(false);
    try {
      if (user && !user.isAnonymous) {
        let idToken = '';
        if (typeof (user as any).getIdToken === 'function') {
          idToken = await (user as any).getIdToken(false).catch(() => '');
        }
        if (!idToken) {
          idToken = localStorage.getItem('bse_nexus_fb_id_token') || '';
        }
        if (idToken && idToken.split('.').length === 3) {
          await customFetch('/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idToken,
              uid: user.uid,
              email: user.email,
              displayName: profile?.displayName
            })
          });
        }
      }
    } catch (e) {}
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {}

    try {
      await customFetch('/auth/logout', { method: 'POST' });
    } catch (e) {}
    
    try {
      localStorage.removeItem(STORAGE_SESSION_KEY);
      localStorage.removeItem('bse_nexus_auth_token');
      localStorage.removeItem('bse_nexus_fb_id_token');
      localStorage.removeItem('bse_user_tg_chat_id_global');
      localStorage.removeItem('bse_user_tg_username_global');
      localStorage.removeItem('bse_telegram_chat_id');
      localStorage.removeItem('bse_chat_id');
      
      // Clean all user-specific storage keys
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('bse_user_tg_') || k.startsWith('bse_user_handle_') || k.startsWith('bse_ai_usage_')) {
          localStorage.removeItem(k);
        }
      });
      
      sessionStorage.clear();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { uid: 'guest', user: null, profile: null } }));
      }
    } catch (e) {}
    
    setUser(null);
    setProfile(null);
    setAdminUnlocked(false);
    setIsAuthModalOpen(false);
    setIsAdminPinModalOpen(false);
    setIsProModalOpen(false);

    // Centralized post-logout navigation: every sign-out entry point
    // (header, settings tab, profile modal, account deletion) lands back on
    // the public landing page instead of stranding the user in guest mode on
    // the previous screen. replace() also keeps the back button from
    // returning to authenticated views.
    if (typeof window !== 'undefined') {
      window.location.replace('/');
    }
  };

  const checkUsernameAvailability = async (
    rawUsername: string
  ): Promise<{ available: boolean; cleanUsername: string; reason?: string; suggestion?: string }> => {
    try {
      const clean = rawUsername.trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '_').slice(0, 25);
      if (!clean || clean.length < 3) {
        return { available: false, cleanUsername: clean, reason: 'Username must be at least 3 characters long.' };
      }
      
      const res = await withRetry(async () => {
        return await customFetch(`/api/users/check-username?username=${encodeURIComponent(clean)}`);
      }, {
        maxRetries: 3,
        delays: [500, 1200, 2500]
      });

      if (res.ok) {
        const data = await res.json();
        return {
          available: Boolean(data.available),
          cleanUsername: data.cleanUsername || clean,
          reason: data.reason,
          suggestion: data.suggestion
        };
      }
      return { available: false, cleanUsername: clean, reason: 'Server check failed. Retrying...' };
    } catch (e: any) {
      console.warn('Check username notice:', e);
      return { available: false, cleanUsername: rawUsername, reason: 'Network slow/offline. Checking again...' };
    }
  };

  const updateProfileInfo = async (
    displayNameOrObj: string | UpdateProfileParams, 
    usernameOrTg?: string, 
    telegramUsername?: string
  ): Promise<ProfileUpdateResult> => {
    if (!profile) return { success: false, error: 'User is not logged in.' };
    reportSyncStatus('syncing');
    
    let newDisplayName = profile.displayName || '';
    let newUsername = profile.username || '';
    let newTgUsername = profile.telegramUsername || null;

    if (typeof displayNameOrObj === 'object' && displayNameOrObj !== null) {
      if (displayNameOrObj.displayName !== undefined) newDisplayName = displayNameOrObj.displayName.trim();
      if (displayNameOrObj.username !== undefined) {
        newUsername = displayNameOrObj.username.trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '_').slice(0, 25);
      }
      if (displayNameOrObj.telegramUsername !== undefined) {
        newTgUsername = displayNameOrObj.telegramUsername.trim() || null;
      }
    } else if (typeof displayNameOrObj === 'string') {
      newDisplayName = displayNameOrObj.trim();
      if (usernameOrTg !== undefined) {
        if (telegramUsername !== undefined) {
          newUsername = usernameOrTg.trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '_').slice(0, 25);
          newTgUsername = telegramUsername.trim() || null;
        } else {
          newTgUsername = usernameOrTg.trim() || null;
        }
      }
    }

    const updatedProfile: UserProfile = {
      ...profile,
      displayName: newDisplayName,
      username: newUsername || profile.username,
      telegramUsername: newTgUsername
    };

    // Optimistic local state update
    setProfile(updatedProfile);
    saveLocalSession(user, updatedProfile);

    if (user && user.uid && newUsername) {
      try {
        localStorage.setItem(`bse_user_handle_${user.uid}`, newUsername);
      } catch {}
    }

    // Direct Cloud sync with resilience against slow networks
    try {
      const res = await withRetry(async () => {
        return await customFetch('/api/users/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedProfile)
        });
      }, {
        maxRetries: 3,
        delays: [700, 1500, 3000],
        onRetry: (err, attempt) => {
          reportSyncStatus('syncing', `Network slow. Retrying profile cloud sync (attempt ${attempt})...`);
        }
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 409 || data.code === 'USERNAME_UNAVAILABLE') {
        reportSyncStatus('failed', data.error || 'Username is already taken');
        return {
          success: false,
          error: data.error || 'This username is already taken by another trader.',
          suggestion: data.suggestion
        };
      }

      if (res.ok && data.success) {
        const finalProfile = data.profile || updatedProfile;
        setProfile(finalProfile);
        saveLocalSession(user, finalProfile);
        reportSyncStatus('synced');
        return { success: true, profile: finalProfile };
      }

      reportSyncStatus('synced'); // Local fallback preserved
      return { success: true, profile: updatedProfile };
    } catch (e: any) {
      console.warn('Profile update notice (saved locally):', e);
      reportSyncStatus('syncing', `Saved locally. Will sync to cloud once connection strengthens.`);
      return { success: true, profile: updatedProfile };
    }
  };

  const updateNotificationPreferences = async (newPrefs: Partial<UserNotificationPreferences>): Promise<boolean> => {
    if (!profile) return false;
    reportSyncStatus('syncing');
    const updated = { ...profile.notificationPreferences, ...newPrefs };
    const updatedProfile = { ...profile, notificationPreferences: updated };
    setProfile(updatedProfile);
    saveLocalSession(user, updatedProfile);

    try {
      const res = await customFetch('/api/users/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationPreferences: updated })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || `Server responded with status ${res.status}`);
      }
      reportSyncStatus('synced');
      return true;
    } catch (e: any) {
      console.warn('Notification prefs update notice:', e);
      reportSyncStatus('failed', `Notification prefs update failed: ${e?.message || e}`);
      return false;
    }
  };

  const updateTelegramPreferences = async (options: UpdateTelegramOptions): Promise<boolean> => {
    if (!profile) return false;
    reportSyncStatus('syncing');

    const unlink = options.unlink === true;
    const cleanChatId = unlink ? null : (options.chatId !== undefined ? (options.chatId ? options.chatId.trim() : null) : profile.telegramChatId);
    const cleanUsername = unlink ? null : (options.username !== undefined ? (options.username ? options.username.trim().replace(/^@/, '') : null) : profile.telegramUsername);

    const currentPrefs = profile.notificationPreferences || defaultNotificationPreferences;
    const updatedPrefs: UserNotificationPreferences = {
      ...currentPrefs,
      ...(options.alertsEnabled !== undefined ? { telegramAlertsEnabled: options.alertsEnabled } : {}),
      ...(options.aiSummaryEnabled !== undefined ? { telegramAiSummaryEnabled: options.aiSummaryEnabled } : {}),
      ...(options.alertScope !== undefined ? { telegramAlertScope: options.alertScope } : {}),
    };

    if (unlink) {
      updatedPrefs.telegramAlertsEnabled = false;
    }

    const updatedProfile: UserProfile = {
      ...profile,
      telegramChatId: cleanChatId,
      telegramUsername: cleanUsername,
      notificationPreferences: updatedPrefs
    };

    setProfile(updatedProfile);
    saveLocalSession(user, updatedProfile);

    try {
      if (profile.uid) {
        if (cleanChatId) {
          localStorage.setItem(`bse_user_tg_chat_id_${profile.uid}`, cleanChatId);
        } else {
          localStorage.removeItem(`bse_user_tg_chat_id_${profile.uid}`);
        }
        if (cleanUsername) {
          localStorage.setItem(`bse_user_tg_username_${profile.uid}`, cleanUsername);
        } else {
          localStorage.removeItem(`bse_user_tg_username_${profile.uid}`);
        }
      }
    } catch {}

    try {
      const res = await customFetch('/api/users/telegram/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramChatId: cleanChatId,
          telegramUsername: cleanUsername,
          telegramAlertsEnabled: updatedPrefs.telegramAlertsEnabled,
          telegramAiSummaryEnabled: updatedPrefs.telegramAiSummaryEnabled,
          telegramAlertScope: updatedPrefs.telegramAlertScope,
          unlink
        })
      });

      if (!res.ok) {
        // Transparent fallback to general profile endpoint
        const fallbackRes = await customFetch('/api/users/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegramChatId: cleanChatId,
            telegramUsername: cleanUsername,
            notificationPreferences: updatedPrefs
          })
        });
        if (!fallbackRes.ok) {
          throw new Error(`Profile sync returned status ${fallbackRes.status}`);
        }
      }

      reportSyncStatus('synced');
      return true;
    } catch (e: any) {
      console.warn('Telegram preferences update notice:', e);
      reportSyncStatus('failed', `Telegram settings update failed: ${e?.message || e}`);
      return false;
    }
  };

  const updateTelegramChatId = async (chatId: string, username?: string): Promise<boolean> => {
    return updateTelegramPreferences({
      chatId,
      username,
      alertsEnabled: Boolean(chatId && chatId.trim())
    });
  };

  const upgradeToPro = async (plan: string = '1-Week Free Pro Trial') => {
    if (!profile) {
      setIsAuthModalOpen(true);
      return false;
    }

    const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000; // 1-Week (7 days) free trial
    const updatedProfile: UserProfile = {
      ...profile,
      tier: 'pro',
      proExpiresAt: expiry,
      maxWatchlistStocks: 9999,
      trialUsed: true
    };
    setProfile(updatedProfile);
    saveLocalSession(user, updatedProfile);
    // Remember trial consumption locally so the paywall can offer "Buy Pro" instead of a second trial
    try {
      const trialUid = (user as any)?.uid || profile.uid;
      if (trialUid) localStorage.setItem(`bse_trial_used_${trialUid}`, '1');
    } catch { /* non-fatal */ }

    try {
      await customFetch('/api/users/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan
        })
      });
    } catch (e) {
      console.warn('Could not update pro tier in backend:', e);
    }
    setIsProModalOpen(false);
    return true;
  };

  /** Re-sync the profile from the server (e.g. after a Cashfree payment grant). */
  const refreshProfile = async () => {
    if (user) {
      await syncUserProfile(user);
    }
  };

  const isOwner = Boolean(
    user && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );

  const isAdmin = Boolean((adminUnlocked || isOwner) && (isOwner || profile?.tier === 'admin' || user?.isAdmin));

  const now = Date.now();
  const proDaysLeft = profile?.proExpiresAt 
    ? Math.max(0, Math.ceil((profile.proExpiresAt - now) / (24 * 60 * 60 * 1000)))
    : 0;

  // Strict Pro gating:
  // - Guest/Anonymous users: strictly view-only, NEVER Pro
  // - Admin/Owner: Always Pro
  // - Google/Authenticated users: Pro ONLY while 1-week (7-day) trial is active (profile.proExpiresAt > now)
  const isPro = Boolean(
    user &&
    !user.isAnonymous &&
    (
      isOwner ||
      isAdmin ||
      (profile?.tier === 'pro' && profile?.proExpiresAt && profile.proExpiresAt > now)
    )
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        authLoading,
        isOwner,
        isAdmin,
        isPro,
        proDaysLeft,
        adminUnlocked,
        loginWithGoogle,
        loginWithEmail,
        signupWithEmail,
        quickDemoLogin,
        loginWithAdminPin,
        verifyAdminPin,
        lockAdminSession,
        logout,
        updateProfileInfo,
        checkUsernameAvailability,
        updateNotificationPreferences,
        updateTelegramChatId,
        updateTelegramPreferences,
        upgradeToPro,
        refreshProfile,
        isAuthModalOpen,
        setIsAuthModalOpen,
        isProModalOpen,
        setIsProModalOpen,
        isCheckoutOpen,
        setIsCheckoutOpen,
        receipt,
        setReceipt,
        isAdminPinModalOpen,
        setIsAdminPinModalOpen
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
