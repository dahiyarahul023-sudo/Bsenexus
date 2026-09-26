import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { customFetch } from '../api';
import { useAuth } from '../context/AuthContext';
import { useIntelModal } from '../context/IntelModalContext';
import { 
  Trash2, Plus, Search, Edit2, Check, X, FileText, Calendar, 
  Filter, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, TrendingUp, Send, Building2, 
  Clock, Upload, RefreshCw, Sparkles, ExternalLink, AlertCircle, 
  CheckCircle2, ArrowUpRight, BarChart3, Layers, SlidersHorizontal, 
  ShieldCheck, Crown, Tag, ArrowUpDown, Zap, CheckCheck, Lock, Bot, RotateCcw,
  MoreVertical, AlertTriangle, Bookmark, LayoutGrid, List
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatFullDateTime, formatShortDateTime, formatTimeOnly, formatDateOnly, formatCleanDateTime, formatCleanTime, formatFilingRelativeTime } from '../utils/timeFormat';
import { cleanBseSubject } from '../utils/cleanBseSubject';
import { getSafePdfUrl } from '../utils/pdfHelper';
import { StockPriority, WatchlistStockItem } from '../types';
import { useAiQuota, syncQuotaFromResponse } from '../utils/aiQuota';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { useVisibilityInterval } from '../hooks/useVisibilityInterval';
import { PullToRefreshIndicator } from './ui/PullToRefreshIndicator';
import { ActionButton } from './ui/ActionButton';
import { clusterAnnouncements, AnnouncementCluster } from '../utils/clusterAnnouncements';
import { motion, AnimatePresence } from 'framer-motion';
import { springSnappy, springMorph, containerStaggerVariants, itemFadeUpVariants, buttonTap, cardHover } from '../utils/motionTokens';
import { ShareActionMenu } from './ui/motion/ShareActionMenu';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const stockMasterClient: Record<string, { scripCode: string; nameKeywords: string[] }> = {
  "RELIANCE": { scripCode: "500325", nameKeywords: ["RELIANCE INDUSTRIES", "RELIANCE IND"] },
  "TCS": { scripCode: "532540", nameKeywords: ["TATA CONSULTANCY", "TCS"] },
  "HDFCBANK": { scripCode: "500180", nameKeywords: ["HDFC BANK"] },
  "ICICIBANK": { scripCode: "532174", nameKeywords: ["ICICI BANK"] },
  "INFY": { scripCode: "500209", nameKeywords: ["INFOSYS"] },
  "BHARTIARTL": { scripCode: "532454", nameKeywords: ["BHARTI AIRTEL", "AIRTEL"] },
  "SBIN": { scripCode: "500112", nameKeywords: ["STATE BANK OF INDIA", "STATE BANK", "SBIN"] },
  "LICI": { scripCode: "543526", nameKeywords: ["LIFE INSURANCE CORPORATION", "LIC OF INDIA", "LICI"] },
  "ITC": { scripCode: "500875", nameKeywords: ["ITC LTD", "ITC LIMITED"] },
  "HINDUNILVR": { scripCode: "500696", nameKeywords: ["HINDUSTAN UNILEVER", "HUL"] },
  "LT": { scripCode: "500510", nameKeywords: ["LARSEN & TOUBRO", "LARSEN AND TOUBRO", "L&T"] },
  "BAJFINANCE": { scripCode: "500034", nameKeywords: ["BAJAJ FINANCE"] },
  "HCLTECH": { scripCode: "532281", nameKeywords: ["HCL TECHNOLOGIES", "HCL TECH"] },
  "WIPRO": { scripCode: "507685", nameKeywords: ["WIPRO LIMITED", "WIPRO"] },
  "MARUTI": { scripCode: "532500", nameKeywords: ["MARUTI SUZUKI"] },
  "SUNPHARMA": { scripCode: "524715", nameKeywords: ["SUN PHARMACEUTICAL", "SUN PHARMA"] },
  "ADANIENT": { scripCode: "512599", nameKeywords: ["ADANI ENTERPRISES"] },
  "KOTAKBANK": { scripCode: "500247", nameKeywords: ["KOTAK MAHINDRA BANK", "KOTAK BANK"] },
  "TITAN": { scripCode: "500114", nameKeywords: ["TITAN COMPANY", "TITAN"] },
  "ONGC": { scripCode: "500312", nameKeywords: ["OIL AND NATURAL GAS", "ONGC"] },
  "TATAMOTORS": { scripCode: "500570", nameKeywords: ["TATA MOTORS"] },
  "NTPC": { scripCode: "532555", nameKeywords: ["NTPC"] },
  "AXISBANK": { scripCode: "532215", nameKeywords: ["AXIS BANK"] },
  "DMART": { scripCode: "540376", nameKeywords: ["AVENUE SUPERMARTS", "DMART"] },
  "ADANIPORTS": { scripCode: "532921", nameKeywords: ["ADANI PORTS", "ADANI PORT"] },
  "ULTRACEMCO": { scripCode: "532538", nameKeywords: ["ULTRATECH CEMENT"] },
  "ASIANPAINT": { scripCode: "500820", nameKeywords: ["ASIAN PAINTS", "ASIAN PAINT"] },
  "COALINDIA": { scripCode: "533278", nameKeywords: ["COAL INDIA"] },
  "BAJAJFINSV": { scripCode: "532978", nameKeywords: ["BAJAJ FINSERV"] },
  "BAJAJ-AUTO": { scripCode: "532977", nameKeywords: ["BAJAJ AUTO"] },
  "BAJAJAUTO": { scripCode: "532977", nameKeywords: ["BAJAJ AUTO"] },
  "POWERGRID": { scripCode: "532898", nameKeywords: ["POWER GRID CORPORATION", "POWERGRID"] },
  "NESTLEIND": { scripCode: "500790", nameKeywords: ["NESTLE INDIA", "NESTLE"] },
  "M&M": { scripCode: "500520", nameKeywords: ["MAHINDRA & MAHINDRA", "MAHINDRA AND MAHINDRA", "M&M"] },
  "HAL": { scripCode: "541154", nameKeywords: ["HINDUSTAN AERONAUTICS", "HAL"] },
  "JIOFIN": { scripCode: "543940", nameKeywords: ["JIO FINANCIAL SERVICES", "JIOFIN"] },
  "TATASTEEL": { scripCode: "500470", nameKeywords: ["TATA STEEL"] },
  "SIEMENS": { scripCode: "500550", nameKeywords: ["SIEMENS"] },
  "IRFC": { scripCode: "543257", nameKeywords: ["INDIAN RAILWAY FINANCE", "IRFC"] },
  "VBL": { scripCode: "540180", nameKeywords: ["VARUN BEVERAGES", "VBL"] },
  "ZOMATO": { scripCode: "543320", nameKeywords: ["ZOMATO", "ETERNAL"] },
  "ETERNAL": { scripCode: "543320", nameKeywords: ["ZOMATO", "ETERNAL"] },
  "PIDILITIND": { scripCode: "500331", nameKeywords: ["PIDILITE INDUSTRIES", "PIDILITE"] },
  "GRASIM": { scripCode: "500300", nameKeywords: ["GRASIM INDUSTRIES", "GRASIM"] },
  "SBILIFE": { scripCode: "540719", nameKeywords: ["SBI LIFE INSURANCE", "SBI LIFE"] },
  "BEL": { scripCode: "500049", nameKeywords: ["BHARAT ELECTRONICS", "BEL"] },
  "HINDALCO": { scripCode: "500440", nameKeywords: ["HINDALCO INDUSTRIES", "HINDALCO"] },
  "TRENT": { scripCode: "500251", nameKeywords: ["TRENT"] },
  "INDIGO": { scripCode: "539448", nameKeywords: ["INTERGLOBE AVIATION", "INDIGO"] },
  "LTIM": { scripCode: "540005", nameKeywords: ["LTIMINDTREE", "LTI MINDTREE"] },
  "BANKBARODA": { scripCode: "532134", nameKeywords: ["BANK OF BARODA", "BOB"] },
  "HDFCLIFE": { scripCode: "540777", nameKeywords: ["HDFC LIFE INSURANCE", "HDFC LIFE"] },
  "PNB": { scripCode: "532461", nameKeywords: ["PUNJAB NATIONAL BANK", "PNB"] },
  "PFC": { scripCode: "532810", nameKeywords: ["POWER FINANCE CORPORATION", "POWER FINANCE"] },
  "NATIONALUM": { scripCode: "532234", nameKeywords: ["NATIONAL ALUMINIUM", "NALCO"] },
  "ASHOKLEY": { scripCode: "500477", nameKeywords: ["ASHOK LEYLAND"] },
  "UNIONBANK": { scripCode: "532477", nameKeywords: ["UNION BANK OF INDIA", "UNION BANK"] },
  "CHOLAFIN": { scripCode: "511243", nameKeywords: ["CHOLAMANDALAM INVESTMENT", "CHOLAMANDALAM", "CHOLA FINANCE"] },
  "BHEL": { scripCode: "500103", nameKeywords: ["BHARAT HEAVY ELECTRICALS", "BHEL"] },
  "SRF": { scripCode: "503806", nameKeywords: ["SRF LIMITED", "SRF"] },
  "CGPOWER": { scripCode: "500093", nameKeywords: ["CG POWER AND INDUSTRIAL", "CG POWER"] },
  "KPITTECH": { scripCode: "542651", nameKeywords: ["KPIT TECHNOLOGIES", "KPIT TECH"] },
  "TVSMOTOR": { scripCode: "532343", nameKeywords: ["TVS MOTOR"] },
  "SOLARINDS": { scripCode: "532725", nameKeywords: ["SOLAR INDUSTRIES"] },
  "MOTHERSON": { scripCode: "517334", nameKeywords: ["SAMVARDHANA MOTHERSON", "MOTHERSON SUMI", "MOTHERSON"] },
  "GIPCL": { scripCode: "517300", nameKeywords: ["GUJARAT INDUSTRIES POWER", "GIPCL"] },
  "KALYANKJIL": { scripCode: "543278", nameKeywords: ["KALYAN JEWELLERS"] },
  "CANBK": { scripCode: "532483", nameKeywords: ["CANARA BANK"] },
  "RBLBANK": { scripCode: "540065", nameKeywords: ["RBL BANK"] },
  "FEDERALBNK": { scripCode: "500469", nameKeywords: ["FEDERAL BANK"] },
  "CIPLA": { scripCode: "500087", nameKeywords: ["CIPLA"] },
  "TIINDIA": { scripCode: "540762", nameKeywords: ["TUBE INVESTMENTS"] },
  "NAUKRI": { scripCode: "532777", nameKeywords: ["INFO EDGE", "NAUKRI"] },
  "INDIANB": { scripCode: "532814", nameKeywords: ["INDIAN BANK"] },
  "ICICIPRULI": { scripCode: "540133", nameKeywords: ["ICICI PRUDENTIAL"] },
  "HDFCAMC": { scripCode: "541729", nameKeywords: ["HDFC ASSET MANAGEMENT", "HDFC AMC"] },
  "SHRIRAMFIN": { scripCode: "511218", nameKeywords: ["SHRIRAM FINANCE", "SHRIRAM TRANSPORT"] },
  "CUMMINSIND": { scripCode: "500480", nameKeywords: ["CUMMINS INDIA"] },
  "ABCAPITAL": { scripCode: "540691", nameKeywords: ["ADITYA BIRLA CAPITAL", "AB CAPITAL"] },
  "ICICIGI": { scripCode: "540716", nameKeywords: ["ICICI LOMBARD", "ICICIGI"] },
  "UPL": { scripCode: "512070", nameKeywords: ["UPL LIMITED", "UPL"] },
  "MARICO": { scripCode: "531642", nameKeywords: ["MARICO"] },
  "DIXON": { scripCode: "540699", nameKeywords: ["DIXON TECHNOLOGIES", "DIXON"] },
  "BHARATFORG": { scripCode: "500493", nameKeywords: ["BHARAT FORGE"] },
  "GODREJPROP": { scripCode: "533150", nameKeywords: ["GODREJ PROPERTIES"] },
  "GODREJCP": { scripCode: "532424", nameKeywords: ["GODREJ CONSUMER PRODUCTS", "GODREJ CONSUMER"] },
  "GODREJIND": { scripCode: "500164", nameKeywords: ["GODREJ INDUSTRIES"] },
  "KANSAINER": { scripCode: "500165", nameKeywords: ["KANSAI NEROLAC", "NEROLAC"] },
  "NBCC": { scripCode: "534309", nameKeywords: ["NBCC (INDIA)", "NBCC"] },
  "ZYDUSLIFE": { scripCode: "532321", nameKeywords: ["ZYDUS LIFESCIENCES", "ZYDUS CADILA", "ZYDUS LIFE"] },
  "PAGEIND": { scripCode: "532827", nameKeywords: ["PAGE INDUSTRIES"] },
  "JUBLFOOD": { scripCode: "533155", nameKeywords: ["JUBILANT FOODWORKS", "JUBILANT FOOD"] },
  "ALKEM": { scripCode: "539523", nameKeywords: ["ALKEM LABORATORIES", "ALKEM LAB"] },
  "ASTRAL": { scripCode: "532830", nameKeywords: ["ASTRAL LIMITED", "ASTRAL POLY"] },
  "RVNL": { scripCode: "542649", nameKeywords: ["RAIL VIKAS NIGAM", "RVNL"] },
  "SUZLON": { scripCode: "532667", nameKeywords: ["SUZLON ENERGY", "SUZLON"] },
  "PAYTM": { scripCode: "543396", nameKeywords: ["ONE 97 COMMUNICATIONS", "PAYTM"] },
  "POLICYBZR": { scripCode: "543390", nameKeywords: ["PB FINTECH", "POLICYBAZAAR"] },
  "NYKAA": { scripCode: "543384", nameKeywords: ["FSN E-COMMERCE", "NYKAA"] },
  "SWIGGY": { scripCode: "544285", nameKeywords: ["SWIGGY"] },
  "MAZDOCK": { scripCode: "543237", nameKeywords: ["MAZAGON DOCK"] },
  "COCHINSHIP": { scripCode: "540678", nameKeywords: ["COCHIN SHIPYARD"] },
  "SAIL": { scripCode: "500113", nameKeywords: ["STEEL AUTHORITY OF INDIA", "SAIL"] },
  "NMDC": { scripCode: "526371", nameKeywords: ["NMDC"] },
  "GAIL": { scripCode: "532155", nameKeywords: ["GAIL (INDIA)", "GAIL"] },
  "DLF": { scripCode: "532868", nameKeywords: ["DLF LIMITED", "DLF"] },
  "RECLTD": { scripCode: "532955", nameKeywords: ["REC LIMITED", "REC LTD"] },
  "MUTHOOTFIN": { scripCode: "533398", nameKeywords: ["MUTHOOT FINANCE"] },
  "PERSISTENT": { scripCode: "533179", nameKeywords: ["PERSISTENT SYSTEMS"] },
  "COFORGE": { scripCode: "532541", nameKeywords: ["COFORGE", "NIIT TECH"] },
  "MPHASIS": { scripCode: "526299", nameKeywords: ["MPHASIS"] },
  "MCX": { scripCode: "534091", nameKeywords: ["MULTI COMMODITY EXCHANGE", "MCX"] },
  "CDSL": { scripCode: "540615", nameKeywords: ["CENTRAL DEPOSITARY SERVICES", "CDSL"] },
  "BSE": { scripCode: "540025", nameKeywords: ["BSE LIMITED"] },
  "IEX": { scripCode: "540750", nameKeywords: ["INDIAN ENERGY EXCHANGE", "IEX"] },
  "POLYCAB": { scripCode: "542652", nameKeywords: ["POLYCAB INDIA", "POLYCAB"] },
  "HAVELLS": { scripCode: "517354", nameKeywords: ["HAVELLS INDIA", "HAVELLS"] },
  "ADANIPOWER": { scripCode: "533096", nameKeywords: ["ADANI POWER", "ADANIPOWER"] },
  "ADANIGREEN": { scripCode: "541450", nameKeywords: ["ADANI GREEN", "ADANIGREEN"] },
  "ATGL": { scripCode: "542066", nameKeywords: ["ADANI TOTAL GAS", "ATGL"] },
  "AWL": { scripCode: "543458", nameKeywords: ["ADANI WILMAR", "AWL"] },
  "IREDA": { scripCode: "544026", nameKeywords: ["INDIAN RENEWABLE ENERGY", "IREDA"] },
  "NHPC": { scripCode: "533098", nameKeywords: ["NHPC LIMITED", "NHPC"] },
  "SJVN": { scripCode: "533206", nameKeywords: ["SJVN LIMITED", "SJVN"] },
  "HUDCO": { scripCode: "540530", nameKeywords: ["HOUSING AND URBAN DEVELOPMENT", "HUDCO"] },
  "IRCTC": { scripCode: "542830", nameKeywords: ["INDIAN RAILWAY CATERING", "IRCTC"] },
  "RITES": { scripCode: "541556", nameKeywords: ["RITES LIMITED", "RITES"] },
  "BDL": { scripCode: "541143", nameKeywords: ["BHARAT DYNAMICS", "BDL"] },
  "KAYNES": { scripCode: "543664", nameKeywords: ["KAYNES TECHNOLOGY", "KAYNES"] },
  "TATAPOWER": { scripCode: "500400", nameKeywords: ["TATA POWER"] },
  "TATAELXSI": { scripCode: "500408", nameKeywords: ["TATA ELXSI"] },
  "TATACOMM": { scripCode: "500483", nameKeywords: ["TATA COMMUNICATIONS"] },
  "TATACHEM": { scripCode: "500770", nameKeywords: ["TATA CHEMICALS"] },
  "IDEA": { scripCode: "532822", nameKeywords: ["VODAFONE IDEA", "IDEA"] },
  "YESBANK": { scripCode: "532648", nameKeywords: ["YES BANK"] },
  "IDFCFIRSTB": { scripCode: "539437", nameKeywords: ["IDFC FIRST BANK", "IDFC FIRST"] },
  "BANDHANBNK": { scripCode: "541153", nameKeywords: ["BANDHAN BANK"] },
  "AUBANK": { scripCode: "540611", nameKeywords: ["AU SMALL FINANCE", "AU BANK"] },
  "ANGELONE": { scripCode: "543235", nameKeywords: ["ANGEL ONE", "ANGEL BROKING"] },
  "SONACOMS": { scripCode: "543300", nameKeywords: ["SONA BLW", "SONACOMS"] },
  "EXIDEIND": { scripCode: "500086", nameKeywords: ["EXIDE INDUSTRIES", "EXIDE"] },
  "AMARAJABAT": { scripCode: "500008", nameKeywords: ["AMARA RAJA", "AMARAJABAT"] },
  "OLECTRA": { scripCode: "532439", nameKeywords: ["OLECTRA GREENTECH", "OLECTRA"] },
  "JBMMA": { scripCode: "532605", nameKeywords: ["JBM AUTO", "JBMA"] },
  "JBMA": { scripCode: "532605", nameKeywords: ["JBM AUTO", "JBMA"] },
  "INOXWIND": { scripCode: "539083", nameKeywords: ["INOX WIND"] },
  "DEEPAKNTR": { scripCode: "506401", nameKeywords: ["DEEPAK NITRITE"] },
  "PIIND": { scripCode: "523642", nameKeywords: ["PI INDUSTRIES"] },
  "AARTIIND": { scripCode: "524208", nameKeywords: ["AARTI INDUSTRIES"] },
  "NAVINFLUOR": { scripCode: "532504", nameKeywords: ["NAVIN FLUORINE"] },
  "FLUOROCHEM": { scripCode: "542812", nameKeywords: ["GUJARAT FLUOROCHEMICALS", "FLUOROCHEM"] },
  "CLEAN": { scripCode: "543318", nameKeywords: ["CLEAN SCIENCE"] },
  "PETRONET": { scripCode: "532522", nameKeywords: ["PETRONET LNG", "PETRONET"] },
  "IGL": { scripCode: "532514", nameKeywords: ["INDRAPRASTHA GAS", "IGL"] },
  "MGL": { scripCode: "539957", nameKeywords: ["MAHANAGAR GAS", "MGL"] },
  "GUJGASLTD": { scripCode: "539336", nameKeywords: ["GUJARAT GAS"] },
  "OIL": { scripCode: "533106", nameKeywords: ["OIL INDIA"] },
  "CONCOR": { scripCode: "531344", nameKeywords: ["CONTAINER CORPORATION", "CONCOR"] },
  "KEI": { scripCode: "517569", nameKeywords: ["KEI INDUSTRIES"] },
  "VOLTAS": { scripCode: "500575", nameKeywords: ["VOLTAS"] },
  "BLUESTARCO": { scripCode: "500067", nameKeywords: ["BLUE STAR"] },
  "AMBER": { scripCode: "540902", nameKeywords: ["AMBER ENTERPRISES", "AMBER"] },
  "CROMPTON": { scripCode: "539876", nameKeywords: ["CROMPTON GREAVES", "CROMPTON"] },
  "RADICO": { scripCode: "532497", nameKeywords: ["RADICO KHAITAN", "RADICO"] },
  "SULA": { scripCode: "543711", nameKeywords: ["SULA VINEYARDS", "SULA"] },
  "DEVYANI": { scripCode: "543330", nameKeywords: ["DEVYANI INTERNATIONAL", "DEVYANI"] },
  "WESTLIFE": { scripCode: "505533", nameKeywords: ["WESTLIFE FOODWORLD", "WESTLIFE"] },
  "EICHERMOT": { scripCode: "505200", nameKeywords: ["EICHER MOTORS"] },
  "ESCORTS": { scripCode: "500495", nameKeywords: ["ESCORTS KUBOTA", "ESCORTS"] },
  "BALKRISIND": { scripCode: "502355", nameKeywords: ["BALKRISHNA INDUSTRIES", "BKT"] },
  "MRF": { scripCode: "500290", nameKeywords: ["MRF LIMITED", "MRF"] },
  "APOLLOTYRE": { scripCode: "500877", nameKeywords: ["APOLLO TYRES"] },
  "CEAT": { scripCode: "500878", nameKeywords: ["CEAT LIMITED", "CEAT"] },
  "BSOFT": { scripCode: "532400", nameKeywords: ["BIRLASOFT", "BSOFT"] },
  "CYIENT": { scripCode: "532175", nameKeywords: ["CYIENT LIMITED", "CYIENT"] },
  "LTTS": { scripCode: "540115", nameKeywords: ["L&T TECHNOLOGY SERVICES", "LTTS"] },
  "POONAWALLA": { scripCode: "524000", nameKeywords: ["POONAWALLA FINCORP", "POONAWALLA"] },
  "MANAPPURAM": { scripCode: "531213", nameKeywords: ["MANAPPURAM FINANCE"] },
  "LICHSGFIN": { scripCode: "500253", nameKeywords: ["LIC HOUSING FINANCE"] },
  "PNBHOUSING": { scripCode: "540173", nameKeywords: ["PNB HOUSING FINANCE"] },
  "CANFINHOME": { scripCode: "511196", nameKeywords: ["CAN FIN HOMES"] },
  "AAVAS": { scripCode: "541988", nameKeywords: ["AAVAS FINANCIERS", "AAVAS"] },
  "HOMEFIRST": { scripCode: "543259", nameKeywords: ["HOME FIRST FINANCE", "HOMEFIRST"] },
  "SBICARD": { scripCode: "543066", nameKeywords: ["SBI CARDS", "SBICARD"] },
  "HINDZINC": { scripCode: "500188", nameKeywords: ["HINDUSTAN ZINC"] },
  "AMBUJACEM": { scripCode: "500425", nameKeywords: ["AMBUJA CEMENTS"] },
  "ACC": { scripCode: "500410", nameKeywords: ["ACC LIMITED", "ACC"] },
  "INDUSINDBK": { scripCode: "532209", nameKeywords: ["INDUSIND BANK"] },
  "TECHM": { scripCode: "532755", nameKeywords: ["TECH MAHINDRA"] },
  "ABB": { scripCode: "500002", nameKeywords: ["ABB INDIA"] },
  "BPCL": { scripCode: "500547", nameKeywords: ["BHARAT PETROLEUM", "BPCL"] },
  "IOC": { scripCode: "530965", nameKeywords: ["INDIAN OIL CORPORATION", "IOCL", "IOC"] },
  "HPCL": { scripCode: "500104", nameKeywords: ["HINDUSTAN PETROLEUM", "HPCL"] },
  "BIKAJI": { scripCode: "543653", nameKeywords: ["BIKAJI FOODS", "BIKAJI"] },
  "PVRINOX": { scripCode: "532689", nameKeywords: ["PVR INOX", "PVR"] },
  "DELTACORP": { scripCode: "532848", nameKeywords: ["DELTA CORP"] },
  "IRB": { scripCode: "532947", nameKeywords: ["IRB INFRASTRUCTURE", "IRB"] },
  "NCC": { scripCode: "500294", nameKeywords: ["NCC LIMITED", "NCC"] },
  "GMRINFRA": { scripCode: "532754", nameKeywords: ["GMR AIRPORTS", "GMR INFRASTRUCTURE", "GMRINFRA"] },
  "SUVENPHAR": { scripCode: "543064", nameKeywords: ["SUVEN PHARMACEUTICALS", "SUVENPHAR"] },
  "GRANULES": { scripCode: "532482", nameKeywords: ["GRANULES INDIA"] },
  "GLENMARK": { scripCode: "532296", nameKeywords: ["GLENMARK PHARMACEUTICALS", "GLENMARK"] },
  "BIOCON": { scripCode: "532523", nameKeywords: ["BIOCON LIMITED", "BIOCON"] },
  "LAURUSLABS": { scripCode: "540222", nameKeywords: ["LAURUS LABS"] },
  "IPCALAB": { scripCode: "524494", nameKeywords: ["IPCA LABORATORIES", "IPCALAB"] },
  "DIVISLAB": { scripCode: "532488", nameKeywords: ["DIVIS LABORATORIES", "DIVIS LAB"] },
  "DRREDDY": { scripCode: "500124", nameKeywords: ["DR REDDY", "DR. REDDY"] },
  "APOLLOHOSP": { scripCode: "508869", nameKeywords: ["APOLLO HOSPITALS"] },
  "FORTIS": { scripCode: "532843", nameKeywords: ["FORTIS HEALTHCARE", "FORTIS"] },
  "MAXHEALTH": { scripCode: "543220", nameKeywords: ["MAX HEALTHCARE"] },
  "MEDANTA": { scripCode: "543654", nameKeywords: ["GLOBAL HEALTH", "MEDANTA"] },
  "LALPATHLAB": { scripCode: "539524", nameKeywords: ["DR. LAL PATHLABS", "LALPATHLAB"] },
  "METROPOLIS": { scripCode: "542650", nameKeywords: ["METROPOLIS HEALTHCARE"] }
};

// Helpers for extracting item info
export function parseSymbolItem(item: any): WatchlistStockItem {
  if (typeof item === 'string') {
    return { symbol: item.trim().toUpperCase(), priority: 'HIGH' };
  }
  if (typeof item === 'object' && item.symbol) {
    const p = String(item.priority || 'HIGH').toUpperCase();
    const validP: StockPriority = (p === 'MEDIUM' || p === 'MED') ? 'MEDIUM' : p === 'LOW' ? 'LOW' : 'HIGH';
    return {
      symbol: String(item.symbol).trim().toUpperCase(),
      priority: validP,
      category: item.category ? String(item.category).trim() : undefined,
      notes: item.notes
    };
  }
  return { symbol: '', priority: 'HIGH' };
}

const symbolToScripCache: Record<string, string> = {};
const scripToSymbolCache: Record<string, string> = {};

for (const [sym, entry] of Object.entries(stockMasterClient)) {
  symbolToScripCache[sym] = entry.scripCode;
  scripToSymbolCache[entry.scripCode] = sym;
}

function getScripCodeClient(input: string): string | undefined {
  if (!input) return undefined;
  const clean = input.trim().toUpperCase();
  if (!clean) return undefined;
  if (/^\d{6}$/.test(clean)) return clean;
  if (symbolToScripCache[clean]) return symbolToScripCache[clean];
  return undefined;
}

const CONGLOMERATE_GROUP_KEYWORDS_CLIENT = new Set([
  'RELIANCE', 'TATA', 'ADANI', 'BAJAJ', 'BIRLA', 'MAHINDRA', 'GODREJ', 'L&T', 'LT', 'HIND', 
  'INDIA', 'BHARAT', 'NATIONAL', 'SHREE', 'JINDAL', 'TORRENT', 'VEDANTA', 'KALYAN', 
  'HERO', 'MUTHOOT', 'APOLLO', 'SUNDARAM', 'CHOLA'
]);

function checkSymbolMatchFast(
  companyName: string = '', 
  subject: string = '', 
  targetSymbol: string = '', 
  scripCd?: string | number
): boolean {
  if (!targetSymbol) return false;
  const sym = targetSymbol.toUpperCase().trim();
  if (!sym) return false;

  const annScrip = scripCd ? String(scripCd).trim() : '';

  // 1. Direct Scrip Code exact match & disambiguation
  const targetScrip = getScripCodeClient(sym);
  if (targetScrip && annScrip) {
    if (annScrip === targetScrip) {
      return true;
    }
    // If BOTH have valid 6-digit BSE scrip codes and they are different, they are definitely distinct companies
    if (/^\d{6}$/.test(annScrip) && /^\d{6}$/.test(targetScrip)) {
      return false;
    }
  }

  // If target symbol itself is a 6-digit scrip code
  if (/^\d{6}$/.test(sym) && annScrip) {
    return annScrip === sym;
  }

  const comp = (companyName || '').toUpperCase();
  const subj = (subject || '').toUpperCase();

  // 2. Conglomerate / Ambiguous Group Name Protection
  const isConglomerate = CONGLOMERATE_GROUP_KEYWORDS_CLIENT.has(sym) || CONGLOMERATE_GROUP_KEYWORDS_CLIENT.has(sym.replace(/[\s-]/g, ''));
  const master = stockMasterClient[sym] || stockMasterClient[sym.replace(/[\s-]/g, '')];

  if (isConglomerate) {
    if (annScrip && /^\d{6}$/.test(annScrip) && targetScrip && /^\d{6}$/.test(targetScrip)) {
      return annScrip === targetScrip;
    }

    if (master && master.nameKeywords) {
      for (let k = 0; k < master.nameKeywords.length; k++) {
        const kw = master.nameKeywords[k].trim().toUpperCase();
        if (kw === sym) continue;
        const kwRegex = new RegExp(`(?:^|\\s|\\b)${kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(?:\\s|\\b|$)`, 'i');
        if (kwRegex.test(comp) || kwRegex.test(subj)) {
          return true;
        }
      }
    }
    return false;
  }

  // 3. Exact word boundaries in company name & subject for unique tickers
  if (sym.length >= 2) {
    const symRegex = new RegExp(`(?:^|\\s|\\b)${sym.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(?:\\s|\\b|$)`, 'i');
    if (symRegex.test(comp) || symRegex.test(subj)) {
      return true;
    }
  }

  // 4. Stock master alias keywords
  if (master && master.nameKeywords) {
    for (let k = 0; k < master.nameKeywords.length; k++) {
      const kw = master.nameKeywords[k];
      if (comp.includes(kw) || subj.includes(kw)) {
        return true;
      }
    }
  }

  return false;
}

// Swipeable Card Wrapper for Touch & Mobile Gestures
const SwipeableFilingCard: React.FC<{
  children: React.ReactNode;
  onSwipeLeft?: () => void; // Trigger AI
  onSwipeRight?: () => void; // Trigger Telegram
  onClick?: () => void;
  className?: string;
  isSent?: boolean;
}> = ({ children, onSwipeLeft, onSwipeRight, onClick, className, isSent }) => {
  const [offsetX, setOffsetX] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isSwiping = useRef(false);
  const isHorizontal = useRef<boolean | null>(null);

  const resetCard = () => {
    setOffsetX(0);
    touchStartX.current = null;
    touchStartY.current = null;
    isSwiping.current = false;
    isHorizontal.current = null;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = false;
    isHorizontal.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = e.touches[0].clientX - touchStartX.current;
    const diffY = e.touches[0].clientY - touchStartY.current;

    // Detect direction intent on initial movement
    if (isHorizontal.current === null) {
      if (Math.abs(diffX) > 8 || Math.abs(diffY) > 8) {
        if (Math.abs(diffX) > Math.abs(diffY)) {
          isHorizontal.current = true;
          isSwiping.current = true;
        } else {
          isHorizontal.current = false;
          setOffsetX(0);
          return;
        }
      }
    }

    if (isHorizontal.current === true) {
      isSwiping.current = true;
      const clampedX = Math.max(-110, Math.min(110, diffX));
      setOffsetX(clampedX);
    } else if (isHorizontal.current === false) {
      setOffsetX(0);
    }
  };

  const handleTouchEnd = () => {
    if (offsetX < -60) {
      onSwipeLeft?.();
    } else if (offsetX > 60) {
      if (window.confirm('Send this filing to Telegram channel?')) {
        onSwipeRight?.();
      }
    }
    resetCard();
  };

  return (
    <div className="relative overflow-hidden group h-full">
      {/* Background action reveal bars */}
      <div 
        className={cn(
          "absolute inset-0 flex items-center justify-between px-4 transition-opacity pointer-events-none z-0",
          offsetX !== 0 ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Left reveal: Telegram (Swiping Right) */}
        <div className={cn(
          "flex items-center gap-1.5 text-[11px] font-extrabold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/80 px-3 py-1.5 rounded-lg border border-sky-300 dark:border-sky-800 transition-transform shadow-xs",
          offsetX > 0 ? "scale-100 opacity-100" : "scale-75 opacity-0"
        )}>
          <Send size={13} />
          <span>{isSent ? "Resend Telegram" : "Send Telegram"}</span>
        </div>

        {/* Right reveal: AI Summary (Swiping Left) */}
        <div className={cn(
          "flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 transition-transform ml-auto shadow-xs",
          offsetX < 0 ? "scale-100 opacity-100" : "scale-75 opacity-0"
        )}>
          <Sparkles size={13} className="text-amber-500" />
          <span>Analyze AI</span>
        </div>
      </div>

      {/* Main Card Surface */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={resetCard}
        onClick={() => {
          if (!isSwiping.current) {
            onClick?.();
          }
        }}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: offsetX === 0 ? 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)' : 'none'
        }}
        className={cn("relative z-10 bg-white dark:bg-[#1A1926] cursor-pointer h-full", className)}
      >
        {children}
      </div>
    </div>
  );
};

export function WatchlistManager() {
  const { user, profile, isPro, isAdmin, adminUnlocked, setIsAuthModalOpen, setIsProModalOpen } = useAuth();
  const [watchlists, setWatchlists] = useState<any[]>([]);
  const [activeListId, setActiveListId] = useState<string>('ALL');
  const [newListName, setNewListName] = useState('');
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [newPriority, setNewPriority] = useState<StockPriority>('HIGH');
  const [newCategory, setNewCategory] = useState<string>('');
  
  // Mutex lock to prevent duplicate stock adds on multi-clicks or suggestions enter
  const isAddingSymbolRef = useRef(false);

  // Toast notification for newly added stock
  const [lastAddedInfo, setLastAddedInfo] = useState<{
    symbol: string;
    companyName?: string;
    listName: string;
    priority: StockPriority;
    timestamp: number;
  } | null>(null);

  // Sub-Tab Navigation state: 'companies' (default, lists tracked companies with search & add), 'updates' (feed of disclosures), or 'edit' (edit watchlists & priorities)
  const [watchlistSubTab, setWatchlistSubTab] = useState<'companies' | 'updates' | 'edit'>('companies');
  const [companySearch, setCompanySearch] = useState<string>('');
  const [isAddCompanyOpen, setIsAddCompanyOpen] = useState<boolean>(false);

  // Highlighted symbol animation state
  const [highlightedSymbol, setHighlightedSymbol] = useState<string | null>(null);

  // Target list when adding from ALL panel
  const [allPanelTargetListId, setAllPanelTargetListId] = useState<string>('');

  // Filtering states for symbols inside list
  const [symbolPriorityFilter, setSymbolPriorityFilter] = useState<'ALL' | StockPriority>('ALL');
  const [symbolSearchQuery, setSymbolSearchQuery] = useState('');

  // Dropdown menu & Safe Confirmation Modal states
  const [openMenuForList, setOpenMenuForList] = useState<string | null>(null);
  const listMenuRef = useRef<HTMLDivElement | null>(null);
  const allMenuRef = useRef<HTMLDivElement | null>(null);

  // Close the list-options dropdown on outside pointer-down WITHOUT swallowing
  // the click — the underlying button still receives it (no blocking overlay).
  useEffect(() => {
    if (!openMenuForList) return;
    const onPointerDown = (e: PointerEvent) => {
      const inListMenu = listMenuRef.current?.contains(e.target as Node);
      const inAllMenu = allMenuRef.current?.contains(e.target as Node);
      if (!inListMenu && !inAllMenu) {
        setOpenMenuForList(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenuForList(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openMenuForList]);
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionType: 'clear_list' | 'clear_all' | 'reset_defaults';
    listId?: string;
    listName?: string;
    stockCount?: number;
  } | null>(null);

  // Disclosures Feed states
  const [announcements, setAnnouncements] = useState<any[]>(() => {
    // Show last cached feed instantly on login; fresh data replaces it in background.
    try {
      const cached = localStorage.getItem('bsenexus_watchlist_feed');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed.items) && Date.now() - (parsed.ts || 0) < 30 * 60 * 1000) {
          return parsed.items;
        }
      }
    } catch { /* ignore corrupt cache */ }
    return [];
  });
  const [selectedStockFilter, setSelectedStockFilter] = useState<string | null>(null);
  const [announcementCategory, setAnnouncementCategory] = useState<string>('ALL');
  const [announcementPriorityFilter, setAnnouncementPriorityFilter] = useState<string>('ALL');
  const [announcementSearch, setAnnouncementSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'priority' | 'az'>('newest');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState<boolean>(false);
  const [symbolFilterSearch, setSymbolFilterSearch] = useState<string>('');
  const [isSmartClustering, setIsSmartClustering] = useState<boolean>(true);
  const [expandedClusters, setExpandedClusters] = useState<Record<string, boolean>>({});
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any | null>(null);
  useBodyScrollLock(Boolean(selectedAnnouncement || confirmModalState?.isOpen || isFilterDrawerOpen));
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Responsive Grid / List view mode (Default Grid on PC/Tablet, List on Mobile)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('nexus_watchlist_view_mode');
      if (saved === 'grid' || saved === 'list') return saved;
      return window.innerWidth >= 768 ? 'grid' : 'list';
    }
    return 'grid';
  });

  const handleSetViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('nexus_watchlist_view_mode', mode);
    }
  };

  const toggleCluster = (clusterId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedClusters(prev => ({
      ...prev,
      [clusterId]: !prev[clusterId]
    }));
  };
  
  // Async states
  const [isSyncingWatchlists, setIsSyncingWatchlists] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editListName, setEditListName] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // 3-4s Undo Toast for Safe Destructive Actions
  const [undoToast, setUndoToast] = useState<{
    id: string;
    message: string;
    onUndo: () => void | Promise<void>;
  } | null>(null);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    };
  }, []);

  const { openIntelModal } = useIntelModal();

  // Sync Watchlists historical data
  const handleOpenIntel = (scripCode?: string, symbol?: string, companyName?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    openIntelModal({ scripCode, symbol: symbol || companyName, companyName: companyName || symbol });
  };

  const handleSyncWatchlists = async (mode: 'quick' | 'full' = 'quick') => {
    setIsSyncingWatchlists(true);
    try {
      if (mode === 'full') {
        // Run full library historical sync in background non-blocking
        await customFetch('/api/watchlists/sync?mode=background', { method: 'POST' });
        await fetchAnnouncements();
        setLastAddedInfo({
          symbol: 'Background Sync Started',
          companyName: 'Full BSE deep sync running seamlessly in background',
          listName: 'BSE India Feed',
          priority: 'HIGH',
          timestamp: Date.now()
        });
        setTimeout(() => setLastAddedInfo(null), 5000);
      } else {
        // Quick reload & refresh
        await fetchAnnouncements();
        await fetchWatchlists();
        setLastAddedInfo({
          symbol: 'Watchlist Refreshed',
          companyName: 'Instant fresh feed & active stock sync complete',
          listName: 'Live Stream',
          priority: 'HIGH',
          timestamp: Date.now()
        });
        setTimeout(() => setLastAddedInfo(null), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncingWatchlists(false);
    }
  };

  // Native Pull to Refresh Hook for Watchlists
  const { 
    containerRef: watchlistContainerRef, 
    pullDistance: watchlistPullDist, 
    isPulling: isWatchlistPulling, 
    isRefreshing: isWatchlistRefreshing, 
    progress: watchlistPullProg 
  } = usePullToRefresh<HTMLDivElement>({
    onRefresh: async () => {
      await handleSyncWatchlists('quick');
    }
  });

  const isProOrAdmin = Boolean(isAdmin || (isPro && !user?.isAnonymous) || profile?.tier === 'admin');
  const aiQuota = useAiQuota(user, profile, isPro, isAdmin);

  const handleManualSendTelegram = async (item: any) => {
    if (!item) return;

    if (!isProOrAdmin) {
      if (!user || user.isAnonymous) {
        setIsAuthModalOpen(true);
        alert('🔒 Google Sign-In Required: Sign in with Google to activate your 1-Week Free Pro trial to broadcast to Telegram!');
      } else {
        setIsProModalOpen(true);
        alert('🔒 Direct Telegram Broadcasting is a Pro feature.\n\nYour 1-Week Free Pro trial has ended. Upgrade to Pro (₹199/mo) to dispatch instant alerts to Telegram!');
      }
      return;
    }

    setIsSendingTelegram(true);
    setTelegramStatus(null);

    try {
      const res = await customFetch('/api/send-to-telegram-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newsId: item.id,
          companyName: item.companyName,
          subject: item.subject,
          details: item.details || item.headline || '',
          category: item.category || 'OTHER',
          pdfLink: item.pdfLink || item.attachmentUrl || '',
          scripCode: item.scrip_cd
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTelegramStatus('Dispatched to Telegram Channel!');
        setSelectedAnnouncement((prev: any) => prev && prev.id === item.id ? { ...prev, is_sent: 1 } : prev);
        setAnnouncements((prev: any[]) => prev.map(a => a.id === item.id ? { ...a, is_sent: 1 } : a));
      } else {
        alert(data.error || 'Failed to send alert to Telegram');
      }
    } catch (err: any) {
      alert('Failed to send to Telegram: ' + err.message);
    } finally {
      setIsSendingTelegram(false);
    }
  };

  const handleGenerateSummary = async (id: string) => {
    const isGuestUser = !user || user.isAnonymous;
    if (isGuestUser) {
      setIsAuthModalOpen(true);
      alert('🔒 Google Sign-In Required: Sign in with Google to get 1 week (7 days) of Free Pro AI summaries!');
      return;
    }

    if (!isProOrAdmin) {
      setIsProModalOpen(true);
      alert('🔒 1-Week Free Pro trial has ended. Upgrade to Pro (₹199/mo) for unlimited Gemini AI summaries!');
      return;
    }

    if (!aiQuota.canGenerate) {
      alert('🔒 Daily Pro AI limit reached (100 summaries/day). Resets at 00:00 IST.');
      return;
    }

    setIsGeneratingSummary(true);
    try {
      const response = await customFetch(`/api/announcements/${id}/generate-summary`, { method: 'POST' });
      const data = await response.json().catch(() => null);

      if (response.status === 401 || data?.authRequired) {
        setIsAuthModalOpen(true);
        alert(data?.error || '🔒 Google Sign-In Required: Sign in to enjoy 1 week of Free Pro AI features.');
        return;
      }

      if (response.status === 429) {
        syncQuotaFromResponse(data || { remainingQuota: 0 });
        const errMsg = data?.error || 'Daily AI summary quota reached.';
        alert(`🔒 ${errMsg}`);
        return;
      }

      if (response.ok && data && data.aiSummary) {
        syncQuotaFromResponse(data);
        setSelectedAnnouncement((prev: any) => prev && prev.id === id ? { ...prev, aiSummary: data.aiSummary } : prev);
        setAnnouncements((prev: any[]) => prev.map(a => a.id === id ? { ...a, aiSummary: data.aiSummary } : a));
      } else {
        const errMsg = data?.error || 'Failed to generate AI summary';
        alert(`⚠️ AI Summary Alert: ${errMsg}`);
      }
    } catch (e: any) {
      console.error(e);
      alert(`⚠️ AI processing error: ${e?.message || 'Connection error'}`);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const fetchWatchlists = async () => {
    if (!user && !profile) {
      setWatchlists([]);
      return;
    }
    try {
      const res = await customFetch('/api/watchlists');
      if (res.ok) {
        const data = await res.json();
        setWatchlists(data);
      }
    } catch (e) {
      console.error('Error fetching watchlists:', e);
    }
  };

  // Active symbols list across currently selected watchlist or all watchlists
  const activeSymbols = useMemo(() => {
    const currentWatchlist = watchlists.find(l => l.id === activeListId);
    if (currentWatchlist && activeListId !== 'ALL') {
      return (currentWatchlist.items || []).map((it: any) => parseSymbolItem(it).symbol).filter(Boolean);
    }
    return Array.from(new Set(watchlists.flatMap(l => (l.items || []).map((it: any) => parseSymbolItem(it).symbol).filter(Boolean))));
  }, [watchlists, activeListId]);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const symbolsToFetch = activeSymbols.length > 0
        ? activeSymbols
        : Array.from(new Set(watchlists.flatMap(l => (l.items || []).map((it: any) => parseSymbolItem(it).symbol).filter(Boolean))));

      // Feed size scales with the watchlist: ~25 filings per tracked stock
      // (same PER_STOCK_FILINGS as the per-company modal on the server).
      // The server further applies the "what's new" policy: last 7 days only,
      // max 25 per stock — so this limit is just a safety backstop.
      const PER_STOCK_FILINGS = 25;
      let url = '/api/announcements';
      if (symbolsToFetch.length > 0) {
        const limit = Math.min(2500, Math.max(PER_STOCK_FILINGS, symbolsToFetch.length * PER_STOCK_FILINGS));
        url += `?limit=${limit}&symbols=${encodeURIComponent(symbolsToFetch.join(','))}`;
      } else {
        url += '?limit=50';
      }

      const res = await customFetch(url);
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data);
        // Cache for instant display on next login (stale-while-revalidate).
        try {
          localStorage.setItem('bsenexus_watchlist_feed', JSON.stringify({ ts: Date.now(), items: data }));
        } catch { /* storage full or unavailable */ }
      }
    } catch (e) {
      console.warn("Error fetching announcements in WatchlistManager:", e);
    }
  }, [activeSymbols, watchlists]);

  // Shared 90s visibility-gated interval for watchlist feed:
  useVisibilityInterval(fetchAnnouncements, 90000);

  useEffect(() => {
    fetchWatchlists();

    const handleAuthChanged = () => {
      fetchWatchlists();
    };

    window.addEventListener('auth-state-changed', handleAuthChanged);
    return () => window.removeEventListener('auth-state-changed', handleAuthChanged);
  }, [user?.uid, profile?.uid]);

  useEffect(() => {
    fetchAnnouncements();
    // Load full stock master registry dynamically from server
    customFetch('/api/stock-master')
      .then(r => r.json())
      .then((data: any[]) => {
        if (Array.isArray(data)) {
          data.forEach(item => {
            if (item.symbol && item.scripCode) {
              symbolToScripCache[item.symbol] = item.scripCode;
              scripToSymbolCache[item.scripCode] = item.symbol;
              stockMasterClient[item.symbol] = {
                scripCode: item.scripCode,
                nameKeywords: item.nameKeywords || [item.name, item.symbol]
              };
            }
          });
        }
      })
      .catch(() => {});
  }, [fetchAnnouncements]);

  useEffect(() => {
    if (newSymbol.length < 2 || newSymbol.includes(',')) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await customFetch(`/api/search-company?q=${encodeURIComponent(newSymbol)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
          setShowSuggestions(true);
        }
      } catch (e) {
        setSearchResults([]);
      }
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [newSymbol]);

  const handleAddList = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newListName.trim();
    if (!name) return;

    if (!isProOrAdmin && watchlists.length >= 1) {
      if (!user && !profile) {
        setIsAuthModalOpen(true);
        alert('🔒 Creating multiple watchlists is a Pro feature.\n\nSign In to activate your 1-Week Free Pro Trial or Upgrade to Pro (₹199/mo)!');
      } else {
        setIsProModalOpen(true);
        alert('🔒 Free accounts are limited to 1 Watchlist.\n\nUpgrade to Pro (₹199/mo) to create unlimited custom watchlists, priority buckets, and industry sectors!');
      }
      return;
    }

    try {
      const res = await customFetch('/api/watchlists', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      setNewListName('');
      setIsCreatingList(false);
      await fetchWatchlists();
      if (data?.id) {
        setActiveListId(String(data.id));
        setAllPanelTargetListId(String(data.id));
      }
    } catch (err) {
      console.error('Error creating watchlist:', err);
    }
  };

  const handleRenameList = async (id: string) => {
    if (!editListName.trim()) {
      setEditingListId(null);
      return;
    }
    await customFetch(`/api/watchlists/${id}/name`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editListName.trim() })
    });
    setEditingListId(null);
    fetchWatchlists();
  };

  const handleDeleteList = async (id: string) => {
    const listToDelete = watchlists.find(w => String(w.id) === String(id));
    if (!listToDelete) return;
    if (confirm(`Are you sure you want to delete "${listToDelete.name}" watchlist?`)) {
      await customFetch(`/api/watchlists/${id}`, { method: 'DELETE' });
      fetchWatchlists();

      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
      setUndoToast({
        id: `list-${id}-${Date.now()}`,
        message: `Deleted watchlist "${listToDelete.name}"`,
        onUndo: async () => {
          const res = await customFetch('/api/watchlists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: listToDelete.name })
          });
          const created = await res.json().catch(() => null);
          if (created?.id && Array.isArray(listToDelete.items)) {
            for (const it of listToDelete.items) {
              const parsed = parseSymbolItem(it);
              await customFetch(`/api/watchlists/${created.id}/symbols`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  symbol: parsed.symbol,
                  priority: parsed.priority,
                  category: parsed.category
                })
              });
            }
          }
          fetchWatchlists();
          setUndoToast(null);
        }
      });

      undoTimeoutRef.current = setTimeout(() => {
        setUndoToast(null);
      }, 4000);
    }
  };

  const handleToggleList = async (id: string, isActive: boolean) => {
    // Optimistic UI update: flip is_active state instantly
    const prevWatchlists = watchlists;
    setWatchlists(prev => prev.map(wl => 
      String(wl.id) === String(id) 
        ? { ...wl, is_active: isActive ? 0 : 1 } 
        : wl
    ));

    try {
      const res = await customFetch(`/api/watchlists/${id}/toggle`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive })
      });
      if (!res.ok) {
        setWatchlists(prevWatchlists);
      }
    } catch {
      setWatchlists(prevWatchlists);
    }
  };

  const handleDirectAddSymbol = async (
    rawSymbol: string, 
    companyName?: string, 
    priorityOverride?: StockPriority, 
    customCategory?: string,
    targetListIdOverride?: string
  ) => {
    if (isAddingSymbolRef.current) return;
    const sym = (rawSymbol || '').trim().toUpperCase();
    if (!sym) return;

    // Determine target list
    let targetList = watchlists.find(l => String(l.id) === String(targetListIdOverride || (activeListId !== 'ALL' ? activeListId : (allPanelTargetListId || watchlists[0]?.id))));
    if (!targetList) {
      targetList = watchlists.find(l => l.is_active === 1) || watchlists[0];
    }

    if (!targetList) {
      alert("Please create a watchlist first before adding stocks.");
      return;
    }

    const priorityToUse = priorityOverride || newPriority || 'HIGH';
    const categoryToUse = (customCategory !== undefined ? customCategory : newCategory).trim() || undefined;

    // Quota check
    const totalTracked = Array.from(new Set(watchlists.flatMap(l => (l.items || []).map((it: any) => parseSymbolItem(it).symbol)))).length;
    const isAlreadyTrackedGlobally = watchlists.some(l => (l.items || []).some((it: any) => parseSymbolItem(it).symbol === sym));

    if (!isAlreadyTrackedGlobally && !isPro && !isAdmin && (totalTracked >= 5)) {
      setIsProModalOpen(true);
      return;
    }

    isAddingSymbolRef.current = true;
    setShowSuggestions(false);
    setNewSymbol('');
    setNewCategory('');
    setSearchResults([]);

    // Optimistic UI update: immediately add the stock to local state
    const prevWatchlists = watchlists;
    const optimisticItem = {
      symbol: sym,
      priority: priorityToUse,
      category: categoryToUse,
      scripCode: symbolToScripCache[sym] || undefined
    };

    setWatchlists(prev => prev.map(wl => {
      if (String(wl.id) === String(targetList.id)) {
        const currentItems = wl.items || [];
        const alreadyHas = currentItems.some((it: any) => parseSymbolItem(it).symbol === sym);
        if (!alreadyHas) {
          return {
            ...wl,
            items: [optimisticItem, ...currentItems]
          };
        }
      }
      return wl;
    }));

    setLastAddedInfo({
      symbol: sym,
      companyName: companyName || sym,
      listName: targetList.name,
      priority: priorityToUse,
      timestamp: Date.now()
    });
    setHighlightedSymbol(sym);

    // Clear pulse after 4s
    setTimeout(() => setHighlightedSymbol(prev => prev === sym ? null : prev), 4000);
    // Clear toast after 5s
    setTimeout(() => setLastAddedInfo(prev => (prev && Date.now() - prev.timestamp >= 4900) ? null : prev), 5000);

    try {
      const res = await customFetch(`/api/watchlists/${targetList.id}/symbols`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: sym,
          priority: priorityToUse,
          category: categoryToUse
        })
      });

      if (res.status === 402) {
        setWatchlists(prevWatchlists); // Rollback on quota limit
        const data = await res.json().catch(() => ({}));
        if (data.upgradeRequired) {
          setIsProModalOpen(true);
        }
        return;
      }

      if (res.ok) {
        // Background sync
        customFetch('/api/watchlists/sync-stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol: sym })
        }).then(r => r.json()).then(data => {
          if (data && data.success && data.scripCode) {
            symbolToScripCache[sym] = data.scripCode;
            scripToSymbolCache[data.scripCode] = sym;
            stockMasterClient[sym] = {
              scripCode: data.scripCode,
              nameKeywords: [companyName || sym, sym]
            };
          }
          fetchAnnouncements();
        }).catch(() => {});
      } else {
        setWatchlists(prevWatchlists); // Rollback
      }
    } catch (err: any) {
      console.error("Error adding symbol directly:", err);
      setWatchlists(prevWatchlists); // Rollback
    } finally {
      isAddingSymbolRef.current = false;
    }
  };

  const handleAddSymbol = async (e: React.FormEvent, listId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!newSymbol.trim() || isAddingSymbolRef.current) return;
    
    const symbols = newSymbol.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
    if (symbols.length === 0) return;
    
    const targetList = watchlists.find(l => String(l.id) === String(listId)) || watchlists[0];
    const targetId = targetList?.id || listId;

    if (symbols.length === 1) {
      await handleDirectAddSymbol(symbols[0], undefined, newPriority, newCategory, targetId);
    } else {
      isAddingSymbolRef.current = true;
      setShowSuggestions(false);
      setNewSymbol('');
      setNewCategory('');
      setSearchResults([]);

      try {
        const res = await customFetch(`/api/watchlists/${targetId}/symbols/bulk`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            symbols: symbols.map(s => ({ symbol: s, priority: newPriority, category: newCategory.trim() || undefined }))
          })
        });

        if (res.status === 402) {
          const data = await res.json().catch(() => ({}));
          if (data.upgradeRequired) {
            setIsProModalOpen(true);
          }
          return;
        }

        setLastAddedInfo({
          symbol: `${symbols.length} Stocks`,
          companyName: symbols.join(', '),
          listName: targetList?.name || 'Watchlist',
          priority: newPriority,
          timestamp: Date.now()
        });
        await fetchWatchlists();

        // Trigger sync for all added symbols
        Promise.all(symbols.map(s => 
          customFetch('/api/watchlists/sync-stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol: s })
          }).catch(() => {})
        )).then(() => {
          fetchAnnouncements();
        });
      } finally {
        isAddingSymbolRef.current = false;
      }
    }
  };

  const handleCyclePriority = async (listId: string, currentItem: WatchlistStockItem) => {
    const nextPriority: StockPriority = 
      currentItem.priority === 'HIGH' ? 'MEDIUM' :
      currentItem.priority === 'MEDIUM' ? 'LOW' : 'HIGH';

    // Optimistic UI Update: immediately update priority across all watchlists for instant feedback
    const prevWatchlists = watchlists;
    setWatchlists(prev => prev.map(wl => ({
      ...wl,
      items: (wl.items || []).map((it: any) => {
        const parsed = parseSymbolItem(it);
        if (parsed.symbol === currentItem.symbol) {
          return typeof it === 'string' 
            ? { symbol: parsed.symbol, priority: nextPriority, category: parsed.category }
            : { ...it, priority: nextPriority };
        }
        return it;
      })
    })));

    try {
      // Synchronize across all user watchlists to prevent overlapping priority conflicts
      const res = await customFetch(`/api/watchlists/symbols/${encodeURIComponent(currentItem.symbol)}/priority-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: nextPriority })
      });
      if (!res.ok) {
        setWatchlists(prevWatchlists); // Rollback on error
      }
    } catch {
      setWatchlists(prevWatchlists); // Rollback on exception
    }
  };

  const handleRemoveSymbol = async (listId: string, symbol: string) => {
    const targetList = watchlists.find(w => String(w.id) === String(listId));
    const existingItem = (targetList?.items || []).find((it: any) => {
      const parsed = typeof it === 'string' ? { symbol: it } : it;
      return parsed.symbol === symbol;
    });
    const parsedItem = existingItem ? parseSymbolItem(existingItem) : null;
    const prevPriority = parsedItem?.priority || 'LOW';
    const prevCategory = parsedItem?.category || '';

    // Optimistic UI update: immediately remove symbol from local list
    const prevWatchlists = watchlists;
    setWatchlists(prev => prev.map(wl => {
      if (String(wl.id) === String(listId)) {
        return {
          ...wl,
          items: (wl.items || []).filter((it: any) => {
            const parsed = typeof it === 'string' ? { symbol: it } : it;
            return parsed.symbol !== symbol;
          })
        };
      }
      return wl;
    }));

    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    setUndoToast({
      id: `${listId}-${symbol}-${Date.now()}`,
      message: `Removed ${symbol} from watchlist`,
      onUndo: async () => {
        // Optimistically restore item
        setWatchlists(prevWatchlists);
        setUndoToast(null);
        await customFetch(`/api/watchlists/${listId}/symbols`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            symbol, 
            priority: prevPriority, 
            category: prevCategory 
          })
        });
        fetchWatchlists();
      }
    });

    undoTimeoutRef.current = setTimeout(() => {
      setUndoToast(null);
    }, 4000);

    try {
      const res = await customFetch(`/api/watchlists/${listId}/symbols/${encodeURIComponent(symbol)}`, { method: 'DELETE' });
      if (!res.ok) {
        setWatchlists(prevWatchlists); // Rollback on error
      }
    } catch {
      setWatchlists(prevWatchlists); // Rollback on network exception
    }
  };

  // Map of all tracked symbols with their resolved priority & metadata (HIGH > MEDIUM > LOW)
  const symbolDetailsMap = useMemo(() => {
    const map: Record<string, WatchlistStockItem> = {};
    const priorityWeight: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

    for (const list of watchlists) {
      if (list.is_active || activeListId === 'ALL') {
        const items = list.items || [];
        for (const raw of items) {
          const parsed = parseSymbolItem(raw);
          if (parsed.symbol) {
            const currentWeight = map[parsed.symbol] ? (priorityWeight[map[parsed.symbol].priority || 'MEDIUM'] || 2) : 0;
            const newWeight = priorityWeight[parsed.priority || 'MEDIUM'] || 2;
            if (!map[parsed.symbol] || newWeight > currentWeight) {
              map[parsed.symbol] = parsed;
            }
          }
        }
      }
    }
    return map;
  }, [watchlists, activeListId]);

  // Current active list's parsed stock items
  const currentListParsedItems = useMemo(() => {
    const list = watchlists.find(l => l.id === activeListId);
    if (!list) return [];
    return (list.items || []).map((raw: any) => parseSymbolItem(raw)).filter((it: any) => it.symbol);
  }, [watchlists, activeListId]);

  // Filtered symbols in the symbols panel
  const filteredListStockItems = useMemo(() => {
    return currentListParsedItems.filter(item => {
      if (symbolPriorityFilter !== 'ALL' && item.priority !== symbolPriorityFilter) return false;
      if (symbolSearchQuery) {
        const q = symbolSearchQuery.toUpperCase().trim();
        const matchesSym = item.symbol.includes(q);
        const matchesCat = (item.category || '').toUpperCase().includes(q);
        return matchesSym || matchesCat;
      }
      return true;
    });
  }, [currentListParsedItems, symbolPriorityFilter, symbolSearchQuery]);

  // Counts for symbols panel
  const symbolPriorityCounts = useMemo(() => {
    const counts = { HIGH: 0, MEDIUM: 0, LOW: 0, TOTAL: currentListParsedItems.length };
    currentListParsedItems.forEach(it => {
      if (it.priority === 'HIGH') counts.HIGH++;
      else if (it.priority === 'MEDIUM') counts.MEDIUM++;
      else if (it.priority === 'LOW') counts.LOW++;
    });
    return counts;
  }, [currentListParsedItems]);

  // All combined tracked stocks across all watchlists
  const allCombinedTrackedItems = useMemo(() => {
    const list: { symbol: string; priority: StockPriority; category?: string; listName: string; listId: string }[] = [];
    for (const wl of watchlists) {
      const items = wl.items || [];
      for (const raw of items) {
        const parsed = parseSymbolItem(raw);
        if (parsed.symbol) {
          list.push({
            symbol: parsed.symbol,
            priority: parsed.priority,
            category: parsed.category,
            listName: wl.name,
            listId: wl.id
          });
        }
      }
    }
    return list;
  }, [watchlists]);

  // Unique symbols tracked across all user watchlists
  const totalUniqueTrackedSymbols = useMemo(() => {
    const set = new Set<string>();
    allCombinedTrackedItems.forEach(item => {
      if (item.symbol) set.add(item.symbol);
    });
    return set.size;
  }, [allCombinedTrackedItems]);

  const currentWatchlist = watchlists.find(l => l.id === activeListId);

  // Dedicated memo for "My companies" view with live update counts & formatted names
  const myCompaniesList = useMemo(() => {
    const seen = new Set<string>();
    const list: {
      symbol: string;
      name: string;
      scripCode?: string;
      priority: StockPriority;
      category?: string;
      listName?: string;
      listId?: string;
      updateCount: number;
      concreteStatus?: string;
      hasResultsDeclaredToday?: boolean;
      hasHighImpactUpdate?: boolean;
      latestFilingTs?: number;
    }[] = [];

    // Use current list if selected, or all tracked items
    const sourceItems = (activeListId !== 'ALL' && currentListParsedItems.length > 0)
      ? currentListParsedItems.map(it => ({
          ...it,
          listName: currentWatchlist?.name || 'Watchlist',
          listId: currentWatchlist?.id || ''
        }))
      : allCombinedTrackedItems;

    for (const item of sourceItems) {
      if (!item.symbol || seen.has(item.symbol)) continue;
      seen.add(item.symbol);

      const master = stockMasterClient[item.symbol];
      const scripCode = master?.scripCode || getScripCodeClient(item.symbol);

      let cleanName = item.symbol;
      if (master?.nameKeywords?.[0]) {
        cleanName = master.nameKeywords[0];
      }

      // Calculate update count and concrete current status for this company from loaded announcements
      let uCount = 0;
      let filingsToday = 0;
      let filingsYesterday = 0;
      let hasResultsDeclaredToday = false;
      let hasHighImpactUpdate = false;
      let latestFilingTs = 0;

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

      for (let i = 0; i < announcements.length; i++) {
        const a = announcements[i];
        if (checkSymbolMatchFast(a.companyName, a.subject, item.symbol, a.scrip_cd)) {
          uCount++;
          if (cleanName === item.symbol && a.companyName) {
            cleanName = a.companyName;
          }

          const filingTs = a.bseTime ? new Date(a.bseTime).getTime() : (a.fetched_at ? new Date(a.fetched_at).getTime() : 0);
          if (filingTs > latestFilingTs) {
            latestFilingTs = filingTs;
          }

          const isResult = (a.subject || '').toLowerCase().includes('financial result') || 
                           (a.subject || '').toLowerCase().includes('outcome of board meeting') ||
                           (a.subject || '').toLowerCase().includes('audited') ||
                           (a.subject || '').toLowerCase().includes('un-audited');

          const isHigh = (a.priority === 'HIGH' || a.priorityScore >= 70 || isResult);
          if (isHigh) hasHighImpactUpdate = true;

          if (filingTs >= todayStart) {
            filingsToday++;
            if (isResult) hasResultsDeclaredToday = true;
          } else if (filingTs >= yesterdayStart && filingTs < todayStart) {
            filingsYesterday++;
          }
        }
      }

      // Format concrete human-readable status
      let concreteStatus = "No recent filings";
      if (hasResultsDeclaredToday) {
        concreteStatus = "Results declared today";
      } else if (filingsToday > 0) {
        concreteStatus = filingsToday === 1 ? "1 new filing today" : `${filingsToday} new filings today`;
      } else if (filingsYesterday > 0) {
        concreteStatus = filingsYesterday === 1 ? "1 new filing yesterday" : `${filingsYesterday} new filings yesterday`;
      } else if (latestFilingTs > 0) {
        const daysAgo = Math.floor((todayStart - latestFilingTs) / (24 * 60 * 60 * 1000));
        if (daysAgo <= 0) {
          concreteStatus = "Filing today";
        } else if (daysAgo === 1) {
          concreteStatus = "1 filing yesterday";
        } else if (daysAgo < 7) {
          concreteStatus = `Last update ${daysAgo}d ago`;
        } else {
          concreteStatus = `Last update on ${new Date(latestFilingTs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
        }
      }

      // Title-case clean formatting if name is in ALL CAPS
      if (cleanName === cleanName.toUpperCase() && cleanName.length > 4) {
        cleanName = cleanName
          .toLowerCase()
          .replace(/\b\w/g, c => c.toUpperCase())
          .replace(/\bLtd\b/i, 'Ltd')
          .replace(/\bLimited\b/i, 'Ltd')
          .replace(/\bInc\b/i, 'Inc');
      }

      list.push({
        symbol: item.symbol,
        name: cleanName,
        scripCode,
        priority: item.priority || 'HIGH',
        category: item.category,
        listName: item.listName,
        listId: item.listId,
        updateCount: uCount,
        concreteStatus,
        hasResultsDeclaredToday,
        hasHighImpactUpdate: hasHighImpactUpdate || hasResultsDeclaredToday || item.priority === 'HIGH',
        latestFilingTs
      });
    }

    return list.sort((a, b) => {
      if (a.hasResultsDeclaredToday !== b.hasResultsDeclaredToday) return a.hasResultsDeclaredToday ? -1 : 1;
      if (b.updateCount !== a.updateCount) return b.updateCount - a.updateCount;
      const pWeight: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      const pDiff = (pWeight[b.priority] || 1) - (pWeight[a.priority] || 1);
      if (pDiff !== 0) return pDiff;
      return a.name.localeCompare(b.name);
    });
  }, [activeListId, currentListParsedItems, currentWatchlist, allCombinedTrackedItems, announcements]);

  const filteredMyCompanies = useMemo(() => {
    if (!companySearch.trim()) return myCompaniesList;
    const q = companySearch.toLowerCase().trim();
    return myCompaniesList.filter(c => 
      c.name.toLowerCase().includes(q) ||
      c.symbol.toLowerCase().includes(q) ||
      (c.scripCode && c.scripCode.includes(q)) ||
      (c.category && c.category.toLowerCase().includes(q))
    );
  }, [myCompaniesList, companySearch]);

  const filteredAllTrackedItems = useMemo(() => {
    return allCombinedTrackedItems.filter(item => {
      if (symbolPriorityFilter !== 'ALL' && item.priority !== symbolPriorityFilter) return false;
      if (symbolSearchQuery) {
        const q = symbolSearchQuery.toUpperCase().trim();
        const matchesSym = item.symbol.includes(q);
        const matchesCat = (item.category || '').toUpperCase().includes(q);
        const matchesList = item.listName.toUpperCase().includes(q);
        return matchesSym || matchesCat || matchesList;
      }
      return true;
    });
  }, [allCombinedTrackedItems, symbolPriorityFilter, symbolSearchQuery]);

  const allTrackedPriorityCounts = useMemo(() => {
    const counts = { HIGH: 0, MEDIUM: 0, LOW: 0, TOTAL: allCombinedTrackedItems.length };
    allCombinedTrackedItems.forEach(it => {
      if (it.priority === 'HIGH') counts.HIGH++;
      else if (it.priority === 'MEDIUM') counts.MEDIUM++;
      else if (it.priority === 'LOW') counts.LOW++;
    });
    return counts;
  }, [allCombinedTrackedItems]);

  // Fast Memoized Symbol Announcement Counts
  const { stockCounts, totalWatchlistDisclosures } = useMemo(() => {
    const counts: Record<string, number> = {};
    activeSymbols.forEach(sym => { counts[sym] = 0; });
    
    let total = 0;

    for (let i = 0; i < announcements.length; i++) {
      const a = announcements[i];
      let matchedAny = false;

      for (let j = 0; j < activeSymbols.length; j++) {
        const sym = activeSymbols[j];
        if (checkSymbolMatchFast(a.companyName, a.subject, sym, a.scrip_cd)) {
          counts[sym] = (counts[sym] || 0) + 1;
          matchedAny = true;
        }
      }

      if (matchedAny) {
        total++;
      }
    }

    return { stockCounts: counts, totalWatchlistDisclosures: total };
  }, [announcements, activeSymbols]);

  // Filter announcements with memoization
  const watchlistAnnouncements = useMemo(() => {
    const query = announcementSearch.toLowerCase().trim();

    // If user has no stocks in active watchlist, do NOT show any disclosures
    if (activeSymbols.length === 0) {
      return [];
    }

    return announcements.filter(a => {
      // Find if this announcement belongs to a watchlist stock and get its priority
      let matchedStockItem: WatchlistStockItem | null = null;
      for (const sym of activeSymbols) {
        if (checkSymbolMatchFast(a.companyName, a.subject, sym, a.scrip_cd)) {
          matchedStockItem = symbolDetailsMap[sym] || { symbol: sym, priority: 'HIGH' };
          break;
        }
      }

      // If announcement does not match any active tracked symbol in user's watchlist, exclude it immediately
      if (!matchedStockItem) return false;

      // 1. Stock Filter
      if (selectedStockFilter) {
        if (!checkSymbolMatchFast(a.companyName, a.subject, selectedStockFilter, a.scrip_cd)) {
          return false;
        }
      }

      // 2. Stock Priority Filter
      if (announcementPriorityFilter === 'HIGH_STOCK') {
        if (!matchedStockItem || matchedStockItem.priority !== 'HIGH') return false;
      } else if (announcementPriorityFilter === 'MEDIUM_STOCK') {
        if (!matchedStockItem || matchedStockItem.priority !== 'MEDIUM') return false;
      } else if (announcementPriorityFilter === 'LOW_STOCK') {
        if (!matchedStockItem || matchedStockItem.priority !== 'LOW') return false;
      }

      // 3. Event Category Filter
      if (announcementCategory === 'RESULTS' && a.category !== 'RESULTS') return false;
      if (announcementCategory === 'CONFERENCE_CALL' && a.category !== 'CONFERENCE_CALL') return false;
      if (announcementCategory === 'HIGH_PRIORITY' && a.priority !== 'HIGH') return false;

      // 4. Advanced Search Query
      if (query) {
        const comp = (a.companyName || '').toLowerCase();
        const subj = (a.subject || '').toLowerCase();
        const scrip = String(a.scrip_cd || '');
        const details = (a.details || a.headline || '').toLowerCase();

        return comp.includes(query) || subj.includes(query) || scrip.includes(query) || details.includes(query);
      }

      return true;
    });
  }, [announcements, activeSymbols, selectedStockFilter, announcementCategory, announcementPriorityFilter, announcementSearch, symbolDetailsMap]);

  const sortedWatchlistAnnouncements = useMemo(() => {
    return [...watchlistAnnouncements].sort((a, b) => {
      if (sortOrder === 'priority') {
        const pA = a.priority === 'HIGH' || a.category === 'RESULTS' ? 3 : a.priority === 'MEDIUM' ? 2 : 1;
        const pB = b.priority === 'HIGH' || b.category === 'RESULTS' ? 3 : b.priority === 'MEDIUM' ? 2 : 1;
        if (pA !== pB) return pB - pA;
      } else if (sortOrder === 'az') {
        return (a.companyName || '').localeCompare(b.companyName || '');
      } else if (sortOrder === 'oldest') {
        const tsA = (typeof a.bseTimestamp === 'number' && !isNaN(a.bseTimestamp) && a.bseTimestamp > 0) ? a.bseTimestamp : (a.fetched_at || 0);
        const tsB = (typeof b.bseTimestamp === 'number' && !isNaN(b.bseTimestamp) && b.bseTimestamp > 0) ? b.bseTimestamp : (b.fetched_at || 0);
        return tsA - tsB;
      }
      // default: newest
      const tsA = (typeof a.bseTimestamp === 'number' && !isNaN(a.bseTimestamp) && a.bseTimestamp > 0) ? a.bseTimestamp : (a.fetched_at || 0);
      const tsB = (typeof b.bseTimestamp === 'number' && !isNaN(b.bseTimestamp) && b.bseTimestamp > 0) ? b.bseTimestamp : (b.fetched_at || 0);
      return tsB - tsA;
    });
  }, [watchlistAnnouncements, sortOrder]);

  // Cluster/Group repeated or same-time company announcements
  const clusteredWatchlistAnnouncements = useMemo<AnnouncementCluster[]>(() => {
    if (!isSmartClustering) {
      return sortedWatchlistAnnouncements.map((item, idx) => ({
        id: `single-${item.id || item.newsId || idx}`,
        isCluster: false,
        companyName: item.companyName,
        scrip_cd: item.scrip_cd,
        count: 1,
        primaryItem: item,
        items: [item],
        categories: [item.category || 'OTHER'],
        hasResults: item.category === 'RESULTS',
        hasConcall: item.category === 'CONFERENCE_CALL',
        hasHighPriority: item.category === 'HIGH_PRIORITY' || item.priority === 'HIGH',
        isSentToTelegram: Boolean(item.is_sent),
        timeSpanLabel: '',
        isDuplicateSubject: false,
      }));
    }
    return clusterAnnouncements(sortedWatchlistAnnouncements);
  }, [sortedWatchlistAnnouncements, isSmartClustering]);

  const clusterStats = useMemo(() => {
    const totalRaw = sortedWatchlistAnnouncements.length;
    const totalBundles = clusteredWatchlistAnnouncements.filter(c => c.isCluster).length;
    const reducedClutterCount = clusteredWatchlistAnnouncements.reduce((acc, c) => acc + (c.isCluster ? c.count - 1 : 0), 0);
    return { totalRaw, totalBundles, reducedClutterCount };
  }, [sortedWatchlistAnnouncements, clusteredWatchlistAnnouncements]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (announcementPriorityFilter !== 'ALL') count++;
    if (announcementCategory !== 'ALL') count++;
    if (selectedStockFilter !== null) count++;
    return count;
  }, [announcementPriorityFilter, announcementCategory, selectedStockFilter]);

  const clearAllFeedFilters = () => {
    setAnnouncementPriorityFilter('ALL');
    setAnnouncementCategory('ALL');
    setSelectedStockFilter(null);
    setAnnouncementSearch('');
  };

  const filteredTrackedSymbols = useMemo(() => {
    if (!symbolFilterSearch.trim()) return activeSymbols;
    const q = symbolFilterSearch.toLowerCase();
    return activeSymbols.filter(sym => sym.toLowerCase().includes(q));
  }, [activeSymbols, symbolFilterSearch]);

  const totalWatchlistPages = Math.max(1, Math.ceil(clusteredWatchlistAnnouncements.length / itemsPerPage));
  const paginatedWatchlistAnnouncements = useMemo(() => {
    return clusteredWatchlistAnnouncements.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [clusteredWatchlistAnnouncements, currentPage, itemsPerPage]);

  return (
    <div ref={watchlistContainerRef} className="space-y-2 overscroll-y-contain relative">
      {/* Pull to Refresh Animated Indicator for Watchlists */}
      <PullToRefreshIndicator 
        pullDistance={watchlistPullDist}
        isPulling={isWatchlistPulling}
        isRefreshing={isWatchlistRefreshing}
        progress={watchlistPullProg}
        label="Watchlist & Filings"
      />

      {/* Consolidated High-Density Navigation & Filter Bar - Sticky below navbar */}
      <div className="sticky top-14 md:top-[89px] z-30 bg-white/95 dark:bg-[#1A1926]/95 backdrop-blur-md border border-slate-200/90 dark:border-[#2D283E] rounded-xl p-2 sm:p-2.5 shadow-xs space-y-2">
        {/* Row 1: Primary Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            {/* View Switcher Tabs: My companies | Updates | Edit watchlist */}
            <div className="flex items-center p-0.5 bg-slate-100 dark:bg-[#15141F] rounded-lg border border-slate-200/80 dark:border-[#2D283E] shrink-0 select-none">
              {/* Tab 1: My companies */}
              <motion.button
                type="button"
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={() => setWatchlistSubTab('companies')}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 min-h-[36px] py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer whitespace-nowrap select-none",
                  watchlistSubTab === 'companies'
                    ? "text-white"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                {watchlistSubTab === 'companies' && (
                  <motion.span
                    layoutId="activeWatchlistSubTab"
                    className="absolute inset-0 bg-slate-900 dark:bg-[#2A263D] rounded-md shadow-xs"
                    transition={springSnappy}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Building2 size={13} />
                  <span>My companies</span>
                  <span className={cn(
                    "px-1.5 py-0.2 text-[10px] font-mono rounded-full font-black",
                    watchlistSubTab === 'companies' ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-[#252233] text-slate-700 dark:text-slate-300"
                  )}>
                    {myCompaniesList.length}
                  </span>
                </span>
              </motion.button>

              {/* Tab 2: Updates */}
              <motion.button
                type="button"
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={() => setWatchlistSubTab('updates')}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 min-h-[36px] py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer whitespace-nowrap select-none",
                  watchlistSubTab === 'updates'
                    ? "text-white"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                {watchlistSubTab === 'updates' && (
                  <motion.span
                    layoutId="activeWatchlistSubTab"
                    className="absolute inset-0 bg-slate-900 dark:bg-[#2A263D] rounded-md shadow-xs"
                    transition={springSnappy}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <FileText size={13} />
                  <span>Updates</span>
                  <span className={cn(
                    "px-1.5 py-0.2 text-[10px] font-mono rounded-full font-black",
                    watchlistSubTab === 'updates' ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-[#252233] text-slate-700 dark:text-slate-300"
                  )}>
                    {watchlistAnnouncements.length}
                  </span>
                </span>
              </motion.button>

              {/* Tab 3: Edit watchlist */}
              <motion.button
                type="button"
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={() => setWatchlistSubTab('edit')}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 min-h-[36px] py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer whitespace-nowrap select-none",
                  watchlistSubTab === 'edit'
                    ? "text-white"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                {watchlistSubTab === 'edit' && (
                  <motion.span
                    layoutId="activeWatchlistSubTab"
                    className="absolute inset-0 bg-slate-900 dark:bg-[#2A263D] rounded-md shadow-xs"
                    transition={springSnappy}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <SlidersHorizontal size={13} />
                  <span>Edit watchlist</span>
                </span>
              </motion.button>
            </div>
          </div>

          {/* Right: Controls tailored specifically to active tab */}
          <div className="flex items-center gap-2 shrink-0 justify-between md:justify-end flex-wrap select-none">
            {watchlistSubTab === 'companies' && (
              <div className="flex items-center gap-2 w-full md:w-auto">
                {/* Search My Companies */}
                <div className="relative flex-1 md:w-56 min-w-[150px]">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    value={companySearch}
                    onChange={e => setCompanySearch(e.target.value)}
                    placeholder="Search my companies..."
                    className="pl-7 pr-7 py-1.5 bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 dark:text-white w-full min-h-[36px]"
                  />
                  {companySearch && (
                    <button
                      type="button"
                      onClick={() => setCompanySearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* One clear "Add company" button */}
                <motion.button
                  type="button"
                  whileTap={buttonTap}
                  transition={springSnappy}
                  onClick={() => setIsAddCompanyOpen(prev => !prev)}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 min-h-[36px] py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs whitespace-nowrap select-none active:scale-[0.96]",
                    isAddCompanyOpen
                      ? "bg-slate-800 text-white dark:bg-[#322C4A]"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white"
                  )}
                >
                  <Plus size={14} className={isAddCompanyOpen ? "rotate-45 transition-transform" : "transition-transform"} />
                  <span>Add company</span>
                </motion.button>
              </div>
            )}

            {watchlistSubTab === 'updates' && (
              <div className="flex items-center gap-2 w-full md:w-auto">
                {/* Search Box with Clear Button */}
                <div className="relative flex-1 md:w-56 min-w-[140px]">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    value={announcementSearch}
                    onChange={e => setAnnouncementSearch(e.target.value)}
                    placeholder="Search filings..."
                    className="pl-7 pr-7 py-1.5 bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 dark:text-white w-full min-h-[36px]"
                  />
                  {announcementSearch && (
                    <button
                      type="button"
                      onClick={() => setAnnouncementSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Filter Drawer Trigger Button */}
                <motion.button
                  type="button"
                  whileTap={buttonTap}
                  transition={springSnappy}
                  onClick={() => setIsFilterDrawerOpen(true)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 min-h-[36px] py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer shadow-2xs whitespace-nowrap select-none active:scale-[0.96]",
                    activeFiltersCount > 0
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-slate-50 dark:bg-[#201E2E] border-slate-200 dark:border-[#2D283E] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#2A263D]"
                  )}
                  title="Open Filters Sheet"
                >
                  <Filter size={13} />
                  <span>Filters</span>
                  {activeFiltersCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-white text-emerald-700">
                      {activeFiltersCount}
                    </span>
                  )}
                </motion.button>
              </div>
            )}

            {watchlistSubTab === 'edit' && (
              <div className="flex items-center gap-2 select-none">
                {/* Active List Dropdown */}
                <select
                  value={activeListId}
                  onChange={e => setActiveListId(e.target.value)}
                  className="bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] rounded-lg px-2.5 py-1.5 min-h-[36px] text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer select-none"
                >
                  <option value="ALL">All Watchlists ({totalUniqueTrackedSymbols})</option>
                  {watchlists.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.items?.length || 0})</option>
                  ))}
                </select>

                <ActionButton
                  onClick={() => handleSyncWatchlists('quick')}
                  isLoading={isSyncingWatchlists}
                  loadingText="Syncing..."
                  variant="primary"
                  size="sm"
                  className="min-h-[36px]"
                  title="Instant Quick Refresh"
                >
                  Sync
                </ActionButton>
              </div>
            )}
          </div>
        </div>

        {/* Active Filter Chips Strip (Shows ONLY when filters are active in Updates tab) */}
        {watchlistSubTab === 'updates' && activeFiltersCount > 0 && (
          <div className="pt-1.5 border-t border-slate-100 dark:border-[#2D283E]/60 flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active:</span>

            {announcementPriorityFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-[#222030] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-[#352F48]">
                <span>Tier: {announcementPriorityFilter === 'HIGH_STOCK' ? '🔴 High' : announcementPriorityFilter === 'MEDIUM_STOCK' ? '🟡 Med' : '⚪ Low'}</span>
                <button type="button" onClick={() => setAnnouncementPriorityFilter('ALL')} className="hover:text-rose-500">
                  <X size={10} />
                </button>
              </span>
            )}

            {announcementCategory !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                <span>Cat: {announcementCategory === 'RESULTS' ? 'Results' : announcementCategory === 'CONFERENCE_CALL' ? 'Concall' : 'Priority'}</span>
                <button type="button" onClick={() => setAnnouncementCategory('ALL')} className="hover:text-rose-500">
                  <X size={10} />
                </button>
              </span>
            )}

            {selectedStockFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <span>Symbol: {selectedStockFilter}</span>
                <button type="button" onClick={() => setSelectedStockFilter(null)} className="hover:text-rose-500">
                  <X size={10} />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={clearAllFeedFilters}
              className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline ml-auto cursor-pointer"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* FILTER BOTTOM SHEET / DRAWER */}
      {isFilterDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200 overscroll-contain">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity overscroll-contain"
            onClick={() => setIsFilterDrawerOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative bg-white dark:bg-[#1A1926] rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-[#2D283E] shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col z-10 animate-in slide-in-from-bottom duration-250 overscroll-contain">
            {/* Native Mobile Drag Handle Bar */}
            <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mt-2.5 mb-1 shrink-0 sm:hidden" />

            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-[#2D283E] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-purple-600 dark:text-purple-400" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Filter Watchlist Feed</h3>
                <span className="text-xs text-slate-500 font-mono">({watchlistAnnouncements.length} matches)</span>
              </div>
              <button
                type="button"
                onClick={() => setIsFilterDrawerOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-[#222030] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              {/* Conviction / Priority Tier */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                  Conviction Tier
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'ALL', label: 'All Tiers' },
                    { id: 'HIGH_STOCK', label: '🔴 High' },
                    { id: 'MEDIUM_STOCK', label: '🟡 Medium' },
                    { id: 'LOW_STOCK', label: '⚪ Low' }
                  ].map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setAnnouncementPriorityFilter(p.id)}
                      className={cn(
                        "p-2 rounded-lg border text-center font-bold transition-all cursor-pointer",
                        announcementPriorityFilter === p.id
                          ? "bg-slate-900 text-white dark:bg-[#2A263D] dark:text-white border-slate-900 dark:border-[#38324E] shadow-xs"
                          : "bg-slate-50 dark:bg-[#201E2E] border-slate-200 dark:border-[#2D283E] text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Event Category */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                  Event Category
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'ALL', label: 'All Events' },
                    { id: 'RESULTS', label: 'Results' },
                    { id: 'CONFERENCE_CALL', label: 'Concall' },
                    { id: 'HIGH_PRIORITY', label: 'Priority' }
                  ].map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setAnnouncementCategory(cat.id)}
                      className={cn(
                        "p-2 rounded-lg border text-center font-bold transition-all cursor-pointer",
                        announcementCategory === cat.id
                          ? "bg-slate-900 text-white dark:bg-[#2A263D] dark:text-white border-slate-900 dark:border-[#38324E] shadow-xs"
                          : "bg-slate-50 dark:bg-[#201E2E] border-slate-200 dark:border-[#2D283E] text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Symbols Filter */}
              {activeSymbols.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                      Filter by Tracked Symbol ({activeSymbols.length})
                    </label>
                    {selectedStockFilter && (
                      <button
                        type="button"
                        onClick={() => setSelectedStockFilter(null)}
                        className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline"
                      >
                        Reset Symbol Selection
                      </button>
                    )}
                  </div>

                  {/* Search symbols inside drawer */}
                  <div className="relative">
                    <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={symbolFilterSearch}
                      onChange={e => setSymbolFilterSearch(e.target.value)}
                      placeholder="Search tracked symbols..."
                      className="w-full pl-7 pr-3 py-1.5 bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] rounded-lg text-xs outline-none text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Symbol Chips */}
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1 bg-slate-50 dark:bg-[#15141F] rounded-lg border border-slate-200 dark:border-[#2D283E]">
                    <button
                      type="button"
                      onClick={() => setSelectedStockFilter(null)}
                      className={cn(
                        "px-2 py-1 rounded-md text-[10px] font-bold border transition-all cursor-pointer",
                        selectedStockFilter === null
                          ? "bg-slate-900 text-white dark:bg-[#2A263D] dark:text-white border-slate-900"
                          : "bg-white dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2D283E]"
                      )}
                    >
                      All Symbols ({totalWatchlistDisclosures})
                    </button>
                    {filteredTrackedSymbols.map(sym => {
                      const count = stockCounts[sym] || 0;
                      const isSelected = selectedStockFilter === sym;
                      const stockMeta = symbolDetailsMap[sym];
                      const priority = stockMeta?.priority || 'HIGH';

                      return (
                        <button
                          key={sym}
                          type="button"
                          onClick={() => setSelectedStockFilter(isSelected ? null : sym)}
                          className={cn(
                            "px-2 py-1 rounded-md text-[10px] font-bold border transition-all flex items-center gap-1 cursor-pointer",
                            isSelected
                              ? "bg-slate-900 text-white dark:bg-[#2A263D] dark:text-white border-slate-900 shadow-2xs"
                              : "bg-white dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2D283E] hover:bg-slate-100"
                          )}
                        >
                          <span>{priority === 'HIGH' ? '🔴' : priority === 'MEDIUM' ? '🟡' : '⚪'}</span>
                          <span>{sym}</span>
                          {count > 0 && <span className="font-mono text-[9px] opacity-75">({count})</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Feed Display & Sorting Options */}
              <div className="pt-2 border-t border-slate-100 dark:border-[#2D283E] space-y-3">
                {/* Sort Order */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                    Sort Filings
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: 'newest', label: '🕒 Newest' },
                      { id: 'oldest', label: '⏳ Oldest' },
                      { id: 'priority', label: '🔥 Priority' },
                      { id: 'az', label: '🔤 A-Z' }
                    ].map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSortOrder(s.id as any)}
                        className={cn(
                          "p-2 rounded-lg border text-center font-bold text-xs transition-all cursor-pointer",
                          sortOrder === s.id
                            ? "bg-slate-900 text-white dark:bg-[#2A263D] dark:text-white border-slate-900 shadow-xs"
                            : "bg-slate-50 dark:bg-[#201E2E] border-slate-200 dark:border-[#2D283E] text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* View Mode & Smart Grouping */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                      Layout Mode
                    </label>
                    <div className="flex items-center p-0.5 bg-slate-100 dark:bg-[#15141F] rounded-lg border border-slate-200 dark:border-[#2D283E]">
                      <button
                        type="button"
                        onClick={() => handleSetViewMode('grid')}
                        className={cn(
                          "flex-1 py-1 rounded text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all",
                          viewMode === 'grid'
                            ? "bg-white dark:bg-[#2A263D] text-slate-900 dark:text-white shadow-2xs"
                            : "text-slate-500"
                        )}
                      >
                        <LayoutGrid size={12} />
                        <span>Grid</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetViewMode('list')}
                        className={cn(
                          "flex-1 py-1 rounded text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all",
                          viewMode === 'list'
                            ? "bg-white dark:bg-[#2A263D] text-slate-900 dark:text-white shadow-2xs"
                            : "text-slate-500"
                        )}
                      >
                        <List size={12} />
                        <span>List</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                      Company Grouping
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsSmartClustering(!isSmartClustering)}
                      className={cn(
                        "w-full py-1.5 px-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all",
                        isSmartClustering
                          ? "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                          : "bg-slate-50 dark:bg-[#201E2E] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#2D283E]"
                      )}
                    >
                      <Layers size={12} />
                      <span>{isSmartClustering ? "Grouped" : "Flat Feed"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-3 border-t border-slate-100 dark:border-[#2D283E] bg-slate-50 dark:bg-[#15141F] rounded-b-2xl flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={clearAllFeedFilters}
                className="px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
              <button
                type="button"
                onClick={() => setIsFilterDrawerOpen(false)}
                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shadow-xs cursor-pointer min-h-[36px] active:scale-[0.96]"
              >
                Apply Filters ({watchlistAnnouncements.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Instant-Add Toast / Banner */}
      {lastAddedInfo && (
        <div className="p-2.5 bg-slate-100/80 dark:bg-[#201E2E] border border-slate-300 dark:border-[#38324E] rounded-lg flex items-center justify-between gap-2 text-xs shadow-2xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100 flex-wrap">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>
              Added <strong className="font-mono text-slate-900 dark:text-white font-black">{lastAddedInfo.symbol}</strong> to {lastAddedInfo.listName} with{' '}
              <span className={cn(
                "px-1.5 py-0.2 rounded text-[9px] uppercase font-black tracking-wider border",
                lastAddedInfo.priority === 'HIGH' ? 'bg-rose-100 text-rose-700 border-rose-300' :
                lastAddedInfo.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-700 border-amber-300' :
                'bg-slate-100 text-slate-700 border-slate-300'
              )}>
                {lastAddedInfo.priority}
              </span> priority!
            </span>
          </div>
          <button 
            onClick={() => setLastAddedInfo(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* TAB 1: MY COMPANIES (DEFAULT VIEW) */}
      {watchlistSubTab === 'companies' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          {/* Collapsible/Expandable Add Company Bar */}
          <AnimatePresence>
            {isAddCompanyOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-white dark:bg-[#1A1926] border border-slate-200/90 dark:border-[#2D283E] rounded-xl p-3.5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Plus className="text-emerald-600 dark:text-emerald-400" size={16} />
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">Add Company to Watchlist</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddCompanyOpen(false)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-[#201E2E] cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={newSymbol}
                      onChange={e => setNewSymbol(e.target.value)}
                      placeholder="Search by company name or BSE/NSE ticker (e.g. TCS, Reliance, Infosys)..."
                      className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] rounded-lg text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500 min-h-[40px]"
                      autoFocus
                    />
                    {isSearching && (
                      <RefreshCw size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-emerald-600" />
                    )}

                    {/* Autocomplete Suggestions Dropdown */}
                    {showSuggestions && searchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1A1926] border border-slate-200 dark:border-[#2D283E] rounded-xl shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-[#252233]">
                        {searchResults.map((item: any) => {
                          const isTracked = myCompaniesList.some(c => c.symbol === item.symbol);
                          return (
                            <div
                              key={item.symbol + (item.scripCode || '')}
                              className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-[#222030] transition-colors"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">{item.symbol}</span>
                                  {item.scripCode && (
                                    <span className="text-[10px] text-slate-400 font-mono">({item.scripCode})</span>
                                  )}
                                  {isTracked && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                      Tracked
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-600 dark:text-slate-300 truncate">{item.name}</div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleDirectAddSymbol(item.symbol, item.name, 'HIGH');
                                    setIsAddCompanyOpen(false);
                                  }}
                                  className="px-2.5 py-1.5 min-h-[34px] bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors active:scale-[0.96]"
                                  title="Add with High Priority"
                                >
                                  <span>🔴 High</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleDirectAddSymbol(item.symbol, item.name, 'MEDIUM');
                                    setIsAddCompanyOpen(false);
                                  }}
                                  className="px-2.5 py-1.5 min-h-[34px] bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors active:scale-[0.96]"
                                  title="Add with Medium Priority"
                                >
                                  <span>🟡 Med</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleDirectAddSymbol(item.symbol, item.name, 'LOW');
                                    setIsAddCompanyOpen(false);
                                  }}
                                  className="px-2.5 py-1.5 min-h-[34px] bg-slate-100 hover:bg-slate-200 dark:bg-[#252233] dark:hover:bg-[#2F2B40] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#353046] rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors active:scale-[0.96]"
                                  title="Add with Low Priority"
                                >
                                  <span>⚪ Low</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Companies List / Grid */}
          {filteredMyCompanies.length === 0 ? (
            <div className="my-4 p-6 sm:p-8 text-left text-slate-400 space-y-4 bg-white dark:bg-[#1A1926] border border-slate-200/90 dark:border-[#2D283E] rounded-2xl max-w-lg shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 dark:text-slate-500">
                <Building2 size={20} />
              </div>
              <div className="space-y-1">
                <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                  {myCompaniesList.length === 0
                    ? "No companies in your watchlist yet"
                    : `No companies match "${companySearch}"`}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {myCompaniesList.length === 0
                    ? "Start by adding companies to track their corporate filings, financial results, and announcements."
                    : "Try searching with a different ticker symbol or company name."}
                </p>
              </div>
              {myCompaniesList.length === 0 && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddCompanyOpen(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs min-h-[36px] active:scale-[0.96]"
                  >
                    <Plus size={14} />
                    <span>Add your first company</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {filteredMyCompanies.map((c) => {
                const initials = (c.name || c.symbol)
                  .split(' ')
                  .map(w => w[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                const priorityColor =
                  c.priority === 'HIGH' ? 'bg-rose-500' :
                  c.priority === 'MEDIUM' ? 'bg-amber-500' :
                  'bg-slate-400';

                return (
                  <div
                    id={`stock-card-${c.symbol}`}
                    key={c.symbol}
                    onClick={() => handleOpenIntel(c.scripCode, c.symbol, c.name)}
                    className="group bg-white dark:bg-[#1A1926] border border-slate-200/90 dark:border-[#2D283E] hover:border-slate-400 dark:hover:border-[#3E3854] rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between gap-3 relative"
                  >
                    {/* Top Row: Avatar + Name + Ticker + Priority */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-2.5 min-w-0">
                        {/* Company Avatar / Icon */}
                        <div className="relative w-9 h-9 rounded-lg bg-slate-100 dark:bg-[#222030] border border-slate-200/80 dark:border-[#332D46] flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200 shrink-0 select-none">
                          {initials}
                          <span
                            className={cn(
                              "absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#1A1926]",
                              priorityColor
                            )}
                            title={`Priority: ${c.priority}`}
                          />
                        </div>

                        {/* Name & Ticker */}
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {c.name}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="font-mono text-[11px] font-extrabold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#222030] px-1.5 py-0.2 rounded border border-slate-200/80 dark:border-[#332D46]">
                              {c.symbol}
                            </span>
                            {c.scripCode && (
                              <span className="font-mono text-[10px] text-slate-400">
                                {c.scripCode}
                              </span>
                            )}
                            {c.category && (
                              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#1E1C2B] px-1.5 py-0.2 rounded border border-slate-200/60 dark:border-[#2D283E]">
                                {c.category}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Tap Target to open company intel */}
                      <motion.button
                        type="button"
                        whileTap={buttonTap}
                        transition={springSnappy}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenIntel(c.scripCode, c.symbol, c.name);
                        }}
                        className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#252233] transition-colors shrink-0 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center select-none"
                        title="Open 360° Company Intelligence"
                        aria-label={`Open ${c.name}`}
                      >
                        <ArrowUpRight size={16} />
                      </motion.button>
                    </div>

                    {/* Middle Row: Concrete Status Label */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap select-none",
                        c.hasResultsDeclaredToday
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                          : c.updateCount > 0
                          ? "bg-slate-100 dark:bg-[#222030] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-[#332D46]"
                          : "text-slate-500 dark:text-slate-400"
                      )}>
                        {c.hasResultsDeclaredToday ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        ) : null}
                        <span>{c.concreteStatus}</span>
                      </span>

                      {c.hasHighImpactUpdate && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 whitespace-nowrap select-none">
                          High impact
                        </span>
                      )}
                    </div>

                    {/* Bottom Row: Update Count + Quick Jump Target */}
                    <div className="pt-2 border-t border-slate-100 dark:border-[#2D283E]/60 flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-1.5">
                        {c.updateCount > 0 ? (
                          <motion.button
                            type="button"
                            whileTap={buttonTap}
                            transition={springSnappy}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStockFilter(c.symbol);
                              setWatchlistSubTab('updates');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-[#252233] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-[#352F48] hover:bg-slate-200 dark:hover:bg-[#2F2B40] transition-colors cursor-pointer select-none min-h-[32px] active:scale-[0.96]"
                            title={`View all ${c.updateCount} filings for ${c.symbol}`}
                          >
                            <span>{c.updateCount} {c.updateCount === 1 ? 'filing' : 'filings'}</span>
                            <ChevronRight size={12} />
                          </motion.button>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 select-none">
                            0 filings
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <motion.button
                          type="button"
                          whileTap={buttonTap}
                          transition={springSnappy}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCyclePriority(c.listId || currentWatchlist?.id || watchlists[0]?.id || '', {
                              symbol: c.symbol,
                              priority: c.priority
                            } as any);
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-50 dark:bg-[#201E2E] border border-slate-200/80 dark:border-[#332D46] cursor-pointer select-none min-h-[32px] flex items-center gap-1 active:scale-[0.96]"
                          title="Cycle priority (High / Medium / Low)"
                        >
                          {c.priority === 'HIGH' ? '🔴 High' : c.priority === 'MEDIUM' ? '🟡 Med' : '⚪ Low'}
                        </motion.button>

                        <motion.button
                          type="button"
                          whileTap={buttonTap}
                          transition={springSnappy}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveSymbol(c.listId || currentWatchlist?.id || watchlists[0]?.id || '', c.symbol);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/60 cursor-pointer select-none min-h-[32px] min-w-[32px] flex items-center justify-center active:scale-[0.96]"
                          title="Remove from watchlist"
                        >
                          <Trash2 size={13} />
                        </motion.button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Edit Watchlist & Manage Stocks */}
      {watchlistSubTab === 'edit' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-[#1A1926] border border-slate-200/90 dark:border-[#2D283E] rounded-xl p-3.5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bookmark className="text-slate-700 dark:text-slate-300" size={17} />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white font-display">Your Watchlists</h3>
              </div>
              <button 
                onClick={() => setIsCreatingList(!isCreatingList)}
                className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus size={12} />
                <span>New List</span>
              </button>
            </div>

            {isCreatingList && (
              <form onSubmit={handleAddList} className="flex gap-2">
                <input 
                  type="text" 
                  value={newListName} 
                  onChange={e => setNewListName(e.target.value)}
                  placeholder="Watchlist name..."
                  className="flex-1 px-2.5 py-1 text-xs bg-slate-50 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] rounded-lg focus:outline-none text-slate-900 dark:text-white"
                  autoFocus
                />
                <button type="submit" className="px-2 py-1 bg-slate-900 text-white text-xs font-bold rounded-lg cursor-pointer">
                  Save
                </button>
              </form>
            )}

            <div className="space-y-1 max-h-[380px] overflow-y-auto">
              {watchlists.map(list => {
              const isListSelected = String(activeListId) === String(list.id);
              const itemCount = (list.items || []).length;
              return (
                <div 
                  key={list.id} 
                  className={cn(
                    "p-3 flex items-center justify-between cursor-pointer rounded-lg transition-all active:scale-[0.98]",
                    isListSelected 
                      ? "bg-slate-900 text-white dark:bg-[#2A263D] dark:text-white font-bold shadow-sm" 
                      : "hover:bg-slate-50 dark:hover:bg-[#222030] text-slate-700 dark:text-slate-300 font-semibold"
                  )}
                  onClick={() => { if (editingListId !== list.id) setActiveListId(String(list.id)); }}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <input 
                      type="checkbox" 
                      checked={list.is_active === 1}
                      onChange={(e) => { e.stopPropagation(); handleToggleList(list.id, list.is_active === 1); }}
                      className="w-3.5 h-3.5 accent-slate-700 dark:accent-slate-400 rounded cursor-pointer shrink-0"
                    />
                    
                    {editingListId === list.id ? (
                      <div className="flex-1 flex items-center gap-1.5 mr-2">
                        <input
                          type="text"
                          autoFocus
                          value={editListName}
                          onChange={e => setEditListName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleRenameList(list.id);
                            if (e.key === 'Escape') setEditingListId(null);
                          }}
                          className="flex-1 px-2.5 py-1.5 text-xs bg-white dark:bg-[#201E2E] border border-slate-400 rounded-lg focus:outline-none w-full text-slate-900 dark:text-white font-bold"
                          onClick={e => e.stopPropagation()}
                        />
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleRenameList(list.id); }} 
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#252233] rounded-lg transition-colors cursor-pointer"
                          title="Save Rename"
                        >
                          <Check size={16} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setEditingListId(null); }} 
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#252233] rounded-lg transition-colors cursor-pointer"
                          title="Cancel"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0 truncate pr-2">
                        <div className="text-xs uppercase truncate font-black">{list.name}</div>
                        <div className={cn("text-[10px] font-mono font-medium", isListSelected ? "text-slate-300" : "text-slate-500 dark:text-slate-400")}>{itemCount} Symbols</div>
                      </div>
                    )}
                  </div>

                  {editingListId !== list.id && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setEditingListId(list.id); 
                          setEditListName(list.name); 
                        }} 
                        title="Rename List"
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#252233] rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteList(list.id); }} 
                        title="Delete List"
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Enhanced Symbols & Priority Categorization Panel */}
        <div className="md:col-span-2 bg-white dark:bg-[#1A1926] border border-slate-200/90 dark:border-[#2D283E] rounded-xl flex flex-col h-[480px] shadow-xs overflow-hidden">
          {activeListId && activeListId !== 'ALL' ? (() => {
            const list = watchlists.find(l => String(l.id) === String(activeListId));
            if (!list) return null;
            return (
              <>
                {/* Form to Add Stock with Priority & Category */}
                <div className="p-3.5 border-b border-slate-100 dark:border-[#2D283E] bg-slate-50/50 dark:bg-[#15141F] space-y-2.5">
                  <form onSubmit={(e) => handleAddSymbol(e, activeListId)} className="space-y-2 relative">
                    <div className="flex flex-col sm:flex-row gap-2 relative">
                      <div className="flex-1 relative">
                        <input 
                          type="text" 
                          value={newSymbol} 
                          onChange={e => setNewSymbol(e.target.value)}
                          placeholder="Search or enter stock symbol (e.g. TCS, RELIANCE, INFOSYS)..."
                          className="w-full px-3 py-1.5 bg-white dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400/20 text-slate-900 dark:text-white uppercase font-bold"
                        />
                        
                        {/* 1-Click Instant Add Suggestions Dropdown */}
                        {showSuggestions && newSymbol.length >= 2 && !newSymbol.includes(',') && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1A1926] border border-slate-200 dark:border-[#2D283E] rounded-xl shadow-2xl z-50 max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-[#2D283E]/50">
                            <div className="px-3 py-1.5 bg-slate-50 dark:bg-[#201E2E] flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-semibold sticky top-0 backdrop-blur-xs z-10">
                              <span className="flex items-center gap-1 text-slate-800 dark:text-slate-200 font-bold">
                                <Zap size={12} className="text-amber-500" />
                                <span>⚡ Click any stock to ADD INSTANTLY to {list.name}</span>
                              </span>
                              <span className="text-slate-400 font-mono text-[9px]">ESC to close</span>
                            </div>

                            {isSearching ? (
                              <div className="p-2 space-y-1.5 animate-pulse">
                                {[1, 2, 3].map((sk) => (
                                  <div key={sk} className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-[#1f1d2b] flex items-center justify-between">
                                    <div className="space-y-1">
                                      <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                                      <div className="h-2.5 w-40 bg-slate-200/60 dark:bg-slate-800 rounded" />
                                    </div>
                                    <div className="h-5 w-12 bg-slate-200/50 dark:bg-slate-800 rounded" />
                                  </div>
                                ))}
                              </div>
                            ) : searchResults.length > 0 ? (
                              searchResults.map((res, i) => {
                                const symToAdd = (res.symbol && res.symbol.trim()) ? res.symbol.trim().toUpperCase() : res.name.replace(/\s+L(?:imi)?t(?:e)?d\.?$/i, '').trim().toUpperCase();
                                const isAlreadyInCurrent = currentListParsedItems.some(it => it.symbol === symToAdd);
                                const globalMatched = symbolDetailsMap[symToAdd];

                                return (
                                  <div 
                                    key={i} 
                                    className="p-2.5 hover:bg-slate-100 dark:hover:bg-[#252233] cursor-pointer flex items-center justify-between gap-3 group transition-all"
                                    onClick={() => handleDirectAddSymbol(symToAdd, res.name, newPriority, newCategory, activeListId)}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-slate-900 dark:text-white group-hover:text-slate-700 dark:group-hover:text-slate-200 truncate">
                                          {res.name}
                                        </span>
                                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300">
                                          {symToAdd}
                                        </span>
                                      </div>
                                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                                        {isAlreadyInCurrent ? (
                                          <span className="text-slate-700 dark:text-slate-300 font-bold flex items-center gap-0.5">
                                            <CheckCheck size={11} /> Already in this list ({currentListParsedItems.find(it => it.symbol === symToAdd)?.priority})
                                          </span>
                                        ) : globalMatched ? (
                                          <span className="text-blue-500 font-medium flex items-center gap-0.5">
                                            <span>In another list ({globalMatched.priority})</span>
                                          </span>
                                        ) : (
                                          <span className="text-slate-600 dark:text-slate-300 font-medium">
                                            ⚡ Click to add with <strong>{newPriority}</strong> priority
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* 1-Click Priority Selectors on each row */}
                                    <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                                      <button
                                        type="button"
                                        onClick={() => handleDirectAddSymbol(symToAdd, res.name, 'HIGH', newCategory, activeListId)}
                                        title="Add directly with HIGH priority"
                                        className="px-2.5 py-1.5 text-[10px] font-black rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-all active:scale-[0.96] flex items-center gap-1 cursor-pointer shadow-2xs min-h-[32px]"
                                      >
                                        <span>🔴</span>
                                        <span className="hidden sm:inline">HIGH</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDirectAddSymbol(symToAdd, res.name, 'MEDIUM', newCategory, activeListId)}
                                        title="Add directly with MEDIUM priority"
                                        className="px-2.5 py-1.5 text-[10px] font-black rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition-all active:scale-[0.96] flex items-center gap-1 cursor-pointer shadow-2xs min-h-[32px]"
                                      >
                                        <span>🟡</span>
                                        <span className="hidden sm:inline">MED</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDirectAddSymbol(symToAdd, res.name, 'LOW', newCategory, activeListId)}
                                        title="Add directly with LOW priority"
                                        className="px-2.5 py-1.5 text-[10px] font-black rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#2D283E] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-[#3E3854] transition-all active:scale-[0.96] flex items-center gap-1 cursor-pointer shadow-2xs min-h-[32px]"
                                      >
                                        <span>⚪</span>
                                        <span className="hidden sm:inline">LOW</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="p-4 text-xs text-slate-400 text-center">No matching tickers found. Press Add to use exact ticker.</div>
                            )}
                          </div>
                        )}
                      </div>

                      <input
                        type="text"
                        value={newCategory}
                        onChange={e => setNewCategory(e.target.value)}
                        placeholder="Tag / Category (e.g. Core, Swing, SmallCap)"
                        className="sm:w-48 px-3 py-1.5 bg-white dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 dark:text-white min-h-[38px]"
                      />

                      <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 min-h-[38px] active:scale-[0.96]">
                        <Plus size={14} />
                        <span>Add Stock</span>
                      </button>
                    </div>

                    {/* Priority Selector for the New Stock */}
                    <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">Default Priority:</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setNewPriority('HIGH')}
                          className={cn(
                            "px-3 py-1.5 text-xs rounded-lg font-bold transition-all cursor-pointer border flex items-center gap-1.5 whitespace-nowrap shrink-0 min-h-[34px] active:scale-[0.96]",
                            newPriority === 'HIGH'
                              ? "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 shadow-xs ring-1 ring-rose-500/30"
                              : "bg-white dark:bg-[#201E2E] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#2D283E] hover:bg-slate-50 dark:hover:bg-[#28253B]"
                          )}
                        >
                          <span>🔴 High (Conviction)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewPriority('MEDIUM')}
                          className={cn(
                            "px-3 py-1.5 text-xs rounded-lg font-bold transition-all cursor-pointer border flex items-center gap-1.5 whitespace-nowrap shrink-0 min-h-[34px] active:scale-[0.96]",
                            newPriority === 'MEDIUM'
                              ? "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 shadow-xs ring-1 ring-amber-500/30"
                              : "bg-white dark:bg-[#201E2E] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#2D283E] hover:bg-slate-50 dark:hover:bg-[#28253B]"
                          )}
                        >
                          <span>🟡 Medium (Radar)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewPriority('LOW')}
                          className={cn(
                            "px-3 py-1.5 text-xs rounded-lg font-bold transition-all cursor-pointer border flex items-center gap-1.5 whitespace-nowrap shrink-0 min-h-[34px] active:scale-[0.96]",
                            newPriority === 'LOW'
                              ? "bg-slate-200 dark:bg-[#2D283E] text-slate-800 dark:text-slate-200 border-slate-300 dark:border-[#3E3854] shadow-xs"
                              : "bg-white dark:bg-[#201E2E] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#2D283E] hover:bg-slate-50 dark:hover:bg-[#28253B]"
                          )}
                        >
                          <span>⚪ Low (Tracking)</span>
                        </button>
                      </div>
                    </div>
                  </form>
                </div>

                {/* Filter and Stats Bar for Symbols Panel */}
                <div className="px-3.5 py-2 border-b border-slate-100 dark:border-[#2D283E] bg-slate-50/30 dark:bg-[#15141F]/40 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1 overflow-x-auto">
                    {[
                      { id: 'ALL' as const, label: 'All', count: symbolPriorityCounts.TOTAL },
                      { id: 'HIGH' as const, label: '🔴 High', count: symbolPriorityCounts.HIGH },
                      { id: 'MEDIUM' as const, label: '🟡 Med', count: symbolPriorityCounts.MEDIUM },
                      { id: 'LOW' as const, label: '⚪ Low', count: symbolPriorityCounts.LOW }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSymbolPriorityFilter(tab.id)}
                        className={cn(
                          "px-2 py-0.5 text-[11px] rounded-md font-bold transition-all cursor-pointer flex items-center gap-1",
                          symbolPriorityFilter === tab.id
                            ? "bg-slate-900 dark:bg-[#2A263D] text-white"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#222030]"
                        )}
                      >
                        <span>{tab.label}</span>
                        <span className="text-[9px] opacity-75 font-mono">({tab.count})</span>
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={symbolSearchQuery}
                        onChange={e => setSymbolSearchQuery(e.target.value)}
                        placeholder="Filter stocks in list..."
                        className="pl-6 pr-2 py-1 bg-white dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] text-[11px] rounded-md focus:outline-none text-slate-900 dark:text-white w-36 sm:w-44"
                      />
                    </div>

                    {/* List Actions Menu */}
                    <div className="relative" ref={listMenuRef}>
                      <motion.button
                        type="button"
                        whileTap={buttonTap}
                        transition={springSnappy}
                        onClick={() => setOpenMenuForList(openMenuForList === activeListId ? null : activeListId)}
                        className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#201E2E] rounded-lg border border-slate-200 dark:border-[#2D283E] transition-colors cursor-pointer touch-manipulation min-h-[36px] min-w-[36px] flex items-center justify-center"
                        title="List options"
                      >
                        <MoreVertical size={14} />
                      </motion.button>

                      {openMenuForList === activeListId && (
                        <>
                          <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-[#1E1C2B] border border-slate-200 dark:border-[#38324E] rounded-xl shadow-xl p-1 z-30 animate-in fade-in duration-100">
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.96 }}
                              transition={springSnappy}
                              onClick={() => {
                                setOpenMenuForList(null);
                                setConfirmModalState({
                                  isOpen: true,
                                  title: `Clear "${list.name}" Watchlist?`,
                                  description: `Are you sure you want to remove all ${currentListParsedItems.length} stocks from "${list.name}"? This action cannot be undone.`,
                                  actionType: 'clear_list',
                                  listId: activeListId,
                                  listName: list.name,
                                  stockCount: currentListParsedItems.length
                                });
                              }}
                              disabled={currentListParsedItems.length === 0}
                              className="w-full text-left px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation min-h-[38px]"
                            >
                              <Trash2 size={13} />
                              <span>Clear List ({currentListParsedItems.length})</span>
                            </motion.button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Symbols Grid with 1-Click Priority Toggle & Pulse Highlight */}
                <div className="flex-1 overflow-y-auto p-3">
                  <div className="flex flex-wrap gap-2">
                    {filteredListStockItems.map((item) => {
                      const isHigh = item.priority === 'HIGH';
                      const isMed = item.priority === 'MEDIUM';
                      const isHighlighted = highlightedSymbol === item.symbol;

                      return (
                        <div 
                          id={`watchlist-symbol-${item.symbol}`}
                          key={item.symbol} 
                          className={cn(
                            "flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-[#201E2E] border rounded-lg shadow-2xs group transition-all",
                            isHighlighted ? "ring-2 ring-slate-400 border-slate-500 scale-105 bg-slate-100 dark:bg-[#252233]" :
                            isHigh ? "border-rose-200 dark:border-rose-900/50 hover:border-rose-400" :
                            isMed ? "border-amber-200 dark:border-amber-900/50 hover:border-amber-400" :
                            "border-slate-200 dark:border-[#2D283E] hover:border-slate-400 dark:hover:border-[#4A4266]"
                          )}
                        >
                          {/* 1-Click Priority Cycling Badge */}
                          <button
                            type="button"
                            onClick={() => handleCyclePriority(activeListId, item)}
                            title="Click to cycle priority: High -> Medium -> Low -> High"
                            className={cn(
                              "text-[10px] font-black px-1.5 py-0.5 rounded cursor-pointer transition-transform active:scale-90 flex items-center gap-1 uppercase",
                              isHigh ? "bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800" :
                              isMed ? "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800" :
                              "bg-slate-100 dark:bg-[#2D283E] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-[#3E3854]"
                            )}
                          >
                            <span>{isHigh ? '🔴 HIGH' : isMed ? '🟡 MED' : '⚪ LOW'}</span>
                          </button>

                          <div 
                            className="flex flex-col cursor-pointer group/sym"
                            onClick={(e) => {
                              const master = stockMasterClient[item.symbol];
                              handleOpenIntel(master?.scripCode, item.symbol, item.companyName || item.symbol, e);
                            }}
                            title="Click to open 360° Stock Intelligence"
                          >
                            <span className="font-mono text-xs font-bold text-slate-800 dark:text-white uppercase leading-tight group-hover/sym:text-slate-900 dark:group-hover/sym:text-slate-200 transition-colors">
                              {item.symbol}
                            </span>
                            {item.category && (
                              <span className="text-[9px] font-medium text-slate-400 leading-tight truncate max-w-[80px]">
                                {item.category}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              const master = stockMasterClient[item.symbol];
                              handleOpenIntel(master?.scripCode, item.symbol, item.companyName || item.symbol, e);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#2A263D] transition-colors cursor-pointer"
                            title="Open 360° Intelligence"
                          >
                            <Building2 size={13} />
                          </button>

                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveSymbol(activeListId, item.symbol);
                            }} 
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer -mr-2"
                            title="Remove stock"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                    {filteredListStockItems.length === 0 && (
                      <div className="w-full text-center py-12 text-xs text-slate-400 space-y-1">
                        <p className="font-semibold text-slate-600 dark:text-slate-300">
                          {currentListParsedItems.length === 0 
                            ? "No symbols added to this watchlist yet."
                            : "No symbols match the current priority or search filter."}
                        </p>
                        <p className="text-[11px]">Type in the search bar above and click any stock to add it instantly.</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            );
          })() : (
            /* ALL WATCHLISTS COMBINED MANAGEMENT PANEL */
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Form to Add Stock directly to any watchlist */}
              <div className="p-3.5 border-b border-slate-100 dark:border-[#2D283E] bg-slate-50/50 dark:bg-[#15141F] space-y-2.5">
                <form onSubmit={(e) => handleAddSymbol(e, allPanelTargetListId || watchlists[0]?.id)} className="space-y-2 relative">
                  <div className="flex flex-col sm:flex-row gap-2 relative">
                    {/* Watchlist Picker for Adding */}
                    <div className="sm:w-40 shrink-0">
                      <select
                        value={allPanelTargetListId || watchlists[0]?.id || ''}
                        onChange={e => setAllPanelTargetListId(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] text-xs rounded-lg font-bold text-slate-800 dark:text-white focus:outline-none"
                      >
                        {watchlists.map(wl => (
                          <option key={wl.id} value={wl.id}>Add to: {wl.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex-1 relative">
                      <input 
                        type="text" 
                        value={newSymbol} 
                        onChange={e => setNewSymbol(e.target.value)}
                        placeholder="Search or enter stock symbol (e.g. TCS, RELIANCE, 500325)..."
                        className="w-full px-3 py-1.5 bg-white dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400/20 text-slate-900 dark:text-white uppercase font-bold"
                      />
                      
                      {/* Suggestions Dropdown in ALL panel */}
                      {showSuggestions && newSymbol.length >= 2 && !newSymbol.includes(',') && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1A1926] border border-slate-200 dark:border-[#2D283E] rounded-xl shadow-2xl z-50 max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-[#2D283E]/50">
                          <div className="px-3 py-1.5 bg-slate-50 dark:bg-[#201E2E] flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-semibold sticky top-0 backdrop-blur-xs z-10">
                            <span className="flex items-center gap-1 text-slate-800 dark:text-slate-200 font-bold">
                              <Zap size={12} className="text-amber-500" />
                              <span>⚡ Click any stock to ADD INSTANTLY to {watchlists.find(w => w.id === (allPanelTargetListId || watchlists[0]?.id))?.name || 'Watchlist'}</span>
                            </span>
                            <span className="text-slate-400 font-mono text-[9px]">ESC to close</span>
                          </div>

                          {isSearching ? (
                            <div className="p-2 space-y-1.5 animate-pulse">
                              {[1, 2, 3].map((sk) => (
                                <div key={sk} className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-[#1f1d2b] flex items-center justify-between">
                                  <div className="space-y-1">
                                    <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                                    <div className="h-2.5 w-40 bg-slate-200/60 dark:bg-slate-800 rounded" />
                                  </div>
                                  <div className="h-5 w-12 bg-slate-200/50 dark:bg-slate-800 rounded" />
                                </div>
                              ))}
                            </div>
                          ) : searchResults.length > 0 ? (
                            searchResults.map((res, i) => {
                              const symToAdd = (res.symbol && res.symbol.trim()) ? res.symbol.trim().toUpperCase() : res.name.replace(/\s+L(?:imi)?t(?:e)?d\.?$/i, '').trim().toUpperCase();
                              const targetId = allPanelTargetListId || watchlists[0]?.id;

                              return (
                                <div 
                                  key={i} 
                                  className="p-2.5 hover:bg-slate-100 dark:hover:bg-[#252233] cursor-pointer flex items-center justify-between gap-3 group transition-all"
                                  onClick={() => handleDirectAddSymbol(symToAdd, res.name, newPriority, newCategory, targetId)}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-black text-slate-900 dark:text-white group-hover:text-slate-700 dark:group-hover:text-slate-200 truncate">
                                        {res.name}
                                      </span>
                                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300">
                                        {symToAdd}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                                      <span className="text-slate-600 dark:text-slate-300 font-medium">
                                        ⚡ Click to add with <strong>{newPriority}</strong> priority
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      onClick={() => handleDirectAddSymbol(symToAdd, res.name, 'HIGH', newCategory, targetId)}
                                      className="px-2 py-1 text-[10px] font-black rounded-md bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-transform active:scale-90"
                                    >
                                      <span>🔴 HIGH</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDirectAddSymbol(symToAdd, res.name, 'MEDIUM', newCategory, targetId)}
                                      className="px-2 py-1 text-[10px] font-black rounded-md bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition-transform active:scale-90"
                                    >
                                      <span>🟡 MED</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDirectAddSymbol(symToAdd, res.name, 'LOW', newCategory, targetId)}
                                      className="px-2 py-1 text-[10px] font-black rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-[#2D283E] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-[#3E3854] transition-transform active:scale-90"
                                    >
                                      <span>⚪ LOW</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="p-4 text-xs text-slate-400 text-center">No matching tickers found</div>
                          )}
                        </div>
                      )}
                    </div>

                    <input
                      type="text"
                      value={newCategory}
                      onChange={e => setNewCategory(e.target.value)}
                      placeholder="Tag / Category"
                      className="sm:w-36 px-3 py-1.5 bg-white dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] text-xs rounded-lg focus:outline-none text-slate-900 dark:text-white"
                    />

                    <button type="submit" className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-[#2A263D] dark:hover:bg-[#342F4C] text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer shrink-0">
                      Add Stock
                    </button>
                  </div>

                  {/* Priority Selector for ALL panel */}
                  <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Stock Priority:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setNewPriority('HIGH')}
                        className={cn(
                          "px-2.5 py-0.5 text-[11px] rounded-md font-bold transition-all cursor-pointer border flex items-center gap-1",
                          newPriority === 'HIGH'
                            ? "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 shadow-xs ring-1 ring-rose-500/30"
                            : "bg-white dark:bg-[#201E2E] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#2D283E] hover:bg-slate-50"
                        )}
                      >
                        <span>🔴 High (Core Conviction)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewPriority('MEDIUM')}
                        className={cn(
                          "px-2.5 py-0.5 text-[11px] rounded-md font-bold transition-all cursor-pointer border flex items-center gap-1",
                          newPriority === 'MEDIUM'
                            ? "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 shadow-xs ring-1 ring-amber-500/30"
                            : "bg-white dark:bg-[#201E2E] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#2D283E] hover:bg-slate-50"
                        )}
                      >
                        <span>🟡 Medium (Radar/Swing)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewPriority('LOW')}
                        className={cn(
                          "px-2.5 py-0.5 text-[11px] rounded-md font-bold transition-all cursor-pointer border flex items-center gap-1",
                          newPriority === 'LOW'
                            ? "bg-slate-200 dark:bg-[#2D283E] text-slate-800 dark:text-slate-200 border-slate-300 dark:border-[#3E3854] shadow-xs"
                            : "bg-white dark:bg-[#201E2E] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#2D283E] hover:bg-slate-50"
                        )}
                      >
                        <span>⚪ Low (Tracking)</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Filter and Stats Bar for ALL Symbols */}
              <div className="px-3.5 py-2 border-b border-slate-100 dark:border-[#2D283E] bg-slate-50/30 dark:bg-[#15141F]/40 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 overflow-x-auto">
                  {[
                    { id: 'ALL' as const, label: 'All Stocks', count: allTrackedPriorityCounts.TOTAL },
                    { id: 'HIGH' as const, label: '🔴 High', count: allTrackedPriorityCounts.HIGH },
                    { id: 'MEDIUM' as const, label: '🟡 Med', count: allTrackedPriorityCounts.MEDIUM },
                    { id: 'LOW' as const, label: '⚪ Low', count: allTrackedPriorityCounts.LOW }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSymbolPriorityFilter(tab.id)}
                      className={cn(
                        "px-2 py-0.5 text-[11px] rounded-md font-bold transition-all cursor-pointer flex items-center gap-1",
                        symbolPriorityFilter === tab.id
                          ? "bg-slate-900 dark:bg-[#2A263D] text-white"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#222030]"
                      )}
                    >
                      <span>{tab.label}</span>
                      <span className="text-[9px] opacity-75 font-mono">({tab.count})</span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={symbolSearchQuery}
                      onChange={e => setSymbolSearchQuery(e.target.value)}
                      placeholder="Search across all lists..."
                      className="pl-6 pr-2 py-1 bg-white dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] text-[11px] rounded-md focus:outline-none text-slate-900 dark:text-white w-36 sm:w-44"
                    />
                  </div>

                  {/* Options Menu */}
                  <div className="relative" ref={allMenuRef}>
                    <motion.button
                      type="button"
                      whileTap={buttonTap}
                      transition={springSnappy}
                      onClick={() => setOpenMenuForList(openMenuForList === 'ALL' ? null : 'ALL')}
                      className="px-3 py-1.5 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#201E2E] rounded-lg border border-slate-200 dark:border-[#2D283E] transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer touch-manipulation min-h-[36px]"
                      title="Watchlist management options"
                    >
                      <SlidersHorizontal size={13} />
                      <span>Options</span>
                    </motion.button>

                    {openMenuForList === 'ALL' && (
                      <>
                        <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-[#1E1C2B] border border-slate-200 dark:border-[#38324E] rounded-xl shadow-xl p-1.5 z-30 animate-in fade-in duration-100 space-y-1">
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.96 }}
                            transition={springSnappy}
                            onClick={() => {
                              setOpenMenuForList(null);
                              setConfirmModalState({
                                isOpen: true,
                                title: "Restore Curated Default Watchlists?",
                                description: "This will reset all your watchlists to the standard curated Indian equity baskets.",
                                actionType: 'reset_defaults'
                              });
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2A263D] rounded-lg transition-colors flex items-center gap-2 cursor-pointer touch-manipulation min-h-[38px]"
                          >
                            <RotateCcw size={14} className="text-amber-500" />
                            <span>Reset to Curated Defaults</span>
                          </motion.button>

                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.96 }}
                            transition={springSnappy}
                            onClick={() => {
                              setOpenMenuForList(null);
                              setConfirmModalState({
                                isOpen: true,
                                title: "Clear ALL Watchlists?",
                                description: `Are you sure you want to remove all ${allCombinedTrackedItems.length} stocks across all ${watchlists.length} watchlists? This action cannot be undone.`,
                                actionType: 'clear_all',
                                stockCount: allCombinedTrackedItems.length
                              });
                            }}
                            disabled={allCombinedTrackedItems.length === 0}
                            className="w-full text-left px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border-t border-slate-100 dark:border-[#2D283E] pt-2 touch-manipulation min-h-[38px]"
                          >
                            <Trash2 size={14} />
                            <span>Clear All Watchlists ({allCombinedTrackedItems.length})</span>
                          </motion.button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Combined Symbols Grid with List Badges & 1-Click Priority Toggle */}
              <div className="flex-1 overflow-y-auto p-3">
                <div className="flex flex-wrap gap-2">
                  {filteredAllTrackedItems.map((item, idx) => {
                    const isHigh = item.priority === 'HIGH';
                    const isMed = item.priority === 'MEDIUM';
                    const isHighlighted = highlightedSymbol === item.symbol;

                    return (
                      <div 
                        key={`${item.listId}-${item.symbol}-${idx}`} 
                        className={cn(
                          "flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-[#201E2E] border rounded-lg shadow-2xs group transition-all",
                          isHighlighted ? "ring-2 ring-slate-400 border-slate-500 scale-105 bg-slate-100 dark:bg-[#252233]" :
                          isHigh ? "border-rose-200 dark:border-rose-900/50 hover:border-rose-400" :
                          isMed ? "border-amber-200 dark:border-amber-900/50 hover:border-amber-400" :
                          "border-slate-200 dark:border-[#2D283E] hover:border-slate-400 dark:hover:border-[#4A4266]"
                        )}
                      >
                        {/* 1-Click Priority Cycling Badge */}
                        <button
                          type="button"
                          onClick={() => handleCyclePriority(item.listId, item as any)}
                          title="Click to cycle priority: High -> Medium -> Low -> High"
                          className={cn(
                            "text-[10px] font-black px-1.5 py-0.5 rounded cursor-pointer transition-transform active:scale-90 flex items-center gap-1 uppercase",
                            isHigh ? "bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800" :
                            isMed ? "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800" :
                            "bg-slate-100 dark:bg-[#2D283E] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-[#3E3854]"
                          )}
                        >
                          <span>{isHigh ? '🔴 HIGH' : isMed ? '🟡 MED' : '⚪ LOW'}</span>
                        </button>

                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-bold text-slate-800 dark:text-white uppercase leading-tight">
                            {item.symbol}
                          </span>
                          <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 leading-tight truncate max-w-[90px]">
                            {item.listName}
                          </span>
                        </div>

                        {item.category && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-slate-100 dark:bg-[#15141F] text-slate-500 font-medium truncate max-w-[70px]">
                            {item.category}
                          </span>
                        )}

                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveSymbol(item.listId, item.symbol);
                          }} 
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer -mr-2"
                          title={`Remove from ${item.listName}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                  {filteredAllTrackedItems.length === 0 && (
                    <div className="w-full text-center py-12 text-xs text-slate-400 space-y-1">
                      <p className="font-semibold text-slate-600 dark:text-slate-300">
                        {allCombinedTrackedItems.length === 0 
                          ? "No stocks across your watchlists." 
                          : "No stocks match your search filter."}
                      </p>
                      <p className="text-[11px]">Search above to add symbols directly to any watchlist.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* VIEW 2: DEDICATED WATCHLIST ANNOUNCEMENTS & SUMMARIES FEED */}
      {watchlistSubTab === 'updates' && (
      <div className="space-y-3 pt-0.5 animate-in fade-in duration-150">
        {/* Watchlist Announcements List */}
        <div className={cn(
          "rounded-xl overflow-hidden",
          viewMode === 'list' ? "bg-white dark:bg-[#1A1926] border border-slate-200/90 dark:border-[#2D283E] shadow-xs" : ""
        )}>
          {paginatedWatchlistAnnouncements.length === 0 ? (
            <div className="p-6 sm:p-8 text-left text-slate-400 space-y-4 bg-white dark:bg-[#1A1926] border border-slate-200/90 dark:border-[#2D283E] rounded-2xl max-w-lg shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 dark:text-slate-500">
                <FileText size={20} />
              </div>
              <div className="space-y-1">
                <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                  {activeSymbols.length === 0 ? "Your Watchlist is Empty" : "No Watchlist Disclosures Found"}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {activeSymbols.length === 0 
                    ? "You have no companies in your active watchlist. Add stocks above to track their live BSE corporate announcements and disclosures." 
                    : "No matching filings found for the selected filter or symbols. Click \"Quick Sync\" above to pull historical disclosures from BSE."}
                </p>
              </div>
            </div>
          ) : (
            <motion.div
              key="watchlist-feed-container"
              variants={containerStaggerVariants}
              initial="hidden"
              animate="visible"
              className={cn(
                viewMode === 'grid'
                  ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch"
                  : "divide-y divide-slate-100 dark:divide-[#2D283E]/60"
              )}
            >
              {paginatedWatchlistAnnouncements.map((cluster, idx) => {
                const item = cluster.primaryItem;
                const isResult = cluster.hasResults || item.category === 'RESULTS';
                const isConcall = cluster.hasConcall || item.category === 'CONFERENCE_CALL';
                const isExpanded = Boolean(expandedClusters[cluster.id]);

                // Find matched stock priority in watchlist
                let matchedStock: WatchlistStockItem | null = null;
                for (const sym of activeSymbols) {
                  if (checkSymbolMatchFast(item.companyName, item.subject, sym, item.scrip_cd)) {
                    matchedStock = symbolDetailsMap[sym];
                    break;
                  }
                }

                // Conviction 3px Left Edge Strip Color Class
                const convictionBorderClass = 
                  matchedStock?.priority === 'HIGH' 
                    ? "border-l-[3.5px] border-l-rose-500" 
                    : matchedStock?.priority === 'MEDIUM' 
                      ? "border-l-[3.5px] border-l-amber-500" 
                      : "border-l-[3.5px] border-l-slate-300 dark:border-l-slate-600";

                // RENDER CLUSTERED BUNDLE (2+ Filings from same company)
                if (cluster.isCluster) {
                  const cleanSub = cleanBseSubject(item.subject, item.companyName, item.scrip_cd);

                  return (
                    <motion.div
                      key={cluster.id || `cluster-${idx}`}
                      variants={itemFadeUpVariants}
                      whileHover={{ backgroundColor: viewMode === 'grid' ? undefined : 'rgba(248, 250, 252, 0.6)' }}
                      transition={springSnappy}
                      className={viewMode === 'grid' ? "h-full" : ""}
                    >
                      <SwipeableFilingCard
                        onSwipeLeft={() => {
                          setSelectedAnnouncement(item);
                          if (!item.aiSummary) handleGenerateSummary(item.id);
                        }}
                        onSwipeRight={() => {
                          handleManualSendTelegram(item);
                        }}
                        onClick={() => setSelectedAnnouncement(item)}
                        isSent={item.is_sent}
                        className={cn(
                          convictionBorderClass,
                          viewMode === 'grid'
                            ? "p-3.5 bg-white dark:bg-[#1A1926] border border-slate-200/90 dark:border-[#2D283E] rounded-xl shadow-2xs hover:shadow-xs hover:border-slate-300 dark:hover:border-[#38324E] transition-all flex flex-col justify-between gap-3 h-full"
                            : "p-3 hover:bg-slate-50/80 dark:hover:bg-[#222030]/50 transition-colors space-y-2",
                          isExpanded ? "bg-slate-50/90 dark:bg-[#1E1C2B]" : ""
                        )}
                      >
                        {/* Top Row: Company Info & Cluster Badge */}
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            {/* Company Avatar */}
                            <div className={cn(
                              "w-7 h-7 rounded-md flex items-center justify-center font-bold text-[11px] shrink-0 border relative font-mono",
                              matchedStock?.priority === 'HIGH' ? "bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800" :
                              matchedStock?.priority === 'MEDIUM' ? "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800" :
                              "bg-slate-100 dark:bg-[#201E2E] text-slate-800 dark:text-slate-200 border-slate-200/80 dark:border-[#2D283E]"
                            )}>
                              {(item.companyName || 'BSE').substring(0, 2).toUpperCase()}
                              <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-purple-600 text-white text-[8px] font-black flex items-center justify-center shadow-xs">
                                {cluster.count}
                              </span>
                            </div>

                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                                  {item.companyName}
                                </span>

                                {/* Prominent Cluster Bundle Tag */}
                                {cluster.isDuplicateSubject ? (
                                  <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/70 flex items-center gap-1">
                                    <Layers size={10} className="text-amber-600 dark:text-amber-400" />
                                    <span>⚠️ {cluster.count} Revised ({cluster.timeSpanLabel})</span>
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700/70 flex items-center gap-1">
                                    <Layers size={10} className="text-purple-600 dark:text-purple-400" />
                                    <span>📦 {cluster.count} Batch ({cluster.timeSpanLabel})</span>
                                  </span>
                                )}

                                {matchedStock && (
                                  <span className={cn(
                                    "text-[9px] font-extrabold px-1.5 py-0.2 rounded border uppercase tracking-wider",
                                    matchedStock.priority === 'HIGH' ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800" :
                                    matchedStock.priority === 'MEDIUM' ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800" :
                                    "bg-slate-100 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-[#2D283E]"
                                  )}>
                                    {matchedStock.priority === 'HIGH' ? 'HIGH' : matchedStock.priority === 'MEDIUM' ? 'RADAR' : 'TRACKING'}
                                  </span>
                                )}

                                {item.scrip_cd && (
                                  <span className="text-[9px] font-mono px-1 py-0.2 bg-slate-100 dark:bg-[#201E2E] text-slate-500 dark:text-slate-400 rounded border border-slate-200 dark:border-[#2D283E]">
                                    {item.scrip_cd}
                                  </span>
                                )}

                                {cleanSub.regulation && (
                                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-[#252233] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#352F48]">
                                    {cleanSub.regulation}
                                  </span>
                                )}

                                {isResult && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded">
                                    Results
                                  </span>
                                )}
                                {isConcall && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded">
                                    Concall
                                  </span>
                                )}
                              </div>

                              {/* Latest Filing Headline */}
                              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                                {cleanSub.headline}
                              </div>

                              {/* Metadata row */}
                              <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 pt-0.5 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Clock size={11} />
                                  {formatFilingRelativeTime(item.bseTime || item.fetched_at)}
                                </span>

                                {item.pdfLink && (
                                  <a 
                                    href={getSafePdfUrl(item.pdfLink, item.ATTACHMENTNAME || item.attachmentName, item.id, item.scrip_cd)} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 bg-slate-100 hover:bg-rose-50 dark:bg-[#252233] dark:hover:bg-rose-950/40 border border-slate-200 dark:border-[#38324E] hover:border-rose-300 transition-all cursor-pointer shadow-2xs font-sans"
                                    title="Open official BSE PDF"
                                  >
                                    <FileText size={10} className="text-rose-500 shrink-0" />
                                    <span>Open PDF</span>
                                    <ArrowUpRight size={9} className="opacity-60" />
                                  </a>
                                )}

                                <div onClick={e => e.stopPropagation()}>
                                  <ShareActionMenu
                                    title={`${item.companyName} (${item.scrip_cd ? `BSE: ${item.scrip_cd}` : 'BSE'})`}
                                    headline={cleanSub.headline}
                                    companyName={item.companyName}
                                    scripCode={item.scrip_cd}
                                    newsId={item.id || item.newsId}
                                    category={item.category}
                                    pdfUrl={item.pdfLink || item.ATTACHMENTNAME || item.attachmentName}
                                    size="xs"
                                  />
                                </div>

                                {item.aiSummary && (
                                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-sans font-semibold">
                                    <Sparkles size={11} className="text-amber-500" />
                                    <span>AI Ready</span>
                                  </span>
                                )}

                                {item.is_sent ? (
                                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0 inline-block" title="Dispatched to Telegram" />
                                ) : null}
                              </div>
                            </div>
                          </div>

                          {/* Right Cluster Expand Toggle */}
                          <div className="flex items-center gap-1 shrink-0 pt-0.5" onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => toggleCluster(cluster.id, e)}
                              className={cn(
                                "px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer border shadow-2xs min-h-[32px] active:scale-[0.96]",
                                isExpanded
                                  ? "bg-slate-900 dark:bg-[#2A263D] text-white border-slate-900 dark:border-[#2A263D]"
                                  : "bg-slate-100 dark:bg-[#222030] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#332D46] hover:bg-slate-200 dark:hover:bg-[#2F2B40]"
                              )}
                            >
                              <Layers size={12} />
                              <span>{isExpanded ? `Hide (${cluster.count})` : `${cluster.count} filings`}</span>
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          </div>
                        </div>

                        {/* EXPANDED ACCORDION: Sub-Filings Detailed List */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={springSnappy}
                              className="overflow-hidden"
                            >
                              <div className="mt-2 pt-2 border-t border-slate-200 dark:border-[#2D283E] space-y-1 bg-slate-50/80 dark:bg-[#15141F] p-2.5 rounded-lg">
                                <div className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5 pb-1">
                                  <Layers size={11} />
                                  <span>All {cluster.count} Filings in this batch:</span>
                                </div>

                                <div className="space-y-1">
                                  {cluster.items.map((subItem, sIdx) => {
                                    const subClean = cleanBseSubject(subItem.subject, subItem.companyName, subItem.scrip_cd);
                                    return (
                                      <div
                                        key={subItem.id || `sub-${sIdx}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedAnnouncement(subItem);
                                        }}
                                        className={cn(
                                          "p-2 rounded-lg bg-white dark:bg-[#1E1C2B] border border-slate-200/80 dark:border-[#38324E] hover:border-slate-400 dark:hover:border-[#4A4266] transition-all flex flex-col md:flex-row md:items-center justify-between gap-2 cursor-pointer",
                                          selectedAnnouncement?.id === subItem.id && "ring-1 ring-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30"
                                        )}
                                      >
                                        <div className="flex-1 min-w-0 space-y-0.5">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
                                              {formatCleanTime(subItem.bseTime || subItem.fetched_at)}
                                            </span>
                                            <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-slate-100 dark:bg-[#252233] text-slate-700 dark:text-slate-300">
                                              #{sIdx + 1}
                                            </span>
                                            {subClean.regulation && (
                                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-[#252233] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#352F48]">
                                                {subClean.regulation}
                                              </span>
                                            )}
                                          </div>

                                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-2">
                                            {subClean.headline}
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0 self-end md:self-center" onClick={e => e.stopPropagation()}>
                                          {subItem.pdfLink && (
                                            <a
                                              href={subItem.pdfLink}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-[#252233] dark:hover:bg-[#2E2A3E] text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-[#38324E] flex items-center gap-1"
                                            >
                                              <ExternalLink size={10} />
                                              <span>PDF</span>
                                            </a>
                                          )}
                                          <ShareActionMenu
                                            title={`${subItem.companyName} (${subItem.scrip_cd ? `BSE: ${subItem.scrip_cd}` : 'BSE'})`}
                                            headline={subClean.headline}
                                            companyName={subItem.companyName}
                                            scripCode={subItem.scrip_cd}
                                            newsId={subItem.id || subItem.newsId}
                                            category={subItem.category}
                                            pdfUrl={subItem.pdfLink || subItem.ATTACHMENTNAME || subItem.attachmentName}
                                            size="xs"
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </SwipeableFilingCard>
                    </motion.div>
                  );
                }

                // RENDER SINGLE ANNOUNCEMENT CARD
                const singleClean = cleanBseSubject(item.subject, item.companyName, item.scrip_cd);

                return (
                  <motion.div
                    key={`${item.id || 'wl-ann'}-${idx}`}
                    variants={itemFadeUpVariants}
                    whileHover={{ backgroundColor: viewMode === 'grid' ? undefined : 'rgba(248, 250, 252, 0.6)' }}
                    transition={springSnappy}
                    className={viewMode === 'grid' ? "h-full" : ""}
                  >
                    <SwipeableFilingCard
                      onSwipeLeft={() => {
                        setSelectedAnnouncement(item);
                        if (!item.aiSummary) handleGenerateSummary(item.id);
                      }}
                      onSwipeRight={() => {
                        handleManualSendTelegram(item);
                      }}
                      onClick={() => setSelectedAnnouncement(item)}
                      isSent={item.is_sent}
                      className={cn(
                        convictionBorderClass,
                        viewMode === 'grid'
                          ? "p-3.5 bg-white dark:bg-[#1A1926] border border-slate-200/90 dark:border-[#2D283E] rounded-xl shadow-2xs hover:shadow-xs hover:border-slate-300 dark:hover:border-[#38324E] transition-all flex flex-col justify-between gap-3 h-full"
                          : "p-3 hover:bg-slate-50/80 dark:hover:bg-[#222030]/60 transition-colors flex items-start justify-between gap-2.5",
                        selectedAnnouncement?.id === item.id && (viewMode === 'grid' ? "ring-2 ring-purple-500" : "bg-slate-100/70 dark:bg-[#252233]")
                      )}
                    >
                      <div className={cn(
                        "flex items-start gap-2.5 min-w-0",
                        viewMode === 'grid' ? "w-full" : "flex-1"
                      )}>
                        {/* Company Avatar */}
                        <div className={cn(
                          "w-7 h-7 rounded-md flex items-center justify-center font-bold text-[11px] shrink-0 border font-mono",
                          matchedStock?.priority === 'HIGH' ? "bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800" :
                          matchedStock?.priority === 'MEDIUM' ? "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800" :
                          "bg-slate-100 dark:bg-[#201E2E] text-slate-800 dark:text-slate-200 border-slate-200/80 dark:border-[#2D283E]"
                        )}>
                          {(item.companyName || 'BSE').substring(0, 2).toUpperCase()}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                              {item.companyName}
                            </span>

                            {matchedStock && (
                              <span className={cn(
                                "text-[9px] font-extrabold px-1.5 py-0.2 rounded border uppercase tracking-wider",
                                matchedStock.priority === 'HIGH' ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800" :
                                matchedStock.priority === 'MEDIUM' ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800" :
                                "bg-slate-100 dark:bg-[#201E2E] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-[#2D283E]"
                              )}>
                                {matchedStock.priority === 'HIGH' ? 'HIGH' : matchedStock.priority === 'MEDIUM' ? 'RADAR' : 'TRACKING'}
                              </span>
                            )}

                            {item.scrip_cd && (
                              <span className="text-[9px] font-mono px-1 py-0.2 bg-slate-100 dark:bg-[#201E2E] text-slate-500 dark:text-slate-400 rounded border border-slate-200 dark:border-[#2D283E]">
                                {item.scrip_cd}
                              </span>
                            )}

                            {singleClean.regulation && (
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-[#252233] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#352F48]">
                                {singleClean.regulation}
                              </span>
                            )}

                            {isResult && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded">
                                Results
                              </span>
                            )}
                            {isConcall && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded">
                                Concall
                              </span>
                            )}
                          </div>

                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                            {singleClean.headline}
                          </div>

                          <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 pt-0.5 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock size={11} />
                              {formatFilingRelativeTime(item.bseTime || item.fetched_at)}
                            </span>

                            {item.pdfLink && (
                              <a 
                                href={getSafePdfUrl(item.pdfLink, item.ATTACHMENTNAME || item.attachmentName, item.id, item.scrip_cd)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 bg-slate-100 hover:bg-rose-50 dark:bg-[#252233] dark:hover:bg-rose-950/40 border border-slate-200 dark:border-[#38324E] hover:border-rose-300 transition-all cursor-pointer shadow-2xs font-sans"
                                title="Open official BSE PDF"
                              >
                                <FileText size={10} className="text-rose-500 shrink-0" />
                                <span>Open PDF</span>
                                <ArrowUpRight size={9} className="opacity-60" />
                              </a>
                            )}

                            <div onClick={e => e.stopPropagation()}>
                              <ShareActionMenu
                                title={`${item.companyName} (${item.scrip_cd ? `BSE: ${item.scrip_cd}` : 'BSE'})`}
                                headline={singleClean.headline}
                                companyName={item.companyName}
                                scripCode={item.scrip_cd}
                                newsId={item.id || item.newsId}
                                category={item.category}
                                pdfUrl={item.pdfLink || item.ATTACHMENTNAME || item.attachmentName}
                                size="xs"
                              />
                            </div>

                            {item.aiSummary && (
                              <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-sans font-semibold">
                                <Sparkles size={11} className="text-amber-500" />
                                <span>AI Ready</span>
                              </span>
                            )}

                            {item.is_sent ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0 inline-block" title="Dispatched to Telegram" />
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </SwipeableFilingCard>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>

        {/* Pagination Bar */}
        {totalWatchlistPages > 1 && (
          <div className="flex items-center justify-between px-2 py-3 select-none">
            <div className="text-xs text-slate-500 font-mono">
              Page {currentPage} of {totalWatchlistPages} ({sortedWatchlistAnnouncements.length} Total)
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                type="button"
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3.5 py-2 bg-white dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] text-xs font-semibold rounded-xl disabled:opacity-40 cursor-pointer text-slate-700 dark:text-slate-300 min-h-[38px] flex items-center"
              >
                Previous
              </motion.button>
              <motion.button
                type="button"
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={() => setCurrentPage(p => Math.min(totalWatchlistPages, p + 1))}
                disabled={currentPage === totalWatchlistPages}
                className="px-3.5 py-2 bg-white dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] text-xs font-semibold rounded-xl disabled:opacity-40 cursor-pointer text-slate-700 dark:text-slate-300 min-h-[38px] flex items-center"
              >
                Next
              </motion.button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* DETAIL MODAL / SLIDE OVER */}
      {selectedAnnouncement && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-in fade-in duration-150 overscroll-contain"
          onClick={() => setSelectedAnnouncement(null)}
        >
          <div 
            className="bg-white dark:bg-[#1A1926] border border-slate-200 dark:border-[#2D283E] rounded-t-2xl sm:rounded-2xl max-w-2xl w-full max-h-[88vh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden overscroll-contain animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Native Mobile Drag Handle Bar */}
            <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mt-2.5 mb-0 shrink-0 sm:hidden" />

            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-[#2D283E] flex items-start justify-between gap-3 bg-slate-50/50 dark:bg-[#15141F]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {selectedAnnouncement.companyName}
                  </h3>
                  {selectedAnnouncement.scrip_cd && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-200/80 dark:bg-[#201E2E] text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-[#2D283E]">
                      {selectedAnnouncement.scrip_cd}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  BSE Filing Time: {formatFullDateTime(selectedAnnouncement.bseTime || selectedAnnouncement.fetched_at)}
                </div>
              </div>

              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5 overscroll-contain">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Subject</div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-relaxed bg-slate-50 dark:bg-[#15141F] p-3 rounded-lg border border-slate-100 dark:border-[#2D283E]">
                  {selectedAnnouncement.subject}
                </div>
              </div>

              {selectedAnnouncement.details && (
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Filing Details</div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto p-3 bg-slate-50 dark:bg-[#15141F] rounded-lg border border-slate-100 dark:border-[#2D283E]">
                    {selectedAnnouncement.details}
                  </div>
                </div>
              )}

              {/* AI Summary Breakdown */}
              <div className="p-4 bg-slate-50 dark:bg-[#15141F] border border-slate-200 dark:border-[#2D283E] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                    <Sparkles size={15} className="text-amber-500" />
                    <span>Gemini AI YoY & Financial Extraction</span>
                  </div>

                  {!selectedAnnouncement.aiSummary && (
                    <ActionButton
                      onClick={() => handleGenerateSummary(selectedAnnouncement.id)}
                      isLoading={isGeneratingSummary}
                      loadingText="Extracting..."
                      variant="primary"
                      size="sm"
                      icon={<Sparkles size={11} className="text-amber-400" />}
                    >
                      Generate AI Summary
                    </ActionButton>
                  )}
                </div>

                {selectedAnnouncement.aiSummary ? (
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {selectedAnnouncement.aiSummary}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    AI summary has not been generated for this disclosure yet. Click "Generate AI Summary" above to parse financial metrics.
                  </p>
                )}
              </div>

              {/* Telegram Status Notice */}
              {telegramStatus && (
                <div className="p-3 bg-slate-100 dark:bg-[#201E2E] border border-slate-200 dark:border-[#2D283E] text-slate-800 dark:text-slate-200 text-xs rounded-lg flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-500" />
                  <span>{telegramStatus}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-[#2D283E] bg-slate-50/50 dark:bg-[#15141F] flex items-center justify-between gap-3 select-none">
              {selectedAnnouncement.pdfLink ? (
                <motion.a
                  whileTap={buttonTap}
                  transition={springSnappy}
                  href={selectedAnnouncement.pdfLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-[#201E2E] hover:bg-slate-200 dark:hover:bg-[#2A263D] text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors border border-slate-200 dark:border-[#2D283E] min-h-[44px]"
                >
                  <ExternalLink size={15} />
                  <span>Download BSE PDF</span>
                </motion.a>
              ) : <div />}

              <div className="flex items-center gap-2">
                <ShareActionMenu
                  title={`${selectedAnnouncement.companyName} (${selectedAnnouncement.scrip_cd ? `BSE: ${selectedAnnouncement.scrip_cd}` : 'BSE'})`}
                  headline={selectedAnnouncement.subject}
                  companyName={selectedAnnouncement.companyName}
                  scripCode={selectedAnnouncement.scrip_cd}
                  newsId={selectedAnnouncement.id || selectedAnnouncement.newsId}
                  category={selectedAnnouncement.category}
                  pdfUrl={selectedAnnouncement.pdfLink || selectedAnnouncement.ATTACHMENTNAME || selectedAnnouncement.attachmentName}
                  size="md"
                />
                <ActionButton
                  onClick={() => handleManualSendTelegram(selectedAnnouncement)}
                  isLoading={isSendingTelegram}
                  loadingText="Sending..."
                  variant="primary"
                  size="md"
                  icon={<Send size={14} className="text-sky-400" />}
                >
                  Dispatch to Telegram
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Safety Confirmation Dialog Modal */}
      {confirmModalState?.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 overscroll-contain">
          <div className="bg-white dark:bg-[#1E1C2B] border border-slate-200 dark:border-[#38324E] rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                confirmModalState.actionType === 'reset_defaults' 
                  ? "bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400"
                  : "bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400"
              )}>
                {confirmModalState.actionType === 'reset_defaults' ? <RotateCcw size={20} /> : <AlertTriangle size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{confirmModalState.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{confirmModalState.description}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-[#2D283E] select-none">
              <motion.button
                type="button"
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={() => setConfirmModalState(null)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#2A263D] rounded-xl transition-colors cursor-pointer min-h-[44px] flex items-center"
              >
                Cancel
              </motion.button>
              <motion.button
                type="button"
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={async () => {
                  const state = confirmModalState;
                  setConfirmModalState(null);
                  if (state.actionType === 'clear_list' && state.listId) {
                    await customFetch(`/api/watchlists/${state.listId}/symbols`, { method: 'DELETE' });
                    fetchWatchlists();
                  } else if (state.actionType === 'clear_all') {
                    await customFetch(`/api/watchlists/all/symbols`, { method: 'DELETE' });
                    fetchWatchlists();
                  } else if (state.actionType === 'reset_defaults') {
                    await customFetch(`/api/watchlists/reset-default`, { method: 'POST' });
                    fetchWatchlists();
                  }
                }}
                className={cn(
                  "px-5 py-2.5 text-xs font-bold text-white rounded-xl transition-all cursor-pointer shadow-xs min-h-[44px] flex items-center",
                  confirmModalState.actionType === 'reset_defaults'
                    ? "bg-amber-600 hover:bg-amber-700 dark:bg-amber-600"
                    : "bg-rose-600 hover:bg-rose-700 dark:bg-rose-600"
                )}
              >
                {confirmModalState.actionType === 'reset_defaults' ? 'Confirm Reset' : 'Yes, Delete'}
              </motion.button>
            </div>
          </div>
        </div>
      )}

      {/* 3-4s Undo Action Toast */}
      {undoToast && (
        <div className="fixed bottom-20 md:bottom-8 right-4 left-4 sm:left-auto sm:right-8 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="bg-slate-900 dark:bg-[#1E1C2B] text-white border border-slate-700 dark:border-[#3E3854] px-4 py-2.5 rounded-xl shadow-2xl flex items-center justify-between gap-4 max-w-sm w-full">
            <span className="text-xs font-medium text-slate-200 truncate">
              {undoToast.message}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
                  await undoToast.onUndo();
                }}
                className="min-h-[44px] px-3 flex items-center justify-center text-xs font-extrabold text-amber-400 hover:text-amber-300 hover:bg-white/10 rounded-lg transition-colors cursor-pointer touch-manipulation"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={() => {
                  if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
                  setUndoToast(null);
                }}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
