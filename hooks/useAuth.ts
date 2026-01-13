'use client';

import { useState, useEffect, useCallback } from 'react';

const USER_STORAGE_KEY = 'ishdasiz_user';
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface User {
    id: string;
    phone: string;
    active_role: 'job_seeker' | 'employer';
    has_job_seeker_profile: boolean;
    has_employer_profile: boolean;
    full_name?: string;
    company_name?: string;
    is_verified: boolean;
    expires_at: number;
}

// For backward compatibility
export interface LegacyUser {
    id: string;
    phone: string;
    role: 'job_seeker' | 'employer';
    is_verified: boolean;
    expires_at: number;
}

interface AuthState {
    user: User | null;
    isLoading: boolean;
}

export function useAuth() {
    const [state, setState] = useState<AuthState>({
        user: null,
        isLoading: true
    });

    // Load user from localStorage on mount
    useEffect(() => {
        const storedUser = localStorage.getItem(USER_STORAGE_KEY);
        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser);
                // Handle both old and new format
                const user: User = {
                    id: parsed.id,
                    phone: parsed.phone,
                    active_role: parsed.active_role || parsed.role || 'job_seeker',
                    has_job_seeker_profile: parsed.has_job_seeker_profile ?? (parsed.role === 'job_seeker'),
                    has_employer_profile: parsed.has_employer_profile ?? (parsed.role === 'employer'),
                    full_name: parsed.full_name,
                    company_name: parsed.company_name,
                    is_verified: parsed.is_verified,
                    expires_at: parsed.expires_at
                };

                // Check if session expired
                if (Date.now() < user.expires_at) {
                    setState({ user, isLoading: false });
                } else {
                    // Session expired - clear
                    localStorage.removeItem(USER_STORAGE_KEY);
                    setState({ user: null, isLoading: false });
                }
            } catch (e) {
                localStorage.removeItem(USER_STORAGE_KEY);
                setState({ user: null, isLoading: false });
            }
        } else {
            setState({ user: null, isLoading: false });
        }
    }, []);

    // Login - save user to localStorage
    const login = useCallback((userData: Omit<User, 'expires_at'>) => {
        const user: User = {
            ...userData,
            expires_at: Date.now() + SESSION_DURATION_MS
        };
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
        setState({ user, isLoading: false });
    }, []);

    // Logout - clear localStorage
    const logout = useCallback(() => {
        localStorage.removeItem(USER_STORAGE_KEY);
        setState({ user: null, isLoading: false });
    }, []);

    // Get current user
    const getCurrentUser = useCallback((): User | null => {
        return state.user;
    }, [state.user]);

    // Check if logged in
    const isLoggedIn = useCallback((): boolean => {
        return state.user !== null && Date.now() < (state.user.expires_at || 0);
    }, [state.user]);

    // Get role (for backward compatibility)
    const getRole = useCallback((): string | null => {
        return state.user?.active_role || null;
    }, [state.user]);

    return {
        user: state.user,
        isLoading: state.isLoading,
        login,
        logout,
        getCurrentUser,
        isLoggedIn,
        getRole
    };
}

// Standalone functions for use outside React components
export function getCurrentUserSync(): User | null {
    if (typeof window === 'undefined') return null;

    const storedUser = localStorage.getItem(USER_STORAGE_KEY);
    if (!storedUser) return null;

    try {
        const parsed = JSON.parse(storedUser);
        const user: User = {
            id: parsed.id,
            phone: parsed.phone,
            active_role: parsed.active_role || parsed.role || 'job_seeker',
            has_job_seeker_profile: parsed.has_job_seeker_profile ?? (parsed.role === 'job_seeker'),
            has_employer_profile: parsed.has_employer_profile ?? (parsed.role === 'employer'),
            full_name: parsed.full_name,
            company_name: parsed.company_name,
            is_verified: parsed.is_verified,
            expires_at: parsed.expires_at
        };

        if (Date.now() < user.expires_at) {
            return user;
        }
        localStorage.removeItem(USER_STORAGE_KEY);
        return null;
    } catch {
        return null;
    }
}

export function isLoggedInSync(): boolean {
    return getCurrentUserSync() !== null;
}

export function logoutSync(): void {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(USER_STORAGE_KEY);
    }
}
