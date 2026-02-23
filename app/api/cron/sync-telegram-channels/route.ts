import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { deleteMessage, editMessage, sendMessage } from '@/lib/telegram/telegram-api';
import {
  buildJobChannelMessage,
  buildResumeChannelMessage,
  getChannelByRegionSlug,
  hashMessage,
  isJobActiveForChannel,
  isResumeActiveForChannel,
  normalizeRegionName,
  SyncEntityType
} from '@/lib/telegram/channel-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;
const WORKER_NAME = 'telegram_channel_sync';
const MAX_EVENTS = 40;
const MAX_ATTEMPTS = 8;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type SyncEventRow = {
  id: string;
  entity_type: SyncEntityType;
  entity_id: string;
  action: 'upsert' | 'deactivate' | 'delete';
  region_id: number | null;
  status: 'pending' | 'processing' | 'done' | 'failed';
  attempts: number;
  created_at: string;
};

type ChannelPostRow = {
  id: string;
  entity_type: SyncEntityType;
  entity_id: string;
  channel_username: string;
  message_id: number;
  message_hash: string | null;
  status: 'active' | 'deleted';
};

type RegionRow = {
  id: number;
  slug: string | null;
  name_uz: string | null;
  name_ru: string | null;
};

function verifyCron(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  if (!CRON_SECRET) return true;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${CRON_SECRET}`;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function getRetryAt(attempts: number): string {
  const delayMinutes = Math.min(60, Math.pow(2, Math.min(6, attempts)));
  const next = new Date(Date.now() + delayMinutes * 60 * 1000);
  return next.toISOString();
}

async function markEventDone(id: string): Promise<void> {
  await supabaseAdmin
    .from('sync_events')
    .update({
      status: 'done',
      processed_at: new Date().toISOString(),
      last_error: null
    })
    .eq('id', id);
}

async function markEventFailed(id: string, attempts: number, err: unknown): Promise<void> {
  const msg = errorText(err).slice(0, 2000);
  const nextRetryAt = getRetryAt(attempts);
  await supabaseAdmin
    .from('sync_events')
    .update({
      status: 'failed',
      last_error: msg,
      next_retry_at: nextRetryAt
    })
    .eq('id', id);
}

async function setEventProcessing(id: string, attempts: number): Promise<void> {
  await supabaseAdmin
    .from('sync_events')
    .update({
      status: 'processing',
      attempts,
      last_error: null
    })
    .eq('id', id);
}

async function fetchPendingEvents(): Promise<SyncEventRow[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('sync_events')
    .select('id, entity_type, entity_id, action, region_id, status, attempts, created_at')
    .in('status', ['pending', 'failed'])
    .lt('attempts', MAX_ATTEMPTS)
    .lte('next_retry_at', nowIso)
    .order('created_at', { ascending: true })
    .limit(MAX_EVENTS);
  if (error) throw error;
  return (data || []) as SyncEventRow[];
}

async function fetchRegionCache(): Promise<{ byId: Map<number, RegionRow>; byName: Map<string, RegionRow> }> {
  const { data, error } = await supabaseAdmin
    .from('regions')
    .select('id, slug, name_uz, name_ru');
  if (error) throw error;

  const byId = new Map<number, RegionRow>();
  const byName = new Map<string, RegionRow>();
  for (const row of (data || []) as RegionRow[]) {
    byId.set(row.id, row);
    const uz = normalizeRegionName(row.name_uz);
    const ru = normalizeRegionName(row.name_ru);
    if (uz) byName.set(uz, row);
    if (ru) byName.set(ru, row);
    if (row.slug) byName.set(normalizeRegionName(row.slug.replace(/-/g, ' ')), row);
  }
  return { byId, byName };
}

async function getActiveChannelPosts(entityType: SyncEntityType, entityId: string): Promise<ChannelPostRow[]> {
  const { data, error } = await supabaseAdmin
    .from('channel_posts')
    .select('id, entity_type, entity_id, channel_username, message_id, message_hash, status')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);
  if (error) throw error;
  return (data || []) as ChannelPostRow[];
}

async function deactivateAllPosts(entityType: SyncEntityType, entityId: string, posts: ChannelPostRow[]): Promise<number> {
  let deleted = 0;
  for (const post of posts) {
    if (post.status !== 'active') continue;
    const ok = await deleteMessage(post.channel_username, Number(post.message_id));
    if (ok) deleted += 1;
    await supabaseAdmin
      .from('channel_posts')
      .update({ status: 'deleted', updated_at: new Date().toISOString() })
      .eq('id', post.id);
  }
  return deleted;
}

async function upsertChannelPost(
  entityType: SyncEntityType,
  entityId: string,
  channelUsername: string,
  messageId: number,
  messageHash: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('channel_posts')
    .upsert({
      entity_type: entityType,
      entity_id: entityId,
      channel_username: channelUsername,
      message_id: messageId,
      message_hash: messageHash,
      status: 'active',
      updated_at: new Date().toISOString()
    }, { onConflict: 'entity_type,entity_id,channel_username' });
  if (error) throw error;
}

function resolveRegionSlug(regionCache: { byId: Map<number, RegionRow>; byName: Map<string, RegionRow> }, entity: any, event: SyncEventRow): string | null {
  const nestedSlug = entity?.districts?.regions?.slug;
  if (nestedSlug) return String(nestedSlug);

  const regionIdRaw = entity?.region_id ?? event.region_id ?? null;
  const regionId = Number(regionIdRaw);
  if (Number.isFinite(regionId) && regionCache.byId.has(regionId)) {
    return regionCache.byId.get(regionId)?.slug || null;
  }

  const regionNameRaw = entity?.region_name || entity?.districts?.regions?.name_uz || entity?.districts?.regions?.name_ru || null;
  const regionName = normalizeRegionName(regionNameRaw);
  if (regionName && regionCache.byName.has(regionName)) {
    return regionCache.byName.get(regionName)?.slug || null;
  }

  return null;
}

async function loadJob(jobId: string): Promise<any | null> {
    const { data, error } = await supabaseAdmin
        .from('jobs')
        .select('id, title, title_uz, title_ru, field_title, company_name, salary_min, salary_max, experience, education_level, status, is_active, region_id, district_id, region_name, district_name, working_days, working_hours, benefits, contact_phone, phone, address, hr_name, contact_telegram, raw_source_json')
        .eq('id', jobId)
        .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const job: any = { ...data };

    if (job.district_id) {
        const { data: district } = await supabaseAdmin
            .from('districts')
            .select('id, name_uz, name_ru, region_id, regions(id, name_uz, name_ru, slug)')
            .eq('id', job.district_id)
            .maybeSingle();
        if (district) job.districts = district;
    }

    return job;
}

async function loadResume(resumeId: string): Promise<any | null> {
    const withChannelOptIn = await supabaseAdmin
        .from('resumes')
        .select('id, title, desired_position, field_title, full_name, about, skills, languages, expected_salary_min, expected_salary_max, experience, experience_level, experience_years, education_level, status, is_public, post_to_channel, region_id, district_id')
        .eq('id', resumeId)
        .maybeSingle();
    let data: any = withChannelOptIn.data || null;
    let error: any = withChannelOptIn.error || null;

    if (error && String(error.message || '').toLowerCase().includes('post_to_channel')) {
        const fallback = await supabaseAdmin
            .from('resumes')
            .select('id, title, desired_position, field_title, full_name, about, skills, languages, expected_salary_min, expected_salary_max, experience, experience_level, experience_years, education_level, status, is_public, region_id, district_id')
            .eq('id', resumeId)
            .maybeSingle();
        data = fallback.data || null;
        error = fallback.error || null;
    }

    if (error) throw error;
    if (!data) return null;
    const resume: any = { ...data };

    if (resume.district_id) {
        const { data: district } = await supabaseAdmin
            .from('districts')
            .select('id, name_uz, name_ru, region_id, regions(id, name_uz, name_ru, slug)')
            .eq('id', resume.district_id)
            .maybeSingle();
        if (district) resume.districts = district;
    }

    return resume;
}

async function syncEntityToChannel(event: SyncEventRow, regionCache: { byId: Map<number, RegionRow>; byName: Map<string, RegionRow> }): Promise<{ sent: number; edited: number; deleted: number; skipped: number }> {
  const posts = await getActiveChannelPosts(event.entity_type, event.entity_id);

  if (event.entity_type === 'job') {
    const job = await loadJob(event.entity_id);
    const mustDeactivate = event.action !== 'upsert' || !isJobActiveForChannel(job);
    if (mustDeactivate) {
      const deleted = await deactivateAllPosts('job', event.entity_id, posts);
      return { sent: 0, edited: 0, deleted, skipped: 0 };
    }

    const regionSlug = resolveRegionSlug(regionCache, job, event);
    const channel = getChannelByRegionSlug(regionSlug);
    if (!channel) {
      const deleted = await deactivateAllPosts('job', event.entity_id, posts);
      return { sent: 0, edited: 0, deleted, skipped: 1 };
    }

    const message = buildJobChannelMessage(job, regionSlug);
    const messageHash = hashMessage(message);

    let deleted = 0;
    for (const post of posts) {
      if (post.status === 'active' && post.channel_username !== channel) {
        const ok = await deleteMessage(post.channel_username, Number(post.message_id));
        if (ok) deleted += 1;
        await supabaseAdmin.from('channel_posts').update({ status: 'deleted', updated_at: new Date().toISOString() }).eq('id', post.id);
      }
    }

    const target = posts.find((post) => post.channel_username === channel && post.status === 'active');
    if (target && target.message_hash === messageHash) {
      return { sent: 0, edited: 0, deleted, skipped: 1 };
    }

    if (target) {
      try {
        await editMessage(channel, Number(target.message_id), message, { parseMode: 'HTML' });
        await upsertChannelPost('job', event.entity_id, channel, Number(target.message_id), messageHash);
        return { sent: 0, edited: 1, deleted, skipped: 0 };
      } catch (error) {
        const msg = errorText(error).toLowerCase();
        if (!msg.includes('message to edit not found') && !msg.includes('message can')) throw error;
      }
    }

    const sent = await sendMessage(channel, message, { parseMode: 'HTML', disableWebPagePreview: true });
    await upsertChannelPost('job', event.entity_id, channel, Number(sent?.message_id), messageHash);
    return { sent: 1, edited: 0, deleted, skipped: 0 };
  }

  const resume = await loadResume(event.entity_id);
  const mustDeactivate = event.action !== 'upsert' || !isResumeActiveForChannel(resume);
  if (mustDeactivate) {
    const deleted = await deactivateAllPosts('resume', event.entity_id, posts);
    return { sent: 0, edited: 0, deleted, skipped: 0 };
  }

  const regionSlug = resolveRegionSlug(regionCache, resume, event);
  const channel = getChannelByRegionSlug(regionSlug);
  if (!channel) {
    const deleted = await deactivateAllPosts('resume', event.entity_id, posts);
    return { sent: 0, edited: 0, deleted, skipped: 1 };
  }

  const message = buildResumeChannelMessage(resume, regionSlug);
  const messageHash = hashMessage(message);

  let deleted = 0;
  for (const post of posts) {
    if (post.status === 'active' && post.channel_username !== channel) {
      const ok = await deleteMessage(post.channel_username, Number(post.message_id));
      if (ok) deleted += 1;
      await supabaseAdmin.from('channel_posts').update({ status: 'deleted', updated_at: new Date().toISOString() }).eq('id', post.id);
    }
  }

  const target = posts.find((post) => post.channel_username === channel && post.status === 'active');
  if (target && target.message_hash === messageHash) {
    return { sent: 0, edited: 0, deleted, skipped: 1 };
  }

  if (target) {
    try {
      await editMessage(channel, Number(target.message_id), message, { parseMode: 'HTML' });
      await upsertChannelPost('resume', event.entity_id, channel, Number(target.message_id), messageHash);
      return { sent: 0, edited: 1, deleted, skipped: 0 };
    } catch (error) {
      const msg = errorText(error).toLowerCase();
      if (!msg.includes('message to edit not found') && !msg.includes('message can')) throw error;
    }
  }

  const sent = await sendMessage(channel, message, { parseMode: 'HTML', disableWebPagePreview: true });
  await upsertChannelPost('resume', event.entity_id, channel, Number(sent?.message_id), messageHash);
  return { sent: 1, edited: 0, deleted, skipped: 0 };
}

export async function GET(request: NextRequest) {
  if (!verifyCron(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ success: false, error: 'TELEGRAM_BOT_TOKEN is not configured' }, { status: 500 });
  }

  let lockEnabled = true;
  try {
    const lockRes = await supabaseAdmin.rpc('acquire_worker_lock', {
      p_name: WORKER_NAME,
      p_ttl_seconds: 240
    });
    if (lockRes.error) {
      const lockErr = errorText(lockRes.error).toLowerCase();
      if (lockErr.includes('could not find the function') || lockErr.includes('acquire_worker_lock')) {
        lockEnabled = false;
      } else {
        throw lockRes.error;
      }
    } else if (!lockRes.data) {
      return NextResponse.json({
        success: true,
        worker: WORKER_NAME,
        running: true,
        message: 'Worker already running'
      });
    }

    const events = await fetchPendingEvents();
    if (!events.length) {
      return NextResponse.json({
        success: true,
        worker: WORKER_NAME,
        processed: 0,
        message: 'No pending events'
      });
    }

    const regionCache = await fetchRegionCache();
    const summary = {
      processed: 0,
      done: 0,
      failed: 0,
      sent: 0,
      edited: 0,
      deleted: 0,
      skipped: 0
    };

    for (const event of events) {
      const nextAttempts = Number(event.attempts || 0) + 1;
      await setEventProcessing(event.id, nextAttempts);
      try {
        const result = await syncEntityToChannel(event, regionCache);
        summary.done += 1;
        summary.sent += result.sent;
        summary.edited += result.edited;
        summary.deleted += result.deleted;
        summary.skipped += result.skipped;
        await markEventDone(event.id);
      } catch (error) {
        summary.failed += 1;
        await markEventFailed(event.id, nextAttempts, error);
      }
      summary.processed += 1;
    }

    return NextResponse.json({
      success: true,
      worker: WORKER_NAME,
      ...summary
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      worker: WORKER_NAME,
      error: errorText(error)
    }, { status: 500 });
  } finally {
    if (lockEnabled) {
      await supabaseAdmin.rpc('release_worker_lock', { p_name: WORKER_NAME });
    }
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
