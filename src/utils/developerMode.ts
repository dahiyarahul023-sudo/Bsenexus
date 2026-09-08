import { useState, useEffect } from 'react';

const STORAGE_KEY = 'nexus_dev_terminal_mode';
const EVENT_NAME = 'nexus_dev_mode_changed';

export function isDeveloperTerminalModeEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setDeveloperTerminalMode(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { enabled } }));
    }
  } catch (e) {
    console.warn('Could not save developer terminal mode:', e);
  }
}

export function useDeveloperMode(): [boolean, (val: boolean) => void] & { isDeveloperMode: boolean; setDeveloperMode: (val: boolean) => void; isDevMode: boolean } {
  const [isDevMode, setIsDevMode] = useState<boolean>(() => isDeveloperTerminalModeEnabled());

  useEffect(() => {
    const handleStorage = () => {
      setIsDevMode(isDeveloperTerminalModeEnabled());
    };

    const handleCustom = (e: any) => {
      if (e?.detail?.enabled !== undefined) {
        setIsDevMode(Boolean(e.detail.enabled));
      } else {
        setIsDevMode(isDeveloperTerminalModeEnabled());
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(EVENT_NAME, handleCustom);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(EVENT_NAME, handleCustom);
    };
  }, []);

  const toggle = (val: boolean) => {
    setDeveloperTerminalMode(val);
    setIsDevMode(val);
  };

  const result: any = [isDevMode, toggle];
  result.isDeveloperMode = isDevMode;
  result.isDevMode = isDevMode;
  result.setDeveloperMode = toggle;

  return result;
}
