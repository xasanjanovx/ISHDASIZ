import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { useUserRole } from '@/hooks/use-user-role';
import { useSeekerPreferences } from '@/hooks/use-seeker-preferences';
const roleKey = 'ishdasiz_user_role', prefsKey = 'ishdasiz_seeker_preferences';
function Probe({ id }: { id: string }) {
  const roles = useUserRole(), prefs = useSeekerPreferences();
  return <><output data-testid={'role-' + id}>{roles.role || 'none'}</output><output data-testid={'prefs-' + id}>{JSON.stringify(prefs.preferences)}</output><output data-testid={'complete-' + id}>{String(prefs.isCompleted)}</output><output data-testid={'loading-' + id}>{String(roles.isLoading || prefs.isLoading)}</output>
    <button onClick={() => roles.setRole('seeker')}>{id} seeker</button><button onClick={roles.clearRole}>{id} clear role</button>
    <button onClick={() => prefs.updatePreferences({ districtId: '22' })}>{id} district</button><button onClick={() => prefs.updatePreferences({ salaryMin: 5000000 })}>{id} salary</button>
    <button onClick={prefs.clearPreferences}>{id} clear preferences</button></>;
}
const prefs = (id = 'A') => JSON.parse(screen.getByTestId('prefs-' + id).textContent!);
beforeEach(() => { localStorage.clear(); });
afterEach(() => jest.restoreAllMocks());

test('server markup has stable defaults; hydration restores the legacy role and validated preferences', () => {
  localStorage.setItem(roleKey, 'employer'); localStorage.setItem(prefsKey, JSON.stringify({ districtId: '22', salaryMin: 3000000 }));
  const server = renderToString(<Probe id="server" />); expect(server).toContain('none'); expect(server).not.toContain('3000000');
  render(<Probe id="A" />); expect(screen.getByTestId('role-A')).toHaveTextContent('employer'); expect(prefs()).toEqual({ districtId: '22', salaryMin: 3000000 }); expect(screen.getByTestId('loading-A')).toHaveTextContent('false');
});
test('instances share role changes, merge preference updates and clear both states immediately', () => {
  render(<><Probe id="A" /><Probe id="B" /></>); fireEvent.click(screen.getByText('A seeker')); expect(screen.getByTestId('role-B')).toHaveTextContent('seeker'); expect(localStorage.getItem(roleKey)).toBe('seeker');
  fireEvent.click(screen.getByText('A district')); fireEvent.click(screen.getByText('B salary')); expect(prefs()).toEqual({ districtId: '22', salaryMin: 5000000 }); expect(prefs('B')).toEqual(prefs());
  fireEvent.click(screen.getByText('B clear preferences')); expect(prefs()).toEqual({}); fireEvent.click(screen.getByText('A clear role')); expect(screen.getByTestId('role-B')).toHaveTextContent('none');
});
test('another tab can change preferences or clear storage without leaving stale role or completion', () => {
  render(<Probe id="A" />);
  act(() => { localStorage.setItem(roleKey, 'employer'); window.dispatchEvent(new StorageEvent('storage', { key: roleKey })); localStorage.setItem(prefsKey, JSON.stringify({ completedAt: '2026-10-09T00:00:00Z' })); window.dispatchEvent(new StorageEvent('storage', { key: prefsKey })); });
  expect(screen.getByTestId('role-A')).toHaveTextContent('employer'); expect(screen.getByTestId('complete-A')).toHaveTextContent('true');
  act(() => { localStorage.clear(); window.dispatchEvent(new StorageEvent('storage', { key: null })); }); expect(screen.getByTestId('role-A')).toHaveTextContent('none'); expect(prefs()).toEqual({}); expect(screen.getByTestId('complete-A')).toHaveTextContent('false');
});
test.each(['null', '[]', '{broken', '"text"'])('malformed stored preferences %s do not crash or count as completed', value => {
  localStorage.setItem(prefsKey, value); localStorage.setItem(roleKey, 'administrator'); render(<Probe id="A" />); expect(prefs()).toEqual({}); expect(screen.getByTestId('complete-A')).toHaveTextContent('false'); expect(screen.getByTestId('role-A')).toHaveTextContent('none');
});
test('unsafe numeric/location/completion values and extra private fields are discarded', () => {
  localStorage.setItem(prefsKey, JSON.stringify({ districtId: 22, salaryMin: -1, latitude: 150, longitude: 69, geoPermission: 'granted', completedAt: true, categoryIds: ['it', 'it', {}, ''], password: 'private' }));
  render(<Probe id="A" />); expect(prefs()).toEqual({ categoryIds: ['it'] }); expect(screen.getByTestId('complete-A')).toHaveTextContent('false');
});
test('role and preference updates/clears still work when reads, writes and removals are blocked', () => {
  localStorage.setItem(roleKey, 'employer');
  const get = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  const set = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  const remove = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
  render(<><Probe id="A" /><Probe id="B" /></>); fireEvent.click(screen.getByText('A seeker')); expect(screen.getByTestId('role-B')).toHaveTextContent('seeker'); fireEvent.click(screen.getByText('A salary')); expect(prefs('B').salaryMin).toBe(5000000);
  fireEvent.click(screen.getByText('B clear role')); fireEvent.click(screen.getByText('B clear preferences')); expect(screen.getByTestId('role-A')).toHaveTextContent('none'); expect(prefs()).toEqual({});
  get.mockRestore(); set.mockRestore(); remove.mockRestore();
  // A readable old storage value must not override a choice whose write failed.
  fireEvent.click(screen.getByText('A salary')); expect(screen.getByTestId('role-A')).toHaveTextContent('none'); fireEvent.click(screen.getByText('A clear role')); fireEvent.click(screen.getByText('A clear preferences'));
});
test('quota failure with readable storage cannot roll the current role back to an older saved value', () => {
  localStorage.setItem(roleKey, 'employer'); render(<><Probe id="A" /><Probe id="B" /></>);
  const set = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  fireEvent.click(screen.getByText('A seeker')); expect(screen.getByTestId('role-A')).toHaveTextContent('seeker'); expect(screen.getByTestId('role-B')).toHaveTextContent('seeker'); expect(localStorage.getItem(roleKey)).toBe('employer');
  set.mockRestore(); fireEvent.click(screen.getByText('A clear role'));
});
