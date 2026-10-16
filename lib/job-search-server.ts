import type { SupabaseClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { getAuthClient } from './auth/server';
import { getJobWorkMode } from './work-mode';

const FORMAT_FIELDS = 'id,work_mode,employment_type,source_work_type:raw_source_json->work_type,source_work_mode:raw_source_json->work_mode,source_work_format:raw_source_json->work_format,source_workplace_type:raw_source_json->workplace_type';
const PUBLISHED = 'and(or(status.is.null,status.in.(active,published,open)),or(source_status.is.null,source_status.not.in.(filled,removed_at_source,archived,deleted,inactive,paused,on_hold,closed)))';
const PAGE_SIZE = 1000;
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

// Read format metadata only, never descriptions, contacts or ownership. Narrow UUID ranges
// keep each query bounded without evaluating a JSON-heavy SQL function over the whole table.
// These IDs are candidates: every final catalog query still enforces ishdasiz_job_available.
export async function readRemoteJobIds(client: SupabaseClient): Promise<string[]> {
  const format = await client.from('jobs').select('work_format').limit(0).abortSignal(AbortSignal.timeout(15000));
  if (format.error && format.error.code !== '42703' && format.error.code !== 'PGRST204') throw format.error;
  const fields = FORMAT_FIELDS + (format.error ? '' : ',work_format');
  const pending = Array.from({ length: 16 }, (_, i) => i);
  const ids = new Set<string>();
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (pending.length) {
      const bucket = pending.shift()!;
      const lower = `${bucket.toString(16)}0000000-0000-0000-0000-000000000000`;
      const upper = `${(bucket + 1).toString(16)}0000000-0000-0000-0000-000000000000`;
      let after: string | null = null;
      for (;;) {
        let query = client.from('jobs').select(fields).eq('is_active', true).or(PUBLISHED)
          .gte('id', lower).order('id').limit(PAGE_SIZE);
        if (bucket < 15) query = query.lt('id', upper);
        if (after) query = query.gt('id', after);
        const result = await query.abortSignal(AbortSignal.timeout(15000));
        if (result.error || !Array.isArray(result.data)) throw result.error || new Error('Work formats unavailable');
        const rows = result.data as unknown as Record<string, any>[];
        for (const row of rows) {
          if (!uuid.test(row.id)) throw new Error('Invalid work-format record');
          const raw = { work_type: row.source_work_type, work_mode: row.source_work_mode,
            work_format: row.source_work_format, workplace_type: row.source_workplace_type };
          if (getJobWorkMode({ ...row, raw_source_json: raw }) === 'remote') ids.add(row.id);
        }
        if (rows.length < PAGE_SIZE) break;
        const next = rows.at(-1)!.id;
        if (after && next <= after) throw new Error('Invalid work-format cursor');
        after = next;
      }
    }
  }));
  return Array.from(ids).sort();
}

const cachedRemoteJobIds = unstable_cache(
  () => readRemoteJobIds(getAuthClient()),
  ['catalog-remote-formats-v1', process.env.NEXT_PUBLIC_SUPABASE_URL || ''],
  { revalidate: 60 },
);
let pending: Promise<string[]> | null = null;
export function getRemoteJobIds() {
  if (!pending) pending = cachedRemoteJobIds().finally(() => { pending = null; });
  return pending;
}
