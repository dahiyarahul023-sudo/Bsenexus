import fs from 'fs';
import path from 'path';
import { getAllStockEntries, getScripCode, resolveStockDetails } from '../utils/stockResolver.js';

let nifty500: any[] = [];
try {
  const primaryPath = path.resolve(process.cwd(), 'server/data/nifty500.json');
  const secondaryPath = path.resolve(process.cwd(), 'data/nifty500.json');

  if (fs.existsSync(primaryPath)) {
    nifty500 = JSON.parse(fs.readFileSync(primaryPath, 'utf8'));
  } else if (fs.existsSync(secondaryPath)) {
    nifty500 = JSON.parse(fs.readFileSync(secondaryPath, 'utf8'));
  }
} catch (e) {
  // Graceful fallback without breaking server startup
}

if (!nifty500 || nifty500.length === 0) {
  // Fallback to stock resolver entries if file is ever missing
  nifty500 = getAllStockEntries().map(s => ({
    symbol: s.symbol,
    name: s.name,
    scripCode: s.scripCode,
    industry: s.sector || 'Equities'
  }));
}

export async function searchCompany(q: string) {
  if (!q || q.length < 2) return [];
  
  const query = q.toLowerCase().trim();
  const resultsMap = new Map<string, { name: string; symbol: string; scripCode: string }>();

  // 1. Search in comprehensive stock resolver database first
  const masterStocks = getAllStockEntries();
  for (const s of masterStocks) {
    if (
      s.symbol.toLowerCase().includes(query) ||
      s.name.toLowerCase().includes(query) ||
      s.scripCode.includes(query)
    ) {
      resultsMap.set(s.symbol, {
        name: s.name,
        symbol: s.symbol,
        scripCode: s.scripCode
      });
      if (resultsMap.size >= 8) break;
    }
  }

  // 2. Search in nifty500 local file
  for (const item of nifty500) {
    if (
      item.name.toLowerCase().includes(query) || 
      item.symbol.toLowerCase().includes(query)
    ) {
      if (!resultsMap.has(item.symbol)) {
        const scrip = getScripCode(item.symbol) || '';
        resultsMap.set(item.symbol, {
          name: item.name,
          symbol: item.symbol,
          scripCode: scrip
        });
      }
    }
  }

  // 3. Fallback online search via Screener
  try {
    const response = await fetch(`https://www.screener.in/api/company/search/?q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      signal: AbortSignal.timeout(4000)
    });
    
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        for (const item of data) {
          const parts = (item.url || '').split('/').filter(Boolean);
          const symbol = (parts[1] || '').toUpperCase().trim();
          if (symbol && !resultsMap.has(symbol)) {
            const scrip = getScripCode(symbol) || (/^\d{6}$/.test(symbol) ? symbol : '');
            resultsMap.set(symbol, {
              name: item.name,
              symbol,
              scripCode: scrip
            });
          }
        }
      }
    }
  } catch (error) {
    console.error("Screener search failed", error);
  }

  const list = Array.from(resultsMap.values());
  return list.slice(0, 15);
}

