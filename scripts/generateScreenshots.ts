import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const SCREENSHOTS_DIR = path.join(PUBLIC_DIR, 'screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// 1. Desktop Screenshot SVG (1280x720)
function getDesktopSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0B0F19" />
        <stop offset="100%" stop-color="#111827" />
      </linearGradient>
      <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#1E293B" stop-opacity="0.8" />
        <stop offset="100%" stop-color="#0F172A" stop-opacity="0.9" />
      </linearGradient>
      <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#3B82F6" />
        <stop offset="100%" stop-color="#8B5CF6" />
      </linearGradient>
      <filter id="cardShadow" x="-5%" y="-5%" width="110%" height="115%">
        <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000000" flood-opacity="0.4" />
      </filter>
    </defs>

    <!-- Canvas Background -->
    <rect width="1280" height="720" fill="url(#bgGrad)" />

    <!-- Top Navigation Bar -->
    <rect width="1280" height="64" fill="#0B0F19" fill-opacity="0.95" />
    <line x1="0" y1="64" x2="1280" y2="64" stroke="#1E293B" stroke-width="1" />

    <!-- Brand Logo & Name -->
    <rect x="24" y="16" width="32" height="32" rx="8" fill="url(#accentGrad)" />
    <!-- Logo Symbol -->
    <circle cx="40" cy="26" r="3" fill="#FFFFFF" />
    <path d="M 33 38 L 40 31 L 47 38" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" fill="none" />
    
    <text x="66" y="38" fill="#F8FAFC" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="700" letter-spacing="-0.5">BSE Nexus</text>
    <rect x="156" y="22" width="68" height="20" rx="4" fill="#1E293B" />
    <text x="165" y="36" fill="#38BDF8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600">TERMINAL</text>

    <!-- Navigation Pills -->
    <rect x="250" y="18" width="130" height="30" rx="6" fill="#3B82F6" fill-opacity="0.15" stroke="#3B82F6" stroke-width="1" />
    <text x="268" y="38" fill="#60A5FA" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600">Disclosures Feed</text>

    <text x="410" y="38" fill="#94A3B8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500">Earnings Calendar</text>
    <text x="550" y="38" fill="#94A3B8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500">Watchlist</text>
    <text x="640" y="38" fill="#94A3B8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500">Telegram Alerts</text>

    <!-- Market Status Right -->
    <rect x="1080" y="18" width="176" height="30" rx="6" fill="#10B981" fill-opacity="0.12" stroke="#10B981" stroke-width="1" />
    <circle cx="1096" cy="33" r="4" fill="#10B981" />
    <text x="1108" y="38" fill="#34D399" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600">BSE Market OPEN</text>

    <!-- Sub-header Stats Bar -->
    <rect x="24" y="80" width="1232" height="60" rx="10" fill="#131B2E" stroke="#1E293B" stroke-width="1" />
    <text x="48" y="105" fill="#64748B" font-family="sans-serif" font-size="11" font-weight="600" letter-spacing="0.5">SENSEX</text>
    <text x="48" y="126" fill="#F8FAFC" font-family="'JetBrains Mono', monospace" font-size="16" font-weight="700">82,450.10</text>
    <text x="145" y="126" fill="#10B981" font-family="'JetBrains Mono', monospace" font-size="13" font-weight="600">+420.35 (+0.51%)</text>

    <line x1="280" y1="92" x2="280" y2="128" stroke="#1E293B" stroke-width="1" />

    <text x="310" y="105" fill="#64748B" font-family="sans-serif" font-size="11" font-weight="600" letter-spacing="0.5">DISCLOSURES TODAY</text>
    <text x="310" y="126" fill="#F8FAFC" font-family="'JetBrains Mono', monospace" font-size="16" font-weight="700">248 Filings</text>
    <text x="415" y="126" fill="#38BDF8" font-family="sans-serif" font-size="12" font-weight="500">Live Polling (30s)</text>

    <line x1="560" y1="92" x2="560" y2="128" stroke="#1E293B" stroke-width="1" />

    <text x="590" y="105" fill="#64748B" font-family="sans-serif" font-size="11" font-weight="600" letter-spacing="0.5">GEMINI AI REVENUE SYNTHESIS</text>
    <text x="590" y="126" fill="#A855F7" font-family="sans-serif" font-size="14" font-weight="600">Active - Instant YoY/QoQ Extraction</text>

    <!-- Main Content Area: Left Feed (780px), Right AI Insights (430px) -->
    <!-- Card 1: Reliance Industries -->
    <g filter="url(#cardShadow)">
      <rect x="24" y="156" width="770" height="165" rx="10" fill="url(#cardGrad)" stroke="#1E293B" stroke-width="1" />
      <rect x="42" y="174" width="85" height="24" rx="4" fill="#1E293B" />
      <text x="50" y="190" fill="#60A5FA" font-family="sans-serif" font-size="12" font-weight="700">RELIANCE</text>
      <text x="135" y="190" fill="#94A3B8" font-family="sans-serif" font-size="12">500325 • Financial Results</text>
      <rect x="680" y="174" width="95" height="24" rx="4" fill="#065F46" />
      <text x="692" y="190" fill="#34D399" font-family="sans-serif" font-size="11" font-weight="600">AI VERIFIED</text>
      
      <text x="42" y="222" fill="#F8FAFC" font-family="sans-serif" font-size="16" font-weight="600">Unaudited Financial Results for Quarter Ended June 30, 2026</text>
      <text x="42" y="246" fill="#94A3B8" font-family="sans-serif" font-size="13">Consolidated Net Profit up 12.4% YoY to ₹19,820 Cr. EBITDA margin expands 80 bps led by Jio &amp; Retail segments.</text>

      <rect x="42" y="266" width="130" height="24" rx="4" fill="#1E293B" />
      <text x="52" y="282" fill="#38BDF8" font-family="sans-serif" font-size="11">PDF Announcement (4.2 MB)</text>
      <text x="680" y="282" fill="#64748B" font-family="sans-serif" font-size="12">2 mins ago</text>
    </g>

    <!-- Card 2: Tata Consultancy Services -->
    <g filter="url(#cardShadow)">
      <rect x="24" y="335" width="770" height="165" rx="10" fill="url(#cardGrad)" stroke="#1E293B" stroke-width="1" />
      <rect x="42" y="353" width="55" height="24" rx="4" fill="#1E293B" />
      <text x="50" y="369" fill="#60A5FA" font-family="sans-serif" font-size="12" font-weight="700">TCS</text>
      <text x="105" y="369" fill="#94A3B8" font-family="sans-serif" font-size="12">532540 • Board Meeting Outcome</text>
      <rect x="680" y="353" width="95" height="24" rx="4" fill="#1E293B" />
      <text x="695" y="369" fill="#94A3B8" font-family="sans-serif" font-size="11" font-weight="600">DIVIDEND</text>
      
      <text x="42" y="401" fill="#F8FAFC" font-family="sans-serif" font-size="16" font-weight="600">Interim Dividend of ₹28 per equity share declared; Record date Sept 18</text>
      <text x="42" y="425" fill="#94A3B8" font-family="sans-serif" font-size="13">Board approves interim dividend along with record order book TCV of $10.2B in cloud &amp; enterprise AI transformation.</text>

      <rect x="42" y="445" width="140" height="24" rx="4" fill="#1E293B" />
      <text x="52" y="461" fill="#38BDF8" font-family="sans-serif" font-size="11">BSE Filing Document (1.1 MB)</text>
      <text x="680" y="461" fill="#64748B" font-family="sans-serif" font-size="12">14 mins ago</text>
    </g>

    <!-- Card 3: Infosys -->
    <g filter="url(#cardShadow)">
      <rect x="24" y="514" width="770" height="165" rx="10" fill="url(#cardGrad)" stroke="#1E293B" stroke-width="1" />
      <rect x="42" y="532" width="60" height="24" rx="4" fill="#1E293B" />
      <text x="50" y="548" fill="#60A5FA" font-family="sans-serif" font-size="12" font-weight="700">INFY</text>
      <text x="110" y="548" fill="#94A3B8" font-family="sans-serif" font-size="12">500209 • Acquisition &amp; Strategic Partnership</text>
      
      <text x="42" y="580" fill="#F8FAFC" font-family="sans-serif" font-size="16" font-weight="600">Acquisition of Leading European Cloud Engineering Firm for €180M</text>
      <text x="42" y="604" fill="#94A3B8" font-family="sans-serif" font-size="13">Expands digital delivery presence across DACH region with 600+ specialized automotive and manufacturing software engineers.</text>

      <rect x="42" y="624" width="120" height="24" rx="4" fill="#1E293B" />
      <text x="52" y="640" fill="#38BDF8" font-family="sans-serif" font-size="11">Press Release &amp; Deck</text>
      <text x="680" y="640" fill="#64748B" font-family="sans-serif" font-size="12">28 mins ago</text>
    </g>

    <!-- Right Column: AI Analysis & Watchlist Panel -->
    <g filter="url(#cardShadow)">
      <rect x="814" y="156" width="442" height="523" rx="10" fill="url(#cardGrad)" stroke="#1E293B" stroke-width="1" />
      <rect x="830" y="174" width="140" height="26" rx="6" fill="#8B5CF6" fill-opacity="0.15" stroke="#8B5CF6" stroke-width="1" />
      <text x="842" y="191" fill="#C084FC" font-family="sans-serif" font-size="12" font-weight="700">⚡ GEMINI AI SYNTHESIS</text>

      <text x="830" y="230" fill="#F8FAFC" font-family="sans-serif" font-size="17" font-weight="700">Key Corporate Insights</text>
      
      <!-- Bullet 1 -->
      <circle cx="838" cy="260" r="4" fill="#3B82F6" />
      <text x="852" y="264" fill="#E2E8F0" font-family="sans-serif" font-size="13" font-weight="600">Earnings Momentum Strong</text>
      <text x="852" y="284" fill="#94A3B8" font-family="sans-serif" font-size="12">Top 50 Nifty/BSE leaders reporting average 11.8% YoY profit expansion.</text>

      <!-- Bullet 2 -->
      <circle cx="838" cy="324" r="4" fill="#10B981" />
      <text x="852" y="328" fill="#E2E8F0" font-family="sans-serif" font-size="13" font-weight="600">Capex &amp; Order Inflows</text>
      <text x="852" y="348" fill="#94A3B8" font-family="sans-serif" font-size="12">Infrastructure &amp; Capital goods companies reporting 22% jump in order backlogs.</text>

      <!-- Bullet 3 -->
      <circle cx="838" cy="388" r="4" fill="#F59E0B" />
      <text x="852" y="392" fill="#E2E8F0" font-family="sans-serif" font-size="13" font-weight="600">Dividend Yield Highlights</text>
      <text x="852" y="412" fill="#94A3B8" font-family="sans-serif" font-size="12">IT sector leading board dividend declarations this week with above-average payout ratios.</text>

      <line x1="830" y1="440" x2="1236" y2="440" stroke="#1E293B" stroke-width="1" />

      <!-- Telegram Integration Widget -->
      <text x="830" y="470" fill="#F8FAFC" font-family="sans-serif" font-size="15" font-weight="700">Instant Alert Channels</text>
      <rect x="830" y="488" width="410" height="50" rx="8" fill="#131B2E" stroke="#1E293B" stroke-width="1" />
      <circle cx="854" cy="513" r="12" fill="#229ED9" />
      <path d="M 848 513 L 858 509 L 855 518 L 852 515 Z" fill="#FFFFFF" />
      <text x="876" y="512" fill="#F8FAFC" font-family="sans-serif" font-size="13" font-weight="600">Telegram Bot Notifications Active</text>
      <text x="876" y="528" fill="#64748B" font-family="sans-serif" font-size="11">Pushing alerts within 1.2 seconds of exchange publication</text>

      <!-- PWA Status -->
      <rect x="830" y="550" width="410" height="50" rx="8" fill="#131B2E" stroke="#1E293B" stroke-width="1" />
      <text x="846" y="574" fill="#F8FAFC" font-family="sans-serif" font-size="13" font-weight="600">Offline PWA Sync Enabled</text>
      <text x="846" y="590" fill="#10B981" font-family="sans-serif" font-size="11">Cached disclosures available without internet connectivity</text>
    </g>
  </svg>`;
}

// 2. Mobile Screenshot SVG (750x1334)
function getMobileSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 750 1334" width="750" height="1334">
    <defs>
      <linearGradient id="mBgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#0B0F19" />
        <stop offset="100%" stop-color="#111827" />
      </linearGradient>
      <linearGradient id="mCardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#1E293B" stop-opacity="0.9" />
        <stop offset="100%" stop-color="#0F172A" stop-opacity="0.95" />
      </linearGradient>
      <linearGradient id="mAccentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#3B82F6" />
        <stop offset="100%" stop-color="#8B5CF6" />
      </linearGradient>
      <filter id="mCardShadow" x="-5%" y="-5%" width="110%" height="115%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.5" />
      </filter>
    </defs>

    <!-- Canvas -->
    <rect width="750" height="1334" fill="url(#mBgGrad)" />

    <!-- Mobile Status Bar Mock -->
    <text x="36" y="38" fill="#F8FAFC" font-family="sans-serif" font-size="16" font-weight="600">9:41</text>
    <circle cx="700" cy="32" r="4" fill="#F8FAFC" />
    <rect x="670" y="26" width="18" height="12" rx="3" fill="#F8FAFC" />

    <!-- Mobile Header -->
    <rect x="0" y="55" width="750" height="70" fill="#0B0F19" />
    <line x1="0" y1="125" x2="750" y2="125" stroke="#1E293B" stroke-width="1" />

    <rect x="24" y="70" width="40" height="40" rx="10" fill="url(#mAccentGrad)" />
    <!-- Logo Symbol -->
    <circle cx="44" cy="83" r="3.5" fill="#FFFFFF" />
    <path d="M 36 98 L 44 89 L 52 98" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" fill="none" />

    <text x="76" y="96" fill="#F8FAFC" font-family="-apple-system, sans-serif" font-size="22" font-weight="800">BSE Nexus</text>
    <rect x="200" y="77" width="70" height="24" rx="5" fill="#1E293B" />
    <text x="212" y="93" fill="#38BDF8" font-family="sans-serif" font-size="12" font-weight="700">LIVE</text>

    <!-- Market Badge -->
    <rect x="580" y="75" width="145" height="30" rx="15" fill="#10B981" fill-opacity="0.15" stroke="#10B981" stroke-width="1" />
    <circle cx="598" cy="90" r="4" fill="#10B981" />
    <text x="612" y="95" fill="#34D399" font-family="sans-serif" font-size="13" font-weight="600">BSE OPEN</text>

    <!-- Market Overview Banner -->
    <rect x="24" y="145" width="702" height="85" rx="14" fill="#131B2E" stroke="#1E293B" stroke-width="1" />
    <text x="44" y="175" fill="#64748B" font-family="sans-serif" font-size="12" font-weight="600">SENSEX</text>
    <text x="44" y="208" fill="#F8FAFC" font-family="'JetBrains Mono', monospace" font-size="22" font-weight="800">82,450.10</text>
    <text x="180" y="208" fill="#10B981" font-family="'JetBrains Mono', monospace" font-size="16" font-weight="600">+420.35 (+0.51%)</text>

    <text x="520" y="175" fill="#64748B" font-family="sans-serif" font-size="12" font-weight="600">FILINGS TODAY</text>
    <text x="520" y="208" fill="#38BDF8" font-family="'JetBrains Mono', monospace" font-size="22" font-weight="800">248</text>

    <!-- Filter Tabs -->
    <rect x="24" y="248" width="140" height="36" rx="18" fill="#3B82F6" />
    <text x="48" y="271" fill="#FFFFFF" font-family="sans-serif" font-size="14" font-weight="600">All Filings (248)</text>

    <rect x="175" y="248" width="130" height="36" rx="18" fill="#1E293B" />
    <text x="195" y="271" fill="#94A3B8" font-family="sans-serif" font-size="14" font-weight="500">Financial Results</text>

    <rect x="315" y="248" width="105" height="36" rx="18" fill="#1E293B" />
    <text x="333" y="271" fill="#94A3B8" font-family="sans-serif" font-size="14" font-weight="500">Dividends</text>

    <rect x="430" y="248" width="115" height="36" rx="18" fill="#1E293B" />
    <text x="448" y="271" fill="#94A3B8" font-family="sans-serif" font-size="14" font-weight="500">Board Meets</text>

    <!-- Mobile Feed Card 1: Reliance -->
    <g filter="url(#mCardShadow)">
      <rect x="24" y="305" width="702" height="230" rx="14" fill="url(#mCardGrad)" stroke="#1E293B" stroke-width="1" />
      <rect x="44" y="325" width="95" height="28" rx="6" fill="#1E293B" />
      <text x="54" y="344" fill="#60A5FA" font-family="sans-serif" font-size="14" font-weight="700">RELIANCE</text>
      <text x="150" y="344" fill="#94A3B8" font-family="sans-serif" font-size="13">500325 • Results</text>
      <rect x="580" y="325" width="125" height="28" rx="6" fill="#065F46" />
      <text x="594" y="344" fill="#34D399" font-family="sans-serif" font-size="12" font-weight="600">AI EXTRACTED</text>
      
      <text x="44" y="385" fill="#F8FAFC" font-family="sans-serif" font-size="18" font-weight="700">Q1 FY27 Net Profit Rises 12.4% YoY</text>
      <text x="44" y="415" fill="#94A3B8" font-family="sans-serif" font-size="14">Consolidated Net Profit reaches ₹19,820 Cr. EBITDA margin expands 80 bps led by Jio &amp; Retail segments.</text>

      <rect x="44" y="470" width="180" height="32" rx="6" fill="#1E293B" />
      <text x="58" y="491" fill="#38BDF8" font-family="sans-serif" font-size="13" font-weight="600">View Filing PDF (4.2 MB)</text>
      <text x="610" y="491" fill="#64748B" font-family="sans-serif" font-size="13">2 mins ago</text>
    </g>

    <!-- Mobile Feed Card 2: TCS -->
    <g filter="url(#mCardShadow)">
      <rect x="24" y="555" width="702" height="230" rx="14" fill="url(#mCardGrad)" stroke="#1E293B" stroke-width="1" />
      <rect x="44" y="575" width="65" height="28" rx="6" fill="#1E293B" />
      <text x="54" y="594" fill="#60A5FA" font-family="sans-serif" font-size="14" font-weight="700">TCS</text>
      <text x="120" y="594" fill="#94A3B8" font-family="sans-serif" font-size="13">532540 • Dividend</text>
      <rect x="580" y="575" width="125" height="28" rx="6" fill="#1E293B" />
      <text x="598" y="594" fill="#F59E0B" font-family="sans-serif" font-size="12" font-weight="600">DIVIDEND ₹28</text>
      
      <text x="44" y="635" fill="#F8FAFC" font-family="sans-serif" font-size="18" font-weight="700">Interim Dividend Declared &amp; Record Date</text>
      <text x="44" y="665" fill="#94A3B8" font-family="sans-serif" font-size="14">Board approves interim dividend of ₹28 per share with record date September 18 along with $10.2B order book.</text>

      <rect x="44" y="720" width="180" height="32" rx="6" fill="#1E293B" />
      <text x="58" y="741" fill="#38BDF8" font-family="sans-serif" font-size="13" font-weight="600">View Filing PDF (1.1 MB)</text>
      <text x="600" y="741" fill="#64748B" font-family="sans-serif" font-size="13">14 mins ago</text>
    </g>

    <!-- Mobile Feed Card 3: Infosys -->
    <g filter="url(#mCardShadow)">
      <rect x="24" y="805" width="702" height="230" rx="14" fill="url(#mCardGrad)" stroke="#1E293B" stroke-width="1" />
      <rect x="44" y="825" width="70" height="28" rx="6" fill="#1E293B" />
      <text x="54" y="844" fill="#60A5FA" font-family="sans-serif" font-size="14" font-weight="700">INFY</text>
      <text x="125" y="844" fill="#94A3B8" font-family="sans-serif" font-size="13">500209 • Acquisition</text>
      
      <text x="44" y="885" fill="#F8FAFC" font-family="sans-serif" font-size="18" font-weight="700">Acquisition of Cloud Engineering Firm (€180M)</text>
      <text x="44" y="915" fill="#94A3B8" font-family="sans-serif" font-size="14">Expands enterprise cloud and automotive digital engineering capabilities with 600+ engineers in Europe.</text>

      <rect x="44" y="970" width="180" height="32" rx="6" fill="#1E293B" />
      <text x="58" y="991" fill="#38BDF8" font-family="sans-serif" font-size="13" font-weight="600">Exchange Annexure</text>
      <text x="600" y="991" fill="#64748B" font-family="sans-serif" font-size="13">28 mins ago</text>
    </g>

    <!-- Mobile Bottom Navigation Bar (Dock) -->
    <rect x="0" y="1244" width="750" height="90" fill="#0B0F19" />
    <line x1="0" y1="1244" x2="750" y2="1244" stroke="#1E293B" stroke-width="1" />

    <!-- Tab 1: Filings Active -->
    <circle cx="100" cy="1275" r="4" fill="#3B82F6" />
    <text x="80" y="1305" fill="#3B82F6" font-family="sans-serif" font-size="12" font-weight="700">Filings</text>

    <!-- Tab 2: Calendar -->
    <text x="250" y="1305" fill="#64748B" font-family="sans-serif" font-size="12" font-weight="500">Calendar</text>

    <!-- Tab 3: Watchlist -->
    <text x="430" y="1305" fill="#64748B" font-family="sans-serif" font-size="12" font-weight="500">Watchlist</text>

    <!-- Tab 4: Alerts -->
    <text x="610" y="1305" fill="#64748B" font-family="sans-serif" font-size="12" font-weight="500">Alerts</text>
  </svg>`;
}

async function run() {
  console.log('Generating Desktop & Mobile Screenshots for PWA Manifest...');
  const desktopSvg = Buffer.from(getDesktopSvg());
  const mobileSvg = Buffer.from(getMobileSvg());

  await sharp(desktopSvg)
    .resize(1280, 720)
    .png({ palette: false, quality: 100, compressionLevel: 6 })
    .toFile(path.join(SCREENSHOTS_DIR, 'desktop.png'));
  console.log('✓ Created public/screenshots/desktop.png (1280x720)');

  await sharp(mobileSvg)
    .resize(750, 1334)
    .png({ palette: false, quality: 100, compressionLevel: 6 })
    .toFile(path.join(SCREENSHOTS_DIR, 'mobile.png'));
  console.log('✓ Created public/screenshots/mobile.png (750x1334)');

  console.log('Screenshots generated successfully!');
}

run().catch(console.error);
