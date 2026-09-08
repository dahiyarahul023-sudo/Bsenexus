export interface Breadcrumb {
  action: string;
  category: string;
  timestamp: number;
  data?: any;
}

const breadcrumbs: Breadcrumb[] = [];
const MAX_BREADCRUMBS = 12;

export function addBreadcrumb(action: string, category: string = 'ui', data?: any) {
  breadcrumbs.push({
    action,
    category,
    timestamp: Date.now(),
    data
  });
  if (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs.shift();
  }
}

export function getBreadcrumbs(): Breadcrumb[] {
  return [...breadcrumbs];
}

export function detectDeviceInfo() {
  if (typeof window === 'undefined') {
    return {
      type: 'UNKNOWN' as const,
      os: 'Server',
      browser: 'Node',
      screen: 'N/A'
    };
  }

  const ua = navigator.userAgent || '';
  const width = window.screen?.width || window.innerWidth || 0;
  const height = window.screen?.height || window.innerHeight || 0;

  // Device Type
  const isMobile = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || (width < 768 && 'ontouchstart' in window);
  const isTablet = /iPad|Tablet|PlayBook/i.test(ua) || (width >= 768 && width <= 1024 && 'ontouchstart' in window);
  const type: 'MOBILE' | 'TABLET' | 'DESKTOP' = isTablet ? 'TABLET' : isMobile ? 'MOBILE' : 'DESKTOP';

  // OS Detection
  let os = 'Unknown OS';
  if (/Android/i.test(ua)) {
    const match = ua.match(/Android\s([0-9.]+)/i);
    os = match ? `Android ${match[1]}` : 'Android';
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    const match = ua.match(/OS\s([0-9_]+)/i);
    os = match ? `iOS ${match[1].replace(/_/g, '.')}` : 'iOS';
  } else if (/Windows NT 10.0/i.test(ua)) {
    os = 'Windows 10/11';
  } else if (/Windows/i.test(ua)) {
    os = 'Windows';
  } else if (/Mac OS X/i.test(ua)) {
    const match = ua.match(/Mac OS X\s([0-9_]+)/i);
    os = match ? `macOS ${match[1].replace(/_/g, '.')}` : 'macOS';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  // Browser Detection
  let browser = 'Unknown Browser';
  if (/Brave/i.test(ua) || (navigator as any).brave) {
    browser = 'Brave';
  } else if (/SamsungBrowser/i.test(ua)) {
    const match = ua.match(/SamsungBrowser\/([0-9.]+)/i);
    browser = match ? `Samsung Internet ${match[1].split('.')[0]}` : 'Samsung Internet';
  } else if (/Edg/i.test(ua)) {
    const match = ua.match(/Edg\/([0-9.]+)/i);
    browser = match ? `Edge ${match[1].split('.')[0]}` : 'Edge';
  } else if (/Chrome/i.test(ua)) {
    const match = ua.match(/Chrome\/([0-9.]+)/i);
    browser = match ? `Chrome ${match[1].split('.')[0]}` : 'Chrome';
  } else if (/Firefox/i.test(ua)) {
    const match = ua.match(/Firefox\/([0-9.]+)/i);
    browser = match ? `Firefox ${match[1].split('.')[0]}` : 'Firefox';
  } else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
    const match = ua.match(/Version\/([0-9.]+)/i);
    browser = match ? `Safari ${match[1].split('.')[0]}` : 'Safari';
  }

  // Connection & Memory
  const conn = (navigator as any).connection;
  const connection = conn?.effectiveType || (conn?.type ? String(conn.type) : undefined);
  const memoryMb = (navigator as any).deviceMemory ? (navigator as any).deviceMemory * 1024 : undefined;
  const isLowEndDevice = Boolean((memoryMb && memoryMb <= 2048) || (connection && (connection === '2g' || connection === 'slow-2g')));

  return {
    type,
    os,
    browser,
    screen: `${width}x${height}`,
    connection,
    memoryMb,
    isLowEndDevice
  };
}

let hasInitialized = false;

export function initClientTelemetry() {
  if (typeof window === 'undefined' || hasInitialized) return;
  hasInitialized = true;

  // 1. Capture Click Breadcrumbs
  document.addEventListener('click', (e) => {
    try {
      const target = e.target as HTMLElement;
      if (!target) return;
      const btn = target.closest('button') || target.closest('a') || target.closest('[role="button"]');
      if (btn) {
        const text = (btn.innerText || btn.getAttribute('title') || btn.getAttribute('aria-label') || btn.className || 'button').slice(0, 40).trim();
        addBreadcrumb(`Click: ${text || 'unnamed control'}`, 'click');
      }
    } catch {}
  }, { passive: true });

  // 2. Capture Unhandled Global JS Errors
  window.addEventListener('error', (event) => {
    try {
      const errMsg = String(event.message || '');
      // Filter out benign Vite HMR, WebSocket reconnects, database sleep, and browser layout notices
      if (
        /websocket/i.test(errMsg) ||
        /closed without opened/i.test(errMsg) ||
        /Failed to fetch dynamically imported module/i.test(errMsg) ||
        /ResizeObserver/i.test(errMsg) ||
        /Database is closing/i.test(errMsg) ||
        /AbortError/i.test(errMsg)
      ) {
        return;
      }
      sendTelemetryEvent({
        type: 'ERROR',
        error: {
          message: errMsg,
          stack: event.error?.stack || '',
          source: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          severity: 'CRITICAL',
          breadcrumbs: getBreadcrumbs(),
          url: window.location.pathname + window.location.search
        }
      });
    } catch {}
  });

  // 3. Capture Unhandled Promise Rejections
  window.addEventListener('unhandledrejection', (event) => {
    try {
      const reason = event.reason;
      const errMsg = typeof reason === 'string' ? reason : String(reason?.message || 'Unhandled Promise Rejection');
      if (
        /websocket/i.test(errMsg) ||
        /closed without opened/i.test(errMsg) ||
        /AbortError/i.test(errMsg) ||
        /Failed to fetch dynamically imported module/i.test(errMsg) ||
        /Database is closing/i.test(errMsg) ||
        /ResizeObserver/i.test(errMsg)
      ) {
        return;
      }

      sendTelemetryEvent({
        type: 'ERROR',
        error: {
          message: errMsg,
          stack: reason?.stack || '',
          severity: 'ERROR',
          breadcrumbs: getBreadcrumbs(),
          url: window.location.pathname + window.location.search
        }
      });
    } catch {}
  });

  // 4. Capture Page Performance Metrics (on window load)
  const reportPerformance = () => {
    try {
      setTimeout(() => {
        const navEntries = performance.getEntriesByType('navigation');
        let pageLoadTimeMs = 450;
        let ttfbMs = 80;
        let domContentLoadedMs = 300;

        if (navEntries.length > 0) {
          const nav: any = navEntries[0];
          pageLoadTimeMs = Math.round(nav.loadEventEnd || nav.duration || 450);
          ttfbMs = Math.round(nav.responseStart - nav.requestStart || 80);
          domContentLoadedMs = Math.round(nav.domContentLoadedEventEnd || 300);
        } else if (performance.timing) {
          const t = performance.timing;
          if (t.loadEventEnd > 0) {
            pageLoadTimeMs = t.loadEventEnd - t.navigationStart;
            ttfbMs = t.responseStart - t.requestStart;
            domContentLoadedMs = t.domContentLoadedEventEnd - t.navigationStart;
          }
        }

        if (pageLoadTimeMs > 0 && pageLoadTimeMs < 60000) {
          sendTelemetryEvent({
            type: 'PERFORMANCE',
            performance: {
              pageLoadTimeMs,
              ttfbMs,
              domContentLoadedMs,
              path: window.location.pathname
            }
          });
        }
      }, 1500);
    } catch {}
  };

  if (document.readyState === 'complete') {
    reportPerformance();
  } else {
    window.addEventListener('load', reportPerformance, { once: true });
  }
}

export function sendTelemetryEvent(payload: {
  type: 'PERFORMANCE' | 'ERROR' | 'WEB_VITAL' | 'API_METRIC' | 'DEVICE_INFO';
  performance?: any;
  error?: any;
  api?: any;
}) {
  try {
    const device = detectDeviceInfo();
    const body = JSON.stringify({
      ...payload,
      timestamp: Date.now(),
      device
    });

    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/telemetry/event', blob);
    } else {
      fetch('/api/telemetry/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true
      }).catch(() => {});
    }
  } catch {}
}
