export default function handler(req, res) {
  res.status(200).json({
    status: 'online',
    mode: 'live',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    api: 'Vercel Serverless',
    aisStreamStatus: process.env.AISSTREAM_API_KEY ? 'configured' : 'missing_key'
  });
}
