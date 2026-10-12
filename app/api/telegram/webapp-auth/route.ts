import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { setAuthCookie, getPublicUser, getAuthClient, readAuthUser, verifyAuthToken, SESSION_COOKIE } from '@/lib/auth/server';
import { AccountError, accountFailure, accountResult, checkSameOrigin } from '@/lib/auth/account';

// Validate Telegram WebApp initData
function validateTelegramWebAppData(initData: string, botToken: string): boolean {
    try {
        const urlParams = new URLSearchParams(initData);
        if (new Set(Array.from(urlParams.keys())).size !== Array.from(urlParams.keys()).length) return false;
        const hash = urlParams.get('hash');
        if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) return false;
        const authDate = Number(urlParams.get('auth_date'));
        const now = Math.floor(Date.now() / 1000);
        if (!Number.isSafeInteger(authDate) || authDate > now + 30 || now - authDate > 5 * 60) return false;

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

        return crypto.timingSafeEqual(Buffer.from(calculatedHash, 'hex'), Buffer.from(hash, 'hex'));
    } catch (error) {
        return false;
    }
}

export async function POST(request: NextRequest) {
    try {
        checkSameOrigin(request);
        const raw = await request.text();
        if (raw.length > 20000) throw new AccountError(413, 'Telegram data is too large');
        let body;
        try { body = JSON.parse(raw); } catch { throw new AccountError(400, 'Invalid request'); }
        const initData = body?.initData;
        if (typeof initData !== 'string' || !initData || initData.length > 16000) throw new AccountError(400, 'Missing or invalid initData');
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) throw new AccountError(503, 'Telegram authentication unavailable');
        if (!validateTelegramWebAppData(initData, botToken)) throw new AccountError(401, 'Invalid initData');
        let telegramUser;
        try { telegramUser = JSON.parse(new URLSearchParams(initData).get('user') || 'null'); } catch { throw new AccountError(400, 'Invalid Telegram user'); }
        const telegramId = telegramUser?.id;
        if (!Number.isSafeInteger(telegramId) || telegramId <= 0) throw new AccountError(400, 'Invalid Telegram user');
        const client = getAuthClient();
        const { data: user, error } = await readAuthUser(client, 'id,phone,password_hash,role,is_verified', 'telegram_user_id', String(telegramId));
        if (error) throw new AccountError(503, 'Could not check linked account');
        if (!user) return accountResult({ error: 'Account is not linked. Sign in via phone.', requires_link: true }, 404);
        if (user.closed_at) return accountResult({ error: 'Account closed. Restore via SMS.', needsRestoration: true }, 403);
        const existing = verifyAuthToken(request.cookies.get(SESSION_COOKIE)?.value, 'session');
        if (existing && existing.userId !== user.id) return accountResult({ error: 'Another account is already signed in. Use phone login.', account_conflict: true }, 409);
        const role = user.role === 'employer' ? 'employer' : 'job_seeker';
        const publicUser = await getPublicUser(client, user, role);
        return setAuthCookie(accountResult({ success: true, user: publicUser }), user);
    } catch (error) {
        return accountFailure(error);
    }
}
