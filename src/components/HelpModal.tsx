import React, { useState } from 'react';
import { 
  X, HelpCircle, Bot, Send, Zap, ShieldCheck, 
  Search, Bell, Sparkles, ChevronRight, CheckCircle2,
  FileText, ArrowUpRight, MessageSquare, RefreshCw, Copy, Check
} from 'lucide-react';
import { customFetch } from '../api';
import { useAuth } from '../context/AuthContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

const PRESET_QUESTIONS = [
  "How to set up Telegram bot alerts?",
  "What are Watchlist priorities (High vs Medium vs Low)?",
  "How to see historical previous results & filing times?",
  "How does the AI PDF summary engine work?",
  "What is Free Tier quota protection & manual mode?",
  "How to upgrade to Pro plan?"
];

export function HelpModal({ isOpen, onClose, onOpenSettings }: HelpModalProps) {
  const { user, isPro, isAdmin, setIsAuthModalOpen, setIsProModalOpen } = useAuth();
  const [activeTab, setActiveTab] = useState<'ask_ai' | 'quickstart' | 'telegram' | 'ai' | 'faq'>('ask_ai');
  
  useBodyScrollLock(isOpen);

  // AI Guide Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      text: "👋 Hello! I am the **BSE Nexus AI Assistant**. Ask me anything about using the terminal, setting up Telegram alerts, managing watchlists & priorities, reading AI financial summaries, or tracking previous results history!"
    }
  ]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isAskingAi, setIsAskingAi] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleSendQuestion = async (queryText?: string) => {
    const q = (queryText || inputQuestion).trim();
    if (!q || isAskingAi) return;

    // 1. Guests are strictly view-only
    const isGuestUser = !user || user.isAnonymous;
    if (isGuestUser) {
      setChatMessages(prev => [
        ...prev,
        { role: 'user', text: q },
        { role: 'model', text: '🔒 **Google Sign-In Required**: Guest users have view-only access. Sign in with Google to get **30 days of Free Pro** access including the AI Assistant!' }
      ]);
      setInputQuestion('');
      setIsAuthModalOpen(true);
      return;
    }

    // 2. Expired trial
    if (!isPro && !isAdmin) {
      setChatMessages(prev => [
        ...prev,
        { role: 'user', text: q },
        { role: 'model', text: '🔒 **Pro Upgrade Required**: Your 30-Day Free Pro trial has ended. Please upgrade to Pro to continue asking the AI Assistant.' }
      ]);
      setInputQuestion('');
      setIsProModalOpen(true);
      return;
    }

    const userMsg: ChatMessage = { role: 'user', text: q };
    const nextHistory = [...chatMessages, userMsg];
    setChatMessages(nextHistory);
    setInputQuestion('');
    setIsAskingAi(true);

    try {
      const res = await customFetch('/api/help/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          history: chatMessages.slice(-6)
        })
      });

      const data = await res.json();
      if (res.status === 401 || data?.authRequired) {
        setIsAuthModalOpen(true);
        setChatMessages([...nextHistory, { role: 'model', text: data.error || '🔒 Please sign in with Google to continue using the AI assistant.' }]);
        return;
      }
      if (res.status === 403 || data?.proRequired) {
        setIsProModalOpen(true);
        setChatMessages([...nextHistory, { role: 'model', text: data.error || '🔒 Your 30-Day Free Pro trial has ended. Please upgrade to Pro.' }]);
        return;
      }
      if (data.success && data.answer) {
        setChatMessages([...nextHistory, { role: 'model', text: data.answer }]);
      } else {
        setChatMessages([...nextHistory, { role: 'model', text: data.error || "Sorry, I couldn't process your request. Please try again." }]);
      }
    } catch (err: any) {
      setChatMessages([...nextHistory, { role: 'model', text: `Error: ${err.message || 'Failed to connect to AI engine.'}` }]);
    } finally {
      setIsAskingAi(false);
    }
  };

  const handleCopyText = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 overscroll-contain"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
    >
      <div 
        className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/50 dark:border-indigo-800/50">
              <HelpCircle size={20} />
            </div>
            <div>
              <h3 id="help-modal-title" className="text-base font-bold text-slate-900 dark:text-white">Help & Knowledge Base</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Guides, Telegram Bot setup, AI metrics & FAQs</p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close help modal"
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 px-5 pt-3 gap-2 bg-slate-50/30 dark:bg-slate-900/30 shrink-0 overflow-x-auto">
          {[
            { id: 'ask_ai', label: '🤖 Ask AI Guide', icon: Sparkles },
            { id: 'quickstart', label: 'Quick Start', icon: Zap },
            { id: 'telegram', label: 'Telegram Setup', icon: Send },
            { id: 'ai', label: 'AI Summaries', icon: Bot },
            { id: 'faq', label: 'FAQ', icon: FileText }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs text-slate-600 dark:text-slate-300 overscroll-contain">
          
          {/* TAB 0: Interactive AI Guide */}
          {activeTab === 'ask_ai' && (
            <div className="space-y-4 animate-in fade-in flex flex-col h-full">
              {/* Introduction Banner */}
              <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/60 space-y-1.5 shrink-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                    <Sparkles size={16} className="text-indigo-600 dark:text-indigo-400" />
                    BSE Nexus AI Assistant
                  </h4>
                  <button
                    type="button"
                    onClick={() => setChatMessages([{
                      role: 'model',
                      text: "👋 Hello! I am the **BSE Nexus AI Assistant**. Ask me anything about using the terminal, setting up Telegram alerts, managing watchlists & priorities, reading AI financial summaries, or tracking previous results history!"
                    }])}
                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw size={11} /> Clear Chat
                  </button>
                </div>
                <p className="text-xs text-indigo-900/80 dark:text-indigo-300/80 leading-relaxed">
                  Have questions about setting up Telegram, watchlist conviction levels, results calendar, or quota optimizer? Ask below!
                </p>
              </div>

              {/* Preset Question Chips */}
              <div className="space-y-1.5 shrink-0">
                <div className="text-[11px] font-bold text-slate-400">Popular Quick Questions:</div>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_QUESTIONS.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendQuestion(q)}
                      disabled={isAskingAi}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/50 text-slate-700 hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-300 rounded-lg text-[11px] font-semibold border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer text-left"
                    >
                      💡 {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Message Bubble Stream */}
              <div className="space-y-3 flex-1 overflow-y-auto pr-1 min-h-[220px]">
                {chatMessages.map((msg, idx) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div 
                      key={idx} 
                      className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isUser && (
                        <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                          <Bot size={14} />
                        </div>
                      )}

                      <div className={`relative max-w-[85%] rounded-2xl p-3.5 space-y-1.5 text-xs shadow-2xs ${
                        isUser 
                          ? 'bg-indigo-600 text-white font-medium rounded-tr-xs' 
                          : 'bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 rounded-tl-xs'
                      }`}>
                        <div className="whitespace-pre-wrap leading-relaxed">
                          {msg.text}
                        </div>

                        {!isUser && (
                          <div className="flex items-center justify-end pt-1 border-t border-slate-100 dark:border-slate-700/60 mt-1">
                            <button
                              type="button"
                              onClick={() => handleCopyText(msg.text, idx)}
                              className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                              title="Copy Answer"
                            >
                              {copiedIndex === idx ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                              <span>{copiedIndex === idx ? "Copied" : "Copy"}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isAskingAi && (
                  <div className="flex gap-2.5 justify-start">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Bot size={14} className="animate-spin" />
                    </div>
                    <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-3.5 text-xs text-slate-500 flex items-center gap-2 shadow-2xs">
                      <RefreshCw size={13} className="animate-spin text-indigo-500" />
                      <span>BSE Nexus AI is thinking...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input Bar */}
              <form 
                onSubmit={e => { e.preventDefault(); handleSendQuestion(); }}
                className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0"
              >
                <input
                  type="text"
                  value={inputQuestion}
                  onChange={e => setInputQuestion(e.target.value)}
                  placeholder="Ask a question about BSE Nexus (e.g. How to get Telegram alerts?)..."
                  aria-label="Ask a question about BSE Nexus"
                  disabled={isAskingAi}
                  className="flex-1 px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={isAskingAi || !inputQuestion.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                >
                  <Send size={13} />
                  <span>Ask AI</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 1: Quick Start */}
          {activeTab === 'quickstart' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/60 space-y-1.5">
                <h4 className="text-sm font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                  <Zap size={16} className="text-indigo-600 dark:text-indigo-400" />
                  What is BSE Nexus?
                </h4>
                <p className="text-xs text-indigo-900/80 dark:text-indigo-300/80 leading-relaxed">
                  BSE Nexus is an enterprise-grade live regulatory terminal tracking every public corporate filing from the Bombay Stock Exchange in sub-second intervals.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px]">1</span>
                    <span>1-Click Stock Watchlist</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Search any BSE scrip code or company name (e.g. <em>TCS, RELIANCE, INFY</em>) in the search bar and click <strong>Add to Watchlist</strong> to track filings in real-time.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px]">2</span>
                    <span>Instant Telegram DMs</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Connect your Telegram Chat ID in Settings to get immediate high-priority alerts for earnings, dividend declarations, and board approvals directly on your phone.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center text-[10px]">3</span>
                    <span>AI Earnings Extractor</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Gemini AI automatically reads corporate PDF announcements and extracts Revenue YoY, Net Profit YoY, EPS, and quarter highlights within seconds.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-[10px]">4</span>
                    <span>Noise Cancellation Filter</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Filter out routine disclosures, loss of share certificates, and credit updates so you only focus on high-impact price-moving catalysts.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Telegram Setup */}
          {activeTab === 'telegram' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800 space-y-2">
                <div className="flex items-center gap-2 font-bold text-blue-950 dark:text-blue-200">
                  <Bot size={16} className="text-blue-600 dark:text-blue-400" />
                  <span>How to Connect Your Personal Telegram Bot (2 Steps)</span>
                </div>
                <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80">
                  Get high-conviction market disclosures sent straight to your phone before brokers or social channels report them.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                  <span className="w-6 h-6 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center text-xs shrink-0">1</span>
                  <div className="space-y-1">
                    <h5 className="font-bold text-slate-900 dark:text-white">Get your Chat ID from Telegram</h5>
                    <p className="text-[11px] text-slate-500">
                      Open Telegram on your mobile or desktop, search for the userbot <strong className="text-blue-600 dark:text-blue-400">@userinfobot</strong> and press <strong>/start</strong>.
                    </p>
                    <p className="text-[11px] text-slate-500">
                      It will immediately respond with your numerical ID (e.g. <span className="font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-slate-800 dark:text-slate-200">987654321</span>).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                  <span className="w-6 h-6 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center text-xs shrink-0">2</span>
                  <div className="space-y-1">
                    <h5 className="font-bold text-slate-900 dark:text-white">Paste Chat ID in Settings & Save</h5>
                    <p className="text-[11px] text-slate-500">
                      Go to the <strong>Settings</strong> section, paste your ID into the <strong>Telegram Chat ID</strong> box, and click <strong>Save & Test Alert</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {onOpenSettings && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenSettings();
                  }}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send size={14} />
                  <span>Configure Telegram in Settings</span>
                </button>
              )}
            </div>
          )}

          {/* TAB 3: AI Summaries */}
          {activeTab === 'ai' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800 space-y-2">
                <div className="flex items-center gap-2 font-bold text-purple-950 dark:text-purple-200">
                  <Sparkles size={16} className="text-purple-600 dark:text-purple-400" />
                  <span>Gemini 2.5 Flash Financial Extraction</span>
                </div>
                <p className="text-[11px] text-purple-800/80 dark:text-purple-300/80">
                  Our server parses incoming exchange PDFs with AI to provide instant financial metrics in under 3 seconds.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="font-bold text-slate-900 dark:text-white mb-0.5">📈 Revenue & Net Profit YoY</div>
                  <p className="text-[11px] text-slate-500">Calculates percentage growth compared to the corresponding quarter of the previous financial year.</p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="font-bold text-slate-900 dark:text-white mb-0.5">💰 EBITDA & Margin Expansion</div>
                  <p className="text-[11px] text-slate-500">Extracts operating margin and EPS to help identify margin expansion or contraction.</p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="font-bold text-slate-900 dark:text-white mb-0.5">🎯 Material Filings Categorization</div>
                  <p className="text-[11px] text-slate-500">Automatically tags orders, acquisitions, and dividend amounts (e.g. ₹5.00/share) for quick scannability.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: FAQ */}
          {activeTab === 'faq' && (
            <div className="space-y-3 animate-in fade-in">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                <h5 className="font-bold text-slate-900 dark:text-white">Q: How fast are announcements delivered?</h5>
                <p className="text-[11px] text-slate-500">
                  Announcements are polled from the official BSE exchange dissemination portal every 800ms. They typically appear within 1–2 seconds of public submission.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                <h5 className="font-bold text-slate-900 dark:text-white">Q: Are my watchlists saved if I close the browser?</h5>
                <p className="text-[11px] text-slate-500">
                  Yes! When you log in with your Google or email account, all your watchlists, stock priorities, and noise preferences are synced with your cloud database.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                <h5 className="font-bold text-slate-900 dark:text-white">Q: How do I edit my profile name and notification preferences?</h5>
                <p className="text-[11px] text-slate-500">
                  Go to the <strong>Settings</strong> tab to edit your display name, username, Telegram ID, priority filters, and admin security PIN.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                <h5 className="font-bold text-slate-900 dark:text-white">Q: Is BSE Nexus SEBI registered?</h5>
                <p className="text-[11px] text-slate-500">
                  BSE Nexus is an automated technology software and data visualization terminal. It is not an investment advisor or research analyst. Please read our Terms and Conditions for full details.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500">
            Need more help? Email support at <span className="font-semibold text-slate-700 dark:text-slate-300">support@bsenexus.in</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Close Guide
          </button>
        </div>

      </div>
    </div>
  );
}
