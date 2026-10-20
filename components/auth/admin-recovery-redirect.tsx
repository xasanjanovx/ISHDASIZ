"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

/** Also handles a recovery link when Supabase falls back to the configured Site URL. */
export function AdminRecoveryRedirect() {
  const router = useRouter();
  useEffect(() => {
    const open = () => {
      if (window.location.pathname !== '/admin/reset-password') router.replace('/admin/reset-password' + window.location.hash);
    };
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get('type') === 'recovery' || hash.get('error_code') === 'otp_expired') open();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') queueMicrotask(open);
    });
    return () => subscription.unsubscribe();
  }, [router]);
  return null;
}
