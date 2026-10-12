import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { TelegramProvider, useTelegram } from '@/contexts/telegram-context';
import { UserAuthProvider, useUserAuth } from '@/contexts/user-auth-context';
import { TelegramNotice } from '@/components/layout/telegram-notice';
const mockRouter = { back: jest.fn(), push: jest.fn() }, openModal = jest.fn();
let path = '/jobs';
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter, usePathname: () => path }));
jest.mock('@/contexts/language-context', () => ({ useLanguage: () => ({ lang: 'ru' }) }));
jest.mock('@/contexts/auth-modal-context', () => ({ useAuthModal: () => ({ openModal }) }));
const originalFetch = global.fetch;
let requests: Array<{ signal: AbortSignal; finish: (value: any) => void }>, app: any;
const account = (id = 'Telegram account') => ({ id, phone: '+998901234567', active_role: 'job_seeker' as const, has_job_seeker_profile: true, has_employer_profile: false });
function Probe() {
  const telegram = useTelegram(), auth = useUserAuth();
  return <><output data-testid="telegram">{JSON.stringify({ detected: telegram.isTelegram, loading: telegram.isLoading, error: telegram.error, id: auth.user?.id || null })}</output><button onClick={() => auth.login(account('Manual account'))}>Manual login</button><button onClick={() => void auth.logout()}>Logout</button><TelegramNotice /></>;
}
const state = () => JSON.parse(screen.getByTestId('telegram').textContent!);
const mount = () => render(<UserAuthProvider><TelegramProvider><Probe /></TelegramProvider></UserAuthProvider>);
beforeEach(() => {
  path = '/jobs'; localStorage.clear(); delete window.Telegram; requests = []; jest.clearAllMocks();
  app = { initData: 'signed-by-server-only', initDataUnsafe: { user: { id: 999, first_name: 'Untrusted' } }, themeParams: {}, ready: jest.fn(), expand: jest.fn(), setHeaderColor: jest.fn(), setBackgroundColor: jest.fn(), BackButton: { show: jest.fn(), hide: jest.fn(), onClick: jest.fn(), offClick: jest.fn() } };
  global.fetch = jest.fn((url, init: any) => {
    if (url === '/api/auth/session') return Promise.resolve({ ok: init?.method === 'DELETE' });
    if (url === '/api/telegram/webapp-auth') return new Promise(resolve => requests.push({ signal: init.signal, finish: resolve }));
    throw Error('Unexpected request');
  }) as any;
});
afterEach(() => { global.fetch = originalFetch; delete window.Telegram; });
const flush = async () => act(async () => {});
const finish = async (index = 0, value: any = { ok: true, json: async () => ({ success: true, user: account() }) }) => act(async () => requests[index].finish(value));

test('an ordinary browser never starts Telegram authentication or trusts unsafe SDK user data', async () => {
  mount(); await flush(); expect(requests).toHaveLength(0); expect(state()).toMatchObject({ detected: false, loading: false, id: null });
});
test('an asynchronously loaded SDK is detected and a verified response updates the shared website account', async () => {
  const script = document.createElement('script'); script.src = 'https://telegram.org/js/telegram-web-app.js'; document.head.appendChild(script);
  const view = mount(); await flush(); expect(state().detected).toBe(false);
  act(() => { window.Telegram = { WebApp: app }; fireEvent.load(script); }); await flush(); expect(requests).toHaveLength(1); expect(state()).toMatchObject({ detected: true, id: null });
  await finish(); expect(state()).toMatchObject({ id: 'Telegram account', error: null, loading: false }); expect(app.ready).toHaveBeenCalled(); view.unmount(); script.remove();
});
test('native SDK method failure does not prevent authentication or site navigation', async () => {
  app.ready.mockImplementation(() => { throw Error('Unsupported native method'); }); window.Telegram = { WebApp: app }; mount(); await flush(); await finish(); expect(state().id).toBe('Telegram account');
});
test.each([{ status: 404, payload: { requires_link: true }, text: 'ещё не связан' }, { status: 403, payload: { needsRestoration: true }, text: 'Аккаунт закрыт' }, { status: 401, payload: {}, text: 'Срок Telegram-входа истёк' }, { status: 409, payload: { account_conflict: true }, text: 'другой аккаунт' }])('account recovery errors show phone-login action: $status', async ({ status, payload, text }) => {
  window.Telegram = { WebApp: app }; mount(); await flush(); await finish(0, { ok: false, status, json: async () => payload });
  expect(state().id).toBeNull(); expect(screen.getByText(new RegExp(text))).toBeInTheDocument(); fireEvent.click(screen.getByText('Войти по телефону')); expect(openModal).toHaveBeenCalled();
});
test('network/provider failure can be retried once without a second simultaneous request', async () => {
  window.Telegram = { WebApp: app }; mount(); await flush(); await finish(0, { ok: false, status: 503, json: async () => ({ error: 'Unavailable' }) });
  fireEvent.click(screen.getByText('Повторить')); fireEvent.click(screen.getByText('Повторить')); await flush(); expect(requests).toHaveLength(2); await finish(1); expect(state().id).toBe('Telegram account'); expect(screen.queryByText('Повторить')).not.toBeInTheDocument();
});
test('manual login aborts an in-flight Telegram request and its late response cannot replace the chosen account', async () => {
  window.Telegram = { WebApp: app }; mount(); await flush(); fireEvent.click(screen.getByText('Manual login')); expect(requests[0].signal.aborted).toBe(true); await finish(); expect(state().id).toBe('Manual account');
});
test('logout during a pending Telegram request does not allow a late response to log the user back in', async () => {
  window.Telegram = { WebApp: app }; mount(); await flush(); fireEvent.click(screen.getByText('Logout')); await flush(); expect(requests[0].signal.aborted).toBe(true); await finish(); expect(state()).toMatchObject({ id: null, loading: false, error: null }); expect(requests).toHaveLength(1);
});
test('malformed success payload never establishes a browser identity', async () => {
  window.Telegram = { WebApp: app }; mount(); await flush(); await finish(0, { ok: true, json: async () => ({ success: true, user: { id: 'forged' } }) }); expect(state().id).toBeNull(); expect(state().error).toBe('unavailable');
});
test('back handlers use native navigation and are detached and hidden on route change and unmount', async () => {
  window.Telegram = { WebApp: app }; const view = mount(); await flush(); const handler = app.BackButton.onClick.mock.calls[0][0]; act(() => handler()); expect(mockRouter.back).toHaveBeenCalled();
  path = '/'; view.rerender(<UserAuthProvider><TelegramProvider><Probe /></TelegramProvider></UserAuthProvider>); expect(app.BackButton.offClick).toHaveBeenCalledWith(handler); expect(app.BackButton.hide).toHaveBeenCalled();
  view.unmount(); expect(requests[0].signal.aborted).toBe(true); await finish();
});
test('an existing authenticated website session is preserved instead of automatically switching accounts', async () => {
  (global.fetch as jest.Mock).mockImplementationOnce(async () => ({ ok: true, json: async () => ({ user: account('Existing account'), expiresAt: Date.now() + 60000 }) })); window.Telegram = { WebApp: app }; mount(); await flush(); expect(state().id).toBe('Existing account'); expect(requests).toHaveLength(0);
});

test('Strict Mode starts a single authentication request and a malformed JSON response remains retryable', async () => {
  window.Telegram = { WebApp: app }; render(<React.StrictMode><UserAuthProvider><TelegramProvider><Probe /></TelegramProvider></UserAuthProvider></React.StrictMode>); await flush(); expect(requests).toHaveLength(1);
  await finish(0, { ok: true, json: async () => { throw Error('Invalid JSON'); } }); expect(state().error).toBe('unavailable'); expect(screen.getByText('Повторить')).toBeInTheDocument();
});
