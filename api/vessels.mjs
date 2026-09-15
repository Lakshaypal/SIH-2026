import { createDemoFleet } from './_shared.mjs';

export default function handler(req, res) {
  const fleet = createDemoFleet();
  const { type, q, limit } = req.query || {};
  const maxResults = Math.min(Number(limit) || 500, 1000);

  let results = fleet;
  if (type && type !== 'all') {
    results = results.filter(v => v.type.toLowerCase().includes(type.toLowerCase()));
  }
  if (q) {
    const query = q.toLowerCase().trim();
    results = results.filter(v =>
      v.name.toLowerCase().includes(query) ||
      v.mmsi.includes(query) ||
      (v.destination || '').toLowerCase().includes(query)
    );
  }

  res.setHeader('Cache-Control', 'no-store');
  res.json(results.slice(0, maxResults));
}
