import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UserAuthProvider, useUserAuth } from '@/contexts/user-auth-context';
import { useAuth } from '@/hooks/useAuth';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
const originalFetch = global.fetch;
const DAY = 24 * 60 * 60 * 1000;

function Probe() {
    const { user, login, logout, isAuthenticated, isLoading } = useUserAuth();
    const enter = (id: string) => login({ id, phone: '+998901234567', active_role: 'job_seeker', has_job_seeker_profile: true, has_employer_profile: false });
    return <>
        <p>{isLoading ? 'Loading' : isAuthenticated ? user?.id : 'Guest'}</p>
        <button onClick={() => enter('Account A')}>Login A</button>
        <button onClick={() => enter('Account B')}>Login B</button>
        <button onClick={() => { logout().catch(() => undefined); }}>Logout</button>
    </>;
}
beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-06T00:00:00Z'));
    localStorage.clear();
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
});
afterEach(() => {
    cleanup(); jest.clearAllTimers(); jest.useRealTimers(); global.fetch = originalFetch;
});
async function mount() {
    render(<UserAuthProvider><Probe /></UserAuthProvider>);
    await screen.findByText('Guest');
}

test('failed logout preserves identity, and successful retry clears it only after the server responds',async()=>{
 await mount();fireEvent.click(screen.getByText('Login A'));
 (global.fetch as jest.Mock).mockResolvedValueOnce({ok:false});fireEvent.click(screen.getByText('Logout'));await act(async()=>{});expect(screen.getByText('Account A')).toBeInTheDocument();
 let resolve:any;(global.fetch as jest.Mock).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));fireEvent.click(screen.getByText('Logout'));expect(screen.getByText('Account A')).toBeInTheDocument();
 await act(async()=>resolve({ok:true}));expect(screen.getByText('Guest')).toBeInTheDocument();
});
test('late session restoration cannot overwrite a newer login',async()=>{
 let resolve:any;(global.fetch as jest.Mock).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));render(<UserAuthProvider><Probe/></UserAuthProvider>);
 fireEvent.click(screen.getByText('Login B'));await act(async()=>resolve({ok:true,json:async()=>({user:{id:'Account A',active_role:'job_seeker'},expiresAt:Date.now()+DAY})}));expect(screen.getByText('Account B')).toBeInTheDocument();
});
test('a late logout response does not clear a newer client identity',async()=>{
 await mount();fireEvent.click(screen.getByText('Login A'));let resolve:any;(global.fetch as jest.Mock).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
 fireEvent.click(screen.getByText('Logout'));fireEvent.click(screen.getByText('Login B'));await act(async()=>resolve({ok:true}));expect(screen.getByText('Account B')).toBeInTheDocument();
});

test('the compatibility auth hook rejects an account forged in local storage', async () => {
    localStorage.setItem('ishdasiz_user', JSON.stringify({ id: 'Forged account', role: 'employer', expires_at: Date.now() + DAY }));
    function LegacyProbe() {
        const { isLoading, isLoggedIn, getCurrentUser } = useAuth();
        return <p>{isLoading ? 'Loading' : isLoggedIn() ? getCurrentUser()?.id : 'Verified guest'}</p>;
    }
    render(<UserAuthProvider><LegacyProbe /></UserAuthProvider>);
    await screen.findByText('Verified guest');
    expect(screen.queryByText('Forged account')).not.toBeInTheDocument();
});

test('a thirty-day session survives the browser timer limit and expires without a reload', async () => {
    await mount(); fireEvent.click(screen.getByText('Login A'));
    act(() => { jest.advanceTimersByTime(25 * DAY); });
    expect(screen.getByText('Account A')).toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(5 * DAY); });
    expect(screen.getByText('Guest')).toBeInTheDocument();
});

test('the previous account timer cannot expire a newer login', async () => {
    await mount(); fireEvent.click(screen.getByText('Login A'));
    act(() => { jest.advanceTimersByTime(7 * DAY); });
    fireEvent.click(screen.getByText('Login B'));
    act(() => { jest.advanceTimersByTime(23 * DAY); });
    expect(screen.getByText('Account B')).toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(7 * DAY); });
    expect(screen.getByText('Guest')).toBeInTheDocument();
});

test('restoring a session respects the server expiry rather than granting thirty more days', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({
        user: { id: 'Restored account', active_role: 'employer', has_employer_profile: true }, expiresAt: Date.now() + 1000,
    }) });
    render(<UserAuthProvider><Probe /></UserAuthProvider>);
    await waitFor(() => expect(screen.getByText('Restored account')).toBeInTheDocument());
    act(() => { jest.advanceTimersByTime(1000); });
    expect(screen.getByText('Guest')).toBeInTheDocument();
});
