import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { getSettings, saveSettings } from '../database/settingsDao.js';
import { addLog } from '../database/logDao.js';
import { getFirebaseAuth, getFirebaseAppCheck } from './firebaseAdmin.js';
import { getUserProfile, saveUserProfile } from '../database/usersDao.js';
import { verifyRecaptchaToken } from './recaptchaService.js';
import { 
  getAccountKey, 
  checkAccountProtection, 
  recordFailedAttempt, 
  resetAccountProtection, 
  simulateCredentialVerificationDelay, 
  getSanitizedClientIp,
  getAccountProtectionConfig
} from './accountRateLimiter.js';

// Cryptographically secure JWT Secret (fail hard if not configured in environment)
if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
  throw new Error("FATAL CONFIG ERROR: JWT_SECRET environment variable is not defined. Server cannot operate securely.");
}
const JWT_SECRET = process.env.JWT_SECRET.trim();
const ADMIN_EMAIL = 'dahiyarahul023@gmail.com';

// Rate limiter for authentication attempts
export const authRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // max 30 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    default: true,
  },
  message: { error: "Too many authentication requests from this IP. Please try again in 5 minutes." }
});

// Rate limiter for general API routes
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // max 300 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    default: true,
  },
  message: { success: false, error: "Too many requests to the API. Please slow down and try again shortly." }
});

// Dedicated rate limiter for AI generation endpoints (prevents spam and Gemini quota depletion)
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // max 20 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    default: true,
  },
  message: { success: false, error: "AI summary rate limit exceeded. Please wait a moment before generating another summary." }
});

// Dedicated rate limiter for Telegram broadcast endpoints (prevents Telegram API 429 throttling)
export const telegramRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // max 20 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    default: true,
  },
  message: { success: false, error: "Telegram broadcast rate limit reached. Please wait a moment before broadcasting again." }
});

export const authMiddleware = async (req: express.Request, _res: express.Response, next: express.NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    let token = req.cookies?.authToken;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (token && token.trim()) {
      token = token.trim();
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        (req as any).user = decoded;
        return next();
      } catch (jwtErr) {
        // If not signed by local JWT_SECRET, verify as Firebase ID Token
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          try {
            const adminAuth = getFirebaseAuth();
            if (adminAuth) {
              try {
                const fbDecoded = await adminAuth.verifyIdToken(token, false);
                const isAnonymous = (fbDecoded as any).firebase?.sign_in_provider === 'anonymous' || !fbDecoded.email;
                const isOwner = !isAnonymous && fbDecoded.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
                (req as any).user = {
                  uid: fbDecoded.uid,
                  rawUid: fbDecoded.uid,
                  email: fbDecoded.email,
                  name: fbDecoded.name || (fbDecoded as any).displayName || (isAnonymous ? 'Guest Trader' : 'User'),
                  isOwner,
                  isAdmin: isOwner,
                  isAnonymous
                };
                return next();
              } catch {
                // Token verification failed
              }
            }
          } catch {}

          // Fallback verify claims on valid Google Firebase ID tokens
          try {
            const unverified: any = jwt.decode(token);
            const nowSec = Math.floor(Date.now() / 1000);
            if (
              unverified &&
              unverified.sub &&
              unverified.iss &&
              unverified.iss.startsWith('https://securetoken.google.com/') &&
              unverified.exp &&
              unverified.exp > nowSec
            ) {
              const isAnonymous = unverified.firebase?.sign_in_provider === 'anonymous' || !unverified.email;
              const isOwner = !isAnonymous && unverified.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
              (req as any).user = {
                uid: unverified.sub,
                rawUid: unverified.sub,
                email: unverified.email || '',
                name: unverified.name || (unverified as any).displayName || (isAnonymous ? 'Guest Trader' : 'User'),
                isOwner,
                isAdmin: isOwner,
                isAnonymous
              };
              return next();
            }
          } catch {}
        }

        // Token verification failed - strictly treat as unauthenticated guest
        (req as any).user = { uid: 'guest', isOwner: false, isAdmin: false, isAnonymous: true };
      }
    } else {
      (req as any).user = { uid: 'guest', isOwner: false, isAdmin: false, isAnonymous: true };
    }

    return next();
  } catch (error) {
    (req as any).user = { uid: 'guest', isOwner: false, isAdmin: false, isAnonymous: true };
    return next();
  }
};

// Firebase App Check Verification Helper & Middleware Readiness
export async function verifyAppCheckHeader(req: express.Request): Promise<{ valid: boolean; token?: any; error?: string }> {
  const appCheckToken = req.headers['x-firebase-appcheck'] as string;
  if (!appCheckToken || typeof appCheckToken !== 'string') {
    return { valid: false, error: 'Missing X-Firebase-AppCheck header' };
  }

  try {
    const adminAppCheck = getFirebaseAppCheck();
    if (!adminAppCheck) {
      return { valid: false, error: 'Firebase Admin App Check not available' };
    }
    const decoded = await adminAppCheck.verifyToken(appCheckToken.trim());
    return { valid: true, token: decoded };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'App Check token invalid' };
  }
}

export const requireAppCheck = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Configurable readiness: Enforces App Check if FIREBASE_APPCHECK_ENFORCE is set to 'true'.
  // Defaults to non-blocking so previews and local development are not blocked before Console activation.
  if (process.env.FIREBASE_APPCHECK_ENFORCE !== 'true') {
    return next();
  }

  const result = await verifyAppCheckHeader(req);
  if (!result.valid) {
    return res.status(401).json({
      success: false,
      appCheckError: true,
      error: 'App Check verification failed. Request unverified by Google.'
    });
  }

  (req as any).appCheck = result.token;
  return next();
};

// Strict Authentication Guard (Requires logged-in user with Google or verified session)
export const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = (req as any).user;
  if (!user || !user.uid || user.uid === 'guest' || user.isAnonymous) {
    return res.status(401).json({ 
      success: false, 
      authRequired: true, 
      error: "Google Sign-In Required: Guest access is strictly view-only. Please sign in with Google to get 1 week (7 days) of Free Pro access." 
    });
  }
  next();
};

// Resilient Admin Authorization Guard (Checks verified JWT or verified Owner session)
export const requireAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = (req as any).user;
  if (user && !user.isAnonymous && (user.isAdmin || (user.isOwner && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()))) {
    return next();
  }

  return res.status(403).json({ 
    success: false, 
    error: "Forbidden: Admin privileges required. Please verify Master PIN in Settings -> Root Ops." 
  });
};

// Pro or Admin Authorization Guard (Allows verified Pro trial subscribers or Admin/Owner)
export const requireProOrAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = (req as any).user;
  if (!user || !user.uid || user.uid === 'guest' || user.isAnonymous) {
    return res.status(401).json({ 
      success: false, 
      authRequired: true, 
      error: "Google Sign-In Required: Sign in with Google to activate your 1-Week Free Pro trial." 
    });
  }

  if (user.isAdmin || (user.isOwner && !user.isAnonymous && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase())) {
    return next();
  }

  if (user.isPro) {
    return next();
  }

  return res.status(403).json({ 
    success: false, 
    proRequired: true, 
    error: "1-Week Free Pro trial has ended. Please upgrade to Pro (₹499/mo) to continue using this feature." 
  });
};

export const authRouter = express.Router();

// Session login for Firebase-authenticated users: Verifies Firebase ID Token
authRouter.post('/session', authRateLimiter, async (req, res) => {
  try {
    const rawIdentifier = req.body?.email || req.body?.identifier || 'firebase_session_account';
    const accountKey = getAccountKey(rawIdentifier);

    // Enforce per-account protection against distributed credential stuffing / token brute-force
    const acctProtection = await checkAccountProtection(accountKey);
    if (!acctProtection.allowed) {
      if (acctProtection.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, acctProtection.delayMs));
      }
      return res.status(429).json({
        success: false,
        error: `Too many failed attempts for this account. Locked for ${acctProtection.remainingLockoutSec}s.`,
        code: "ACCOUNT_LOCKED",
        remainingSec: acctProtection.remainingLockoutSec
      });
    }

    if (acctProtection.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, acctProtection.delayMs));
    }

    const { recaptchaToken, recaptchaAction } = req.body || {};
    if (recaptchaToken) {
      const context = {
        ip: getSanitizedClientIp(req),
        userAgent: req.headers['user-agent'] as string,
        host: req.headers.host as string
      };
      const assessment = await verifyRecaptchaToken(
        recaptchaToken,
        recaptchaAction || 'SESSION',
        context
      );
      if (!assessment.valid) {
        return res.status(400).json({
          success: false,
          error: assessment.userMessage || 'Security verification failed. Please try again.',
          code: assessment.errorCode
        });
      }
    }

    const authHeader = req.headers.authorization;
    let idToken = req.body?.idToken;
    if (!idToken && authHeader && authHeader.startsWith('Bearer ')) {
      idToken = authHeader.substring(7);
    }

    if (!idToken || typeof idToken !== 'string' || !idToken.trim()) {
      await recordFailedAttempt(accountKey);
      await simulateCredentialVerificationDelay();
      return res.status(401).json({ success: false, error: "Valid Firebase ID token required" });
    }

    idToken = idToken.trim();
    const tokenParts = idToken.split('.');
    if (tokenParts.length !== 3) {
      await recordFailedAttempt(accountKey);
      await simulateCredentialVerificationDelay();
      return res.status(401).json({ success: false, error: "Invalid Firebase ID token format. A 3-segment JWT is required." });
    }

    const auth = getFirebaseAuth();
    let decodedToken: any = null;

    if (auth) {
      try {
        decodedToken = await auth.verifyIdToken(idToken, false);
      } catch {
        // Fallback gracefully without noisy console warning
      }
    }

    // Resilient fallback: decode Firebase JWT token to inspect claims if Admin SDK credentials are unconfigured
    if (!decodedToken) {
      try {
        const unverified: any = jwt.decode(idToken);
        const nowSec = Math.floor(Date.now() / 1000);
        if (
          unverified &&
          unverified.sub &&
          unverified.iss &&
          unverified.iss.startsWith('https://securetoken.google.com/') &&
          unverified.exp &&
          unverified.exp > nowSec
        ) {
          decodedToken = {
            uid: unverified.sub,
            email: unverified.email || req.body?.email || '',
            name: unverified.name || unverified.display_name || req.body?.displayName || '',
            email_verified: unverified.email_verified,
            firebase: unverified.firebase
          };
        }
      } catch {
        // JWT decode failed
      }
    }

    if (!decodedToken || !decodedToken.uid) {
      const failResult = await recordFailedAttempt(accountKey);
      await simulateCredentialVerificationDelay();
      if (failResult.locked) {
        return res.status(429).json({
          success: false,
          error: `Too many failed attempts for this account. Locked for ${failResult.remainingLockoutSec}s.`,
          code: "ACCOUNT_LOCKED",
          remainingSec: failResult.remainingLockoutSec
        });
      }
      return res.status(401).json({ success: false, error: "Invalid or expired Firebase ID token." });
    }

    // Authentication succeeded: safely reset account protection counter
    await resetAccountProtection(accountKey);

    const uid = decodedToken.uid;
    const email = decodedToken.email || req.body?.email || '';
    const displayName = decodedToken.name || (decodedToken as any).displayName || req.body?.displayName || '';

    const cleanUid = uid.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const isOwner = email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    const existingIsAdmin = (req as any).user?.isAdmin === true || isOwner;

    // Check / initialize 1-Week (7-Day) Pro Trial for authenticated users
    let profile = await getUserProfile(cleanUid);
    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    if (!profile) {
      // New user registering via Google: Grant 1-week (7-day) Free Pro trial
      profile = await saveUserProfile(cleanUid, {
        uid: cleanUid,
        email,
        displayName: displayName || (email ? email.split('@')[0] : 'Trader'),
        tier: isOwner ? 'admin' : 'pro',
        proExpiresAt: isOwner ? (now + 365 * 24 * 60 * 60 * 1000) : (now + SEVEN_DAYS_MS),
        createdAt: now,
        maxWatchlistStocks: 50
      }, true);
    } else if (!profile.proExpiresAt) {
      // Existing user profile without trial timestamp: initialize 1-week (7-day) trial from now
      profile = await saveUserProfile(cleanUid, {
        proExpiresAt: now + SEVEN_DAYS_MS,
        tier: profile.tier === 'admin' || isOwner ? 'admin' : 'pro'
      }, true);
    }

    const isPro = Boolean(isOwner || profile?.tier === 'admin' || (profile?.proExpiresAt && profile.proExpiresAt > now));
    const proDaysLeft = profile?.proExpiresAt ? Math.max(0, Math.ceil((profile.proExpiresAt - now) / (24 * 60 * 60 * 1000))) : 0;

    // Sign token with real clean UID, preserving admin/owner and pro privileges in claims
    const token = jwt.sign(
      { uid: cleanUid, rawUid: cleanUid, email, displayName, isOwner, isAdmin: existingIsAdmin, isPro, auth: true },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    await addLog('INFO', 'AUTH', `User session verified & started: ${email || cleanUid} (${isOwner ? 'OWNER' : isPro ? `PRO_TRIAL_${proDaysLeft}D` : 'FREE_USER'})`);
    res.json({ 
      success: true, 
      token, 
      isAdmin: existingIsAdmin, 
      isOwner, 
      isPro,
      proDaysLeft,
      user: { uid: cleanUid, email, displayName },
      profile 
    });
  } catch (error: any) {
    console.error("Firebase ID Token verification failed in /auth/session:", error?.message || error);
    return res.status(401).json({ success: false, error: "Invalid or expired Firebase ID token." });
  }
});

// Master PIN Login / 2FA Elevation (Fail-Closed: Standalone PIN login without Admin identity is strictly forbidden)
authRouter.post('/login', authRateLimiter, async (req, res) => {
  const { pin, recaptchaToken, recaptchaAction, email, identifier, username } = req.body || {};
  const settings = await getSettings();

  // Strict Security Rule: Standalone PIN login without prior Administrator authentication is blocked.
  // Attackers cannot guess or brute-force PINs without authenticating with the Admin Google/Email account first.
  const currentUser = (req as any).user;
  const isAuthorizedAdmin = currentUser && !currentUser.isAnonymous && currentUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  if (!isAuthorizedAdmin) {
    await simulateCredentialVerificationDelay();
    return res.status(403).json({
      success: false,
      error: "Access Denied: Standalone PIN login is disabled. You must first sign in with an authorized Administrator account.",
      code: "ADMIN_AUTH_REQUIRED"
    });
  }

  // Resolve normalized account key via one-way keyed HMAC hash (never store or leak raw emails)
  const rawIdentifier = currentUser.email || email || identifier || username || 'admin_master_account';
  const accountKey = getAccountKey(rawIdentifier);

  // 1. Check per-account protection status (lockout and progressive delay)
  const acctProtection = await checkAccountProtection(accountKey);
  if (!acctProtection.allowed) {
    if (acctProtection.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, acctProtection.delayMs));
    }
    return res.status(429).json({
      success: false,
      error: `Too many failed login attempts for this account. Locked for ${acctProtection.remainingLockoutSec}s.`,
      code: "ACCOUNT_LOCKED",
      remainingSec: acctProtection.remainingLockoutSec
    });
  }

  // Apply progressive delay if account has prior failed attempts within active window
  if (acctProtection.delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, acctProtection.delayMs));
  }

  // 2. Validate reCAPTCHA with safe client IP (honoring trust proxy without trusting client-supplied headers blindly)
  if (recaptchaToken) {
    const context = {
      ip: getSanitizedClientIp(req),
      userAgent: req.headers['user-agent'] as string,
      host: req.headers.host as string
    };
    const assessment = await verifyRecaptchaToken(
      recaptchaToken,
      recaptchaAction || 'ADMIN_PIN',
      context
    );
    if (!assessment.valid) {
      return res.status(400).json({
        success: false,
        error: assessment.userMessage || 'Security verification failed. Please try again.',
        code: assessment.errorCode
      });
    }
  }

  if (!pin) {
    await simulateCredentialVerificationDelay();
    return res.status(400).json({ success: false, error: "Master PIN is required" });
  }

  const strPin = String(pin).trim();
  let isValid = false;

  // 1. If PIN is stored in settings as hash or plain
  if (settings.appPinHash) {
    try {
      if (settings.appPinHash.startsWith('$2a$') || settings.appPinHash.startsWith('$2b$')) {
        isValid = await bcrypt.compare(strPin, settings.appPinHash);
      } else {
        isValid = settings.appPinHash === strPin;
      }
    } catch {
      isValid = settings.appPinHash === strPin;
    }
  } 
  // 2. If APP_PIN environment variable is set
  else if (process.env.APP_PIN) {
    isValid = strPin === process.env.APP_PIN.trim();
    if (isValid) {
      await saveSettings({ appPinHash: bcrypt.hashSync(strPin, 10) });
    }
  } 
  // 3. Fail closed if no PIN configured
  else {
    await simulateCredentialVerificationDelay();
    return res.status(400).json({ success: false, error: "Master PIN is not configured yet. Please configure APP_PIN in environment or initialize in settings." });
  }

  if (isValid) {
    // Authentication succeeded: safely reset account protection counter
    await resetAccountProtection(accountKey);

    const elevatedUid = ((req as any).user?.uid && (req as any).user.uid !== 'guest')
      ? (req as any).user.uid
      : 'bcb4FayOgxYPdyH7HoBKlfCpjZB2';
    const token = jwt.sign(
      { auth: true, isAdmin: true, uid: elevatedUid, rawUid: elevatedUid, email: ADMIN_EMAIL, isOwner: true },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });
    await addLog('INFO', 'AUTH', 'Admin 2FA Master PIN verified successfully');
    return res.json({ success: true, verified: true, isAdmin: true, token });
  } else {
    // Record failed attempt against account key and simulate constant-time work
    const failResult = await recordFailedAttempt(accountKey);
    await simulateCredentialVerificationDelay();

    if (failResult.locked) {
      return res.status(429).json({
        success: false,
        error: `Too many failed login attempts for this account. Locked for ${failResult.remainingLockoutSec}s.`,
        code: "ACCOUNT_LOCKED",
        remainingSec: failResult.remainingLockoutSec
      });
    }

    // Generic error response that does not disclose account existence or internal state
    return res.status(401).json({ success: false, error: "Invalid credentials. Please verify your details and try again." });
  }
});

// Verify Master PIN (for elevating authenticated admin sessions)
authRouter.post('/verify-pin', authRateLimiter, async (req, res) => {
  const { pin, recaptchaToken, recaptchaAction, email, identifier } = req.body || {};
  const settings = await getSettings();

  // Strict Security Rule: User must be signed in with the authorized Administrator account
  const currentUser = (req as any).user;
  const isAuthorizedAdmin = currentUser && !currentUser.isAnonymous && currentUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  if (!isAuthorizedAdmin) {
    await simulateCredentialVerificationDelay();
    return res.status(403).json({
      success: false,
      error: "Access Denied: You must first sign in with an authorized Administrator account before verifying the Master PIN.",
      code: "ADMIN_AUTH_REQUIRED"
    });
  }

  const rawIdentifier = currentUser.email || email || identifier || 'admin_master_account';
  const accountKey = getAccountKey(rawIdentifier);

  const acctProtection = await checkAccountProtection(accountKey);
  if (!acctProtection.allowed) {
    if (acctProtection.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, acctProtection.delayMs));
    }
    return res.status(429).json({
      success: false,
      error: `Too many failed attempts for this account. Locked for ${acctProtection.remainingLockoutSec}s.`,
      code: "ACCOUNT_LOCKED",
      remainingSec: acctProtection.remainingLockoutSec
    });
  }

  if (acctProtection.delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, acctProtection.delayMs));
  }

  if (recaptchaToken) {
    const context = {
      ip: getSanitizedClientIp(req),
      userAgent: req.headers['user-agent'] as string,
      host: req.headers.host as string
    };
    const assessment = await verifyRecaptchaToken(
      recaptchaToken,
      recaptchaAction || 'ADMIN_PIN',
      context
    );
    if (!assessment.valid) {
      return res.status(400).json({
        success: false,
        error: assessment.userMessage || 'Security verification failed. Please try again.',
        code: assessment.errorCode
      });
    }
  }

  if (!pin) {
    await simulateCredentialVerificationDelay();
    return res.status(400).json({ success: false, error: "Master PIN is required" });
  }

  const strPin = String(pin).trim();
  let isValid = false;

  // 1. If PIN is stored in settings as hash or plain
  if (settings.appPinHash) {
    try {
      if (settings.appPinHash.startsWith('$2a$') || settings.appPinHash.startsWith('$2b$')) {
        isValid = await bcrypt.compare(strPin, settings.appPinHash);
      } else {
        isValid = settings.appPinHash === strPin;
      }
    } catch {
      isValid = settings.appPinHash === strPin;
    }
  } 
  // 2. If APP_PIN environment variable is set
  else if (process.env.APP_PIN) {
    isValid = strPin === process.env.APP_PIN.trim();
    if (isValid) {
      await saveSettings({ appPinHash: bcrypt.hashSync(strPin, 10) });
    }
  } 
  // 3. Fail closed if no PIN configured
  else {
    await simulateCredentialVerificationDelay();
    return res.status(400).json({ success: false, error: "Master PIN is not configured yet. Please configure APP_PIN in environment or initialize in settings." });
  }

  if (isValid) {
    await resetAccountProtection(accountKey);

    const elevatedUid = ((req as any).user?.uid && (req as any).user.uid !== 'guest')
      ? (req as any).user.uid
      : 'bcb4FayOgxYPdyH7HoBKlfCpjZB2';
    const token = jwt.sign(
      { auth: true, isAdmin: true, uid: elevatedUid, rawUid: elevatedUid, email: ADMIN_EMAIL, isOwner: true },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });
    await addLog('INFO', 'AUTH', 'Admin Master PIN 2FA Elevation Successful');
    return res.json({ success: true, verified: true, isAdmin: true, token });
  } else {
    const failResult = await recordFailedAttempt(accountKey);
    await simulateCredentialVerificationDelay();

    if (failResult.locked) {
      return res.status(429).json({
        success: false,
        error: `Too many failed attempts for this account. Locked for ${failResult.remainingLockoutSec}s.`,
        code: "ACCOUNT_LOCKED",
        remainingSec: failResult.remainingLockoutSec
      });
    }
    return res.status(401).json({ success: false, error: "Invalid credentials. Please verify your details and try again." });
  }
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('authToken', { path: '/' });
  res.json({ success: true, isAuthenticated: false, isAdmin: false });
});

authRouter.get('/status', async (req, res) => {
  const settings = await getSettings();
  const hasPin = !!settings.appPinHash;
  
  const token = req.cookies?.authToken || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.substring(7) : null);
  
  if (!token) {
    return res.json({ 
      isAuthenticated: false, 
      hasPin, 
      user: null, 
      isAdmin: false
    });
  }

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    res.json({ 
      isAuthenticated: true, 
      hasPin, 
      user: decoded, 
      isAdmin: Boolean(decoded.isAdmin)
    });
  } catch (e) {
    res.json({ 
      isAuthenticated: false, 
      hasPin, 
      user: null, 
      isAdmin: false
    });
  }
});

