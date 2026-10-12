import { chatLocationSchema, chatMessageSchema, readChatProfile, type ChatLocation, type ChatMessage, type ChatProfile } from './chat-contract';

const KEY = 'ishdasiz_session';
const empty = { ready: false, sessionId: '', profile: {} as ChatProfile, userLocation: null as ChatLocation | null, messages: [] as ChatMessage[] };

/** Tab-local search preferences and history. They never establish an authenticated identity. */
export function createTabSession(owner: string) {
  let snapshot = empty, generation = 0, locationRequest = 0;
  const listeners = new Set<() => void>(), pending = new Set<(value: ChatLocation | null) => void>();
  const fresh = () => {
    let id: string;
    try { id = crypto.randomUUID(); }
    catch {
      // Older WebViews may lack randomUUID. This ID is only a local conversation key.
      try { id = Array.from(crypto.getRandomValues(new Uint8Array(20))).map(byte => byte.toString(16).padStart(2, '0')).join(''); }
      catch { id = Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); }
    }
    return { ...empty, ready: true, sessionId: 'sess_' + id };
  };
  const persist = () => {
    if (owner === 'pending') return;
    try { sessionStorage.setItem(KEY, JSON.stringify({ owner, session_id: snapshot.sessionId, profile: snapshot.profile, user_location: snapshot.userLocation, messages: snapshot.messages })); } catch { /* Storage is optional. */ }
  };
  const getSnapshot = () => {
    if (typeof window === 'undefined' || owner === 'pending') return empty;
    if (!snapshot.ready) {
      snapshot = fresh();
      try {
        const value = JSON.parse(sessionStorage.getItem(KEY) || 'null');
        if (value && value.owner === owner && typeof value.session_id === 'string' && /^sess_[a-zA-Z0-9_-]{16,100}$/.test(value.session_id)) {
          const location = chatLocationSchema.safeParse(value.user_location);
          snapshot = { ...snapshot, sessionId: value.session_id, profile: readChatProfile(value.profile), userLocation: location.success ? location.data : null,
            messages: Array.isArray(value.messages) ? value.messages.slice(-20).flatMap((message: unknown) => { const result = chatMessageSchema.safeParse(message); return result.success ? [result.data] : []; }) : [] };
        }
      } catch { /* Malformed or blocked storage starts a fresh conversation. */ }
    }
    return snapshot;
  };
  const notify = () => { persist(); for (const listener of Array.from(listeners)) listener(); };
  const cancelLocation = () => { generation++; for (const resolve of Array.from(pending)) resolve(null); pending.clear(); };
  const subscribe = (listener: () => void) => {
    listeners.add(listener); getSnapshot(); persist();
    return () => { listeners.delete(listener); if (!listeners.size) cancelLocation(); };
  };
  const updateProfile = (updates: Partial<ChatProfile>) => { snapshot = { ...getSnapshot(), profile: { ...getSnapshot().profile, ...readChatProfile(updates) } }; notify(); };
  const setMessages = (messages: ChatMessage[]) => {
    snapshot = { ...getSnapshot(), messages: messages.slice(-20).flatMap(message => { const result = chatMessageSchema.safeParse(message); return result.success ? [result.data] : []; }) }; notify();
  };
  const setUserLocation = (value: ChatLocation | null) => {
    cancelLocation(); const result = chatLocationSchema.safeParse(value);
    snapshot = { ...getSnapshot(), userLocation: result.success ? result.data : null }; notify();
  };
  const resetSession = () => { cancelLocation(); snapshot = fresh(); notify(); };
  const requestLocation = (): Promise<ChatLocation | null> => {
    if (!navigator.geolocation || !listeners.size) return Promise.resolve(null);
    const revision = generation, request = ++locationRequest;
    return new Promise(resolve => {
      const finish = (value: ChatLocation | null) => { pending.delete(finish); resolve(value); };
      pending.add(finish);
      try {
        navigator.geolocation.getCurrentPosition(position => {
          if (revision !== generation || request !== locationRequest || !listeners.size) { finish(null); return; }
          const result = chatLocationSchema.safeParse({ lat: position.coords.latitude, lng: position.coords.longitude });
          if (!result.success) { finish(null); return; }
          snapshot = { ...getSnapshot(), userLocation: result.data }; notify(); finish(result.data);
        }, () => finish(null), { enableHighAccuracy: true, timeout: 10000 });
      } catch { finish(null); }
    });
  };
  return { getSnapshot, getServerSnapshot: () => empty, subscribe, updateProfile, setMessages, setUserLocation, resetSession, requestLocation };
}
