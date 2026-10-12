import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import AISearchPage from '@/app/ai-search/page';
import { SessionProvider } from '@/lib/contexts/session-context';
import { translations } from '@/lib/translations';
let lang = 'ru', url = '';
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(url) }));
jest.mock('@/contexts/language-context', () => ({ useLanguage: () => ({ lang, t: translations[lang as 'ru' | 'uz'] }) }));
const originalFetch = global.fetch;
let requests: Array<{ body: any; signal: AbortSignal; finish: (response: any) => void }>;
const response = (text = 'Synthetic answer') => ({ ok: true, json: async () => ({ response: text, jobs: [], profile: { region_id: 22 } }) });
beforeEach(() => { lang = 'ru'; url = ''; sessionStorage.clear(); requests = []; global.fetch = jest.fn((_url, init: any) => new Promise(resolve => requests.push({ body: JSON.parse(init.body), signal: init.signal, finish: resolve }))) as any; });
afterEach(() => { global.fetch = originalFetch; });
const mount = (owner = 'guest') => render(<SessionProvider owner={owner}><AISearchPage /></SessionProvider>);
const typeAndSend = (query = 'Ищу работу') => { fireEvent.change(screen.getByRole('textbox'), { target: { value: query } }); fireEvent.click(screen.getByRole('button', { name: 'Отправить' })); };
const finish = async (index = 0, value: any = response()) => act(async () => requests[index].finish(value));
test('failed HTTP request preserves input, shows retry and never invents an empty search result', async () => {
  mount(); typeAndSend(); await finish(0, { ok: false, json: async () => ({ error: 'Unavailable' }) }); expect(screen.getByRole('textbox')).toHaveValue('Ищу работу'); expect(screen.getByRole('alert')).toHaveTextContent('Ваш запрос сохранён');
  fireEvent.click(screen.getByText('Повторить')); expect(requests).toHaveLength(2); await finish(1); expect(screen.getByText('Synthetic answer')).toBeInTheDocument(); expect(screen.getByRole('textbox')).toHaveValue(''); expect(screen.getAllByText('Ищу работу')).toHaveLength(1);
});
test('double submit makes one request; typing the next question while waiting is preserved', async () => {
  mount(); typeAndSend('Первый вопрос'); fireEvent.submit(screen.getByRole('textbox').closest('form')!); expect(requests).toHaveLength(1);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Следующий вопрос' } }); await finish(); expect(screen.getByRole('textbox')).toHaveValue('Следующий вопрос');
  fireEvent.click(screen.getByRole('button', { name: 'Отправить' })); expect(requests[1].body.messages).toEqual([{ role: 'user', content: 'Первый вопрос' }, { role: 'assistant', content: 'Synthetic answer' }]); expect(requests[1].body.profile).toEqual({ region_id: 22 }); expect(requests[1].body.session_id).toBeUndefined();
});
test('reset cancels a pending request and its late response cannot enter the new dialogue', async () => {
  mount(); typeAndSend(); fireEvent.click(screen.getByRole('button', { name: 'Новый диалог' })); expect(requests[0].signal.aborted).toBe(true); await finish(); expect(screen.queryByText('Synthetic answer')).not.toBeInTheDocument(); expect(screen.getByRole('textbox')).toHaveValue('');
});
test('switching account cancels the old request and hides its private conversation immediately', async () => {
  const view = mount('A'); typeAndSend('Account A question'); view.rerender(<SessionProvider owner="B"><AISearchPage /></SessionProvider>); expect(requests[0].signal.aborted).toBe(true); await finish(); expect(screen.queryByText('Account A question')).not.toBeInTheDocument(); expect(screen.queryByText('Synthetic answer')).not.toBeInTheDocument();
});
test('malformed success payload is a retryable failure and keeps the draft', async () => {
  mount(); typeAndSend(); await finish(0, { ok: true, json: async () => ({ response: 'Invented answer', jobs: [{ id: 'bad-id' }], profile: {} }) }); expect(screen.getByRole('alert')).toBeInTheDocument(); expect(screen.queryByText('Invented answer')).not.toBeInTheDocument(); expect(screen.getByRole('textbox')).toHaveValue('Ищу работу');
});
test('query URL is sent after session readiness only once, including after resetting the conversation', async () => {
  url = 'q=IT'; const view = render(<React.StrictMode><SessionProvider><AISearchPage /></SessionProvider></React.StrictMode>); await act(async () => {}); expect(requests).toHaveLength(1); await finish(); fireEvent.click(screen.getByRole('button', { name: 'Новый диалог' })); await act(async () => {}); expect(requests).toHaveLength(1); view.unmount();
});
test('language changes preserve the pending request and draft without sending twice', async () => {
  const view = mount(); typeAndSend(); lang = 'uz'; view.rerender(<SessionProvider><AISearchPage /></SessionProvider>); expect(requests).toHaveLength(1); expect(requests[0].signal.aborted).toBe(false); await finish(); expect(screen.getByRole('button', { name: 'Yuborish' })).toBeInTheDocument();
});
test('reload restores the same tab conversation without repeating the URL query', async () => {
  url = 'q=IT'; const view = mount(); await act(async () => {}); await finish(); view.unmount(); mount(); await act(async () => {}); expect(requests).toHaveLength(1); expect(screen.getByText('Synthetic answer')).toBeInTheDocument(); expect(screen.getByRole('textbox')).toHaveValue('');
});
test('geolocation is requested only on click and denial is localized without blocking ordinary search', async () => {
  const locate = jest.fn((_success, failure) => failure({ code: 1 })); Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: locate } });
  mount(); expect(locate).not.toHaveBeenCalled(); fireEvent.click(screen.getByText('Поиск рядом')); await act(async () => {}); expect(screen.getByRole('alert')).toHaveTextContent('Проверьте разрешение браузера'); typeAndSend(); await finish(); expect(screen.getByText('Synthetic answer')).toBeInTheDocument();
});
test('new answers scroll the conversation container while leaving the outer page position alone', async () => {
  mount(); const log = screen.getByRole('log'); Object.defineProperty(log, 'scrollHeight', { configurable: true, value: 1200 });
  typeAndSend(); await finish(); expect(log.scrollTop).toBe(1200); expect(window.scrollY).toBe(0);
});
