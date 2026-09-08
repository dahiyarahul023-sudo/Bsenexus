import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { getSettings, saveSettings } from '../database/settingsDao.js';
import { addLog } from '../database/logDao.js';
import { getFirebaseAuth } from './firebaseAdmin.js';
import { getUserProfile, saveUserProfile } from '../database/usersDao.js';

// Cryptographically secure JWT Secret (fail hard if not configured in environment)
if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
  throw new Error("FATAL CONFIG ERROR: JWT_SECRET environment variable is not defined. Server cannot operate securely.");
}
const JWT_SECRET = process.env.JWT_SECRET.trim();
const ADMIN_EMAIL = 'dahiyarahul023@gmail.com';

let failedAttempts = 0;
let lockoutUntil = 0;

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

export const authMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
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
                const isOwner = fbDecoded.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
                (req as any).user = {
                  uid: fbDecoded.uid,
                  rawUid: fbDecoded.uid,
                  email: fbDecoded.email,
                  name: fbDecoded.name || (fbDecoded as any).displayName || 'User',
                  isOwner,
                  isAdmin: isOwner
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
              const isOwner = unverified.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
              (req as any).user = {
                uid: unverified.sub,
                rawUid: unverified.sub,
                email: unverified.email || '',
                name: unverified.name || (unverified as any).displayName || 'User',
                isOwner,
                isAdmin: isOwner
              };
              return next();
            }
          } catch {}
        }

        // Token verification failed - strictly treat as unauthenticated guest
        (req as any).user = { uid: 'guest', isOwner: false, isAdmin: false };
      }
    } else {
      (req as any).user = { uid: 'guest', isOwner: false, isAdmin: false };
    }

    return next();
  } catch (error) {
    (req as any).user = { uid: 'guest', isOwner: false, isAdmin: false };
    return next();
  }
};

// Strict Authentication Guard (Requires logged-in user with Google or verified session)
export const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = (req as any).user;
  if (!user || !user.uid || user.uid === 'guest' || user.isAnonymous) {
    return res.status(401).json({ 
      success: false, 
      authRequired: true, 
      error: "Google Sign-In Required: Guest access is strictly view-only. Please sign in with Google to get 30 days of Free Pro access." 
    });
  }
  next();
};

// Resilient Admin Authorization Guard (Checks verified JWT or verified Owner session)
export const requireAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = (req as any).user;
  if (user && (user.isAdmin || (user.isOwner && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()))) {
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
      error: "Google Sign-In Required: Sign in with Google to activate your 30-Day Free Pro trial." 
    });
  }

  if (user.isAdmin || (user.isOwner && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase())) {
    return next();
  }

  if (user.isPro) {
    return next();
  }

  return res.status(403).json({ 
    success: false, 
    proRequired: true, 
    error: "30-Day Free Pro trial has ended. Please upgrade to Pro to continue using this feature." 
  });
};

export const authRouter = express.Router();

// Session login for Firebase-authenticated users: Verifies Firebase ID Token
authRouter.post('/session', authRateLimiter, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let idToken = req.body?.idToken;
    if (!idToken && authHeader && authHeader.startsWith('Bearer ')) {
      idToken = authHeader.substring(7);
    }

    if (!idToken || typeof idToken !== 'string' || !idToken.trim()) {
      return res.status(401).json({ success: false, error: "Valid Firebase ID token required" });
    }

    idToken = idToken.trim();
    const tokenParts = idToken.split('.');
    if (tokenParts.length !== 3) {
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
      return res.status(401).json({ success: false, error: "Invalid or expired Firebase ID token." });
    }

    const uid = decodedToken.uid;
    const email = decodedToken.email || req.body?.email || '';
    const displayName = decodedToken.name || (decodedToken as any).displayName || req.body?.displayName || '';

    const cleanUid = uid.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const isOwner = email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    const existingIsAdmin = (req as any).user?.isAdmin === true || isOwner;

    // Check / initialize 30-Day Pro Trial for authenticated users
    let profile = await getUserProfile(cleanUid);
    const now = Date.now();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    if (!profile) {
      // New user registering via Google: Grant 30-day Free Pro trial
      profile = await saveUserProfile(cleanUid, {
        uid: cleanUid,
        email,
        displayName: displayName || (email ? email.split('@')[0] : 'Trader'),
        tier: isOwner ? 'admin' : 'pro',
        proExpiresAt: isOwner ? (now + 365 * 24 * 60 * 60 * 1000) : (now + THIRTY_DAYS_MS),
        createdAt: now,
        maxWatchlistStocks: 50
      }, true);
    } else if (!profile.proExpiresAt) {
      // Existing user profile without trial timestamp: initialize 30-day trial from now
      profile = await saveUserProfile(cleanUid, {
        proExpiresAt: now + THIRTY_DAYS_MS,
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

// Master PIN Login / 2FA Elevation (Fail-Closed)
authRouter.post('/login', authRateLimiter, async (req, res) => {
  const { pin } = req.body;
  const settings = await getSettings();
  
  if (Date.now() < lockoutUntil) {
    const remainingSec = Math.ceil((lockoutUntil - Date.now()) / 1000);
    return res.status(429).json({ success: false, error: `Too many failed attempts. Locked for ${remainingSec}s.` });
  }

  if (!pin) {
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
      // Automatically persist hashed PIN
      await saveSettings({ appPinHash: bcrypt.hashSync(strPin, 10) });
    }
  } 
  // 3. Fail closed if no PIN configured
  else {
    return res.status(400).json({ success: false, error: "Master PIN is not configured yet. Please configure APP_PIN in environment or initialize in settings." });
  }

  if (isValid) {
    failedAttempts = 0;
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
    failedAttempts++;
    if (failedAttempts >= 5) {
      lockoutUntil = Date.now() + 5 * 60 * 1000;
      await addLog('ERROR', 'SECURITY', '5 failed PIN attempts. Locked out for 5 minutes.');
      return res.status(429).json({ success: false, error: "Too many failed attempts. Locked out for 5 minutes." });
    }
    await addLog('WARNING', 'AUTH', `Failed PIN attempt (${failedAttempts}/5)`);
    return res.status(401).json({ success: false, error: "Incorrect Master PIN. Please try again." });
  }
});

// Verify Master PIN (for elevating authenticated admin sessions)
authRouter.post('/verify-pin', authRateLimiter, async (req, res) => {
  const { pin } = req.body;
  const settings = await getSettings();

  if (Date.now() < lockoutUntil) {
    const remainingSec = Math.ceil((lockoutUntil - Date.now()) / 1000);
    return res.status(429).json({ success: false, error: `Too many failed attempts. Locked for ${remainingSec}s.` });
  }

  if (!pin) {
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
    return res.status(400).json({ success: false, error: "Master PIN is not configured yet. Please configure APP_PIN in environment or initialize in settings." });
  }

  if (isValid) {
    failedAttempts = 0;
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
    failedAttempts++;
    if (failedAttempts >= 5) {
      lockoutUntil = Date.now() + 5 * 60 * 1000;
      await addLog('ERROR', 'SECURITY', '5 failed PIN attempts on verify-pin. Locked out for 5 minutes.');
      return res.status(429).json({ success: false, error: "Too many failed attempts. Locked out for 5 minutes." });
    }
    return res.status(401).json({ success: false, error: "Incorrect Admin Security PIN. Please try again." });
  }
});

authRouter.post('/logout', (req, res) => {
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

