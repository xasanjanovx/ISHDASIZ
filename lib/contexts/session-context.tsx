'use client';

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { useUserAuth } from '@/contexts/user-auth-context';
import { createTabSession } from '@/lib/ai/tab-session';

type Session = ReturnType<ReturnType<typeof createTabSession>['getSnapshot']> & Omit<ReturnType<typeof createTabSession>, 'getSnapshot' | 'getServerSnapshot' | 'subscribe'>;
const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children, owner = 'guest' }: { children: ReactNode; owner?: string }) {
  const store = useMemo(() => createTabSession(owner), [owner]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return <SessionContext.Provider value={{ ...snapshot, ...store }}>{children}</SessionContext.Provider>;
}

export function UserSessionProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useUserAuth();
  const owner = isLoading ? 'pending' : user?.id || 'guest';
  return <SessionProvider owner={owner}>{children}</SessionProvider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used within SessionProvider');
  return context;
}
