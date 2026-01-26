/**
 * Zod Schemas for AI Job Search
 * Validates Gemini responses and ensures type safety
 */

import { z } from 'zod';

// Filter schema that Gemini should return
export const JobSearchFiltersSchema = z.object({
    keywords: z.array(z.string()).default([]),
    region_name: z.string().optional(),
    district_name: z.string().optional(),
    employment_type: z.enum(['full_time', 'part_time', 'remote', 'contract']).optional(),
    work_mode: z.enum(['onsite', 'remote', 'hybrid']).optional(),
    salary_min: z.number().optional(),
    salary_max: z.number().optional(),
    experience_years: z.number().optional(),
    is_for_students: z.boolean().optional(),
    is_for_disabled: z.boolean().optional(),
    is_for_women: z.boolean().optional(),
});

export type JobSearchFilters = z.infer<typeof JobSearchFiltersSchema>;

// Full AI response schema
export const AiSearchResponseSchema = z.object({
    intent: z.enum(['search', 'question', 'greeting', 'other']).default('search'),
    filters: JobSearchFiltersSchema,
    reply_language: z.enum(['uz', 'ru']).default('uz'),
    user_message: z.string().optional(), // AI's response to user
});

export type AiSearchResponse = z.infer<typeof AiSearchResponseSchema>;

// Request schema for API endpoint
export const SearchRequestSchema = z.object({
    query: z.string().min(1).max(500),
    userId: z.string().optional(),
    platform: z.enum(['web', 'telegram']).default('web'),
    lang: z.enum(['uz', 'ru']).default('uz'),
});

export type SearchRequest = z.infer<typeof SearchRequestSchema>;

// Job result schema (from Supabase)
export const JobResultSchema = z.object({
    id: z.string(),
    title_uz: z.string(),
    title_ru: z.string().nullable(),
    company_name: z.string(),
    salary_min: z.number().nullable(),
    salary_max: z.number().nullable(),
    region_name: z.string().nullable(),
    district_name: z.string().nullable(),
    employment_type: z.string().nullable(),
    source_url: z.string().nullable(),
});

export type JobResult = z.infer<typeof JobResultSchema>;

// Final API response
export const ApiResponseSchema = z.object({
    success: z.boolean(),
    mode: z.enum(['smart', 'eco', 'fallback']),
    filters: JobSearchFiltersSchema.optional(),
    jobs: z.array(JobResultSchema).default([]),
    message: z.string(),
    total_found: z.number().default(0),
    warning: z.string().optional(), // For moderation warnings
    cached: z.boolean().default(false),
});

export type ApiResponse = z.infer<typeof ApiResponseSchema>;
