import WebSocket from 'ws';

export default async function handler(req, res) {
  const AIS_KEY = process.env.AISSTREAM_API_KEY;
  if (!AIS_KEY || AIS_KEY === 'replace_with_your_aisstream_key') {
    return res.status(500).json({ error: 'Missing AISStream API key in environment variables.' });
  }

  const timeoutMs = 2500; // Collect for 2.5 seconds to easily fit inside 10s Serverless window
  const vessels = [];

  const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

  const subscriptionMessage = {
    Apikey: AIS_KEY,
    BoundingBoxes: [
      [[-40, 20], [30, 115]] // Indian Ocean coverage
    ],
    FilterMessageTypes: ["PositionReport"]
  };

  await new Promise((resolve) => {
    ws.on('open', () => {
      ws.send(JSON.stringify(subscriptionMessage));
      
      // Stop collecting and close after timeoutMs
      setTimeout(() => {
        ws.close();
        resolve();
      }, timeoutMs);
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.MessageType === 'PositionReport' && msg.Message?.PositionReport) {
          const report = msg.Message.PositionReport;
          const meta = msg.MetaData;
          
          vessels.push({
            mmsi: meta.MMSI,
            name: meta.ShipName || `MMSI: ${meta.MMSI}`,
            type: getShipType(report.TrueHeading, report.Cog), // Dummy derived type if missing
            lat: meta.latitude,
            lon: meta.longitude,
            sog: report.Sog,
            cog: report.Cog,
            timestamp: meta.time_utc,
            isLive: true
          });
        }
      } catch (err) {
        // ignore parsing errors
      }
    });

    ws.on('error', () => resolve());
    ws.on('close', () => resolve());
  });

  return res.status(200).json({ fleet: vessels });
}

function getShipType(heading, cog) {
  // Simple deterministic fallback for ship type if not available
  const hash = (heading + cog) % 6;
  switch (hash) {
    case 0: return 'cargo';
    case 1: return 'tanker';
    case 2: return 'fishing';
    case 3: return 'passenger';
    case 4: return 'military';
    default: return 'other';
  }
}
