import http from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

// Credentials are read only on the server; no client asset receives these values.
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const text = line.trim();
    const divider = text.indexOf('=');
    if (divider > 0 && !text.startsWith('#')) process.env[text.slice(0, divider).trim()] = text.slice(divider + 1).trim();
  }
}

const port = Number(process.env.PORT || 4173);
const root = process.cwd();
const aisKey = process.env.AISSTREAM_API_KEY;
const cartoKey = process.env.CARTO_API_KEY;
const domain = { south: 5, west: 45, north: 30, east: 105 };
const clients = new Set();
const vessels = new Map(); // This process stores only position reports received from AISStream.
const staticData = new Map();
const tracks = new Map(); // Actual report history received while the server is running.
const demoFleet = new Map(); // Clearly labelled presentation data for an offline/demo radar.
let aisSocket = null;

const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.pdf':'application/pdf', '.txt':'text/plain; charset=utf-8', '.md':'text/markdown; charset=utf-8' };
const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Methods':'GET, OPTIONS', 'Access-Control-Allow-Headers':'Content-Type' };
const finite = (value) => { const n = Number(value); return Number.isFinite(n) ? n : null; };
const inside = (lat, lon) => lat >= domain.south && lat <= domain.north && lon >= domain.west && lon <= domain.east;

function broadcast(event, payload) {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) { try { client.write(message); } catch { clients.delete(client); } }
}

function typeFromAis(code) {
  const value = Number(code);
  if (value === 30) return 'Fishing';
  if ([31, 32, 52].includes(value)) return 'Tug / Tow';
  if (value >= 35 && value <= 39) return 'Military / law enforcement';
  if (value >= 60 && value <= 69) return 'Passenger';
  if (value >= 70 && value <= 79) return 'Cargo';
  if (value >= 80 && value <= 89) return 'Tanker';
  return 'Unclassified AIS';
}

function createDemoFleet() {
  const fleet = new Map();
  const routes = [
    { start:[6.2, 96], end:[12.5, 48], heading:275 },
    { start:[25.5, 57], end:[7.5, 80], heading:125 },
    { start:[8.5, 78.5], end:[22, 88], heading:35 },
    { start:[20, 70], end:[9, 76], heading:155 }
  ];
  const categories = ['Cargo', 'Cargo', 'Tanker', 'Tanker', 'Fishing', 'Tug / Tow', 'Passenger'];
  for (let index = 0; index < 96; index += 1) {
    const route = routes[index % routes.length], progress = ((index * 37) % 97) / 100;
    const lat = route.start[0] + (route.end[0] - route.start[0]) * progress + (((index * 13) % 10) - 5) * 0.045;
    const lon = route.start[1] + (route.end[1] - route.start[1]) * progress + (((index * 7) % 10) - 5) * 0.07;
    const type = categories[index % categories.length];
    const number = String(index + 1).padStart(3, '0');
    fleet.set(`DEMO-${number}`, {
      mmsi:`DEMO-${number}`, name:`DEMO ${type.toUpperCase()} ${number}`, lat, lon,
      sog:type === 'Fishing' ? 6 + (index % 4) : 11 + (index % 8), cog:route.heading,
      type, source:'Demo scenario', isDemo:true, receivedAt:new Date().toISOString()
    });
  }
  return fleet;
}

function allVessels() { return [...vessels.values(), ...demoFleet.values()]; }

function moveDemoFleet() {
  for (const vessel of demoFleet.values()) {
    const radians = vessel.cog * Math.PI / 180, distance = vessel.sog * 0.514444 * 3;
    const nextLat = vessel.lat + distance * Math.cos(radians) / 111320;
    const nextLon = vessel.lon + distance * Math.sin(radians) / (111320 * Math.cos(vessel.lat * Math.PI / 180));
    if (!inside(nextLat, nextLon)) vessel.cog = (vessel.cog + 180) % 360;
    else { vessel.lat = Number(nextLat.toFixed(5)); vessel.lon = Number(nextLon.toFixed(5)); }
    vessel.receivedAt = new Date().toISOString();
    appendTrack(vessel);
    broadcast('vessel', vessel);
  }
}

function storeStatic(message) {
  const source = message?.Message?.ShipStaticData || message?.Message?.StaticDataReport;
  if (!source) return;
  const mmsi = String(source.UserID ?? source.userID ?? message?.MetaData?.MMSI ?? '');
  if (!mmsi) return;
  const old = staticData.get(mmsi) || {};
  const a = finite(source.Dimension?.A), b = finite(source.Dimension?.B), c = finite(source.Dimension?.C), d = finite(source.Dimension?.D);
  staticData.set(mmsi, {
    ...old,
    name: source.Name?.trim() || source.ShipName?.trim() || old.name,
    callsign: source.CallSign?.trim() || source.Callsign?.trim() || old.callsign,
    destination: source.Destination?.trim() || old.destination,
    imo: source.ImoNumber || source.IMO || old.imo,
    draught: finite(source.MaximumStaticDraught ?? source.Draught) ?? old.draught,
    length: a !== null && b !== null ? a + b : old.length,
    width: c !== null && d !== null ? c + d : old.width,
    type: typeFromAis(source.TypeOfShipAndCargoType ?? source.ShipType ?? old.shipType),
    shipType: source.TypeOfShipAndCargoType ?? source.ShipType ?? old.shipType
  });
}

function positionFrom(message) {
  const report = message?.Message?.PositionReport || message?.Message?.StandardClassBPositionReport || message?.Message?.ExtendedClassBPositionReport;
  const meta = message?.MetaData;
  if (!report || !meta) return null;
  const lat = finite(meta.Latitude ?? meta.latitude ?? report.Latitude ?? report.latitude);
  const lon = finite(meta.Longitude ?? meta.longitude ?? report.Longitude ?? report.longitude);
  if (lat === null || lon === null || !inside(lat, lon)) return null;
  const mmsi = String(meta.MMSI ?? report.UserID ?? report.userID ?? '');
  if (!mmsi) return null;
  const details = staticData.get(mmsi) || {};
  return {
    mmsi, lat, lon,
    name: meta.ShipName?.trim() || details.name || `MMSI ${mmsi}`,
    sog: finite(report.Sog ?? report.sog) ?? 0,
    cog: finite(report.Cog ?? report.cog ?? report.TrueHeading ?? report.trueHeading) ?? 0,
    type: details.type || 'Unclassified AIS', callsign: details.callsign || null,
    imo: details.imo || null, draught: details.draught ?? null, length: details.length ?? null, width: details.width ?? null,
    destination: details.destination || null, receivedAt: new Date().toISOString(), source: 'AISStream'
  };
}

function appendTrack(vessel) {
  const history = tracks.get(vessel.mmsi) || [];
  const last = history.at(-1);
  if (!last || last.lat !== vessel.lat || last.lon !== vessel.lon) history.push({ lat:vessel.lat, lon:vessel.lon, receivedAt:vessel.receivedAt });
  tracks.set(vessel.mmsi, history.slice(-120));
}

function startAis() {
  if (!aisKey || aisSocket) return;
  aisSocket = new WebSocket('wss://stream.aisstream.io/v0/stream');
  aisSocket.addEventListener('open', () => {
    aisSocket.send(JSON.stringify({ APIKey:aisKey, BoundingBoxes: [[[domain.south, domain.west], [domain.north, domain.east]]], FilterMessageTypes:['PositionReport', 'StandardClassBPositionReport', 'ExtendedClassBPositionReport', 'ShipStaticData'] }));
    broadcast('ais-status', { connected:true, configured:true, source:'AISStream', message:'Authenticated AIS stream connected' });
  });
  aisSocket.addEventListener('message', async ({ data }) => {
    try {
      const raw = typeof data === 'string' ? data : (data.text ? await data.text() : String(data));
      const message = JSON.parse(raw); storeStatic(message);
      const vessel = positionFrom(message); if (!vessel) return;
      vessels.set(vessel.mmsi, vessel); appendTrack(vessel); broadcast('vessel', vessel);
    } catch { /* Ignore malformed messages without ending a valid stream. */ }
  });
  aisSocket.addEventListener('close', () => { aisSocket = null; broadcast('ais-status', { connected:false, configured:true, source:'AISStream', message:'AIS stream reconnecting' }); setTimeout(startAis, 5000); });
  aisSocket.addEventListener('error', () => { /* close announces any reconnect state */ });
}

function filteredVessels(url) {
  const type = url.searchParams.get('type')?.toLowerCase(), query = url.searchParams.get('q')?.toLowerCase().trim();
  const limit = Math.min(Number(url.searchParams.get('limit')) || 500, 1000);
  return allVessels().filter(v => (!type || type === 'all' || v.type.toLowerCase().includes(type)) && (!query || v.name.toLowerCase().includes(query) || v.mmsi.includes(query) || (v.destination || '').toLowerCase().includes(query))).slice(0, limit);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
  if (url.pathname === '/api/status') { res.writeHead(200, { 'content-type':'application/json', 'cache-control':'no-store', ...cors }); res.end(JSON.stringify({ aisConfigured:Boolean(aisKey), connected:Boolean(aisSocket && aisSocket.readyState === 1), vessels:allVessels().length, liveVessels:vessels.size, demoVessels:demoFleet.size, domain:'5°N–30°N, 45°E–105°E', source:'AISStream live reports + labelled demo fleet' })); return; }
  if (url.pathname === '/api/vessels') { res.writeHead(200, { 'content-type':'application/json', 'cache-control':'no-store', ...cors }); res.end(JSON.stringify(filteredVessels(url))); return; }
  if (url.pathname === '/api/vessels/history') { res.writeHead(200, { 'content-type':'application/json', 'cache-control':'no-store', ...cors }); res.end(JSON.stringify(tracks.get(url.searchParams.get('mmsi')) || [])); return; }
  if (url.pathname === '/api/ais/stream') { res.writeHead(200, { 'content-type':'text/event-stream', 'cache-control':'no-cache', connection:'keep-alive', ...cors }); res.write(`event: ais-status\ndata: ${JSON.stringify({ connected:Boolean(aisSocket && aisSocket.readyState === 1), configured:Boolean(aisKey), source:'AISStream live + demo fleet', liveVessels:vessels.size, demoVessels:demoFleet.size })}\n\n`); res.write(`event: vessels\ndata: ${JSON.stringify(allVessels())}\n\n`); clients.add(res); req.on('close', () => clients.delete(res)); startAis(); return; }
  const tile = url.pathname.match(/^\/tiles\/carto\/(\d+)\/(\d+)\/(\d+)\.png$/);
  if (tile) { const [,z,x,y] = tile; const upstreamUrl = cartoKey ? `https://a.basemaps.cartocdn.com/light_all/${z}/${x}/${y}.png?key=${encodeURIComponent(cartoKey)}` : `https://tile.openstreetmap.org/${z}/${x}/${y}.png`; try { const upstream = await fetch(upstreamUrl, { headers:{'User-Agent':'OceanEmbed-PG/SIH26066'} }); const body = Buffer.from(await upstream.arrayBuffer()); res.writeHead(upstream.ok ? 200 : upstream.status, { 'content-type':upstream.headers.get('content-type') || 'image/png', 'cache-control':'public, max-age=86400', ...cors }); res.end(body); } catch { res.writeHead(502).end('Basemap unavailable'); } return; }
  const requested = url.pathname === '/' ? '/index.html' : url.pathname, file = normalize(join(root, requested));
  if (!file.startsWith(root)) { res.writeHead(403).end('Forbidden'); return; }
  try { const body = await readFile(file); res.writeHead(200, { 'content-type':types[extname(file)] || 'application/octet-stream', ...cors }); res.end(body); } catch { res.writeHead(404).end('Not found'); }
});

demoFleet.clear();
for (const [id, vessel] of createDemoFleet()) { demoFleet.set(id, vessel); appendTrack(vessel); }
setInterval(moveDemoFleet, 3000);
server.listen(port, () => console.log(`OceanEmbed-PG at http://localhost:${port} · ${aisKey ? 'AISStream ready' : 'AIS key missing'} · ${demoFleet.size} labelled demo vessels`));
// if (aisKey) startAis();
