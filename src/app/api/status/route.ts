import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'online',
    mode: 'live',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    api: 'Next.js App Router',
    aisStreamStatus: process.env.AISSTREAM_API_KEY ? 'configured' : 'missing_key'
  }, { status: 200 });
}
