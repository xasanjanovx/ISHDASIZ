/** @jest-environment node */
import { NextRequest } from 'next/server';
import { AccountError, checkSameOrigin } from '@/lib/auth/account';

const previous = process.env.NEXT_PUBLIC_APP_URL;
beforeEach(() => { process.env.NEXT_PUBLIC_APP_URL = 'https://ishdasiz.uz'; });
afterEach(() => {
  if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = previous;
});

test('the configured public origin can submit through an internal container URL', () => {
  const request = new NextRequest('http://0.0.0.0:3000/api/mini-app/records', {
    headers: { origin: 'https://ishdasiz.uz', host: 'ishdasiz.uz', 'x-forwarded-proto': 'https' },
  });
  expect(() => checkSameOrigin(request)).not.toThrow();
});

test('foreign origins remain rejected even when forwarded headers match them', () => {
  const request = new NextRequest('http://0.0.0.0:3000/api/mini-app/records', {
    headers: { origin: 'https://foreign.invalid', 'x-forwarded-host': 'foreign.invalid', 'x-forwarded-proto': 'https' },
  });
  try { checkSameOrigin(request); throw Error('Foreign origin accepted'); }
  catch (error) {
    expect(error).toBeInstanceOf(AccountError);
    expect((error as AccountError).status).toBe(403);
  }
});

test('same-origin preview requests still work without trusting forwarded headers', () => {
  const request = new NextRequest('https://preview.invalid/api/account/profile', {
    headers: { origin: 'https://preview.invalid', 'x-forwarded-host': 'foreign.invalid' },
  });
  expect(() => checkSameOrigin(request)).not.toThrow();
});

test('a malformed configured URL does not allow an untrusted origin', () => {
  process.env.NEXT_PUBLIC_APP_URL = 'invalid-url';
  const request = new NextRequest('http://0.0.0.0:3000/api/account/profile', {
    headers: { origin: 'null' },
  });
  expect(() => checkSameOrigin(request)).toThrow(AccountError);
});
