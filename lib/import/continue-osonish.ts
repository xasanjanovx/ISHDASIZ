import type { ImportProgress } from "./progress";

type Dependencies = {
  read: () => Promise<ImportProgress | null>;
  step: (runId: string) => Promise<ImportProgress>;
  now?: () => number;
};
/** Continue one existing run within a Vercel request. Never starts a new cycle. */
export async function continueOsonishImport({
  read,
  step,
  now = Date.now,
}: Dependencies): Promise<ImportProgress | null> {
  const deadline = now() + 250000;
  let progress = await read();
  if (!progress) return null;
  const runId = progress.id;
  for (let steps = 0; steps < 8 && now() + 35000 < deadline; steps++) {
    if (progress.state !== "running" || progress.busy) break;
    if (
      progress.phase === "details" &&
      progress.next_retry_at !== null &&
      Date.parse(progress.next_retry_at) > now()
    )
      break;
    const before = JSON.stringify(progress);
    const next = await step(runId);
    if (next.id !== runId) throw new Error("Import run changed");
    progress = next;
    if (JSON.stringify(progress) === before || progress.last_error !== null)
      break;
  }
  return progress;
}

/** The five-minute scheduler also starts the next refresh after the DB cooldown.
 * The database claim decides atomically whether to reuse, lease or create a run.
 * An in-flight run always remains pinned; no parallel full scans are started. */
export async function refreshOsonishImport({
  read,
  step,
  start,
  now = Date.now,
}: Dependencies & {
  start: () => Promise<ImportProgress>;
}): Promise<ImportProgress | null> {
  const current = await read();
  if (current?.state === "running")
    return continueOsonishImport({ read: async () => current, step, now });
  if (current && now() - Date.parse(current.started_at) < 6 * 60 * 60 * 1000)
    return current;
  const claimed = await start();
  return continueOsonishImport({ read: async () => claimed, step, now });
}
