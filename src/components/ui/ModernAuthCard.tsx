import React, { useState, useEffect } from 'react';
import {
  X, AlertCircle, ExternalLink, Copy, Shield, ShieldAlert,
  RotateCcw, Eye, EyeOff, Check, User
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { BseNexusLogo } from './BseNexusLogo';
import { loadRecaptchaScript, executeRecaptcha, hideRecaptchaBadge } from '../../utils/recaptcha';

interface ModernAuthCardProps {
  mode?: 'modal' | 'fullscreen';
  initialTab?: 'signin' | 'signup';
  onClose?: () => void;
  onSuccess?: () => void;
}

// ---- Wavy hero animation (pure CSS, no external assets) ----
const WAVY_CSS = `
@keyframes wavy-slide {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
`;

function WavyHero() {
  return (
    <div
      className="relative overflow-hidden shrink-0 h-[168px] sm:h-[188px]"
      style={{
        background:
          'radial-gradient(ellipse at 50% 18%, #eaf5fd 0%, #cfe7fa 45%, #55acee 100%)',
      }}
    >
      <style>{WAVY_CSS}</style>
      {/* Brand mark */}
      <div className="absolute inset-x-0 top-0 z-10 flex flex-col items-center pt-6 sm:pt-7">
        <div className="p-2 rounded-2xl bg-white/85 shadow-sm">
          <BseNexusLogo className="w-7 h-7" />
        </div>
        <p className="mt-2 text-[11px] font-black tracking-[0.3em] text-slate-700">
          BSE NEXUS
        </p>
        <p className="text-[10px] text-slate-500 mt-0.5">
          Capital Markets Intelligence
        </p>
      </div>
      {/* Back wave (slower, translucent) */}
      <svg
        className="absolute bottom-0 left-0 h-[84px] w-[200%] opacity-60"
        style={{ animation: 'wavy-slide 11s linear infinite' }}
        viewBox="0 0 1440 84"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          fill="#ffffff"
          fillOpacity="0.55"
          d="M0,46 C240,86 480,8 720,46 C960,86 1200,8 1440,46 L1440,84 L0,84 Z"
        />
      </svg>
      {/* Front wave (faster, solid — melts into the white form) */}
      <svg
        className="absolute bottom-0 left-0 h-[62px] w-[200%]"
        style={{ animation: 'wavy-slide 7s linear infinite' }}
        viewBox="0 0 1440 62"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          fill="#ffffff"
          d="M0,34 C240,62 480,8 720,34 C960,62 1200,8 1440,34 L1440,62 L0,62 Z"
        />
      </svg>
    </div>
  );
}

function GoogleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

// Shared field / button styling (wavy.ai card language)
const inputCls =
  'w-full h-[52px] px-4 rounded-[14px] border border-slate-200 bg-white text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition';
const submitCls =
  'w-full h-[52px] rounded-[14px] bg-[#1c1917] hover:bg-black text-white font-semibold text-[15px] flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-60 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2';
const socialCls =
  'h-[52px] rounded-[14px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-60 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-300';

function OrDivider() {
  return (
    <div className="relative flex items-center justify-center my-1" aria-hidden="true">
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-900/15" />
      <span className="relative bg-white px-3 text-xs font-medium text-slate-500">Or</span>
    </div>
  );
}

export function ModernAuthCard({
  mode = 'modal',
  initialTab = 'signin',
  onClose,
  onSuccess
}: ModernAuthCardProps) {
  const {
    setIsAuthModalOpen,
    loginWithGoogle,
    loginWithEmail,
    signupWithEmail,
    checkUsernameAvailability,
    quickDemoLogin
  } = useAuth();

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

  const handleGuestLogin = async () => {
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
  };

  const renderErrorAlert = () => {
    if (!error) return null;

    const isUnauthorizedDomain = authErrorCode === 'auth/unauthorized-domain' || error.includes('Authorized Domains');
    const isPopupBlocked = authErrorCode === 'auth/popup-blocked' || error.includes('Popup was blocked') || error.includes('preview frame');
    const currentHost = unauthorizedDomain || (typeof window !== 'undefined' ? window.location.hostname : '');

    return (
      <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-[14px] font-medium space-y-2.5">
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

  return (
    <div className="relative w-full max-w-[500px] mx-auto bg-white rounded-[28px] shadow-[0_25px_60px_-15px_rgba(30,80,160,0.28)] overflow-hidden max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">

      {/* Close button (modal mode) */}
      {mode === 'modal' && (
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-30 p-2 rounded-full bg-white/70 hover:bg-white text-slate-600 hover:text-slate-900 shadow-sm transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Animated wave hero */}
      <WavyHero />

      {/* Form body */}
      <div className="px-5 sm:px-8 pt-4 sm:pt-5 pb-6 sm:pb-8">
        <h3 className="text-center text-lg font-bold text-slate-900">
          {isSignIn ? 'Login to your account' : 'Create your account'}
        </h3>

        {/* Sign in / Create account tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 mt-4 mb-5" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected={isSignIn}
            onClick={() => { setAuthMode('signin'); setError(null); }}
            className={`py-2 rounded-xl text-sm transition-all cursor-pointer ${
              isSignIn
                ? 'bg-white text-slate-900 shadow-sm font-bold'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isSignIn}
            onClick={() => { setAuthMode('signup'); setError(null); }}
            className={`py-2 rounded-xl text-sm transition-all cursor-pointer ${
              !isSignIn
                ? 'bg-white text-slate-900 shadow-sm font-bold'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            Create account
          </button>
        </div>

        {renderErrorAlert()}

        {isSignIn ? (
          <form onSubmit={handleEmailLogin} className="space-y-3 mt-4">
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email or username"
              aria-label="Email or username"
              className={inputCls}
              required
            />

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                aria-label="Password"
                className={`${inputCls} pr-12`}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600 px-0.5">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={keepSignedIn}
                  onChange={(e) => setKeepSignedIn(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
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
              className={submitCls}
            >
              {recaptchaStatus === 'checking' ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  <span>Verifying security...</span>
                </>
              ) : isLoading ? (
                <span>Signing in...</span>
              ) : (
                <span>Login</span>
              )}
            </button>

            <OrDivider />

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className={socialCls}
              >
                {isLoading ? (
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full" />
                ) : (
                  <GoogleIcon />
                )}
                <span>{isLoading ? 'Wait...' : 'Google'}</span>
              </button>
              <button
                type="button"
                onClick={handleGuestLogin}
                disabled={isLoading}
                className={socialCls}
                title="View-only access to live BSE filings without account"
              >
                <User className="w-5 h-5 text-slate-500" />
                <span>{isLoading ? 'Wait...' : 'Guest'}</span>
              </button>
            </div>

            <RecaptchaNotice />
          </form>
        ) : (
          <form onSubmit={handleSignup} className="space-y-3 mt-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              aria-label="Full name"
              className={inputCls}
            />

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              aria-label="Email address"
              className={inputCls}
              required
            />

            <div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[15px] select-none">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="username"
                  aria-label="Username"
                  className={`${inputCls} pl-9`}
                />
              </div>
              {isCheckingUsername ? (
                <div className="mt-1.5 text-[11px] text-slate-500 flex items-center gap-1.5 px-1">
                  <span className="animate-spin inline-block w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full" />
                  <span>Checking availability...</span>
                </div>
              ) : usernameAvailability ? (
                <div className="mt-1.5 text-[11px] px-1">
                  {usernameAvailability.available ? (
                    <span className="text-emerald-700 font-medium">✓ Available</span>
                  ) : (
                    <span className="text-rose-600 font-medium">
                      {usernameAvailability.reason}
                      {usernameAvailability.suggestion && (
                        <button
                          type="button"
                          onClick={() => setUsername(usernameAvailability.suggestion!)}
                          className="ml-1 underline text-emerald-700 hover:text-emerald-800 cursor-pointer"
                        >
                          Try @{usernameAvailability.suggestion}
                        </button>
                      )}
                    </span>
                  )}
                </div>
              ) : null}
            </div>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (8+ characters)"
                aria-label="Password"
                className={`${inputCls} pr-12`}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <RecaptchaVerificationBox status={recaptchaStatus} onRetry={handleRetrySecurity} />

            <button
              type="submit"
              disabled={isLoading || recaptchaStatus === 'checking'}
              aria-busy={isLoading || recaptchaStatus === 'checking'}
              className={submitCls}
            >
              {recaptchaStatus === 'checking' ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  <span>Verifying security...</span>
                </>
              ) : isLoading ? (
                <span>Creating account...</span>
              ) : (
                <span>Create account</span>
              )}
            </button>

            <OrDivider />

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className={socialCls}
            >
              {isLoading ? (
                <span className="animate-spin inline-block w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full" />
              ) : (
                <GoogleIcon />
              )}
              <span>{isLoading ? 'Wait...' : 'Sign up with Google'}</span>
            </button>

            <RecaptchaNotice />
          </form>
        )}
      </div>
    </div>
  );
}

function RecaptchaNotice() {
  return (
    <p className="pt-1 text-center text-[10px] sm:text-[11px] text-slate-500 leading-normal select-none">
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
        className="py-2 px-3 rounded-[14px] border border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs my-1 select-none"
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
        className="py-2 px-3 rounded-[14px] border border-amber-200 bg-amber-50/80 flex items-center justify-between text-xs my-1"
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
        className="py-2 px-3 rounded-[14px] border border-emerald-200 bg-emerald-50/80 flex items-center justify-between text-xs my-1"
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
      className="py-2 px-3 rounded-[14px] border border-rose-200 bg-rose-50/90 flex items-center justify-between text-xs my-1"
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
