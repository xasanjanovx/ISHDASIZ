import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { otpStore } from '@/lib/otp-store';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { phone, code, role } = body;

        if (!phone || !code) {
            return NextResponse.json({ error: 'Phone and code required' }, { status: 400 });
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

        // DEV MODE: Accept any code if no ESKIZ credentials
        const isDevMode = !process.env.ESKIZ_EMAIL;

        // Verify OTP
        let verified = false;
        let verificationSource = '';

        // Try database first
        if (supabase) {
            try {
                const { data: otpRecord, error: fetchError } = await supabase
                    .from('otp_codes')
                    .select('*')
                    .eq('phone', phone)
                    .eq('verified', false)
                    .gt('expires_at', new Date().toISOString())
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (!fetchError && otpRecord) {
                    if (otpRecord.attempts >= 3) {
                        return NextResponse.json({ error: 'Urinishlar tugadi (Too many attempts)' }, { status: 429 });
                    }

                    if (otpRecord.code === code) {
                        // Mark as verified
                        await supabase.from('otp_codes').update({ verified: true }).eq('id', otpRecord.id);
                        verified = true;
                        verificationSource = 'database';
                        console.log('✅ OTP verified from database');
                    } else {
                        // Increment attempts
                        await supabase.from('otp_codes').update({ attempts: otpRecord.attempts + 1 }).eq('id', otpRecord.id);
                        return NextResponse.json({ error: "Kod noto'g'ri (Invalid code)" }, { status: 400 });
                    }
                }
            } catch (dbErr) {
                console.error('DB verification error:', dbErr);
                // Continue to check local store
            }
        }

        // Fallback: Check local store if not verified from DB
        if (!verified) {
            const localRecord = otpStore.get(phone);

            if (isDevMode) {
                // In dev mode without ESKIZ, accept any code
                console.log('🔧 DEV MODE: Accepting any code');
                verified = true;
                verificationSource = 'dev_mode';
            } else if (localRecord) {
                if (localRecord.code === code && Date.now() < localRecord.expires_at) {
                    otpStore.delete(phone);
                    verified = true;
                    verificationSource = 'local_store';
                    console.log('✅ OTP verified from local store');
                } else if (localRecord.code !== code) {
                    return NextResponse.json({ error: "Kod noto'g'ri (Invalid code)" }, { status: 400 });
                } else {
                    return NextResponse.json({ error: 'Kod muddati tugagan (Code expired)' }, { status: 400 });
                }
            } else {
                return NextResponse.json({ error: "Kod topilmadi. Qayta SMS olishga urinib ko'ring." }, { status: 400 });
            }
        }

        if (!verified) {
            return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
        }

        console.log(`✅ OTP verified via: ${verificationSource}`);

        // === AUTH FLOW: Check/Create User ===
        let user = null;
        const userRole = role || 'job_seeker';

        if (supabase) {
            // Check if user exists
            const { data: existingUser, error: findError } = await supabase
                .from('users')
                .select('*')
                .eq('phone', phone)
                .single();

            if (findError && findError.code !== 'PGRST116') {
                console.error('Find user error:', findError);
            }

            if (existingUser) {
                user = existingUser;
                console.log('✅ Existing user found:', user.id);
            } else {
                // Create new user
                console.log('Creating new user with:', { phone, role: userRole });

                const { data: newUser, error: userError } = await supabase
                    .from('users')
                    .insert({
                        phone,
                        role: userRole,
                        is_verified: true,
                        verified_via: 'sms'
                    })
                    .select()
                    .single();

                if (userError) {
                    console.error('Failed to create user:', JSON.stringify(userError, null, 2));
                    // Return more detailed error
                    return NextResponse.json({
                        error: `Foydalanuvchi yaratishda xatolik: ${userError.message || userError.code}`,
                        details: userError
                    }, { status: 500 });
                }

                user = newUser;
                console.log('✅ New user created:', user.id);

                // Create empty profile - but don't fail if profile creation fails
                try {
                    if (userRole === 'job_seeker') {
                        const { error: profileError } = await supabase
                            .from('job_seeker_profiles')
                            .insert({ user_id: user.id, phone });

                        if (profileError) {
                            console.error('Job seeker profile creation failed:', profileError);
                        } else {
                            console.log('✅ Job seeker profile created');
                        }
                    } else {
                        const { error: profileError } = await supabase
                            .from('employer_profiles')
                            .insert({ user_id: user.id, phone });

                        if (profileError) {
                            console.error('Employer profile creation failed:', profileError);
                        } else {
                            console.log('✅ Employer profile created');
                        }
                    }
                } catch (profileErr) {
                    console.error('Profile creation error:', profileErr);
                    // Continue anyway - user was created successfully
                }
            }
        } else {
            // No DB: Create mock user
            user = {
                id: `dev-${Date.now()}`,
                phone,
                role: userRole,
                is_verified: true
            };
            console.log('🔧 DEV MODE: Mock user created');
        }

        // Return user data for session
        return NextResponse.json({
            success: true,
            message: 'Tasdiqlandi (Verified)',
            user: {
                id: user.id,
                phone: user.phone,
                role: user.role,
                is_verified: user.is_verified,
                password_hash: user.password_hash // Include to check if password exists
            }
        });

    } catch (error) {
        console.error('Verify OTP Error:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
