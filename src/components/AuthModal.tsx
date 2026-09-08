import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { ModernAuthCard } from './ui/ModernAuthCard';

export function AuthModal() {
  const { 
    isAuthModalOpen, 
    setIsAuthModalOpen, 
  } = useAuth();

  useBodyScrollLock(isAuthModalOpen);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAuthModalOpen) {
        setIsAuthModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, setIsAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 z-50 animate-in fade-in duration-200 overflow-y-auto overscroll-contain"
      onClick={() => setIsAuthModalOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div 
        className="w-full max-w-[820px] my-auto transition-all flex flex-col justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <ModernAuthCard 
          mode="modal"
          initialTab="signin"
          onClose={() => setIsAuthModalOpen(false)}
        />
      </div>
    </div>
  );
}
