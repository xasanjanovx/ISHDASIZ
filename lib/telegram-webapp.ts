// Telegram WebApp Integration
// Detects if running inside Telegram and handles authentication

declare global {
    interface Window {
        Telegram?: {
            WebApp: TelegramWebApp;
        };
    }
}

interface TelegramInsets { top: number; bottom: number; left: number; right: number }

interface TelegramWebApp {
    initData: string;
    initDataUnsafe: {
        user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
        };
        auth_date: number;
        hash: string;
    };
    version: string;
    platform: string;
    colorScheme: 'light' | 'dark';
    themeParams: {
        bg_color?: string;
        text_color?: string;
        hint_color?: string;
        link_color?: string;
        button_color?: string;
        button_text_color?: string;
        secondary_bg_color?: string;
    };
    isExpanded: boolean;
    viewportHeight: number;
    viewportStableHeight: number;
    isFullscreen?: boolean;
    safeAreaInset?: TelegramInsets;
    contentSafeAreaInset?: TelegramInsets;
    isVersionAtLeast?(version: string): boolean;
    requestFullscreen?(): void;
    onEvent?(event: string, callback: () => void): void;
    offEvent?(event: string, callback: () => void): void;
    MainButton: {
        text: string;
        color: string;
        textColor: string;
        isVisible: boolean;
        isActive: boolean;
        isProgressVisible: boolean;
        setText(text: string): void;
        onClick(callback: () => void): void;
        offClick(callback: () => void): void;
        show(): void;
        hide(): void;
        enable(): void;
        disable(): void;
        showProgress(leaveActive?: boolean): void;
        hideProgress(): void;
    };
    BackButton: {
        isVisible: boolean;
        onClick(callback: () => void): void;
        offClick(callback: () => void): void;
        show(): void;
        hide(): void;
    };
    setHeaderColor(color: string): void;
    setBackgroundColor(color: string): void;
    ready(): void;
    expand(): void;
    close(): void;
}

export function isTelegramWebApp(): boolean {
    if (typeof window === 'undefined') return false;
    return !!window.Telegram?.WebApp?.initData;
}

export function getTelegramWebApp(): TelegramWebApp | null {
    if (typeof window === 'undefined') return null;
    return window.Telegram?.WebApp || null;
}

export function getTelegramUser() {
    const webApp = getTelegramWebApp();
    if (!webApp) return null;
    return webApp.initDataUnsafe.user || null;
}

export function getTelegramInitData(): string | null {
    const webApp = getTelegramWebApp();
    if (!webApp) return null;
    return webApp.initData || null;
}

export function applyTelegramTheme() {
    const webApp = getTelegramWebApp();
    if (!webApp) return;

    const { themeParams } = webApp;
    if (!themeParams) return;

    // Apply Telegram theme colors to CSS variables
    const root = document.documentElement;
    if (themeParams.bg_color) {
        root.style.setProperty('--tg-bg-color', themeParams.bg_color);
    }
    if (themeParams.text_color) {
        root.style.setProperty('--tg-text-color', themeParams.text_color);
    }
    if (themeParams.button_color) {
        root.style.setProperty('--tg-button-color', themeParams.button_color);
    }
    if (themeParams.secondary_bg_color) {
        root.style.setProperty('--tg-secondary-bg-color', themeParams.secondary_bg_color);
    }
}

export type TelegramAuthResult = { success: true; user: TelegramAccount } | { success: false; error: 'link' | 'closed' | 'expired' | 'conflict' | 'unavailable' | 'cancelled' };
export interface TelegramAccount {
    id: string; phone: string; active_role: 'job_seeker' | 'employer';
    has_job_seeker_profile: boolean; has_employer_profile: boolean;
    full_name?: string; company_name?: string; is_verified?: boolean;
}
export async function authenticateWithTelegram(signal?: AbortSignal): Promise<TelegramAuthResult> {
    const initData = getTelegramInitData();
    if (!initData) return { success: false, error: 'unavailable' };
    try {
        const response = await fetch('/api/telegram/webapp-auth', {
            method: 'POST', cache: 'no-store', credentials: 'same-origin', signal,
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData }),
        });
        const data = await response.json();
        if (signal?.aborted) return { success: false, error: 'cancelled' };
        if (!response.ok) return { success: false, error: data?.account_conflict ? 'conflict' : data?.requires_link ? 'link' : data?.needsRestoration ? 'closed' : response.status === 401 ? 'expired' : 'unavailable' };
        const user = data?.user;
        if (data?.success !== true || !user || typeof user.id !== 'string' || !user.id || typeof user.phone !== 'string'
            || !['job_seeker', 'employer'].includes(user.active_role) || typeof user.has_job_seeker_profile !== 'boolean' || typeof user.has_employer_profile !== 'boolean') {
            return { success: false, error: 'unavailable' };
        }
        return { success: true, user };
    } catch {
        return { success: false, error: signal?.aborted ? 'cancelled' : 'unavailable' };
    }
}

// The SDK script is async; subscribe to its load event as well as the initial snapshot.
export function subscribeTelegram(listener: () => void) {
    const script = document.querySelector('script[src="https://telegram.org/js/telegram-web-app.js"]');
    script?.addEventListener('load', listener);
    window.addEventListener('pageshow', listener);
    return () => { script?.removeEventListener('load', listener); window.removeEventListener('pageshow', listener); };
}

export function initTelegramWebApp() {
    const webApp = getTelegramWebApp();
    if (!webApp?.initData) return;
    // Each native call is independent: failure must not interrupt startup or login.
    const safely = (action: () => void) => { try { action(); } catch { /* Unsupported host API. */ } };
    const root = document.documentElement;
    const syncInsets = () => {
        for (const side of ['top', 'bottom', 'left', 'right'] as const) {
            const system = Math.max(0, Number(webApp.safeAreaInset?.[side]) || 0);
            const content = Math.max(0, Number(webApp.contentSafeAreaInset?.[side]) || 0);
            root.style.setProperty(`--ish-telegram-${side}`, `${system + content}px`);
        }
    };
    const fallback = () => { safely(() => webApp.expand()); syncInsets(); };
    const events: Array<[string, () => void]> = [
        ['safeAreaChanged', syncInsets], ['contentSafeAreaChanged', syncInsets],
        ['fullscreenChanged', syncInsets], ['viewportChanged', syncInsets],
        ['fullscreenFailed', fallback],
    ];
    syncInsets();
    for (const [event, handler] of events) safely(() => webApp.onEvent?.(event, handler));
    safely(() => webApp.ready());
    safely(() => webApp.expand());
    safely(() => {
        const supported = webApp.isVersionAtLeast
            ? webApp.isVersionAtLeast('8.0') : parseFloat(webApp.version) >= 8;
        if (supported && !webApp.isFullscreen) webApp.requestFullscreen?.();
    });
    safely(applyTelegramTheme);
    return () => {
        for (const [event, handler] of events) safely(() => webApp.offEvent?.(event, handler));
        for (const side of ['top', 'bottom', 'left', 'right']) root.style.removeProperty(`--ish-telegram-${side}`);
    };
}
