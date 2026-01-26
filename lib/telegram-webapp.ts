// Telegram WebApp Integration
// Detects if running inside Telegram and handles authentication

declare global {
    interface Window {
        Telegram?: {
            WebApp: TelegramWebApp;
        };
    }
}

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

export async function authenticateWithTelegram(): Promise<{
    success: boolean;
    user?: any;
    error?: string;
}> {
    const initData = getTelegramInitData();
    if (!initData) {
        return { success: false, error: 'Not in Telegram WebApp' };
    }

    try {
        const response = await fetch('/api/telegram/webapp-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData })
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error || 'Auth failed' };
        }

        return { success: true, user: data.user };
    } catch (error) {
        console.error('Telegram auth error:', error);
        return { success: false, error: 'Network error' };
    }
}

export function initTelegramWebApp() {
    const webApp = getTelegramWebApp();
    if (!webApp) return;

    // Tell Telegram the app is ready
    webApp.ready();

    // Expand to full height
    webApp.expand();

    // Apply theme
    applyTelegramTheme();
}
