"use client";
import { createContext, useContext, useEffect, useState } from 'react';
import { validHomeOverview, type HomeOverview } from '@/lib/home-overview-types';

const Context = createContext<HomeOverview | null>(null);
export const useHomeOverview = () => useContext(Context);
export function HomeOverviewProvider({ initial, children }: { initial: HomeOverview | null; children: React.ReactNode }) {
  const [recovered, setRecovered] = useState<HomeOverview | null>(null);
  useEffect(() => {
    if (typeof window.fetch !== 'function') return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let attempt = 0;
    const read = async () => {
      if (document.visibilityState === 'hidden') { timer = setTimeout(read, 30000); return; }
      try {
        const response = await fetch('/api/home/overview', { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Overview unavailable');
        const { overview } = await response.json();
        if (!validHomeOverview(overview)) throw new Error('Overview unavailable');
        if (!controller.signal.aborted) { setRecovered(overview); attempt = 0; timer = setTimeout(read, 60000); }
      } catch {
        if (!controller.signal.aborted) timer = setTimeout(read, Math.min(60000, 3000 * Math.pow(2, attempt++)));
      }
    };
    if (initial) timer = setTimeout(read, 60000);
    else void read();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [initial]);
  const current = initial && (!recovered || Date.parse(initial.asOf) >= Date.parse(recovered.asOf)) ? initial : recovered;
  return <Context.Provider value={current}>{children}</Context.Provider>;
}
