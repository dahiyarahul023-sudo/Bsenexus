import 'dotenv/config';
import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import { createServer as createViteServer } from "vite";

import { authMiddleware, authRouter, apiRateLimiter } from "./server/security/auth.js";
import { apiRouter } from "./server/api/routes.js";
import { processAnnouncements, getConsecutiveFailures, pruneAndCheckStorageCapacity } from "./server/services/monitor.js";
import { fetchAndSyncResultsCalendar } from "./server/services/resultsCalendarService.js";
import { syncWatchlistHistoricalData, backfillRecentAnnouncements } from "./server/services/bse.js";
import { initWatchlists } from "./server/database/watchlistDao.js";
import { getTelegramHealth, updateTelegramHealth } from "./server/services/telegram.js";
import { processAutomatedNewsAlerts } from "./server/services/stockNewsService.js";
import { addLog } from "./server/database/logDao.js";
import { getPollingIntervalMs } from "./server/utils/helpers.js";
import { resumeFirestoreNetwork } from "./server/database/firebase.js";
import { isFirestoreQuotaExceeded, getManualStorageMode, resetAdminPermissionDenied } from "./server/database/localStore.js";

// Global error handlers to prevent background quota/network exceptions from crashing the process
process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled Rejection caught:', reason?.message || reason);
});
process.on('uncaughtException', (err: any) => {
  console.error('Uncaught Exception caught:', err?.message || err);
});

const app = express();
const PORT = 3000;

// Trust reverse proxy (Cloud Run / Nginx) so client IP and rate-limiting work properly
app.set('trust proxy', 1);

const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://apis.google.com"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
  connectSrc: [
    "'self'",
    "https:",
    "http:",
    "ws:",
    "wss:",
    "https://www.bseindia.com",
    "https://api.telegram.org",
    "https://firestore.googleapis.com",
    "https://identitytoolkit.googleapis.com",
    "https://generativelanguage.googleapis.com"
  ],
  frameSrc: ["'self'", "https://accounts.google.com", "https://*.firebaseapp.com", "https://*.google.com"],
  fontSrc: ["'self'", "data:", "https:"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"]
};

// Enable Gzip/Deflate compression for production responses (JS, CSS, HTML, JSON)
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    if (process.env.NODE_ENV !== 'production') {
      return false;
    }
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  frameguard: false,
  crossOriginOpenerPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
app.use(express.json());
app.use(cookieParser());
app.use(authMiddleware);

// Explicit Service Worker handler with no-cache headers
app.get('/sw.js', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  if (process.env.NODE_ENV !== 'production') {
    // In development mode, serve an unregistering Service Worker to prevent stale chunk conflicts
    res.send(`// Development Service Worker - clears all caches and self-unregisters
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.claim())
  );
});
`);
  } else {
    res.sendFile(path.join(process.cwd(), 'public', 'sw.js'));
  }
});

// Serve static assets from public directory (favicons, apple-touch-icons, manifest, etc.)
app.use(express.static(path.join(process.cwd(), 'public'), {
  maxAge: '1d',
  immutable: false
}));

// Explicit SEO & AI Crawler Handlers (GEO / AEO Standards)
app.get('/robots.txt', (_req, res) => {
  res.type('text/plain; charset=utf-8');
  res.sendFile(path.join(process.cwd(), 'public', 'robots.txt'));
});

app.get('/sitemap.xml', (_req, res) => {
  res.type('application/xml; charset=utf-8');
  res.sendFile(path.join(process.cwd(), 'public', 'sitemap.xml'));
});

app.get('/llms.txt', (_req, res) => {
  res.type('text/plain; charset=utf-8');
  res.sendFile(path.join(process.cwd(), 'public', 'llms.txt'));
});

app.get('/llms-full.txt', (_req, res) => {
  res.type('text/plain; charset=utf-8');
  res.sendFile(path.join(process.cwd(), 'public', 'llms-full.txt'));
});

// Authentication Routes (Login/Logout/Status)
app.use('/auth', authRouter);

// Protected API Routes with Rate Limiting
app.use('/api', apiRateLimiter, apiRouter);


// Ensure any /api or /auth endpoint that errors or doesn't match returns JSON 404/500, NOT HTML
app.use(['/api/*', '/auth/*'], (req, res) => {
  res.status(404).json({ success: false, error: "API route not found" });
});


app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
    console.error("API Error handler caught:", err?.message || err);
    return res.status(500).json({ error: err?.message || "Internal Server Error" });
  }
  next(err);
});

// Background Poller (15s base with natural jitter & circuit-breaker backoff on failures)
async function scheduleAnnouncementPoller() {
  const startMs = Date.now();
  try {
    await processAnnouncements();
  } catch (error: any) {
    await addLog('ERROR', 'SYSTEM', `Unhandled poller error: ${error.message}`);
  } finally {
    const elapsedMs = Date.now() - startMs;
    const failures = getConsecutiveFailures();
    const targetIntervalMs = getPollingIntervalMs(failures);
    const nextInterval = Math.max(0, targetIntervalMs - elapsedMs);
    setTimeout(scheduleAnnouncementPoller, nextInterval);
  }
}
scheduleAnnouncementPoller();

// Independent Storage Capacity & Pruning (Every 15 minutes, completely decoupled from critical poller path)
setTimeout(() => {
  pruneAndCheckStorageCapacity().catch(e => console.error("Initial storage check err:", e.message));
}, 10000);
setInterval(() => {
  pruneAndCheckStorageCapacity().catch(e => console.error("Periodic storage check err:", e.message));
}, 15 * 60 * 1000);

// Results Calendar Sync, Watchlists Init & Historical Sync
setTimeout(() => {
  initWatchlists().catch(e => console.info("[WatchlistDao] Initial watchlist check:", e?.message || e));
  updateTelegramHealth().catch(e => console.error("Initial telegram health check err:", e.message));
  fetchAndSyncResultsCalendar().catch(e => console.error("Initial results calendar sync err:", e.message));
  syncWatchlistHistoricalData().catch(e => console.error("Initial watchlist historical sync err:", e.message));
  backfillRecentAnnouncements().catch(e => console.error("Initial backfill announcements err:", e.message));
}, 3000);
setInterval(() => {
  fetchAndSyncResultsCalendar(true).catch(e => console.error("Periodic results calendar sync err:", e.message));
  syncWatchlistHistoricalData().catch(e => console.error("Periodic watchlist historical sync err:", e.message));
}, 24 * 60 * 60 * 1000);

// 24/7 Background Multi-Source RSS News Worker (Runs every 3 minutes to auto-dispatch watchlist stock news to Telegram)
setTimeout(() => {
  processAutomatedNewsAlerts().catch(e => console.warn("[StockNewsWorker] Initial pass notice:", e.message));
}, 8000);
setInterval(() => {
  processAutomatedNewsAlerts().catch(e => console.warn("[StockNewsWorker] Interval pass error:", e.message));
}, 3 * 60 * 1000);

// Auto-Recovery Check: Every 10 minutes, verify if Pacific Midnight passed / quota flag cleared / permission lock expired, and resume Firestore network
setInterval(async () => {
  try {
    const mode = getManualStorageMode();
    if (mode !== 'FORCE_LOCAL') {
      resetAdminPermissionDenied();
      const isExceeded = isFirestoreQuotaExceeded();
      if (!isExceeded) {
        await resumeFirestoreNetwork();
      }
    }
  } catch (err: any) {
    console.warn("Storage auto-recovery interval error:", err?.message || err);
  }
}, 10 * 60 * 1000);

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      }
    }));
    app.get("*", (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`Server running on port ${PORT}`);
    try { await addLog('INFO', 'SYSTEM', 'BSE Nexus Server Started'); } catch(e) { console.error('DB connect err:', e); }
  });
}

startServer();
