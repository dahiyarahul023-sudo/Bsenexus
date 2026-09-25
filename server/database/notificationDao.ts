import { readLocalJson, writeLocalJson } from './localStore.js';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'RESULT' | 'DIVIDEND' | 'BUYBACK' | 'BONUS_SPLIT' | 'ORDER_WIN' | 'BOARD_MEETING' | 'RULE_MATCH' | 'GENERAL';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  symbol: string;
  scripCode: string;
  newsId?: string;
  pdfLink?: string;
  timestamp: number;
  isRead: boolean;
  userId?: string;
  isWatchlist?: boolean;
  metadata?: Record<string, any>;
}

const NOTIFICATIONS_FILE = 'notifications.json';
// Initial load: filter out any legacy non-watchlist junk from disk
let rawLoaded = readLocalJson<AppNotification[]>(NOTIFICATIONS_FILE, []);
let notificationsCache: AppNotification[] = rawLoaded.filter(n => Boolean(n.isWatchlist));
writeLocalJson(NOTIFICATIONS_FILE, notificationsCache);

let saveDiskTimer: NodeJS.Timeout | null = null;
function scheduleSave() {
  if (saveDiskTimer) return;
  saveDiskTimer = setTimeout(() => {
    saveDiskTimer = null;
    writeLocalJson(NOTIFICATIONS_FILE, notificationsCache);
  }, 1000);
}

export interface NotificationFilterOptions {
  watchlistOnly?: boolean;
  type?: string;
  unreadOnly?: boolean;
}

export function getAllNotifications(userId: string = 'guest', limit: number = 100, options: NotificationFilterOptions = {}): AppNotification[] {
  let filtered = notificationsCache.filter(n => {
    if (!n.userId || n.userId === 'system' || n.userId === 'all') return true;
    return n.userId === userId;
  });

  // Default to Watchlist Only unless explicitly disabled
  if (options.watchlistOnly !== false) {
    filtered = filtered.filter(n => Boolean(n.isWatchlist));
  }

  if (options.unreadOnly) {
    filtered = filtered.filter(n => !n.isRead);
  }

  if (options.type && options.type !== 'ALL') {
    if (options.type === 'RESULTS') {
      filtered = filtered.filter(n => n.type === 'RESULT' || n.type === 'BOARD_MEETING');
    } else if (options.type === 'ACTIONS') {
      filtered = filtered.filter(n => n.type === 'DIVIDEND' || n.type === 'BUYBACK' || n.type === 'BONUS_SPLIT');
    } else if (options.type === 'ORDERS') {
      filtered = filtered.filter(n => n.type === 'ORDER_WIN');
    }
  }

  return filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, limit);
}

export function getUnreadNotificationCount(userId: string = 'guest', watchlistOnly: boolean = true): number {
  return notificationsCache.filter(n => {
    const userMatch = !n.userId || n.userId === 'system' || n.userId === 'all' || n.userId === userId;
    const wlMatch = !watchlistOnly || Boolean(n.isWatchlist);
    return userMatch && wlMatch && !n.isRead;
  }).length;
}

export function addNotification(notif: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'> & { id?: string; timestamp?: number; isRead?: boolean }): AppNotification {
  const ownerId = notif.userId && typeof notif.userId === 'string' ? notif.userId : 'system';
  const id = notif.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  
  // Avoid exact duplicate for the SAME user within 2 hours
  const existing = notificationsCache.find(n => 
    (n.userId === ownerId) &&
    ((notif.newsId && n.newsId === notif.newsId) ||
    (n.symbol === notif.symbol && n.title === notif.title && Math.abs(n.timestamp - (notif.timestamp || Date.now())) < 7200000))
  );

  if (existing) {
    if (notif.isWatchlist && !existing.isWatchlist) {
      existing.isWatchlist = true;
      scheduleSave();
    }
    return existing;
  }

  const newNotif: AppNotification = {
    id,
    timestamp: notif.timestamp || Date.now(),
    isRead: notif.isRead || false,
    ...notif,
    userId: ownerId
  };

  notificationsCache.unshift(newNotif);
  if (notificationsCache.length > 500) {
    notificationsCache = notificationsCache.slice(0, 500);
  }

  scheduleSave();
  return newNotif;
}

export function addNotificationsBatch(
  notifs: (Omit<AppNotification, 'id' | 'timestamp' | 'isRead'> & { id?: string; timestamp?: number; isRead?: boolean })[]
): AppNotification[] {
  if (!Array.isArray(notifs) || notifs.length === 0) return [];

  const added: AppNotification[] = [];
  let modified = false;

  for (const notif of notifs) {
    if (!notif) continue;
    const ownerId = notif.userId && typeof notif.userId === 'string' ? notif.userId : 'system';
    const id = notif.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const existing = notificationsCache.find(n => 
      (n.userId === ownerId) &&
      ((notif.newsId && n.newsId === notif.newsId) ||
      (n.symbol === notif.symbol && n.title === notif.title && Math.abs(n.timestamp - (notif.timestamp || Date.now())) < 7200000))
    );

    if (existing) {
      if (notif.isWatchlist && !existing.isWatchlist) {
        existing.isWatchlist = true;
        modified = true;
      }
      added.push(existing);
      continue;
    }

    const newNotif: AppNotification = {
      id,
      timestamp: notif.timestamp || Date.now(),
      isRead: notif.isRead || false,
      ...notif,
      userId: ownerId
    };

    notificationsCache.unshift(newNotif);
    added.push(newNotif);
    modified = true;
  }

  if (notificationsCache.length > 500) {
    notificationsCache = notificationsCache.slice(0, 500);
  }

  if (modified) {
    scheduleSave();
  }

  return added;
}

export function markNotificationsReadBatch(ids: string[], userId: string = 'guest'): number {
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  const idSet = new Set(ids);
  let changedCount = 0;

  notificationsCache = notificationsCache.map(n => {
    if (idSet.has(n.id) && (n.userId === userId || !n.userId || n.userId === 'system' || n.userId === 'all')) {
      if (!n.isRead) {
        changedCount++;
        return { ...n, isRead: true };
      }
    }
    return n;
  });

  if (changedCount > 0) {
    scheduleSave();
  }
  return changedCount;
}

export function markNotificationRead(id: string, userId: string = 'guest'): boolean {
  let changed = false;
  notificationsCache = notificationsCache.map(n => {
    if (n.id === id && (n.userId === userId || !n.userId || n.userId === 'system' || n.userId === 'all')) {
      changed = true;
      return { ...n, isRead: true };
    }
    return n;
  });
  if (changed) scheduleSave();
  return changed;
}

export function markAllNotificationsRead(userId: string = 'guest'): void {
  notificationsCache = notificationsCache.map(n => {
    if (n.userId === userId || !n.userId || n.userId === 'system' || n.userId === 'all') {
      return { ...n, isRead: true };
    }
    return n;
  });
  scheduleSave();
}

export function clearAllNotifications(userId: string = 'guest'): void {
  const prevCount = notificationsCache.length;
  notificationsCache = notificationsCache.filter(n => {
    // Only delete notifications that strictly belong to the calling user
    if (n.userId === userId) {
      return false;
    }
    if (userId === 'guest' && (!n.userId || n.userId === 'guest')) {
      return false;
    }
    // Keep system-wide, broadcast, and other users' notifications
    return true;
  });
  if (notificationsCache.length !== prevCount) {
    scheduleSave();
  }
}
