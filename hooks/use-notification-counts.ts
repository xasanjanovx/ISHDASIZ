'use client';

import { useEffect, useState } from 'react';
import { accountApi } from '@/lib/account-api';

interface Counts { messages: number; applications: number }
const EMPTY: Counts = { messages: 0, applications: 0 };

export function useNotificationCounts(userId: string | undefined, role: 'job_seeker' | 'employer') {
  const key = userId ? `${userId}:${role}` : '';
  const [snapshot, setSnapshot] = useState<{ key: string; counts: Counts }>({ key: '', counts: EMPTY });
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let sequence = 0;
    let controller: AbortController | undefined;
    const refresh = async () => {
      const current = ++sequence;
      controller?.abort();
      controller = new AbortController();
      try {
        const counts = await accountApi<Counts>(`/api/account/notifications?role=${role}`, { signal: controller.signal });
        if (!cancelled && current === sequence) setSnapshot({ key: `${userId}:${role}`, counts });
      } catch { /* Badges keep their last confirmed count; the next refresh retries. */ }
    };
    const refreshVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    void refresh();
    const timer = setInterval(refreshVisible, 20000);
    window.addEventListener('messagesRead', refresh);
    window.addEventListener('applicationsRead', refresh);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => {
      cancelled = true; controller?.abort(); clearInterval(timer);
      window.removeEventListener('messagesRead', refresh);
      window.removeEventListener('applicationsRead', refresh);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, [userId, role]);
  // A previous account's response can never appear while a new identity is loading.
  return key && snapshot.key === key ? snapshot.counts : EMPTY;
}
