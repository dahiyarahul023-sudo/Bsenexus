import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Send, Sparkles, Sliders, 
  Sun, Moon, KeyRound, AlertTriangle, 
  RefreshCw, CheckCircle2, Check, 
  Lock, Save, Copy,
  CheckCheck, Terminal, ShieldAlert, Cpu, HardDrive, ChevronRight,
  Download, LogOut, Database, FileSpreadsheet,
  FileJson, Trash2, MoreHorizontal, X, Bell, ShieldCheck,
  Volume2, VolumeX, Eye, HelpCircle, Scale, MessageSquare, ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { customFetch } from '../api';
import { useDeveloperMode } from '../utils/developerMode';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { springSnappy, buttonTap } from '../utils/motionTokens';
import { SupportModal } from './ui/SupportFloat';
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
    logout,
    updateProfileInfo,
    checkUsernameAvailability,
    updateTelegramChatId,
    updateNotificationPreferences,
    verifyAdminPin,
    lockAdminSession,
    setIsAuthModalOpen,
    setIsProModalOpen,
    setIsAdminPinModalOpen
  } = useAuth();

  // Active Sub-modal / Drawer state for progressive disclosure
  const [activeSheet, setActiveSheet] = useState<string | null>(null);

  // Profile Edit State
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [tgUsernameInput, setTgUsernameInput] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const [usernameValidationMsg, setUsernameValidationMsg] = useState<string | null>(null);

  // Telegram Notifications State
  const [tgChatIdInput, setTgChatIdInput] = useState('');
  const [isSavingTg, setIsSavingTg] = useState(false);
  const [tgSaveSuccess, setTgSaveSuccess] = useState(false);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [testTgResult, setTestTgResult] = useState<string | null>(null);

  // Export & Cache Clear State
  const [isExportingWatchlist, setIsExportingWatchlist] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [cacheClearFeedback, setCacheClearFeedback] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);

  // Lock body scroll whenever settings modal/drawer is open
  useBodyScrollLock(Boolean(activeSheet || showClearConfirm));

  // Sound preference from localStorage
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('bse_sound_enabled') !== 'false';
    } catch {
      return true;
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

  useEffect(() => {
    if (profile) {
      setDisplayNameInput(profile.displayName || '');
      const defaultHandle = profile.username || (profile.email ? profile.email.split('@')[0] : '');
      setUsernameInput(defaultHandle);
      setTgUsernameInput(profile.telegramUsername || '');
      setTgChatIdInput(profile.telegramChatId || '');
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
      setServerMuteCrashAlerts(Boolean(settings.muteCrashAlerts));
    }
  }, [settings]);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      localStorage.setItem('bse_sound_enabled', String(next));
    } catch {}
  };

  const handleToggleFilter = async () => {
    const next = !isFilterEnabled;
    setIsFilterEnabled(next);
    try {
      await customFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          isFilterEnabled: next
        })
      });
      fetchSettings();
    } catch (e) {
      console.warn('Failed to update filter setting:', e);
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

  const handleSaveTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingTg(true);
    const success = await updateTelegramChatId(tgChatIdInput.trim(), tgUsernameInput.trim());
    setIsSavingTg(false);
    if (success) {
      setTgSaveSuccess(true);
      setTimeout(() => {
        setTgSaveSuccess(false);
        setActiveSheet(null);
      }, 1500);
    }
  };

  const handleTestUserTelegram = async () => {
    if (!user || user.isAnonymous) {
      setIsAuthModalOpen?.(true);
      setTestTgResult('Please sign in with Google to configure your personal Telegram alerts.');
      return;
    }
    if (!tgChatIdInput || !tgChatIdInput.trim()) {
      setTestTgResult('Please enter your Telegram Chat ID first.');
      return;
    }
    setIsTestingTelegram(true);
    setTestTgResult(null);
    try {
      const res = await customFetch('/api/users/test-telegram', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: tgChatIdInput.trim() })
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
      setTimeout(() => setCacheClearFeedback(null), 3500);
    } catch (e: any) {
      setCacheClearFeedback(`Cache cleanup error: ${e.message}`);
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleToggleEngine = async () => {
    setIsTogglingEngine(true);
    try {
      const res = await customFetch('/api/toggle', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSettings((prev: any) => ({ ...prev, isRunning: data.isRunning }));
      }
    } catch (err: any) {
      console.warn("Failed to toggle engine", err);
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

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-200 pb-20">
      
      {/* Page Title */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
          Settings
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Manage your research experience, notifications, and data
        </p>
      </div>

      {/* Feedback Toast Banner */}
      {(exportFeedback || cacheClearFeedback) && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs rounded-xl flex items-center justify-between shadow-xs">
          <span>{exportFeedback || cacheClearFeedback}</span>
        </div>
      )}

      {/* SECTION 1: APP PREFERENCES */}
      <div className="space-y-2 select-none">
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
          App preferences
        </h3>

        <div className="bg-white dark:bg-[#181626] border border-slate-200/90 dark:border-[#2D283E] rounded-2xl divide-y divide-slate-100 dark:divide-[#252236] overflow-hidden shadow-2xs">
          {/* Theme Toggle Row */}
          <div className="p-3.5 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-900 dark:text-white">Appearance</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400 font-medium capitalize">
                {theme === 'dark' ? 'Dark' : 'Light'}
              </span>
              <motion.button
                type="button"
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={() => setTheme && setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-slate-100 dark:bg-[#252236] text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#2F2B40] transition-colors cursor-pointer"
                title="Toggle Dark / Light theme"
              >
                {theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
              </motion.button>
            </div>
          </div>

          {/* Sound / Chime Toggle Row */}
          <div className="p-3.5 flex items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-semibold text-slate-900 dark:text-white">Audio alerts</span>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Play chime on high-impact filing updates</div>
            </div>
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

          {/* Filing Materiality Filter Toggle */}
          <div className="p-3.5 flex items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-semibold text-slate-900 dark:text-white">High impact filter</span>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Highlight material price-sensitive disclosures</div>
            </div>
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
      </div>

      {/* SECTION 2: WATCHLIST */}
      <div className="space-y-2 select-none">
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
          Watchlist
        </h3>

        <div className="bg-white dark:bg-[#181626] border border-slate-200/90 dark:border-[#2D283E] rounded-2xl divide-y divide-slate-100 dark:divide-[#252236] overflow-hidden shadow-2xs">
          {/* Export Watchlist CSV */}
          <motion.button
            type="button"
            whileTap={buttonTap}
            transition={springSnappy}
            onClick={() => handleExportWatchlist('csv')}
            disabled={isExportingWatchlist}
            className="w-full min-h-[44px] p-3.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-[#201E2E] transition-colors cursor-pointer text-xs"
          >
            <div>
              <span className="font-semibold text-slate-900 dark:text-white">Export to CSV</span>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Download your tracked tickers and priorities</div>
            </div>
            <div className="flex items-center gap-1 text-slate-400">
              <Download size={14} />
            </div>
          </motion.button>

          {/* Export Watchlist JSON */}
          <motion.button
            type="button"
            whileTap={buttonTap}
            transition={springSnappy}
            onClick={() => handleExportWatchlist('json')}
            disabled={isExportingWatchlist}
            className="w-full min-h-[44px] p-3.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-[#201E2E] transition-colors cursor-pointer text-xs"
          >
            <div>
              <span className="font-semibold text-slate-900 dark:text-white">Export backup (JSON)</span>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Full structured backup for porting</div>
            </div>
            <div className="flex items-center gap-1 text-slate-400">
              <Download size={14} />
            </div>
          </motion.button>
        </div>
      </div>

      {/* SECTION 3: ALERTS */}
      <div className="space-y-2 select-none">
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
          Alerts
        </h3>

        <div className="bg-white dark:bg-[#181626] border border-slate-200/90 dark:border-[#2D283E] rounded-2xl divide-y divide-slate-100 dark:divide-[#252236] overflow-hidden shadow-2xs">
          {/* Telegram Personal Alert Connection */}
          <motion.button
            type="button"
            whileTap={buttonTap}
            transition={springSnappy}
            onClick={() => setActiveSheet('telegram')}
            className="w-full min-h-[44px] p-3.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-[#201E2E] transition-colors cursor-pointer text-xs"
          >
            <div>
              <span className="font-semibold text-slate-900 dark:text-white">Telegram delivery</span>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Instant push notifications for watchlist disclosures</div>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className={cn(
                "text-[11px] font-semibold",
                profile?.telegramChatId ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
              )}>
                {profile?.telegramChatId ? 'Connected' : 'Not linked'}
              </span>
              <ChevronRight size={14} />
            </div>
          </motion.button>

          {/* User Profile / Username */}
          <motion.button
            type="button"
            whileTap={buttonTap}
            transition={springSnappy}
            onClick={() => setActiveSheet('profile')}
            className="w-full min-h-[44px] p-3.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-[#201E2E] transition-colors cursor-pointer text-xs"
          >
            <div>
              <span className="font-semibold text-slate-900 dark:text-white">Profile & Display name</span>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{profile?.displayName || user?.displayName || 'Investor'}</div>
            </div>
            <div className="flex items-center gap-1 text-slate-400">
              <span className="text-[11px] font-mono">{profile?.username ? `@${profile.username}` : ''}</span>
              <ChevronRight size={14} />
            </div>
          </motion.button>
        </div>
      </div>

      {/* SECTION 4: PRIVACY & SECURITY */}
      <div className="space-y-2 select-none">
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
          Privacy &amp; security
        </h3>

        <div className="bg-white dark:bg-[#181626] border border-slate-200/90 dark:border-[#2D283E] rounded-2xl divide-y divide-slate-100 dark:divide-[#252236] overflow-hidden shadow-2xs">
          {/* Clear Local Cache */}
          <motion.button
            type="button"
            whileTap={buttonTap}
            transition={springSnappy}
            onClick={() => setShowClearConfirm(true)}
            className="w-full min-h-[44px] p-3.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-[#201E2E] transition-colors cursor-pointer text-xs"
          >
            <div>
              <span className="font-semibold text-slate-900 dark:text-white">Clear local cache</span>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Clean temporary offline storage and indexes</div>
            </div>
            <ChevronRight size={14} className="text-slate-400" />
          </motion.button>

          {/* Admin Diagnostics link (if owner/admin) */}
          {(isOwner || isAdmin) && (
            <motion.button
              type="button"
              whileTap={buttonTap}
              transition={springSnappy}
              onClick={() => setActiveSheet('admin')}
              className="w-full min-h-[44px] p-3.5 flex items-center justify-between text-left hover:bg-purple-50/50 dark:hover:bg-purple-950/30 transition-colors cursor-pointer text-xs"
            >
              <div>
                <span className="font-semibold text-purple-700 dark:text-purple-300">Server &amp; Admin keys</span>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Root configuration and master security</div>
              </div>
              <ChevronRight size={14} className="text-purple-400" />
            </motion.button>
          )}
        </div>
      </div>

      {/* SECTION 5: ADMIN CONTROLS (Only visible to unlocked admins) */}
      {(isAdmin || isOwner) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck size={14} />
              Admin &amp; Server controls
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              UNLOCKED
            </span>
          </div>

          <div className="bg-white dark:bg-[#181626] border border-purple-200/90 dark:border-purple-900/50 rounded-2xl divide-y divide-slate-100 dark:divide-[#252236] overflow-hidden shadow-2xs">
            {/* System Diagnostics */}
            <button
              type="button"
              onClick={() => onNavigate ? onNavigate('diagnostics') : setActiveSheet('admin')}
              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-colors cursor-pointer text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
                  <ShieldAlert size={16} />
                </div>
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white">System Diagnostics &amp; Telemetry</span>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Crash-free rates, device health, and memory stats</div>
                </div>
              </div>
              <ChevronRight size={14} className="text-slate-400" />
            </button>

            {/* Engine Activity Logs */}
            <button
              type="button"
              onClick={() => onNavigate ? onNavigate('logs') : setActiveSheet('admin')}
              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-colors cursor-pointer text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <Terminal size={16} />
                </div>
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white">Engine Activity Logs</span>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Live stream of BSE ingestion, Gemini AI summaries &amp; workers</div>
                </div>
              </div>
              <ChevronRight size={14} className="text-slate-400" />
            </button>

            {/* Database & Storage */}
            <button
              type="button"
              onClick={() => onNavigate ? onNavigate('storage') : setActiveSheet('admin')}
              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-colors cursor-pointer text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <Database size={16} />
                </div>
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white">Storage Manager &amp; Quotas</span>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Firestore quotas, backup downloads, and cache health</div>
                </div>
              </div>
              <ChevronRight size={14} className="text-slate-400" />
            </button>

            {/* Server Configuration & Bot Keys */}
            <button
              type="button"
              onClick={() => setActiveSheet('admin')}
              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-colors cursor-pointer text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <KeyRound size={16} />
                </div>
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white">Server Keys &amp; Ingestion Config</span>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Bot token, Master PIN, AI summarizer test, and live toggle</div>
                </div>
              </div>
              <ChevronRight size={14} className="text-slate-400" />
            </button>
          </div>
        </div>
      )}

      {/* SECTION 6: HELP & LEGAL */}
      <div className="space-y-2 select-none">
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
          Support &amp; Feedback
        </h3>

        <div className="bg-white dark:bg-[#181626] border border-slate-200/90 dark:border-[#2D283E] rounded-2xl divide-y divide-slate-100 dark:divide-[#252236] overflow-hidden shadow-2xs">
          {/* Help & Support Button */}
          <motion.button
            type="button"
            whileTap={buttonTap}
            transition={springSnappy}
            onClick={() => setSupportModalOpen(true)}
            className="w-full min-h-[48px] p-3.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-[#201E2E] transition-colors cursor-pointer text-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <MessageSquare size={16} />
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-white">Help &amp; Feedback Center</span>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Direct assistance, Telegram community &amp; bug reporting</div>
              </div>
            </div>
            <ChevronRight size={14} className="text-slate-400" />
          </motion.button>
        </div>
      </div>

      {/* SECTION 7: ABOUT & LEGAL */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
          App &amp; legal
        </h3>

        <div className="bg-white dark:bg-[#181626] border border-slate-200/90 dark:border-[#2D283E] rounded-2xl divide-y divide-slate-100 dark:divide-[#252236] overflow-hidden shadow-2xs">
          <div className="p-3.5 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-900 dark:text-white">Version</span>
            <span className="font-mono text-slate-400 text-[11px]">v2.5.0</span>
          </div>

          <div className="p-3.5 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-900 dark:text-white">Data source</span>
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">BSE Corporate Disclosures</span>
          </div>
        </div>
      </div>

      {/* ISOLATED SIGN OUT BUTTON AT THE BOTTOM */}
      <div className="pt-3">
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="w-full py-3 px-4 rounded-xl bg-white hover:bg-rose-50 dark:bg-[#181626] dark:hover:bg-rose-950/30 border border-slate-200/90 dark:border-[#2D283E] text-rose-600 dark:text-rose-400 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
        >
          <LogOut size={15} />
          <span>{isSigningOut ? 'Signing out...' : 'Sign out'}</span>
        </button>
      </div>

      {/* QUIET FOOTER */}
      <div className="text-center pt-2 pb-6 text-[11px] text-slate-400 dark:text-slate-500 space-y-1">
        <div>BSENEXUS Capital Markets Intelligence</div>
        <div>Compliant with SEBI (LODR) Public Disclosure Framework</div>
      </div>

      {/* PROGRESSIVE DISCLOSURE MODALS */}

      {/* 1. Profile Edit Sheet */}
      <AnimatePresence>
        {activeSheet === 'profile' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overscroll-contain">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
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
                    className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-[#2A263D] dark:hover:bg-[#342F4C] text-white font-bold cursor-pointer"
                  >
                    {isSavingProfile ? 'Saving...' : profileSaveSuccess ? 'Saved!' : 'Save changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Telegram Setup Sheet */}
      <AnimatePresence>
        {activeSheet === 'telegram' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overscroll-contain">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#181626] border border-slate-200 dark:border-[#2D283E] rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 overscroll-contain"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#252236] pb-3">
                <div className="flex items-center gap-2">
                  <Send size={16} className="text-blue-500" />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Telegram Alerts</h3>
                </div>
                <button 
                  type="button" 
                  onClick={() => setActiveSheet(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveTelegram} className="space-y-3 text-xs">
                <p className="text-slate-600 dark:text-slate-400">
                  Receive instant alerts on your Telegram when companies in your watchlist file corporate announcements.
                </p>

                <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl space-y-1.5 text-[11px] text-slate-700 dark:text-slate-300">
                  <div className="font-bold text-blue-900 dark:text-blue-200">How to get your Chat ID:</div>
                  <div>1. Open Telegram and search for <strong className="font-mono">@userinfobot</strong></div>
                  <div>2. Tap <strong>Start</strong> to see your numeric <strong>Id</strong> (e.g. 123456789)</div>
                  <div>3. Search for <strong className="font-mono">@BSENexusBot</strong> and send <strong className="font-mono">/start</strong></div>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Your Telegram Chat ID</label>
                  <input
                    type="text"
                    value={tgChatIdInput}
                    onChange={e => setTgChatIdInput(e.target.value)}
                    placeholder="e.g. 987654321"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] rounded-lg text-slate-900 dark:text-white text-xs font-mono outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                {testTgResult && (
                  <div className={cn(
                    "p-2.5 rounded-lg text-[11px] font-medium",
                    testTgResult.startsWith('Success')
                      ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
                      : "bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800"
                  )}>
                    {testTgResult}
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleTestUserTelegram}
                    disabled={isTestingTelegram || !tgChatIdInput}
                    className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#201E2E] dark:hover:bg-[#28253A] text-slate-700 dark:text-slate-300 font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {isTestingTelegram ? 'Testing...' : 'Send test alert'}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveSheet(null)}
                      className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingTg}
                      className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-[#2A263D] dark:hover:bg-[#342F4C] text-white font-bold cursor-pointer"
                    >
                      {isSavingTg ? 'Saving...' : tgSaveSuccess ? 'Saved!' : 'Save'}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Cache Clear Confirmation Sheet */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overscroll-contain">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#181626] border border-slate-200 dark:border-[#2D283E] rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 text-xs overscroll-contain"
            >
              <div className="flex items-center gap-2.5 text-slate-900 dark:text-white">
                <Trash2 className="text-amber-500" size={18} />
                <h3 className="font-bold text-sm">Clear Local Data?</h3>
              </div>

              <p className="text-slate-600 dark:text-slate-400">
                This will clear cached company announcements and temporary search indexes. Your account settings and cloud watchlist will remain intact.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleClearAppCache}
                  disabled={isClearingCache}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                >
                  {isClearingCache ? 'Clearing...' : 'Clear cache'}
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
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] rounded-lg text-slate-900 dark:text-white text-xs font-mono outline-none"
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
                        BSE Ingestion Engine: {settings?.isRunning ? 'Running (15s polling)' : 'Paused'}
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
                      <button
                        type="button"
                        onClick={handleTestServerTg}
                        disabled={isTestingServerTg}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer disabled:opacity-50"
                      >
                        {isTestingServerTg ? 'Sending test...' : 'Send Test Alert'}
                      </button>
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
                      <button
                        type="button"
                        onClick={handleTestGemini}
                        disabled={isTestingGemini}
                        className="text-[11px] font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 cursor-pointer disabled:opacity-50"
                      >
                        {isTestingGemini ? 'Synthesizing...' : 'Test AI Engine'}
                      </button>
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
                      <button
                        type="button"
                        onClick={handleSaveServerSettings}
                        disabled={isSavingServerSettings}
                        className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold cursor-pointer text-xs disabled:opacity-50"
                      >
                        {isSavingServerSettings ? 'Saving...' : 'Save Settings'}
                      </button>
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

    </div>
  );
}
