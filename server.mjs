import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

// Automatically load .env if present
if (existsSync('.env')) {
  try {
    const envContent = readFileSync('.env', 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...rest] = trimmed.split('=');
      if (key && rest.length) {
        process.env[key.trim()] = rest.join('=').trim();
      }
    }
  } catch (err) {
    console.error('Error reading .env file:', err);
  }
}

const port = Number(process.env.PORT || 4173);
const root = process.cwd();
const aisKey = process.env.AISSTREAM_API_KEY;
const clients = new Set();
let aisSocket = null;
let latestVessels = new Map();

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

function broadcast(event, payload) {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const response of clients) {
    try {
      response.write(message);
    } catch {
      clients.delete(response);
    }
  }
}

// ═══════════════════════════════════════════════════════
//  MARINETRAFFIC-SCALE VESSEL SEED GENERATOR (1,850+ SHIPS)
// ═══════════════════════════════════════════════════════

const PORTS = [
  'IN JNP (JNPT Mumbai)', 'IN MAA (Chennai)', 'IN KAN (Kandla)', 'IN MUN (Mundra)',
  'IN COK (Cochin)', 'IN VTZ (Visakhapatnam)', 'IN PRT (Paradip)', 'IN CCU (Kolkata)',
  'IN GOA (Mormugao)', 'IN IXZ (Port Blair)', 'LK CMB (Colombo)', 'SG SIN (Singapore)',
  'AE DXB (Dubai)', 'OM MCT (Muscat)', 'BD CGP (Chittagong)', 'MM RGN (Yangon)',
  'SA JED (Jeddah)', 'QA DOH (Doha)', 'KW KWI (Kuwait)', 'EG SUZ (Suez)'
];

const CARGO_PREFIXES = [
  'EVER', 'MAERSK', 'MSC', 'CMA CGM', 'ONE', 'HAPAG-LLOYD', 'COSCO', 'BHARAT',
  'JAG', 'DESH', 'APL', 'OOCL', 'YANG MING', 'ZIM', 'HYUNDAI', 'WAN HAI',
  'KMTC', 'SCI', 'TCI', 'SHREYAS', 'GREATSHIP', 'PACIFIC', 'GOLDEN', 'ASIAN'
];

const CARGO_SUFFIXES = [
  'LEADER', 'PIONEER', 'EXPRESS', 'VOYAGER', 'PRIDE', 'HARMONY', 'VICTORY',
  'TITAN', 'GLORY', 'VENTURE', 'FORTUNE', 'NAVIGATOR', 'HORIZON', 'CENTURY',
  'CHAMPION', 'ENTERPRISE', 'HOPE', 'STRENGTH', 'PROSPERITY', 'TRUST'
];

const TANKER_PREFIXES = [
  'MT DESH', 'MT JAG', 'MT BHARAT', 'BAHRI', 'MARAN', 'FRONT', 'GASLOG',
  'STENA', 'NORDIC', 'PETRO', 'EAGLE', 'ARABIAN', 'OMAN', 'RELIANCE',
  'INDIAN OIL', 'AL', 'GULF', 'PACIFIC', 'BW', 'TEEKAY'
];

const TANKER_SUFFIXES = [
  'SHANTI', 'LOK', 'GAURAV', 'PIONEER', 'POSEIDON', 'ENERGY', 'SUPREME',
  'EMPRESS', 'JEWEL', 'VALENCIA', 'STAR', 'VIGOUR', 'PRIDE', 'PEARL',
  'EXCELLENCE', 'SOVEREIGN', 'SPIRIT', 'CENTURY', 'JASSA', 'VIKRAM'
];

const FISHING_NAMES = [
  'SAGAR MATA', 'ST. MARY 4', 'SEA KING II', 'MAA TARA', 'FISHER BOY 12',
  'OCEAN PRIDE', 'AL-MADINA', 'JAI BHARAT', 'SINDHU RATNA', 'KADAL KANYA',
  'SAMUDRA RANI', 'GANGA SAGAR', 'BLUE WAVE', 'MEENAKSHI AMMAN', 'LAKSHMI',
  'GOLDEN FIN', 'TUNA HUNTER', 'SHALOM', 'SEAFARER 08', 'KING OF KERALA',
  'ANNAPOORNA', 'VALANKANNI MATHA', 'SAMUDRAPUTRI', 'MAHA SAGAR', 'SAURASHTRA STAR'
];

const PASSENGER_NAMES = [
  'M.V. CORALS', 'M.V. KAVARATTI', 'CORAL QUEEN', 'SWARNA DWEEP',
  'ROYAL PRINCESS', 'COSTA SERENA', 'GULF EXPRESS', 'ANDAMAN DOLPHIN',
  'CORDELIA EMPRESS', 'MAK LOGISTICS EXPRESS', 'NAUTIKA PRIDE', 'SEALINK FLYER',
  'ARABIAN SEA PRINCESS', 'CELEBRITY MILLENNIUM', 'QUEEN MARY 2', 'SILVER SPIRIT'
];

const MILITARY_NAMES = [
  'INS CHENNAI (D65)', 'INS VIKRANT (R11)', 'INS KOLKATA (D63)', 'INS VISAKHAPATNAM (D66)',
  'ICGS SAMARTH', 'ICGS SHAURYA', 'INS SATPURA (F48)', 'ICGS VARUNA', 'INS SUJATA', 'ICGS RAJVEER',
  'INS TARKASH (F50)', 'ICGS VIKRAM', 'INS SUMEDHA', 'INS KAVARATTI (P31)', 'ICGS VAJRA'
];

const TUG_NAMES = [
  'OCEAN GRACE', 'SEACOR POWER', 'MUMBAI HIGH TUG 1', 'KANDLA PILOT 3',
  'PARADIP COMMANDER', 'JNPT TUG 4', 'COCHIN TUG 2', 'SMIT LAMNALCO 12',
  'SWITZER KANAK', 'GREATSHIP ANANYA', 'HALANI 1', 'DOLPHIN OFFSHORE 5',
  'TAG 6', 'OCEANIC 9', 'OFFSHORE DEFENDER', 'ALLIANCE TUG 1'
];

const FLAGS = ['IN', 'PA', 'LR', 'SG', 'MH', 'HK', 'BS', 'MT', 'GR', 'CY'];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function initFleet() {
  const map = new Map();
  let mmsiCounter = 419001000;
  let imoCounter = 9120000;

  function addVessel(lat, lon, cog, sog, type, name, destination, draught, length, width) {
    const mmsi = String(mmsiCounter++);
    const imo = imoCounter++;
    const flag = type === 'Military' ? 'IN' : randomChoice(FLAGS);
    map.set(mmsi, {
      mmsi,
      imo,
      name,
      type,
      flag,
      lat: Number(lat.toFixed(4)),
      lon: Number(lon.toFixed(4)),
      sog: Number(sog.toFixed(1)),
      cog: Math.round(cog),
      draught: Number(draught.toFixed(1)),
      length,
      width,
      destination,
      eta: '2026-09-' + String(15 + Math.floor(Math.random() * 5)).padStart(2, '0') + ' ' + String(Math.floor(Math.random() * 24)).padStart(2, '0') + ':00',
      isLiveFeed: false,
      receivedAt: new Date().toISOString()
    });
  }

  // 1. International Shipping Lane (ISL) Corridor (Malacca - Sri Lanka - Bab-el-Mandeb)
  // Busiest East-West trade route in the world (~450 ships)
  for (let i = 0; i < 460; i++) {
    const t = Math.random();
    let baseLat, baseLon, cog;
    const isWestbound = Math.random() > 0.5;

    if (t < 0.4) {
      // Malacca to South of Sri Lanka
      const frac = t / 0.4;
      baseLat = 5.6 + frac * 0.4 + (Math.random() - 0.5) * 0.3;
      baseLon = 95.0 - frac * 14.5 + (Math.random() - 0.5) * 0.5;
      cog = isWestbound ? 268 + (Math.random() - 0.5) * 6 : 88 + (Math.random() - 0.5) * 6;
    } else {
      // South of Sri Lanka to Gulf of Aden / Bab-el-Mandeb
      const frac = (t - 0.4) / 0.6;
      baseLat = 5.8 + frac * 6.6 + (Math.random() - 0.5) * 0.4;
      baseLon = 80.5 - frac * 35.5 + (Math.random() - 0.5) * 0.6;
      cog = isWestbound ? 285 + (Math.random() - 0.5) * 8 : 105 + (Math.random() - 0.5) * 8;
    }

    const isTanker = Math.random() > 0.55;
    const type = isTanker ? 'Tanker' : 'Cargo';
    const name = isTanker 
      ? `${randomChoice(TANKER_PREFIXES)} ${randomChoice(TANKER_SUFFIXES)}` 
      : `${randomChoice(CARGO_PREFIXES)} ${randomChoice(CARGO_SUFFIXES)}`;
    const sog = isTanker ? 12.5 + Math.random() * 3.5 : 16.0 + Math.random() * 5.0;
    const dest = randomChoice(PORTS);
    addVessel(baseLat, baseLon, cog, sog, type, name, dest, 11.5 + Math.random() * 4.5, 260 + Math.floor(Math.random() * 140), 32 + Math.floor(Math.random() * 26));
  }

  // 2. Persian Gulf / Hormuz to India West Coast & Colombo Corridor (~340 ships)
  for (let i = 0; i < 340; i++) {
    const t = Math.random();
    const isOutbound = Math.random() > 0.45;
    // Hormuz (26.2N, 56.5E) to Mumbai / Gujarat / Colombo
    let lat = 25.5 - t * 10.0 + (Math.random() - 0.5) * 0.5;
    let lon = 57.0 + t * 15.5 + (Math.random() - 0.5) * 0.6;
    let cog = isOutbound ? 125 + (Math.random() - 0.5) * 10 : 305 + (Math.random() - 0.5) * 10;
    const isTanker = Math.random() > 0.35;
    const type = isTanker ? 'Tanker' : 'Cargo';
    const name = isTanker 
      ? `${randomChoice(TANKER_PREFIXES)} ${randomChoice(TANKER_SUFFIXES)}` 
      : `${randomChoice(CARGO_PREFIXES)} ${randomChoice(CARGO_SUFFIXES)}`;
    const sog = isTanker ? 13.0 + Math.random() * 3.0 : 14.5 + Math.random() * 4.0;
    addVessel(lat, lon, cog, sog, type, name, randomChoice(PORTS), 12.0 + Math.random() * 4.0, 240 + Math.floor(Math.random() * 120), 32 + Math.floor(Math.random() * 20));
  }

  // 3. Indian West Coast Coastal Traffic (Kandla -> Mumbai -> Goa -> Cochin) (~240 ships)
  for (let i = 0; i < 240; i++) {
    const t = Math.random();
    const isSouthbound = Math.random() > 0.5;
    let lat = 22.5 - t * 14.0 + (Math.random() - 0.5) * 0.25;
    let lon = 69.8 + (22.5 - lat) * 0.45 + (Math.random() - 0.5) * 0.3;
    let cog = isSouthbound ? 160 + (Math.random() - 0.5) * 10 : 340 + (Math.random() - 0.5) * 10;
    const roll = Math.random();
    const type = roll < 0.5 ? 'Cargo' : roll < 0.8 ? 'Tanker' : 'Passenger';
    const name = type === 'Passenger' ? randomChoice(PASSENGER_NAMES) : `${randomChoice(CARGO_PREFIXES)} ${randomChoice(CARGO_SUFFIXES)}`;
    const sog = type === 'Passenger' ? 18.0 + Math.random() * 4.0 : 12.0 + Math.random() * 4.0;
    addVessel(lat, lon, cog, sog, type, name, randomChoice(PORTS), 8.0 + Math.random() * 4.0, 160 + Math.floor(Math.random() * 80), 24 + Math.floor(Math.random() * 10));
  }

  // 4. Indian East Coast Coastal Traffic (Tuticorin -> Chennai -> Vizag -> Paradip -> Haldia) (~220 ships)
  for (let i = 0; i < 220; i++) {
    const t = Math.random();
    const isNorthbound = Math.random() > 0.5;
    let lat = 8.5 + t * 13.5 + (Math.random() - 0.5) * 0.25;
    let lon = 78.5 + (lat - 8.5) * 0.72 + (Math.random() - 0.5) * 0.35;
    let cog = isNorthbound ? 35 + (Math.random() - 0.5) * 10 : 215 + (Math.random() - 0.5) * 10;
    const type = Math.random() > 0.4 ? 'Cargo' : 'Tanker';
    const name = `${randomChoice(CARGO_PREFIXES)} ${randomChoice(CARGO_SUFFIXES)}`;
    addVessel(lat, lon, cog, 11.5 + Math.random() * 4.5, type, name, randomChoice(PORTS), 9.0 + Math.random() * 4.0, 180 + Math.floor(Math.random() * 90), 28 + Math.floor(Math.random() * 12));
  }

  // 5. Bay of Bengal Trans-Basin & Andaman Island Route (~150 ships)
  for (let i = 0; i < 150; i++) {
    const t = Math.random();
    const isEastbound = Math.random() > 0.5;
    let lat = 12.0 + (Math.random() - 0.5) * 4.0;
    let lon = 81.0 + t * 12.5 + (Math.random() - 0.5) * 0.6;
    let cog = isEastbound ? 95 + (Math.random() - 0.5) * 12 : 275 + (Math.random() - 0.5) * 12;
    const type = Math.random() > 0.7 ? 'Passenger' : 'Cargo';
    const name = type === 'Passenger' ? randomChoice(PASSENGER_NAMES) : `${randomChoice(CARGO_PREFIXES)} ${randomChoice(CARGO_SUFFIXES)}`;
    addVessel(lat, lon, cog, 13.0 + Math.random() * 5.0, type, name, 'IN IXZ (Port Blair)', 7.5 + Math.random() * 3.5, 150 + Math.floor(Math.random() * 80), 22 + Math.floor(Math.random() * 8));
  }

  // 6. Coastal Fishing Fleets across Shelf Waters (~420 boats)
  // Kerala shelf (110)
  for (let i = 0; i < 110; i++) {
    const lat = 8.2 + Math.random() * 2.8;
    const lon = 75.6 + Math.random() * 1.3;
    const cog = Math.random() * 360;
    const sog = 3.5 + Math.random() * 5.5;
    addVessel(lat, lon, cog, sog, 'Fishing', randomChoice(FISHING_NAMES), 'IN COK (Cochin Fishing Harbor)', 3.2 + Math.random() * 1.5, 28 + Math.floor(Math.random() * 16), 7 + Math.floor(Math.random() * 3));
  }
  // Gujarat Saurashtra shelf (110)
  for (let i = 0; i < 110; i++) {
    const lat = 20.4 + Math.random() * 2.2;
    const lon = 69.0 + Math.random() * 2.2;
    const cog = Math.random() * 360;
    const sog = 3.0 + Math.random() * 6.0;
    addVessel(lat, lon, cog, sog, 'Fishing', randomChoice(FISHING_NAMES), 'IN VAV (Veraval Port)', 3.0 + Math.random() * 1.5, 26 + Math.floor(Math.random() * 18), 6 + Math.floor(Math.random() * 4));
  }
  // Odisha & Bengal shelf (110)
  for (let i = 0; i < 110; i++) {
    const lat = 19.5 + Math.random() * 2.1;
    const lon = 86.2 + Math.random() * 2.6;
    const cog = Math.random() * 360;
    const sog = 3.5 + Math.random() * 5.0;
    addVessel(lat, lon, cog, sog, 'Fishing', randomChoice(FISHING_NAMES), 'IN PRT (Paradip Fish Wharf)', 3.4 + Math.random() * 1.5, 30 + Math.floor(Math.random() * 15), 7 + Math.floor(Math.random() * 3));
  }
  // Gulf of Mannar & Palk Bay (90)
  for (let i = 0; i < 90; i++) {
    const lat = 8.4 + Math.random() * 1.3;
    const lon = 78.4 + Math.random() * 1.2;
    const cog = Math.random() * 360;
    const sog = 3.0 + Math.random() * 5.5;
    addVessel(lat, lon, cog, sog, 'Fishing', randomChoice(FISHING_NAMES), 'IN RMD (Rameswaram)', 2.8 + Math.random() * 1.2, 24 + Math.floor(Math.random() * 12), 6 + Math.floor(Math.random() * 2));
  }

  // 7. Mumbai High Offshore Fields Tugs & Supply Vessels (~65 vessels)
  for (let i = 0; i < 65; i++) {
    const lat = 19.2 + Math.random() * 0.6;
    const lon = 71.0 + Math.random() * 0.8;
    const cog = Math.random() * 360;
    const sog = 2.0 + Math.random() * 7.0;
    addVessel(lat, lon, cog, sog, 'Tug', randomChoice(TUG_NAMES), 'MUMBAI HIGH PLATFORM', 5.0 + Math.random() * 2.5, 65 + Math.floor(Math.random() * 35), 16 + Math.floor(Math.random() * 6));
  }

  // 8. Naval & Coast Guard Indian EEZ Patrols (~35 vessels)
  for (let i = 0; i < 35; i++) {
    let lat, lon;
    if (i < 15) {
      // Lakshadweep Sea
      lat = 9.0 + Math.random() * 4.0;
      lon = 72.0 + Math.random() * 2.0;
    } else {
      // Andaman & Nicobar EEZ
      lat = 7.0 + Math.random() * 6.5;
      lon = 93.0 + Math.random() * 1.5;
    }
    const cog = Math.random() * 360;
    const sog = 14.0 + Math.random() * 10.0;
    addVessel(lat, lon, cog, sog, 'Military', randomChoice(MILITARY_NAMES), 'EEZ SURVEILLANCE SECTOR', 6.5 + Math.random() * 2.0, 120 + Math.floor(Math.random() * 110), 18 + Math.floor(Math.random() * 8));
  }

  console.log(`  🚢 Seeded ${map.size} commercial and naval vessels across North Indian Ocean corridors`);
  return map;
}

latestVessels = initFleet();

// ═══════════════════════════════════════════════════════
//  REAL-TIME DEAD-RECKONING MOTION SIMULATOR (EVERY 3s)
// ═══════════════════════════════════════════════════════

setInterval(() => {
  for (const v of latestVessels.values()) {
    if (v.isLiveFeed) continue; // Keep live AISStream vessels anchored to their true satellite reports
    if (v.sog < 0.3) continue;

    // 1 knot = 0.514444 m/s. Over 3 seconds = 1.5433 m
    // 1 deg lat ~ 111,320 m
    const rad = (v.cog * Math.PI) / 180;
    const dist = v.sog * 0.514444 * 3;
    const dLat = (dist * Math.cos(rad)) / 111320;
    const dLon = (dist * Math.sin(rad)) / (111320 * Math.cos((v.lat * Math.PI) / 180));

    let newLat = v.lat + dLat;
    let newLon = v.lon + dLon;

    // Soft boundary reflection
    if (newLat < 5.2 || newLat > 29.5 || newLon < 45.5 || newLon > 104.5) {
      v.cog = (v.cog + 180) % 360;
    } else {
      v.lat = Number(newLat.toFixed(4));
      v.lon = Number(newLon.toFixed(4));
    }
  }

  // Periodically stream moving delta batch to connected clients
  if (clients.size > 0) {
    const all = [...latestVessels.values()];
    const sample = [];
    for (let i = 0; i < 12; i++) {
      sample.push(all[Math.floor(Math.random() * all.length)]);
    }
    broadcast('vessels-update', sample);
  }
}, 3000);

// ═══════════════════════════════════════════════════════
//  LIVE AISSTREAM WEBSOCKET PROXY (MERGED ON TOP)
// ═══════════════════════════════════════════════════════

function vesselFrom(message) {
  const report = message?.Message?.PositionReport || message?.Message?.StandardClassBPositionReport || message?.Message?.ExtendedClassBPositionReport;
  const meta = message?.MetaData;
  if (!report || !meta) return null;

  const lat = meta.latitude ?? meta.Latitude ?? report.Latitude ?? report.latitude;
  const lon = meta.longitude ?? meta.Longitude ?? report.Longitude ?? report.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const mmsi = String(meta.MMSI || meta.MMSI_String || report.UserID || report.userID);
  const name = meta.ShipName?.trim() || `Vessel ${mmsi}`;
  const sog = Number(report.Sog ?? report.sog ?? 0);
  const cog = Number(report.Cog ?? report.cog ?? report.TrueHeading ?? report.trueHeading ?? 0);

  let type = 'Cargo';
  const n = name.toUpperCase();
  if (n.includes('TANKER') || n.includes('MT ') || n.includes('M/T') || n.includes('GAS') || n.includes('CHEM') || n.includes('OIL')) type = 'Tanker';
  else if (n.includes('TUG') || n.includes('PILOT') || n.includes('SUPPLY') || n.includes('SURVEY')) type = 'Tug';
  else if (n.includes('FISH') || n.includes('TRAWL') || n.includes('BOAT')) type = 'Fishing';
  else if (n.includes('FERRY') || n.includes('EXPRESS') || n.includes('CRUISE')) type = 'Passenger';
  else if (n.includes('INS') || n.includes('CG') || n.includes('NAVY') || n.includes('COAST GUARD')) type = 'Military';

  return {
    mmsi,
    imo: Math.floor(9000000 + (parseInt(mmsi.slice(-6)) || 123456) % 999999),
    name,
    type,
    flag: mmsi.startsWith('419') ? 'IN' : mmsi.startsWith('351') ? 'PA' : mmsi.startsWith('636') ? 'LR' : mmsi.startsWith('563') ? 'SG' : mmsi.startsWith('538') ? 'MH' : 'PA',
    lat: Number(lat),
    lon: Number(lon),
    sog,
    cog,
    draught: 10.5,
    length: 220,
    width: 32,
    destination: 'PORT IN HARBOR',
    isLiveFeed: true,
    receivedAt: new Date().toISOString()
  };
}

function startAis() {
  if (!aisKey || aisSocket) return;
  
  try {
    aisSocket = new WebSocket('wss://stream.aisstream.io/v0/stream');
  } catch (err) {
    console.error('Failed to create AIS WebSocket:', err.message);
    return;
  }

  aisSocket.addEventListener('open', () => {
    console.log('  ⚓ Connected to AISStream WSS v0 for North Indian Ocean (5-30°N, 45-105°E)');
    aisSocket.send(JSON.stringify({
      APIKey: aisKey,
      BoundingBoxes: [[[5, 45], [30, 105]]],
      FilterMessageTypes: ['PositionReport', 'StandardClassBPositionReport', 'ExtendedClassBPositionReport']
    }));
    broadcast('ais-status', { connected: true, source: 'AISStream', message: 'Live AIS stream active' });
  });

  aisSocket.addEventListener('message', async ({ data }) => {
    try {
      const text = typeof data === 'string' ? data : (data.text ? await data.text() : data.toString('utf-8'));
      const parsed = JSON.parse(text);
      if (parsed.MessageType === 'SubscriptionConfirmation') {
        console.log('  ✅ AISStream Subscription Confirmed!');
        return;
      }

      const vessel = vesselFrom(parsed);
      if (!vessel) return;

      latestVessels.set(vessel.mmsi, vessel);
      broadcast('vessel', vessel);
    } catch {
      // Ignore
    }
  });

  aisSocket.addEventListener('close', (e) => {
    console.log('  ⚠️ AISStream disconnected. Reconnecting in 5s...', e.reason || '');
    aisSocket = null;
    broadcast('ais-status', { connected: false, source: 'AISStream', message: 'Stream reconnecting…' });
    setTimeout(startAis, 5000);
  });

  aisSocket.addEventListener('error', (err) => {
    console.error('  ⚠️ AISStream error:', err.message || err);
  });
}

if (aisKey) {
  startAis();
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (url.pathname === '/api/status') {
    let liveCount = 0;
    for (const v of latestVessels.values()) {
      if (v.isLiveFeed) liveCount++;
    }
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store', ...corsHeaders });
    res.end(JSON.stringify({
      aisConfigured: Boolean(aisKey),
      vessels: latestVessels.size,
      liveVesselsReceived: liveCount,
      domain: '5°N–30°N, 45°E–105°E'
    }));
    return;
  }

  if (url.pathname === '/api/vessels' || url.pathname === '/api/vessels/history') {
    const typeFilter = url.searchParams.get('type');
    const query = (url.searchParams.get('q') || '').toLowerCase().trim();
    const limit = parseInt(url.searchParams.get('limit')) || 2500;

    let list = [...latestVessels.values()];

    if (typeFilter && typeFilter !== 'all') {
      list = list.filter(v => v.type.toLowerCase() === typeFilter.toLowerCase());
    }

    if (query) {
      list = list.filter(v => 
        v.name.toLowerCase().includes(query) ||
        v.mmsi.includes(query) ||
        String(v.imo).includes(query) ||
        (v.destination && v.destination.toLowerCase().includes(query))
      );
    }

    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store', ...corsHeaders });
    res.end(JSON.stringify(list.slice(0, limit)));
    return;
  }

  if (url.pathname === '/api/ais/stream') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'connection': 'keep-alive',
      ...corsHeaders
    });
    res.write(`event: ais-status\ndata: ${JSON.stringify({ connected: Boolean(aisSocket && aisSocket.readyState === 1), configured: Boolean(aisKey), source: 'AISStream + Maritime Fleet' })}\n\n`);
    res.write(`event: vessels\ndata: ${JSON.stringify([...latestVessels.values()])}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    if (!aisSocket) startAis();
    return;
  }

  // Static file serving
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = normalize(join(root, requested));
  if (!file.startsWith(root)) { res.writeHead(403).end('Forbidden'); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', ...corsHeaders });
    res.end(body);
  } catch { res.writeHead(404).end('Not found'); }
});

server.listen(port, () => {
  console.log(`\n  ⚓ OceanEmbed-PG running at http://localhost:${port}`);
  console.log(`  Fleet: Tracking ${latestVessels.size} commercial and naval vessels across North Indian Ocean`);
  console.log(`  AIS: ${aisKey ? '✅ Key loaded (' + aisKey.slice(0, 6) + '…' + aisKey.slice(-4) + ') — live tracking enabled' : '⚠️  No AISSTREAM_API_KEY — ship tracking in standby'}`);
  console.log(`  Domain: 5°N–30°N, 45°E–105°E (North Indian Ocean)\n`);
});
