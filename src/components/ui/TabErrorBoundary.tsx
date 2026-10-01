import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { sendTelemetryEvent, getBreadcrumbs } from '../../utils/telemetry';

interface TabErrorBoundaryProps {
  /** Short label for telemetry (e.g. "settings", "watchlists"). */
  label: string;
  /** Optional "back to safety" action (e.g. switch to the Filings tab). */
  onBack?: () => void;
  children: React.ReactNode;
}

interface TabErrorBoundaryState {
  hasError: boolean;
  reloading: boolean;
}

const RELOAD_FLAG = 'bse_eb_reloaded';

/**
 * Safety net for lazily-loaded sections.
 *
 * Why this exists: after a new deploy, a browser can briefly hold a mix of
 * chunks from two app versions (cached HTML/chunks vs. freshly deployed
 * ones). A stale lazy chunk then runs against a different React instance and
 * crashes with "Cannot read properties of null (reading 'useState')"
 * (React's invalid-hook-call). Without a boundary that unmounts the WHOLE
 * app (blank screen). With this boundary, only the section fails and the
 * user gets a one-tap recovery.
 *
 * Recovery strategy: the first failure in a tab session auto-reloads once
 * (fresh chunks fix stale mixes). If it still fails after the reload, we
 * show the card instead of looping forever.
 */
export class TabErrorBoundary extends React.Component<TabErrorBoundaryProps, TabErrorBoundaryState> {
  state: TabErrorBoundaryState = { hasError: false, reloading: false };

  static getDerivedStateFromError(): Partial<TabErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    try {
      sendTelemetryEvent({
        type: 'ERROR',
        error: {
          message: error?.message || String(error),
          stack: error?.stack || '',
          componentStack: info?.componentStack || '',
          section: this.props.label,
          severity: 'ERROR',
          breadcrumbs: getBreadcrumbs(),
          url: typeof window !== 'undefined' ? window.location.pathname + window.location.search : '',
        },
      });
    } catch {}

    try {
      if (!sessionStorage.getItem(RELOAD_FLAG)) {
        sessionStorage.setItem(RELOAD_FLAG, '1');
        this.setState({ reloading: true });
        // Fresh HTML + chunks resolve stale-version mixes.
        setTimeout(() => window.location.reload(), 350);
      }
    } catch {
      // sessionStorage unavailable (private mode etc.) — fall through to the card.
    }
  }

  handleManualReload = () => {
    this.setState({ reloading: true });
    try { sessionStorage.removeItem(RELOAD_FLAG); } catch {}
    window.location.reload();
  };

  handleBack = () => {
    this.setState({ hasError: false, reloading: false });
    this.props.onBack?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center" role="alert">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          This section couldn't load
        </h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          The app may have just been updated, or a file failed to load. Reloading usually fixes this.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={this.handleManualReload}
            disabled={this.state.reloading}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <RefreshCw className={`h-4 w-4 ${this.state.reloading ? 'animate-spin' : ''}`} aria-hidden="true" />
            {this.state.reloading ? 'Reloading…' : 'Reload app'}
          </button>
          {this.props.onBack && (
            <button
              type="button"
              onClick={this.handleBack}
              disabled={this.state.reloading}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Back to Filings
            </button>
          )}
        </div>
      </div>
    );
  }
}
