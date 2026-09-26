import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Clock, Calendar, AlertTriangle, ChevronDown, 
  CalendarDays, Flame, X, CheckCircle2, Info, ArrowUpRight,
  Send, Mail, CalendarPlus, Download, Check, Sparkles, Lock, Share2
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../../context/AuthContext';
import { customFetch } from '../../api';
import { 
  INDIAN_MARKET_HOLIDAYS, 
  getUpcomingMarketHolidays, 
  getAdvanceHolidayNotice, 
  getActiveOptionExpiriesForDate, 
  isDateMarketHoliday,
  generateGoogleCalendarUrl,
  downloadIcsCalendarFile,
  MarketHoliday 
} from '../../utils/marketHolidays';

import { MarketHolidaysModal } from './MarketHolidaysModal';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function MarketClock({ className }: { className?: string }) {
  const { user, profile, isAdmin, isPro, adminUnlocked, setIsProModalOpen, setIsAuthModalOpen } = useAuth();
  const [now, setNow] = useState(new Date());
  const [showDetails, setShowDetails] = useState(false);
  const [showFullCalendarModal, setShowFullCalendarModal] = useState(false);
  const [calendarYearFilter, setCalendarYearFilter] = useState<string>('2026');
  const [isSendingHolidayTelegram, setIsSendingHolidayTelegram] = useState<string | null>(null);
  const [holidayTelegramStatus, setHolidayTelegramStatus] = useState<string | null>(null);
  const [copiedHolidayDate, setCopiedHolidayDate] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const canBroadcast = isAdmin || isPro || adminUnlocked || profile?.tier === 'pro' || profile?.tier === 'admin';

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowDetails(false);
      }
    }
    if (showDetails) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDetails]);

  // Handle ESC key for popover & modal
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setShowFullCalendarModal(false);
        setShowDetails(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Convert to Indian Standard Time (IST: UTC + 5:30)
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const utcTs = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  const istDate = new Date(utcTs + istOffsetMs);

  const dayOfWeek = istDate.getDay(); // 0 = Sun, 6 = Sat
  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  const dateStr = `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2, '0')}-${String(istDate.getDate()).padStart(2, '0')}`;
  const todayHoliday = isDateMarketHoliday(dateStr);
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const isPreMarket = isWeekday && !todayHoliday && totalMinutes >= 540 && totalMinutes < 555; // 09:00 - 09:15 IST
  const isMarketOpen = isWeekday && !todayHoliday && totalMinutes >= 555 && totalMinutes < 930; // 09:15 - 15:30 IST
  const isPostMarket = isWeekday && !todayHoliday && totalMinutes >= 930 && totalMinutes < 960; // 15:30 - 16:00 IST

  // Advance Holiday Alert (2-3 days prior)
  const holidayNotice = getAdvanceHolidayNotice(istDate);
  const upcomingHolidays = getUpcomingMarketHolidays(istDate, 45);
  const optionExpiries = getActiveOptionExpiriesForDate(istDate);

  let sessionState: { label: string; dotColor: string; badgeBg: string; badgeText: string; desc: string };
  if (todayHoliday) {
    if (todayHoliday.isMuhuratTrading) {
      sessionState = {
        label: 'Muhurat Session Today',
        dotColor: 'bg-amber-500 animate-bounce',
        badgeBg: 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700/80',
        badgeText: 'text-amber-800 dark:text-amber-300',
        desc: `Diwali Muhurat Trading Session (${todayHoliday.muhuratTiming || '06:15 PM - 07:15 PM IST'})`
      };
    } else {
      sessionState = {
        label: 'Holiday (Closed)',
        dotColor: 'bg-rose-500',
        badgeBg: 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800/80',
        badgeText: 'text-rose-700 dark:text-rose-300',
        desc: `Indian Stock Markets closed today for ${todayHoliday.name}`
      };
    }
  } else if (isMarketOpen) {
    sessionState = {
      label: 'Market Open',
      dotColor: 'bg-emerald-500',
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/80',
      badgeText: 'text-emerald-700 dark:text-emerald-300',
      desc: 'Live BSE / NSE Regular Trading Session (09:15 AM - 03:30 PM IST)'
    };
  } else if (isPreMarket) {
    sessionState = {
      label: 'Pre-Open Call',
      dotColor: 'bg-amber-500',
      badgeBg: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/80',
      badgeText: 'text-amber-700 dark:text-amber-300',
      desc: 'Pre-Market Price Discovery Order Placement (09:00 AM - 09:15 AM IST)'
    };
  } else if (isPostMarket) {
    sessionState = {
      label: 'Post-Closing',
      dotColor: 'bg-blue-500',
      badgeBg: 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800/80',
      badgeText: 'text-blue-700 dark:text-blue-300',
      desc: 'Post-Market Settlement Session (03:30 PM - 04:00 PM IST)'
    };
  } else {
    sessionState = {
      label: isWeekend ? 'Weekend (Closed)' : 'Market Closed',
      dotColor: 'bg-slate-400',
      badgeBg: 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80',
      badgeText: 'text-slate-600 dark:text-slate-400',
      desc: isWeekend 
        ? 'Weekend - BSE/NSE will reopen on Monday at 09:15 AM IST' 
        : 'Regular session closed. Next session opens at 09:15 AM IST'
    };
  }

  const getHolidayCalendarLink = (holiday: MarketHoliday) => {
    return generateGoogleCalendarUrl({
      title: `BSE/NSE Holiday: ${holiday.name} (Market Closed)`,
      description: `Indian Stock Markets (BSE & NSE) are CLOSED for ${holiday.name}.\nDate: ${holiday.date} (${holiday.day})\n${holiday.isMuhuratTrading ? `Special Muhurat Trading: ${holiday.muhuratTiming || 'Evening'}\n` : 'Segments Closed: Capital Market (Equities), Derivatives (F&O), Currency.\n'}Note: F&O weekly/monthly contracts expire on preceding trading day.`,
      dateStr: holiday.date
    });
  };

  const handleSendHolidayTelegram = async (holiday: MarketHoliday) => {
    if (!canBroadcast) {
      if (!user && !profile) {
        setIsAuthModalOpen(true);
        alert('🔒 Holiday Telegram Broadcasting is reserved for Pro & Admin users.\n\nSign In to activate your 1-Week Free Pro Trial or Upgrade to Pro (₹199/mo)!');
      } else {
        setIsProModalOpen(true);
        alert('🔒 Market Holiday Telegram Broadcast is a Pro & Admin feature (₹199/mo).\n\nUpgrade to Pro to broadcast official exchange circulars and trading schedules to your Telegram channel!');
      }
      return;
    }

    setIsSendingHolidayTelegram(holiday.date);
    setHolidayTelegramStatus(null);
    const calendarLink = getHolidayCalendarLink(holiday);

    try {
      const res = await customFetch('/api/send-holiday-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: holiday.name,
          date: holiday.date,
          day: holiday.day,
          isMuhuratTrading: holiday.isMuhuratTrading,
          muhuratTiming: holiday.muhuratTiming,
          calendarUrl: calendarLink
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setHolidayTelegramStatus(`Market Holiday notice for ${holiday.name} broadcasted to Telegram!`);
        setTimeout(() => setHolidayTelegramStatus(null), 4000);
      } else {
        alert(data.error || 'Failed to broadcast holiday to Telegram');
      }
    } catch (e: any) {
      alert('Failed to broadcast: ' + e.message);
    } finally {
      setIsSendingHolidayTelegram(null);
    }
  };

  const handleShareHolidayEmail = (holiday: MarketHoliday) => {
    const calendarLink = getHolidayCalendarLink(holiday);
    const subject = encodeURIComponent(`Market Holiday Notification: ${holiday.name} (${holiday.date}) - BSE & NSE Closed`);
    const body = encodeURIComponent(
      `Hello,\n\nPlease be informed about the upcoming Indian Stock Exchanges holiday:\n\n` +
      `🏛️ Holiday: ${holiday.name}\n` +
      `📅 Date: ${holiday.date} (${holiday.day})\n` +
      `🛑 Status: BSE and NSE will remain CLOSED for Equity (Cash), Equity Derivatives (F&O), and Currency Segments.\n` +
      (holiday.isMuhuratTrading ? `🪔 Special Muhurat Trading Session will be held: ${holiday.muhuratTiming || 'Evening'}\n` : '') +
      `⚡ F&O Expiry Note: Derivative contracts scheduled for this day will expire on the preceding trading session.\n\n` +
      `📅 Add to Google Calendar (1-Click):\n${calendarLink}\n\n` +
      `Track real-time market updates on BSE Nexus.\n`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleCopyHolidayCalendar = (holiday: MarketHoliday) => {
    const link = getHolidayCalendarLink(holiday);
    navigator.clipboard.writeText(link);
    setCopiedHolidayDate(holiday.date);
    setTimeout(() => setCopiedHolidayDate(null), 2000);
  };

  const handleDownloadHolidayIcs = (holiday: MarketHoliday) => {
    downloadIcsCalendarFile({
      title: `BSE/NSE Market Holiday: ${holiday.name}`,
      description: `Indian Stock Exchanges (BSE/NSE) CLOSED for ${holiday.name}. Date: ${holiday.date} (${holiday.day}).`,
      dateStr: holiday.date,
      filename: `BSE_Holiday_${holiday.date}_${holiday.name.replace(/[^a-zA-Z0-9]/g, '_')}.ics`
    });
  };

  // Format IST time strings
  const hours12 = (hours % 12) || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const pad = (n: number) => n.toString().padStart(2, '0');
  const timeFormatted = `${pad(hours12)}:${pad(minutes)}:${pad(istDate.getSeconds())} ${ampm}`;
  const timeCompact = `${pad(hours12)}:${pad(minutes)} ${ampm}`;
  const dateFormatted = istDate.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <>
      <div className={cn("relative inline-block", className)} ref={popoverRef}>
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className={cn(
            "flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:py-1 rounded-lg border text-xs font-semibold transition-all duration-150 ease-out cursor-pointer shadow-xs select-none group active:scale-[0.97] min-h-[36px] sm:min-h-[32px]",
            holidayNotice.hasNotice && holidayNotice.daysLeft <= 1
              ? "bg-amber-50/90 dark:bg-amber-950/40 border-amber-300/80 dark:border-amber-800/60 text-slate-800 dark:text-amber-200 hover:bg-amber-100/70"
              : "bg-slate-100/90 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-200"
          )}
          title="Indian Standard Time (IST), Live Market Status & Holiday Schedule (Click for details)"
        >
          {/* Status Dot with pulse on live market */}
          <span className={cn("w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0", sessionState.dotColor, isMarketOpen && "animate-pulse")} />
          
          {/* Digital Time */}
          <div className="flex items-baseline tabular-nums">
            <span className="font-mono tracking-tight font-bold text-slate-900 dark:text-white text-xs tabular-nums">{timeFormatted}</span>
          </div>

          <ChevronDown className={cn("w-3 h-3 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform duration-200 shrink-0", showDetails && "rotate-180")} />
        </button>

        {/* Popover Details Modal */}
        {showDetails && (
          <div className="fixed sm:absolute right-3 sm:right-0 top-14 sm:top-full mt-2 w-[calc(100vw-24px)] sm:w-84 max-w-sm p-4 rounded-xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-900/10 dark:shadow-black/60 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-3 text-xs text-slate-700 dark:text-slate-300">
            
            {/* Header with IST and Session badge */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-500" />
                <span className="font-extrabold text-slate-900 dark:text-white">
                  Market Hours & Schedule
                </span>
              </div>
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", sessionState.badgeBg, sessionState.badgeText)}>
                {sessionState.label}
              </span>
            </div>

            {/* Advance 2-3 Days Holiday Alert Box */}
            {holidayNotice.hasNotice && (
              <div className={cn(
                "p-2.5 rounded-lg border text-[11px] leading-relaxed space-y-2",
                holidayNotice.daysLeft === 0
                  ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300"
                  : holidayNotice.daysLeft <= 2
                  ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300"
                  : "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60 text-blue-800 dark:text-blue-300"
              )}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                  <div className="flex-1">
                    <div className="font-bold">{holidayNotice.message}</div>
                    <div className="text-[10px] opacity-80 mt-0.5">
                      {holidayNotice.daysLeft === 0 
                        ? "Standard cash & derivative segments are closed today." 
                        : `Advance notice: Stock exchanges will be closed on ${holidayNotice.holiday?.day}, ${holidayNotice.holiday?.date}. F&O expiries auto-adjusted.`}
                    </div>
                  </div>
                </div>

                {holidayNotice.holiday && (
                  <div className="flex items-center gap-1.5 pt-1 border-t border-amber-200/50 dark:border-amber-800/40">
                    <button
                      type="button"
                      onClick={() => handleSendHolidayTelegram(holidayNotice.holiday!)}
                      disabled={isSendingHolidayTelegram === holidayNotice.holiday.date}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer",
                        canBroadcast 
                          ? "bg-blue-600 hover:bg-blue-700 text-white shadow-2xs" 
                          : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      )}
                      title={canBroadcast ? "Broadcast Market Holiday to Telegram" : "Telegram Broadcast (Pro / Admin Feature)"}
                    >
                      <Send size={11} />
                      <span>{canBroadcast ? "Broadcast to Telegram" : "Telegram (Pro)"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleShareHolidayEmail(holidayNotice.holiday!)}
                      className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-bold transition-colors cursor-pointer"
                      title="Share Holiday Notice via Email"
                    >
                      <Mail size={11} className="text-amber-500" />
                      <span>Email</span>
                    </button>

                    <a
                      href={getHolidayCalendarLink(holidayNotice.holiday)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-bold transition-colors"
                      title="1-Click Add to Google Calendar"
                    >
                      <CalendarPlus size={11} />
                      <span>Google Cal</span>
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Broadcast Status Toast if any */}
            {holidayTelegramStatus && (
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                <span>{holidayTelegramStatus}</span>
              </div>
            )}

            {/* Key Information Rows */}
            <div className="space-y-1.5 text-xs bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/80">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Date (IST):</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{dateFormatted}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Regular Trading:</span>
                <span className="font-mono font-semibold">09:15 AM - 03:30 PM</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Pre-Open Session:</span>
                <span className="font-mono font-semibold">09:00 AM - 09:15 AM</span>
              </div>
            </div>

            {/* Option Expiry Status */}
            <div className="p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                <span className="flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  Today's Option Expiry:
                </span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-900/80 rounded">
                  {istDate.toLocaleDateString('en-IN', { weekday: 'long' })}
                </span>
              </div>
              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                {optionExpiries.todayExpiriesFormatted}
              </div>
            </div>

            {/* Upcoming Next 3 Holidays List with Action Buttons */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
                <span>Upcoming Trading Holidays</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFullCalendarModal(true);
                    setShowDetails(false);
                  }}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer font-bold"
                >
                  View All <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>

              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {upcomingHolidays.slice(0, 3).map(({ holiday, daysLeft }) => (
                  <div 
                    key={holiday.date} 
                    className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 text-[11px] space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="truncate mr-2">
                        <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                          {holiday.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {holiday.date} ({holiday.day})
                        </div>
                      </div>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0",
                        daysLeft === 0
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                          : daysLeft <= 3
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      )}>
                        {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `in ${daysLeft} days`}
                      </span>
                    </div>

                    {/* Holiday Actions */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-800/60">
                      <span className="text-[10px] text-slate-400 font-medium">Holiday Actions:</span>
                      <div className="flex items-center gap-1">
                        <a
                          href={getHolidayCalendarLink(holiday)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-600 dark:text-blue-400 transition-colors shadow-2xs"
                          title="1-Click Add to Google Calendar"
                        >
                          <CalendarPlus size={12} />
                        </a>

                        <button
                          type="button"
                          onClick={() => handleShareHolidayEmail(holiday)}
                          className="p-1 rounded bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-600 dark:text-amber-400 transition-colors shadow-2xs cursor-pointer"
                          title="Share Holiday Notice via Email"
                        >
                          <Mail size={12} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSendHolidayTelegram(holiday)}
                          disabled={isSendingHolidayTelegram === holiday.date}
                          className={cn(
                            "p-1 rounded transition-colors shadow-2xs cursor-pointer",
                            canBroadcast 
                              ? "bg-blue-600 hover:bg-blue-700 text-white" 
                              : "bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 text-slate-500 hover:text-blue-600"
                          )}
                          title={canBroadcast ? "Broadcast Market Holiday to Telegram Channel" : "Broadcast to Telegram (Pro / Admin)"}
                        >
                          <Send size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer button to open full calendar modal */}
            <button
              type="button"
              onClick={() => {
                setShowFullCalendarModal(true);
                setShowDetails(false);
              }}
              className="w-full py-2 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-500" />
              <span>Exchange Market Holiday Schedule</span>
            </button>
          </div>
        )}
      </div>

      {/* Full Exchange Holiday Calendar Modal */}
      <MarketHolidaysModal
        isOpen={showFullCalendarModal}
        onClose={() => setShowFullCalendarModal(false)}
      />
    </>
  );
}
