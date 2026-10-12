'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { accountApi } from '@/lib/account-api';

type Page = { resumes: any[]; nextCursor: string | null };
type Snapshot = Page & { key: string; error: unknown };
const EMPTY: any[] = [];
export function useResumeCatalog(params: string) {
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [more, setMore] = useState<{ key: string; loading: boolean; error: unknown }>({ key: '', loading: false, error: null });
  const key = `${params}:${revision}`;
  const active = useRef('');
  const latest = useRef<Snapshot | null>(null);
  const lock = useRef('');
  useEffect(() => {
    active.current = key;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      accountApi<Page>(`/api/resumes?${params}`, { signal: controller.signal })
        .then(page => { if (active.current === key) setSnapshot({ ...page, key, error: null }); })
        .catch(error => { if (active.current === key && !controller.signal.aborted) setSnapshot({ key, resumes: [], nextCursor: null, error }); });
    }, 300);
    return () => { active.current = ''; clearTimeout(timer); controller.abort(); };
  }, [key, params]);
  useEffect(() => { latest.current = snapshot; }, [snapshot]);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  const loadMore = useCallback(async () => {
    const current = latest.current;
    if (current?.key !== key || !current.nextCursor || lock.current === key) return;
    lock.current = key; setMore({ key, loading: true, error: null });
    try {
      const query = new URLSearchParams(params); query.set('before', current.nextCursor);
      const page = await accountApi<Page>(`/api/resumes?${query}`);
      if (active.current !== key) return;
      setSnapshot(previous => {
        if (previous?.key !== key) return previous;
        const resumes = new Map(previous.resumes.map(row => [row.id, row]));
        for (const row of page.resumes) if (!resumes.has(row.id)) resumes.set(row.id, row);
        return { ...previous, resumes: Array.from(resumes.values()), nextCursor: page.nextCursor };
      });
      setMore({ key, loading: false, error: null });
    } catch (error) { if (active.current === key) setMore({ key, loading: false, error }); }
    finally { if (lock.current === key) lock.current = ''; }
  }, [key, params]);
  const ready = snapshot?.key === key;
  return { resumes: ready ? snapshot.resumes : EMPTY, nextCursor: ready ? snapshot.nextCursor : null, loading: !ready,
    error: ready ? snapshot.error : null, moreError: more.key === key ? more.error : null,
    loadingMore: more.key === key && more.loading, refresh, loadMore };
}
