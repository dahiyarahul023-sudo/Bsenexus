import fs from 'fs';
import path from 'path';

export interface StockMasterEntry {
  symbol: string;
  scripCode: string;
  name: string;
  nameKeywords: string[];
  sector?: string;
}

const CACHE_FILE = path.resolve(process.cwd(), 'server/data/resolvedStocks.json');

// In-memory lookup tables
const symbolToEntry = new Map<string, StockMasterEntry>();
const scripToEntry = new Map<string, StockMasterEntry>();
const nameToEntry = new Map<string, StockMasterEntry>();

// Load persistent disk cache
function loadDiskCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf8');
      const list: StockMasterEntry[] = JSON.parse(raw);
      if (Array.isArray(list)) {
        for (const item of list) {
          registerStockEntry(item, false);
        }
      }
    }
  } catch (e) {
    console.warn("Could not load resolvedStocks.json cache:", e);
  }
}

// Save in-memory entries to disk
let saveTimeout: any = null;
function persistDiskCache() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const allEntries = Array.from(symbolToEntry.values());
      fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
      fs.writeFileSync(CACHE_FILE, JSON.stringify(allEntries, null, 2), 'utf8');
    } catch (e) {
      console.warn("Could not write resolvedStocks.json:", e);
    }
  }, 1000);
}

export function registerStockEntry(entry: StockMasterEntry, saveToDisk = false) {
  if (!entry || !entry.symbol) return;
  const sym = entry.symbol.toUpperCase().trim();
  const scrip = String(entry.scripCode || '').trim();
  const name = (entry.name || sym).toUpperCase().trim();
  
  // Protect core established stocks from accidental overwriting by ambiguous dynamic searches
  const existingSym = symbolToEntry.get(sym);
  if (existingSym && existingSym.scripCode && /^\d{6}$/.test(existingSym.scripCode)) {
    if (!scrip || !/^\d{6}$/.test(scrip)) {
      return; // Never overwrite a verified master entry with an unverified entry
    }
  }

  const keywords = Array.from(new Set([
    sym,
    name,
    ...(entry.nameKeywords || []).map(k => k.toUpperCase().trim())
  ])).filter(Boolean);

  const cleanEntry: StockMasterEntry = {
    symbol: sym,
    scripCode: scrip,
    name: entry.name || sym,
    nameKeywords: keywords,
    sector: entry.sector
  };

  symbolToEntry.set(sym, cleanEntry);
  symbolToEntry.set(sym.replace(/[\s-]/g, ''), cleanEntry);

  if (scrip && /^\d{6}$/.test(scrip)) {
    scripToEntry.set(scrip, cleanEntry);
  }

  nameToEntry.set(name, cleanEntry);
  nameToEntry.set(name.replace(/[^A-Z0-9]/g, ''), cleanEntry);

  for (const kw of keywords) {
    const cleanKw = kw.replace(/[^A-Z0-9]/g, '');
    if (cleanKw.length >= 3 && !nameToEntry.has(cleanKw)) {
      nameToEntry.set(cleanKw, cleanEntry);
    }
  }

  // Only persist to disk if both symbol and 6-digit scrip code are strictly valid
  if (saveToDisk && scrip && /^\d{6}$/.test(scrip) && /^[A-Z0-9-]{2,15}$/.test(sym)) {
    persistDiskCache();
  }
}

// Initial Core Indian Stocks (Comprehensive Nifty 500 & Popular Equities)
const INITIAL_STOCKS: StockMasterEntry[] = [
  // Nifty 50 & Heavyweights
  { symbol: "RELIANCE", scripCode: "500325", name: "Reliance Industries Ltd", nameKeywords: ["RELIANCE INDUSTRIES", "RELIANCE IND", "RIL"] },
  { symbol: "TCS", scripCode: "532540", name: "Tata Consultancy Services Ltd", nameKeywords: ["TATA CONSULTANCY", "TCS"] },
  { symbol: "HDFCBANK", scripCode: "500180", name: "HDFC Bank Ltd", nameKeywords: ["HDFC BANK"] },
  { symbol: "ICICIBANK", scripCode: "532174", name: "ICICI Bank Ltd", nameKeywords: ["ICICI BANK"] },
  { symbol: "INFY", scripCode: "500209", name: "Infosys Ltd", nameKeywords: ["INFOSYS"] },
  { symbol: "BHARTIARTL", scripCode: "532454", name: "Bharti Airtel Ltd", nameKeywords: ["BHARTI AIRTEL", "AIRTEL"] },
  { symbol: "SBIN", scripCode: "500112", name: "State Bank of India", nameKeywords: ["STATE BANK OF INDIA", "STATE BANK", "SBIN"] },
  { symbol: "LICI", scripCode: "543526", name: "Life Insurance Corporation of India", nameKeywords: ["LIFE INSURANCE CORPORATION", "LIC OF INDIA", "LICI", "LIC"] },
  { symbol: "ITC", scripCode: "500875", name: "ITC Ltd", nameKeywords: ["ITC LTD", "ITC LIMITED", "ITC"] },
  { symbol: "HINDUNILVR", scripCode: "500696", name: "Hindustan Unilever Ltd", nameKeywords: ["HINDUSTAN UNILEVER", "HUL"] },
  { symbol: "LT", scripCode: "500510", name: "Larsen & Toubro Ltd", nameKeywords: ["LARSEN & TOUBRO", "LARSEN AND TOUBRO", "L&T"] },
  { symbol: "BAJFINANCE", scripCode: "500034", name: "Bajaj Finance Ltd", nameKeywords: ["BAJAJ FINANCE"] },
  { symbol: "HCLTECH", scripCode: "532281", name: "HCL Technologies Ltd", nameKeywords: ["HCL TECHNOLOGIES", "HCL TECH"] },
  { symbol: "MARUTI", scripCode: "532500", name: "Maruti Suzuki India Ltd", nameKeywords: ["MARUTI SUZUKI", "MARUTI"] },
  { symbol: "SUNPHARMA", scripCode: "524715", name: "Sun Pharmaceutical Industries Ltd", nameKeywords: ["SUN PHARMACEUTICAL", "SUN PHARMA"] },
  { symbol: "ADANIENT", scripCode: "512599", name: "Adani Enterprises Ltd", nameKeywords: ["ADANI ENTERPRISES"] },
  { symbol: "KOTAKBANK", scripCode: "500247", name: "Kotak Mahindra Bank Ltd", nameKeywords: ["KOTAK MAHINDRA BANK", "KOTAK BANK"] },
  { symbol: "TITAN", scripCode: "500114", name: "Titan Company Ltd", nameKeywords: ["TITAN COMPANY", "TITAN"] },
  { symbol: "ONGC", scripCode: "500312", name: "Oil & Natural Gas Corporation Ltd", nameKeywords: ["OIL AND NATURAL GAS", "ONGC"] },
  { symbol: "TATAMOTORS", scripCode: "500570", name: "Tata Motors Ltd", nameKeywords: ["TATA MOTORS"] },
  { symbol: "NTPC", scripCode: "532555", name: "NTPC Ltd", nameKeywords: ["NTPC"] },
  { symbol: "AXISBANK", scripCode: "532215", name: "Axis Bank Ltd", nameKeywords: ["AXIS BANK"] },
  { symbol: "DMART", scripCode: "540376", name: "Avenue Supermarts Ltd", nameKeywords: ["AVENUE SUPERMARTS", "DMART"] },
  { symbol: "ADANIPORTS", scripCode: "532921", name: "Adani Ports and Special Economic Zone Ltd", nameKeywords: ["ADANI PORTS", "ADANI PORT", "APSEZ"] },
  { symbol: "ULTRACEMCO", scripCode: "532538", name: "UltraTech Cement Ltd", nameKeywords: ["ULTRATECH CEMENT"] },
  { symbol: "ASIANPAINT", scripCode: "500820", name: "Asian Paints Ltd", nameKeywords: ["ASIAN PAINTS", "ASIAN PAINT"] },
  { symbol: "COALINDIA", scripCode: "533278", name: "Coal India Ltd", nameKeywords: ["COAL INDIA"] },
  { symbol: "BAJAJFINSV", scripCode: "532978", name: "Bajaj Finserv Ltd", nameKeywords: ["BAJAJ FINSERV"] },
  { symbol: "BAJAJ-AUTO", scripCode: "532977", name: "Bajaj Auto Ltd", nameKeywords: ["BAJAJ AUTO"] },
  { symbol: "BAJAJAUTO", scripCode: "532977", name: "Bajaj Auto Ltd", nameKeywords: ["BAJAJ AUTO"] },
  { symbol: "POWERGRID", scripCode: "532898", name: "Power Grid Corporation of India Ltd", nameKeywords: ["POWER GRID CORPORATION", "POWERGRID", "PGCIL"] },
  { symbol: "NESTLEIND", scripCode: "500790", name: "Nestle India Ltd", nameKeywords: ["NESTLE INDIA", "NESTLE"] },
  { symbol: "M&M", scripCode: "500520", name: "Mahindra & Mahindra Ltd", nameKeywords: ["MAHINDRA & MAHINDRA", "MAHINDRA AND MAHINDRA", "M&M"] },
  { symbol: "HAL", scripCode: "541154", name: "Hindustan Aeronautics Ltd", nameKeywords: ["HINDUSTAN AERONAUTICS", "HAL"] },
  { symbol: "JIOFIN", scripCode: "543940", name: "Jio Financial Services Ltd", nameKeywords: ["JIO FINANCIAL SERVICES", "JIOFIN", "JFS"] },
  { symbol: "TATASTEEL", scripCode: "500470", name: "Tata Steel Ltd", nameKeywords: ["TATA STEEL"] },
  { symbol: "SIEMENS", scripCode: "500550", name: "Siemens Ltd", nameKeywords: ["SIEMENS"] },
  { symbol: "IRFC", scripCode: "543257", name: "Indian Railway Finance Corporation Ltd", nameKeywords: ["INDIAN RAILWAY FINANCE", "IRFC"] },
  { symbol: "VBL", scripCode: "540180", name: "Varun Beverages Ltd", nameKeywords: ["VARUN BEVERAGES", "VBL"] },
  { symbol: "ZOMATO", scripCode: "543320", name: "Zomato Ltd", nameKeywords: ["ZOMATO", "ETERNAL"] },
  { symbol: "ETERNAL", scripCode: "543320", name: "Zomato Ltd", nameKeywords: ["ZOMATO", "ETERNAL"] },
  { symbol: "PIDILITIND", scripCode: "500331", name: "Pidilite Industries Ltd", nameKeywords: ["PIDILITE INDUSTRIES", "PIDILITE"] },
  { symbol: "GRASIM", scripCode: "500300", name: "Grasim Industries Ltd", nameKeywords: ["GRASIM INDUSTRIES", "GRASIM"] },
  { symbol: "SBILIFE", scripCode: "540719", name: "SBI Life Insurance Company Ltd", nameKeywords: ["SBI LIFE INSURANCE", "SBI LIFE"] },
  { symbol: "BEL", scripCode: "500049", name: "Bharat Electronics Ltd", nameKeywords: ["BHARAT ELECTRONICS", "BEL"] },
  { symbol: "HINDALCO", scripCode: "500440", name: "Hindalco Industries Ltd", nameKeywords: ["HINDALCO INDUSTRIES", "HINDALCO"] },
  { symbol: "TRENT", scripCode: "500251", name: "Trent Ltd", nameKeywords: ["TRENT"] },
  { symbol: "INDIGO", scripCode: "539448", name: "InterGlobe Aviation Ltd", nameKeywords: ["INTERGLOBE AVIATION", "INDIGO"] },
  { symbol: "LTIM", scripCode: "540005", name: "LTIMindtree Ltd", nameKeywords: ["LTIMINDTREE", "LTI MINDTREE", "LTI"] },
  { symbol: "BANKBARODA", scripCode: "532134", name: "Bank of Baroda", nameKeywords: ["BANK OF BARODA", "BOB"] },
  { symbol: "HDFCLIFE", scripCode: "540777", name: "HDFC Life Insurance Company Ltd", nameKeywords: ["HDFC LIFE INSURANCE", "HDFC LIFE"] },
  { symbol: "PNB", scripCode: "532461", name: "Punjab National Bank", nameKeywords: ["PUNJAB NATIONAL BANK", "PNB"] },
  { symbol: "PFC", scripCode: "532810", name: "Power Finance Corporation Ltd", nameKeywords: ["POWER FINANCE CORPORATION", "POWER FINANCE", "PFC"] },
  { symbol: "NATIONALUM", scripCode: "532234", name: "National Aluminium Company Ltd", nameKeywords: ["NATIONAL ALUMINIUM", "NALCO"] },
  { symbol: "ASHOKLEY", scripCode: "500477", name: "Ashok Leyland Ltd", nameKeywords: ["ASHOK LEYLAND"] },
  { symbol: "UNIONBANK", scripCode: "532477", name: "Union Bank of India", nameKeywords: ["UNION BANK OF INDIA", "UNION BANK"] },
  { symbol: "CHOLAFIN", scripCode: "511243", name: "Cholamandalam Investment and Finance Company Ltd", nameKeywords: ["CHOLAMANDALAM INVESTMENT", "CHOLAMANDALAM", "CHOLA FINANCE"] },
  { symbol: "BHEL", scripCode: "500103", name: "Bharat Heavy Electricals Ltd", nameKeywords: ["BHARAT HEAVY ELECTRICALS", "BHEL"] },
  { symbol: "SRF", scripCode: "503806", name: "SRF Ltd", nameKeywords: ["SRF LIMITED", "SRF"] },
  { symbol: "CGPOWER", scripCode: "500093", name: "CG Power and Industrial Solutions Ltd", nameKeywords: ["CG POWER AND INDUSTRIAL", "CG POWER"] },
  { symbol: "KPITTECH", scripCode: "542651", name: "KPIT Technologies Ltd", nameKeywords: ["KPIT TECHNOLOGIES", "KPIT TECH"] },
  { symbol: "TVSMOTOR", scripCode: "532343", name: "TVS Motor Company Ltd", nameKeywords: ["TVS MOTOR"] },
  { symbol: "SOLARINDS", scripCode: "532725", name: "Solar Industries India Ltd", nameKeywords: ["SOLAR INDUSTRIES"] },
  { symbol: "MOTHERSON", scripCode: "517334", name: "Samvardhana Motherson International Ltd", nameKeywords: ["SAMVARDHANA MOTHERSON", "MOTHERSON SUMI", "MOTHERSON"] },
  { symbol: "GIPCL", scripCode: "517300", name: "Gujarat Industries Power Company Ltd", nameKeywords: ["GUJARAT INDUSTRIES POWER", "GIPCL"] },
  { symbol: "KALYANKJIL", scripCode: "543278", name: "Kalyan Jewellers India Ltd", nameKeywords: ["KALYAN JEWELLERS"] },
  { symbol: "CANBK", scripCode: "532483", name: "Canara Bank", nameKeywords: ["CANARA BANK"] },
  { symbol: "RBLBANK", scripCode: "540065", name: "RBL Bank Ltd", nameKeywords: ["RBL BANK"] },
  { symbol: "FEDERALBNK", scripCode: "500469", name: "Federal Bank Ltd", nameKeywords: ["FEDERAL BANK"] },
  { symbol: "CIPLA", scripCode: "500087", name: "Cipla Ltd", nameKeywords: ["CIPLA"] },
  { symbol: "TIINDIA", scripCode: "540762", name: "Tube Investments of India Ltd", nameKeywords: ["TUBE INVESTMENTS"] },
  { symbol: "NAUKRI", scripCode: "532777", name: "Info Edge (India) Ltd", nameKeywords: ["INFO EDGE", "NAUKRI"] },
  { symbol: "INDIANB", scripCode: "532814", name: "Indian Bank", nameKeywords: ["INDIAN BANK"] },
  { symbol: "ICICIPRULI", scripCode: "540133", name: "ICICI Prudential Life Insurance Company Ltd", nameKeywords: ["ICICI PRUDENTIAL", "ICICI PRU LIFE"] },
  { symbol: "HDFCAMC", scripCode: "541729", name: "HDFC Asset Management Company Ltd", nameKeywords: ["HDFC ASSET MANAGEMENT", "HDFC AMC"] },
  { symbol: "SHRIRAMFIN", scripCode: "511218", name: "Shriram Finance Ltd", nameKeywords: ["SHRIRAM FINANCE", "SHRIRAM TRANSPORT"] },
  { symbol: "CUMMINSIND", scripCode: "500480", name: "Cummins India Ltd", nameKeywords: ["CUMMINS INDIA"] },
  { symbol: "ABCAPITAL", scripCode: "540691", name: "Aditya Birla Capital Ltd", nameKeywords: ["ADITYA BIRLA CAPITAL", "AB CAPITAL"] },
  { symbol: "ICICIGI", scripCode: "540716", name: "ICICI Lombard General Insurance Company Ltd", nameKeywords: ["ICICI LOMBARD", "ICICIGI"] },
  { symbol: "UPL", scripCode: "512070", name: "UPL Ltd", nameKeywords: ["UPL LIMITED", "UPL"] },
  { symbol: "MARICO", scripCode: "531642", name: "Marico Ltd", nameKeywords: ["MARICO"] },
  { symbol: "DIXON", scripCode: "540699", name: "Dixon Technologies (India) Ltd", nameKeywords: ["DIXON TECHNOLOGIES", "DIXON"] },
  { symbol: "BHARATFORG", scripCode: "500493", name: "Bharat Forge Ltd", nameKeywords: ["BHARAT FORGE"] },
  { symbol: "GODREJPROP", scripCode: "533150", name: "Godrej Properties Ltd", nameKeywords: ["GODREJ PROPERTIES"] },
  { symbol: "GODREJCP", scripCode: "532424", name: "Godrej Consumer Products Ltd", nameKeywords: ["GODREJ CONSUMER PRODUCTS", "GODREJ CONSUMER"] },
  { symbol: "GODREJIND", scripCode: "500164", name: "Godrej Industries Ltd", nameKeywords: ["GODREJ INDUSTRIES"] },
  { symbol: "KANSAINER", scripCode: "500165", name: "Kansai Nerolac Paints Ltd", nameKeywords: ["KANSAI NEROLAC", "NEROLAC"] },
  { symbol: "NBCC", scripCode: "534309", name: "NBCC (India) Ltd", nameKeywords: ["NBCC (INDIA)", "NBCC"] },
  { symbol: "ZYDUSLIFE", scripCode: "532321", name: "Zydus Lifesciences Ltd", nameKeywords: ["ZYDUS LIFESCIENCES", "ZYDUS CADILA", "ZYDUS LIFE"] },
  { symbol: "PAGEIND", scripCode: "532827", name: "Page Industries Ltd", nameKeywords: ["PAGE INDUSTRIES"] },
  { symbol: "JUBLFOOD", scripCode: "533155", name: "Jubilant FoodWorks Ltd", nameKeywords: ["JUBILANT FOODWORKS", "JUBILANT FOOD"] },
  { symbol: "ALKEM", scripCode: "539523", name: "Alkem Laboratories Ltd", nameKeywords: ["ALKEM LABORATORIES", "ALKEM LAB"] },
  { symbol: "ASTRAL", scripCode: "532830", name: "Astral Ltd", nameKeywords: ["ASTRAL LIMITED", "ASTRAL POLY"] },
  { symbol: "RVNL", scripCode: "542649", name: "Rail Vikas Nigam Ltd", nameKeywords: ["RAIL VIKAS NIGAM", "RVNL"] },
  { symbol: "SUZLON", scripCode: "532667", name: "Suzlon Energy Ltd", nameKeywords: ["SUZLON ENERGY", "SUZLON"] },
  { symbol: "PAYTM", scripCode: "543396", name: "One 97 Communications Ltd", nameKeywords: ["ONE 97 COMMUNICATIONS", "PAYTM"] },
  { symbol: "POLICYBZR", scripCode: "543390", name: "PB Fintech Ltd", nameKeywords: ["PB FINTECH", "POLICYBAZAAR"] },
  { symbol: "NYKAA", scripCode: "543384", name: "FSN E-Commerce Ventures Ltd", nameKeywords: ["FSN E-COMMERCE", "NYKAA"] },
  { symbol: "SWIGGY", scripCode: "544285", name: "Swiggy Ltd", nameKeywords: ["SWIGGY"] },
  { symbol: "MAZDOCK", scripCode: "543237", name: "Mazagon Dock Shipbuilders Ltd", nameKeywords: ["MAZAGON DOCK", "MAZDOCK"] },
  { symbol: "COCHINSHIP", scripCode: "540678", name: "Cochin Shipyard Ltd", nameKeywords: ["COCHIN SHIPYARD"] },
  { symbol: "SAIL", scripCode: "500113", name: "Steel Authority of India Ltd", nameKeywords: ["STEEL AUTHORITY OF INDIA", "SAIL"] },
  { symbol: "NMDC", scripCode: "526371", name: "NMDC Ltd", nameKeywords: ["NMDC"] },
  { symbol: "GAIL", scripCode: "532155", name: "GAIL (India) Ltd", nameKeywords: ["GAIL (INDIA)", "GAIL"] },
  { symbol: "DLF", scripCode: "532868", name: "DLF Ltd", nameKeywords: ["DLF LIMITED", "DLF"] },
  { symbol: "RECLTD", scripCode: "532955", name: "REC Ltd", nameKeywords: ["REC LIMITED", "REC LTD", "REC"] },
  { symbol: "MUTHOOTFIN", scripCode: "533398", name: "Muthoot Finance Ltd", nameKeywords: ["MUTHOOT FINANCE"] },
  { symbol: "PERSISTENT", scripCode: "533179", name: "Persistent Systems Ltd", nameKeywords: ["PERSISTENT SYSTEMS"] },
  { symbol: "COFORGE", scripCode: "532541", name: "Coforge Ltd", nameKeywords: ["COFORGE", "NIIT TECH"] },
  { symbol: "MPHASIS", scripCode: "526299", name: "Mphasis Ltd", nameKeywords: ["MPHASIS"] },
  { symbol: "MCX", scripCode: "534091", name: "Multi Commodity Exchange of India Ltd", nameKeywords: ["MULTI COMMODITY EXCHANGE", "MCX"] },
  { symbol: "CDSL", scripCode: "540615", name: "Central Depository Services (India) Ltd", nameKeywords: ["CENTRAL DEPOSITARY SERVICES", "CENTRAL DEPOSITORY SERVICES", "CDSL"] },
  { symbol: "BSE", scripCode: "540025", name: "BSE Ltd", nameKeywords: ["BSE LIMITED", "BSE"] },
  { symbol: "IEX", scripCode: "540750", name: "Indian Energy Exchange Ltd", nameKeywords: ["INDIAN ENERGY EXCHANGE", "IEX"] },
  { symbol: "POLYCAB", scripCode: "542652", name: "Polycab India Ltd", nameKeywords: ["POLYCAB INDIA", "POLYCAB"] },
  { symbol: "HAVELLS", scripCode: "517354", name: "Havells India Ltd", nameKeywords: ["HAVELLS INDIA", "HAVELLS"] },

  // New Generation & Clean Energy / PSUs / Midcaps
  { symbol: "IREDA", scripCode: "544026", name: "Indian Renewable Energy Development Agency Ltd", nameKeywords: ["INDIAN RENEWABLE ENERGY", "IREDA"] },
  { symbol: "NHPC", scripCode: "533098", name: "NHPC Ltd", nameKeywords: ["NHPC LIMITED", "NHPC"] },
  { symbol: "SJVN", scripCode: "533206", name: "SJVN Ltd", nameKeywords: ["SJVN LIMITED", "SJVN"] },
  { symbol: "HUDCO", scripCode: "540530", name: "Housing and Urban Development Corporation Ltd", nameKeywords: ["HOUSING AND URBAN DEVELOPMENT", "HUDCO"] },
  { symbol: "IRCTC", scripCode: "542830", name: "Indian Railway Catering and Tourism Corporation Ltd", nameKeywords: ["INDIAN RAILWAY CATERING", "IRCTC"] },
  { symbol: "RITES", scripCode: "541556", name: "RITES Ltd", nameKeywords: ["RITES LIMITED", "RITES"] },
  { symbol: "BDL", scripCode: "541143", name: "Bharat Dynamics Ltd", nameKeywords: ["BHARAT DYNAMICS", "BDL"] },
  { symbol: "KAYNES", scripCode: "543664", name: "Kaynes Technology India Ltd", nameKeywords: ["KAYNES TECHNOLOGY", "KAYNES"] },
  { symbol: "TATAPOWER", scripCode: "500400", name: "Tata Power Company Ltd", nameKeywords: ["TATA POWER"] },
  { symbol: "TATAELXSI", scripCode: "500408", name: "Tata Elxsi Ltd", nameKeywords: ["TATA ELXSI"] },
  { symbol: "TATACOMM", scripCode: "500483", name: "Tata Communications Ltd", nameKeywords: ["TATA COMMUNICATIONS"] },
  { symbol: "TATAINVEST", scripCode: "501301", name: "Tata Investment Corporation Ltd", nameKeywords: ["TATA INVESTMENT"] },
  { symbol: "TATACHEM", scripCode: "500770", name: "Tata Chemicals Ltd", nameKeywords: ["TATA CHEMICALS"] },
  { symbol: "ADANIPOWER", scripCode: "533096", name: "Adani Power Ltd", nameKeywords: ["ADANI POWER"] },
  { symbol: "ADANIGREEN", scripCode: "541450", name: "Adani Green Energy Ltd", nameKeywords: ["ADANI GREEN"] },
  { symbol: "ATGL", scripCode: "542066", name: "Adani Total Gas Ltd", nameKeywords: ["ADANI TOTAL GAS", "ATGL"] },
  { symbol: "AWL", scripCode: "543458", name: "Adani Wilmar Ltd", nameKeywords: ["ADANI WILMAR", "AWL"] },
  { symbol: "IDEA", scripCode: "532822", name: "Vodafone Idea Ltd", nameKeywords: ["VODAFONE IDEA", "IDEA"] },
  { symbol: "YESBANK", scripCode: "532648", name: "Yes Bank Ltd", nameKeywords: ["YES BANK"] },
  { symbol: "IDFCFIRSTB", scripCode: "539437", name: "IDFC First Bank Ltd", nameKeywords: ["IDFC FIRST BANK", "IDFC FIRST"] },
  { symbol: "BANDHANBNK", scripCode: "541153", name: "Bandhan Bank Ltd", nameKeywords: ["BANDHAN BANK"] },
  { symbol: "AUBANK", scripCode: "540611", name: "AU Small Finance Bank Ltd", nameKeywords: ["AU SMALL FINANCE", "AU BANK"] },
  { symbol: "ANGELONE", scripCode: "543235", name: "Angel One Ltd", nameKeywords: ["ANGEL ONE", "ANGEL BROKING"] },
  { symbol: "SONACOMS", scripCode: "543300", name: "Sona BLW Precision Forgings Ltd", nameKeywords: ["SONA BLW", "SONACOMS"] },
  { symbol: "EXIDEIND", scripCode: "500086", name: "Exide Industries Ltd", nameKeywords: ["EXIDE INDUSTRIES", "EXIDE"] },
  { symbol: "AMARAJABAT", scripCode: "500008", name: "Amara Raja Energy & Mobility Ltd", nameKeywords: ["AMARA RAJA", "AMARAJABAT"] },
  { symbol: "OLECTRA", scripCode: "532439", name: "Olectra Greentech Ltd", nameKeywords: ["OLECTRA GREENTECH", "OLECTRA"] },
  { symbol: "JBMMA", scripCode: "532605", name: "JBM Auto Ltd", nameKeywords: ["JBM AUTO", "JBMA"] },
  { symbol: "JBMA", scripCode: "532605", name: "JBM Auto Ltd", nameKeywords: ["JBM AUTO", "JBMA"] },
  { symbol: "INOXWIND", scripCode: "539083", name: "Inox Wind Ltd", nameKeywords: ["INOX WIND"] },
  { symbol: "DEEPAKNTR", scripCode: "506401", name: "Deepak Nitrite Ltd", nameKeywords: ["DEEPAK NITRITE"] },
  { symbol: "PIIND", scripCode: "523642", name: "PI Industries Ltd", nameKeywords: ["PI INDUSTRIES"] },
  { symbol: "AARTIIND", scripCode: "524208", name: "Aarti Industries Ltd", nameKeywords: ["AARTI INDUSTRIES"] },
  { symbol: "NAVINFLUOR", scripCode: "532504", name: "Navin Fluorine International Ltd", nameKeywords: ["NAVIN FLUORINE"] },
  { symbol: "FLUOROCHEM", scripCode: "542812", name: "Gujarat Fluorochemicals Ltd", nameKeywords: ["GUJARAT FLUOROCHEMICALS", "FLUOROCHEM"] },
  { symbol: "CLEAN", scripCode: "543318", name: "Clean Science and Technology Ltd", nameKeywords: ["CLEAN SCIENCE"] },
  { symbol: "PETRONET", scripCode: "532522", name: "Petronet LNG Ltd", nameKeywords: ["PETRONET LNG", "PETRONET"] },
  { symbol: "IGL", scripCode: "532514", name: "Indraprastha Gas Ltd", nameKeywords: ["INDRAPRASTHA GAS", "IGL"] },
  { symbol: "MGL", scripCode: "539957", name: "Mahanagar Gas Ltd", nameKeywords: ["MAHANAGAR GAS", "MGL"] },
  { symbol: "GUJGASLTD", scripCode: "539336", name: "Gujarat Gas Ltd", nameKeywords: ["GUJARAT GAS"] },
  { symbol: "OIL", scripCode: "533106", name: "Oil India Ltd", nameKeywords: ["OIL INDIA"] },
  { symbol: "CONCOR", scripCode: "531344", name: "Container Corporation of India Ltd", nameKeywords: ["CONTAINER CORPORATION", "CONCOR"] },
  { symbol: "KEI", scripCode: "517569", name: "KEI Industries Ltd", nameKeywords: ["KEI INDUSTRIES"] },
  { symbol: "VOLTAS", scripCode: "500575", name: "Voltas Ltd", nameKeywords: ["VOLTAS"] },
  { symbol: "BLUESTARCO", scripCode: "500067", name: "Blue Star Ltd", nameKeywords: ["BLUE STAR"] },
  { symbol: "AMBER", scripCode: "540902", name: "Amber Enterprises India Ltd", nameKeywords: ["AMBER ENTERPRISES", "AMBER"] },
  { symbol: "CROMPTON", scripCode: "539876", name: "Crompton Greaves Consumer Electricals Ltd", nameKeywords: ["CROMPTON GREAVES", "CROMPTON"] },
  { symbol: "RADICO", scripCode: "532497", name: "Radico Khaitan Ltd", nameKeywords: ["RADICO KHAITAN", "RADICO"] },
  { symbol: "SULA", scripCode: "543711", name: "Sula Vineyards Ltd", nameKeywords: ["SULA VINEYARDS", "SULA"] },
  { symbol: "DEVYANI", scripCode: "543330", name: "Devyani International Ltd", nameKeywords: ["DEVYANI INTERNATIONAL", "DEVYANI"] },
  { symbol: "WESTLIFE", scripCode: "505533", name: "Westlife Foodworld Ltd", nameKeywords: ["WESTLIFE FOODWORLD", "WESTLIFE"] },
  { symbol: "EICHERMOT", scripCode: "505200", name: "Eicher Motors Ltd", nameKeywords: ["EICHER MOTORS"] },
  { symbol: "ESCORTS", scripCode: "500495", name: "Escorts Kubota Ltd", nameKeywords: ["ESCORTS KUBOTA", "ESCORTS"] },
  { symbol: "BALKRISIND", scripCode: "502355", name: "Balkrishna Industries Ltd", nameKeywords: ["BALKRISHNA INDUSTRIES", "BKT"] },
  { symbol: "MRF", scripCode: "500290", name: "MRF Ltd", nameKeywords: ["MRF LIMITED", "MRF"] },
  { symbol: "APOLLOTYRE", scripCode: "500877", name: "Apollo Tyres Ltd", nameKeywords: ["APOLLO TYRES"] },
  { symbol: "CEAT", scripCode: "500878", name: "CEAT Ltd", nameKeywords: ["CEAT LIMITED", "CEAT"] },
  { symbol: "BSOFT", scripCode: "532400", name: "Birlasoft Ltd", nameKeywords: ["BIRLASOFT", "BSOFT"] },
  { symbol: "CYIENT", scripCode: "532175", name: "Cyient Ltd", nameKeywords: ["CYIENT LIMITED", "CYIENT"] },
  { symbol: "LTTS", scripCode: "540115", name: "L&T Technology Services Ltd", nameKeywords: ["L&T TECHNOLOGY SERVICES", "LTTS"] },
  { symbol: "POONAWALLA", scripCode: "524000", name: "Poonawalla Fincorp Ltd", nameKeywords: ["POONAWALLA FINCORP", "POONAWALLA"] },
  { symbol: "MANAPPURAM", scripCode: "531213", name: "Manappuram Finance Ltd", nameKeywords: ["MANAPPURAM FINANCE"] },
  { symbol: "LICHSGFIN", scripCode: "500253", name: "LIC Housing Finance Ltd", nameKeywords: ["LIC HOUSING FINANCE"] },
  { symbol: "PNBHOUSING", scripCode: "540173", name: "PNB Housing Finance Ltd", nameKeywords: ["PNB HOUSING FINANCE"] },
  { symbol: "CANFINHOME", scripCode: "511196", name: "Can Fin Homes Ltd", nameKeywords: ["CAN FIN HOMES"] },
  { symbol: "AAVAS", scripCode: "541988", name: "Aavas Financiers Ltd", nameKeywords: ["AAVAS FINANCIERS", "AAVAS"] },
  { symbol: "HOMEFIRST", scripCode: "543259", name: "Home First Finance Company India Ltd", nameKeywords: ["HOME FIRST FINANCE", "HOMEFIRST"] },
  { symbol: "SBICARD", scripCode: "543066", name: "SBI Cards and Payment Services Ltd", nameKeywords: ["SBI CARDS", "SBICARD"] },
  { symbol: "HINDZINC", scripCode: "500188", name: "Hindustan Zinc Ltd", nameKeywords: ["HINDUSTAN ZINC"] },
  { symbol: "AMBUJACEM", scripCode: "500425", name: "Ambuja Cements Ltd", nameKeywords: ["AMBUJA CEMENTS"] },
  { symbol: "ACC", scripCode: "500410", name: "ACC Ltd", nameKeywords: ["ACC LIMITED", "ACC"] },
  { symbol: "INDUSINDBK", scripCode: "532209", name: "IndusInd Bank Ltd", nameKeywords: ["INDUSIND BANK"] },
  { symbol: "TECHM", scripCode: "532755", name: "Tech Mahindra Ltd", nameKeywords: ["TECH MAHINDRA"] },
  { symbol: "ABB", scripCode: "500002", name: "ABB India Ltd", nameKeywords: ["ABB INDIA"] },
  { symbol: "BPCL", scripCode: "500547", name: "Bharat Petroleum Corporation Ltd", nameKeywords: ["BHARAT PETROLEUM", "BPCL"] },
  { symbol: "IOC", scripCode: "530965", name: "Indian Oil Corporation Ltd", nameKeywords: ["INDIAN OIL CORPORATION", "IOCL", "IOC"] },
  { symbol: "HPCL", scripCode: "500104", name: "Hindustan Petroleum Corporation Ltd", nameKeywords: ["HINDUSTAN PETROLEUM", "HPCL"] },
  { symbol: "BIKAJI", scripCode: "543653", name: "Bikaji Foods International Ltd", nameKeywords: ["BIKAJI FOODS", "BIKAJI"] },
  { symbol: "PVRINOX", scripCode: "532689", name: "PVR INOX Ltd", nameKeywords: ["PVR INOX", "PVR"] },
  { symbol: "DELTACORP", scripCode: "532848", name: "Delta Corp Ltd", nameKeywords: ["DELTA CORP"] },
  { symbol: "IRB", scripCode: "532947", name: "IRB Infrastructure Developers Ltd", nameKeywords: ["IRB INFRASTRUCTURE", "IRB"] },
  { symbol: "NCC", scripCode: "500294", name: "NCC Ltd", nameKeywords: ["NCC LIMITED", "NCC"] },
  { symbol: "GMRINFRA", scripCode: "532754", name: "GMR Airports Infrastructure Ltd", nameKeywords: ["GMR AIRPORTS", "GMR INFRASTRUCTURE", "GMRINFRA"] },
  { symbol: "SUVENPHAR", scripCode: "543064", name: "Suven Pharmaceuticals Ltd", nameKeywords: ["SUVEN PHARMACEUTICALS", "SUVENPHAR"] },
  { symbol: "GRANULES", scripCode: "532482", name: "Granules India Ltd", nameKeywords: ["GRANULES INDIA"] },
  { symbol: "GLENMARK", scripCode: "532296", name: "Glenmark Pharmaceuticals Ltd", nameKeywords: ["GLENMARK PHARMACEUTICALS", "GLENMARK"] },
  { symbol: "BIOCON", scripCode: "532523", name: "Biocon Ltd", nameKeywords: ["BIOCON LIMITED", "BIOCON"] },
  { symbol: "LAURUSLABS", scripCode: "540222", name: "Laurus Labs Ltd", nameKeywords: ["LAURUS LABS"] },
  { symbol: "IPCALAB", scripCode: "524494", name: "Ipca Laboratories Ltd", nameKeywords: ["IPCA LABORATORIES", "IPCALAB"] },
  { symbol: "DIVISLAB", scripCode: "532488", name: "Divi's Laboratories Ltd", nameKeywords: ["DIVIS LABORATORIES", "DIVIS LAB"] },
  { symbol: "DRREDDY", scripCode: "500124", name: "Dr. Reddy's Laboratories Ltd", nameKeywords: ["DR REDDY", "DR. REDDY"] },
  { symbol: "APOLLOHOSP", scripCode: "508869", name: "Apollo Hospitals Enterprise Ltd", nameKeywords: ["APOLLO HOSPITALS"] },
  { symbol: "FORTIS", scripCode: "532843", name: "Fortis Healthcare Ltd", nameKeywords: ["FORTIS HEALTHCARE", "FORTIS"] },
  { symbol: "MAXHEALTH", scripCode: "543220", name: "Max Healthcare Institute Ltd", nameKeywords: ["MAX HEALTHCARE"] },
  { symbol: "MEDANTA", scripCode: "543654", name: "Global Health Ltd", nameKeywords: ["GLOBAL HEALTH", "MEDANTA"] },
  { symbol: "LALPATHLAB", scripCode: "539524", name: "Dr. Lal PathLabs Ltd", nameKeywords: ["DR. LAL PATHLABS", "LALPATHLAB"] },
  { symbol: "METROPOLIS", scripCode: "542650", name: "Metropolis Healthcare Ltd", nameKeywords: ["METROPOLIS HEALTHCARE"] }
];

// Initialize in-memory tables
for (const stock of INITIAL_STOCKS) {
  registerStockEntry(stock, false);
}

// Load disk cache overlay
loadDiskCache();

/**
 * Synchronous in-memory lookup for Scrip Code and Details for any known symbol or code.
 */
export function resolveStockDetailsSync(query: string): StockMasterEntry | null {
  if (!query) return null;
  const clean = query.trim().toUpperCase();
  if (!clean) return null;

  // 1. Direct 6-digit BSE Scrip Code
  if (/^\d{6}$/.test(clean)) {
    if (scripToEntry.has(clean)) {
      return scripToEntry.get(clean)!;
    }
  }

  // 2. Direct Symbol Match
  if (symbolToEntry.has(clean)) {
    return symbolToEntry.get(clean)!;
  }

  const noSpace = clean.replace(/[\s-]/g, '');
  if (symbolToEntry.has(noSpace)) {
    return symbolToEntry.get(noSpace)!;
  }

  // 3. Name or Keyword Match
  if (nameToEntry.has(clean)) {
    return nameToEntry.get(clean)!;
  }
  if (nameToEntry.has(noSpace)) {
    return nameToEntry.get(noSpace)!;
  }

  if (/^[A-Z0-9-]{2,15}$/.test(clean)) {
    return {
      symbol: clean,
      scripCode: /^\d{6}$/.test(clean) ? clean : '',
      name: clean,
      nameKeywords: [clean]
    };
  }

  return null;
}

/**
 * Resolves Scrip Code and Details for ANY symbol, name, or BSE code in India.
 * If not in memory, dynamically queries Screener / Yahoo Finance and persists to disk!
 */
export async function resolveStockDetails(query: string): Promise<StockMasterEntry | null> {
  if (!query) return null;
  const clean = query.trim().toUpperCase();
  if (!clean) return null;

  // 1. Direct 6-digit BSE Scrip Code
  if (/^\d{6}$/.test(clean)) {
    if (scripToEntry.has(clean)) {
      return scripToEntry.get(clean)!;
    }
  }

  // 2. Direct Symbol Match
  if (symbolToEntry.has(clean)) {
    return symbolToEntry.get(clean)!;
  }

  const noSpace = clean.replace(/[\s-]/g, '');
  if (symbolToEntry.has(noSpace)) {
    return symbolToEntry.get(noSpace)!;
  }

  // 3. Name or Keyword Match
  if (nameToEntry.has(clean)) {
    return nameToEntry.get(clean)!;
  }
  if (nameToEntry.has(noSpace)) {
    return nameToEntry.get(noSpace)!;
  }

  // 4. Dynamic Online Lookup via Screener & BSE / Yahoo Finance
  try {
    const screenerUrl = `https://www.screener.in/api/company/search/?q=${encodeURIComponent(query)}`;
    const res = await fetch(screenerUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)" },
      signal: AbortSignal.timeout(4000)
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const topMatch = data[0];
        const parts = (topMatch.url || '').split('/').filter(Boolean);
        const extractedSymbol = (parts[1] || '').toUpperCase().trim();
        const companyName = topMatch.name || extractedSymbol;

        // Try to find BSE scrip code from Screener company page
        let resolvedScrip = '';
        if (extractedSymbol) {
          try {
            const pageRes = await fetch(`https://www.screener.in/company/${extractedSymbol}/`, {
              headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
              signal: AbortSignal.timeout(4000)
            });
            if (pageRes.ok) {
              const html = await pageRes.text();
              const bseMatch = html.match(/bseindia\.com\/stock-share-price\/[^\/]+\/[^\/]+\/(\d{6})\//i) || 
                               html.match(/bseindia\.com\/stock-share-price\/[^\"]+\/(\d{6})\//i) ||
                               html.match(/\/(\d{6})\/corp-announcements/i);
              if (bseMatch && bseMatch[1]) {
                resolvedScrip = bseMatch[1];
              }
            }
          } catch {
            // Page fetch failed
          }
        }

        // If extracted symbol itself is 6-digit scrip
        if (/^\d{6}$/.test(extractedSymbol)) {
          resolvedScrip = extractedSymbol;
        }

        const newEntry: StockMasterEntry = {
          symbol: extractedSymbol || clean,
          scripCode: resolvedScrip,
          name: companyName,
          nameKeywords: [extractedSymbol, companyName]
        };

        // Only persist if verified 6-digit scrip code was discovered
        const isVerifiedScrip = Boolean(resolvedScrip && /^\d{6}$/.test(resolvedScrip));
        registerStockEntry(newEntry, isVerifiedScrip);
        return newEntry;
      }
    }
  } catch (err) {
    console.warn(`Dynamic lookup failed for query "${query}":`, err);
  }

  // Fallback entry if symbol is provided (kept in session memory ONLY)
  if (/^[A-Z0-9-]{2,15}$/.test(clean)) {
    const fallbackEntry: StockMasterEntry = {
      symbol: clean,
      scripCode: /^\d{6}$/.test(clean) ? clean : '',
      name: clean,
      nameKeywords: [clean]
    };
    registerStockEntry(fallbackEntry, false);
    return fallbackEntry;
  }

  return null;
}

export function getAllStockEntries(): StockMasterEntry[] {
  return Array.from(symbolToEntry.values());
}

export function getScripCode(symbolOrQuery: string): string | undefined {
  if (!symbolOrQuery) return undefined;
  const clean = symbolOrQuery.trim().toUpperCase();
  if (/^\d{6}$/.test(clean)) return clean;

  const entry = symbolToEntry.get(clean) || symbolToEntry.get(clean.replace(/[\s-]/g, '')) || nameToEntry.get(clean);
  if (entry && entry.scripCode) {
    return entry.scripCode;
  }
  return undefined;
}
