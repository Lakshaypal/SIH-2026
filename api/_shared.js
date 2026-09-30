// Shared demo fleet generator for Vercel serverless functions.
// In serverless, there is no persistent in-memory state, so the demo fleet
// is regenerated deterministically on each cold start.

const domain = { south: 5, west: 45, north: 30, east: 105 };

export function createDemoFleet() {
  const fleet = [];
  const routes = [
    { start: [6.2, 96], end: [12.5, 48], heading: 275 },
    { start: [25.5, 57], end: [7.5, 80], heading: 125 },
    { start: [8.5, 78.5], end: [22, 88], heading: 35 },
    { start: [20, 70], end: [9, 76], heading: 155 }
  ];
  const categories = ['Cargo', 'Cargo', 'Tanker', 'Tanker', 'Fishing', 'Tug / Tow', 'Passenger'];
  for (let i = 0; i < 96; i++) {
    const route = routes[i % routes.length];
    const progress = ((i * 37) % 97) / 100;
    const lat = route.start[0] + (route.end[0] - route.start[0]) * progress + (((i * 13) % 10) - 5) * 0.045;
    const lon = route.start[1] + (route.end[1] - route.start[1]) * progress + (((i * 7) % 10) - 5) * 0.07;
    const type = categories[i % categories.length];
    const number = String(i + 1).padStart(3, '0');
    fleet.push({
      mmsi: `DEMO-${number}`, name: `DEMO ${type.toUpperCase()} ${number}`,
      lat: Number(lat.toFixed(5)), lon: Number(lon.toFixed(5)),
      sog: type === 'Fishing' ? 6 + (i % 4) : 11 + (i % 8),
      cog: route.heading, type, source: 'Demo scenario', isDemo: true,
      receivedAt: new Date().toISOString()
    });
  }
  return fleet;
}

export { domain };
