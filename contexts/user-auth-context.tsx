'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

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
    logout: () => void;
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

    // Load user from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed: UserProfile = JSON.parse(stored);
                // Check if session expired
                if (parsed.expires_at && Date.now() < parsed.expires_at) {
                    setUser(parsed);
                } else {
                    // Session expired - clear
                    localStorage.removeItem(STORAGE_KEY);
                }
            }
        } catch (e) {
            console.error('Failed to load user from storage:', e);
            localStorage.removeItem(STORAGE_KEY);
        }
        setIsLoading(false);
    }, []);

    // Save user to localStorage whenever it changes
    useEffect(() => {
        if (user) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, [user]);

    const login = useCallback((userData: UserProfile) => {
        const userWithExpiry: UserProfile = {
            ...userData,
            expires_at: Date.now() + SESSION_DURATION_MS
        };
        setUser(userWithExpiry);
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        router.push('/');
    }, [router]);

    const updateProfile = useCallback((data: Partial<UserProfile>) => {
        setUser(prev => prev ? { ...prev, ...data } : null);
    }, []);

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
                isAuthenticated: !!user && (!user.expires_at || Date.now() < user.expires_at),
                isLoading,
                login,
                logout,
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
