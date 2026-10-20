/** @jest-environment node */
import { createClient } from '@supabase/supabase-js';
import { ensureSourceCategories } from '@/lib/import/source-categories';
import { fetchOsonishConfigs } from '@/lib/scrapers/osonish-config';
jest.mock('@/lib/scrapers/osonish-config', () => ({ fetchOsonishConfigs: jest.fn() }));
let current: any[], writes: any[];
const client = () => createClient('https://synthetic.invalid', 'synthetic', { global: { fetch: async (_url: any, init: any) => {
  if (init.method === 'POST') { writes.push(...JSON.parse(init.body)); return new Response('[]'); }
  return new Response(JSON.stringify(current));
} } });
beforeEach(() => { current = []; writes = []; (fetchOsonishConfigs as jest.Mock).mockResolvedValue({ mainFields: [{ id: 12, name: 'Axborot texnologiyalari' }, { id: 99, name: 'Yangi soha', name_ru: 'Новое направление' }] }); });
test('new source directions have stable IDs and preserve existing local labels', async () => {
  expect(await ensureSourceCategories(client())).toEqual({ checked: 2, added: 2 });
  expect(writes[1]).toMatchObject({ name_uz: 'Yangi soha', name_ru: 'Новое направление', slug: 'osonish-soha-99' });
  const first = structuredClone(writes); writes = [];
  await ensureSourceCategories(client()); expect(writes).toEqual(first);
  current = first.map(row => ({ ...row, name_ru: 'Local label' })); writes = [];
  expect(await ensureSourceCategories(client())).toEqual({ checked: 2, added: 0 });
  expect(writes).toEqual([]);
});
test('a matching direction name is reused and a missing source snapshot never means success', async () => {
  current = [{ id: 'existing-local-id', name_uz: 'Axborot texnologiyalari', name_ru: '' }];
  expect(await ensureSourceCategories(client())).toEqual({ checked: 2, added: 1 });
  expect(writes[0].slug).toBe('osonish-soha-99');
  writes = []; (fetchOsonishConfigs as jest.Mock).mockResolvedValue(null);
  await expect(ensureSourceCategories(client())).rejects.toThrow('Source directions unavailable');
  expect(writes).toEqual([]);
});
