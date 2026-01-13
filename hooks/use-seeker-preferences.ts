'use client';

import { useState, useEffect, useCallback } from 'react';

export interface SeekerPreferences {
    districtId?: string;
    categoryIds?: string[];
    salaryMin?: number;
    latitude?: number;
    longitude?: number;
    geoPermission?: 'granted' | 'denied' | 'pending';
    completedAt?: string;
}

const STORAGE_KEY = 'ishdasiz_seeker_preferences';

interface UseSeekerPreferencesReturn {
    preferences: SeekerPreferences;
    updatePreferences: (updates: Partial<SeekerPreferences>) => void;
    clearPreferences: () => void;
    isCompleted: boolean;
    isLoading: boolean;
}

/**
 * Hook to manage seeker preferences stored in localStorage
 */
export function useSeekerPreferences(): UseSeekerPreferencesReturn {
    const [preferences, setPreferences] = useState<SeekerPreferences>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                setPreferences(JSON.parse(stored));
            }
        } catch (e) {
            console.warn('Failed to read seeker preferences:', e);
        }
        setIsLoading(false);
    }, []);

    const updatePreferences = useCallback((updates: Partial<SeekerPreferences>) => {
        setPreferences((prev) => {
            const next = { ...prev, ...updates };
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch (e) {
                console.warn('Failed to save seeker preferences:', e);
            }
            return next;
        });
    }, []);

    const clearPreferences = useCallback(() => {
        try {
            localStorage.removeItem(STORAGE_KEY);
            setPreferences({});
        } catch (e) {
            console.warn('Failed to clear seeker preferences:', e);
        }
    }, []);

    const isCompleted = !!preferences.completedAt;

    return { preferences, updatePreferences, clearPreferences, isCompleted, isLoading };
}
