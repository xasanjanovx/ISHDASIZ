/**
 * Unified AI Search Endpoint
 * 
 * Serves both website and Telegram bot
 * Features: Moderation, Rate Limiting, Caching, Smart/Eco modes, Fallback
 * 
 * POST /api/ai/search
 * Body: { query, userId?, platform?, lang? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// AI modules
import { extractFilters, type AiMode } from '@/lib/ai/gemini-client';
import { checkForAbuse, sanitizeInput, WARNING_MESSAGES } from '@/lib/ai/moderation';
import { checkRateLimit, getUserIdentifier } from '@/lib/ai/rate-limiter';
import { generateCacheKey, getFromCache, setCache } from '@/lib/ai/cache';
import { SearchRequestSchema, type ApiResponse, type JobResult } from '@/lib/ai/schemas';
import { SUCCESS_TEMPLATES, NO_RESULTS_RESPONSES, ERROR_RESPONSES } from '@/lib/ai/prompts';

// Supabase admin client
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Region name to ID mapping (cached on first load)
let regionsCache: { id: number; name_uz: string; name_ru: string }[] = [];
let districtsCache: { id: string; name_uz: string; region_id: number }[] = [];

async function loadLocationCache() {
    if (regionsCache.length > 0) return;

    const [regionsRes, districtsRes] = await Promise.all([
        supabaseAdmin.from('regions').select('id, name_uz, name_ru'),
        supabaseAdmin.from('districts').select('id, name_uz, region_id'),
    ]);

    regionsCache = regionsRes.data || [];
    districtsCache = districtsRes.data || [];
}

function findRegionId(name?: string): number | null {
    if (!name) return null;
    const normalized = name.toLowerCase().replace(/[''`ʻ]/g, '');

    for (const region of regionsCache) {
        if (
            region.name_uz.toLowerCase().includes(normalized) ||
            region.name_ru?.toLowerCase().includes(normalized) ||
            normalized.includes(region.name_uz.toLowerCase().replace(/[''`ʻ]/g, ''))
        ) {
            return region.id;
        }
    }
    return null;
}

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        // 1. Parse and validate request
        const body = await request.json();
        const parseResult = SearchRequestSchema.safeParse(body);

        if (!parseResult.success) {
            return NextResponse.json({
                success: false,
                mode: 'fallback',
                jobs: [],
                message: 'Invalid request',
                total_found: 0,
                cached: false,
            } as ApiResponse, { status: 400 });
        }

        const { query, userId, platform, lang } = parseResult.data;

        // 2. Rate limiting
        const userIdentifier = getUserIdentifier(
            userId,
            request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined
        );

        const rateLimit = checkRateLimit(userIdentifier);
        if (!rateLimit.allowed) {
            return NextResponse.json({
                success: false,
                mode: 'eco',
                jobs: [],
                message: WARNING_MESSAGES.rate_limit[lang],
                total_found: 0,
                warning: WARNING_MESSAGES.rate_limit[lang],
                cached: false,
            } as ApiResponse, { status: 429 });
        }

        // 3. Sanitize and check for abuse
        const sanitizedQuery = sanitizeInput(query);
        const moderation = checkForAbuse(sanitizedQuery);

        if (!moderation.allowed) {
            // Log abuse attempt
            try {
                await supabaseAdmin.from('ai_abuse_logs').insert({
                    user_id: userId || null,
                    query: query.slice(0, 500),
                    reason: moderation.reason,
                    platform,
                    ip_address: request.headers.get('x-forwarded-for') || null,
                });
            } catch (logError) {
                console.error('[AI] Failed to log abuse:', logError);
            }

            return NextResponse.json({
                success: false,
                mode: 'eco',
                jobs: [],
                message: moderation.warningMessage?.[lang] || 'Request blocked',
                total_found: 0,
                warning: moderation.warningMessage?.[lang],
                cached: false,
            } as ApiResponse);
        }

        // 4. Check cache
        const cacheKey = generateCacheKey(sanitizedQuery, lang);
        const cachedResponse = getFromCache<ApiResponse>(cacheKey);

        if (cachedResponse) {
            return NextResponse.json({
                ...cachedResponse,
                cached: true,
            });
        }

        // 5. Load location cache
        await loadLocationCache();

        // 6. Extract filters using Gemini
        let mode: AiMode = 'eco';
        let filters: any = { keywords: [] };
        let aiMessage: string | undefined;

        try {
            const extraction = await extractFilters(sanitizedQuery, lang);
            mode = extraction.mode;
            filters = extraction.result.filters;
            aiMessage = extraction.result.user_message;

            // Handle greetings
            if (extraction.result.intent === 'greeting') {
                const response: ApiResponse = {
                    success: true,
                    mode,
                    jobs: [],
                    message: aiMessage || 'Salom!',
                    total_found: 0,
                    cached: false,
                };
                setCache(cacheKey, response, true);
                return NextResponse.json(response);
            }

        } catch (aiError) {
            console.error('[AI] Gemini error, using fallback:', aiError);
            mode = 'fallback' as any;
            // Fallback: simple keyword extraction
            filters.keywords = sanitizedQuery
                .split(/\s+/)
                .filter(w => w.length > 2)
                .slice(0, 5);
        }

        // 7. Build Supabase query
        let dbQuery = supabaseAdmin
            .from('jobs')
            .select(`
        id, title_uz, title_ru, company_name,
        salary_min, salary_max,
        region_name, district_name,
        employment_type, source_url
      `)
            .eq('is_active', true)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(15);

        // Apply keyword filter
        if (filters.keywords && filters.keywords.length > 0) {
            const keywordFilters = filters.keywords
                .map((kw: string) => `title_uz.ilike.%${kw}%,title_ru.ilike.%${kw}%,company_name.ilike.%${kw}%`)
                .join(',');
            dbQuery = dbQuery.or(keywordFilters);
        }

        // Apply region filter
        if (filters.region_name) {
            const regionId = findRegionId(filters.region_name);
            if (regionId) {
                dbQuery = dbQuery.eq('region_id', regionId);
            }
        }

        // Apply work mode filter
        if (filters.work_mode) {
            dbQuery = dbQuery.eq('work_mode', filters.work_mode);
        }

        // Apply employment type filter
        if (filters.employment_type) {
            dbQuery = dbQuery.eq('employment_type', filters.employment_type);
        }

        // Apply salary filter
        if (filters.salary_min) {
            dbQuery = dbQuery.gte('salary_max', filters.salary_min);
        }

        // Apply special filters
        if (filters.is_for_students) {
            dbQuery = dbQuery.eq('is_for_students', true);
        }
        if (filters.is_for_disabled) {
            dbQuery = dbQuery.eq('is_for_disabled', true);
        }
        if (filters.experience_years === 0) {
            dbQuery = dbQuery.or('experience_years.eq.0,experience_years.is.null');
        }

        // 8. Execute query
        const { data: jobs, error: dbError } = await dbQuery;

        if (dbError) {
            console.error('[AI] Database error:', dbError);
            return NextResponse.json({
                success: false,
                mode: mode as any,
                jobs: [],
                message: ERROR_RESPONSES[lang],
                total_found: 0,
                cached: false,
            } as ApiResponse, { status: 500 });
        }

        // 9. Format response
        const jobResults: JobResult[] = (jobs || []).map(job => ({
            id: job.id,
            title_uz: job.title_uz,
            title_ru: job.title_ru,
            company_name: job.company_name,
            salary_min: job.salary_min,
            salary_max: job.salary_max,
            region_name: job.region_name,
            district_name: job.district_name,
            employment_type: job.employment_type,
            source_url: job.source_url,
        }));

        const totalFound = jobResults.length;

        // Generate message
        let message: string;
        if (totalFound === 0) {
            message = NO_RESULTS_RESPONSES[lang];
        } else {
            message = SUCCESS_TEMPLATES[lang](totalFound);
        }

        // 10. Build final response
        const response: ApiResponse = {
            success: true,
            mode: mode as any,
            filters,
            jobs: jobResults,
            message,
            total_found: totalFound,
            cached: false,
        };

        // Cache the response
        setCache(cacheKey, response, mode === 'eco');

        // Log request (optional, for analytics)
        console.log(`[AI] ${mode} | ${Date.now() - startTime}ms | ${totalFound} jobs | "${sanitizedQuery.slice(0, 50)}"`);

        return NextResponse.json(response);

    } catch (error: any) {
        console.error('[AI] Unexpected error:', error);
        return NextResponse.json({
            success: false,
            mode: 'fallback',
            jobs: [],
            message: ERROR_RESPONSES.uz,
            total_found: 0,
            cached: false,
        } as ApiResponse, { status: 500 });
    }
}

// Health check endpoint
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        cache_stats: { size: 0 }, // Would need to import getCacheStats
    });
}
