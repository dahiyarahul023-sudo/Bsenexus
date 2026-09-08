import React, { useState } from 'react';
import { X, KeyRound, ShieldCheck, AlertCircle, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

export function AdminPinModal() {
  const { 
    isAdminPinModalOpen, 
    setIsAdminPinModalOpen, 
    verifyAdminPin,
    profile,
    user
  } = useAuth();

  useBodyScrollLock(isAdminPinModalOpen);

  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isAdminPinModalOpen) return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) {
      setError('Please enter the Master PIN.');
      return;
    }
    setError(null);
    setIsVerifying(true);
    const res = await verifyAdminPin(pin);
    setIsVerifying(false);
    if (!res.success) {
      setError(res.error || 'Incorrect Admin PIN');
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 overscroll-contain"
      onClick={() => setIsAdminPinModalOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-pin-title"
    >
      <div 
        className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-purple-50/60 dark:bg-purple-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <KeyRound size={16} />
            </div>
            <div>
              <h3 id="admin-pin-title" className="text-sm font-bold text-slate-900 dark:text-white">Admin 2-Factor Verification</h3>
              <p className="text-[11px] text-slate-500">{user?.email || profile?.email || 'Admin Account'}</p>
            </div>
          </div>

          <button
            onClick={() => setIsAdminPinModalOpen(false)}
            aria-label="Close Admin PIN Verification"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleVerify} className="p-6 space-y-4">
          <div className="p-3 bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/60 rounded-xl text-xs text-purple-900 dark:text-purple-300">
            <div className="flex items-center gap-1.5 font-bold mb-1">
              <Lock size={13} />
              <span>Two-Factor Security Protection</span>
            </div>
            <p className="text-[11px] text-purple-700 dark:text-purple-400 leading-relaxed">
              Google Account verified. Enter your Master PIN to unlock root configuration & scraper engine controls.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="admin-security-pin" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 text-center">
              Master Security PIN
            </label>
            <input
              id="admin-security-pin"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              aria-label="Master Security PIN"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-xl font-mono tracking-widest text-purple-600 dark:text-purple-400 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            disabled={isVerifying}
            className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <ShieldCheck size={14} />
            <span>{isVerifying ? 'Verifying PIN...' : 'Confirm Access'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
