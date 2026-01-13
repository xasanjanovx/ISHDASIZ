import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { generateOTP, sendSMS, getSMSText } from '@/lib/eskiz';
import { otpStore } from '@/lib/otp-store';

export async function POST(request: Request) {
    try {
        const { phone } = await request.json();

        if (!phone) {
            return NextResponse.json({ error: 'Phone is required' }, { status: 400 });
        }

        // Initialize Supabase
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_KEY;
        let supabase: any = null;

        if (supabaseUrl && supabaseKey) {
            supabase = createClient(supabaseUrl, supabaseKey, {
                auth: { persistSession: false }
            });
        }

        // Generate Code (5 digits)
        const code = generateOTP();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min

        // Save OTP - try DB first, fallback to local
        let savedToDb = false;

        if (supabase) {
            try {
                // Rate limit check: 5 SMS per hour
                const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
                const { count } = await supabase
                    .from('otp_codes')
                    .select('*', { count: 'exact', head: true })
                    .eq('phone', phone)
                    .gte('created_at', oneHourAgo);

                if (count !== null && count >= 5) {
                    return NextResponse.json({ error: 'SMS limit exceeded (5 per hour)' }, { status: 429 });
                }

                // Save to DB
                const { error: insertError } = await supabase
                    .from('otp_codes')
                    .insert({
                        phone,
                        code,
                        expires_at: expiresAt,
                        attempts: 0,
                        verified: false
                    });

                if (!insertError) {
                    savedToDb = true;
                    console.log('✅ OTP saved to Supabase');
                } else {
                    console.error('DB Insert Error:', insertError);
                }
            } catch (dbErr) {
                console.error('Supabase Error:', dbErr);
            }
        }

        if (!savedToDb) {
            // Fallback to local store
            otpStore.save(phone, code);
            console.log('✅ OTP saved to Local Store');
        }

        // Send SMS
        const message = getSMSText(code);

        console.log('==========================================');
        console.log(`📱 SENDING SMS to ${phone}`);
        console.log(`🔑 CODE: ${code}`);
        console.log('==========================================');

        const result = await sendSMS(phone, message);

        if (!result.success) {
            return NextResponse.json({ error: result.error || 'Failed to send SMS' }, { status: 502 });
        }

        return NextResponse.json({
            success: true,
            message: 'SMS sent',
            // In dev mode, also return the code for convenience
            ...(process.env.ESKIZ_EMAIL ? {} : { dev_code: code })
        });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
