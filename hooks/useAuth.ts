'use client';

import { useCallback } from 'react';
import { useUserAuth } from '@/contexts/user-auth-context';

export type User = NonNullable<ReturnType<typeof useUserAuth>['user']>;

/** Compatibility adapter: all consumers share the server-restored session. */
export function useAuth() {
  const { user, isLoading, isAuthenticated, login, logout } = useUserAuth();
  const getCurrentUser = useCallback(() => user, [user]);
  const isLoggedIn = useCallback(() => isAuthenticated, [isAuthenticated]);
  const getRole = useCallback(() => user?.active_role || null, [user]);
  return { user, isLoading, login, logout, getCurrentUser, isLoggedIn, getRole };
}
