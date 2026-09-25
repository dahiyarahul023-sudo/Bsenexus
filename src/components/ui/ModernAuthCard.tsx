import React, { useState, useEffect } from 'react';
import { 
  Mail, Lock, User, Sparkles, 
  ArrowRight, ShieldCheck, ShieldAlert, Shield, RotateCcw,
  AtSign, Check, Eye, EyeOff, CheckCircle2,
  X, AlertCircle, ExternalLink, Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { BseNexusLogo } from './BseNexusLogo';
import { loadRecaptchaScript, executeRecaptcha, hideRecaptchaBadge } from '../../utils/recaptcha';

interface ModernAuthCardProps {
  mode?: 'modal' | 'fullscreen';
  initialTab?: 'signin' | 'signup';
  onClose?: () => void;
  onSuccess?: () => void;
}

export function ModernAuthCard({ 
  mode = 'modal',
  initialTab = 'signin',
  onClose,
  onSuccess
}: ModernAuthCardProps) {
  const { 
    isAuthModalOpen, 
    setIsAuthModalOpen, 
    loginWithGoogle, 
    loginWithEmail, 
    signupWithEmail,
    checkUsernameAvailability,
    quickDemoLogin
  } = useAuth();

  // Mode: 'signin' (left form, right brand band) OR 'signup' (left brand band, right form)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>(initialTab);
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailability, setUsernameAvailability] = useState<{
    available?: boolean;
    reason?: string;
    suggestion?: string;
  } | null>(null);

  // Sync with initialTab prop if changed
  useEffect(() => {
    setAuthMode(initialTab);
  }, [initialTab]);

  // reCAPTCHA Truthful Assessment State: 'idle' | 'checking' | 'verified' | 'blocked' | 'error'
  const [recaptchaStatus, setRecaptchaStatus] = useState<'idle' | 'checking' | 'verified' | 'blocked' | 'error'>('idle');
  const [recaptchaErrorMsg, setRecaptchaErrorMsg] = useState<string | null>(null);

  // Preload reCAPTCHA script on modal display without consuming tokens or showing fake verified status
  useEffect(() => {
    let isMounted = true;
    setRecaptchaStatus('idle');
    setRecaptchaErrorMsg(null);

    loadRecaptchaScript()
      .catch(() => {
        // Will be cleanly reported on submission
      })
      .finally(() => {
        if (isMounted) hideRecaptchaBadge();
      });

    return () => {
      isMounted = false;
      hideRecaptchaBadge();
    };
  }, [authMode]);

  const handleRetrySecurity = () => {
    setError(null);
    setAuthErrorCode(null);
    setUnauthorizedDomain(null);
    setRecaptchaErrorMsg(null);
    setRecaptchaStatus('idle');
  };

  // Clean up reCAPTCHA floating badges when auth modal is unmounted / closed
  useEffect(() => {
    return () => {
      hideRecaptchaBadge();
    };
  }, []);

  // Debounced check during signup for username
  useEffect(() => {
    if (authMode !== 'signup') {
      setUsernameAvailability(null);
      return;
    }

    const clean = username.trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '').slice(0, 25);
    if (!clean) {
      setUsernameAvailability(null);
      setIsCheckingUsername(false);
      return;
    }

    if (clean.length < 3) {
      setUsernameAvailability({ available: false, reason: 'Must be 3-25 characters.' });
      setIsCheckingUsername(false);
      return;
    }

    setIsCheckingUsername(true);
    const timer = setTimeout(async () => {
      try {
        const res = await checkUsernameAvailability(clean);
        setUsernameAvailability({
          available: res.available,
          reason: res.reason,
          suggestion: res.suggestion
        });
      } catch (e) {
        console.warn('Signup username check error:', e);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username, authMode]);

  const handleClose = () => {
    hideRecaptchaBadge();
    if (onClose) {
      onClose();
    } else {
      setIsAuthModalOpen(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isLoading) return;
    setError(null);
    setAuthErrorCode(null);
    setUnauthorizedDomain(null);
    setRecaptchaErrorMsg(null);
    setIsLoading(true);

    try {
      // Direct call within user event turn so browsers do not block popup
      const res = await loginWithGoogle();
      if (res.success) {
        handleClose();
        onSuccess?.();
      } else {
        setError(res.error || 'Google sign-in was cancelled or encountered an error.');
        if (res.code) {
          setAuthErrorCode(res.code);
        }
        if (res.domain) {
          setUnauthorizedDomain(res.domain);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Google sign-in encountered an error.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderErrorAlert = () => {
    if (!error) return null;

    const isUnauthorizedDomain = authErrorCode === 'auth/unauthorized-domain' || error.includes('Authorized Domains');
    const isPopupBlocked = authErrorCode === 'auth/popup-blocked' || error.includes('Popup was blocked') || error.includes('preview frame');
    const currentHost = unauthorizedDomain || (typeof window !== 'undefined' ? window.location.hostname : '');

    return (
      <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium space-y-2.5">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed font-semibold text-rose-900">{error}</p>
        </div>

        {/* Copy domain helper if domain is not added to Firebase */}
        {isUnauthorizedDomain && currentHost && (
          <div className="pt-2 border-t border-rose-200/70 space-y-1.5">
            <p className="text-[11px] text-rose-700 font-normal">
              To allow Google sign-in from this environment, add this domain to Firebase:
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(currentHost);
                  setCopiedDomain(true);
                  setTimeout(() => setCopiedDomain(false), 2500);
                }}
                className="px-2.5 py-1.5 bg-white border border-rose-300 hover:border-rose-400 text-rose-800 rounded-lg text-[11px] font-bold shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                {copiedDomain ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedDomain ? 'Domain Copied!' : `Copy "${currentHost.length > 25 ? currentHost.slice(0, 22) + '...' : currentHost}"`}</span>
              </button>
              <span className="text-[10px] text-rose-600">
                In Firebase Console → Auth → Settings → Authorized Domains
              </span>
            </div>
          </div>
        )}

        {/* Open in new tab helper if popup was blocked or in iframe */}
        {(isPopupBlocked || isInIframe) && (
          <div className="pt-2 border-t border-rose-200/70 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.open(window.location.href, '_blank');
                }
              }}
              className="px-3 py-1.5 bg-[#1C362A] hover:bg-[#162a21] text-white rounded-lg text-[11px] font-bold shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in New Tab for Google Sign In</span>
            </button>
            <span className="text-[10px] text-rose-600">
              Browsers restrict OAuth popups inside embedded iframes.
            </span>
          </div>
        )}
      </div>
    );
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || recaptchaStatus === 'checking') return;

    if (!email || !password) {
      setError('Please enter your email or username and password.');
      return;
    }
    setError(null);
    setRecaptchaErrorMsg(null);
    setIsLoading(true);
    setRecaptchaStatus('checking');

    // 1. Strictly verify bot risk via Google reCAPTCHA Enterprise on server
    try {
      const recaptcha = await executeRecaptcha('LOGIN');
      if (recaptcha.blocked || !recaptcha.token) {
        setIsLoading(false);
        setRecaptchaStatus('blocked');
        const userMsg = 'Security check could not be completed. Please disable content filters or ad-blockers and try again.';
        setRecaptchaErrorMsg(userMsg);
        setError(userMsg);
        return;
      }
      
      const verifyRes = await fetch('/api/security/verify-recaptcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: recaptcha.token, action: 'LOGIN' })
      });
      const verifyData = await verifyRes.json();
      
      if (!verifyRes.ok || !verifyData.success) {
        setIsLoading(false);
        setRecaptchaStatus('error');
        const userMsg = verifyData.userMessage || verifyData.error || 'Security check could not be completed. Please try again.';
        setRecaptchaErrorMsg(userMsg);
        setError(userMsg);
        return;
      }

      // ONLY marked verified after successful server assessment
      setRecaptchaStatus('verified');
    } catch {
      setIsLoading(false);
      setRecaptchaStatus('error');
      const userMsg = 'Security check could not be completed. Please try again.';
      setRecaptchaErrorMsg(userMsg);
      setError(userMsg);
      return;
    } finally {
      hideRecaptchaBadge();
    }

    const res = await loginWithEmail(email, password);
    setIsLoading(false);
    if (res.success) {
      handleClose();
      onSuccess?.();
    } else {
      setRecaptchaStatus('idle'); // Reset token state so fresh token is generated on retry
      if (res.error?.includes('operation-not-allowed') || res.error?.includes('auth/operation-not-allowed')) {
        setError('Email/Password provider is not enabled on this Firebase project. Please use Google Sign-In.');
      } else {
        setError(res.error || 'Invalid credentials or login failed');
      }
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || recaptchaStatus === 'checking') return;

    if (!email || !password) {
      setError('Please provide an email and password.');
      return;
    }
    if (password.length < 8) {
      setError('Use 8 characters or more for password security.');
      return;
    }
    setError(null);
    setRecaptchaErrorMsg(null);
    setIsLoading(true);
    setRecaptchaStatus('checking');

    // 1. Strictly verify bot risk via Google reCAPTCHA Enterprise on server
    try {
      const recaptcha = await executeRecaptcha('SIGNUP');
      if (recaptcha.blocked || !recaptcha.token) {
        setIsLoading(false);
        setRecaptchaStatus('blocked');
        const userMsg = 'Security check could not be completed. Please disable content filters or ad-blockers and try again.';
        setRecaptchaErrorMsg(userMsg);
        setError(userMsg);
        return;
      }
      
      const verifyRes = await fetch('/api/security/verify-recaptcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: recaptcha.token, action: 'SIGNUP' })
      });
      const verifyData = await verifyRes.json();
      
      if (!verifyRes.ok || !verifyData.success) {
        setIsLoading(false);
        setRecaptchaStatus('error');
        const userMsg = verifyData.userMessage || verifyData.error || 'Security check could not be completed. Please try again.';
        setRecaptchaErrorMsg(userMsg);
        setError(userMsg);
        return;
      }

      // ONLY marked verified after successful server assessment
      setRecaptchaStatus('verified');
    } catch {
      setIsLoading(false);
      setRecaptchaStatus('error');
      const userMsg = 'Security check could not be completed. Please try again.';
      setRecaptchaErrorMsg(userMsg);
      setError(userMsg);
      return;
    } finally {
      hideRecaptchaBadge();
    }

    const cleanUsername = username ? username.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '') : '';
    const res = await signupWithEmail(email, password, name, cleanUsername);
    setIsLoading(false);
    if (res.success) {
      handleClose();
      onSuccess?.();
    } else {
      setRecaptchaStatus('idle'); // Reset token state for retry
      if (res.error?.includes('operation-not-allowed') || res.error?.includes('auth/operation-not-allowed')) {
        setError('Email/Password provider is not enabled on this Firebase project. Please use Google Sign-In.');
      } else {
        setError(res.error || 'Registration failed');
      }
    }
  };

  const isSignIn = authMode === 'signin';

  // Desktop animation transition config
  const springConfig = {
    type: 'spring' as const,
    stiffness: 280,
    damping: 30
  };

  return (
    <div className="relative w-full max-w-[820px] mx-auto bg-white rounded-2xl sm:rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)] overflow-hidden border border-slate-100 flex flex-col md:flex-row min-h-0 md:min-h-[520px] max-h-[calc(100dvh-1.5rem)] sm:max-h-[92dvh]">
      
      {/* Close button if in modal mode */}
      {mode === 'modal' && (
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="absolute top-2.5 right-2.5 sm:top-4 sm:right-4 z-40 p-1.5 sm:p-2 rounded-full bg-black/25 hover:bg-black/35 text-white md:bg-black/5 md:text-slate-600 md:hover:bg-black/10 md:hover:text-slate-900 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      )}

      {/* DESKTOP SPLIT VIEW WITH SLIDING / ROLLING FLIP */}
      {/* ========================================================================= */}
      {/* Mobile view: Stacked / Switchable tabs */}
      <div className="md:hidden flex flex-col w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[92dvh] overflow-hidden">
        {/* Top banner - Sleek and left-anchored on mobile */}
        <div className="bg-[#1C362A] text-white px-5 py-4 sm:px-6 sm:py-5 relative overflow-hidden text-left shrink-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-2.5 mb-2">
            <div className="inline-flex items-center justify-center p-1.5 rounded-lg bg-white/10">
              <BseNexusLogo className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase text-emerald-400 leading-none">BSE NEXUS</p>
              <p className="text-[10px] text-emerald-200/70 leading-none mt-0.5">Capital Markets</p>
            </div>
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
            {isSignIn ? 'Welcome back.' : 'Start the first page.'}
          </h2>
          <p className="text-[11px] sm:text-xs text-emerald-100/80 mt-1 max-w-sm leading-relaxed">
            {isSignIn 
              ? 'Your corporate watchlists, filings & alerts are saved.' 
              : 'One account for real-time BSE filings, AI summaries & alerts.'}
          </p>
        </div>

        {/* Mobile Switch Tabs - Segmented touch-friendly bar */}
        <div className="flex border-b border-slate-200 bg-slate-100/90 p-1 gap-1 text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => { setAuthMode('signin'); setError(null); }}
            className={`flex-1 py-2 text-center rounded-lg transition-all cursor-pointer ${
              isSignIn 
                ? 'bg-white text-[#1C362A] shadow-xs font-bold' 
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('signup'); setError(null); }}
            className={`flex-1 py-2 text-center rounded-lg transition-all cursor-pointer ${
              !isSignIn 
                ? 'bg-white text-[#1C362A] shadow-xs font-bold' 
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            Create account
          </button>
        </div>

        {/* Mobile Form Body - Smoothly scrollable with no clipping */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 overscroll-contain">
          {renderErrorAlert()}

          {isSignIn ? (
            <form onSubmit={handleEmailLogin} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Username or email</label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com or @handle"
                  className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-slate-300 text-base sm:text-sm text-slate-900 focus:outline-none focus:border-[#1C362A] focus:ring-1 focus:ring-[#1C362A]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 pr-10 rounded-xl border border-slate-300 text-base sm:text-sm text-slate-900 focus:outline-none focus:border-[#1C362A] focus:ring-1 focus:ring-[#1C362A]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-600">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={keepSignedIn}
                    onChange={(e) => setKeepSignedIn(e.target.checked)}
                    className="rounded border-slate-300 text-[#1C362A] focus:ring-[#1C362A]"
                  />
                  <span>Keep me signed in</span>
                </label>
                <button
                  type="button"
                  onClick={() => setError('Please sign in using Google or enter your registered account credentials.')}
                  className="text-slate-500 hover:text-slate-800"
                >
                  Forgot password?
                </button>
              </div>

              <RecaptchaVerificationBox status={recaptchaStatus} onRetry={handleRetrySecurity} />

              <button
                type="submit"
                disabled={isLoading || recaptchaStatus === 'checking'}
                aria-busy={isLoading || recaptchaStatus === 'checking'}
                className="w-full py-2.5 sm:py-3 px-4 bg-[#1C362A] hover:bg-[#162a21] text-white font-bold rounded-xl text-sm transition-transform active:scale-98 shadow-sm cursor-pointer disabled:opacity-50 min-h-[42px] flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#1C362A] focus:ring-offset-1"
              >
                {recaptchaStatus === 'checking' ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                    <span>Verifying security...</span>
                  </>
                ) : isLoading ? (
                  <span>Signing in...</span>
                ) : (
                  <span>Sign in</span>
                )}
              </button>

              <div className="relative flex items-center justify-center my-2 sm:my-3">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">or</span>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 hover:border-emerald-500 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-2 cursor-pointer active:scale-98 shadow-2xs min-h-[42px] transition-all disabled:opacity-75 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-slate-600 border-t-transparent rounded-full" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              <div className="pt-1 flex flex-col gap-1 text-center">
                <p className="text-xs text-slate-600">
                  New to BSE Nexus?{' '}
                  <button
                    type="button"
                    onClick={() => { setAuthMode('signup'); setError(null); }}
                    className="text-[#1C362A] hover:underline font-bold cursor-pointer"
                  >
                    Create account
                  </button>
                </p>
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (isLoading) return;
                      setIsLoading(true);
                      if (typeof window !== 'undefined') {
                        sessionStorage.setItem('bse_guest_active_session', 'true');
                      }
                      try {
                        await quickDemoLogin('Guest');
                        handleClose();
                        onSuccess?.();
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={isLoading}
                    className="w-full py-2.5 px-3 rounded-xl border border-slate-200 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/40 text-slate-700 hover:text-emerald-900 text-xs font-semibold flex items-center justify-between cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="View-only access to live BSE filings without account"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
                      <span>{isLoading ? 'Starting Guest Session...' : 'Continue as Guest (View-Only)'}</span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-700 shrink-0">Guest Mode →</span>
                  </button>
                </div>
                <RecaptchaNotice />
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-2.5 sm:space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-slate-300 text-base sm:text-sm text-slate-900 focus:outline-none focus:border-[#1C362A] focus:ring-1 focus:ring-[#1C362A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-slate-300 text-base sm:text-sm text-slate-900 focus:outline-none focus:border-[#1C362A] focus:ring-1 focus:ring-[#1C362A]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Username (Handle)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="trader_pro"
                    className="w-full pl-8 pr-3.5 py-2 sm:py-2.5 rounded-xl border border-slate-300 text-base sm:text-sm text-slate-900 focus:outline-none focus:border-[#1C362A] focus:ring-1 focus:ring-[#1C362A]"
                  />
                </div>
                {isCheckingUsername ? (
                  <div className="mt-1 text-[10px] text-slate-500 flex items-center gap-1">
                    <span className="animate-spin inline-block w-2.5 h-2.5 border-2 border-slate-400 border-t-transparent rounded-full" />
                    <span>Checking availability...</span>
                  </div>
                ) : usernameAvailability ? (
                  <div className="mt-1 text-[11px]">
                    {usernameAvailability.available ? (
                      <span className="text-emerald-700 font-medium">✓ Available</span>
                    ) : (
                      <span className="text-rose-600 font-medium">
                        {usernameAvailability.reason}
                        {usernameAvailability.suggestion && (
                          <button 
                            type="button" 
                            onClick={() => setUsername(usernameAvailability.suggestion!)}
                            className="ml-1 underline text-emerald-700 hover:text-emerald-800"
                          >
                            Try @{usernameAvailability.suggestion}
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                ) : null}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 pr-10 rounded-xl border border-slate-300 text-base sm:text-sm text-slate-900 focus:outline-none focus:border-[#1C362A] focus:ring-1 focus:ring-[#1C362A]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Use 8 characters or more.</p>
              </div>

              <RecaptchaVerificationBox status={recaptchaStatus} onRetry={handleRetrySecurity} />

              <button
                type="submit"
                disabled={isLoading || recaptchaStatus === 'checking'}
                aria-busy={isLoading || recaptchaStatus === 'checking'}
                className="w-full py-2.5 sm:py-3 px-4 bg-[#1C362A] hover:bg-[#162a21] text-white font-bold rounded-xl text-sm transition-transform active:scale-98 shadow-sm cursor-pointer disabled:opacity-50 min-h-[42px] flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#1C362A] focus:ring-offset-1"
              >
                {recaptchaStatus === 'checking' ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                    <span>Verifying security...</span>
                  </>
                ) : isLoading ? (
                  <span>Creating account...</span>
                ) : (
                  <span>Create account</span>
                )}
              </button>

              <div className="relative flex items-center justify-center my-2 sm:my-3">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">or</span>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full py-2 sm:py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-2 cursor-pointer active:scale-98 shadow-2xs min-h-[40px] disabled:opacity-75 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-slate-600 border-t-transparent rounded-full" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Sign up with Google</span>
                  </>
                )}
              </button>

              <div className="pt-1 text-center space-y-2">
                <p className="text-xs text-slate-600">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setAuthMode('signin'); setError(null); }}
                    className="text-[#1C362A] hover:underline font-bold cursor-pointer"
                  >
                    Sign in
                  </button>
                </p>
                <RecaptchaNotice />
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DESKTOP VIEW: Two Columns with Smooth Spring Swap Transition */}
      <div className="hidden md:flex w-full min-h-[520px] max-h-[calc(100dvh-2rem)] md:max-h-[660px] relative overflow-hidden">
        
        {/* Sliding Forest-Green Brand Panel */}
        {/* When isSignIn = true: Panel is on the RIGHT (left: 55%, width: 45%) */}
        {/* When isSignIn = false (Signup): Panel slides to the LEFT (left: 0%, width: 45%) */}
        <motion.div
          animate={{
            x: isSignIn ? '122.22%' : '0%'
          }}
          transition={springConfig}
          className="absolute top-0 left-0 w-[45%] h-full bg-[#1C362A] text-white p-6 lg:p-8 z-20 flex flex-col justify-between overflow-hidden shadow-2xl"
        >
          {/* Subtle decorative glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Logo */}
          <div className="relative z-10 flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/10 backdrop-blur-xs">
              <BseNexusLogo className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-black tracking-widest uppercase text-emerald-300">BSE NEXUS</p>
              <p className="text-[10px] text-emerald-100/60 font-medium">Financial Intelligence Terminal</p>
            </div>
          </div>

          {/* Centered Dynamic Messaging */}
          <div className="relative z-10 my-auto py-4">
            <AnimatePresence mode="wait">
              {isSignIn ? (
                <motion.div
                  key="signin-message"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-3"
                >
                  <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight leading-tight text-white">
                    Welcome<br />back.
                  </h2>
                  <p className="text-xs lg:text-sm text-emerald-100/80 leading-relaxed max-w-[260px]">
                    Your boards, your drafts and your corporate filings are exactly where you left them.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="signup-message"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-3"
                >
                  <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight leading-tight text-white">
                    Start the<br />first page.
                  </h2>
                  <p className="text-xs lg:text-sm text-emerald-100/80 leading-relaxed max-w-[260px]">
                    One account for every board, every draft and every device you own.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom Trust Badge */}
          <div className="relative z-10 pt-3 border-t border-emerald-800/60 flex items-center gap-2 text-xs text-emerald-200/70">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Encrypted BSE WebSocket & Cloud Synced</span>
          </div>
        </motion.div>

        {/* Sliding Form Container */}
        {/* When isSignIn = true: Form is on the LEFT (0% to 55%) */}
        {/* When isSignIn = false (Signup): Form is on the RIGHT (45% to 100%, shifted right) */}
        <motion.div
          animate={{
            x: isSignIn ? '0%' : '81.81%'
          }}
          transition={springConfig}
          className="w-[55%] h-full p-6 lg:p-8 flex flex-col justify-center z-10 overflow-y-auto max-h-[calc(100dvh-2rem)] md:max-h-[660px]"
        >
          <div className="max-w-[340px] mx-auto w-full">
            <AnimatePresence mode="wait">
              {isSignIn ? (
                /* ---------------- SIGN IN FORM ---------------- */
                <motion.div
                  key="form-signin"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <div>
                    <h3 className="text-2xl font-bold tracking-tight text-slate-900">Sign in</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Enter your account credentials to continue</p>
                  </div>

                  {renderErrorAlert()}

                  <form onSubmit={handleEmailLogin} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Username or email
                      </label>
                      <input
                        type="text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@domain.com or @handle"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#1C362A] focus:ring-2 focus:ring-[#1C362A]/15 transition-all"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#1C362A] focus:ring-2 focus:ring-[#1C362A]/15 transition-all"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={keepSignedIn}
                          onChange={(e) => setKeepSignedIn(e.target.checked)}
                          className="rounded border-slate-300 text-[#1C362A] focus:ring-[#1C362A]"
                        />
                        <span>Keep me signed in</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setError('Please sign in using Google or enter your registered account credentials.')}
                        className="text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>

                    <RecaptchaVerificationBox status={recaptchaStatus} onRetry={handleRetrySecurity} />

                    <button
                      type="submit"
                      disabled={isLoading || recaptchaStatus === 'checking'}
                      aria-busy={isLoading || recaptchaStatus === 'checking'}
                      className="w-full py-2.5 px-4 bg-[#1C362A] hover:bg-[#162a21] text-white font-bold rounded-xl text-sm transition-all active:scale-98 shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#1C362A] focus:ring-offset-1"
                    >
                      {recaptchaStatus === 'checking' ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                          <span>Verifying security...</span>
                        </>
                      ) : isLoading ? (
                        <span>Signing in...</span>
                      ) : (
                        <span>Sign in</span>
                      )}
                    </button>

                    <div className="pt-2 text-center">
                      <p className="text-xs text-slate-600">
                        New to BSE NEXUS?{' '}
                        <button
                          type="button"
                          onClick={() => { setAuthMode('signup'); setError(null); }}
                          className="text-[#1C362A] hover:underline font-bold cursor-pointer"
                        >
                          Create an account
                        </button>
                      </p>
                    </div>

                    {/* Google Sign-in */}
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={isLoading}
                        className="w-full py-2.5 px-3 border border-slate-200 hover:border-emerald-500 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-colors bg-white hover:bg-slate-50 min-h-[38px] disabled:opacity-75 focus:outline-none focus:ring-2 focus:ring-slate-400"
                      >
                        {isLoading ? (
                          <>
                            <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-slate-600 border-t-transparent rounded-full" />
                            <span>Signing in...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                            </svg>
                            <span>Sign in with Google</span>
                          </>
                        )}
                      </button>

                      {/* The single dedicated Guest login option */}
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={async () => {
                          if (isLoading) return;
                          setIsLoading(true);
                          if (typeof window !== 'undefined') {
                            sessionStorage.setItem('bse_guest_active_session', 'true');
                          }
                          try {
                            await quickDemoLogin('Guest');
                            handleClose();
                            onSuccess?.();
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                        className="w-full py-2.5 px-3 rounded-xl border border-slate-200 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/40 text-slate-700 hover:text-emerald-900 text-xs font-semibold flex items-center justify-between cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        title="View-only access to live BSE filings without account"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
                          <span>{isLoading ? 'Starting Guest Session...' : 'Continue as Guest (View-Only)'}</span>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-700 shrink-0">Guest Mode →</span>
                      </button>
                    </div>
                    <RecaptchaNotice />
                  </form>
                </motion.div>
              ) : (
                /* ---------------- SIGN UP FORM ---------------- */
                <motion.div
                  key="form-signup"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <div>
                    <h3 className="text-2xl font-bold tracking-tight text-slate-900">Create account</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Join BSE Nexus to track market filings & alerts</p>
                  </div>

                  {renderErrorAlert()}

                  <form onSubmit={handleSignup} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Full name
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#1C362A] focus:ring-2 focus:ring-[#1C362A]/15 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Email address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@domain.com"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#1C362A] focus:ring-2 focus:ring-[#1C362A]/15 transition-all"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Username (Handle)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">@</span>
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                          placeholder="trader_nexus"
                          className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#1C362A] focus:ring-2 focus:ring-[#1C362A]/15 transition-all"
                        />
                      </div>
                      {usernameAvailability && (
                        <div className="mt-1 text-[10px]">
                          {usernameAvailability.available ? (
                            <span className="text-emerald-700 font-medium">✓ Handle available</span>
                          ) : (
                            <span className="text-rose-600 font-medium">{usernameAvailability.reason}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3 py-2 pr-10 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#1C362A] focus:ring-2 focus:ring-[#1C362A]/15 transition-all"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">Use 8 characters or more.</p>
                    </div>

                    <RecaptchaVerificationBox status={recaptchaStatus} onRetry={handleRetrySecurity} />

                    <button
                      type="submit"
                      disabled={isLoading || recaptchaStatus === 'checking'}
                      aria-busy={isLoading || recaptchaStatus === 'checking'}
                      className="w-full py-2.5 px-4 bg-[#1C362A] hover:bg-[#162a21] text-white font-bold rounded-xl text-sm transition-all active:scale-98 shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#1C362A] focus:ring-offset-1"
                    >
                      {recaptchaStatus === 'checking' ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                          <span>Verifying security...</span>
                        </>
                      ) : isLoading ? (
                        <span>Creating account...</span>
                      ) : (
                        <span>Create account</span>
                      )}
                    </button>

                    <div className="pt-1 text-center">
                      <p className="text-xs text-slate-600">
                        Already have an account?{' '}
                        <button
                          type="button"
                          onClick={() => { setAuthMode('signin'); setError(null); }}
                          className="text-[#1C362A] hover:underline font-bold cursor-pointer"
                        >
                          Sign in
                        </button>
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={isLoading}
                        className="w-full py-2.5 px-3 border border-slate-200 hover:border-emerald-500 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-colors bg-white hover:bg-slate-50 min-h-[38px] disabled:opacity-75 focus:outline-none focus:ring-2 focus:ring-slate-400"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                        <span>Sign up with Google</span>
                      </button>
                    </div>

                    <RecaptchaNotice />
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function RecaptchaNotice() {
  return (
    <p className="pt-2 text-center text-[10px] sm:text-[11px] text-slate-500 leading-normal select-none">
      This site is protected by reCAPTCHA and the Google{' '}
      <a 
        href="https://policies.google.com/privacy" 
        target="_blank" 
        rel="noopener noreferrer" 
        className="underline text-slate-600 hover:text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 rounded"
      >
        Privacy Policy
      </a>{' '}
      and{' '}
      <a 
        href="https://policies.google.com/terms" 
        target="_blank" 
        rel="noopener noreferrer" 
        className="underline text-slate-600 hover:text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 rounded"
      >
        Terms of Service
      </a>{' '}
      apply.
    </p>
  );
}

interface RecaptchaVerificationBoxProps {
  status: 'idle' | 'checking' | 'verified' | 'blocked' | 'error';
  onRetry?: () => void;
}

function RecaptchaVerificationBox({ status, onRetry }: RecaptchaVerificationBoxProps) {
  if (status === 'idle') {
    return (
      <div 
        className="py-2 px-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs my-1 select-none"
        aria-live="polite"
      >
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold text-slate-700 text-[11px] leading-tight">
              reCAPTCHA Enterprise Protection
            </p>
            <p className="text-[9.5px] text-slate-500 leading-tight">
              Assessment verifies on submission
            </p>
          </div>
        </div>
        <span className="text-[10px] font-medium text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded-md">
          Ready
        </span>
      </div>
    );
  }

  if (status === 'checking') {
    return (
      <div 
        className="py-2 px-3 rounded-xl border border-amber-200 bg-amber-50/80 flex items-center justify-between text-xs my-1"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold text-amber-900 text-[11px] leading-tight">
              Verifying Security...
            </p>
            <p className="text-[9.5px] text-amber-700 leading-tight">
              Assessing reCAPTCHA Enterprise risk score
            </p>
          </div>
        </div>
        <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md">
          Checking
        </span>
      </div>
    );
  }

  if (status === 'verified') {
    return (
      <div 
        className="py-2 px-3 rounded-xl border border-emerald-200 bg-emerald-50/80 flex items-center justify-between text-xs my-1"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center justify-center shrink-0">
            <Check className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
          </div>
          <div>
            <p className="font-semibold text-emerald-950 text-[11px] leading-tight">
              reCAPTCHA Verified
            </p>
            <p className="text-[9.5px] text-emerald-700 leading-tight">
              Security assessment confirmed by server
            </p>
          </div>
        </div>
        <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">
          ✓ Verified
        </span>
      </div>
    );
  }

  // 'blocked' or 'error' state
  return (
    <div 
      className="py-2 px-3 rounded-xl border border-rose-200 bg-rose-50/90 flex items-center justify-between text-xs my-1"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold text-rose-900 text-[11px] leading-tight">
            Security Check Incomplete
          </p>
          <p className="text-[9.5px] text-rose-700 leading-tight">
            {status === 'blocked' 
              ? 'Script blocked by browser filter. Please retry.' 
              : 'Verification did not complete. Please retry.'}
          </p>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-[10px] font-semibold text-rose-800 bg-white hover:bg-rose-100/60 border border-rose-300 px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1"
          aria-label="Retry security verification"
        >
          <RotateCcw className="w-2.5 h-2.5" aria-hidden="true" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
}
