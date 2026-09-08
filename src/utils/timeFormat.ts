import { format } from 'date-fns';

function parseDateInput(input: string | number | Date | undefined | null): Date | null {
  if (!input && input !== 0) return null;
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }
  if (typeof input === 'number') {
    if (isNaN(input) || input <= 0) return null;
    // Handle seconds vs milliseconds
    const ts = input < 10000000000 ? input * 1000 : input;
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }
  const str = String(input).trim();
  if (!str) return null;

  // 1. /Date(123456789)/ format commonly returned by .NET / legacy BSE APIs
  const msMatch = str.match(/\/Date\((\d+)\)\//);
  if (msMatch) return new Date(parseInt(msMatch[1], 10));

  // 2. Standard ISO with Z or explicit timezone offset (e.g. 2026-08-16T08:30:00.000Z or +05:30)
  if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(str)) {
    const ts = Date.parse(str.replace(' ', 'T'));
    if (!isNaN(ts)) return new Date(ts);
  }

  // 3. YYYY-MM-DDTHH:mm:ss or YYYY-MM-DD HH:mm:ss without timezone offset (Assume native BSE IST +05:30)
  const isoLocalMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (isoLocalMatch) {
    const [, y, m, d, hh, mm, ss, ms] = isoLocalMatch;
    const isoString = `${y}-${m}-${d}T${hh}:${mm}:${ss}${ms ? '.' + ms.padEnd(3, '0').slice(0, 3) : ''}+05:30`;
    const ts = Date.parse(isoString);
    if (!isNaN(ts)) return new Date(ts);
  }

  // 4. Date only: YYYY-MM-DD
  const dateOnlyMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch;
    const isoString = `${y}-${m}-${d}T00:00:00+05:30`;
    const ts = Date.parse(isoString);
    if (!isNaN(ts)) return new Date(ts);
  }

  // 5. DD/MM/YYYY HH:mm:ss or DD-MM-YYYY HH:mm:ss or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?$/i);
  if (dmyMatch) {
    const [, d, m, y, hhStr, mmStr = '00', ssStr = '00', ampm] = dmyMatch;
    let hh = hhStr !== undefined ? parseInt(hhStr, 10) : 0;
    const mm = parseInt(mmStr, 10);
    const ss = parseInt(ssStr, 10);
    if (ampm) {
      if (ampm.toUpperCase() === 'PM' && hh < 12) hh += 12;
      if (ampm.toUpperCase() === 'AM' && hh === 12) hh = 0;
    }
    const pad = (n: number | string) => String(n).padStart(2, '0');
    const isoString = `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:${pad(ss)}+05:30`;
    const ts = Date.parse(isoString);
    if (!isNaN(ts)) return new Date(ts);
  }

  // 6. Text Month names: "13 Aug 2026 08:12:48 PM" or "13-Aug-2026 20:12:48" or "13 Aug 2026"
  const textMonthMatch = str.match(/^(\d{1,2})[\s\-]+([A-Za-z]{3,9})[\s\-]+(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?/i);
  if (textMonthMatch) {
    const [, d, monthName, y, hhStr, mmStr = '00', ssStr = '00', ampm] = textMonthMatch;
    const monthNames = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
    const mIdx = monthNames.indexOf(monthName.toLowerCase().slice(0, 3));
    if (mIdx >= 0) {
      let hh = hhStr !== undefined ? parseInt(hhStr, 10) : 0;
      const mm = parseInt(mmStr, 10);
      const ss = parseInt(ssStr, 10);
      if (ampm) {
        if (ampm.toUpperCase() === 'PM' && hh < 12) hh += 12;
        if (ampm.toUpperCase() === 'AM' && hh === 12) hh = 0;
      }
      const pad = (n: number | string) => String(n).padStart(2, '0');
      const isoString = `${y}-${pad(mIdx + 1)}-${pad(d)}T${pad(hh)}:${pad(mm)}:${pad(ss)}+05:30`;
      const ts = Date.parse(isoString);
      if (!isNaN(ts)) return new Date(ts);
    }
  }

  // 7. Standard timestamp in string form (e.g. "1755172800000")
  if (/^\d{10,13}$/.test(str)) {
    const num = parseInt(str, 10);
    const ts = str.length === 10 ? num * 1000 : num;
    const d = new Date(ts);
    if (!isNaN(d.getTime())) return d;
  }

  const fallback = Date.parse(str);
  return !isNaN(fallback) ? new Date(fallback) : null;
}

function formatInIST(
  date: Date, 
  options: { includeDate?: boolean; shortDate?: boolean; includeTime?: boolean; includeSeconds?: boolean }
): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: options.includeDate && !options.shortDate ? 'numeric' : undefined,
      month: options.includeDate ? 'short' : undefined,
      day: options.includeDate ? '2-digit' : undefined,
      hour: options.includeTime ? '2-digit' : undefined,
      minute: options.includeTime ? '2-digit' : undefined,
      second: options.includeTime && options.includeSeconds ? '2-digit' : undefined,
      hour12: true
    }).formatToParts(date);

    const get = (type: string) => parts.find(p => p.type === type)?.value || '';

    let result = '';
    if (options.includeDate) {
      const day = get('day');
      const month = get('month');
      const year = get('year');
      result += options.shortDate ? `${day} ${month}` : `${day} ${month} ${year}`;
    }

    if (options.includeTime) {
      const hour = get('hour');
      const minute = get('minute');
      const second = get('second');
      const dayPeriod = get('dayPeriod').toUpperCase();

      const timeStr = options.includeSeconds 
        ? `${hour}:${minute}:${second} ${dayPeriod}`
        : `${hour}:${minute} ${dayPeriod}`;

      result = result ? `${result}, ${timeStr} IST` : `${timeStr} IST`;
    }

    return result || date.toLocaleString();
  } catch (e) {
    return date.toLocaleString();
  }
}

function hasExplicitTime(input: string | number | Date | undefined | null): boolean {
  if (!input && input !== 0) return false;
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return false;
    const istHours = (input.getUTCHours() + 5 + Math.floor((input.getUTCMinutes() + 30) / 60)) % 24;
    const istMinutes = (input.getUTCMinutes() + 30) % 60;
    const istSeconds = input.getUTCSeconds();
    if (istHours === 0 && istMinutes === 0 && istSeconds === 0) return false;
    if (input.getUTCHours() === 0 && input.getUTCMinutes() === 0 && input.getUTCSeconds() === 0) return false;
    return true;
  }
  if (typeof input === 'number') {
    if (isNaN(input) || input <= 0) return false;
    const ts = input < 10000000000 ? input * 1000 : input;
    const d = new Date(ts);
    if (isNaN(d.getTime())) return false;
    // Calculate IST time
    const istHours = (d.getUTCHours() + 5 + Math.floor((d.getUTCMinutes() + 30) / 60)) % 24;
    const istMinutes = (d.getUTCMinutes() + 30) % 60;
    const istSeconds = d.getUTCSeconds();
    // If exact midnight in IST or UTC (00:00:00), it's a date-only timestamp marker
    if (istHours === 0 && istMinutes === 0 && istSeconds === 0) {
      return false;
    }
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
      return false;
    }
    return true;
  }

  const str = String(input).trim();
  if (!str) return false;

  // Ignore dummy 12:00:00 AM or 00:00:00
  if (/12:00(?::00)?\s*AM/i.test(str) || /[T\s]00:00(?::00)?(?:\.0+)?(?:Z|[+-]\d{2}:?\d{2})?$/i.test(str)) {
    return false;
  }

  // Check if string contains explicit non-zero time (HH:mm)
  if (/[T\s]\d{1,2}:\d{2}/i.test(str) || /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)\b/i.test(str)) {
    return true;
  }

  return false;
}

/**
 * Format timestamp or date string to full readable date and time with seconds in IST.
 * If input has no time component, outputs date only cleanly.
 */
export function formatFullDateTime(input: string | number | undefined | null): string {
  if (!input) return 'N/A';
  const dateObj = parseDateInput(input);
  if (!dateObj) return String(input);

  const hasTime = hasExplicitTime(input);
  return formatInIST(dateObj, { 
    includeDate: true, 
    shortDate: false, 
    includeTime: hasTime, 
    includeSeconds: hasTime 
  });
}

/**
 * Format short date and time in IST (e.g. 12 Aug, 04:15:22 PM IST)
 */
export function formatShortDateTime(input: string | number | undefined | null): string {
  if (!input) return 'N/A';
  const dateObj = parseDateInput(input);
  if (!dateObj) return String(input);

  const hasTime = hasExplicitTime(input);
  return formatInIST(dateObj, { 
    includeDate: true, 
    shortDate: true, 
    includeTime: hasTime, 
    includeSeconds: hasTime 
  });
}

/**
 * Format date only in IST (e.g. 12 Aug 2026)
 */
export function formatDateOnly(input: string | number | undefined | null): string {
  if (!input) return 'N/A';
  const dateObj = parseDateInput(input);
  if (!dateObj) return String(input);
  return formatInIST(dateObj, { includeDate: true, shortDate: false, includeTime: false });
}

/**
 * Format time only in IST (e.g. 04:15:22 PM IST).
 * If input has no time component, returns empty string to prevent dummy 12:00 AM display.
 */
export function formatTimeOnly(input: string | number | undefined | null): string {
  if (!input) return '';
  if (!hasExplicitTime(input)) return '';
  const dateObj = parseDateInput(input);
  if (!dateObj) return '';
  return formatInIST(dateObj, { includeTime: true, includeSeconds: true });
}

/**
 * Format concise trading time without seconds (e.g. 3:10 PM or 03:10 PM).
 */
export function formatCleanTime(input: string | number | Date | undefined | null): string {
  if (!input) return '';
  if (!hasExplicitTime(input)) return '';
  const dateObj = parseDateInput(input);
  if (!dateObj) return '';
  
  try {
    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    return formatter.format(dateObj).toUpperCase();
  } catch {
    return formatInIST(dateObj, { includeTime: true, includeSeconds: false });
  }
}

/**
 * Format concise trading date & time without seconds (e.g. 21 Aug · 3:10 PM).
 */
export function formatCleanDateTime(input: string | number | undefined | null): string {
  if (!input) return 'N/A';
  const dateObj = parseDateInput(input);
  if (!dateObj) return String(input);

  const hasTime = hasExplicitTime(input);
  if (!hasTime) {
    return formatDateOnly(input);
  }

  try {
    const dateFormatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short'
    });
    const timeFormatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    return `${dateFormatter.format(dateObj)} · ${timeFormatter.format(dateObj).toUpperCase()}`;
  } catch {
    return formatShortDateTime(input);
  }
}

/**
 * Format relative trading time for fast scanning:
 * - < 60 min ago: "14m ago" or "< 1m ago"
 * - Today: "3:13 PM"
 * - Yesterday: "Yesterday 3:13 PM"
 * - Older: "21 Aug" (or "21 Aug · 3:13 PM")
 */
export function formatFilingRelativeTime(input: string | number | undefined | null): string {
  if (!input) return 'N/A';
  const dateObj = parseDateInput(input);
  if (!dateObj) return String(input);

  const now = Date.now();
  const targetTs = dateObj.getTime();
  const diffMs = now - targetTs;

  // If in future by more than 2 minutes (e.g. clock skew), format standard IST
  if (diffMs < -120000) {
    return formatCleanDateTime(input);
  }

  // If within last 60 minutes
  if (diffMs >= 0 && diffMs < 60 * 60 * 1000) {
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    return `${mins}m ago`;
  }

  // Get IST date representation for today, yesterday, and target
  try {
    const getIstYMD = (d: Date) => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
      }).formatToParts(d);
      const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
      return { y: get('year'), m: get('month'), d: get('day') };
    };

    const targetYMD = getIstYMD(dateObj);
    const nowYMD = getIstYMD(new Date(now));
    const yesterdayDate = new Date(now - 86400000);
    const yesterdayYMD = getIstYMD(yesterdayDate);

    const timeStr = formatCleanTime(dateObj);

    // Is Today in IST
    if (targetYMD.y === nowYMD.y && targetYMD.m === nowYMD.m && targetYMD.d === nowYMD.d) {
      return timeStr || 'Today';
    }

    // Is Yesterday in IST
    if (targetYMD.y === yesterdayYMD.y && targetYMD.m === yesterdayYMD.m && targetYMD.d === yesterdayYMD.d) {
      return timeStr ? `Yesterday ${timeStr}` : 'Yesterday';
    }

    // Older date
    const dateFormatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short'
    });
    const dateStr = dateFormatter.format(dateObj);
    return timeStr ? `${dateStr} · ${timeStr}` : dateStr;
  } catch {
    return formatCleanDateTime(input);
  }
}



