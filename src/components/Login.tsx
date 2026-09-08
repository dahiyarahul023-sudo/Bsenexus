import React from 'react';
import { ModernAuthCard } from './ui/ModernAuthCard';

export function Login({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen bg-[#0E131F] flex flex-col items-center justify-center p-2.5 sm:p-4 md:p-6 selection:bg-emerald-500 selection:text-white relative overflow-y-auto">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Modern Split Sliding Card */}
      <div className="relative z-10 w-full max-w-[820px] my-auto">
        <ModernAuthCard 
          mode="fullscreen"
          initialTab="signin"
          onSuccess={onLogin}
        />
      </div>
    </div>
  );
}
