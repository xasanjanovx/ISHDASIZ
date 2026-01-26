'use client';

/**
 * Session Context - Frontend session management
 * 
 * Uses sessionStorage to persist session_id and profile
 * until tab is closed. Syncs with backend Supabase storage.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface UserProfile {
    category?: string;
    category_id?: string;
    skills?: string[];
    experience_years?: number;
    salary_min?: number;
    region?: string;
    region_id?: number;
    work_mode?: 'remote' | 'onsite' | 'any';
    exclude_keywords?: string[];
    profile_complete?: boolean;
}

interface UserLocation {
    lat: number;
    lng: number;
}

interface SessionContextType {
    sessionId: string;
    profile: UserProfile;
    userLocation: UserLocation | null;
    updateProfile: (updates: Partial<UserProfile>) => void;
    setUserLocation: (location: UserLocation | null) => void;
    resetSession: () => void;
    requestLocation: () => Promise<UserLocation | null>;
}

// ============================================================================
// CONTEXT
// ============================================================================

const SessionContext = createContext<SessionContextType | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

export function SessionProvider({ children }: { children: ReactNode }) {
    const [sessionId, setSessionId] = useState<string>('');
    const [profile, setProfile] = useState<UserProfile>({});
    const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
    const [isClient, setIsClient] = useState(false);

    // Initialize on client only
    useEffect(() => {
        setIsClient(true);

        // Load or create session
        const stored = sessionStorage.getItem('ishdasiz_session');
        if (stored) {
            try {
                const data = JSON.parse(stored);
                setSessionId(data.session_id || generateSessionId());
                setProfile(data.profile || {});
                if (data.user_location) {
                    setUserLocation(data.user_location);
                }
            } catch {
                const newId = generateSessionId();
                setSessionId(newId);
                sessionStorage.setItem('ishdasiz_session', JSON.stringify({ session_id: newId, profile: {} }));
            }
        } else {
            const newId = generateSessionId();
            setSessionId(newId);
            sessionStorage.setItem('ishdasiz_session', JSON.stringify({ session_id: newId, profile: {} }));
        }
    }, []);

    // Save to sessionStorage whenever profile changes
    useEffect(() => {
        if (isClient && sessionId) {
            sessionStorage.setItem('ishdasiz_session', JSON.stringify({
                session_id: sessionId,
                profile,
                user_location: userLocation
            }));
        }
    }, [isClient, sessionId, profile, userLocation]);

    const updateProfile = useCallback((updates: Partial<UserProfile>) => {
        setProfile(prev => ({ ...prev, ...updates }));
    }, []);

    const resetSession = useCallback(() => {
        const newId = generateSessionId();
        setSessionId(newId);
        setProfile({});
        setUserLocation(null);
        sessionStorage.setItem('ishdasiz_session', JSON.stringify({ session_id: newId, profile: {} }));
    }, []);

    const requestLocation = useCallback(async (): Promise<UserLocation | null> => {
        if (!navigator.geolocation) {
            console.log('[Geo] Geolocation not supported');
            return null;
        }

        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    setUserLocation(location);
                    resolve(location);
                },
                (error) => {
                    console.log('[Geo] Error:', error.message);
                    resolve(null);
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });
    }, []);

    // Don't render until client-side hydration
    if (!isClient) {
        return <>{children}</>;
    }

    return (
        <SessionContext.Provider value={{
            sessionId,
            profile,
            userLocation,
            updateProfile,
            setUserLocation,
            resetSession,
            requestLocation
        }}>
            {children}
        </SessionContext.Provider>
    );
}

// ============================================================================
// HOOK
// ============================================================================

export function useSession(): SessionContextType {
    const context = useContext(SessionContext);
    if (!context) {
        // Return safe defaults if not in provider
        return {
            sessionId: '',
            profile: {},
            userLocation: null,
            updateProfile: () => { },
            setUserLocation: () => { },
            resetSession: () => { },
            requestLocation: async () => null
        };
    }
    return context;
}

// ============================================================================
// UTILS
// ============================================================================

function generateSessionId(): string {
    return 'sess_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}
