'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { AdminProfile } from '@/types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  adminProfile: AdminProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const ensureAdminProfile = async (accessToken?: string | null): Promise<AdminProfile | null> => {
    if (!accessToken) return null;
    try {
      const res = await fetch('/api/admin/ensure-profile', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!res.ok) return null;
      const json = await res.json().catch(() => null);
      return (json?.profile as AdminProfile) || null;
    } catch (err) {
      console.error('ensureAdminProfile error:', err);
      return null;
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchAdminProfile(session.user.id, session.access_token);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchAdminProfile(session.user.id, session.access_token);
        } else {
          setAdminProfile(null);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchAdminProfile = async (userId: string, accessToken?: string | null): Promise<AdminProfile | null> => {
    setLoading(true);
    try {
      const { data: localProfile, error: localError } = await supabase
        .from('admin_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (localError) {
        console.warn('fetchAdminProfile local query warning:', localError.message);
      }

      if (localProfile) {
        setAdminProfile(localProfile as AdminProfile);
        return localProfile as AdminProfile;
      }

      const ensuredProfile = await ensureAdminProfile(accessToken);
      if (ensuredProfile) {
        setAdminProfile(ensuredProfile);
        return ensuredProfile;
      }

      // Final fallback in case profile was created but local read is delayed
      const { data: retryData } = await supabase
        .from('admin_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const profile = (retryData as AdminProfile) || null;
      setAdminProfile(profile);
      return profile;
    } catch (err) {
      console.error('fetchAdminProfile error:', err);
      setAdminProfile(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { error: error as Error | null };
    }

    if (data.user) {
      const profile = await fetchAdminProfile(data.user.id, data.session?.access_token);
      if (!profile) {
        await supabase.auth.signOut();
        return { error: new Error('Admin access denied') as Error | null };
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAdminProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, adminProfile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
