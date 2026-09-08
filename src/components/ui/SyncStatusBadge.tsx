import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { onSyncStatusChange, SyncStatus, SyncStatusDetail } from '../../utils/retry';

interface SyncStatusBadgeProps {
  className?: string;
  compact?: boolean;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({ className = '', compact = false }) => {
  const [syncState, setSyncState] = useState<{ status: SyncStatus; message?: string }>({
    status: 'idle',
  });

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    const unsubscribe = onSyncStatusChange((detail: SyncStatusDetail) => {
      setSyncState({ status: detail.status, message: detail.message });

      if (timer) clearTimeout(timer);

      if (detail.status === 'synced') {
        timer = setTimeout(() => {
          setSyncState({ status: 'idle' });
        }, 3000);
      } else if (detail.status === 'failed') {
        timer = setTimeout(() => {
          setSyncState({ status: 'idle' });
        }, 6000);
      }
    });

    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (syncState.status === 'idle') {
    return null;
  }

  if (syncState.status === 'syncing') {
    return (
      <div
        id="sync-status-badge-syncing"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 animate-pulse ${className}`}
      >
        <RefreshCw className="w-3 h-3 animate-spin text-sky-500" />
        {!compact && <span>Syncing...</span>}
      </div>
    );
  }

  if (syncState.status === 'synced') {
    return (
      <div
        id="sync-status-badge-synced"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 transition-all duration-300 animate-in fade-in ${className}`}
      >
        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
        <span>Synced</span>
      </div>
    );
  }

  if (syncState.status === 'failed') {
    return (
      <div
        id="sync-status-badge-failed"
        title={syncState.message || 'Sync failed. Local copy preserved.'}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition-all duration-300 animate-in fade-in ${className}`}
      >
        <AlertTriangle className="w-3 h-3 text-rose-500" />
        <span>{compact ? 'Failed ⚠️' : 'Sync failed ⚠️'}</span>
      </div>
    );
  }

  return null;
};
