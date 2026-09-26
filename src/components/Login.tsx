import React from 'react';
import { ModernAuthCard } from './ui/ModernAuthCard';

export function Login({ onLogin }: { onLogin: () => void }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-blue-500 selection:text-white relative overflow-y-auto"
      style={{
        background:
          'linear-gradient(180deg, #eaf5fd 0%, #dbeafe 55%, #eef4ff 100%)',
      }}
    >
      {/* Wavy login card */}
      <div className="relative z-10 w-full my-auto">
        <ModernAuthCard
          mode="fullscreen"
          initialTab="signin"
          onSuccess={onLogin}
        />
      </div>
      <p className="relative z-10 mt-5 text-xs text-slate-500 text-center">
        Official BSE filing data · Secured with reCAPTCHA Enterprise
      </p>
    </div>
  );
}
