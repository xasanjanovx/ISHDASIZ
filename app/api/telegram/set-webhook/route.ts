/**
 * Set Telegram Webhook
 * Call this endpoint to register webhook URL with Telegram
 */

import { NextRequest, NextResponse } from 'next/server';
import { setWebhook, setWebhookWithOptions, getWebhookInfo, getMe } from '@/lib/telegram/telegram-api';

export async function GET(request: NextRequest) {
    try {
        // Check token is configured
        if (!process.env.TELEGRAM_BOT_TOKEN) {
            return NextResponse.json({
                error: 'TELEGRAM_BOT_TOKEN is not configured in environment variables'
            }, { status: 500 });
        }

        // Get bot info
        const botInfo = await getMe();
        console.log('🤖 Bot info:', botInfo);

        // Determine webhook URL
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
        if (!appUrl) {
            return NextResponse.json({
                error: 'NEXT_PUBLIC_APP_URL is not configured',
                hint: 'Set NEXT_PUBLIC_APP_URL to your production URL (e.g., https://ishdasiz.uz)'
            }, { status: 500 });
        }

        const webhookUrl = `${appUrl.startsWith('http') ? appUrl : 'https://' + appUrl}/api/telegram/webhook`;

        // Set webhook with optional secret
        const params: { url: string; secret_token?: string; allowed_updates?: string[] } = {
            url: webhookUrl,
            allowed_updates: ['message', 'callback_query']
        };

        if (process.env.TELEGRAM_WEBHOOK_SECRET) {
            params.secret_token = process.env.TELEGRAM_WEBHOOK_SECRET;
        }

        await setWebhookWithOptions(params);
        const info = await getWebhookInfo();

        return NextResponse.json({
            success: true,
            bot: {
                username: botInfo.username,
                id: botInfo.id,
                first_name: botInfo.first_name
            },
            webhook: {
                url: webhookUrl,
                pending_update_count: info.pending_update_count,
                last_error_date: info.last_error_date,
                last_error_message: info.last_error_message
            },
            message: `Webhook успешно установлен! Бот: @${botInfo.username}`
        });

    } catch (error) {
        console.error('Set webhook error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to set webhook'
        }, { status: 500 });
    }
}

// POST to set custom webhook URL
export async function POST(request: NextRequest) {
    try {
        const { url } = await request.json();

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        if (!process.env.TELEGRAM_BOT_TOKEN) {
            return NextResponse.json({
                error: 'TELEGRAM_BOT_TOKEN is not configured'
            }, { status: 500 });
        }

        const result = await setWebhook(url);
        const info = await getWebhookInfo();
        const botInfo = await getMe();

        return NextResponse.json({
            success: true,
            bot: `@${botInfo.username}`,
            webhook_url: url,
            info
        });

    } catch (error) {
        console.error('Set webhook error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to set webhook'
        }, { status: 500 });
    }
}
