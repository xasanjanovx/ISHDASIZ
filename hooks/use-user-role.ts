'use client';
import { useSyncExternalStore } from 'react';
import { createBrowserPreferenceStore } from '@/lib/browser-preference-store';
export type UserRole = 'employer' | 'seeker' | null;
const roles = createBrowserPreferenceStore<UserRole>('ishdasiz_user_role', null, value => value === 'employer' || value === 'seeker' ? value : null, value => value || 'null');
export function useUserRole() {
  const snapshot = useSyncExternalStore(roles.subscribe, roles.getSnapshot, roles.getServerSnapshot);
  return { role: snapshot.value, isLoading: !snapshot.ready, setRole: (role: UserRole) => role === null ? roles.clear() : roles.update(() => role), clearRole: roles.clear };
}
