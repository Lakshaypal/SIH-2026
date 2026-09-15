import { NextResponse } from 'next/server';
import WebSocket from 'ws';

export const dynamic = 'force-dynamic';

export async function GET() {
  const AIS_KEY = process.env.AISSTREAM_API_KEY;
  if (!AIS_KEY || AIS_KEY === 'replace_with_your_aisstream_key') {
    return NextResponse.json(
      { error: 'Missing AISStream API key in environment variables.' },
      { status: 500 }
    );
  }

  const timeoutMs = 2500;
  const vessels: any[] = [];

  const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

  const subscriptionMessage = {
    Apikey: AIS_KEY,
    BoundingBoxes: [
      [[-40, 20], [30, 115]] // Indian Ocean coverage
    ],
    FilterMessageTypes: ["PositionReport"]
  };

  await new Promise<void>((resolve) => {
    ws.on('open', () => {
      ws.send(JSON.stringify(subscriptionMessage));
      
      setTimeout(() => {
        ws.close();
        resolve();
      }, timeoutMs);
    });

    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.MessageType === 'PositionReport' && msg.Message?.PositionReport) {
          const report = msg.Message.PositionReport;
          const meta = msg.MetaData;
          
          vessels.push({
            mmsi: meta.MMSI,
            name: meta.ShipName || `MMSI: ${meta.MMSI}`,
            type: getShipType(report.TrueHeading, report.Cog),
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

  return NextResponse.json({ fleet: vessels }, { status: 200 });
}

function getShipType(heading: number, cog: number) {
  const hash = Math.floor(heading + cog) % 6;
  switch (hash) {
    case 0: return 'cargo';
    case 1: return 'tanker';
    case 2: return 'fishing';
    case 3: return 'passenger';
    case 4: return 'military';
    default: return 'other';
  }
}
