import { NextResponse } from 'next/server';
import { readTelegramAudience } from '@/lib/telegram-audience';
export async function GET() {
  const audience = await readTelegramAudience();
  return NextResponse.json(audience, { headers: { 'Cache-Control': audience.botUsers === null || audience.channelMembers === null ? 'no-store' : 'public, max-age=60, s-maxage=300' } });
}
