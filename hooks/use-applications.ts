'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { accountApi, AccountApiError } from '@/lib/account-api';
import { normalizeApplicationStatus } from '@/lib/application-status';
import type { AccountApplication, ApplicationPage } from '@/lib/application-api';

type Snapshot = ApplicationPage & { key: string; filter: string; error: unknown };
const EMPTY: AccountApplication[] = [];

export function useApplications(userId: string | undefined, role: 'job_seeker' | 'employer', filter = 'all') {
  const [revision, setRevision] = useState(0);
  const key = `${userId || 'guest'}:${role}:${filter}:${revision}`;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [more, setMore] = useState<{ key: string; loading: boolean; error: unknown }>({ key: '', loading: false, error: null });
  const [busy, setBusy] = useState<{ key: string; ids: string[] }>({ key: '', ids: [] });
  const [seenNotice, setSeenNotice] = useState<{ key: string; error: unknown }>({ key: '', error: null });
  const snapshotRef = useRef<Snapshot | null>(null);
  const liveKey = useRef('');
  const busyRef = useRef(new Set<string>());
  const moreRef = useRef('');
  const seenAttempt = useRef(new Set<string>());
  const ready = snapshot?.key === key;
  const loadedLength = ready ? snapshot.applications.length : 0;

  useEffect(() => {
    liveKey.current = key;
    seenAttempt.current.clear();
    if (!userId) return;
    let cancelled = false;
    const controller = new AbortController();
    accountApi<ApplicationPage>(`/api/account/applications?role=${role}&status=${filter}`, { signal: controller.signal })
      .then(result => { if (!cancelled) setSnapshot({ ...result, key, filter, error: null }); })
      .catch(error => { if (!cancelled) setSnapshot({ key, filter, applications: [], stats: null, nextCursor: null, error }); });
    return () => { cancelled = true; if (liveKey.current === key) liveKey.current = ''; controller.abort(); };
  }, [userId, role, filter, key]);
  useEffect(() => { snapshotRef.current = snapshot; }, [snapshot]);

  const refresh = useCallback(() => setRevision(value => value + 1), []);
  const loadMore = useCallback(async () => {
    const current = snapshotRef.current;
    if (current?.key !== key || !current.nextCursor || moreRef.current === key || busyRef.current.size) return;
    moreRef.current = key;
    setMore({ key, loading: true, error: null });
    try {
      const page = await accountApi<ApplicationPage>(`/api/account/applications?role=${role}&status=${filter}&before=${current.nextCursor}`);
      if (liveKey.current !== key) return;
      setSnapshot(previous => {
        if (previous?.key !== key) return previous;
        const applications = new Map(previous.applications.map(row => [row.id, row]));
        for (const row of page.applications) if (!applications.has(row.id)) applications.set(row.id, row);
        return { ...previous, applications: Array.from(applications.values()), nextCursor: page.nextCursor };
      });
      setMore({ key, loading: false, error: null });
    } catch (error) { if (liveKey.current === key) setMore({ key, loading: false, error }); }
    finally { if (moreRef.current === key) moreRef.current = ''; }
  }, [key, role, filter]);

  const patchApplication = useCallback(async (application: AccountApplication, action: 'view' | 'status', status?: string, details?: import('@/lib/application-decision').ApplicationDecisionDetails) => {
    const lock = `${key}:${application.id}`;
    if (busyRef.current.has(lock)) return null;
    busyRef.current.add(lock);
    setBusy(previous => ({ key, ids: [...(previous.key === key ? previous.ids : []), application.id] }));
    try {
      const result = await accountApi<{ application: AccountApplication }>(`/api/account/applications/${application.id}`, { method: 'PATCH', body: JSON.stringify({ action, status, details,
        expected: { status: application.status, responded_at: application.responded_at || null } }) });
      if (liveKey.current !== key) return null;
      const saved = result.application;
      if (!saved || saved.id !== application.id) throw new AccountApiError(503);
      setSnapshot(previous => {
        if (previous?.key !== key) return previous;
        const old = previous.applications.find(row => row.id === saved.id) || application;
        const oldStatus = normalizeApplicationStatus(old.status), newStatus = normalizeApplicationStatus(saved.status);
        const stats = previous.stats && oldStatus !== newStatus ? { ...previous.stats, [oldStatus]: Math.max(0, previous.stats[oldStatus] - 1), [newStatus]: previous.stats[newStatus] + 1 } : previous.stats;
        const applications = previous.applications.map(row => row.id === saved.id ? saved : row)
          .filter(row => previous.filter === 'all' || normalizeApplicationStatus(row.status) === previous.filter);
        return { ...previous, applications, stats };
      });
      window.dispatchEvent(new Event('applicationsRead'));
      return saved;
    } finally {
      busyRef.current.delete(lock);
      if (liveKey.current === key) setBusy(previous => ({ key, ids: previous.ids.filter(id => id !== application.id) }));
    }
  }, [key]);

  useEffect(() => {
    if (!ready || role !== 'job_seeker' || !loadedLength) return;
    let cancelled = false;
    const attempted: string[] = [];
    const attemptedCache = seenAttempt.current;
    const signature = (row: AccountApplication) => `${key}:${row.id}:${row.status}:${row.responded_at || ''}`;
    const markVisible = async () => {
      if (document.visibilityState !== 'visible' || liveKey.current !== key) return;
      const current = snapshotRef.current;
      if (current?.key !== key) return;
      const unread = current.applications.filter(row => !row.is_seen_by_job_seeker && normalizeApplicationStatus(row.status) !== 'pending' && !attemptedCache.has(signature(row)));
      if (!unread.length) return;
      for (const row of unread) { const value = signature(row); attemptedCache.add(value); attempted.push(value); }
      const chunks: AccountApplication[][] = [];
      for (let offset = 0; offset < unread.length; offset += 20) chunks.push(unread.slice(offset, offset + 20));
      const results = await Promise.allSettled(chunks.map(rows => accountApi<{ seen: string[]; changed: string[] }>('/api/account/applications/seen', { method: 'PATCH', body: JSON.stringify({ applications: rows.map(row => ({ id: row.id, status: row.status, responded_at: row.responded_at || null })) }) })));
      if (cancelled || liveKey.current !== key) return;
      const seen = new Set<string>(); let failure: unknown = null;
      for (const result of results) {
        if (result.status === 'rejected') failure = result.reason;
        else { result.value.seen.forEach(id => seen.add(id)); if (result.value.changed.length) failure = new AccountApiError(409); }
      }
      if (seen.size) {
        setSnapshot(previous => previous?.key === key ? { ...previous, applications: previous.applications.map(row => {
          const observed = unread.find(item => item.id === row.id);
          return seen.has(row.id) && observed?.status === row.status && observed.responded_at === row.responded_at ? { ...row, is_seen_by_job_seeker: true } : row;
        }) } : previous);
        window.dispatchEvent(new Event('applicationsRead'));
      }
      setSeenNotice({ key, error: failure });
    };
    void markVisible();
    document.addEventListener('visibilitychange', markVisible);
    return () => { cancelled = true; attempted.forEach(value => attemptedCache.delete(value)); document.removeEventListener('visibilitychange', markVisible); };
  }, [key, role, ready, loadedLength]);

  const busyIds = busy.key === key ? busy.ids : [];
  return { applications: ready ? snapshot.applications : EMPTY, stats: ready ? snapshot.stats : null,
    isLoading: !!userId && !ready, error: ready ? snapshot.error : null,
    notice: more.key === key && more.error || seenNotice.key === key && seenNotice.error || null,
    nextCursor: ready ? snapshot.nextCursor : null, isLoadingMore: more.key === key && more.loading,
    busyIds, refresh, loadMore, patchApplication,
    retry: more.key === key && more.error ? loadMore : refresh };
}
