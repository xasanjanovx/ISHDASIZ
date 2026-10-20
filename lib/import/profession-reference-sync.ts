import type { SupabaseClient } from '@supabase/supabase-js';

type Profession = { id: number; title_uz: string; category_id: string | null; category_title: string | null; vacancies_count: number };
const idOf = (value: unknown) => {
  const n = Number(value); return Number.isSafeInteger(n) && n > 0 && n <= 2147483647 ? n : null;
};
/** Scan small projections with a stable UUID cursor; never silently stop at a
 * REST row cap. Counts use all imported history, matching the homepage totals. */
export async function syncProfessionReferences(client: SupabaseClient, signal: AbortSignal) {
  const categories = await client.from('categories').select('id,name_uz').abortSignal(signal);
  if (categories.error || !Array.isArray(categories.data)) throw new Error('Reference categories unavailable');
  const names = new Map(categories.data.map(row => [row.id, row.name_uz]));
  const professions = new Map<number, Profession>(), pending = Array.from({ length: 16 }, (_, index) => index);
  let rowsRead = 0, stopped = false;
  const workers = await Promise.allSettled(Array.from({ length: 4 }, async () => {
    try {
      while (pending.length && !stopped) {
        const bucket = pending.shift()!;
        let cursor: string | null = null;
        for (;;) {
          if (stopped) return;
          let query = client.from('jobs').select('id,category_id,position:raw_source_json->mmk_position,position_id:raw_source_json->mmk_position_id,field_title:raw_source_json->field_title')
            .eq('source', 'osonish').gte('id', `${bucket.toString(16)}0000000-0000-0000-0000-000000000000`).order('id').limit(500);
          if (bucket < 15) query = query.lt('id', `${(bucket + 1).toString(16)}0000000-0000-0000-0000-000000000000`);
          if (cursor) query = query.gt('id', cursor);
          const result = await query.abortSignal(signal);
          if (result.error || !Array.isArray(result.data)) throw new Error('Profession projection unavailable');
          rowsRead += result.data.length;
          if (rowsRead > 200000) throw new Error('Profession scan exceeds supported size');
          for (const row of result.data as any[]) {
            const id = idOf(row.position?.id ?? row.position_id);
            const title = row.position?.position_name || row.position?.name || row.field_title;
            if (!id || typeof title !== 'string' || !title.trim()) continue;
            const existing = professions.get(id);
            if (existing) existing.vacancies_count++;
            else professions.set(id, { id, title_uz: title.trim().slice(0, 500), category_id: row.category_id || null, category_title: names.get(row.category_id) || null, vacancies_count: 1 });
          }
          if (result.data.length < 500) break;
          const next = result.data.at(-1)!.id;
          if (cursor && next <= cursor) throw new Error('Invalid profession cursor');
          cursor = next;
        }
      }
    } catch (error) { stopped = true; throw error; }
  }));
  const failed = workers.find(result => result.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
  const now = new Date().toISOString(), rows = Array.from(professions.values());
  for (let index = 0; index < rows.length; index += 250) {
    const result = await client.from('osonish_professions').upsert(rows.slice(index, index + 250).map(row => ({ ...row, source: 'osonish', last_seen_at: now })), { onConflict: 'id' }).abortSignal(signal);
    if (result.error) throw new Error('Profession sync unavailable');
  }
  return { importedJobs: rowsRead, professions: rows.length };
}
