import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarDays,
  CalendarPlus,
  Mail,
  Send,
  X,
  Flame,
  Calendar,
  Sparkles,
  Download,
  Share2,
  Check
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  INDIAN_MARKET_HOLIDAYS,
  MarketHoliday,
  generateGoogleCalendarUrl,
  downloadIcsCalendarFile,
  downloadMultiIcsCalendarFile
} from '../../utils/marketHolidays';
import { useAuth } from '../../context/AuthContext';
import { ActionButton } from './ActionButton';
import { customFetch } from '../../api';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MarketHolidaysModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MarketHolidaysModal: React.FC<MarketHolidaysModalProps> = ({ isOpen, onClose }) => {
  const { user, profile, isAdmin, isPro, adminUnlocked, setIsAuthModalOpen, setIsProModalOpen } = useAuth();
  const isProOrAdmin = isAdmin || isPro || adminUnlocked || profile?.tier === 'pro' || profile?.tier === 'admin';

  useBodyScrollLock(isOpen);

  const [calendarYearFilter, setCalendarYearFilter] = useState<string>('2026');
  const [isSendingHolidayTelegram, setIsSendingHolidayTelegram] = useState<string | null>(null);
  const [holidayTelegramStatus, setHolidayTelegramStatus] = useState<string | null>(null);
  const [copiedHolidayDate, setCopiedHolidayDate] = useState<string | null>(null);

  if (!isOpen) return null;

  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffset);

  const getHolidayCalendarLink = (holiday: MarketHoliday) => {
    return generateGoogleCalendarUrl({
      title: `BSE/NSE Holiday: ${holiday.name} (Market Closed)`,
      description: `Indian Stock Exchanges (BSE & NSE) are CLOSED for ${holiday.name}.\nDate: ${holiday.date} (${holiday.day})\n${holiday.isMuhuratTrading ? `Special Muhurat Trading: ${holiday.muhuratTiming || 'Evening'}\n` : 'Segments Closed: Capital Market (Equities), Derivatives (F&O), Currency.\n'}Note: F&O weekly/monthly contracts expire on preceding trading day.`,
      dateStr: holiday.date
    });
  };

  const handleShareHolidayEmail = (holiday: MarketHoliday) => {
    const calendarLink = getHolidayCalendarLink(holiday);
    const subject = encodeURIComponent(`Market Holiday Notification: ${holiday.name} (${holiday.date}) - BSE & NSE Closed`);
    const body = encodeURIComponent(
      `Hello Trader,\n\nPlease be informed that Indian Stock Exchanges (BSE & NSE) will remain closed on ${holiday.date} (${holiday.day}) on account of ${holiday.name}.\n` +
      `${holiday.isMuhuratTrading ? `Special Muhurat Trading Session: ${holiday.muhuratTiming}\n` : ''}` +
      `\n- Equity, Equity Derivatives, and Currency segments will remain closed.\n` +
      `- Standard F&O contract expiries are adjusted to the previous trading day.\n\n` +
      `Add to Google Calendar:\n${calendarLink}\n\n` +
      `Stay ahead with BSE Live Radar!`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
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

  const handleSendHolidayTelegram = async (holiday: MarketHoliday) => {
    if (!isProOrAdmin) {
      if (!user && !profile) {
        setIsAuthModalOpen(true);
      } else {
        setIsProModalOpen(true);
      }
      alert('🔒 Market Holiday Telegram Broadcast is a Pro & Admin feature.\n\nUpgrade to Pro to broadcast official exchange circulars and trading schedules to your Telegram channel!');
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
      } else {
        setHolidayTelegramStatus(data.error || 'Failed to dispatch Telegram broadcast.');
      }
    } catch {
      setHolidayTelegramStatus('Failed to connect to Telegram service.');
    } finally {
      setIsSendingHolidayTelegram(null);
      setTimeout(() => setHolidayTelegramStatus(null), 5000);
    }
  };

  const handleDownloadYearIcs = (year: string) => {
    const yearHolidays = INDIAN_MARKET_HOLIDAYS
      .filter(h => h.date.startsWith(year))
      .map(h => ({
        title: `BSE/NSE Holiday: ${h.name}`,
        description: `Indian Stock Markets (BSE/NSE) closed on account of ${h.name}.${h.isMuhuratTrading ? ` Muhurat Trading: ${h.muhuratTiming}` : ''}`,
        dateStr: h.date,
        location: 'BSE & NSE India'
      }));

    downloadMultiIcsCalendarFile(yearHolidays, `Indian_Market_Holidays_${year}.ics`);
  };

  return typeof document !== 'undefined' ? createPortal(
    <div 
      className="fixed inset-0 z-[99999] overflow-y-auto bg-black/75 backdrop-blur-sm p-3 sm:p-6 flex items-center justify-center animate-in fade-in duration-150 overscroll-contain"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto animate-in zoom-in-95 duration-150 relative text-slate-800 dark:text-slate-200 overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                BSE &amp; NSE Market Trading Holidays
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Official exchange circulars, Muhurat Trading, and F&amp;O expiry adjustments
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Year Filters & Quick Actions */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-white dark:bg-[#0F172A] shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Select Year:
              </span>
              <div className="flex gap-1.5">
                {['2025', '2026', '2027'].map((year) => (
                  <button
                    key={year}
                    onClick={() => setCalendarYearFilter(year)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs transition-all cursor-pointer active:scale-95 font-bold",
                      calendarYearFilter === year
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    )}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleDownloadYearIcs(calendarYearFilter)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs self-start sm:self-auto"
            >
              <Download size={13} className="text-emerald-500" />
              <span>Export {calendarYearFilter} .ICS Calendar</span>
            </button>
          </div>

          {/* Broadcast notification banner */}
          {holidayTelegramStatus && (
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold animate-in fade-in">
              {holidayTelegramStatus}
            </div>
          )}

          {/* F&O Expiry Rules Quick Guide Banner */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1.5">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-500" />
              <span>Standard Weekly F&amp;O Expiry Schedule:</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
              <div className="p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Monday:</span> MIDCPNIFTY / BANKEX
              </div>
              <div className="p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Tuesday:</span> FINNIFTY
              </div>
              <div className="p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Wednesday:</span> BANKNIFTY
              </div>
              <div className="p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Thursday:</span> NIFTY 50 (NSE)
              </div>
              <div className="p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Friday:</span> BSE SENSEX
              </div>
              <div className="p-1.5 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 text-amber-800 dark:text-amber-300">
                <span className="font-bold">Holiday Adjustment:</span> Shifts to previous trading day
              </div>
            </div>
          </div>
        </div>

        {/* Holidays List Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2 overscroll-contain">
          {INDIAN_MARKET_HOLIDAYS
            .filter(h => h.date.startsWith(calendarYearFilter))
            .map((holiday) => {
              const [y, m, d] = holiday.date.split('-').map(Number);
              const hTs = new Date(y, m - 1, d).getTime();
              const currentTs = new Date(istDate.getFullYear(), istDate.getMonth(), istDate.getDate()).getTime();
              const diffDays = Math.round((hTs - currentTs) / (1000 * 60 * 60 * 24));
              const isPast = diffDays < 0;
              const isToday = diffDays === 0;

              return (
                <div
                  key={holiday.date}
                  className={cn(
                    "p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all",
                    isToday
                      ? "bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30"
                      : isPast
                      ? "bg-slate-50/50 dark:bg-slate-900/30 border-slate-200/60 dark:border-slate-800/60 opacity-70"
                      : "bg-white dark:bg-slate-800/70 border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                        <span>{holiday.name}</span>
                        {holiday.isMuhuratTrading && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
                            Muhurat Session: {holiday.muhuratTiming}
                          </span>
                        )}
                        {isToday && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            Today
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        {holiday.date} &bull; {holiday.day}
                        {!isPast && diffDays > 0 && (
                          <span className="ml-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                            (in {diffDays} {diffDays === 1 ? 'day' : 'days'})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleDownloadHolidayIcs(holiday)}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer"
                      title="Download .ICS Calendar Event"
                    >
                      <Download size={13} />
                    </button>

                    <a
                      href={getHolidayCalendarLink(holiday)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-600 dark:text-emerald-400 transition-colors shadow-2xs"
                      title="Add to Google Calendar"
                    >
                      <CalendarPlus size={13} />
                    </a>

                    <button
                      type="button"
                      onClick={() => handleShareHolidayEmail(holiday)}
                      className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-600 dark:text-amber-400 transition-colors shadow-2xs cursor-pointer"
                      title="Share Holiday Notice via Email"
                    >
                      <Mail size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyHolidayCalendar(holiday)}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors shadow-2xs cursor-pointer"
                      title="Copy Google Calendar Direct URL"
                    >
                      {copiedHolidayDate === holiday.date ? (
                        <Check size={13} className="text-emerald-500" />
                      ) : (
                        <Share2 size={13} />
                      )}
                    </button>

                    <ActionButton
                      onClick={() => handleSendHolidayTelegram(holiday)}
                      isLoading={isSendingHolidayTelegram === holiday.date}
                      loadingText=""
                      variant={isProOrAdmin ? "primary" : "secondary"}
                      size="sm"
                      className={cn(
                        "p-1.5 min-h-[30px] min-w-[30px] rounded-lg",
                        isProOrAdmin ? "bg-blue-600 hover:bg-blue-700 text-white" : ""
                      )}
                      icon={<Send size={13} />}
                      title={isProOrAdmin ? "Broadcast Market Holiday to Telegram Channel" : "Broadcast to Telegram (Pro / Admin)"}
                    />
                  </div>
                </div>
              );
            })}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 dark:bg-slate-200 hover:bg-slate-900 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold transition-colors cursor-pointer active:scale-95"
          >
            Close Calendar
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
};
