import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validate Telegram WebApp initData
function validateTelegramWebAppData(initData: string, botToken: string): boolean {
    try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        if (!hash) return false;

        // Remove hash from params
        urlParams.delete('hash');

        // Sort params alphabetically
        const dataCheckString = Array.from(urlParams.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        // Create secret key
        const secretKey = crypto
            .createHmac('sha256', 'WebAppData')
            .update(botToken)
            .digest();

        // Calculate hash
        const calculatedHash = crypto
            .createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');

        return calculatedHash === hash;
    } catch (error) {
        console.error('Validation error:', error);
        return false;
    }
}

export async function POST(request: NextRequest) {
    try {
        const { initData } = await request.json();

        if (!initData) {
            return NextResponse.json({ error: 'Missing initData' }, { status: 400 });
        }

        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
            return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
        }

        // Validate the initData
        const isValid = validateTelegramWebAppData(initData, botToken);
        if (!isValid) {
            return NextResponse.json({ error: 'Invalid initData' }, { status: 401 });
        }

        // Parse user data from initData
        const urlParams = new URLSearchParams(initData);
        const userDataStr = urlParams.get('user');
        if (!userDataStr) {
            return NextResponse.json({ error: 'No user data' }, { status: 400 });
        }

        const telegramUser = JSON.parse(userDataStr);
        const telegramId = telegramUser.id;
        const firstName = telegramUser.first_name || '';
        const lastName = telegramUser.last_name || '';
        const username = telegramUser.username || '';

        // Find linked user by telegram_user_id
        const { data: existingUser } = await supabase
            .from('users')
            .select('*')
            .eq('telegram_user_id', telegramId)
            .maybeSingle();

        if (!existingUser) {
            return NextResponse.json({
                error: 'Account is not linked. Please sign in via SMS to link Telegram.',
                requires_link: true
            }, { status: 404 });
        }

        const userId = existingUser.id;

        // Get fresh user data
        const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        // Check if user has job_seeker_profile
        const { data: profile } = await supabase
            .from('job_seeker_profiles')
            .select('id')
            .eq('user_id', userId)
            .single();

        return NextResponse.json({
            success: true,
            user: {
                id: user?.id,
                telegram_id: telegramId,
                telegram_user_id: telegramId,
                first_name: firstName,
                last_name: lastName,
                username: username,
                role: user?.role,
                phone: user?.phone,
                has_profile: !!profile
            }
        });

    } catch (error) {
        console.error('WebApp auth error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
