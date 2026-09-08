import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X, RotateCcw } from 'lucide-react';
import { springSnappy } from '../utils/motionTokens';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  title?: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  undoAction?: () => void;
  action?: ToastAction;
}

interface ToastContextType {
  showToast: (toast: Omit<ToastItem, 'id'>) => string;
  success: (message: string, options?: Partial<Omit<ToastItem, 'id' | 'type' | 'message'>>) => string;
  error: (message: string, options?: Partial<Omit<ToastItem, 'id' | 'type' | 'message'>>) => string;
  info: (message: string, options?: Partial<Omit<ToastItem, 'id' | 'type' | 'message'>>) => string;
  warning: (message: string, options?: Partial<Omit<ToastItem, 'id' | 'type' | 'message'>>) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = 'toast_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      const newToast: ToastItem = {
        ...toast,
        id,
        duration: toast.duration ?? (toast.undoAction ? 6000 : 4000),
      };

      setToasts((prev) => [newToast, ...prev.slice(0, 3)]); // Keep max 4 toasts
      return id;
    },
    []
  );

  const success = useCallback(
    (message: string, options?: Partial<Omit<ToastItem, 'id' | 'type' | 'message'>>) =>
      showToast({ message, type: 'success', ...options }),
    [showToast]
  );

  const error = useCallback(
    (message: string, options?: Partial<Omit<ToastItem, 'id' | 'type' | 'message'>>) =>
      showToast({ message, type: 'error', ...options }),
    [showToast]
  );

  const info = useCallback(
    (message: string, options?: Partial<Omit<ToastItem, 'id' | 'type' | 'message'>>) =>
      showToast({ message, type: 'info', ...options }),
    [showToast]
  );

  const warning = useCallback(
    (message: string, options?: Partial<Omit<ToastItem, 'id' | 'type' | 'message'>>) =>
      showToast({ message, type: 'warning', ...options }),
    [showToast]
  );

  // Also listen for global window events so components without direct hook access can trigger toasts
  React.useEffect(() => {
    const handleGlobalToast = (e: any) => {
      if (e.detail) {
        showToast(e.detail);
      }
    };
    window.addEventListener('app-toast', handleGlobalToast);
    return () => window.removeEventListener('app-toast', handleGlobalToast);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning, dismissToast }}>
      {children}
      {/* Toast Render Viewport (Top center on mobile, Bottom right on desktop) */}
      <div 
        aria-live="polite" 
        className="fixed z-50 pointer-events-none top-4 left-3 right-3 sm:left-auto sm:right-6 sm:top-auto sm:bottom-6 max-w-sm w-full flex flex-col gap-2"
      >
        <AnimatePresence>
          {toasts.map((item) => (
            <ToastCard key={item.id} item={item} onDismiss={() => dismissToast(item.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

const ToastCard: React.FC<{ item: ToastItem; onDismiss: () => void }> = ({ item, onDismiss }) => {
  const duration = item.duration || 4000;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    timerRef.current = setTimeout(() => {
      onDismiss();
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [duration, onDismiss]);

  const getIcon = () => {
    switch (item.type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />;
      default:
        return <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />;
    }
  };

  const getBorderColor = () => {
    switch (item.type) {
      case 'success':
        return 'border-emerald-500/30 dark:border-emerald-500/20';
      case 'error':
        return 'border-rose-500/30 dark:border-rose-500/20';
      case 'warning':
        return 'border-amber-500/30 dark:border-amber-500/20';
      default:
        return 'border-blue-500/30 dark:border-blue-500/20';
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
      transition={springSnappy}
      className={`pointer-events-auto relative overflow-hidden rounded-xl border bg-white/95 dark:bg-[#1C1A27]/95 backdrop-blur-xl shadow-xl p-3.5 text-slate-800 dark:text-slate-100 ${getBorderColor()}`}
      role="alert"
    >
      <div className="flex items-start gap-2.5">
        {getIcon()}
        <div className="flex-1 min-w-0 pr-1">
          {item.title && (
            <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight mb-0.5">
              {item.title}
            </div>
          )}
          <div className="text-xs font-medium text-slate-700 dark:text-slate-200 leading-snug break-words">
            {item.message}
          </div>
        </div>

        {/* Undo Action Button (Item 2: Undo Toasts) */}
        {item.undoAction && (
          <button
            type="button"
            onClick={() => {
              item.undoAction?.();
              onDismiss();
            }}
            className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition-colors cursor-pointer border border-emerald-500/30"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Undo</span>
          </button>
        )}

        {/* Generic Action Button if specified */}
        {!item.undoAction && item.action && (
          <button
            type="button"
            onClick={() => {
              item.action?.onClick();
              onDismiss();
            }}
            className="shrink-0 px-2 py-1 rounded-md bg-slate-100 dark:bg-[#2B273C] hover:bg-slate-200 dark:hover:bg-[#37324D] text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer border border-slate-200 dark:border-[#3C3652]"
          >
            {item.action.label}
          </button>
        )}

        {/* Dismiss X */}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss toast"
          className="shrink-0 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Auto-dismiss countdown line */}
      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: duration / 1000, ease: 'linear' }}
        style={{ originX: 0 }}
        className={`absolute bottom-0 left-0 right-0 h-0.5 ${
          item.type === 'success'
            ? 'bg-emerald-500'
            : item.type === 'error'
            ? 'bg-rose-500'
            : item.type === 'warning'
            ? 'bg-amber-500'
            : 'bg-blue-500'
        }`}
      />
    </motion.div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Graceful fallback if invoked outside provider
    return {
      showToast: (t: any) => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('app-toast', { detail: t }));
        }
        return '';
      },
      success: (message: string, options?: any) => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type: 'success', ...options } }));
        }
        return '';
      },
      error: (message: string, options?: any) => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type: 'error', ...options } }));
        }
        return '';
      },
      info: (message: string, options?: any) => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type: 'info', ...options } }));
        }
        return '';
      },
      warning: (message: string, options?: any) => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type: 'warning', ...options } }));
        }
        return '';
      },
      dismissToast: () => {},
    };
  }
  return context;
}
