import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp } from 'lucide-react';
import { springSnappy } from '../../utils/motionTokens';

export function BackToTop() {
  const [visible, setVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY || document.documentElement.scrollTop;
          const height = document.documentElement.scrollHeight - window.innerHeight;
          const progress = height > 0 ? Math.min(100, Math.round((scrollY / height) * 100)) : 0;
          
          setScrollProgress(progress);
          setVisible(scrollY > 350);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          transition={springSnappy}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={scrollToTop}
          aria-label={`Back to top (${scrollProgress}% scrolled)`}
          title={`Scroll to top (${scrollProgress}%)`}
          className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 w-11 h-11 rounded-full bg-white/95 dark:bg-[#1F1D2B]/95 backdrop-blur-md border border-slate-200/90 dark:border-[#38334C] shadow-lg flex items-center justify-center text-slate-700 dark:text-slate-200 cursor-pointer group select-none transition-colors hover:border-emerald-500/50"
        >
          {/* Circular SVG progress ring */}
          <svg className="w-11 h-11 absolute inset-0 -rotate-90 pointer-events-none" viewBox="0 0 44 44">
            <circle
              cx="22"
              cy="22"
              r="19"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="text-slate-200/50 dark:text-slate-700/50"
            />
            <circle
              cx="22"
              cy="22"
              r="19"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeDasharray={119.38}
              strokeDashoffset={119.38 - (scrollProgress / 100) * 119.38}
              strokeLinecap="round"
              className="text-emerald-500 transition-all duration-150"
            />
          </svg>

          <ArrowUp size={16} className="text-slate-700 dark:text-slate-200 group-hover:text-emerald-500 group-hover:-translate-y-0.5 transition-transform" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
