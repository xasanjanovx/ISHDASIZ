/**
 * Telegram Webhook Handler
 * Receives updates from Telegram Bot API
 */

import { NextRequest, NextResponse } from 'next/server';
import { telegramBot } from '@/lib/telegram/telegram-bot';

// Verify webhook request is from Telegram
function verifyRequest(request: NextRequest): boolean {
    // Optional: verify secret token in header
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secret) {
        const headerSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
        if (headerSecret !== secret) {
            console.warn('Invalid webhook secret');
            return false;
        }
    }
    return true;
}

export async function POST(request: NextRequest) {
    try {
        // Verify request
        if (!verifyRequest(request)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check bot token is configured
        if (!process.env.TELEGRAM_BOT_TOKEN) {
            console.error('TELEGRAM_BOT_TOKEN is not configured');
            return NextResponse.json({ error: 'Bot not configured' }, { status: 500 });
        }

        // Parse update
        const update = await request.json();
        console.log('📨 Telegram update:', JSON.stringify(update, null, 2));

        // Handle update asynchronously (don't block response)
        // Process in background but don't await to respond quickly
        telegramBot.handleUpdate(update).catch(err => {
            console.error('Bot handler error:', err);
        });

        // Always return 200 OK to Telegram
        return NextResponse.json({ ok: true });

    } catch (error) {
        console.error('Webhook error:', error);
        // Return 200 anyway to prevent Telegram from retrying
        return NextResponse.json({ ok: true });
    }
}

// Telegram may send GET to verify webhook
export async function GET() {
    return NextResponse.json({
        status: 'Telegram Bot Webhook Active',
        bot: 'ishdasiz_bot'
    });
}
