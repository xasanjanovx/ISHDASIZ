'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
    isTelegramWebApp,
    initTelegramWebApp,
    authenticateWithTelegram,
    getTelegramWebApp
} from '@/lib/telegram-webapp';
import { useAuth } from '@/contexts/auth-context';

interface TelegramContextType {
    isTelegram: boolean;
    user: any;
    isLoading: boolean;
}

const TelegramContext = createContext<TelegramContextType>({
    isTelegram: false,
    user: null,
    isLoading: true
});

export const useTelegram = () => useContext(TelegramContext);

export function TelegramProvider({ children }: { children: React.ReactNode }) {
    const [isTelegram, setIsTelegram] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();
    const { signIn } = useAuth(); // Assuming auth context has a manual sign-in mechanism or we just sync session

    useEffect(() => {
        // Detect Telegram environment
        if (isTelegramWebApp()) {
            setIsTelegram(true);
            initTelegramWebApp();

            // Handle Authentication
            authenticateWithTelegram().then((result) => {
                if (result.success && result.user) {
                    setUser(result.user);
                    // Here you might want to sync with your main app auth state if needed
                    // e.g., set cookie, update global auth context
                }
                setIsLoading(false);
            });

            // Setup Theme
            const webApp = getTelegramWebApp();
            if (webApp) {
                // Ensure header color matches app
                webApp.setHeaderColor(webApp.themeParams.bg_color || '#ffffff');
                webApp.setBackgroundColor(webApp.themeParams.bg_color || '#ffffff');
            }

        } else {
            setIsLoading(false);
        }
    }, []);

    // Handle Native Back Button
    useEffect(() => {
        if (!isTelegram) return;

        const webApp = getTelegramWebApp();
        if (!webApp) return;

        const handleBack = () => {
            router.back();
        };

        if (pathname !== '/') {
            webApp.BackButton.show();
            webApp.BackButton.onClick(handleBack);
        } else {
            webApp.BackButton.hide();
        }

        return () => {
            webApp.BackButton.offClick(handleBack);
        };
    }, [isTelegram, pathname, router]);

    return (
        <TelegramContext.Provider value={{ isTelegram, user, isLoading }}>
            <div className={isTelegram ? 'telegram-app' : ''}>
                {children}
            </div>
        </TelegramContext.Provider>
    );
}
