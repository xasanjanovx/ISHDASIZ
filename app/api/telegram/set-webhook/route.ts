import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { setWebhookWithOptions, getWebhookInfo, getMe } from '@/lib/telegram/telegram-api';

function authorized(request: NextRequest): boolean {
    const secret = process.env.TELEGRAM_SETUP_SECRET;
    const incoming = request.headers.get('Authorization')?.replace(/^Bearer /, '') || '';
    return !!secret && Buffer.byteLength(secret) === Buffer.byteLength(incoming)
        && timingSafeEqual(Buffer.from(secret), Buffer.from(incoming));
}

// Inspection never changes the webhook.
export async function GET(request: NextRequest) {
    if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        return NextResponse.json({ bot: await getMe(), webhook: await getWebhookInfo() });
    } catch {
        return NextResponse.json({ error: 'Telegram unavailable' }, { status: 502 });
    }
}

export async function POST(request: NextRequest) {
    if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const base = process.env.NEXT_PUBLIC_APP_URL;
    if (!secret || !base) return NextResponse.json({ error: 'Webhook configuration missing' }, { status: 503 });
    try {
        const url = new URL('/api/telegram/webhook', base);
        if (url.protocol !== 'https:') return NextResponse.json({ error: 'HTTPS is required' }, { status: 400 });
        // Keep Telegram from dispatching 40 concurrent requests to session flows
        // spread across serverless instances. Pending updates remain queued.
        await setWebhookWithOptions({ url: url.toString(), secret_token: secret, max_connections: 1, allowed_updates: ['message', 'callback_query'] });
        return NextResponse.json({ success: true, webhook: await getWebhookInfo() });
    } catch {
        return NextResponse.json({ error: 'Could not configure Telegram webhook' }, { status: 502 });
    }
}
