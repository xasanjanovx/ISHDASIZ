import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const incoming = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
    if (!secret || Buffer.byteLength(incoming) !== Buffer.byteLength(secret)
        || !timingSafeEqual(Buffer.from(incoming), Buffer.from(secret))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!process.env.TELEGRAM_BOT_TOKEN) return NextResponse.json({ error: 'Bot not configured' }, { status: 503 });
    const update = await request.json().catch(() => null);
    if (!update || !Number.isSafeInteger(update.update_id)) {
        return NextResponse.json({ error: 'Invalid update' }, { status: 400 });
    }
    try {
        const { telegramBot } = await import('@/lib/telegram/telegram-bot');
        // Serverless hosts can freeze work after a response. Complete handling first.
        await telegramBot.handleUpdate(update);
        return NextResponse.json({ ok: true });
    } catch {
        console.error('Telegram webhook processing failed');
        return NextResponse.json({ error: 'Update processing failed' }, { status: 503 });
    }
}

export async function GET() {
    return NextResponse.json({ configured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET) });
}
