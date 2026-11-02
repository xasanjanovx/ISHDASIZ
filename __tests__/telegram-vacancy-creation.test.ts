/** @jest-environment node */
jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }));
jest.mock('@/lib/telegram/telegram-api', () => ({ sendMessage: jest.fn(), deleteMessage: jest.fn(), answerCallbackQuery: jest.fn() }));
jest.mock('@/lib/ai/vacancy-draft', () => ({ ...jest.requireActual('@/lib/ai/vacancy-draft'), extractVacancyDraft: jest.fn(), vacancyAIConfigured: () => true }));
import { TelegramBot, BotState } from '@/lib/telegram/telegram-bot';
import { extractVacancyDraft, vacancyDraftSchema, VacancyDraftError } from '@/lib/ai/vacancy-draft';
import { jobCreateModeKeyboard } from '@/lib/telegram/keyboards';

const USER = '00000000-0000-4000-8000-000000000001';
const ID = '10000000-0000-4000-8000-000000000001';
const source = 'Требуется разработчик Python в ACME. Зарплата 5000000 сум, +998901112233.';
const session = () => ({ telegram_user_id: 100, user_id: USER, state: BotState.POSTING_JOB_MODE, lang: 'ru', phone: '+998901112233', data: { active_role: 'employer', account_session_version: 4, temp_job: { publication_id: ID, company_name: 'ACME', contact_phone: '+998901112233' } } });
function harness(quota: any = { data: 2, error: null }) {
  const bot: any = Object.create(TelegramBot.prototype);
  bot.sendPrompt = jest.fn().mockResolvedValue(undefined);
  bot.setFlowCancelKeyboard = jest.fn().mockResolvedValue(undefined);
  bot.setSession = jest.fn(async (s, changes) => Object.assign(s, changes));
  bot.supabase = { rpc: jest.fn(() => ({ abortSignal: async () => quota })) };
  return bot;
}
beforeEach(() => jest.clearAllMocks());

test('employer can choose AI, supply mixed-language text and review without publishing', async () => {
  const bot = harness(), s: any = session();
  expect(JSON.stringify(jobCreateModeKeyboard('ru'))).toContain('jobmode:ai');
  await bot.handleJobCreateMode(100, 'ai', s);
  expect(s.state).toBe(BotState.AI_JOB_INPUT);
  (extractVacancyDraft as jest.Mock).mockResolvedValue(vacancyDraftSchema.parse({ title: 'Разработчик Python', requirements: ['Python'], phones: ['+998901112233'] }));
  await bot.handleAiJobInput(100, source, s);
  expect(s.state).toBe(BotState.POSTING_JOB_CONFIRM);
  expect(s.data.temp_job.title).toBe('Разработчик Python');
  expect(s.data.temp_job.ai_input).toBe(source);
  expect(bot.supabase.rpc).toHaveBeenCalledWith('ishdasiz_reserve_vacancy_ai', { p_user_id: USER, p_session_version: 4 });
  expect(bot.sendPrompt.mock.calls.at(-1)[2]).toContain('@ishdasiz');
  expect(bot.shouldDeleteIncomingMessage(source, s, true)).toBe(false);
  expect(bot.shouldSkipModeration(BotState.AI_JOB_INPUT, 'React и Supabase https://t.me/acme_jobs')).toBe(true);
});

test.each([{ data: -1, error: null }, { data: null, error: { code: '42501' } }])('quota/auth failure keeps source and never calls AI', async quota => {
  const bot = harness(quota), s: any = session(); s.state = BotState.AI_JOB_INPUT;
  await bot.handleAiJobInput(100, source, s);
  expect(extractVacancyDraft).not.toHaveBeenCalled();
  expect(s.state).toBe(BotState.AI_JOB_INPUT); expect(s.data.temp_job.ai_input).toBe(source);
});

test('provider error preserves source and offers a manual fallback', async () => {
  const bot = harness(), s: any = session(); s.state = BotState.AI_JOB_INPUT;
  (extractVacancyDraft as jest.Mock).mockRejectedValue(new VacancyDraftError('billing'));
  await bot.handleAiJobInput(100, source, s);
  expect(s.data.temp_job.ai_input).toBe(source); expect(s.state).toBe(BotState.AI_JOB_INPUT);
  expect(JSON.stringify(bot.sendPrompt.mock.calls)).toContain('jobmode:manual');
  await bot.handleJobCreateMode(100, 'manual', s); expect(s.state).toBe(BotState.POSTING_JOB_TITLE);
});

test('seeker, unauthenticated and stale confirmations cannot enter AI or insert jobs', async () => {
  for (const patch of [{ user_id: null }, { data: { active_role: 'job_seeker' } }, { state: BotState.EMPLOYER_MAIN_MENU }]) {
    const bot = harness(), s = { ...session(), ...patch };
    await bot.handleJobCreateMode(100, 'ai', s);
    await bot.handleJobPublish(100, s);
    expect(bot.supabase.rpc).not.toHaveBeenCalled(); expect(bot.setSession).not.toHaveBeenCalled();
  }
});

test('AI publish without a selected canonical region returns to region selection', async () => {
  const bot = harness(), s: any = session(); s.state = BotState.POSTING_JOB_CONFIRM;
  Object.assign(s.data.temp_job, { job_create_mode: 'ai', title: 'Operator', description: source });
  bot.checkAccountSession = jest.fn().mockResolvedValue(true); bot.handleAiJobAction = jest.fn();
  await bot.handleJobPublish(100, s);
  expect(bot.handleAiJobAction).toHaveBeenCalledWith(100, 'region', s);
});

test('a forwarded photo caption reaches the AI input handler and remains in the chat', async () => {
  const bot = harness(), s: any = session(); s.state = BotState.AI_JOB_INPUT;
  bot.isAdminTelegramUser = () => false; bot.isUserBanned = async () => false;
  bot.handleTextByState = jest.fn();
  await bot.handleMessage({ message_id: 12, from: { id: 100 }, chat: { id: 100 }, photo: [{ file_id: 'photo' }], caption: source }, s);
  expect(bot.handleTextByState).toHaveBeenCalledWith(100, source, s);
});

test('retry after saved vacancy but lost confirmation reuses its ID rather than inserting a second vacancy', async () => {
  const bot = harness(), s: any = session(); s.state = BotState.POSTING_JOB_CONFIRM;
  Object.assign(s.data.temp_job, { title: 'Operator', description: source, region_id: 1, region_name: 'Andijon', contact_phone: '+998901112233' });
  bot.checkAccountSession = async () => true;
  bot.publishJobToRegionChannel = async () => false; bot.autoMatchAndNotifyOnPublish = async () => {};
  bot.sendSeriousSticker = async () => {}; bot.clearFlowCancelKeyboard = async () => {};
  const inserted: any[] = [];
  bot.supabase.from = (table: string) => {
    const query: any = { select: () => query, eq: () => query, update: () => query,
      maybeSingle: async () => ({ data: table === 'employer_profiles' ? { id: USER, company_name: 'ACME', phone: '+998901112233' } : inserted[0], error: null }),
      insert: (payload: any) => { const duplicate = inserted.length > 0; if (!duplicate) inserted.push(payload); return { select: () => ({ single: async () => duplicate ? { data: null, error: { code: '23505' } } : { data: payload, error: null } }) }; }
    }; return query;
  };
  bot.sendPrompt.mockRejectedValueOnce(new Error('Confirmation delivery failed'));
  await expect(bot.handleJobPublish(100, s)).rejects.toThrow('Confirmation delivery failed');
  expect(s.state).toBe(BotState.POSTING_JOB_CONFIRM);
  await bot.handleJobPublish(100, s);
  expect(inserted).toHaveLength(1); expect(inserted[0].id).toBe(ID);
  expect(s.state).toBe(BotState.EMPLOYER_MAIN_MENU); expect(s.data.temp_job).toBeNull();
});
