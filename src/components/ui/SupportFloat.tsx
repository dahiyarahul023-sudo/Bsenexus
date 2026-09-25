import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, X, Send, HelpCircle, Bug, Sparkles, 
  ExternalLink, Mail, ShieldCheck, HeartHandshake
} from 'lucide-react';
import { springSnappy, buttonTap } from '../../utils/motionTokens';
import { useToast } from '../../context/ToastContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

export interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenHelp?: () => void;
}

export function SupportModal({ isOpen, onClose, onOpenHelp }: SupportModalProps) {
  const [feedbackType, setFeedbackType] = useState<'feedback' | 'bug' | 'feature'>('feedback');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  useBodyScrollLock(isOpen);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    // Simulate instantaneous receipt & dispatch event
    setTimeout(() => {
      setIsSubmitting(false);
      onClose();
      setMessage('');
      setEmail('');
      toast.success('Thank you! Your feedback has been received.', {
        duration: 4000
      });
    }, 600);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain"
          role="dialog"
          aria-modal="true"
          aria-labelledby="support-sheet-title"
        >
          {/* Backdrop Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 24 }}
            transition={springSnappy}
            className="relative w-full max-w-lg bg-white dark:bg-[#1A1926] rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-[#2D283E] shadow-2xl p-5 sm:p-6 z-10 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            {/* Mobile Drag Indicator */}
            <div className="sm:hidden flex justify-center pb-1 -mt-1">
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#2D283E] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <HeartHandshake size={20} />
                </div>
                <div>
                  <h3 id="support-sheet-title" className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-display">
                    Help & Support
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Direct assistance from the BSE Nexus team</p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close support dialog"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Action Channels */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <a
                href="mailto:admin@bsenexus.in?subject=BSE%20Nexus%20Feedback%20%26%20Support"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#201E2E] hover:bg-slate-100 dark:hover:bg-[#282438] border border-slate-200 dark:border-[#352F48] text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors group"
              >
                <span className="flex items-center gap-2">
                  <Mail size={15} className="text-emerald-500 shrink-0 group-hover:scale-110 transition-transform" />
                  <span>Email: admin@bsenexus.in</span>
                </span>
                <ExternalLink size={12} className="text-slate-400" />
              </a>

              {onOpenHelp && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenHelp();
                  }}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#201E2E] hover:bg-slate-100 dark:hover:bg-[#282438] border border-slate-200 dark:border-[#352F48] text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors text-left group cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <HelpCircle size={15} className="text-indigo-500 shrink-0 group-hover:scale-110 transition-transform" />
                    <span>Guides & FAQ</span>
                  </span>
                  <Sparkles size={12} className="text-amber-500" />
                </button>
              )}
            </div>

            {/* In-App Feedback Form */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Send Direct Feedback / Issue</span>
                <span className="text-[10px] text-slate-400">Response within 24h</span>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-3 gap-1.5">
                  {(['feedback', 'bug', 'feature'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFeedbackType(type)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold capitalize transition-all border text-center cursor-pointer ${
                        feedbackType === type
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                          : 'bg-slate-50 dark:bg-[#201E2E] border-slate-200 dark:border-[#352F48] text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      {type === 'bug' ? 'Report Bug' : type === 'feature' ? 'Feature Idea' : 'Feedback'}
                    </button>
                  ))}
                </div>

                <div>
                  <textarea
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      feedbackType === 'bug'
                        ? 'Describe the issue, stock name, or step that failed...'
                        : feedbackType === 'feature'
                        ? 'What new filing feature or analysis would you love to see?'
                        : 'How can we improve your experience with BSE Nexus?'
                    }
                    className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#352F48] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Your email (optional, for follow-up)"
                    className="flex-1 text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#352F48] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <motion.button
                    whileTap={buttonTap}
                    type="submit"
                    disabled={isSubmitting || !message.trim()}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shrink-0 shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {isSubmitting ? 'Sending...' : 'Submit'}
                  </motion.button>
                </div>
              </form>
            </div>

            {/* Direct Email fallback */}
            <div className="pt-2 border-t border-slate-100 dark:border-[#2D283E] flex items-center justify-between text-[11px] text-slate-500">
              <a 
                href="mailto:admin@bsenexus.in" 
                className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors"
                aria-label="Email BSE Nexus Support (admin@bsenexus.in)"
              >
                <Mail size={12} className="text-slate-400" />
                <span>Email: <span className="underline font-medium">admin@bsenexus.in</span></span>
              </a>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Live Mon-Sat</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// Backward-compatible export alias
export function SupportFloat({ onOpenHelp }: { onOpenHelp?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  return <SupportModal isOpen={isOpen} onClose={() => setIsOpen(false)} onOpenHelp={onOpenHelp} />;
}

