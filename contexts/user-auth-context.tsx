'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { accountApi } from '@/lib/account-api';
import { authenticateWithTelegram, type TelegramAuthResult } from '@/lib/telegram-webapp';

export type UserRole = 'job_seeker' | 'employer';

interface UserProfile {
    id: string;
    phone: string;
    active_role: UserRole;
    has_job_seeker_profile: boolean;
    has_employer_profile: boolean;
    full_name?: string;
    company_name?: string;
    is_verified?: boolean;
    expires_at?: number; // 30-day expiry timestamp
}

interface UserAuthContextType {
    user: UserProfile | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (userData: UserProfile) => void;
    loginWithTelegram: (signal?: AbortSignal) => Promise<TelegramAuthResult>;
    logout: () => Promise<void>;
    closeAccount: () => Promise<void>;
    updateProfile: (data: Partial<UserProfile>) => void;
    switchRole: (role: UserRole) => void;
    canSwitchRole: () => boolean;
    getOtherRole: () => UserRole | null;
}

const UserAuthContext = createContext<UserAuthContextType | undefined>(undefined);

const STORAGE_KEY = 'ishdasiz_user';
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function UserAuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const authRevision = useRef(0);
    const telegramRequest = useRef<AbortController | null>(null);
    const invalidateAuth = useCallback(() => { telegramRequest.current?.abort(); telegramRequest.current = null; return ++authRevision.current; }, []);
    useEffect(() => () => { telegramRequest.current?.abort(); }, []);

    // The server cookie establishes identity; local storage only remembers the active role.
    useEffect(() => {
        let cancelled = false;
        const revision = authRevision.current;
        const restore = async () => {
            try {
                const response = await fetch('/api/auth/session', { cache: 'no-store' });
                if (!response.ok) return;
                const data = await response.json();
                if (!data.user || cancelled || authRevision.current !== revision) return;
                let activeRole = data.user.active_role;
                try {
                    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
                    if (saved?.id === data.user.id &&
                        ((saved.active_role === 'employer' && data.user.has_employer_profile) ||
                         (saved.active_role === 'job_seeker' && data.user.has_job_seeker_profile))) {
                        activeRole = saved.active_role;
                    }
                } catch { /* Storage is optional. */ }
                setUser({ ...data.user, active_role: activeRole, expires_at: data.expiresAt });
            } catch (error) {
                console.error('Failed to restore session:', error);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        restore();
        return () => { cancelled = true; };
    }, []);

    // Save user to localStorage whenever it changes
    useEffect(() => {
        if (isLoading) return;
        try {
        if (user) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
        } catch { /* Private browsing may disable storage. */ }
    }, [user, isLoading]);

    // Browser timers have a 32-bit delay limit; expire long sessions in chunks.
    useEffect(() => {
        if (!user?.expires_at) return;
        const { id, expires_at } = user;
        let timer: ReturnType<typeof setTimeout>;
        const schedule = () => {
            timer = setTimeout(() => {
                if (Date.now() >= expires_at) setUser(current => current?.id === id ? null : current);
                else schedule();
            }, Math.min(2_147_483_647, Math.max(0, expires_at - Date.now())));
        };
        schedule();
        return () => clearTimeout(timer);
    }, [user]);

    const login = useCallback((userData: UserProfile) => {
        invalidateAuth();
        const userWithExpiry: UserProfile = {
            ...userData,
            active_role: userData.active_role || (userData as UserProfile & { role?: UserRole }).role || 'job_seeker',
            expires_at: Date.now() + SESSION_DURATION_MS
        };
        setUser(userWithExpiry);
        setIsLoading(false);
    }, [invalidateAuth]);

    const loginWithTelegram = useCallback(async (signal?: AbortSignal): Promise<TelegramAuthResult> => {
        const revision = invalidateAuth(), controller = new AbortController();
        telegramRequest.current = controller;
        const abort = () => controller.abort();
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) controller.abort();
        try {
            const result = await authenticateWithTelegram(controller.signal);
            if (controller.signal.aborted || authRevision.current !== revision) return { success: false, error: 'cancelled' };
            if (result.success) login(result.user);
            return result;
        } finally {
            signal?.removeEventListener('abort', abort);
            if (telegramRequest.current === controller) telegramRequest.current = null;
        }
    }, [invalidateAuth, login]);

    const logout = useCallback(async () => {
        const revision = invalidateAuth();
        const response = await fetch('/api/auth/session', { method: 'DELETE', cache: 'no-store', credentials: 'same-origin' });
        if (!response.ok) throw new Error('Could not end session');
        if (authRevision.current !== revision) return;
        setUser(null);
        router.push('/');
    }, [router, invalidateAuth]);

    const updateProfile = useCallback((data: Partial<UserProfile>) => {
        setUser(prev => prev ? { ...prev, ...data } : null);
    }, []);

    const closeAccount = useCallback(async () => {
        const revision = ++authRevision.current;
        await accountApi('/api/account/closure', { method: 'POST', body: JSON.stringify({ confirm: true }) });
        if (authRevision.current !== revision) return;
        setUser(null);
        router.push('/');
    }, [router]);

    // Check if user can switch to another role
    const canSwitchRole = useCallback(() => {
        if (!user) return false;
        return user.has_job_seeker_profile && user.has_employer_profile;
    }, [user]);

    // Get the other available role
    const getOtherRole = useCallback((): UserRole | null => {
        if (!user) return null;
        if (!canSwitchRole()) return null;
        return user.active_role === 'job_seeker' ? 'employer' : 'job_seeker';
    }, [user, canSwitchRole]);

    // Switch to another role
    const switchRole = useCallback((role: UserRole) => {
        if (!user) return;

        // Verify user has the profile for this role
        if (role === 'job_seeker' && !user.has_job_seeker_profile) return;
        if (role === 'employer' && !user.has_employer_profile) return;

        setUser(prev => prev ? { ...prev, active_role: role } : null);

        // Navigate to the corresponding profile
        const path = role === 'employer' ? '/profile/employer' : '/profile/job-seeker';
        router.push(path);
    }, [user, router]);

    return (
        <UserAuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                isLoading,
                login,
                loginWithTelegram,
                logout,
                closeAccount,
                updateProfile,
                switchRole,
                canSwitchRole,
                getOtherRole,
            }}
        >
            {children}
        </UserAuthContext.Provider>
    );
}

export function useUserAuth() {
    const context = useContext(UserAuthContext);
    if (!context) {
        throw new Error('useUserAuth must be used within UserAuthProvider');
    }
    return context;
}

// Helper for backward compatibility - get role as simple value
export function getUserRole(user: UserProfile | null): UserRole | null {
    return user?.active_role || null;
}
