'use client';
import { useEffect, useState } from 'react';

type Snapshot = { key: string; jobs: any[]; count: number; error: boolean };
const EMPTY: any[] = [];
export function useJobCatalog(params: string) {
  const [revision, setRevision] = useState(0), [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const key = JSON.stringify([params, revision]);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let retries = 0;
    const read = async () => {
      let retryable = false;
      try {
        const response = await fetch('/api/jobs' + (params ? '?' + params : ''), { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) {
          retryable = response.status === 429 || response.status >= 500;
          throw new Error('Catalog unavailable');
        }
        const result = await response.json();
        if (!Array.isArray(result.data) || !Number.isSafeInteger(result.count) || result.count < 0) throw new Error('Catalog unavailable');
        if (!cancelled) setSnapshot({ key, jobs: result.data, count: result.count, error: false });
      } catch (error) {
        if (cancelled) return;
        if ((retryable || error instanceof TypeError) && retries < 2) {
          timer = setTimeout(read, 800 * Math.pow(2, retries++));
        } else setSnapshot({ key, jobs: [], count: 0, error: true });
      }
    };
    timer = setTimeout(read, 300);
    return () => { cancelled = true; clearTimeout(timer); controller.abort(); };
  }, [params, key]);
  const current = snapshot?.key === key ? snapshot : null;
  return { jobs: current?.jobs || EMPTY, totalCount: current?.count ?? null, loading: !current, loadError: Boolean(current?.error), refresh: () => setRevision(value => value + 1) };
}
