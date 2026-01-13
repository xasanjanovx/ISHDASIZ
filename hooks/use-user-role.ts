'use client';

import { useState, useEffect, useCallback } from 'react';

export type UserRole = 'employer' | 'seeker' | null;

const STORAGE_KEY = 'ishdasiz_user_role';

interface UseUserRoleReturn {
    role: UserRole;
    setRole: (role: UserRole) => void;
    clearRole: () => void;
    isLoading: boolean;
}

/**
 * Hook to manage user role selection stored in localStorage
 * Handles hydration safely by returning loading state initially
 */
export function useUserRole(): UseUserRoleReturn {
    const [role, setRoleState] = useState<UserRole>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Read from localStorage on mount (client-side only)
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored === 'employer' || stored === 'seeker') {
                setRoleState(stored);
            }
        } catch (e) {
            console.warn('Failed to read user role from localStorage:', e);
        }
        setIsLoading(false);
    }, []);

    const setRole = useCallback((newRole: UserRole) => {
        try {
            if (newRole) {
                localStorage.setItem(STORAGE_KEY, newRole);
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
            setRoleState(newRole);
        } catch (e) {
            console.warn('Failed to save user role to localStorage:', e);
        }
    }, []);

    const clearRole = useCallback(() => {
        try {
            localStorage.removeItem(STORAGE_KEY);
            setRoleState(null);
        } catch (e) {
            console.warn('Failed to clear user role from localStorage:', e);
        }
    }, []);

    return { role, setRole, clearRole, isLoading };
}
