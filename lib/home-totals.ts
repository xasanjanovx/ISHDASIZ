import type { SupabaseClient } from "@supabase/supabase-js";

// Server-only caller: private tables provide exact HEAD counts, never account or archived-job rows.
// These closed states are disjoint from the public availability predicate. Drafts/deleted local
// publications are excluded; an archived source record must have been locally published.
export const HOME_ARCHIVE_FILTER = "status.in.(archived,closed,filled,inactive),and(source_status.in.(filled,removed_at_source,archived,inactive,closed),or(status.is.null,status.in.(active,published,open)))";
const validCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export async function loadHomeTotals(client: SupabaseClient) {
  const read = async (query: PromiseLike<{ count: number | null; error: unknown }>) => {
    try { const result = await query; return !result.error && validCount(result.count) ? result.count : null; }
    catch { return null; }
  };
  const [totalUsers, archivedJobs] = await Promise.all([
    read(client.from("users").select("id", { count: "exact", head: true }).abortSignal(AbortSignal.timeout(15000))),
    read(client.from("jobs").select("id", { count: "exact", head: true }).or(HOME_ARCHIVE_FILTER).abortSignal(AbortSignal.timeout(15000))),
  ]);
  return { totalUsers, archivedJobs };
}
