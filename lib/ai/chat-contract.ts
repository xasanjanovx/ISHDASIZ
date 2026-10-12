import { z } from 'zod';

export const chatProfileSchema = z.object({
  category: z.string().trim().max(150).optional(), category_id: z.string().uuid().optional(),
  skills: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  experience_years: z.number().finite().min(0).max(80).optional(),
  salary_min: z.number().finite().min(0).max(2_147_483_647).optional(),
  region: z.string().trim().max(150).optional(), region_id: z.number().int().positive().max(2_147_483_647).optional(),
  work_mode: z.enum(['remote', 'onsite', 'any']).optional(),
  exclude_keywords: z.array(z.string().trim().min(1).max(100)).max(30).optional(), profile_complete: z.boolean().optional(),
});
export const chatLocationSchema = z.object({ lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180) });
export const chatJobSchema = z.object({
  id: z.string().uuid(), title: z.string().max(500), company: z.string().max(300), salary: z.string().max(150),
  location: z.string().max(500).optional(), work_mode: z.string().max(100).optional(),
  match_score: z.number().finite().min(0).max(100).optional(), reason_fit: z.string().max(1000).optional(),
});
export const chatMessageSchema = z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(4000), jobs: z.array(chatJobSchema).max(8).optional() });
export const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(2000), messages: z.array(chatMessageSchema.pick({ role: true, content: true })).max(20).default([]),
  profile: chatProfileSchema.default({}), user_location: chatLocationSchema.nullish(), lang: z.enum(['uz', 'ru']).default('uz'),
});
export const chatResponseSchema = z.object({ response: z.string().min(1).max(4000), jobs: z.array(chatJobSchema).max(8), profile: chatProfileSchema });
export type ChatProfile = z.infer<typeof chatProfileSchema>;
export type ChatLocation = z.infer<typeof chatLocationSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export function readChatProfile(value: unknown): ChatProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(chatProfileSchema.shape).flatMap(([key, schema]) => {
    const result = schema.safeParse((value as Record<string, unknown>)[key]);
    return result.success && result.data !== undefined ? [[key, result.data]] : [];
  })) as ChatProfile;
}
