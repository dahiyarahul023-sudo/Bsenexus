export interface MarketHoliday {
  date: string; // YYYY-MM-DD
  name: string;
  day: string;
  description?: string;
  isMuhuratTrading?: boolean;
  muhuratTiming?: string;
}

export interface OptionExpiryRule {
  indexName: string;
  exchange: 'BSE' | 'NSE';
  standardDay: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
  dayIndex: number; // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  frequency: 'Weekly' | 'Monthly';
}

// Official NSE & BSE Trading Holidays for 2025, 2026, and 2027
export const INDIAN_MARKET_HOLIDAYS: MarketHoliday[] = [
  // 2025 Holidays
  { date: '2025-01-26', name: 'Republic Day', day: 'Sunday' },
  { date: '2025-02-26', name: 'Mahashivratri', day: 'Wednesday' },
  { date: '2025-03-14', name: 'Holi', day: 'Friday' },
  { date: '2025-03-31', name: 'Id-Ul-Fitr (Ramadan Eid)', day: 'Monday' },
  { date: '2025-04-10', name: 'Shri Mahavir Jayanti', day: 'Thursday' },
  { date: '2025-04-14', name: 'Dr. Baba Saheb Ambedkar Jayanti', day: 'Monday' },
  { date: '2025-04-18', name: 'Good Friday', day: 'Friday' },
  { date: '2025-05-01', name: 'Maharashtra Day', day: 'Thursday' },
  { date: '2025-06-07', name: 'Bakri Id (Eid ul-Adha)', day: 'Saturday' },
  { date: '2025-07-06', name: 'Muharram', day: 'Sunday' },
  { date: '2025-08-15', name: 'Independence Day', day: 'Friday' },
  { date: '2025-08-27', name: 'Ganesh Chaturthi', day: 'Wednesday' },
  { date: '2025-10-02', name: 'Mahatma Gandhi Jayanti', day: 'Thursday' },
  { date: '2025-10-21', name: 'Diwali * Laxmi Pujan (Muhurat Trading)', day: 'Tuesday', isMuhuratTrading: true, muhuratTiming: '06:15 PM - 07:15 PM IST' },
  { date: '2025-10-22', name: 'Diwali Balipratipada', day: 'Wednesday' },
  { date: '2025-11-05', name: 'Guru Nanak Jayanti', day: 'Wednesday' },
  { date: '2025-12-25', name: 'Christmas', day: 'Thursday' },

  // 2026 Holidays
  { date: '2026-01-26', name: 'Republic Day', day: 'Monday' },
  { date: '2026-02-16', name: 'Mahashivratri', day: 'Monday' },
  { date: '2026-03-04', name: 'Holi', day: 'Wednesday' },
  { date: '2026-03-20', name: 'Id-Ul-Fitr (Ramzan Id)', day: 'Friday' },
  { date: '2026-04-03', name: 'Good Friday', day: 'Friday' },
  { date: '2026-04-14', name: 'Dr. B.R. Ambedkar Jayanti', day: 'Tuesday' },
  { date: '2026-04-21', name: 'Shri Ram Navami', day: 'Tuesday' },
  { date: '2026-05-01', name: 'Maharashtra Day / Labour Day', day: 'Friday' },
  { date: '2026-05-27', name: 'Bakri Id (Eid ul-Adha)', day: 'Wednesday' },
  { date: '2026-06-25', name: 'Muharram', day: 'Thursday' },
  { date: '2026-08-15', name: 'Independence Day', day: 'Saturday' },
  { date: '2026-09-14', name: 'Ganesh Chaturthi', day: 'Monday' },
  { date: '2026-10-02', name: 'Mahatma Gandhi Jayanti', day: 'Friday' },
  { date: '2026-10-20', name: 'Dussehra (Vijaya Dashami)', day: 'Tuesday' },
  { date: '2026-11-08', name: 'Diwali * Laxmi Pujan (Muhurat Trading)', day: 'Sunday', isMuhuratTrading: true, muhuratTiming: '06:15 PM - 07:15 PM IST' },
  { date: '2026-11-10', name: 'Diwali Balipratipada', day: 'Tuesday' },
  { date: '2026-11-24', name: 'Guru Nanak Jayanti', day: 'Tuesday' },
  { date: '2026-12-25', name: 'Christmas', day: 'Friday' },

  // 2027 Holidays (Projected Standard Exchange Calendar)
  { date: '2027-01-26', name: 'Republic Day', day: 'Tuesday' },
  { date: '2027-03-08', name: 'Mahashivratri', day: 'Monday' },
  { date: '2027-03-23', name: 'Holi', day: 'Tuesday' },
  { date: '2027-03-26', name: 'Good Friday', day: 'Friday' },
  { date: '2027-04-14', name: 'Dr. B.R. Ambedkar Jayanti', day: 'Wednesday' },
  { date: '2027-05-01', name: 'Maharashtra Day', day: 'Saturday' },
  { date: '2027-08-15', name: 'Independence Day', day: 'Sunday' },
  { date: '2027-10-02', name: 'Mahatma Gandhi Jayanti', day: 'Saturday' },
  { date: '2027-10-28', name: 'Diwali * Laxmi Pujan (Muhurat Trading)', day: 'Thursday', isMuhuratTrading: true, muhuratTiming: '06:15 PM - 07:15 PM IST' },
  { date: '2027-10-30', name: 'Diwali Balipratipada', day: 'Saturday' },
  { date: '2027-11-14', name: 'Guru Nanak Jayanti', day: 'Sunday' },
  { date: '2027-12-25', name: 'Christmas', day: 'Saturday' }
];

export const OPTION_EXPIRY_RULES: OptionExpiryRule[] = [
  { indexName: 'MIDCPNIFTY', exchange: 'NSE', standardDay: 'Monday', dayIndex: 1, frequency: 'Weekly' },
  { indexName: 'FINNIFTY', exchange: 'NSE', standardDay: 'Tuesday', dayIndex: 2, frequency: 'Weekly' },
  { indexName: 'BANKNIFTY', exchange: 'NSE', standardDay: 'Wednesday', dayIndex: 3, frequency: 'Weekly' },
  { indexName: 'NIFTY 50', exchange: 'NSE', standardDay: 'Thursday', dayIndex: 4, frequency: 'Weekly' },
  { indexName: 'BSE SENSEX', exchange: 'BSE', standardDay: 'Friday', dayIndex: 5, frequency: 'Weekly' },
  { indexName: 'BSE BANKEX', exchange: 'BSE', standardDay: 'Monday', dayIndex: 1, frequency: 'Weekly' },
];

export function isDateMarketHoliday(dateStr: string): MarketHoliday | undefined {
  return INDIAN_MARKET_HOLIDAYS.find(h => h.date === dateStr);
}

export function getUpcomingMarketHolidays(fromDate: Date, daysAhead: number = 30): { holiday: MarketHoliday; daysLeft: number }[] {
  const result: { holiday: MarketHoliday; daysLeft: number }[] = [];
  const currentTs = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()).getTime();

  for (const h of INDIAN_MARKET_HOLIDAYS) {
    const [y, m, d] = h.date.split('-').map(Number);
    const hTs = new Date(y, m - 1, d).getTime();
    const diffDays = Math.round((hTs - currentTs) / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays <= daysAhead) {
      result.push({ holiday: h, daysLeft: diffDays });
    }
  }

  return result.sort((a, b) => a.daysLeft - b.daysLeft);
}

export function getAdvanceHolidayNotice(fromDate: Date): { 
  hasNotice: boolean; 
  daysLeft: number; 
  holiday: MarketHoliday | null;
  message: string;
} {
  const upcoming = getUpcomingMarketHolidays(fromDate, 4);
  if (upcoming.length === 0) {
    return { hasNotice: false, daysLeft: -1, holiday: null, message: '' };
  }

  const next = upcoming[0];
  if (next.daysLeft === 0) {
    return {
      hasNotice: true,
      daysLeft: 0,
      holiday: next.holiday,
      message: next.holiday.isMuhuratTrading 
        ? `Diwali Muhurat Trading Today (${next.holiday.muhuratTiming || 'Evening Special Session'})` 
        : `Market Holiday Today: ${next.holiday.name}`
    };
  } else if (next.daysLeft === 1) {
    return {
      hasNotice: true,
      daysLeft: 1,
      holiday: next.holiday,
      message: `Market Holiday Tomorrow: ${next.holiday.name}`
    };
  } else if (next.daysLeft <= 3) {
    return {
      hasNotice: true,
      daysLeft: next.daysLeft,
      holiday: next.holiday,
      message: `Upcoming Holiday in ${next.daysLeft} days: ${next.holiday.name} (${next.holiday.day})`
    };
  }

  return { hasNotice: false, daysLeft: next.daysLeft, holiday: next.holiday, message: '' };
}

// Calculate active expiry for today with holiday shift awareness
export function getActiveOptionExpiriesForDate(date: Date): {
  expiries: { indexName: string; exchange: string; isShifted: boolean; originalDay: string }[];
  todayExpiriesFormatted: string;
} {
  const dayIndex = date.getDay(); // 0 = Sun, 1 = Mon ... 5 = Fri, 6 = Sat
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  
  // If today is a weekend or closed holiday, no standard trading session
  const todayHoliday = isDateMarketHoliday(dateStr);
  if (dayIndex === 0 || dayIndex === 6 || (todayHoliday && !todayHoliday.isMuhuratTrading)) {
    return { expiries: [], todayExpiriesFormatted: 'None (Market Closed)' };
  }

  const expiries: { indexName: string; exchange: string; isShifted: boolean; originalDay: string }[] = [];

  // Check which indexes expire today
  for (const rule of OPTION_EXPIRY_RULES) {
    // Standard expiry day match
    if (rule.dayIndex === dayIndex) {
      expiries.push({
        indexName: rule.indexName,
        exchange: rule.exchange,
        isShifted: false,
        originalDay: rule.standardDay
      });
    } else if (rule.dayIndex === dayIndex + 1) {
      // Check if tomorrow is a holiday; if so, tomorrow's expiry shifted to TODAY
      const tomorrow = new Date(date.getTime() + 24 * 60 * 60 * 1000);
      const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
      if (isDateMarketHoliday(tomorrowStr)) {
        expiries.push({
          indexName: rule.indexName,
          exchange: rule.exchange,
          isShifted: true,
          originalDay: rule.standardDay
        });
      }
    }
  }

  const formatted = expiries.length > 0
    ? expiries.map(e => `${e.indexName}${e.isShifted ? ' (Preponed)' : ''}`).join(', ')
    : 'No major weekly expiry today';

  return { expiries, todayExpiriesFormatted: formatted };
}

export function checkIfDateIsTradingHoliday(dateInput: string | number | Date): {
  isHoliday: boolean;
  isWeekend: boolean;
  isClosed: boolean;
  holidayName?: string;
  weekendName?: string;
} {
  let dt: Date;
  if (typeof dateInput === 'string') {
    // Check if DD-Mon-YYYY or YYYY-MM-DD
    const clean = dateInput.trim();
    const dMonYMatch = clean.match(/^(\d{1,2})[- ]([A-Za-z]{3,9})[- ](\d{2,4})/);
    if (dMonYMatch) {
      const day = parseInt(dMonYMatch[1], 10);
      const monStr = dMonYMatch[2].toLowerCase().substring(0, 3);
      const monthNames: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
      };
      const month = monthNames[monStr] !== undefined ? monthNames[monStr] : 0;
      let year = parseInt(dMonYMatch[3], 10);
      if (year < 100) year += 2000;
      dt = new Date(year, month, day);
    } else {
      dt = new Date(clean);
    }
  } else {
    dt = new Date(dateInput);
  }

  if (isNaN(dt.getTime())) {
    return { isHoliday: false, isWeekend: false, isClosed: false };
  }

  const dayOfWeek = dt.getDay(); // 0 = Sun, 6 = Sat
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const weekendName = dayOfWeek === 0 ? 'Sunday' : dayOfWeek === 6 ? 'Saturday' : undefined;

  const yStr = dt.getFullYear();
  const mStr = String(dt.getMonth() + 1).padStart(2, '0');
  const dStr = String(dt.getDate()).padStart(2, '0');
  const isoDate = `${yStr}-${mStr}-${dStr}`;

  const holiday = isDateMarketHoliday(isoDate);
  const isHoliday = !!holiday && !holiday.isMuhuratTrading;

  return {
    isHoliday,
    isWeekend,
    isClosed: isWeekend || isHoliday,
    holidayName: holiday?.name,
    weekendName
  };
}

export function generateGoogleCalendarUrl(params: {
  title: string;
  description: string;
  dateStr: string; // e.g. "14-Aug-2026" or "2026-08-14"
  location?: string;
}): string {
  let targetDate = new Date();
  const clean = params.dateStr.trim();
  const dMonYMatch = clean.match(/^(\d{1,2})[- ]([A-Za-z]{3,9})[- ](\d{2,4})/);
  if (dMonYMatch) {
    const day = parseInt(dMonYMatch[1], 10);
    const monStr = dMonYMatch[2].toLowerCase().substring(0, 3);
    const monthNames: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    const month = monthNames[monStr] !== undefined ? monthNames[monStr] : 0;
    let year = parseInt(dMonYMatch[3], 10);
    if (year < 100) year += 2000;
    targetDate = new Date(Date.UTC(year, month, day, 4, 30, 0)); // 10:00 AM IST = 04:30 UTC
  } else {
    const parsed = new Date(params.dateStr);
    if (!isNaN(parsed.getTime())) targetDate = parsed;
  }

  const y = targetDate.getUTCFullYear();
  const m = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getUTCDate()).padStart(2, '0');
  
  // 10:00 AM IST to 04:00 PM IST
  const startIso = `${y}${m}${d}T043000Z`;
  const endIso = `${y}${m}${d}T103000Z`;

  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: params.title,
    details: params.description,
    location: params.location || 'BSE India / Corporate Headquarters',
    dates: `${startIso}/${endIso}`
  });

  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export function downloadIcsCalendarFile(params: {
  title: string;
  description: string;
  dateStr: string;
  location?: string;
  filename?: string;
}) {
  let targetDate = new Date();
  const clean = params.dateStr.trim();
  const dMonYMatch = clean.match(/^(\d{1,2})[- ]([A-Za-z]{3,9})[- ](\d{2,4})/);
  if (dMonYMatch) {
    const day = parseInt(dMonYMatch[1], 10);
    const monStr = dMonYMatch[2].toLowerCase().substring(0, 3);
    const monthNames: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    const month = monthNames[monStr] !== undefined ? monthNames[monStr] : 0;
    let year = parseInt(dMonYMatch[3], 10);
    if (year < 100) year += 2000;
    targetDate = new Date(Date.UTC(year, month, day, 4, 30, 0));
  } else {
    const parsed = new Date(params.dateStr);
    if (!isNaN(parsed.getTime())) targetDate = parsed;
  }

  const y = targetDate.getUTCFullYear();
  const m = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getUTCDate()).padStart(2, '0');
  const startIso = `${y}${m}${d}T043000Z`;
  const endIso = `${y}${m}${d}T103000Z`;

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BSE Nexus//Results Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `SUMMARY:${params.title.replace(/[,;]/g, ' ')}`,
    `DESCRIPTION:${params.description.replace(/\n/g, '\\n')}`,
    `LOCATION:${(params.location || 'BSE India').replace(/[,;]/g, ' ')}`,
    `DTSTART:${startIso}`,
    `DTEND:${endIso}`,
    `STATUS:CONFIRMED`,
    'BEGIN:VALARM',
    'TRIGGER:-PT60M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder: BSE Board Meeting / Results Outcome Scheduled Today',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = params.filename || `${params.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadMultiIcsCalendarFile(events: Array<{
  title: string;
  description: string;
  dateStr: string;
  location?: string;
}>, filename?: string) {
  if (!events || events.length === 0) return;

  const vEvents: string[] = [];

  for (const item of events) {
    let targetDate = new Date();
    const clean = item.dateStr.trim();
    const dMonYMatch = clean.match(/^(\d{1,2})[- ]([A-Za-z]{3,9})[- ](\d{2,4})/);
    if (dMonYMatch) {
      const day = parseInt(dMonYMatch[1], 10);
      const monStr = dMonYMatch[2].toLowerCase().substring(0, 3);
      const monthNames: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
      };
      const month = monthNames[monStr] !== undefined ? monthNames[monStr] : 0;
      let year = parseInt(dMonYMatch[3], 10);
      if (year < 100) year += 2000;
      targetDate = new Date(Date.UTC(year, month, day, 4, 30, 0));
    } else {
      const parsed = new Date(item.dateStr);
      if (!isNaN(parsed.getTime())) targetDate = parsed;
    }

    const y = targetDate.getUTCFullYear();
    const m = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(targetDate.getUTCDate()).padStart(2, '0');
    const startIso = `${y}${m}${d}T043000Z`;
    const endIso = `${y}${m}${d}T103000Z`;

    vEvents.push([
      'BEGIN:VEVENT',
      `SUMMARY:${item.title.replace(/[,;]/g, ' ')}`,
      `DESCRIPTION:${item.description.replace(/\n/g, '\\n')}`,
      `LOCATION:${(item.location || 'BSE India').replace(/[,;]/g, ' ')}`,
      `DTSTART:${startIso}`,
      `DTEND:${endIso}`,
      `STATUS:CONFIRMED`,
      'BEGIN:VALARM',
      'TRIGGER:-PT60M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Reminder: BSE Board Meeting Scheduled Today',
      'END:VALARM',
      'END:VEVENT'
    ].join('\r\n'));
  }

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BSE Nexus//Results Calendar Multi-Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...vEvents,
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `BSE_Board_Meetings_${new Date().toISOString().split('T')[0]}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

