const fs = require('fs');

// Global fleet count: 60,000 realistic vessels
const TOTAL_VESSELS = 60000;

// Load land boundaries GeoJSON for mathematical guarantee that NO ship is on land
const geojson = JSON.parse(fs.readFileSync('tmp/countries.geojson', 'utf8'));

// Pre-calculate polygon bounding boxes for lightning-fast ray-casting
const polygons = [];
for (const feature of geojson.features) {
  const geom = feature.geometry;
  if (geom.type === 'Polygon') {
    for (const ring of geom.coordinates) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of ring) {
        if (p[0] < minX) minX = p[0];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[1] > maxY) maxY = p[1];
      }
      polygons.push({ bbox: [minX, minY, maxX, maxY], ring });
    }
  } else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) {
      for (const ring of poly) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of ring) {
          if (p[0] < minX) minX = p[0];
          if (p[0] > maxX) maxX = p[0];
          if (p[1] < minY) minY = p[1];
          if (p[1] > maxY) maxY = p[1];
        }
        polygons.push({ bbox: [minX, minY, maxX, maxY], ring });
      }
    }
  }
}

function pointInPoly(pt, poly) {
  let inside = false;
  const x = pt[0], y = pt[1];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function isLand(lat, lon) {
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  for (const p of polygons) {
    if (lon < p.bbox[0] || lon > p.bbox[2] || lat < p.bbox[1] || lat > p.bbox[3]) continue;
    if (pointInPoly([lon, lat], p.ring)) return true;
  }
  return false;
}

// Spherical bearing helper
function calculateBearing(lat1, lon1, lat2, lon2) {
  let dLon = (lon2 - lon1) * Math.PI / 180;
  const l1 = lat1 * Math.PI / 180;
  const l2 = lat2 * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(l2);
  const x = Math.cos(l1) * Math.sin(l2) - Math.sin(l1) * Math.cos(l2) * Math.cos(dLon);
  let brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

// =========================================================================
// 100% FULLY CONNECTED MARITIME NETWORK — NO BOXES, NO FLOATING SHAPES
// Every route is an interconnected sequence of oceanic navigation waypoints:
// [lat, lon, laneWidthDegrees]
// All routes connect seamlessly at shared maritime nodes!
// =========================================================================

const connectedNetwork = [
  // ── NORTH INDIAN OCEAN & ARABIAN SEA NETWORK (FULLY CONNECTED) ──
  {
    name: 'India-WestCoast-Trunk', // Gujarat -> Mumbai -> Goa -> Mangalore -> Cochin -> Sri Lanka
    weight: 260,
    points: [
      [22.4, 69.4, 0.06],    // Kandla / Mundra approach
      [21.2, 70.2, 0.08],    // Gulf of Khambhat entrance
      [19.8, 71.5, 0.10],    // Mumbai High North
      [18.9, 72.4, 0.08],    // Mumbai / JNPT approach
      [17.0, 72.8, 0.09],    // Ratnagiri offshore
      [15.4, 73.3, 0.08],    // Goa Mormugao offshore
      [13.0, 74.3, 0.08],    // New Mangalore offshore
      [10.5, 75.3, 0.08],    // Calicut offshore
      [9.9, 75.8, 0.06],     // Cochin Port approach
      [8.3, 76.6, 0.08],     // Kollam / Vizhinjam
      [7.6, 77.3, 0.10],     // Kanyakumari South
      [5.7, 80.5, 0.12]      // Dondra Head / Sri Lanka South TSS
    ]
  },
  {
    name: 'India-EastCoast-Trunk', // Sri Lanka -> Chennai -> Vizag -> Paradip -> Sandheads / Kolkata
    weight: 220,
    points: [
      [5.7, 80.5, 0.12],     // Sri Lanka South
      [6.95, 79.8, 0.06],    // Colombo Port approach
      [8.5, 80.2, 0.08],     // Gulf of Mannar
      [10.5, 80.3, 0.08],    // Palk Strait east
      [13.1, 80.5, 0.06],    // Chennai Port approach
      [14.5, 80.8, 0.08],    // Krishnapatnam offshore
      [17.6, 83.5, 0.06],    // Visakhapatnam Port approach
      [19.5, 85.8, 0.08],    // Gopalpur offshore
      [20.2, 86.8, 0.06],    // Paradip Port approach
      [21.2, 88.2, 0.07],    // Sandheads / Kolkata approach
      [21.8, 91.5, 0.06]     // Chittagong Port approach
    ]
  },
  {
    name: 'BayOfBengal-Cross-Trunk', // Sri Lanka to Malacca Entrance (The Great East-West Transit)
    weight: 300,
    points: [
      [5.7, 80.5, 0.14],     // Sri Lanka South
      [5.8, 85.0, 0.18],     // Southern Bay of Bengal
      [6.0, 90.0, 0.18],     // Great Nicobar Channel West
      [5.8, 95.0, 0.10],     // Malacca Strait Northwest Entrance
      [5.0, 97.5, 0.08],     // Malacca Strait North
      [2.8, 101.2, 0.05],    // Port Klang / Malacca Mid (narrow)
      [1.3, 103.8, 0.03]     // Singapore Strait TSS
    ]
  },
  {
    name: 'Chennai-Malacca-Feeder', // Chennai directly across Bay of Bengal to Malacca
    weight: 180,
    points: [
      [13.1, 80.5, 0.06],    // Chennai
      [11.5, 84.0, 0.15],    // Central Bay of Bengal
      [9.0, 89.0, 0.18],     // Andaman Sea North Entrance
      [6.5, 94.0, 0.12],     // Great Channel
      [5.0, 97.5, 0.08],     // Malacca North
      [2.8, 101.2, 0.05],    // Malacca Mid
      [1.3, 103.8, 0.03]     // Singapore
    ]
  },
  {
    name: 'Kolkata-Malacca-Feeder', // Sandheads / Kolkata to Malacca & Andaman Sea
    weight: 150,
    points: [
      [21.2, 88.2, 0.06],    // Sandheads / Kolkata
      [17.0, 89.5, 0.15],    // Northern Bay of Bengal
      [12.0, 92.0, 0.15],    // Port Blair / Andaman offshore
      [8.0, 94.5, 0.12],     // Nicobar East
      [5.0, 97.5, 0.08],     // Malacca North
      [2.8, 101.2, 0.05],    // Malacca Mid
      [1.3, 103.8, 0.03]     // Singapore
    ]
  },
  {
    name: 'Mumbai-PersianGulf-Trunk', // Mumbai across Arabian Sea to Strait of Hormuz
    weight: 240,
    points: [
      [18.9, 72.4, 0.08],    // Mumbai / JNPT
      [20.0, 68.0, 0.15],    // Northeast Arabian Sea
      [22.0, 63.5, 0.18],    // Northern Arabian Sea
      [24.5, 58.5, 0.12],    // Gulf of Oman
      [25.2, 56.5, 0.05],    // Fujairah Bunkering Hub
      [26.4, 56.4, 0.03],    // Strait of Hormuz TSS
      [26.8, 52.0, 0.08],    // Central Persian Gulf
      [28.5, 49.5, 0.06]     // Kuwait / Ras Tanura
    ]
  },
  {
    name: 'Mumbai-RedSea-Europe-Trunk', // Mumbai across Arabian Sea to Gulf of Aden & Suez
    weight: 260,
    points: [
      [18.9, 72.4, 0.08],    // Mumbai
      [15.5, 66.0, 0.18],    // Central Arabian Sea
      [13.5, 55.0, 0.18],    // Arabian Sea West
      [13.5, 51.5, 0.15],    // Socotra North / Gulf of Aden East
      [12.8, 47.0, 0.12],    // Gulf of Aden Mid
      [12.6, 43.35, 0.03],   // Bab el-Mandeb (narrow strait)
      [15.5, 41.5, 0.05],    // Red Sea South
      [21.0, 38.2, 0.06],    // Red Sea Central
      [26.5, 35.0, 0.06],    // Red Sea North
      [28.5, 33.0, 0.03],    // Gulf of Suez
      [29.9, 32.55, 0.015],  // Suez Canal South
      [31.3, 32.35, 0.025]   // Port Said / Mediterranean Entrance
    ]
  },
  {
    name: 'PersianGulf-Asia-OilHighway', // Hormuz directly to Sri Lanka & Singapore
    weight: 280,
    points: [
      [26.4, 56.4, 0.03],    // Strait of Hormuz TSS
      [24.5, 58.5, 0.10],    // Gulf of Oman
      [21.0, 62.5, 0.18],    // Arabian Sea Northwest
      [14.0, 67.5, 0.20],    // Central Arabian Sea Deep
      [7.5, 76.5, 0.15],     // South of India
      [5.7, 80.5, 0.12],     // Sri Lanka South
      [5.8, 90.0, 0.15],     // Bay of Bengal South
      [5.0, 97.5, 0.08],     // Malacca North
      [2.8, 101.2, 0.05],    // Malacca Mid
      [1.3, 103.8, 0.03]     // Singapore
    ]
  },

  // ── EAST ASIA & PACIFIC NETWORK (FULLY CONNECTED) ──
  {
    name: 'Singapore-China-Japan-Megahighway', // Singapore -> South China Sea -> Taiwan -> Shanghai -> Japan
    weight: 350,
    points: [
      [1.3, 103.8, 0.03],    // Singapore Strait
      [3.0, 105.0, 0.10],    // Singapore East Entrance
      [8.0, 109.5, 0.18],    // South China Sea South
      [14.0, 112.5, 0.20],   // South China Sea Central
      [19.5, 115.5, 0.15],   // South China Sea North
      [22.2, 114.3, 0.06],   // Hong Kong & Pearl River Delta
      [24.5, 119.8, 0.08],   // Taiwan Strait TSS
      [29.0, 122.5, 0.10],   // Ningbo-Zhoushan approach
      [31.2, 122.5, 0.08],   // Shanghai / Yangtze Estuary
      [34.5, 129.5, 0.08],   // Korea Strait / Busan
      [35.0, 135.0, 0.12],   // Japan Inland Sea approach
      [35.2, 139.8, 0.06]    // Tokyo Bay / Yokohama
    ]
  },
  {
    name: 'China-YellowSea-Bohai-Corridor', // Shanghai north to Yellow Sea & Bohai Bay
    weight: 180,
    points: [
      [31.2, 122.5, 0.08],   // Shanghai
      [33.5, 122.5, 0.12],   // Jiangsu offshore
      [36.0, 123.5, 0.12],   // Yellow Sea Central
      [38.0, 121.5, 0.08],   // Bohai Strait / Dalian
      [38.8, 119.5, 0.06]    // Bohai Bay / Tianjin
    ]
  },
  {
    name: 'TransPacific-Northern-GreatCircle', // Japan / Shanghai to US West Coast (Seattle/SF/LA)
    weight: 220,
    points: [
      [35.2, 139.8, 0.06],   // Tokyo Bay
      [38.5, 144.0, 0.18],   // Northeast of Honshu
      [44.0, 158.0, 0.25],   // Kuril / Northwest Pacific
      [47.5, 175.0, 0.30],   // North Pacific
      [49.0, -178.0, 0.30],  // South of Aleutians (cross dateline!)
      [47.0, -155.0, 0.30],  // Gulf of Alaska South
      [45.0, -135.0, 0.25],  // Northeast Pacific
      [38.0, -123.5, 0.10],  // San Francisco approach
      [33.7, -118.5, 0.06]   // Los Angeles / Long Beach
    ]
  },
  {
    name: 'TransPacific-Equatorial-Panama', // Asia to Hawaii & Panama Canal
    weight: 160,
    points: [
      [22.2, 114.3, 0.06],   // Hong Kong
      [20.0, 121.5, 0.10],   // Luzon Strait
      [17.0, 135.0, 0.25],   // Philippine Sea
      [14.0, 160.0, 0.30],   // Mid-Pacific West
      [12.0, -175.0, 0.35],  // Central Pacific (cross dateline!)
      [11.0, -145.0, 0.35],  // Mid-Pacific East
      [9.5, -115.0, 0.30],   // Eastern Pacific
      [8.5, -90.0, 0.20],    // Central America Pacific
      [8.9, -79.55, 0.03]    // Panama Canal Pacific Entrance (Balboa)
    ]
  },
  {
    name: 'Australia-Asia-Mineral-Highway', // Port Hedland -> Lombok -> Makassar -> China
    weight: 180,
    points: [
      [-20.2, 118.5, 0.06],  // Port Hedland Outer Channel
      [-14.0, 117.0, 0.15],  // Timor Sea
      [-8.6, 115.7, 0.03],   // Lombok Strait (narrow)
      [-1.0, 118.5, 0.08],   // Makassar Strait
      [3.5, 121.5, 0.12],    // Celebes Sea
      [12.0, 126.0, 0.20],   // East of Philippines
      [22.0, 123.5, 0.18],   // East of Taiwan
      [28.0, 123.5, 0.15],   // East China Sea
      [31.2, 122.5, 0.08]    // Shanghai
    ]
  },

  // ── MEDITERRANEAN, EUROPE & ATLANTIC NETWORK (FULLY CONNECTED) ──
  {
    name: 'Mediterranean-Trunk', // Port Said -> Crete -> Sicily -> Gibraltar
    weight: 240,
    points: [
      [31.3, 32.35, 0.03],   // Port Said (Suez North)
      [33.5, 29.5, 0.12],    // Levantine Sea
      [34.5, 25.0, 0.15],    // South of Crete
      [36.5, 18.0, 0.18],    // Ionian Sea
      [36.5, 14.5, 0.08],    // Strait of Sicily (Malta)
      [38.0, 8.5, 0.12],     // South of Sardinia
      [37.5, 1.0, 0.15],     // Balearic Sea
      [36.2, -3.0, 0.08],    // Alboran Sea
      [35.95, -5.5, 0.03]    // Strait of Gibraltar TSS
    ]
  },
  {
    name: 'Aegean-BlackSea-Corridor', // Mediterranean through Bosphorus to Black Sea
    weight: 140,
    points: [
      [35.5, 25.0, 0.10],    // North of Crete
      [37.5, 24.0, 0.08],    // Aegean Sea / Piraeus approach
      [40.1, 26.2, 0.02],    // Dardanelles Strait (narrow)
      [40.8, 28.0, 0.03],    // Sea of Marmara
      [41.15, 29.08, 0.015], // Bosphorus Strait (narrow)
      [42.5, 31.0, 0.10],    // West Black Sea
      [44.0, 34.0, 0.12]     // Central Black Sea
    ]
  },
  {
    name: 'Iberia-Channel-Rotterdam-Megahighway', // Gibraltar -> Portugal -> Biscay -> English Channel -> Rotterdam
    weight: 280,
    points: [
      [35.95, -5.5, 0.03],   // Gibraltar TSS
      [36.8, -9.2, 0.08],    // Cape St. Vincent
      [39.5, -9.8, 0.10],    // Off Lisbon
      [43.5, -9.8, 0.10],    // Cape Finisterre
      [46.5, -6.0, 0.15],    // Bay of Biscay
      [49.5, -5.5, 0.08],    // English Channel West Entrance
      [50.2, -1.0, 0.05],    // English Channel Mid
      [51.05, 1.45, 0.03],   // Dover Strait TSS (narrow)
      [52.0, 3.5, 0.05],     // Southern North Sea
      [52.0, 4.0, 0.03]      // Rotterdam / Europort
    ]
  },
  {
    name: 'NorthSea-Baltic-Corridor', // Rotterdam -> Skagerrak -> Kattegat -> Baltic Sea -> St. Petersburg
    weight: 180,
    points: [
      [52.0, 4.0, 0.03],     // Rotterdam
      [54.0, 6.5, 0.10],     // German Bight
      [57.5, 9.0, 0.06],     // Skagerrak
      [57.0, 11.5, 0.05],    // Kattegat
      [55.6, 12.8, 0.025],   // The Sound / Oresund
      [55.0, 15.0, 0.08],    // Bornholm Basin
      [56.5, 19.0, 0.10],    // Central Baltic
      [59.5, 23.0, 0.08],    // Gulf of Finland Entrance
      [59.9, 28.5, 0.05]     // St. Petersburg / Primorsk
    ]
  },
  {
    name: 'TransAtlantic-North-Highway', // US East Coast to English Channel & Northern Europe
    weight: 220,
    points: [
      [40.4, -73.8, 0.06],   // New York
      [41.5, -68.0, 0.12],   // Boston offshore
      [43.0, -58.0, 0.20],   // Nova Scotia offshore
      [45.0, -45.0, 0.25],   // Grand Banks South
      [48.0, -30.0, 0.30],   // Mid North Atlantic
      [49.8, -15.0, 0.20],   // Celtic Sea approaches
      [50.2, -4.0, 0.08],    // English Channel West
      [51.05, 1.45, 0.03],   // Dover Strait TSS
      [52.0, 3.8, 0.05]      // Rotterdam
    ]
  },
  {
    name: 'USEastCoast-Gulf-Panama-Corridor', // New York -> Miami -> Gulf of Mexico -> Panama
    weight: 220,
    points: [
      [40.4, -73.8, 0.06],   // New York
      [36.9, -75.5, 0.08],   // Chesapeake / Norfolk
      [32.5, -79.0, 0.08],   // Charleston offshore
      [26.0, -79.8, 0.06],   // Miami / Fort Lauderdale
      [24.2, -81.5, 0.05],   // Florida Straits TSS
      [27.0, -87.0, 0.12],   // Eastern Gulf of Mexico
      [28.8, -89.4, 0.05],   // Mississippi Southwest Pass
      [29.3, -94.7, 0.05],   // Houston / Galveston
      [25.0, -90.0, 0.15],   // Central Gulf of Mexico
      [21.8, -85.5, 0.10],   // Yucatan Channel
      [15.0, -78.0, 0.18],   // Caribbean Sea Central
      [9.4, -79.9, 0.025]    // Panama Canal Atlantic (Cristobal)
    ]
  },
  {
    name: 'Atlantic-SouthAmerica-Coast-Trunk', // Gibraltar / Europe off Brazil coast to Buenos Aires
    weight: 180,
    points: [
      [35.95, -5.5, 0.03],   // Gibraltar
      [30.0, -15.0, 0.20],   // West of Canary Islands
      [15.0, -25.0, 0.25],   // West of Cape Verde
      [0.0, -28.0, 0.30],    // Mid Atlantic Equator
      [-5.0, -34.5, 0.12],   // Off Natal (Brazil tip)
      [-9.0, -34.8, 0.12],   // Off Recife
      [-13.5, -38.0, 0.12],  // Off Salvador
      [-20.0, -39.5, 0.12],  // Off Vitoria
      [-23.2, -42.8, 0.08],  // Off Rio de Janeiro
      [-24.2, -46.0, 0.06],  // Off Santos / Sao Paulo
      [-26.0, -48.0, 0.08],  // Off Paranagua
      [-32.5, -51.5, 0.10],  // Off Rio Grande
      [-35.5, -55.0, 0.08]   // River Plate / Buenos Aires
    ]
  },
  {
    name: 'CapeRoute-Atlantic-IndianOcean', // Europe / Americas around South Africa to Asia
    weight: 190,
    points: [
      [36.0, -10.0, 0.15],   // Off Portugal
      [15.0, -20.0, 0.25],   // Central Atlantic
      [-5.0, -8.0, 0.25],    // Gulf of Guinea Deep Sea
      [-20.0, 8.0, 0.25],    // Off Namibia Deep Ocean
      [-34.2, 17.8, 0.10],   // Off Cape Town
      [-35.2, 20.0, 0.08],   // Cape Agulhas TSS (South tip of Africa)
      [-34.5, 27.0, 0.10],   // Off Port Elizabeth
      [-31.0, 31.5, 0.10],   // Off Durban
      [-25.0, 45.0, 0.25],   // South of Madagascar
      [-15.0, 65.0, 0.30],   // South Indian Ocean
      [-5.0, 85.0, 0.30],    // Mid Indian Ocean Equatorial
      [5.7, 80.5, 0.12]      // Connecting smoothly to Sri Lanka South!
    ]
  }
];

// Authentic Ship Names & Companies
const cargoPrefixes = ['MSC', 'Maersk', 'CMA CGM', 'COSCO', 'Ever', 'Hapag-Lloyd', 'ONE', 'Yang Ming', 'ZIM', 'Wan Hai'];
const cargoSuffixes = ['Titan', 'Glory', 'Pride', 'Harmony', 'Pioneer', 'Fortune', 'Supreme', 'Voyager', 'Navigator', 'Leader', 'Prosperity', 'Enterprise'];
const tankerPrefixes = ['Front', 'DHT', 'Euronav', 'Stena', 'Nordic', 'Ocean', 'Pacific', 'Bahri', 'Teekay', 'BW'];
const tankerSuffixes = ['Horizon', 'Gemini', 'Centurion', 'Pegasus', 'Orion', 'Sovereign', 'Vanguard', 'Endeavour', 'Champion', 'Crude'];
const fishingNames = ['Sea Hunter', 'Ocean Harvest', 'Blue Fin', 'Morning Star', 'Sea Breeze', 'Wave Rider', 'Deep Sea', 'Sagar Kanya', 'Matsya', 'Hai Feng', 'Poseidon', 'Neptune'];
const passengerNames = ['Symphony of the Seas', 'Queen Mary', 'Carnival Vista', 'Norwegian Bliss', 'Viking Star', 'AIDAprima', 'MSC Grandiosa', 'Celebrity Edge', 'Silver Spirit', 'Islander'];
const militaryNames = ['INS Vikrant', 'INS Kolkata', 'INS Chennai', 'INS Kochi', 'USS Ronald Reagan', 'HMS Queen Elizabeth', 'FS Charles de Gaulle', 'INS Tabar', 'INS Tarkash', 'INS Teg'];
const tugNames = ['Fairplay 21', 'Smit Rotterdam', 'Svitzer Eagle', 'Britoil 55', 'Oceanic Challenger', 'Maas Tug', 'Sea Stallion'];

function getRandomName(type) {
  if (type === 'cargo') return `${cargoPrefixes[Math.floor(Math.random() * cargoPrefixes.length)]} ${cargoSuffixes[Math.floor(Math.random() * cargoSuffixes.length)]}`;
  if (type === 'tanker') return `${tankerPrefixes[Math.floor(Math.random() * tankerPrefixes.length)]} ${tankerSuffixes[Math.floor(Math.random() * tankerSuffixes.length)]}`;
  if (type === 'fishing') return `${fishingNames[Math.floor(Math.random() * fishingNames.length)]} ${Math.floor(10 + Math.random() * 89)}`;
  if (type === 'passenger') return `${passengerNames[Math.floor(Math.random() * passengerNames.length)]}`;
  if (type === 'military') return `${militaryNames[Math.floor(Math.random() * militaryNames.length)]}`;
  return `${tugNames[Math.floor(Math.random() * tugNames.length)]}`;
}

const vessels = [];
const totalWeight = connectedNetwork.reduce((sum, c) => sum + c.weight, 0);

console.log(`Generating ${TOTAL_VESSELS} vessels along connected maritime arteries...`);

for (const corridor of connectedNetwork) {
  const corridorQuota = Math.floor((corridor.weight / totalWeight) * TOTAL_VESSELS);
  const pts = corridor.points;

  let created = 0;
  let attempts = 0;
  while (created < corridorQuota && attempts < corridorQuota * 20) {
    attempts++;

    // Pick a segment along this connected route
    const segIdx = Math.floor(Math.random() * (pts.length - 1));
    const p1 = pts[segIdx];
    const p2 = pts[segIdx + 1];

    const frac = Math.random();
    let lat = p1[0] + (p2[0] - p1[0]) * frac;

    // Handle longitude wrap across dateline
    let dLon = p2[1] - p1[1];
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    let lon = p1[1] + dLon * frac;

    // Calculate heading along the segment
    let bearing = calculateBearing(p1[0], p1[1], p2[0], p2[1]);
    // 50% reverse heading to simulate two-way traffic flow
    if (Math.random() > 0.5) {
      bearing = (bearing + 180) % 360;
    }

    // Natural Gaussian corridor width
    const maxScatter = (p1[2] + (p2[2] - p1[2]) * frac) || 0.08;
    const perpBearing = (bearing + 90) % 360;
    const u1 = 1 - Math.random(), u2 = Math.random();
    const g = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    const scatterDist = g * (maxScatter * 0.35);

    lat += scatterDist * Math.cos(perpBearing * Math.PI / 180);
    lon += scatterDist * Math.sin(perpBearing * Math.PI / 180) / Math.cos(lat * Math.PI / 180);

    // Normalize lon
    while (lon > 180) lon -= 360;
    while (lon < -180) lon += 360;

    // CRITICAL: Reject if on land!
    if (isLand(lat, lon)) continue;

    const r = Math.random();
    let type = 'cargo';
    if (r < 0.48) type = 'cargo';
    else if (r < 0.74) type = 'tanker';
    else if (r < 0.88) type = 'fishing';
    else if (r < 0.95) type = 'passenger';
    else if (r < 0.98) type = 'tug';
    else type = 'military';

    // Speed distribution:
    // Some ships slowing near ports (0.5 to 5 knots), most cruising (11 to 21 knots)
    let sog;
    if (Math.random() < 0.18) {
      sog = +(0.5 + Math.random() * 4.5).toFixed(1); // slow/anchored near ports
    } else {
      sog = +(11.0 + Math.random() * 10.0).toFixed(1); // cruising
    }

    const mmsi = Math.floor(200000000 + Math.random() * 799999999);

    vessels.push({
      mmsi,
      name: getRandomName(type),
      type,
      lat: +lat.toFixed(5),
      lon: +lon.toFixed(5),
      sog,
      cog: Math.round(bearing),
      timestamp: new Date().toISOString()
    });
    created++;
  }
}

// Fill any remaining to exact target
while (vessels.length < TOTAL_VESSELS) {
  const corridor = connectedNetwork[Math.floor(Math.random() * connectedNetwork.length)];
  const pts = corridor.points;
  const segIdx = Math.floor(Math.random() * (pts.length - 1));
  const p1 = pts[segIdx];
  const p2 = pts[segIdx + 1];
  const frac = Math.random();
  const lat = p1[0] + (p2[0] - p1[0]) * frac;
  let dLon = p2[1] - p1[1];
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;
  const lon = p1[1] + dLon * frac;
  if (!isLand(lat, lon)) {
    const bearing = calculateBearing(p1[0], p1[1], p2[0], p2[1]);
    const type = Math.random() < 0.5 ? 'cargo' : 'tanker';
    vessels.push({
      mmsi: Math.floor(200000000 + Math.random() * 799999999),
      name: getRandomName(type),
      type,
      lat: +lat.toFixed(5),
      lon: +lon.toFixed(5),
      sog: +(11 + Math.random() * 9).toFixed(1),
      cog: Math.round(bearing),
      timestamp: new Date().toISOString()
    });
  }
}

// FINAL AUDIT: Guarantee 0 vessels on land
let landCount = 0;
for (const v of vessels) {
  if (isLand(v.lat, v.lon)) landCount++;
}
console.log(`FINAL QUALITY AUDIT: Vessels on land = ${landCount} / ${vessels.length}`);

fs.writeFileSync('vessels_32k.json', JSON.stringify({ fleet: vessels }));
console.log(`SUCCESS! Saved ${vessels.length} connected vessels to vessels_32k.json.`);
