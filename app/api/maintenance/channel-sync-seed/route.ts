import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const CRON_SECRET = process.env.CRON_SECRET;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function isAuthorized(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  if (!CRON_SECRET) return true;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${CRON_SECRET}`;
}

function parseLimit(value: string | null): number {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return 1000;
  return Math.max(1, Math.min(5000, Math.floor(num)));
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const entity = String(request.nextUrl.searchParams.get('entity') || 'all').toLowerCase();
  const limit = parseLimit(request.nextUrl.searchParams.get('limit'));

  const includeJobs = entity === 'all' || entity === 'job';
  const includeResumes = entity === 'all' || entity === 'resume';

  if (!includeJobs && !includeResumes) {
    return NextResponse.json({ success: false, error: 'Invalid entity. Use all|job|resume' }, { status: 400 });
  }

  try {
    const pendingMap = new Map<string, Set<string>>();

    const loadPending = async (entityType: 'job' | 'resume') => {
      const { data, error } = await supabaseAdmin
        .from('sync_events')
        .select('entity_id')
        .eq('entity_type', entityType)
        .in('status', ['pending', 'processing'])
        .limit(50000);
      if (error) throw error;
      pendingMap.set(entityType, new Set((data || []).map((item: any) => String(item.entity_id))));
    };

    if (includeJobs) await loadPending('job');
    if (includeResumes) await loadPending('resume');

    let insertedJobs = 0;
    let insertedResumes = 0;

    if (includeJobs) {
      const { data, error } = await supabaseAdmin
        .from('jobs')
        .select('id, region_id')
        .eq('is_active', true)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(limit);
      if (error) throw error;

      const pending = pendingMap.get('job') || new Set<string>();
      const rows = (data || [])
        .filter((row: any) => !pending.has(String(row.id)))
        .map((row: any) => ({
          entity_type: 'job',
          entity_id: row.id,
          action: 'upsert',
          region_id: row.region_id ?? null,
          payload: { seed: true },
          status: 'pending',
          next_retry_at: new Date().toISOString()
        }));

      if (rows.length > 0) {
        const { error: insertErr } = await supabaseAdmin.from('sync_events').insert(rows);
        if (insertErr) throw insertErr;
      }
      insertedJobs = rows.length;
    }

    if (includeResumes) {
      const { data, error } = await supabaseAdmin
        .from('resumes')
        .select('id, region_id')
        .eq('is_public', true)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(limit);
      if (error) throw error;

      const pending = pendingMap.get('resume') || new Set<string>();
      const rows = (data || [])
        .filter((row: any) => !pending.has(String(row.id)))
        .map((row: any) => ({
          entity_type: 'resume',
          entity_id: row.id,
          action: 'upsert',
          region_id: row.region_id ?? null,
          payload: { seed: true },
          status: 'pending',
          next_retry_at: new Date().toISOString()
        }));

      if (rows.length > 0) {
        const { error: insertErr } = await supabaseAdmin.from('sync_events').insert(rows);
        if (insertErr) throw insertErr;
      }
      insertedResumes = rows.length;
    }

    return NextResponse.json({
      success: true,
      entity,
      limit,
      inserted: {
        jobs: insertedJobs,
        resumes: insertedResumes,
        total: insertedJobs + insertedResumes
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

