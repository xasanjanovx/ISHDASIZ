'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isTelegramWebApp, initTelegramWebApp, getTelegramWebApp, subscribeTelegram, type TelegramAuthResult } from '@/lib/telegram-webapp';
import { useUserAuth } from '@/contexts/user-auth-context';

type TelegramError = Exclude<TelegramAuthResult, { success: true }>['error'] | null;
const TelegramContext = createContext({ isTelegram: false, user: null as ReturnType<typeof useUserAuth>['user'], isLoading: false, error: null as TelegramError, retry: () => {} });
export const useTelegram = () => useContext(TelegramContext);

export function TelegramProvider({ children }: { children: React.ReactNode }) {
    const isTelegram = useSyncExternalStore(subscribeTelegram, isTelegramWebApp, () => false);
    const { user, isLoading: restoring, loginWithTelegram } = useUserAuth();
    const [state, setState] = useState<{ loading: boolean; error: TelegramError }>({ loading: false, error: null });
    const [attempt, setAttempt] = useState(0);
    const attempted = useRef(false), mounted = useRef(false), generation = useRef(0);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const router = useRouter(), pathname = usePathname();
    const retry = useCallback(() => { attempted.current = false; setAttempt(value => value + 1); }, []);

    useEffect(() => {
        if (!isTelegram) return;
        const cleanup = initTelegramWebApp();
        try {
            const app = getTelegramWebApp(); app?.setHeaderColor('#ffffff'); app?.setBackgroundColor('#f8fafc');
        } catch { /* An unsupported native method must not prevent ordinary navigation. */ }
        return cleanup;
    }, [isTelegram]);

    useEffect(() => {
        if (!isTelegram || restoring || user || attempted.current) return;
        const controller = new AbortController(), revision = ++generation.current; let cancelled = false;
        queueMicrotask(async () => {
            if (cancelled || attempted.current) return;
            attempted.current = true; setState({ loading: true, error: null });
            const result = await loginWithTelegram(controller.signal);
            if (!mounted.current || revision !== generation.current) return;
            setState({ loading: false, error: result.success || result.error === 'cancelled' ? null : result.error });
        });
        return () => { cancelled = true; controller.abort(); };
    }, [isTelegram, restoring, user, attempt, loginWithTelegram]);

    useEffect(() => {
        if (!isTelegram) return;
        const app = getTelegramWebApp(); if (!app) return;
        const back = () => router.back();
        try { if (pathname !== '/') { app.BackButton.show(); app.BackButton.onClick(back); } else app.BackButton.hide(); } catch { /* Native navigation is optional. */ }
        return () => { try { app.BackButton.offClick(back); app.BackButton.hide(); } catch { /* Native navigation is optional. */ } };
    }, [isTelegram, pathname, router]);

    return <TelegramContext.Provider value={{ isTelegram, user, isLoading: isTelegram && !user && (restoring || state.loading), error: user ? null : state.error, retry }}><div className={isTelegram ? 'telegram-app' : ''}>{children}</div></TelegramContext.Provider>;
}
