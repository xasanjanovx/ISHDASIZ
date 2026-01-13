import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            // No database - treat as new user
            return NextResponse.json({
                exists: false,
                hasPassword: false,
                message: 'No database configured'
            });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        const { phone } = await request.json();

        if (!phone) {
            return NextResponse.json({ error: 'Phone is required' }, { status: 400 });
        }

        // Check if user exists
        const { data: user, error } = await supabase
            .from('users')
            .select('id, phone, password_hash, role, locked_until')
            .eq('phone', phone)
            .single();

        if (error && error.code !== 'PGRST116') {
            // PGRST116 = no rows found, which is expected for new users
            console.error('Check user error:', error);
            // On error, allow registration flow
            return NextResponse.json({
                exists: false,
                hasPassword: false,
                message: 'Database query failed, proceeding with registration'
            });
        }

        if (!user) {
            // User doesn't exist - needs registration via SMS
            return NextResponse.json({
                exists: false,
                hasPassword: false,
                message: 'User not found, registration required'
            });
        }

        // Check if account is locked
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            const remainingMs = new Date(user.locked_until).getTime() - Date.now();
            const remainingMin = Math.ceil(remainingMs / 60000);
            return NextResponse.json({
                exists: true,
                locked: true,
                lockedUntil: user.locked_until,
                message: `Akkaunt ${remainingMin} daqiqaga bloklangan`
            });
        }

        // User exists
        return NextResponse.json({
            exists: true,
            hasPassword: !!user.password_hash,
            role: user.role,
            message: user.password_hash ? 'Password login required' : 'Password creation required'
        });

    } catch (error) {
        console.error('Check user error:', error);
        // On error, allow registration flow
        return NextResponse.json({
            exists: false,
            hasPassword: false,
            message: 'Error occurred, proceeding with registration'
        });
    }
}
