import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { phone, password, role } = await request.json();

        if (!phone || !password) {
            return NextResponse.json({ error: 'Phone and password are required' }, { status: 400 });
        }

        if (password.length < 6) {
            return NextResponse.json({ error: "Parol kamida 6 ta belgidan iborat bo'lishi kerak" }, { status: 400 });
        }

        // Hash the password
        const passwordHash = await bcrypt.hash(password, 10);

        // Check if user already exists
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('phone', phone)
            .single();

        if (existingUser) {
            // Update existing user with password
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    password_hash: passwordHash,
                    login_attempts: 0,
                    locked_until: null
                })
                .eq('phone', phone);

            if (updateError) {
                console.error('Update password error:', updateError);
                return NextResponse.json({ error: 'Failed to save password' }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                userId: existingUser.id,
                message: 'Password created successfully'
            });
        }

        // Create new user with password
        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert({
                phone,
                password_hash: passwordHash,
                role: role || 'job_seeker',
                login_attempts: 0
            })
            .select('id')
            .single();

        if (insertError) {
            console.error('Create user error:', insertError);
            return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
        }

        // Create profile based on role
        if (role === 'employer') {
            await supabase.from('employer_profiles').insert({
                user_id: newUser.id,
                company_name: '',
                is_verified: false
            });
        } else {
            await supabase.from('job_seeker_profiles').insert({
                user_id: newUser.id,
                full_name: ''
            });
        }

        return NextResponse.json({
            success: true,
            userId: newUser.id,
            message: 'User created with password'
        });

    } catch (error) {
        console.error('Create password error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
