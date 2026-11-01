/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET as miniApp } from '@/app/mini-app/route';
import { GET as preview } from '@/app/mini-app-preview/route';

test.each([
  ['/mini-app', miniApp],
  ['/mini-app-preview', preview],
] as const)('%s keeps the public browser origin behind a container proxy and preserves launch parameters', (path, handler) => {
  const query = '?startapp=vacancy&lang=uz';
  const response = handler(new NextRequest(`http://0.0.0.0:3000${path}${query}`, {
    headers: { host: 'ishdasiz.uz', 'x-forwarded-proto': 'https' },
  }));
  expect(response.status).toBe(307);
  const destination = new URL(response.headers.get('location')!, `https://ishdasiz.uz${path}`);
  expect(destination.href).toBe(`https://ishdasiz.uz/mini-app-preview/index.html${query}`);
  expect(response.headers.get('cache-control')).toBe('no-store');
});
