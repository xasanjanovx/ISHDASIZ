'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { jobCatalogQuery, readJobFilters } from '@/lib/job-catalog';

type Snapshot = { key: string; jobs: any[]; count: number; error: boolean };
const EMPTY: any[] = [];
export function useJobCatalog(params: string) {
  const [revision, setRevision] = useState(0), [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const key = JSON.stringify([params, revision]);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const result = await jobCatalogQuery(supabase, readJobFilters(params)).abortSignal(controller.signal);
        if (result.error || !Array.isArray(result.data) || result.count == null) throw new Error('Catalog unavailable');
        if (!cancelled) setSnapshot({ key, jobs: result.data, count: result.count, error: false });
      } catch { if (!cancelled) setSnapshot({ key, jobs: [], count: 0, error: true }); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); controller.abort(); };
  }, [params, key]);
  const current = snapshot?.key === key ? snapshot : null;
  return { jobs: current?.jobs || EMPTY, totalCount: current?.count ?? null, loading: !current, loadError: Boolean(current?.error), refresh: () => setRevision(value => value + 1) };
}
