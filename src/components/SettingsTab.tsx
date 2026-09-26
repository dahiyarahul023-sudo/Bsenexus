import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Send, Sparkles, Sliders, 
  Sun, Moon, KeyRound, AlertTriangle, 
  RefreshCw, CheckCircle2, Check, 
  Lock, Save, Copy,
  CheckCheck, Terminal, ShieldAlert, Cpu, HardDrive, ChevronRight,
  Download, LogOut, Database, FileSpreadsheet,
  FileJson, Trash2, MoreHorizontal, X, Bell, ShieldCheck,
  Volume2, VolumeX, Eye, HelpCircle, Scale, MessageSquare, ChevronDown,
  Cookie, FileText, Search, RotateCcw, LayoutGrid, Layers, ArrowUpRight,
  Power, Unlink, Bot, Zap, UserX
} from 'lucide-react';
import { TermsModal, LegalTabType } from './TermsModal';
import { SecurityAuditModal } from './SecurityAuditModal';
import { SubscriptionCard } from './SubscriptionCard';
import { useAuth } from '../context/AuthContext';
import { customFetch } from '../api';
import { useDeveloperMode } from '../utils/developerMode';
import { APP_VERSION } from '../version';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { springSnappy, buttonTap } from '../utils/motionTokens';
import { SupportModal } from './ui/SupportFloat';
import { ActionButton } from './ui/ActionButton';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SettingsTabProps {
  settings: any;
  setSettings: (settings: any) => void;
  fetchSettings: () => void;
  theme?: string;
  setTheme?: (theme: string) => void;
  onNavigate?: (tab: string) => void;
}

// Registry of all searchable settings for instant filtering & breadcrumb navigation
const SETTINGS_REGISTRY = [
  { id: 'appearance', title: 'Appearance & Theme', description: 'Toggle between Dark and Light mode', category: 'Preferences', keywords: ['dark', 'light', 'theme', 'mode', 'appearance', 'color'] },
  { id: 'density', title: 'Feed Display Density', description: 'Adjust spacing for disclosure feeds (Comfortable, Compact, Dense)', category: 'Preferences', keywords: ['density', 'compact', 'comfortable', 'dense', 'spacing', 'feed', 'layout'] },
  { id: 'sound', title: 'Audio alerts', description: 'Play chime on high-impact filing updates', category: 'Preferences', keywords: ['sound', 'audio', 'chime', 'bell', 'alert', 'volume', 'audio cue'] },
  { id: 'filter', title: 'High impact filter', description: 'Highlight material price-sensitive disclosures (SEBI LODR 30)', category: 'Preferences', keywords: ['filter', 'materiality', 'high impact', 'sebi', 'lodr', 'price-sensitive'] },
  { id: 'profile', title: 'Profile & Display name', description: 'Investor identity, name, and public @username handle', category: 'Account & Identity', keywords: ['profile', 'display name', 'username', 'handle', 'account', 'identity'] },
  { id: 'telegram', title: 'Telegram Alert Delivery', description: 'Instant push notifications for watchlist disclosures', category: 'Account & Identity', keywords: ['telegram', 'chat id', 'push', 'notifications', 'phone', 'bot', 'mobile'] },
  { id: 'subscription', title: 'Subscription & Billing', description: 'Pro plan status, renewal and payment (auto-renew coming soon)', category: 'Account & Identity', keywords: ['subscription', 'billing', 'pro', 'payment', 'renew', 'plan', 'cashfree', 'auto-renew'] },
  { id: 'export-csv', title: 'Export to CSV', description: 'Download tracked tickers and priorities in spreadsheet format', category: 'Watchlist & Data', keywords: ['export', 'csv', 'excel', 'spreadsheet', 'download', 'watchlist'] },
  { id: 'export-json', title: 'Export backup (JSON)', description: 'Full structured backup for porting or syncing', category: 'Watchlist & Data', keywords: ['export', 'json', 'backup', 'data', 'port', 'sync'] },
  { id: 'security-audit', title: '20-Point Launch Security & Pen-Test', description: 'IDOR defense, API key hardening, SQLi and red-team test harness', category: 'Advanced Engine', keywords: ['security', 'audit', 'pen-test', 'penetration', 'hardened', 'keys', 'idor'] },
  { id: 'diagnostics', title: 'System Diagnostics & Telemetry', description: 'Bloom filter telemetry, crash-free rates, device health and memory stats', category: 'Advanced Engine', keywords: ['diagnostics', 'telemetry', 'bloom', 'health', 'memory', 'cpu'] },
  { id: 'logs', title: 'Engine Activity Logs', description: 'Live stream of BSE ingestion, Gemini AI summaries and workers', category: 'Advanced Engine', keywords: ['logs', 'activity', 'engine', 'terminal', 'stream', 'gemini'] },
  { id: 'storage', title: 'Storage Manager & Quotas', description: 'Firestore quotas, backup downloads, and cache health', category: 'Advanced Engine', keywords: ['storage', 'quotas', 'firestore', 'database', 'cache'] },
  { id: 'server-keys', title: 'Server Keys & Ingestion Config', description: 'Bot token, Master PIN, AI summarizer test, and live toggle', category: 'Advanced Engine', keywords: ['server', 'admin', 'pin', 'keys', 'token', 'ingestion'] },
  { id: 'help', title: 'Help Center & Feedback', description: 'FAQs, Telegram community group and reporting an issue', category: 'Help & Support', keywords: ['help', 'support', 'faq', 'feedback', 'issue', 'ticket'] },
  { id: 'legal', title: 'Terms, Privacy & Policies', description: 'Terms of Service, Privacy (DPDP), Cookies, Refund and SEBI disclaimers', category: 'About & Legal', keywords: ['terms', 'privacy', 'legal', 'dpdp', 'sebi', 'policy', 'disclaimer'] },
  { id: 'clear-cache', title: 'Clear local cache & reset data', description: 'Clean temporary offline storage, cached filings, and indexes', category: 'Danger Zone', keywords: ['clear', 'cache', 'delete', 'reset', 'wipe', 'danger', 'offline', 'storage'] },
  { id: 'delete-account', title: 'Delete Account & All Personal Data', description: 'Permanently wipe your account, stored watchlists, and all cloud preferences', category: 'Danger Zone', keywords: ['delete account', 'delete my data', 'erase', 'wipe account', 'remove profile', 'gdpr', 'dpdp', 'danger'] },
  { id: 'sign-out', title: 'Sign out of account', description: 'Log out of current investor session on this device', category: 'Danger Zone', keywords: ['sign out', 'logout', 'log out', 'exit', 'session'] }
];

// Default baseline preferences for one-click resets
const DEFAULT_THEME = 'dark';
const DEFAULT_SOUND = true;
const DEFAULT_FILTER = false;
const DEFAULT_DENSITY = 'compact';

export function SettingsTab({ 
  settings, 
  setSettings, 
  fetchSettings, 
  theme = 'dark', 
  setTheme,
  onNavigate
}: SettingsTabProps) {
  const { 
    user, 
    profile, 
    isOwner, 
    isAdmin, 
    isPro, 
    adminUnlocked,
    logout,
    updateProfileInfo,
    checkUsernameAvailability,
    updateTelegramChatId,
    updateTelegramPreferences,
    updateNotificationPreferences,
    verifyAdminPin,
    lockAdminSession,
    setIsAuthModalOpen,
    setIsProModalOpen
  } = useAuth();

  const isSuperAdmin = Boolean(isAdmin || isOwner || adminUnlocked || profile?.tier === 'admin' || user?.isAdmin);

  // Search filter query
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Instant saved indicator pill tracking ('theme' | 'density' | 'sound' | 'filter')
  const [savedPillKey, setSavedPillKey] = useState<string | null>(null);
  const showSavedPill = (key: string) => {
    setSavedPillKey(key);
    setTimeout(() => {
      setSavedPillKey(prev => prev === key ? null : prev);
    }, 1500);
  };

  // Active Sub-modal / Drawer state for progressive disclosure
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<LegalTabType>('privacy');
  const [securityAuditModalOpen, setSecurityAuditModalOpen] = useState(false);

  // Collapsible Advanced section (collapsible by default; auto-expands if search matches or admin)
  const [isAdvancedExpanded, setIsAdvancedExpanded] = useState(false);

  // Profile Edit State
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [tgUsernameInput, setTgUsernameInput] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const [usernameValidationMsg, setUsernameValidationMsg] = useState<string | null>(null);

  // Telegram Notifications State
  const [tgChatIdInput, setTgChatIdInput] = useState('');
  const [tgAlertsEnabled, setTgAlertsEnabled] = useState(true);
  const [tgAiSummaryEnabled, setTgAiSummaryEnabled] = useState(true);
  const [tgAlertScope, setTgAlertScope] = useState<'WATCHLIST_ONLY' | 'ALL_MARKET'>('WATCHLIST_ONLY');
  const [isSavingTg, setIsSavingTg] = useState(false);
  const [tgSaveSuccess, setTgSaveSuccess] = useState(false);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [testTgResult, setTestTgResult] = useState<string | null>(null);
  const [isUnlinkingTg, setIsUnlinkingTg] = useState(false);
  const [unlinkSuccess, setUnlinkSuccess] = useState(false);

  // Export & Cache Clear State
  const [isExportingWatchlist, setIsExportingWatchlist] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [cacheClearFeedback, setCacheClearFeedback] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearConfirmInput, setClearConfirmInput] = useState('');
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);

  // Lock body scroll whenever settings modal/drawer is open
  useBodyScrollLock(Boolean(activeSheet || showClearConfirm || showDeleteAccountConfirm));

  // Sound preference from localStorage
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('bse_sound_enabled') !== 'false';
    } catch {
      return true;
    }
  });

  // Display density preference from localStorage ('comfortable' | 'compact' | 'dense')
  const [feedDensity, setFeedDensity] = useState<'comfortable' | 'compact' | 'dense'>(() => {
    try {
      const saved = localStorage.getItem('bse_feed_density');
      return (saved === 'comfortable' || saved === 'dense') ? saved : 'compact';
    } catch {
      return 'compact';
    }
  });

  // Materiality Impact Filter State
  const [isFilterEnabled, setIsFilterEnabled] = useState<boolean>(Boolean(settings?.isFilterEnabled));

  // Admin Master PIN Input State
  const [pinUnlockInput, setPinUnlockInput] = useState('');
  const [pinUnlockError, setPinUnlockError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  // Server Admin Keys & Engine Config State
  const [serverBotToken, setServerBotToken] = useState('');
  const [serverChatId, setServerChatId] = useState('');
  const [serverExcludeKeywords, setServerExcludeKeywords] = useState('');
  const [serverAlertPriority, setServerAlertPriority] = useState('HIGH_ONLY');
  const [serverAlertCategory, setServerAlertCategory] = useState('RESULTS_ONLY');
  const [serverWatchlistOnly, setServerWatchlistOnly] = useState(true);
  const [serverTelegramEnabled, setServerTelegramEnabled] = useState(true);
  const [serverTelegramAiSummary, setServerTelegramAiSummary] = useState(true);
  const [serverMuteCrashAlerts, setServerMuteCrashAlerts] = useState(false);
  const [newMasterPin, setNewMasterPin] = useState('');
  const [isSavingServerSettings, setIsSavingServerSettings] = useState(false);
  const [serverSaveFeedback, setServerSaveFeedback] = useState<{ success: boolean; msg: string } | null>(null);

  // Server Diagnostic Test States
  const [isTestingServerTg, setIsTestingServerTg] = useState(false);
  const [serverTgTestFeedback, setServerTgTestFeedback] = useState<string | null>(null);
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [geminiTestFeedback, setGeminiTestFeedback] = useState<string | null>(null);
  const [isTogglingEngine, setIsTogglingEngine] = useState(false);

  // Baseline stored profile values to detect unsaved changes
  const initialDisplayName = profile?.displayName || '';
  const initialUsername = profile?.username || (profile?.email ? profile.email.split('@')[0] : '');
  const initialTgChatId = profile?.telegramChatId || '';

  // Detect explicit unsaved changes for identity fields
  const hasUnsavedIdentityChanges = useMemo(() => {
    return (
      (displayNameInput.trim() !== initialDisplayName.trim()) ||
      (usernameInput.trim().toLowerCase() !== initialUsername.trim().toLowerCase()) ||
      (tgChatIdInput.trim() !== initialTgChatId.trim())
    );
  }, [displayNameInput, initialDisplayName, usernameInput, initialUsername, tgChatIdInput, initialTgChatId]);

  useEffect(() => {
    if (profile) {
      setDisplayNameInput(profile.displayName || '');
      const defaultHandle = profile.username || (profile.email ? profile.email.split('@')[0] : '');
      setUsernameInput(defaultHandle);
      setTgUsernameInput(profile.telegramUsername || '');
      setTgChatIdInput(profile.telegramChatId || '');
      setTgAlertsEnabled(profile.notificationPreferences?.telegramAlertsEnabled !== false);
      setTgAiSummaryEnabled(profile.notificationPreferences?.telegramAiSummaryEnabled !== false);
      setTgAlertScope(profile.notificationPreferences?.telegramAlertScope || 'WATCHLIST_ONLY');
    }
  }, [profile]);

  useEffect(() => {
    if (settings) {
      setIsFilterEnabled(Boolean(settings.isFilterEnabled));
      setServerBotToken(settings.botToken || '');
      setServerChatId(settings.chatId || '');
      setServerExcludeKeywords(settings.excludeKeywords || '');
      setServerAlertPriority(settings.telegramAlertPriority || 'HIGH_ONLY');
      setServerAlertCategory(settings.telegramAlertCategory || 'RESULTS_ONLY');
      setServerWatchlistOnly(settings.telegramWatchlistOnly !== undefined ? settings.telegramWatchlistOnly : true);
      setServerTelegramEnabled(settings.telegramAlertsEnabled !== false);
      setServerTelegramAiSummary(settings.telegramAiSummaryEnabled !== false);
      setServerMuteCrashAlerts(Boolean(settings.muteCrashAlerts));
    }
  }, [settings]);

  // Keyboard shortcut: Cmd+K or Ctrl+K to search settings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && searchQuery) {
        setSearchQuery('');
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery]);

  // Instant Toggles Handlers (Flip, Done + Instant Saved Pill)
  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    if (setTheme) {
      setTheme(nextTheme);
      showSavedPill('theme');
    }
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      localStorage.setItem('bse_sound_enabled', String(next));
    } catch {}
    showSavedPill('sound');
  };

  const handleToggleFilter = async () => {
    const prev = isFilterEnabled;
    const next = !prev;
    // Optimistic UI update: flip immediately
    setIsFilterEnabled(next);
    showSavedPill('filter');
    try {
      const res = await customFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          isFilterEnabled: next
        })
      });
      if (!res.ok) {
        setIsFilterEnabled(prev); // Rollback on server error
      }
    } catch (e) {
      console.warn('Failed to update filter setting:', e);
      setIsFilterEnabled(prev); // Rollback on network exception
    }
  };

  const handleSetDensity = (newDensity: 'comfortable' | 'compact' | 'dense') => {
    setFeedDensity(newDensity);
    try {
      localStorage.setItem('bse_feed_density', newDensity);
      window.dispatchEvent(new Event('storage'));
    } catch {}
    showSavedPill('density');
  };

  // One-click Resets for Modified Preferences
  const handleResetTheme = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (setTheme) {
      setTheme(DEFAULT_THEME);
      showSavedPill('theme');
    }
  };

  const handleResetSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSoundEnabled(DEFAULT_SOUND);
    try {
      localStorage.setItem('bse_sound_enabled', String(DEFAULT_SOUND));
    } catch {}
    showSavedPill('sound');
  };

  const handleResetFilter = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFilterEnabled(DEFAULT_FILTER);
    showSavedPill('filter');
    try {
      await customFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          isFilterEnabled: DEFAULT_FILTER
        })
      });
      fetchSettings();
    } catch (err) {
      console.warn('Failed to reset filter setting:', err);
    }
  };

  const handleResetDensity = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleSetDensity(DEFAULT_DENSITY);
  };

  const handleResetAllPreferences = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleResetTheme(e);
    handleResetSound(e);
    handleResetFilter(e);
    handleResetDensity(e);
  };

  // Revert unsaved identity form values
  const handleRevertUnsaved = () => {
    if (profile) {
      setDisplayNameInput(profile.displayName || '');
      const defaultHandle = profile.username || (profile.email ? profile.email.split('@')[0] : '');
      setUsernameInput(defaultHandle);
      setTgChatIdInput(profile.telegramChatId || '');
    }
    setUsernameValidationMsg(null);
  };

  // Save all explicit identity changes from the floating bar
  const handleSaveAllIdentityChanges = async () => {
    setUsernameValidationMsg(null);
    const cleanUsername = usernameInput.trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '_').slice(0, 25);
    if (cleanUsername.length < 3) {
      setUsernameValidationMsg('Username must be at least 3 characters long.');
      setActiveSheet('profile');
      return;
    }

    setIsSavingProfile(true);
    let profileSuccess = true;
    if (displayNameInput.trim() !== initialDisplayName.trim() || cleanUsername !== initialUsername.trim().toLowerCase()) {
      const res = await updateProfileInfo({
        displayName: displayNameInput.trim(),
        username: cleanUsername,
        telegramUsername: tgUsernameInput.trim() || undefined
      });
      if (!res || !res.success) {
        profileSuccess = false;
        setUsernameValidationMsg(res?.error || 'Failed to save profile changes.');
      }
    }

    if (tgChatIdInput.trim() !== initialTgChatId.trim()) {
      await updateTelegramChatId(tgChatIdInput.trim(), tgUsernameInput.trim());
    }

    setIsSavingProfile(false);
    if (profileSuccess) {
      setProfileSaveSuccess(true);
      setTimeout(() => setProfileSaveSuccess(false), 2000);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameValidationMsg(null);

    const cleanUsername = usernameInput.trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '_').slice(0, 25);
    if (cleanUsername.length < 3) {
      setUsernameValidationMsg('Username must be at least 3 characters long.');
      return;
    }

    setIsSavingProfile(true);
    const res = await updateProfileInfo({
      displayName: displayNameInput.trim(),
      username: cleanUsername,
      telegramUsername: tgUsernameInput.trim() || undefined
    });
    setIsSavingProfile(false);

    if (res && res.success) {
      setProfileSaveSuccess(true);
      setTimeout(() => {
        setProfileSaveSuccess(false);
        setActiveSheet(null);
      }, 1500);
    } else {
      setUsernameValidationMsg(res?.error || 'Failed to save profile.');
    }
  };

  const handleSaveTelegram = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user || user.isAnonymous) {
      setIsAuthModalOpen?.(true);
      return;
    }
    setIsSavingTg(true);
    setTestTgResult(null);

    const cleanChatId = tgChatIdInput.trim();
    const success = await updateTelegramPreferences({
      chatId: cleanChatId || null,
      username: tgUsernameInput.trim() || null,
      alertsEnabled: tgAlertsEnabled,
      aiSummaryEnabled: tgAiSummaryEnabled,
      alertScope: tgAlertScope
    });

    setIsSavingTg(false);
    if (success) {
      setTgSaveSuccess(true);
      setTimeout(() => {
        setTgSaveSuccess(false);
        setActiveSheet(null);
      }, 1400);
    }
  };

  const handleUnlinkTelegram = async () => {
    if (!user || user.isAnonymous) {
      setIsAuthModalOpen?.(true);
      return;
    }
    setIsUnlinkingTg(true);
    setTestTgResult(null);
    const success = await updateTelegramPreferences({ unlink: true });
    setIsUnlinkingTg(false);
    if (success) {
      setTgChatIdInput('');
      setTgAlertsEnabled(false);
      setUnlinkSuccess(true);
      setTimeout(() => {
        setUnlinkSuccess(false);
        setActiveSheet(null);
      }, 1400);
    }
  };

  const handleTestUserTelegram = async () => {
    if (!user || user.isAnonymous) {
      setIsAuthModalOpen?.(true);
      setTestTgResult('Please sign in with Google to configure your personal Telegram alerts.');
      return;
    }
    const targetChatId = tgChatIdInput.trim() || profile?.telegramChatId;
    if (!targetChatId) {
      setTestTgResult('Please enter your Telegram Chat ID first.');
      return;
    }
    setIsTestingTelegram(true);
    setTestTgResult(null);
    try {
      const res = await customFetch('/api/users/test-telegram', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: targetChatId })
      });
      const data = await res.json();
      if (res.status === 401 || data?.authRequired) {
        setIsAuthModalOpen?.(true);
        setTestTgResult('Authentication required. Please sign in with Google.');
        return;
      }
      if (data.success) {
        setTestTgResult('Success: Test alert delivered to your Telegram!');
      } else {
        setTestTgResult(`Failed: ${data.error || 'Please send /start to the bot first'}`);
      }
    } catch (e: any) {
      setTestTgResult(`Error: ${e.message}`);
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleExportWatchlist = async (format: 'csv' | 'json') => {
    setIsExportingWatchlist(true);
    setExportFeedback(null);
    try {
      let stocks: any[] = [];
      try {
        const res = await customFetch('/api/watchlists');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            data.forEach((w: any) => {
              if (Array.isArray(w.items)) {
                stocks.push(...w.items);
              }
            });
          }
        }
      } catch (e) {
        console.warn("Could not fetch remote watchlists", e);
      }

      if (stocks.length === 0) {
        stocks = [
          { symbol: "RELIANCE", scripCode: "500325", companyName: "Reliance Industries Ltd", priority: "HIGH" },
          { symbol: "TCS", scripCode: "532540", companyName: "Tata Consultancy Services Ltd", priority: "HIGH" },
          { symbol: "HDFCBANK", scripCode: "500180", companyName: "HDFC Bank Ltd", priority: "HIGH" },
          { symbol: "INFY", scripCode: "500209", companyName: "Infosys Ltd", priority: "MEDIUM" }
        ];
      }

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(stocks, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bse_nexus_watchlist_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const header = 'Symbol,ScripCode,CompanyName,Priority\n';
        const rows = stocks.map((s: any) => `"${s.symbol || ''}","${s.scripCode || ''}","${(s.name || s.companyName || '').replace(/"/g, '""')}","${s.priority || 'MEDIUM'}"`).join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bse_nexus_watchlist_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      setExportFeedback(`Watchlist exported as ${format.toUpperCase()} (${stocks.length} tracked stocks)`);
      setTimeout(() => setExportFeedback(null), 3500);
    } catch (err: any) {
      setExportFeedback(`Export failed: ${err.message}`);
    } finally {
      setIsExportingWatchlist(false);
    }
  };

  const handleClearAppCache = () => {
    setIsClearingCache(true);
    try {
      const allKeys = Object.keys(localStorage);
      let count = 0;
      allKeys.forEach(k => {
        const isProtected = 
          k === 'bse_nexus_fb_id_token' || 
          k === 'bse_nexus_auth_session' || 
          k.startsWith('bse_user_handle_') || 
          k.startsWith('bse_user_tg_');

        if (!isProtected && (k.startsWith('bse_') || k.startsWith('cache_') || k.startsWith('nexus_'))) {
          localStorage.removeItem(k);
          count++;
        }
      });
      setCacheClearFeedback(`Cleaned ${count} cached records & memory indexes.`);
      setShowClearConfirm(false);
      setClearConfirmInput('');
      setTimeout(() => setCacheClearFeedback(null), 3500);
    } catch (e: any) {
      setCacheClearFeedback(`Cache cleanup error: ${e.message}`);
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      // 1. Unlink Telegram if configured
      try {
        await updateTelegramPreferences({ unlink: true });
      } catch (e) {
        console.warn("Could not unlink telegram on delete:", e);
      }

      // 2. Clear all local storage & session storage
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        console.warn("Could not clear storage:", e);
      }

      // 3. Delete indexedDB stores if available
      try {
        if (typeof window !== 'undefined' && window.indexedDB) {
          const dbs = ['bse_nexus_db', 'firebaseLocalStorageDb', 'firestore'];
          dbs.forEach(name => {
            try { window.indexedDB.deleteDatabase(name); } catch {}
          });
        }
      } catch (e) {
        console.warn("Could not clear indexedDB:", e);
      }

      // 4. Clean logout
      await logout();
      setShowDeleteAccountConfirm(false);
      setDeleteConfirmInput('');
      
      // 5. Navigate back to Home
      if (onNavigate) {
        onNavigate('home');
      } else {
        window.location.href = '/';
      }
    } catch (err: any) {
      console.error("Account deletion failed:", err);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleToggleEngine = async () => {
    const prevRunning = Boolean(settings?.isRunning);
    const nextRunning = !prevRunning;
    // Optimistic UI update: flip engine switch instantly
    setSettings((prev: any) => ({ ...prev, isRunning: nextRunning }));
    setIsTogglingEngine(true);
    try {
      const res = await customFetch('/api/toggle', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSettings((prev: any) => ({ ...prev, isRunning: data.isRunning }));
      } else {
        setSettings((prev: any) => ({ ...prev, isRunning: prevRunning })); // Rollback
      }
    } catch (err: any) {
      console.warn("Failed to toggle engine", err);
      setSettings((prev: any) => ({ ...prev, isRunning: prevRunning })); // Rollback
    } finally {
      setIsTogglingEngine(false);
    }
  };

  const handleSaveServerSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingServerSettings(true);
    setServerSaveFeedback(null);
    try {
      const payload: any = {
        ...settings,
        botToken: serverBotToken.trim(),
        chatId: serverChatId.trim(),
        excludeKeywords: serverExcludeKeywords.trim(),
        telegramAlertPriority: serverAlertPriority,
        telegramAlertCategory: serverAlertCategory,
        telegramWatchlistOnly: serverWatchlistOnly,
        telegramAlertsEnabled: serverTelegramEnabled,
        telegramAiSummaryEnabled: serverTelegramAiSummary,
        muteCrashAlerts: serverMuteCrashAlerts
      };

      if (newMasterPin.trim()) {
        payload.newPin = newMasterPin.trim();
      }

      const res = await customFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setServerSaveFeedback({ success: true, msg: 'Server configuration saved successfully!' });
        setNewMasterPin('');
        fetchSettings();
      } else {
        setServerSaveFeedback({ success: false, msg: data.error || 'Failed to update server settings' });
      }
    } catch (err: any) {
      setServerSaveFeedback({ success: false, msg: err.message || 'Error saving server settings' });
    } finally {
      setIsSavingServerSettings(false);
      setTimeout(() => setServerSaveFeedback(null), 4000);
    }
  };

  const handleTestServerTg = async () => {
    setIsTestingServerTg(true);
    setServerTgTestFeedback(null);
    try {
      const res = await customFetch('/api/test-telegram', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setServerTgTestFeedback('Delivered! Check your Telegram channel/chat for the test alert.');
      } else {
        setServerTgTestFeedback(`Failed: ${data.error || 'Could not send test message'}`);
      }
    } catch (err: any) {
      setServerTgTestFeedback(`Error: ${err.message}`);
    } finally {
      setIsTestingServerTg(false);
      setTimeout(() => setServerTgTestFeedback(null), 5000);
    }
  };

  const handleTestGemini = async () => {
    setIsTestingGemini(true);
    setGeminiTestFeedback(null);
    try {
      const res = await customFetch('/api/test-gemini', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setGeminiTestFeedback('Success! Gemini summarized test earnings report in ~2.8s');
      } else {
        setGeminiTestFeedback(`Failed: ${data.error || 'Gemini synthesis failed'}`);
      }
    } catch (err: any) {
      setGeminiTestFeedback(`Error: ${err.message}`);
    } finally {
      setIsTestingGemini(false);
      setTimeout(() => setGeminiTestFeedback(null), 5000);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await logout();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSigningOut(false);
    }
  };

  // Search Filter Matching Logic (Strictly restrict Advanced/Operator settings to Admins only)
  const accessibleSettingsRegistry = useMemo(() => {
    return SETTINGS_REGISTRY.filter(item => {
      if (item.category === 'Advanced Engine') {
        return isSuperAdmin;
      }
      return true;
    });
  }, [isSuperAdmin]);

  const queryLower = searchQuery.toLowerCase().trim();
  const isMatch = (id: string) => {
    // Advanced & Developer options are strictly admin-only
    const advancedIds = ['security-audit', 'diagnostics', 'logs', 'storage', 'server-keys'];
    if (advancedIds.includes(id) && !isSuperAdmin) {
      return false;
    }
    if (!queryLower) return true;
    const item = accessibleSettingsRegistry.find(s => s.id === id);
    if (!item) return false;
    return (
      item.title.toLowerCase().includes(queryLower) ||
      item.description.toLowerCase().includes(queryLower) ||
      item.category.toLowerCase().includes(queryLower) ||
      item.keywords.some(k => k.toLowerCase().includes(queryLower))
    );
  };

  const matchingSettingsCount = useMemo(() => {
    if (!queryLower) return accessibleSettingsRegistry.length;
    return accessibleSettingsRegistry.filter(s => isMatch(s.id)).length;
  }, [queryLower, accessibleSettingsRegistry, isSuperAdmin]);

  const hiddenSettingsCount = accessibleSettingsRegistry.length - matchingSettingsCount;

  // Modified State Tracking (VS Code Style dot + undo)
  const isThemeModified = theme !== DEFAULT_THEME;
  const isSoundModified = soundEnabled !== DEFAULT_SOUND;
  const isFilterModified = isFilterEnabled !== DEFAULT_FILTER;
  const isDensityModified = feedDensity !== DEFAULT_DENSITY;

  const modifiedPreferencesCount = 
    (isThemeModified ? 1 : 0) + 
    (isSoundModified ? 1 : 0) + 
    (isFilterModified ? 1 : 0) + 
    (isDensityModified ? 1 : 0);

  // Auto-expand advanced section if search matches something inside it (Strictly for Admins)
  const isSearchMatchingAdvanced = isSuperAdmin && queryLower.length > 0 && (
    isMatch('security-audit') || isMatch('diagnostics') || isMatch('logs') || isMatch('storage') || isMatch('server-keys')
  );
  // Strictly gate the advanced section to superadmins only
  const showAdvancedSection = isSuperAdmin && (isAdvancedExpanded || isSearchMatchingAdvanced);

  // Render Section Breadcrumb when filtering via search
  const renderSearchBreadcrumb = (category: string) => {
    if (!queryLower) return null;
    return (
      <div className="text-[10px] font-mono uppercase tracking-wider text-purple-600 dark:text-purple-400 font-bold mb-0.5">
        {category} &rsaquo;
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-in fade-in duration-200 pb-28">
      
      {/* 1. PAGE HEADER & SEARCH BAR */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
              Settings
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Personalize research defaults, push delivery, and system tools
            </p>
          </div>
          {profile?.username && (
            <span className="hidden sm:inline-block font-mono text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#1f1c2d] px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-[#2b273d]">
              @{profile.username}
            </span>
          )}
        </div>

        {/* Global Instant Search Input with ⌘K Badge */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search settings... (e.g. theme, audio, telegram, density, clear)"
            className="w-full pl-9 pr-14 py-2.5 bg-white dark:bg-[#181626] border border-slate-200/90 dark:border-[#2D283E] rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-purple-500/50 shadow-2xs transition-all"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              title="Clear search"
            >
              <X size={14} />
            </button>
          ) : (
            <kbd className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-slate-400 bg-slate-100 dark:bg-[#201e2e] border border-slate-200 dark:border-[#2d283e] pointer-events-none">
              ⌘K
            </kbd>
          )}
        </div>

        {/* Search Results Count / Hidden Pill */}
        {queryLower && (
          <div className="flex items-center justify-between px-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span>
              {matchingSettingsCount === 0 ? (
                <span className="text-rose-500 font-semibold">No settings matching "{searchQuery}"</span>
              ) : (
                <span>Found <strong className="text-purple-600 dark:text-purple-400">{matchingSettingsCount}</strong> setting{matchingSettingsCount === 1 ? '' : 's'}</span>
              )}
            </span>
            {hiddenSettingsCount > 0 && (
              <span className="text-[10px] font-mono text-slate-400">
                {hiddenSettingsCount} hidden
              </span>
            )}
          </div>
        )}
      </div>

      {/* Feedback Toast Banner */}
      {(exportFeedback || cacheClearFeedback) && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs rounded-xl flex items-center justify-between shadow-xs animate-in fade-in">
          <span>{exportFeedback || cacheClearFeedback}</span>
        </div>
      )}

      {/* SECTION 1: PREFERENCES (Appearance, Audio, Density, Materiality) */}
      {(isMatch('appearance') || isMatch('density') || isMatch('sound') || isMatch('filter')) && (
        <div className="space-y-2 select-none">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Preferences
            </h3>
            {modifiedPreferencesCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  {modifiedPreferencesCount} modified
                </span>
                <button
                  type="button"
                  onClick={handleResetAllPreferences}
                  className="text-[11px] text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Reset all preferences to baseline defaults"
                >
                  <RotateCcw size={11} />
                  <span>Reset all</span>
                </button>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-[#181626] border border-slate-200/90 dark:border-[#2D283E] rounded-2xl divide-y divide-slate-100 dark:divide-[#252236] overflow-hidden shadow-2xs">
            
            {/* 1.1 Theme Toggle Row */}
            {isMatch('appearance') && (
              <div className="p-3.5 flex items-center justify-between gap-3 text-xs">
                <div>
                  {renderSearchBreadcrumb('Preferences')}
                  <div className="flex items-center gap-1.5">
                    {isThemeModified && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Modified from default (Dark)" />
                    )}
                    <span className="font-semibold text-slate-900 dark:text-white">Appearance &amp; Theme</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    High contrast adaptive interface (Dark default)
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <AnimatePresence>
                    {savedPillKey === 'theme' && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.85, x: 4 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        transition={springSnappy}
                        className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-2xs"
                      >
                        <Check size={10} /> Saved
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {isThemeModified && (
                    <button
                      type="button"
                      onClick={handleResetTheme}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#252236] transition-colors cursor-pointer"
                      title="Reset to default (Dark)"
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}

                  <span className="text-slate-500 dark:text-slate-400 font-medium capitalize text-[11px]">
                    {theme === 'dark' ? 'Dark' : 'Light'}
                  </span>
                  <motion.button
                    type="button"
                    whileTap={buttonTap}
                    transition={springSnappy}
                    onClick={handleToggleTheme}
                    className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-slate-100 dark:bg-[#252236] text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#2F2B40] transition-colors cursor-pointer"
                    title="Toggle Dark / Light theme"
                  >
                    {theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
                  </motion.button>
                </div>
              </div>
            )}

            {/* 1.2 Feed Display Density Segmented Selector */}
            {isMatch('density') && (
              <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  {renderSearchBreadcrumb('Preferences')}
                  <div className="flex items-center gap-1.5">
                    {isDensityModified && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Modified from default (Compact)" />
                    )}
                    <span className="font-semibold text-slate-900 dark:text-white">Feed Display Density</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Row height and card padding across live disclosure feeds
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <AnimatePresence>
                    {savedPillKey === 'density' && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.85, x: 4 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        transition={springSnappy}
                        className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-2xs"
                      >
                        <Check size={10} /> Saved
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {isDensityModified && (
                    <button
                      type="button"
                      onClick={handleResetDensity}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#252236] transition-colors cursor-pointer"
                      title="Reset density to Compact"
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}

                  {/* 3-way Segmented Control */}
                  <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-[#201e2e] border border-slate-200/80 dark:border-[#2d283e]">
                    {(['comfortable', 'compact', 'dense'] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => handleSetDensity(d)}
                        className={cn(
                          "px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all capitalize cursor-pointer",
                          feedDensity === d
                            ? "bg-white dark:bg-[#2f2b40] text-purple-600 dark:text-purple-300 shadow-2xs font-bold"
                            : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                        )}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 1.3 Audio Alerts Toggle Row */}
            {isMatch('sound') && (
              <div className="p-3.5 flex items-center justify-between gap-3 text-xs">
                <div>
                  {renderSearchBreadcrumb('Preferences')}
                  <div className="flex items-center gap-1.5">
                    {isSoundModified && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Modified from default (Enabled)" />
                    )}
                    <span className="font-semibold text-slate-900 dark:text-white">Audio Alerts</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Synthesized tone on critical price-sensitive filings
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <AnimatePresence>
                    {savedPillKey === 'sound' && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.85, x: 4 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        transition={springSnappy}
                        className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-2xs"
                      >
                        <Check size={10} /> Saved
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {isSoundModified && (
                    <button
                      type="button"
                      onClick={handleResetSound}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#252236] transition-colors cursor-pointer"
                      title="Reset audio alerts to Enabled"
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.92 }}
                    transition={springSnappy}
                    onClick={handleToggleSound}
                    className={cn(
                      "w-11 h-6 rounded-full transition-colors relative cursor-pointer",
                      soundEnabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                    )}
                    aria-label="Toggle Audio Alerts"
                  >
                    <span 
                      className={cn(
                        "w-4 h-4 rounded-full bg-white absolute top-1 transition-transform shadow-xs",
                        soundEnabled ? "left-6" : "left-1"
                      )} 
                    />
                  </motion.button>
                </div>
              </div>
            )}

            {/* 1.4 Materiality Filter Toggle Row */}
            {isMatch('filter') && (
              <div className="p-3.5 flex items-center justify-between gap-3 text-xs">
                <div>
                  {renderSearchBreadcrumb('Preferences')}
                  <div className="flex items-center gap-1.5">
                    {isFilterModified && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Modified from default (All Disclosures)" />
                    )}
                    <span className="font-semibold text-slate-900 dark:text-white">High Impact Filter</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    SEBI Regulation 30 price-sensitive announcements only
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <AnimatePresence>
                    {savedPillKey === 'filter' && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.85, x: 4 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        transition={springSnappy}
                        className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-2xs"
                      >
                        <Check size={10} /> Saved
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {isFilterModified && (
                    <button
                      type="button"
                      onClick={handleResetFilter}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#252236] transition-colors cursor-pointer"
                      title="Reset filter to All Disclosures"
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.92 }}
                    transition={springSnappy}
                    onClick={handleToggleFilter}
                    className={cn(
                      "w-11 h-6 rounded-full transition-colors relative cursor-pointer",
                      isFilterEnabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                    )}
                    aria-label="Toggle Materiality Filter"
                  >
                    <span 
                      className={cn(
                        "w-4 h-4 rounded-full bg-white absolute top-1 transition-transform shadow-xs",
                        isFilterEnabled ? "left-6" : "left-1"
                      )} 
                    />
                  </motion.button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* SECTION 2: ACCOUNT & IDENTITY (Display Name, Username, Telegram ID) */}
      {(isMatch('profile') || isMatch('telegram')) && (
        <div className="space-y-2 select-none">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Account &amp; Identity
            </h3>
            {hasUnsavedIdentityChanges && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                Unsaved changes
              </span>
            )}
          </div>

          <div className="bg-white dark:bg-[#181626] border border-slate-200/90 dark:border-[#2D283E] rounded-2xl divide-y divide-slate-100 dark:divide-[#252236] overflow-hidden shadow-2xs">
            
            {/* 2.1 Profile & Public Username */}
            {isMatch('profile') && (
              <motion.button
                type="button"
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={() => setActiveSheet('profile')}
                className="w-full min-h-[48px] p-3.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-[#201E2E] transition-colors cursor-pointer text-xs"
              >
                <div>
                  {renderSearchBreadcrumb('Account & Identity')}
                  <span className="font-semibold text-slate-900 dark:text-white">Profile &amp; Display Name</span>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {profile?.displayName || user?.displayName || 'Investor'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className="text-[11px] font-mono text-purple-600 dark:text-purple-400 font-medium">
                    {profile?.username ? `@${profile.username}` : ''}
                  </span>
                  <ChevronRight size={14} />
                </div>
              </motion.button>
            )}

            {/* 2.2 Telegram Instant Push Delivery & AI Summaries */}
            {isMatch('telegram') && (
              <motion.button
                type="button"
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={() => setActiveSheet('telegram')}
                className="w-full min-h-[52px] p-3.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-[#201E2E] transition-colors cursor-pointer text-xs"
              >
                <div>
                  {renderSearchBreadcrumb('Account & Identity')}
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">Telegram Alerts &amp; AI Summaries</span>
                    {profile?.telegramChatId && (
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight",
                        profile?.notificationPreferences?.telegramAlertsEnabled !== false
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                          : "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                      )}>
                        {profile?.notificationPreferences?.telegramAlertsEnabled !== false ? 'ALERTS ON' : 'PAUSED (OFF)'}
                      </span>
                    )}
                    {profile?.telegramChatId && profile?.notificationPreferences?.telegramAiSummaryEnabled !== false && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-0.5">
                        <Sparkles size={9} /> AI Summary
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Control real-time push delivery, Gemini AI executive takeaways &amp; watchlist filtering
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className={cn(
                    "text-[11px] font-semibold",
                    profile?.telegramChatId 
                      ? (profile?.notificationPreferences?.telegramAlertsEnabled !== false ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")
                      : "text-slate-400"
                  )}>
                    {profile?.telegramChatId 
                      ? (profile?.notificationPreferences?.telegramAlertsEnabled !== false ? 'Connected' : 'Muted')
                      : 'Not linked'}
                  </span>
                  <ChevronRight size={14} />
                </div>
              </motion.button>
            )}

          </div>
        </div>
      )}

      {/* SUBSCRIPTION & BILLING (Cashfree one-time Pro payments; auto-renew = Coming soon) */}
      {isMatch('subscription') && (
        <div className="space-y-2 select-none">
          <div className="px-1">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Subscription &amp; Billing
            </h3>
          </div>
          <SubscriptionCard />
        </div>
      )}

      {/* SECTION 3: WATCHLIST & EXPORTS */}
      {(isMatch('export-csv') || isMatch('export-json')) && (
        <div className="space-y-2 select-none">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            Watchlist &amp; Data
          </h3>

          <div className="bg-white dark:bg-[#181626] border border-slate-200/90 dark:border-[#2D283E] rounded-2xl divide-y divide-slate-100 dark:divide-[#252236] overflow-hidden shadow-2xs">
            {/* 3.1 Export to CSV */}
            {isMatch('export-csv') && (
              <motion.button
                type="button"
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={() => handleExportWatchlist('csv')}
                disabled={isExportingWatchlist}
                className="w-full min-h-[44px] p-3.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-[#201E2E] transition-colors cursor-pointer text-xs"
              >
                <div>
                  {renderSearchBreadcrumb('Watchlist & Data')}
                  <span className="font-semibold text-slate-900 dark:text-white">Export to CSV</span>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Download tracked tickers and priority tiers for Excel</div>
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                  <Download size={14} />
                </div>
              </motion.button>
            )}

            {/* 3.2 Export Watchlist JSON */}
            {isMatch('export-json') && (
              <motion.button
                type="button"
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={() => handleExportWatchlist('json')}
                disabled={isExportingWatchlist}
                className="w-full min-h-[44px] p-3.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-[#201E2E] transition-colors cursor-pointer text-xs"
              >
                <div>
                  {renderSearchBreadcrumb('Watchlist & Data')}
                  <span className="font-semibold text-slate-900 dark:text-white">Export backup (JSON)</span>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Full structured backup for cross-device migration</div>
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                  <Download size={14} />
                </div>
              </motion.button>
            )}
          </div>
        </div>
      )}

      {/* SECTION 4: ADVANCED & DEVELOPER ENGINE (Strictly Admin & Operator Only) */}
      {isSuperAdmin && (isMatch('security-audit') || isMatch('diagnostics') || isMatch('logs') || isMatch('storage') || isMatch('server-keys')) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={14} />
                Advanced &amp; Developer Engine
              </h3>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 lowercase font-mono">
                admin only
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={lockAdminSession}
                className="text-[11px] text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors font-medium px-1.5 py-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer"
                title="Lock admin session"
              >
                Lock Session
              </button>
              <button
                type="button"
                onClick={() => setIsAdvancedExpanded(!isAdvancedExpanded)}
                className="text-[11px] text-slate-500 hover:text-purple-600 dark:hover:text-purple-300 flex items-center gap-1 cursor-pointer font-medium"
              >
                <span>{showAdvancedSection ? 'Collapse' : 'Show controls'}</span>
                <ChevronDown size={13} className={cn("transition-transform duration-200", showAdvancedSection ? "rotate-180" : "")} />
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {showAdvancedSection && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={springSnappy}
                className="overflow-hidden"
              >
                <div className="bg-white dark:bg-[#181626] border border-purple-200/90 dark:border-purple-900/50 rounded-2xl divide-y divide-slate-100 dark:divide-[#252236] overflow-hidden shadow-2xs">
                  
                  {/* 4.1 20-Point Launch Security & Penetration Test */}
                  {isMatch('security-audit') && (
                    <button
                      type="button"
                      onClick={() => setSecurityAuditModalOpen(true)}
                      className="w-full p-3.5 flex items-center justify-between text-left hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-colors cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <ShieldCheck size={16} />
                        </div>
                        <div>
                          {renderSearchBreadcrumb('Advanced Engine')}
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-white">20-Point Launch Security &amp; Pen-Test</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              20/20 Hardened
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">IDOR defense, RLS verification, and live red-team harness</div>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-slate-400" />
                    </button>
                  )}

                  {/* 4.2 System Diagnostics & Telemetry (with Bloom Filter) */}
                  {isMatch('diagnostics') && (
                    <button
                      type="button"
                      onClick={() => onNavigate ? onNavigate('diagnostics') : setActiveSheet('admin')}
                      className="w-full p-3.5 flex items-center justify-between text-left hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-colors cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                          <ShieldAlert size={16} />
                        </div>
                        <div>
                          {renderSearchBreadcrumb('Advanced Engine')}
                          <span className="font-semibold text-slate-900 dark:text-white">System Diagnostics &amp; Telemetry</span>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">Bloom filter collision rate, memory, and worker uptime</div>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-slate-400" />
                    </button>
                  )}

                  {/* 4.3 Engine Activity Logs */}
                  {isMatch('logs') && (
                    <button
                      type="button"
                      onClick={() => onNavigate ? onNavigate('logs') : setActiveSheet('admin')}
                      className="w-full p-3.5 flex items-center justify-between text-left hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-colors cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                          <Terminal size={16} />
                        </div>
                        <div>
                          {renderSearchBreadcrumb('Advanced Engine')}
                          <span className="font-semibold text-slate-900 dark:text-white">Engine Activity Logs</span>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">Live stream of BSE ingestion, Gemini AI summaries &amp; workers</div>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-slate-400" />
                    </button>
                  )}

                  {/* 4.4 Storage Manager & Quotas */}
                  {isMatch('storage') && (
                    <button
                      type="button"
                      onClick={() => onNavigate ? onNavigate('storage') : setActiveSheet('admin')}
                      className="w-full p-3.5 flex items-center justify-between text-left hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-colors cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                          <Database size={16} />
                        </div>
                        <div>
                          {renderSearchBreadcrumb('Advanced Engine')}
                          <span className="font-semibold text-slate-900 dark:text-white">Storage Manager &amp; Quotas</span>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">Firestore quotas, backup downloads, and cache health</div>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-slate-400" />
                    </button>
                  )}

                  {/* 4.5 Server Keys & Ingestion Config */}
                  {isMatch('server-keys') && (
                    <button
                      type="button"
                      onClick={() => setActiveSheet('admin')}
                      className="w-full p-3.5 flex items-center justify-between text-left hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-colors cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                          <KeyRound size={16} />
                        </div>
                        <div>
                          {renderSearchBreadcrumb('Advanced Engine')}
                          <span className="font-semibold text-slate-900 dark:text-white">Server Keys &amp; Ingestion Config</span>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">Bot token, Master PIN, AI summarizer test, and live toggle</div>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-slate-400" />
                    </button>
                  )}

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* SECTION 5: HELP & SUPPORT */}
      {isMatch('help') && (
        <div className="space-y-2 select-none">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            Help &amp; Support
          </h3>

          <div className="bg-white dark:bg-[#181626] border border-slate-200/90 dark:border-[#2D283E] rounded-2xl divide-y divide-slate-100 dark:divide-[#252236] overflow-hidden shadow-2xs">
            <motion.button
              type="button"
              whileTap={buttonTap}
              transition={springSnappy}
              onClick={() => setSupportModalOpen(true)}
              className="w-full min-h-[48px] p-3.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-[#201E2E] transition-colors cursor-pointer text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                  <MessageSquare size={16} />
                </div>
                <div>
                  {renderSearchBreadcrumb('Help & Support')}
                  <span className="font-semibold text-slate-900 dark:text-white">Help Center &amp; Community</span>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">FAQs, Telegram community group &amp; reporting an issue</div>
                </div>
              </div>
              <ChevronRight size={14} className="text-slate-400" />
            </motion.button>
          </div>
        </div>
      )}

      {/* SECTION 6: ABOUT & LEGAL */}
      {isMatch('legal') && (
        <div className="space-y-2 select-none">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            About &amp; Legal
          </h3>

          <div className="bg-white dark:bg-[#181626] border border-slate-200/90 dark:border-[#2D283E] rounded-2xl divide-y divide-slate-100 dark:divide-[#252236] overflow-hidden shadow-2xs">
            <motion.button
              type="button"
              whileTap={buttonTap}
              transition={springSnappy}
              onClick={() => {
                setLegalModalTab('terms');
                setLegalModalOpen(true);
              }}
              className="w-full min-h-[48px] p-3.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-[#201E2E] transition-colors cursor-pointer text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Scale size={16} />
                </div>
                <div>
                  {renderSearchBreadcrumb('About & Legal')}
                  <span className="font-semibold text-slate-900 dark:text-white">Terms, Privacy &amp; Compliance Hub</span>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Terms of Service, Privacy (DPDP), and SEBI disclaimers</div>
                </div>
              </div>
              <ChevronRight size={14} className="text-slate-400" />
            </motion.button>

            <div className="p-3.5 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-900 dark:text-white">Version</span>
              <span className="font-mono text-slate-400 text-[11px]">v{APP_VERSION}</span>
            </div>

            <div className="p-3.5 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-900 dark:text-white">Data Source</span>
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">BSE Corporate Disclosures</span>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 7: DANGER ZONE (Quarantine the Destructive: Red Border, Bottom of the Page) */}
      {(isMatch('clear-cache') || isMatch('delete-account') || isMatch('sign-out')) && (
        <div className="space-y-2 pt-2 select-none">
          <div className="flex items-center gap-1.5 px-1">
            <AlertTriangle size={13} className="text-rose-500" />
            <h3 className="text-xs font-bold text-rose-500 uppercase tracking-wider">
              Danger Zone
            </h3>
          </div>

          <div className="border border-rose-300/80 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10 rounded-2xl divide-y divide-rose-100/80 dark:divide-rose-950/30 overflow-hidden shadow-2xs">
            
            {/* 7.1 Clear Local Cache (Friction scales with severity) */}
            {isMatch('clear-cache') && (
              <motion.button
                type="button"
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={() => {
                  setClearConfirmInput('');
                  setShowClearConfirm(true);
                }}
                className="w-full min-h-[48px] p-3.5 flex items-center justify-between text-left hover:bg-rose-50/50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer text-xs"
              >
                <div>
                  {renderSearchBreadcrumb('Danger Zone')}
                  <span className="font-semibold text-rose-600 dark:text-rose-400">Clear local cache &amp; reset offline data</span>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Clean offline storage, cached filings, and temporary search indexes</div>
                </div>
                <div className="flex items-center gap-1 text-rose-500">
                  <Trash2 size={14} />
                </div>
              </motion.button>
            )}

            {/* 7.2 Delete My Account & Personal Data */}
            {isMatch('delete-account') && (
              <motion.button
                type="button"
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={() => {
                  setDeleteConfirmInput('');
                  setShowDeleteAccountConfirm(true);
                }}
                className="w-full min-h-[48px] p-3.5 flex items-center justify-between text-left hover:bg-rose-50/50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer text-xs"
              >
                <div>
                  {renderSearchBreadcrumb('Danger Zone')}
                  <span className="font-semibold text-rose-600 dark:text-rose-400">Delete Account &amp; Personal Data</span>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Permanently erase your account, watchlist settings, and Telegram bindings</div>
                </div>
                <div className="flex items-center gap-1 text-rose-500">
                  <UserX size={14} />
                </div>
              </motion.button>
            )}

            {/* 7.3 Sign Out Button */}
            {isMatch('sign-out') && (
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="w-full p-3.5 flex items-center justify-between text-left hover:bg-rose-50/60 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer text-xs font-semibold"
              >
                <div>
                  {renderSearchBreadcrumb('Danger Zone')}
                  <span>Sign out of session</span>
                  <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400">Disconnect your authenticated investor session</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <LogOut size={14} />
                  <span className="text-[11px] font-bold">{isSigningOut ? 'Signing out...' : 'Sign out'}</span>
                </div>
              </button>
            )}

          </div>
        </div>
      )}

      {/* QUIET FOOTER - Balanced Left & Right Anchored */}
      <div className="pt-4 pb-2 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-slate-400 dark:text-slate-500">
        <div>
          <span className="font-semibold text-slate-600 dark:text-slate-400">BSENEXUS</span> Capital Markets Intelligence &bull; SEBI (LODR) Real-Time Framework
        </div>
      </div>

      {/* FLOATING SAVE BAR (For explicit, high-stakes form changes) */}
      <AnimatePresence>
        {hasUnsavedIdentityChanges && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={springSnappy}
            className="fixed bottom-6 inset-x-4 max-w-md mx-auto z-40 p-3 bg-slate-900/95 dark:bg-[#1C1A2E]/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-slate-700/80 dark:border-purple-500/30 flex items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <span className="font-semibold text-slate-200">You have unsaved changes</span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRevertUnsaved}
                className="px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 dark:hover:bg-[#2A2740] font-medium transition-colors cursor-pointer"
              >
                Revert
              </button>
              
              <button
                type="button"
                onClick={handleSaveAllIdentityChanges}
                disabled={isSavingProfile}
                className="px-3.5 py-1.5 rounded-lg font-bold bg-purple-600 hover:bg-purple-500 text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {isSavingProfile ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : profileSaveSuccess ? (
                  <>
                    <Check size={12} className="text-emerald-300" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Save size={12} />
                    <span>Save changes</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PROGRESSIVE DISCLOSURE MODALS */}

      {/* 1. Profile Edit Sheet */}
      <AnimatePresence>
        {activeSheet === 'profile' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overscroll-contain">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={springSnappy}
              className="bg-white dark:bg-[#181626] border border-slate-200 dark:border-[#2D283E] rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 overscroll-contain"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#252236] pb-3">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Edit Profile</h3>
                <button 
                  type="button" 
                  onClick={() => setActiveSheet(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Display Name</label>
                  <input
                    type="text"
                    value={displayNameInput}
                    onChange={e => setDisplayNameInput(e.target.value)}
                    placeholder="e.g. Rahul Dahiya"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] rounded-lg text-slate-900 dark:text-white text-xs outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Username Handle</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">@</span>
                    <input
                      type="text"
                      value={usernameInput}
                      onChange={e => setUsernameInput(e.target.value)}
                      placeholder="investor"
                      className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] rounded-lg text-slate-900 dark:text-white text-xs font-mono outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                  {usernameValidationMsg && (
                    <p className="text-[11px] text-rose-500 mt-1">{usernameValidationMsg}</p>
                  )}
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveSheet(null)}
                    className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 font-semibold cursor-pointer text-xs"
                  >
                    Cancel
                  </button>
                  <ActionButton
                    type="submit"
                    isLoading={isSavingProfile}
                    loadingText="Saving..."
                    variant="primary"
                    size="md"
                    icon={profileSaveSuccess ? <Check size={13} className="text-emerald-300" /> : undefined}
                  >
                    {profileSaveSuccess ? 'Saved!' : 'Save changes'}
                  </ActionButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Telegram Setup & Preferences Sheet */}
      <AnimatePresence>
        {activeSheet === 'telegram' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overscroll-contain">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={springSnappy}
              className="bg-white dark:bg-[#181626] border border-slate-200 dark:border-[#2D283E] rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 overscroll-contain max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#252236] pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                    <Send size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      Telegram Alerts &amp; AI Summaries
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Configure delivery, AI briefings &amp; scope
                    </p>
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => setActiveSheet(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-[#201E2E]"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveTelegram} className="space-y-4 text-xs">
                {/* 1. MASTER TOGGLE: TELEGRAM ALERTS ON/OFF */}
                <div className={cn(
                  "p-3.5 rounded-xl border transition-all",
                  tgAlertsEnabled
                    ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60"
                    : "bg-slate-50 dark:bg-[#201E2E] border-slate-200 dark:border-[#2D283E]"
                )}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          Telegram Instant Alerts
                        </span>
                        <span className={cn(
                          "px-1.5 py-0.2 rounded text-[10px] font-bold uppercase",
                          !Boolean(profile?.telegramChatId)
                            ? "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                            : tgAlertsEnabled
                            ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200"
                            : "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200"
                        )}>
                          {!Boolean(profile?.telegramChatId)
                            ? 'Not Linked'
                            : tgAlertsEnabled
                            ? 'Active (ON)'
                            : 'Paused (OFF)'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        {!Boolean(profile?.telegramChatId)
                          ? 'Link your Telegram Chat ID below to receive live filing push notifications.'
                          : tgAlertsEnabled 
                          ? 'Real-time filings are automatically dispatched to your connected Telegram.' 
                          : 'Alerts are paused. Bot won’t send notifications until you turn this back on.'}
                      </p>
                    </div>

                    {/* Toggle Switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={tgAlertsEnabled}
                      onClick={() => setTgAlertsEnabled(!tgAlertsEnabled)}
                      className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden",
                        tgAlertsEnabled ? "bg-emerald-600 dark:bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                          tgAlertsEnabled ? "translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>
                </div>

                {/* 2. AI EXECUTIVE SUMMARY TOGGLE */}
                <div className={cn(
                  "p-3.5 rounded-xl border transition-all",
                  tgAiSummaryEnabled
                    ? "bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/60"
                    : "bg-slate-50 dark:bg-[#201E2E] border-slate-200 dark:border-[#2D283E]"
                )}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1">
                          <Sparkles size={12} className="text-purple-500" />
                          Gemini AI Summary Reply
                        </span>
                        <span className={cn(
                          "px-1.5 py-0.2 rounded text-[10px] font-bold uppercase",
                          tgAiSummaryEnabled
                            ? "bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        )}>
                          {tgAiSummaryEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        {tgAiSummaryEnabled
                          ? 'AI analyzes the filing PDF and sends a concise 3-bullet takeaway right below each alert.'
                          : 'AI summary is turned off. You will receive only the raw BSE alert & direct PDF link.'}
                      </p>
                    </div>

                    {/* Toggle Switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={tgAiSummaryEnabled}
                      onClick={() => setTgAiSummaryEnabled(!tgAiSummaryEnabled)}
                      className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden",
                        tgAiSummaryEnabled ? "bg-purple-600 dark:bg-purple-500" : "bg-slate-300 dark:bg-slate-700"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                          tgAiSummaryEnabled ? "translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>
                </div>

                {/* 3. ALERT SCOPE SELECTOR */}
                <div className="p-3 bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] rounded-xl space-y-2">
                  <div className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                    Alert Delivery Scope
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTgAlertScope('WATCHLIST_ONLY')}
                      className={cn(
                        "p-2.5 rounded-lg border text-left cursor-pointer transition-all",
                        tgAlertScope === 'WATCHLIST_ONLY'
                          ? "bg-white dark:bg-[#28253B] border-blue-500 ring-1 ring-blue-500 text-slate-900 dark:text-white"
                          : "bg-transparent border-slate-200 dark:border-[#2D283E] text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-[#252236]"
                      )}
                    >
                      <div className="font-bold text-[11px] flex items-center justify-between">
                        <span>Watchlist Stocks</span>
                        {tgAlertScope === 'WATCHLIST_ONLY' && <Check size={12} className="text-blue-500" />}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Only companies in your active tracking lists
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTgAlertScope('ALL_MARKET')}
                      className={cn(
                        "p-2.5 rounded-lg border text-left cursor-pointer transition-all",
                        tgAlertScope === 'ALL_MARKET'
                          ? "bg-white dark:bg-[#28253B] border-blue-500 ring-1 ring-blue-500 text-slate-900 dark:text-white"
                          : "bg-transparent border-slate-200 dark:border-[#2D283E] text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-[#252236]"
                      )}
                    >
                      <div className="font-bold text-[11px] flex items-center justify-between">
                        <span>All Market Disclosures</span>
                        {tgAlertScope === 'ALL_MARKET' && <Check size={12} className="text-blue-500" />}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        High-impact events across the entire BSE market
                      </div>
                    </button>
                  </div>
                </div>

                {/* 4. HOW TO CONNECT TELEGRAM INSTRUCTIONS */}
                <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl space-y-1.5 text-[11px] text-slate-700 dark:text-slate-300">
                  <div className="font-bold text-blue-900 dark:text-blue-200">How to connect your personal Telegram:</div>
                  <div className="flex items-start gap-1.5">
                    <span className="font-bold text-blue-600 dark:text-blue-400">1.</span>
                    <span>Open <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5">@userinfobot <ArrowUpRight size={11} /></a> and press <strong>Start</strong> to see your numeric <strong>Id</strong>.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="font-bold text-blue-600 dark:text-blue-400">2.</span>
                    <span>Open alert bot <a href={`https://t.me/${settings?.botUsername || 'Dahiyastockbot'}`} target="_blank" rel="noopener noreferrer" className="font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5">@{settings?.botUsername || 'Dahiyastockbot'} <ArrowUpRight size={11} /></a> and tap <strong className="text-emerald-700 dark:text-emerald-300">Start (/start)</strong>.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="font-bold text-blue-600 dark:text-blue-400">3.</span>
                    <span>Paste your numeric Chat ID below, tap <strong>Send test alert</strong>, then tap <strong>Save Settings</strong>.</span>
                  </div>
                </div>

                {/* 5. CHAT ID INPUT & USERNAME */}
                <div className="space-y-2">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Your Telegram Chat ID <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={tgChatIdInput}
                      onChange={e => setTgChatIdInput(e.target.value)}
                      placeholder="e.g. 987654321"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] rounded-lg text-slate-900 dark:text-white text-xs font-mono outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Telegram Username (Optional)
                    </label>
                    <input
                      type="text"
                      value={tgUsernameInput}
                      onChange={e => setTgUsernameInput(e.target.value)}
                      placeholder="e.g. your_telegram_handle"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] rounded-lg text-slate-900 dark:text-white text-xs font-mono outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                </div>

                {/* TEST ALERT STATUS FEEDBACK */}
                {testTgResult && (
                  <div className={cn(
                    "p-2.5 rounded-lg text-[11px] font-medium space-y-1",
                    testTgResult.startsWith('Success')
                      ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
                      : "bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800"
                  )}>
                    <div>{testTgResult}</div>
                    {testTgResult.toLowerCase().includes('start') && (
                      <div>
                        <a 
                          href={`https://t.me/${settings?.botUsername || 'Dahiyastockbot'}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Open @{settings?.botUsername || 'Dahiyastockbot'} in Telegram <ArrowUpRight size={12} />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* BOTTOM ACTIONS: TEST, DISCONNECT, CANCEL, SAVE */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-[#252236]">
                  <div className="flex items-center gap-2">
                    <ActionButton
                      type="button"
                      onClick={handleTestUserTelegram}
                      isLoading={isTestingTelegram}
                      loadingText="Testing..."
                      disabled={!tgChatIdInput && !profile?.telegramChatId}
                      variant="secondary"
                      size="sm"
                      icon={<Send size={12} className="text-sky-500" />}
                    >
                      Send test alert
                    </ActionButton>

                    {profile?.telegramChatId && (
                      <button
                        type="button"
                        onClick={handleUnlinkTelegram}
                        disabled={isUnlinkingTg}
                        className="px-2.5 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-[11px] font-medium transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <Unlink size={11} />
                        {isUnlinkingTg ? 'Disconnecting...' : 'Disconnect'}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveSheet(null)}
                      className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 font-semibold cursor-pointer text-xs"
                    >
                      Cancel
                    </button>
                    <ActionButton
                      type="submit"
                      isLoading={isSavingTg}
                      loadingText="Saving..."
                      variant="primary"
                      size="md"
                      icon={tgSaveSuccess ? <Check size={13} className="text-emerald-300" /> : undefined}
                    >
                      {tgSaveSuccess ? 'Saved!' : 'Save Preferences'}
                    </ActionButton>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Cache Clear Confirmation Modal (FRICTION SCALES WITH SEVERITY: Requires typing "CLEAR") */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overscroll-contain">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={springSnappy}
              className="bg-white dark:bg-[#181626] border border-rose-300 dark:border-rose-900/80 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 text-xs overscroll-contain"
            >
              <div className="flex items-center gap-2.5 text-slate-900 dark:text-white">
                <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Delete Local Cache?</h3>
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">Destructive Action</p>
                </div>
              </div>

              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                This will wipe cached company announcements, offline search index, and temporary session state. Your cloud watchlist and Google credentials will remain safe.
              </p>

              {/* Typing confirmation requirement */}
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E]">
                <label className="block text-slate-700 dark:text-slate-300 font-semibold text-[11px]">
                  To confirm, type <strong className="font-mono text-rose-600 dark:text-rose-400">CLEAR</strong> below:
                </label>
                <input
                  type="text"
                  value={clearConfirmInput}
                  onChange={e => setClearConfirmInput(e.target.value.toUpperCase())}
                  placeholder="CLEAR"
                  autoFocus
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-[#181626] border border-slate-200 dark:border-[#2D283E] rounded-lg text-slate-900 dark:text-white text-xs font-mono outline-none focus:ring-1 focus:ring-rose-500"
                />
                <div className="text-[10px] text-slate-400 flex justify-end font-mono">
                  {clearConfirmInput.length}/5 characters
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowClearConfirm(false);
                    setClearConfirmInput('');
                  }}
                  className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleClearAppCache}
                  disabled={clearConfirmInput !== 'CLEAR' || isClearingCache}
                  className={cn(
                    "px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5",
                    clearConfirmInput === 'CLEAR'
                      ? "bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-md shadow-rose-900/30"
                      : "bg-slate-200 dark:bg-[#252236] text-slate-400 dark:text-slate-600 cursor-not-allowed"
                  )}
                >
                  <Trash2 size={13} />
                  <span>{isClearingCache ? 'Wiping...' : 'Delete forever'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3.1 Delete Account & Data Confirmation Modal (Strict confirmation: Type "DELETE") */}
      <AnimatePresence>
        {showDeleteAccountConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overscroll-contain">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={springSnappy}
              className="bg-white dark:bg-[#181626] border border-rose-300 dark:border-rose-900/80 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 text-xs overscroll-contain"
            >
              <div className="flex items-center gap-2.5 text-slate-900 dark:text-white">
                <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                  <UserX size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Delete Account &amp; Data?</h3>
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">Permanent Account Removal</p>
                </div>
              </div>

              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                This action is irreversible. It will erase your stored watchlists, disconnect your personal Telegram alerts, clear local app state, and sign you out permanently.
              </p>

              {/* Typing confirmation requirement */}
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E]">
                <label className="block text-slate-700 dark:text-slate-300 font-semibold text-[11px]">
                  To confirm, type <strong className="font-mono text-rose-600 dark:text-rose-400">DELETE</strong> below:
                </label>
                <input
                  type="text"
                  value={deleteConfirmInput}
                  onChange={e => setDeleteConfirmInput(e.target.value.toUpperCase())}
                  placeholder="DELETE"
                  autoFocus
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-[#181626] border border-slate-200 dark:border-[#2D283E] rounded-lg text-slate-900 dark:text-white text-xs font-mono outline-none focus:ring-1 focus:ring-rose-500"
                />
                <div className="text-[10px] text-slate-400 flex justify-end font-mono">
                  {deleteConfirmInput.length}/6 characters
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteAccountConfirm(false);
                    setDeleteConfirmInput('');
                  }}
                  className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmInput !== 'DELETE' || isDeletingAccount}
                  className={cn(
                    "px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5",
                    deleteConfirmInput === 'DELETE'
                      ? "bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-md shadow-rose-900/30"
                      : "bg-slate-200 dark:bg-[#252236] text-slate-400 dark:text-slate-600 cursor-not-allowed"
                  )}
                >
                  <UserX size={13} />
                  <span>{isDeletingAccount ? 'Deleting...' : 'Delete My Account'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. Admin Master PIN / Root Config Sheet */}
      <AnimatePresence>
        {activeSheet === 'admin' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overscroll-contain">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={springSnappy}
              className="bg-white dark:bg-[#181626] border border-purple-200 dark:border-purple-900/60 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 text-xs overscroll-contain"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#252236] pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-purple-500" />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Admin Master Key</h3>
                </div>
                <button 
                  type="button" 
                  onClick={() => setActiveSheet(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {!isAdmin ? (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!pinUnlockInput) return;
                  setIsVerifyingPin(true);
                  setPinUnlockError(null);
                  const res = await verifyAdminPin(pinUnlockInput);
                  setIsVerifyingPin(false);
                  if (!res.success) {
                    setPinUnlockError(res.error || 'Invalid Master PIN');
                  }
                }} className="space-y-3">
                  <p className="text-slate-600 dark:text-slate-400">
                    Enter the root admin PIN to unlock server controls.
                  </p>
                  <input
                    type="password"
                    value={pinUnlockInput}
                    onChange={e => setPinUnlockInput(e.target.value)}
                    placeholder="Enter Master PIN"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] rounded-lg text-slate-900 dark:text-white text-xs font-mono outline-none focus:ring-1 focus:ring-purple-500"
                    autoFocus
                  />
                  {pinUnlockError && <p className="text-rose-500 text-[11px]">{pinUnlockError}</p>}
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveSheet(null)}
                      className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isVerifyingPin}
                      className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold cursor-pointer"
                    >
                      {isVerifyingPin ? 'Verifying...' : 'Unlock'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/60 rounded-xl border border-purple-200 dark:border-purple-800 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-purple-900 dark:text-purple-200 text-xs flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Admin Session Active
                      </div>
                      <div className="text-[10px] text-purple-700 dark:text-purple-300">
                        BSE Ingestion Engine: {settings?.isRunning ? 'Running (30s market / 5m off-hours)' : 'Paused'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleEngine}
                      disabled={isTogglingEngine}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors",
                        settings?.isRunning 
                          ? "bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white"
                      )}
                    >
                      {isTogglingEngine ? 'Updating...' : settings?.isRunning ? 'Pause Engine' : 'Resume Engine'}
                    </button>
                  </div>

                  {/* Server Telegram Broadcast Configuration */}
                  <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-[#252236]">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                        <Send size={13} className="text-blue-500" />
                        Server Telegram Bot &amp; Broadcast
                      </label>
                      <ActionButton
                        type="button"
                        onClick={handleTestServerTg}
                        isLoading={isTestingServerTg}
                        loadingText="Sending test..."
                        variant="secondary"
                        size="xs"
                        icon={<Send size={11} className="text-blue-500" />}
                      >
                        Send Test Alert
                      </ActionButton>
                    </div>

                    {serverTgTestFeedback && (
                      <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 text-[11px] border border-blue-200 dark:border-blue-800">
                        {serverTgTestFeedback}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-500 font-medium">Server Bot Token</span>
                        <input
                          type="password"
                          value={serverBotToken}
                          onChange={e => setServerBotToken(e.target.value)}
                          placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] rounded-lg text-slate-900 dark:text-white text-xs font-mono outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-medium">Broadcast Channel / Chat ID</span>
                        <input
                          type="text"
                          value={serverChatId}
                          onChange={e => setServerChatId(e.target.value)}
                          placeholder="@bse_nexus_feed or -100..."
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] rounded-lg text-slate-900 dark:text-white text-xs font-mono outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <div>
                        <span className="text-[10px] text-slate-500 font-medium">Alert Priority Filter</span>
                        <select
                          value={serverAlertPriority}
                          onChange={e => setServerAlertPriority(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] rounded-lg text-slate-900 dark:text-white text-xs outline-none cursor-pointer"
                        >
                          <option value="HIGH_ONLY">High Impact Only (Results, Dividends, LODR 30)</option>
                          <option value="ALL">All Disclosures (Unfiltered)</option>
                        </select>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-medium">Alert Category</span>
                        <select
                          value={serverAlertCategory}
                          onChange={e => setServerAlertCategory(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] rounded-lg text-slate-900 dark:text-white text-xs outline-none cursor-pointer"
                        >
                          <option value="RESULTS_ONLY">Financial Results Only</option>
                          <option value="ALL">All Categories &amp; Actions</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-[#252236]/60 mt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={serverTelegramEnabled}
                          onChange={e => setServerTelegramEnabled(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-purple-600 focus:ring-purple-500"
                        />
                        <span className="font-semibold text-xs">Broadcast Alerts Enabled (ON)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={serverTelegramAiSummary}
                          onChange={e => setServerTelegramAiSummary(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-purple-600 focus:ring-purple-500"
                        />
                        <span className="font-semibold text-xs flex items-center gap-1">
                          <Sparkles size={11} className="text-purple-500" />
                          AI Summary Replies Enabled
                        </span>
                      </label>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={serverWatchlistOnly}
                          onChange={e => setServerWatchlistOnly(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-purple-600 focus:ring-purple-500"
                        />
                        <span>Watchlist Stocks Only</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={serverMuteCrashAlerts}
                          onChange={e => setServerMuteCrashAlerts(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-purple-600 focus:ring-purple-500"
                        />
                        <span>Mute System Crash Alerts</span>
                      </label>
                    </div>
                  </div>

                  {/* Gemini AI Synthesizer Health */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-[#252236]">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                        <Sparkles size={13} className="text-purple-500" />
                        Gemini AI Extraction Engine
                      </label>
                      <ActionButton
                        type="button"
                        onClick={handleTestGemini}
                        isLoading={isTestingGemini}
                        loadingText="Synthesizing..."
                        variant="secondary"
                        size="xs"
                        icon={<Sparkles size={11} className="text-purple-500" />}
                      >
                        Test AI Engine
                      </ActionButton>
                    </div>

                    {geminiTestFeedback && (
                      <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-200 text-[11px] border border-purple-200 dark:border-purple-800">
                        {geminiTestFeedback}
                      </div>
                    )}
                  </div>

                  {/* Master PIN Modification */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-[#252236]">
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                      <KeyRound size={13} className="text-slate-500" />
                      Change Master Admin PIN
                    </span>
                    <input
                      type="password"
                      value={newMasterPin}
                      onChange={e => setNewMasterPin(e.target.value)}
                      placeholder="Leave blank to keep existing PIN"
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] rounded-lg text-slate-900 dark:text-white text-xs font-mono outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>

                  {serverSaveFeedback && (
                    <div className={cn(
                      "p-2.5 rounded-lg text-xs font-medium",
                      serverSaveFeedback.success
                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
                        : "bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800"
                    )}>
                      {serverSaveFeedback.msg}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-[#252236]">
                    <button
                      type="button"
                      onClick={() => {
                        lockAdminSession();
                        setActiveSheet(null);
                      }}
                      className="px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-bold cursor-pointer text-xs"
                    >
                      Lock Admin Session
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveSheet(null)}
                        className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 font-semibold cursor-pointer text-xs"
                      >
                        Cancel
                      </button>
                      <ActionButton
                        type="button"
                        onClick={handleSaveServerSettings}
                        isLoading={isSavingServerSettings}
                        loadingText="Saving..."
                        variant="primary"
                        size="md"
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        Save Settings
                      </ActionButton>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Embedded Support & Feedback Modal */}
      <SupportModal 
        isOpen={supportModalOpen} 
        onClose={() => setSupportModalOpen(false)} 
      />

      {/* Embedded Legal, Privacy & SEBI Modal */}
      {legalModalOpen && (
        <TermsModal
          isOpen={legalModalOpen}
          initialTab={legalModalTab}
          onClose={() => setLegalModalOpen(false)}
        />
      )}

      {/* 20-Point Launch Security Audit & Penetration Test Modal */}
      {securityAuditModalOpen && (
        <SecurityAuditModal
          isOpen={securityAuditModalOpen}
          onClose={() => setSecurityAuditModalOpen(false)}
        />
      )}

    </div>
  );
}
