import { timingSafeEqual } from 'crypto';

/** Maintenance jobs always require a configured operator secret, including local runs. */
export function verifyCron(request: Request): boolean {
    const secret = process.env.CRON_SECRET;
    const incoming = request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
    return !!secret && Buffer.byteLength(secret) === Buffer.byteLength(incoming)
        && timingSafeEqual(Buffer.from(secret), Buffer.from(incoming));
}
