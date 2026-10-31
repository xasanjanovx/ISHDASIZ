/** @jest-environment node */
import { generateVertexText, vertexConfigured } from '@/lib/ai/vertex-client';
const originalFetch = global.fetch;
beforeEach(() => { delete process.env.GOOGLE_CLOUD_API_KEY; delete process.env.gemini_cloud_api; delete process.env.VERTEX_MODEL; });
afterEach(() => { global.fetch = originalFetch; });
test('reads the existing cloud-key alias at request time and never uses the old Gemini key', async () => {
  process.env.GEMINI_API_KEY = 'old-developer-api-key';
  expect(vertexConfigured()).toBe(false);
  await expect(generateVertexText('Hello')).rejects.toMatchObject({ kind: 'configuration' });
  process.env.gemini_cloud_api = 'synthetic-cloud-key';
  global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'hidden' }, { text: 'OK' }] } }] })));
  expect(await generateVertexText('Hello')).toBe('OK');
  expect((global.fetch as jest.Mock).mock.calls[0][1].headers['x-goog-api-key']).toBe('synthetic-cloud-key');
});
test.each(['MAX_TOKENS', 'SAFETY'])('does not return incomplete or blocked model output: %s', async reason => {
  process.env.GOOGLE_CLOUD_API_KEY = 'synthetic-cloud-key';
  global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason: reason, content: { parts: [{ text: 'partial' }] } }] })));
  await expect(generateVertexText('Hello')).rejects.toMatchObject({ kind: 'invalid' });
});
test('a network failure never exposes the key, URL, prompt or provider error', async () => {
  process.env.GOOGLE_CLOUD_API_KEY = 'synthetic-cloud-key';
  global.fetch = jest.fn().mockRejectedValue(new Error('secret provider payload'));
  await expect(generateVertexText('private user input')).rejects.toThrow('Vertex AI unavailable');
});
