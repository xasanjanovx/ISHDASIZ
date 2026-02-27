import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function parseEmailAllowlist(): Set<string> {
  const raw = [
    process.env.ADMIN_BOOTSTRAP_EMAILS || '',
    process.env.ADMIN_EMAILS || '',
  ]
    .join(',')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return new Set(raw);
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Supabase env is not configured' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: existingProfile, error: existingError } = await supabaseAdmin
      .from('admin_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    if (existingProfile) {
      return NextResponse.json({ ok: true, exists: true, profile: existingProfile });
    }

    const normalizedEmail = String(user.email || '').trim().toLowerCase();
    const allowlist = parseEmailAllowlist();
    const { count: superAdminRoleCount, error: superAdminCountError } = await supabaseAdmin
      .from('admin_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'super_admin');

    if (superAdminCountError) {
      return NextResponse.json({ error: superAdminCountError.message }, { status: 500 });
    }

    // Bootstrap should depend on super-admin existence, not total admin rows.
    const isFirstSuperAdmin = (superAdminRoleCount ?? 0) === 0;
    const allowlisted = normalizedEmail.length > 0 && allowlist.has(normalizedEmail);

    if (!isFirstSuperAdmin && !allowlisted) {
      return NextResponse.json({ error: 'Not allowed to bootstrap admin profile' }, { status: 403 });
    }

    const fullNameRaw = user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Admin';
    const fullName = String(fullNameRaw).trim().slice(0, 120) || 'Admin';
    const role = isFirstSuperAdmin || allowlisted ? 'super_admin' : 'hokimlik_assistant';

    const payload = {
      id: user.id,
      full_name: fullName,
      role,
      district_id: null as number | null,
    };

    const { data: upserted, error: upsertError } = await supabaseAdmin
      .from('admin_profiles')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single();

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, created: true, profile: upserted });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unknown server error' }, { status: 500 });
  }
}

