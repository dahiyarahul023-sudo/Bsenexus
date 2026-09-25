import React, { useState, useEffect } from 'react';
import { ArrowRight, Building2, Search, ExternalLink, ChevronRight, TrendingUp, ShieldCheck, Zap } from 'lucide-react';
import { SocialIconsRow } from './ui/SocialLinks';

export interface ListedCompany {
  symbol: string;
  scripCode: string;
  name: string;
  sector: string;
  category: string;
  description: string;
  marketCapRank: number;
}

export const BSE_26_COMPANIES: ListedCompany[] = [
  {
    symbol: "RELIANCE",
    scripCode: "500325",
    name: "Reliance Industries Ltd",
    sector: "Energy & Petrochemicals / Conglomerate",
    category: "Mega Cap Leader",
    description: "India's largest listed conglomerate spanning energy, petrochemicals, retail, telecommunications (Jio), and renewable green energy.",
    marketCapRank: 1
  },
  {
    symbol: "TCS",
    scripCode: "532540",
    name: "Tata Consultancy Services Ltd",
    sector: "IT Services & Software",
    category: "Tech Heavyweight",
    description: "Global leader in IT services, digital transformation consulting, cognitive automation, and enterprise cloud infrastructure solutions.",
    marketCapRank: 2
  },
  {
    symbol: "HDFCBANK",
    scripCode: "500180",
    name: "HDFC Bank Ltd",
    sector: "Private Sector Banking & Finance",
    category: "Banking Giant",
    description: "India's largest private sector bank offering comprehensive retail, commercial, corporate banking, and digital transaction services.",
    marketCapRank: 3
  },
  {
    symbol: "INFY",
    scripCode: "500209",
    name: "Infosys Ltd",
    sector: "IT Services & Consulting",
    category: "Tech Heavyweight",
    description: "Pioneer in global information technology services, next-generation cloud migration, enterprise AI engineering, and digital workflows.",
    marketCapRank: 4
  },
  {
    symbol: "ICICIBANK",
    scripCode: "532174",
    name: "ICICI Bank Ltd",
    sector: "Private Sector Banking & Finance",
    category: "Banking Giant",
    description: "Premier Indian multinational banking and financial services institution providing retail mortgages, wealth management, and corporate credit.",
    marketCapRank: 5
  },
  {
    symbol: "SBIN",
    scripCode: "500112",
    name: "State Bank of India",
    sector: "Public Sector Banking",
    category: "PSU Banking Leader",
    description: "India's flagship Fortune 500 public sector bank commanding over 22% domestic deposit market share with widespread global presence.",
    marketCapRank: 6
  },
  {
    symbol: "BHARTIARTL",
    scripCode: "532454",
    name: "Bharti Airtel Ltd",
    sector: "Telecommunications & Digital Services",
    category: "Telecom Leader",
    description: "Leading global telecommunications corporation operating across South Asia and Africa with nationwide 5G, enterprise IoT, and cloud networks.",
    marketCapRank: 7
  },
  {
    symbol: "ITC",
    scripCode: "500875",
    name: "ITC Ltd",
    sector: "Diversified FMCG & Cigarettes",
    category: "FMCG Heavyweight",
    description: "Diversified conglomerate with dominant leadership across branded packaged foods, personal care, luxury hotels, paperboards, and agri-business.",
    marketCapRank: 8
  },
  {
    symbol: "KOTAKBANK",
    scripCode: "500247",
    name: "Kotak Mahindra Bank Ltd",
    sector: "Private Sector Banking & Finance",
    category: "Banking & Wealth",
    description: "Prominent Indian banking and financial conglomerate spanning commercial lending, equity brokerage, insurance, and alternative asset management.",
    marketCapRank: 9
  },
  {
    symbol: "LT",
    scripCode: "500510",
    name: "Larsen & Toubro Ltd",
    sector: "Infrastructure & Heavy Engineering",
    category: "Capex & Infra Titan",
    description: "India's premier multinational engaged in EPC projects, hi-tech manufacturing, defense engineering, power grids, and infrastructure development.",
    marketCapRank: 10
  },
  {
    symbol: "AXISBANK",
    scripCode: "532215",
    name: "Axis Bank Ltd",
    sector: "Private Sector Banking & Finance",
    category: "Banking Giant",
    description: "Third-largest private sector bank in India delivering comprehensive corporate lending, digital retail payments, and treasury solutions.",
    marketCapRank: 11
  },
  {
    symbol: "MARUTI",
    scripCode: "532500",
    name: "Maruti Suzuki India Ltd",
    sector: "Automobile Manufacturing",
    category: "Auto Champion",
    description: "India's undisputed passenger vehicle manufacturer controlling over 40% domestic market share with passenger cars, SUVs, and hybrid mobility.",
    marketCapRank: 12
  },
  {
    symbol: "TITAN",
    scripCode: "500114",
    name: "Titan Company Ltd",
    sector: "Consumer Goods & Jewellery",
    category: "Consumer Discretionary",
    description: "Tata Group luxury retail powerhouse dominating organized jewellery (Tanishq, Mia, CaratLane), watches, precision eyewear, and lifestyle fragrances.",
    marketCapRank: 13
  },
  {
    symbol: "ASIANPAINT",
    scripCode: "500820",
    name: "Asian Paints Ltd",
    sector: "Paints & Home Improvement",
    category: "Consumer & Home Decor",
    description: "India's largest decorative and industrial paint manufacturer with extensive international presence and integrated home decor solutions.",
    marketCapRank: 14
  },
  {
    symbol: "HCLTECH",
    scripCode: "532281",
    name: "HCL Technologies Ltd",
    sector: "IT Services & Software Products",
    category: "Tech Heavyweight",
    description: "Global technology enterprise delivering digital engineering, hybrid cloud platforms, cybersecurity, and enterprise software products.",
    marketCapRank: 15
  },
  {
    symbol: "SUNPHARMA",
    scripCode: "524715",
    name: "Sun Pharmaceutical Industries Ltd",
    sector: "Pharmaceuticals & Healthcare",
    category: "Pharma Champion",
    description: "India's largest pharmaceutical corporation and top global specialty generic manufacturer with strong market share in dermatology and ophthalmology.",
    marketCapRank: 16
  },
  {
    symbol: "TATAMOTORS",
    scripCode: "500570",
    name: "Tata Motors Ltd",
    sector: "Automotive & Commercial Vehicles",
    category: "Mobility & EV Pioneer",
    description: "Multinational automotive corporation leading Indian electric passenger mobility (EVs), commercial freight trucks, and British luxury subsidiary Jaguar Land Rover.",
    marketCapRank: 17
  },
  {
    symbol: "TATASTEEL",
    scripCode: "500470",
    name: "Tata Steel Ltd",
    sector: "Metals & Mining",
    category: "Metals Leader",
    description: "Top global integrated steel manufacturing corporation with crude steel capacity exceeding 35 MTPA across high-efficiency Indian and European mills.",
    marketCapRank: 18
  },
  {
    symbol: "WIPRO",
    scripCode: "507685",
    name: "Wipro Ltd",
    sector: "IT Services & Consulting",
    category: "IT Major",
    description: "Global information technology, enterprise cloud consulting, and business process services company driving AI and digital enterprise workflows.",
    marketCapRank: 19
  },
  {
    symbol: "ULTRACEMCO",
    scripCode: "532538",
    name: "UltraTech Cement Ltd",
    sector: "Cement & Building Materials",
    category: "Materials Champion",
    description: "The flagship cement company of Aditya Birla Group and India's largest manufacturer of grey cement, ready-mix concrete, and white cement.",
    marketCapRank: 20
  },
  {
    symbol: "NTPC",
    scripCode: "532555",
    name: "NTPC Ltd",
    sector: "Power Generation & Utilities",
    category: "Energy & Utilities",
    description: "India's largest integrated energy conglomerate generating over 24% of national electricity with rapid expansion into solar, wind, and green hydrogen.",
    marketCapRank: 21
  },
  {
    symbol: "POWERGRID",
    scripCode: "532898",
    name: "Power Grid Corporation of India Ltd",
    sector: "Power Transmission",
    category: "Infrastructure Monopoly",
    description: "Central Transmission Utility of India wheeling approximately 85% of total domestic inter-regional electricity through high-voltage transmission grids.",
    marketCapRank: 22
  },
  {
    symbol: "ONGC",
    scripCode: "500312",
    name: "Oil & Natural Gas Corporation Ltd",
    sector: "Oil & Gas Exploration",
    category: "Energy & Resources",
    description: "India's premier public sector enterprise contributing around 71% to domestic crude oil production and 84% of natural gas output.",
    marketCapRank: 23
  },
  {
    symbol: "COALINDIA",
    scripCode: "533278",
    name: "Coal India Ltd",
    sector: "Mining & Energy Resources",
    category: "Energy Security Titan",
    description: "The world's largest coal-producing corporation supplying key fuel feedstock to Indian thermal power generation and heavy metallurgical plants.",
    marketCapRank: 24
  },
  {
    symbol: "BAJFINANCE",
    scripCode: "500034",
    name: "Bajaj Finance Ltd",
    sector: "Non-Banking Financials (NBFC)",
    category: "Consumer Finance Star",
    description: "India's largest diversified non-banking financial company specializing in consumer durable financing, MSME lending, wealth management, and credit cards.",
    marketCapRank: 25
  },
  {
    symbol: "TRENT",
    scripCode: "500251",
    name: "Trent Ltd",
    sector: "Retail & Fashion Apparel",
    category: "Fast Fashion Powerhouse",
    description: "Fast-growing Tata Group retail powerhouse operating leading lifestyle and value apparel chains Westside, Zudio, and Star Bazaar food hypermarkets.",
    marketCapRank: 26
  }
];

interface CompaniesPageProps {
  onEnterTerminal: (tab?: string) => void;
}

export const CompaniesPage: React.FC<CompaniesPageProps> = ({ onEnterTerminal }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');

  useEffect(() => {
    document.title = 'BSE Listed Companies — Company Profiles, Results & Filings | BSE Nexus';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', 'Explore all 26 premier BSE listed companies on BSE Nexus. Access live corporate announcements, quarterly earnings results, SEBI LODR disclosures, and AI intelligence.');
    }
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', 'https://bsenexus.in/companies');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const sectors = ['ALL', ...Array.from(new Set(BSE_26_COMPANIES.map(c => c.sector.split(' / ')[0].split(' & ')[0])))];

  const filteredCompanies = BSE_26_COMPANIES.filter((company) => {
    const matchesSearch = 
      company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.scripCode.includes(searchTerm) ||
      company.sector.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSector = 
      selectedSector === 'ALL' || 
      company.sector.toLowerCase().includes(selectedSector.toLowerCase());

    return matchesSearch && matchesSector;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F17] text-slate-900 dark:text-white flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#0F172A]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <a 
              href="/" 
              onClick={(e) => {
                e.preventDefault();
                onEnterTerminal('home');
              }}
              className="flex items-center gap-2 group text-decoration-none"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-black text-sm shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform">
                N
              </div>
              <span className="font-black text-lg tracking-tight text-slate-900 dark:text-white">
                BSE<span className="text-emerald-500">NEXUS</span>
              </span>
            </a>

            <nav className="hidden md:flex items-center gap-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <a href="/announcements" onClick={(e) => { e.preventDefault(); onEnterTerminal('dashboard'); }} className="hover:text-emerald-500 transition-colors">Filings</a>
              <a href="/results-calendar" onClick={(e) => { e.preventDefault(); onEnterTerminal('results-calendar'); }} className="hover:text-emerald-500 transition-colors">Results Calendar</a>
              <a href="/companies" className="text-emerald-600 dark:text-emerald-400 font-bold">Companies</a>
              <a href="/guides" className="hover:text-emerald-500 transition-colors">Guides</a>
              <a href="/pricing" className="hover:text-emerald-500 transition-colors">Pricing</a>
              <a href="/faq" className="hover:text-emerald-500 transition-colors">FAQ</a>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onEnterTerminal('dashboard')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-lg transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-white" />
              <span>Launch Terminal</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Breadcrumb Bar */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-4">
          <a 
            href="/" 
            onClick={(e) => {
              e.preventDefault();
              onEnterTerminal('home');
            }} 
            className="hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            Home
          </a>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span className="font-semibold text-slate-800 dark:text-slate-200">Companies Directory</span>
        </div>

        {/* Page Hero Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold mb-3">
            <Building2 className="w-3.5 h-3.5" />
            <span>26 PREMIER BSE BLUECHIPS &amp; HEAVYWEIGHTS</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            BSE Listed Companies — Profiles, Earnings Results &amp; Regulatory Filings
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
            Direct access to dedicated company intelligence hubs for India's 26 leading listed equities. Track real-time Bombay Stock Exchange (BSE) regulatory disclosures, quarterly earnings metrics, investor presentations, and SEBI LODR corporate actions.
          </p>
        </div>

        {/* Search & Filter Control Bar */}
        <div className="bg-white dark:bg-[#111625] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 mb-8 shadow-xs">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by company name, ticker (e.g. RELIANCE, TCS), scrip code, or sector..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#161D31] border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Sector Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">Sector:</span>
            {sectors.map((sec) => (
              <button
                key={sec}
                onClick={() => setSelectedSector(sec)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedSector === sec
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {sec === 'ALL' ? 'All Sectors (26)' : sec}
              </button>
            ))}
          </div>
        </div>

        {/* Companies List Grid / Table Rows */}
        <div className="space-y-3">
          <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-2.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            <div className="col-span-4">Company &amp; Ticker</div>
            <div className="col-span-3">Primary Sector</div>
            <div className="col-span-4">Business Profile &amp; Core Operations</div>
            <div className="col-span-1 text-right">Dossier</div>
          </div>

          {filteredCompanies.map((company) => (
            <a
              key={company.symbol}
              href={`/company/${company.symbol}`}
              className="group block bg-white dark:bg-[#111625] hover:bg-emerald-50/40 dark:hover:bg-[#151D2F] border border-slate-200 dark:border-slate-800/90 hover:border-emerald-500/50 dark:hover:border-emerald-500/40 rounded-xl p-4 sm:p-5 transition-all duration-150 shadow-xs hover:shadow-md"
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-center">
                
                {/* Company Name & Ticker */}
                <div className="md:col-span-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center font-mono font-black text-xs text-emerald-600 dark:text-emerald-400 shrink-0 group-hover:scale-105 group-hover:bg-emerald-500/10 transition-transform">
                    {company.symbol.substring(0, 3)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {company.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 font-mono text-xs">
                      <span className="font-extrabold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {company.symbol}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        BSE: {company.scripCode}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sector & Category */}
                <div className="md:col-span-3">
                  <span className="inline-block text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/60 px-2.5 py-1 rounded-md">
                    {company.sector}
                  </span>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                    {company.category}
                  </div>
                </div>

                {/* Business Profile Description */}
                <div className="md:col-span-4 text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {company.description}
                </div>

                {/* Direct Action Link */}
                <div className="md:col-span-1 flex items-center justify-end">
                  <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform">
                    <span className="hidden md:inline">View</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>

              </div>
            </a>
          ))}

          {filteredCompanies.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-[#111625] rounded-2xl border border-slate-200 dark:border-slate-800">
              <Building2 className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <div className="text-base font-bold text-slate-800 dark:text-slate-200">No companies found matching "{searchTerm}"</div>
              <p className="text-xs text-slate-500 mt-1">Try searching for tickers like RELIANCE, TCS, INFY, SBIN, or sectors like Banking, IT, Auto.</p>
            </div>
          )}
        </div>

        {/* Feature Bottom Callout */}
        <div className="mt-12 bg-linear-to-br from-emerald-950/40 via-[#0F172A] to-slate-900 border border-emerald-800/40 rounded-2xl p-6 sm:p-8 text-white">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-mono font-bold text-emerald-400 uppercase">
                <TrendingUp className="w-4 h-4" />
                <span>Instant Regulatory Ingestion</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                Track Live BSE Disclosures for All 26 Bluechips
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                Receive instant sub-minute Telegram alerts with AI-powered financial metric extraction whenever any of these companies files a board meeting outcome, quarterly financial result, or material event with the Bombay Stock Exchange.
              </p>
            </div>
            <button
              onClick={() => onEnterTerminal('dashboard')}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Open Live Ingestion Stream</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>

      {/* Global Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px]">N</div>
            <span className="font-bold text-slate-800 dark:text-slate-200">BSE Nexus</span>
            <span>&copy; {new Date().getFullYear()} — India's Premier Corporate Disclosures Intelligence Platform</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-medium">
            <a href="/" onClick={(e) => { e.preventDefault(); onEnterTerminal('home'); }} className="hover:text-emerald-500">Home</a>
            <a href="/announcements" onClick={(e) => { e.preventDefault(); onEnterTerminal('dashboard'); }} className="hover:text-emerald-500">Announcements</a>
            <a href="/results-calendar" onClick={(e) => { e.preventDefault(); onEnterTerminal('results-calendar'); }} className="hover:text-emerald-500">Results Calendar</a>
            <a href="/companies" className="text-emerald-600 dark:text-emerald-400 font-bold">Companies</a>
            <a href="/guides" className="hover:text-emerald-500">Guides</a>
            <a href="/about" className="hover:text-emerald-500">About</a>
            <a href="/contact" className="hover:text-emerald-500">Contact</a>
            <a href="/disclaimer" className="hover:text-emerald-500">Disclaimer</a>
            <a href="/privacy-policy" className="hover:text-emerald-500">Privacy</a>
            <a href="/terms" className="hover:text-emerald-500">Terms</a>
            <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-500">Sitemap</a>
          </div>
        </div>
        <div className="mt-4 flex justify-center">
          <SocialIconsRow size={18} />
        </div>
      </footer>
    </div>
  );
};
