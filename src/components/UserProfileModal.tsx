import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  X, User, Mail, ShieldCheck, LogOut, Settings as SettingsIcon,
  HelpCircle, Scale, Sparkles, Send, Lock, ChevronRight, CheckCircle2,
  Building2, FileText, Bell, Calendar, Plus, ExternalLink, Bookmark
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { customFetch } from '../api';
import { springSnappy, buttonTap } from '../utils/motionTokens';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
  onOpenWatchlist?: () => void;
  onOpenAlertRules?: () => void;
  onOpenHelp?: () => void;
  onOpenTerms?: () => void;
}

export function UserProfileModal({ 
  isOpen, 
  onClose, 
  onOpenSettings,
  onOpenWatchlist,
  onOpenAlertRules,
  onOpenHelp,
  onOpenTerms 
}: UserProfileModalProps) {
  const { 
    user, 
    profile, 
    isAdmin, 
    isPro, 
    proDaysLeft,
    logout, 
    lockAdminSession,
    setIsAuthModalOpen,
    setIsProModalOpen
  } = useAuth();

  useBodyScrollLock(isOpen);

  // Real-time research stats
  const [watchlistCount, setWatchlistCount] = useState<number>(0);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [nextEarningsInfo, setNextEarningsInfo] = useState<string>('Upcoming');

  useEffect(() => {
    if (!isOpen) return;

    // Fetch live research summary
    const loadSummary = async () => {
      try {
        const [wRes, nRes] = await Promise.all([
          customFetch('/api/watchlists').catch(() => null),
          customFetch('/api/notifications/unread-count').catch(() => null)
        ]);

        if (wRes && wRes.ok) {
          const wData = await wRes.json();
          if (Array.isArray(wData)) {
            const totalSymbols = new Set<string>();
            wData.forEach((list: any) => {
              (list.items || []).forEach((item: any) => {
                if (item.symbol) totalSymbols.add(item.symbol);
              });
            });
            setWatchlistCount(totalSymbols.size);
          }
        }

        if (nRes && nRes.ok) {
          const nData = await nRes.json();
          setUnreadCount(nData.unreadCount || 0);
        }
      } catch (e) {
        // Soft fallback
      }
    };

    loadSummary();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogout = async () => {
    onClose();
    await logout();
  };

  const handleNavigateWatchlist = () => {
    onClose();
    if (onOpenWatchlist) onOpenWatchlist();
  };

  const handleNavigateAlerts = () => {
    onClose();
    if (onOpenAlertRules) {
      onOpenAlertRules();
    } else if (onOpenSettings) {
      onOpenSettings();
    }
  };

  const handleOpenSettingsTab = () => {
    onClose();
    if (onOpenSettings) onOpenSettings();
  };

  const handleOpenHelpModal = () => {
    onClose();
    if (onOpenHelp) onOpenHelp();
  };

  const handleOpenTermsModal = () => {
    onClose();
    if (onOpenTerms) onOpenTerms();
  };

  const displayName = profile?.displayName || user?.displayName || 'Investor';
  const email = profile?.email || user?.email || '';
  const username = profile?.username || profile?.telegramUsername || (email ? email.split('@')[0] : 'investor');

  // Format real or sensible "Watching since" date
  const memberSince = (() => {
    try {
      const dateVal = (user as any)?.metadata?.creationTime || profile?.createdAt;
      if (dateVal) {
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) {
          return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(d);
        }
      }
    } catch {}
    return 'Jan 2025';
  })();

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150 overscroll-contain"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-profile-title"
    >
      <div 
        className="bg-white dark:bg-[#161522] border border-slate-200/90 dark:border-[#2D283E] rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 overscroll-contain flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-[#242135] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span id="user-profile-title" className="text-xs font-bold text-slate-700 dark:text-slate-300">Account Profile</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-[#252236] transition-colors cursor-pointer"
            aria-label="Close profile modal"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Identity Block: Photo, Name, Watching Since */}
          <div className="flex items-center gap-3.5">
            {profile?.photoURL ? (
              <img 
                src={profile.photoURL} 
                alt={`Avatar for ${displayName}`} 
                width={52}
                height={52}
                loading="lazy"
                decoding="async"
                className="w-13 h-13 rounded-2xl border-2 border-slate-100 dark:border-[#2D283E] object-cover shadow-xs shrink-0" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-13 h-13 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white font-black flex items-center justify-center text-lg shadow-xs shrink-0 uppercase">
                {displayName.substring(0, 2)}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                  {displayName}
                </h3>
                {isAdmin && (
                  <ShieldCheck size={14} className="text-purple-500 shrink-0" title="Admin Active" />
                )}
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {email}
              </div>

              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  Watching since {memberSince}
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                <span className={cn(
                  "text-[9.5px] font-extrabold uppercase px-1.5 py-0.5 rounded border",
                  isAdmin ? "bg-purple-50 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border-purple-200 dark:border-purple-800" :
                  isPro ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800" :
                  "bg-slate-100 text-slate-600 dark:bg-[#252236] dark:text-slate-400 border-slate-200 dark:border-[#352F48]"
                )}>
                  {isAdmin ? 'Admin' : isPro ? `Pro (${proDaysLeft}d Trial)` : user?.isAnonymous ? 'Guest' : 'Free'}
                </span>
              </div>
            </div>
          </div>

          {/* Compact "Your Research" Snapshot */}
          <div className="bg-slate-50 dark:bg-[#1C1A2B] border border-slate-200/80 dark:border-[#2A273D] rounded-2xl p-3">
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5">
              Your Research Snapshot
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-white dark:bg-[#151421] border border-slate-200/60 dark:border-[#272439]">
                <div className="text-base font-black text-slate-900 dark:text-white">
                  {watchlistCount}
                </div>
                <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  Watched
                </div>
              </div>

              <div className="p-2 rounded-xl bg-white dark:bg-[#151421] border border-slate-200/60 dark:border-[#272439]">
                <div className="text-base font-black text-emerald-600 dark:text-emerald-400">
                  {unreadCount}
                </div>
                <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  Unread
                </div>
              </div>

              <div className="p-2 rounded-xl bg-white dark:bg-[#151421] border border-slate-200/60 dark:border-[#272439]">
                <div className="text-base font-black text-slate-900 dark:text-white">
                  {profile?.telegramChatId ? 'On' : 'In-App'}
                </div>
                <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  Alerts
                </div>
              </div>
            </div>
          </div>

          {/* Action Strip: Max 2 Contextual Actions */}
          <div className="grid grid-cols-2 gap-2 select-none">
            <motion.button
              type="button"
              whileTap={buttonTap}
              transition={springSnappy}
              onClick={handleNavigateWatchlist}
              className="min-h-[44px] py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-[#282438] dark:hover:bg-[#322E46] text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs flex items-center justify-center gap-1.5 select-none"
            >
              <Plus size={14} />
              <span>Add companies</span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={buttonTap}
              transition={springSnappy}
              onClick={handleNavigateAlerts}
              className="min-h-[44px] py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#201E2E] dark:hover:bg-[#29263A] text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-[#2D283E] text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 select-none"
            >
              <Bell size={14} />
              <span>Manage alerts</span>
            </motion.button>
          </div>

          {/* Quiet Destinations List (Groww Style) */}
          <div className="rounded-2xl border border-slate-100 dark:border-[#252236] bg-white dark:bg-[#181626] divide-y divide-slate-100 dark:divide-[#252236] text-xs overflow-hidden select-none">
            {/* My Watchlist */}
            <motion.button
              type="button"
              whileTap={buttonTap}
              transition={springSnappy}
              onClick={handleNavigateWatchlist}
              className="w-full min-h-[44px] p-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-[#201E2E] transition-colors cursor-pointer text-slate-800 dark:text-slate-200 select-none"
            >
              <div className="flex items-center gap-2.5">
                <Building2 size={15} className="text-purple-500" />
                <span className="font-semibold">My Watchlist</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="text-[11px] font-medium">{watchlistCount} stocks</span>
                <ChevronRight size={14} />
              </div>
            </motion.button>

            {/* Alert Rules & Delivery */}
            <motion.button
              type="button"
              whileTap={buttonTap}
              transition={springSnappy}
              onClick={handleNavigateAlerts}
              className="w-full min-h-[44px] p-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-[#201E2E] transition-colors cursor-pointer text-slate-800 dark:text-slate-200 select-none"
            >
              <div className="flex items-center gap-2.5">
                <Bell size={15} className="text-amber-500" />
                <span className="font-semibold">Alerts & Notifications</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="text-[11px] font-medium">
                  {profile?.telegramChatId ? 'Telegram active' : 'In-App'}
                </span>
                <ChevronRight size={14} />
              </div>
            </motion.button>

            {/* Saved Research & Guides */}
            <motion.button
              type="button"
              whileTap={buttonTap}
              transition={springSnappy}
              onClick={handleOpenHelpModal}
              className="w-full min-h-[44px] p-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-[#201E2E] transition-colors cursor-pointer text-slate-800 dark:text-slate-200 select-none"
            >
              <div className="flex items-center gap-2.5">
                <Bookmark size={15} className="text-blue-500" />
                <span className="font-semibold">Saved Research & Guides</span>
              </div>
              <ChevronRight size={14} className="text-slate-400" />
            </motion.button>

            {/* Account Preferences */}
            <motion.button
              type="button"
              whileTap={buttonTap}
              transition={springSnappy}
              onClick={handleOpenSettingsTab}
              className="w-full min-h-[44px] p-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-[#201E2E] transition-colors cursor-pointer text-slate-800 dark:text-slate-200 select-none"
            >
              <div className="flex items-center gap-2.5">
                <SettingsIcon size={15} className="text-slate-500" />
                <span className="font-semibold">Settings & Preferences</span>
              </div>
              <ChevronRight size={14} className="text-slate-400" />
            </motion.button>

            {/* If Admin is actively unlocked, show option to lock admin session */}
            {isAdmin && (
              <motion.button
                type="button"
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={() => {
                  onClose();
                  lockAdminSession();
                }}
                className="w-full min-h-[44px] p-3 flex items-center justify-between text-left hover:bg-purple-100/50 dark:hover:bg-purple-950/30 transition-colors cursor-pointer text-purple-700 dark:text-purple-300 font-semibold select-none"
              >
                <div className="flex items-center gap-2.5">
                  <Lock size={15} />
                  <span>Lock Admin Session</span>
                </div>
                <span className="text-[10px] uppercase font-bold">Active</span>
              </motion.button>
            )}
          </div>

          {/* Standalone Sign Out Button */}
          <div className="pt-1 select-none">
            <motion.button
              type="button"
              whileTap={buttonTap}
              transition={springSnappy}
              onClick={handleLogout}
              className="w-full min-h-[44px] py-2.5 px-3 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50/60 dark:hover:bg-rose-950/30 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer select-none"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
