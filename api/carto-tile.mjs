export default async function handler(req, res) {
  const { z, x, y } = req.query;
  const zoom = Number(z);
  if (!Number.isFinite(zoom) || zoom > 20) {
    return res.status(400).send('Invalid zoom');
  }

  const cartoKey = process.env.CARTO_API_KEY;
  const upstreamUrl = cartoKey
    ? `https://a.basemaps.cartocdn.com/light_all/${z}/${x}/${y}.png?key=${encodeURIComponent(cartoKey)}`
    : `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { 'User-Agent': 'Halocline-SIH26066/1.0' }
    });
    const buffer = Buffer.from(await upstream.arrayBuffer());
    const contentType = upstream.headers.get('content-type') || 'image/png';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(upstream.ok ? 200 : upstream.status).send(buffer);
  } catch {
    res.status(502).send('Basemap unavailable');
  }
}
