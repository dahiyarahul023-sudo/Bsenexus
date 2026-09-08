import { useState, useEffect, useCallback, useRef } from 'react';
import { customFetch } from '../api';
import { useVisibilityInterval } from './useVisibilityInterval';

export interface MarketIndexItem {
  id: string;
  symbol: string;
  name: string;
  category?: 'EQUITY_INDEX' | 'VOLATILITY' | 'CURRENCY';
  price: number;
  change: number;
  changePercent: number;
  dayHigh?: number;
  dayLow?: number;
  previousClose?: number;
  currency: string;
  lastUpdated: string;
  description?: string;
  tick?: 'UP' | 'DOWN' | null;
}

export interface MarketOverviewState {
  indices: MarketIndexItem[];
  isMarketOpen: boolean;
  marketSession: 'REGULAR' | 'CLOSED' | 'PRE_MARKET' | 'CLOSING_WINDOW_10MIN' | 'POST_MARKET';
  marketStatusText: string;
  sessionBadge?: string;
  lastRefreshed: number;
  loading: boolean;
}

const DEFAULT_INDICES: MarketIndexItem[] = [
  {
    id: 'sensex',
    symbol: '^BSESN',
    name: 'SENSEX (BSE 30)',
    category: 'EQUITY_INDEX',
    price: 76853.87,
    change: -381.59,
    changePercent: -0.49,
    dayHigh: 77347.81,
    dayLow: 76823.91,
    previousClose: 77728.20,
    currency: 'INR',
    lastUpdated: new Date().toISOString(),
    description: 'BSE SENSEX 30 Blue-Chips'
  },
  {
    id: 'nifty50',
    symbol: '^NSEI',
    name: 'NIFTY 50',
    category: 'EQUITY_INDEX',
    price: 24048.20,
    change: -106.70,
    changePercent: -0.44,
    dayHigh: 24172.85,
    dayLow: 24027.90,
    previousClose: 24154.90,
    currency: 'INR',
    lastUpdated: new Date().toISOString(),
    description: 'NSE Top 50 Benchmark'
  },
  {
    id: 'banknifty',
    symbol: '^NSEBANK',
    name: 'BANK NIFTY',
    category: 'EQUITY_INDEX',
    price: 57111.45,
    change: -150.95,
    changePercent: -0.26,
    dayHigh: 57356.85,
    dayLow: 57001.75,
    previousClose: 57262.40,
    currency: 'INR',
    lastUpdated: new Date().toISOString(),
    description: 'Indian Banking Benchmark'
  },
  {
    id: 'niftymidcap',
    symbol: 'NIFTY_MIDCAP_100.NS',
    name: 'NIFTY MIDCAP',
    category: 'EQUITY_INDEX',
    price: 63404.35,
    change: -135.05,
    changePercent: -0.21,
    dayHigh: 63593.00,
    dayLow: 63198.40,
    previousClose: 63539.40,
    currency: 'INR',
    lastUpdated: new Date().toISOString(),
    description: 'Top 100 Midcap Equities'
  },
  {
    id: 'indiavix',
    symbol: '^INDIAVIX',
    name: 'INDIA VIX',
    category: 'VOLATILITY',
    price: 11.50,
    change: 0.11,
    changePercent: 1.00,
    dayHigh: 11.73,
    dayLow: 10.06,
    previousClose: 11.39,
    currency: 'POINTS',
    lastUpdated: new Date().toISOString(),
    description: 'NSE Volatility & Fear Index'
  },
  {
    id: 'usdinr',
    symbol: 'INR=X',
    name: 'USD / INR',
    category: 'CURRENCY',
    price: 95.74,
    change: 0.07,
    changePercent: 0.07,
    dayHigh: 95.76,
    dayLow: 95.67,
    previousClose: 95.67,
    currency: 'INR',
    lastUpdated: new Date().toISOString(),
    description: 'US Dollar to Indian Rupee'
  }
];

export function useMarketIndices() {
  const [data, setData] = useState<MarketOverviewState>({
    indices: DEFAULT_INDICES,
    isMarketOpen: false,
    marketSession: 'CLOSED',
    marketStatusText: 'BSE & NSE India',
    sessionBadge: 'CLOSED',
    lastRefreshed: Date.now(),
    loading: true
  });

  const prevPricesRef = useRef<Record<string, number>>({});

  const fetchIndices = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setData(prev => ({ ...prev, loading: true }));
    }
    try {
      const res = await customFetch('/api/market/indices');
      if (res.ok) {
        const json = await res.json();
        if (json.indices && Array.isArray(json.indices) && json.indices.length > 0) {
          // Compare with previous price to detect ticks
          const updatedIndices = json.indices.map((item: MarketIndexItem) => {
            const oldPrice = prevPricesRef.current[item.id];
            let tick: 'UP' | 'DOWN' | null = null;
            if (oldPrice !== undefined && oldPrice !== item.price) {
              tick = item.price > oldPrice ? 'UP' : 'DOWN';
            }
            prevPricesRef.current[item.id] = item.price;
            return {
              ...item,
              tick
            };
          });

          setData({
            indices: updatedIndices,
            isMarketOpen: Boolean(json.isMarketOpen),
            marketSession: json.marketSession || 'CLOSED',
            marketStatusText: json.marketStatusText || (json.isMarketOpen ? 'Market Open' : 'Market Closed'),
            sessionBadge: json.sessionBadge || (json.isMarketOpen ? 'MARKET LIVE' : 'CLOSED'),
            lastRefreshed: json.lastRefreshed || Date.now(),
            loading: false
          });

          // Reset tick flash after 2 seconds
          setTimeout(() => {
            setData(prev => ({
              ...prev,
              indices: prev.indices.map(i => ({ ...i, tick: null }))
            }));
          }, 2000);

          return;
        }
      }
    } catch {
      // ignore transient network error
    } finally {
      setData(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    fetchIndices();
  }, [fetchIndices]);

  // Reduced from 15s to 60s smooth live polling with visibility gating
  useVisibilityInterval(() => {
    fetchIndices(true);
  }, 60000);

  return {
    ...data,
    refresh: () => fetchIndices(false)
  };
}
