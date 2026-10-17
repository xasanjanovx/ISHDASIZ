"use client";

import { useEffect, useState } from 'react';
import { completeHomeStatistics, type HomeStatistics } from '@/lib/home-statistics';

// Recover incomplete ISR data without making every visitor query the database.
export function useHomeStatistics(initial?: HomeStatistics) {
  const [recovered, setRecovered] = useState<HomeStatistics>();
  const needed = !completeHomeStatistics(initial);
  useEffect(() => {
    if (!needed || typeof window.fetch !== 'function') return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let attempt = 0;
    const read = async () => {
      try {
        const response = await fetch('/api/home/stats', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Statistics unavailable');
        const { stats } = await response.json();
        if (!completeHomeStatistics(stats)) throw new Error('Statistics unavailable');
        if (!controller.signal.aborted) setRecovered(stats);
      } catch {
        if (!controller.signal.aborted) {
          timer = setTimeout(read, Math.min(60000, 2000 * Math.pow(2, attempt++)));
        }
      }
    };
    void read();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [needed]);
  return needed && completeHomeStatistics(recovered) ? recovered : initial;
}
