import type { NextRequest } from 'next/server';

export function GET(request: NextRequest) {
  return new Response(null, {
    status: 307,
    headers: {
      Location: `/mini-app-preview/index.html${request.nextUrl.search}`,
      'Cache-Control': 'no-store',
    },
  });
}
