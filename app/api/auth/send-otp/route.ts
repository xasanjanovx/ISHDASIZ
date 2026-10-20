import { NextResponse } from 'next/server';
import { getAuthClient, normalizePhone } from '@/lib/auth/server';
import { issuePhoneOtp } from '@/lib/auth/issue-otp';
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const phone = normalizePhone(body?.phone);
  if (!phone) return NextResponse.json({ error: 'Telefon raqami noto‘g‘ri.' }, { status: 400 });
  try {
    const result = await issuePhoneOtp(getAuthClient(), phone);
    return NextResponse.json(result.body, { status: result.status, headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'SMS xizmati vaqtincha ishlamayapti.', code: 'sms_unavailable' }, { status: 503 }); }
}
