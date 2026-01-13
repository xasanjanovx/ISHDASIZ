import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function POST(request: NextRequest) {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { phone, password, selectedRole } = await request.json();

        if (!phone || !password) {
            return NextResponse.json({ error: 'Phone and password are required' }, { status: 400 });
        }

        // Get user
        const { data: user, error } = await supabase
            .from('users')
            .select('id, phone, password_hash, role, login_attempts, locked_until')
            .eq('phone', phone)
            .single();

        if (error || !user) {
            return NextResponse.json({ error: 'Foydalanuvchi topilmadi' }, { status: 404 });
        }

        // Check if account is locked
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            const remainingMs = new Date(user.locked_until).getTime() - Date.now();
            const remainingMin = Math.ceil(remainingMs / 60000);
            return NextResponse.json({
                error: `Akkaunt ${remainingMin} daqiqaga bloklangan`,
                locked: true,
                lockedUntil: user.locked_until
            }, { status: 423 });
        }

        // Check if user has password
        if (!user.password_hash) {
            return NextResponse.json({
                error: "Parol yaratilmagan. Ro'yxatdan o'ting.",
                needsPassword: true
            }, { status: 400 });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            // Increment login attempts
            const newAttempts = (user.login_attempts || 0) + 1;

            if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
                // Lock account
                const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
                await supabase
                    .from('users')
                    .update({
                        login_attempts: newAttempts,
                        locked_until: lockedUntil.toISOString()
                    })
                    .eq('id', user.id);

                return NextResponse.json({
                    error: `Akkaunt ${LOCKOUT_MINUTES} daqiqaga bloklandi`,
                    locked: true,
                    lockedUntil: lockedUntil.toISOString()
                }, { status: 423 });
            }

            await supabase
                .from('users')
                .update({ login_attempts: newAttempts })
                .eq('id', user.id);

            const remainingAttempts = MAX_LOGIN_ATTEMPTS - newAttempts;
            return NextResponse.json({
                error: `Noto'g'ri parol. ${remainingAttempts} ta urinish qoldi.`,
                attemptsRemaining: remainingAttempts
            }, { status: 401 });
        }

        // Password is correct - reset login attempts
        await supabase
            .from('users')
            .update({
                login_attempts: 0,
                locked_until: null
            })
            .eq('id', user.id);

        // Check which profiles exist for this user
        const [jobSeekerResult, employerResult] = await Promise.all([
            supabase
                .from('job_seeker_profiles')
                .select('id, full_name')
                .eq('user_id', user.id)
                .maybeSingle(),
            supabase
                .from('employer_profiles')
                .select('id, company_name')
                .eq('user_id', user.id)
                .maybeSingle()
        ]);

        let hasJobSeekerProfile = !!jobSeekerResult.data;
        let hasEmployerProfile = !!employerResult.data;

        // Determine the active role based on what user selected
        // Convert from auth modal format to internal format
        const wantedRole = selectedRole === 'seeker' ? 'job_seeker' :
            selectedRole === 'employer' ? 'employer' : null;

        // If user selected a role and doesn't have that profile, create it automatically
        if (wantedRole === 'job_seeker' && !hasJobSeekerProfile) {
            console.log('Auto-creating job_seeker profile for user:', user.id);
            const { error: createError } = await supabase
                .from('job_seeker_profiles')
                .insert({ user_id: user.id, phone: user.phone });

            if (!createError) {
                hasJobSeekerProfile = true;
                console.log('✅ Job seeker profile auto-created');
            } else {
                console.error('Failed to auto-create job_seeker profile:', createError);
            }
        } else if (wantedRole === 'employer' && !hasEmployerProfile) {
            console.log('Auto-creating employer profile for user:', user.id);
            const { error: createError } = await supabase
                .from('employer_profiles')
                .insert({ user_id: user.id, phone: user.phone });

            if (!createError) {
                hasEmployerProfile = true;
                console.log('✅ Employer profile auto-created');
            } else {
                console.error('Failed to auto-create employer profile:', createError);
            }
        }

        // Determine active role - prefer selected role if available
        let activeRole: string;
        if (wantedRole) {
            activeRole = wantedRole;
        } else if (hasJobSeekerProfile && !hasEmployerProfile) {
            activeRole = 'job_seeker';
        } else if (hasEmployerProfile && !hasJobSeekerProfile) {
            activeRole = 'employer';
        } else {
            activeRole = 'job_seeker'; // default
        }

        // Return user data for session
        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                phone: user.phone,
                role: activeRole, // For backward compatibility
                has_job_seeker_profile: hasJobSeekerProfile,
                has_employer_profile: hasEmployerProfile,
                full_name: jobSeekerResult.data?.full_name || null,
                company_name: employerResult.data?.company_name || null
            },
            // Role selection no longer needed - we use what user selected
            needsRoleSelection: false,
            message: 'Muvaffaqiyatli kirdingiz!'
        });

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
