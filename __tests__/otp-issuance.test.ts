/** @jest-environment node */
import { issuePhoneOtp } from '@/lib/auth/issue-otp';
import { sendSMS } from '@/lib/eskiz';
jest.mock('@/lib/eskiz', () => ({ generateOTP: () => '54321', getSMSText: (code: string) => code, isSmsDevMode: () => false, sendSMS: jest.fn() }));
const stamp = new Date().toISOString();
let calls: { method: string; args: any[] }[], results: any[];
function client() {
  return { from: jest.fn(() => {
    const result = results.shift(), chain: any = {};
    for (const method of ['select', 'eq', 'gte', 'lt', 'neq', 'order', 'limit', 'insert', 'update', 'delete']) chain[method] = (...args: any[]) => { calls.push({ method, args }); return chain; };
    chain.single = chain.maybeSingle = async () => result;
    chain.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
    return chain;
  }) } as any;
}
beforeEach(() => {
  jest.clearAllMocks(); calls = [];
  results = [{ count: 0 }, { data: null }, { data: { id: 'otp', created_at: stamp } }, { error: null }];
  (sendSMS as jest.Mock).mockResolvedValue({ success: true });
});
test('parallel site/bot requests share one SMS and an older response cannot invalidate a newer code', async () => {
  const db = client();
  const a = issuePhoneOtp(db, '+998901234567'), b = issuePhoneOtp(db, '+998901234567');
  expect(a).toBe(b);
  expect(await a).toEqual({ status: 200, body: { success: true } });
  expect(sendSMS).toHaveBeenCalledTimes(1);
  expect(calls).toContainEqual({ method: 'lt', args: ['created_at', stamp] });
  expect(JSON.stringify((await b).body)).not.toContain('54321');
});
test('per-phone hourly and resend limits stop before delivery', async () => {
  results = [{ count: 5 }];
  expect((await issuePhoneOtp(client(), '+998901234567')).status).toBe(429);
  results = [{ count: 1 }, { data: { created_at: stamp } }];
  expect((await issuePhoneOtp(client(), '+998901234567')).body.code).toBe('sms_resend_wait');
  expect(sendSMS).not.toHaveBeenCalled();
});
test('failed delivery removes its unusable code without deleting other codes', async () => {
  (sendSMS as jest.Mock).mockResolvedValue({ success: false });
  expect((await issuePhoneOtp(client(), '+998901234567')).status).toBe(502);
  expect(calls).toContainEqual({ method: 'eq', args: ['id', 'otp'] });
  expect(calls.some(call => call.method === 'update')).toBe(false);
});
