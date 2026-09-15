import { createDemoFleet } from './_shared.js';

export default function handler(req, res) {
  const fleet = createDemoFleet();
  const aisKey = process.env.AISSTREAM_API_KEY;
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    aisConfigured: Boolean(aisKey),
    connected: false,
    vessels: fleet.length,
    liveVessels: 0,
    demoVessels: fleet.length,
    domain: '5°N–30°N, 45°E–105°E',
    source: 'Demo fleet (serverless deployment)'
  });
}
