import { NextRequest, NextResponse } from 'next/server';
import { getAuthClient, normalizePhone } from '@/lib/auth/server';
export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => null);
    const phone = normalizePhone(body?.phone);
    if (!phone) return NextResponse.json({ error: 'Telefon raqami noto‘g‘ri.' }, { status: 400 });
    try {
        const client = getAuthClient();
        const { data: user, error } = await client.from('users').select('id, password_hash, locked_until').eq('phone', phone).maybeSingle();
        if (error) throw new Error('Database unavailable');
        return NextResponse.json({ exists: !!user, hasPassword: !!user?.password_hash,
            locked: !!(user?.locked_until && new Date(user.locked_until).getTime() > Date.now()) });
    } catch {
        return NextResponse.json({ error: 'Tizim vaqtincha ishlamayapti. Qayta urinib ko‘ring.' }, { status: 503 });
    }
}
