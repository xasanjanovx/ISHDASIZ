export const dynamic = 'force-dynamic';

/** Process liveness only: no database read, user data or credentials. */
export function GET() {
  return Response.json({ status: 'ok' }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
