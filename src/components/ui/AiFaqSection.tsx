import React, { useEffect, useRef, useState } from 'react';
import { HelpCircle, ChevronDown, Sparkles, Send, Loader2, LogIn } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * Public AI FAQ section (pricing page, limited v1).
 *
 * Static FAQs stay as crawlable HTML (SEO/AEO). The "ask the AI" box posts
 * to POST /api/faq/ask — bank-first (zero AI cost), AI fallback behind a
 * SERVER-SIDE daily quota (4/day per anonymous IP-hash / per account).
 * The client-side counter is display-only; the server enforces the limit.
 */

interface ThreadMsg {
  role: 'user' | 'ai' | 'notice';
  text: string;
  source?: 'bank' | 'ai';
}

const STATIC_FAQS = [
  {
    q: "Is the 7-day trial really free? What's the catch?",
    a: 'Yes — 7 days, no card required, full Pro access. When it ends you move to the Free tier automatically. Nothing is ever charged.',
  },
  {
    q: 'Will I be charged automatically?',
    a: 'No. Every plan is a one-time payment for its duration. There is no subscription and no auto-renewal.',
  },
  {
    q: 'What happens when my Pro plan expires?',
    a: 'Your Pro badge and paid features switch off automatically on expiry — no action needed. Your watchlists and settings stay saved for when you return.',
  },
];

const SUGGESTIONS = [
  'How much does Pro cost?',
  'How do I track Reliance results?',
  'What are Telegram alerts?',
];

export function AiFaqSection({ onLoginRequest }: { onLoginRequest?: () => void }) {
  const [openItems, setOpenItems] = useState<Record<number, boolean>>({ 0: true });
  const [input, setInput] = useState('');
  const [thread, setThread] = useState<ThreadMsg[]>([]);
  const [sending, setSending] = useState(false);
  const [quota, setQuota] = useState<{ remaining: number; daily: number } | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Display-only counter; the server enforces the real limit.
    fetch('/api/faq/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.success) setQuota({ remaining: d.remaining, daily: d.dailyLimit });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [thread, sending]);

  const ask = async (preset?: string) => {
    const question = (preset ?? input).trim();
    if (!question || sending) return;
    setInput('');
    setShowLogin(false);
    setThread((t) => [...t, { role: 'user', text: question }]);
    setSending(true);
    try {
      const res = await fetch('/api/faq/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setThread((t) => [...t, { role: 'ai', text: data.answer, source: data.source }]);
        if (typeof data.remaining === 'number') {
          setQuota({ remaining: data.remaining, daily: data.dailyLimit ?? 4 });
        }
      } else if (res.status === 429) {
        setThread((t) => [...t, { role: 'notice', text: data.error || "You've used today's free questions." }]);
        if (typeof data.remaining === 'number') {
          setQuota({ remaining: 0, daily: data.dailyLimit ?? 4 });
        }
        if (data.loginRequired) setShowLogin(true);
      } else {
        setThread((t) => [
          ...t,
          { role: 'notice', text: data.error || 'The AI is busy right now. Please try again in a few moments.' },
        ]);
      }
    } catch {
      setThread((t) => [...t, { role: 'notice', text: 'Could not reach the server. Check your connection and try again.' }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <section aria-label="Frequently asked questions" className="w-full max-w-4xl mx-auto mt-12">
      <div className="rounded-2xl border p-6 sm:p-8 bg-white dark:bg-[#13121F] border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 mb-4 sm:mb-6">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <HelpCircle className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Frequently asked questions
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
              Straight answers about plans, trial &amp; payments. Still unsure? Just ask.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {STATIC_FAQS.map((item, idx) => {
            const isOpen = !!openItems[idx];
            return (
              <div
                key={idx}
                className="border border-slate-200/90 dark:border-slate-800/90 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-[#1A1828]/50"
              >
                <button
                  type="button"
                  onClick={() => setOpenItems((p) => ({ ...p, [idx]: !p[idx] }))}
                  className="w-full text-left px-4 py-3.5 flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      Q{idx + 1}.
                    </span>
                    <span>{item.q}</span>
                  </span>
                  <ChevronDown
                    className={clsx(
                      'w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200',
                      isOpen && 'rotate-180 text-emerald-500'
                    )}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-3.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800/60 pt-2.5">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" /> or ask the AI
          </span>
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
        </div>

        <p className="text-sm font-bold text-slate-900 dark:text-white">Didn&apos;t find your answer?</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-3">
          Ask anything about BSE Nexus — features, plans, filings, alerts.
        </p>

        <div className="flex flex-wrap gap-2 mb-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              disabled={sending}
              className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-[#1A1828]/60 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') ask();
            }}
            placeholder="Ask anything about plans, trial, payments…"
            maxLength={200}
            disabled={sending}
            className="flex-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1A1828] text-slate-900 dark:text-slate-100 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 disabled:opacity-60 placeholder:text-slate-400"
            aria-label="Ask a question"
          />
          <button
            type="button"
            onClick={() => ask()}
            disabled={sending || !input.trim()}
            className="w-11 h-11 shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-all disabled:opacity-50 active:scale-95 cursor-pointer"
            aria-label="Ask the AI"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        {quota && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 text-right">
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{quota.remaining}</span> of{' '}
            {quota.daily} free questions left today
          </p>
        )}

        {thread.length > 0 && (
          <div className="mt-4 space-y-2.5">
            {thread.map((m, i) => (
              <div key={i} className={clsx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={clsx(
                    'max-w-[92%] sm:max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed',
                    m.role === 'user' && 'bg-emerald-600 text-white rounded-br-md',
                    m.role === 'ai' &&
                      'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-slate-800 dark:text-slate-200 rounded-bl-md',
                    m.role === 'notice' &&
                      'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 rounded-bl-md text-xs'
                  )}
                >
                  <p className="whitespace-pre-wrap m-0">{m.text}</p>
                  {m.role === 'ai' && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 mb-0">
                      {m.source === 'ai' ? 'Generated by AI from BSE Nexus docs' : 'From our help answers'}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-2xl rounded-bl-md px-4 py-3">
                  <span className="inline-flex gap-1.5">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce"
                        style={{ animationDelay: `${d * 0.15}s` }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            )}
            {showLogin && onLoginRequest && (
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={onLoginRequest}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors cursor-pointer"
                >
                  <LogIn className="w-4 h-4" /> Log in to ask more
                </button>
              </div>
            )}
            <div ref={threadEndRef} />
          </div>
        )}
      </div>
    </section>
  );
}
