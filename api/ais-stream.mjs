import { createDemoFleet } from './_shared.mjs';

export default function handler(req, res) {
  // SSE (Server-Sent Events) is not natively supported in Vercel serverless.
  // Send a single snapshot of the fleet and close the connection.
  const fleet = createDemoFleet();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  res.write(`event: ais-status\ndata: ${JSON.stringify({
    connected: false,
    configured: Boolean(process.env.AISSTREAM_API_KEY),
    source: 'Demo fleet (serverless)',
    liveVessels: 0,
    demoVessels: fleet.length
  })}\n\n`);

  res.write(`event: vessels\ndata: ${JSON.stringify(fleet)}\n\n`);
  res.end();
}
