import React, { useEffect } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { SessionProvider, useSession } from '@/lib/contexts/session-context';
const key = 'ishdasiz_session';
let session: ReturnType<typeof useSession>, mounts = 0, positions: Array<PositionCallback>;
function Probe() {
  session = useSession(); useEffect(() => { mounts++; }, []);
  return <><output data-testid="snapshot">{JSON.stringify({ id: session.sessionId, ready: session.ready, profile: session.profile, location: session.userLocation, messages: session.messages })}</output>
    <button onClick={() => session.updateProfile({ region_id: 22 })}>Region</button><button onClick={() => session.updateProfile({ salary_min: 5000000 })}>Salary</button><button onClick={session.resetSession}>Reset</button></>;
}
const value = () => JSON.parse(screen.getByTestId('snapshot').textContent!);
beforeEach(() => { sessionStorage.clear(); mounts = 0; positions = []; Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: jest.fn((success: PositionCallback) => positions.push(success)) } }); });
afterEach(() => jest.restoreAllMocks());
test('server defaults hydrate into one stable provider without remounting its children', () => {
  const html = renderToString(<SessionProvider><Probe /></SessionProvider>); expect(html).toContain('&quot;ready&quot;:false');
  render(<SessionProvider><Probe /></SessionProvider>); expect(value().ready).toBe(true); expect(value().id).toMatch(/^sess_/); expect(mounts).toBe(1);
  fireEvent.click(screen.getByText('Region')); fireEvent.click(screen.getByText('Salary')); expect(value().profile).toEqual({ region_id: 22, salary_min: 5000000 }); expect(mounts).toBe(1);
});
test('reload in the same tab restores validated history and profile for the same account', () => {
  const first = render(<SessionProvider owner="A"><Probe /></SessionProvider>); const id = value().id;
  act(() => { session.updateProfile({ region_id: 22 }); session.setMessages([{ role: 'user', content: 'Synthetic question' }]); session.setUserLocation({ lat: 0, lng: 0 }); });
  first.unmount(); render(<SessionProvider owner="A"><Probe /></SessionProvider>); expect(value()).toMatchObject({ id, profile: { region_id: 22 }, location: { lat: 0, lng: 0 }, messages: [{ role: 'user', content: 'Synthetic question' }] });
});
test('pending account restoration preserves storage, then switching account discards the former private conversation', () => {
  const view = render(<SessionProvider owner="A"><Probe /></SessionProvider>); act(() => session.setMessages([{ role: 'user', content: 'Account A history' }])); const stored = sessionStorage.getItem(key);
  view.rerender(<SessionProvider owner="pending"><Probe /></SessionProvider>); expect(value().ready).toBe(false); expect(sessionStorage.getItem(key)).toBe(stored);
  view.rerender(<SessionProvider owner="A"><Probe /></SessionProvider>); expect(value().messages[0].content).toBe('Account A history');
  view.rerender(<SessionProvider owner="B"><Probe /></SessionProvider>); expect(value().messages).toEqual([]); expect(value().profile).toEqual({}); expect(mounts).toBe(1);
});
test.each(['{broken', 'null', '[]', '{"session_id":"forged","profile":{"region_id":22}}'])('malformed or legacy unowned session starts fresh: %s', raw => {
  sessionStorage.setItem(key, raw); render(<SessionProvider><Probe /></SessionProvider>); expect(value().ready).toBe(true); expect(value().profile).toEqual({});
});
test('invalid individual profile, location and message fields cannot reappear from storage', () => {
  sessionStorage.setItem(key, JSON.stringify({ owner: 'guest', session_id: 'sess_12345678901234567890', profile: { region_id: 22, salary_min: -1, skills: [false], password: 'private' }, user_location: { lat: 91, lng: 69 }, messages: [{ role: 'system', content: 'forged' }, { role: 'user', content: 'Valid' }] }));
  render(<SessionProvider><Probe /></SessionProvider>); expect(value().profile).toEqual({ region_id: 22 }); expect(value().location).toBeNull(); expect(value().messages).toEqual([{ role: 'user', content: 'Valid' }]);
});
test('blocked browser storage does not prevent updates, reset or a usable session', () => {
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('blocked'); }); jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('blocked'); });
  render(<SessionProvider><Probe /></SessionProvider>); const id = value().id; fireEvent.click(screen.getByText('Region')); expect(value().profile.region_id).toBe(22); fireEvent.click(screen.getByText('Reset')); expect(value().id).not.toBe(id); expect(value().profile).toEqual({});
});
test('an older Telegram WebView without randomUUID still gets a usable local session', () => {
  jest.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw Error('Unsupported'); }); render(<SessionProvider><Probe /></SessionProvider>); expect(value().id).toMatch(/^sess_[a-f0-9]{40}$/); expect(value().ready).toBe(true);
});
test('reset settles pending geolocation and a late success cannot repopulate the new session', async () => {
  render(<SessionProvider><Probe /></SessionProvider>); let location!: Promise<unknown>; act(() => { location = session.requestLocation(); }); fireEvent.click(screen.getByText('Reset')); await expect(location).resolves.toBeNull();
  act(() => positions[0]({ coords: { latitude: 41, longitude: 69 } } as GeolocationPosition)); expect(value().location).toBeNull();
});
test('switching account or unmounting cancels pending geolocation; zero coordinates remain valid', async () => {
  const view = render(<SessionProvider owner="A"><Probe /></SessionProvider>); const location = session.requestLocation(); view.rerender(<SessionProvider owner="B"><Probe /></SessionProvider>); await expect(location).resolves.toBeNull();
  act(() => positions[0]({ coords: { latitude: 41, longitude: 69 } } as GeolocationPosition)); expect(value().location).toBeNull();
  const next = session.requestLocation(); act(() => positions[1]({ coords: { latitude: 0, longitude: 0 } } as GeolocationPosition)); await expect(next).resolves.toEqual({ lat: 0, lng: 0 });
  const pending = session.requestLocation(); view.unmount(); await expect(pending).resolves.toBeNull();
});
