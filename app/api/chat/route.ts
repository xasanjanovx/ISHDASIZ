/**
 * ISHDASIZ Smart AI Chat - Enhanced with Session & Geo
 * 
 * Features:
 * 1. Validated tab-local history; no server lookup by browser-supplied session ID
 * 2. Deep understanding of chaotic/short messages
 * 3. Geo-location search (lat/lng nearby)
 * 4. Profile collection before search
 * 5. Intelligent reranking with Gemini
 * 
 * Architecture:
 * A) Validate tab state → B) Gemini understands → C) Update profile
 * D) If ready: SQL search → Gemini rerank → Return jobs
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { REGION_COORDINATES } from '@/lib/constants';
import { generateVertexText, vertexConfigured } from '@/lib/ai/vertex-client';
import { z } from 'zod';
import { chatRequestSchema, chatResponseSchema, readChatProfile } from '@/lib/ai/chat-contract';
import { checkRateLimit } from '@/lib/ai/rate-limiter';
import { AccountError, accountFailure, accountResult, checkSameOrigin } from '@/lib/auth/account';

// ============================================================================
// INITIALIZATION
// ============================================================================

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MODEL = process.env.VERTEX_MODEL || 'gemini-2.5-flash';

// ============================================================================
// TYPES
// ============================================================================

interface UserProfile {
    category?: string;
    category_id?: string;
    skills?: string[];
    experience_years?: number;
    salary_min?: number;
    region?: string;
    region_id?: number;
    work_mode?: 'remote' | 'onsite' | 'any';
    exclude_keywords?: string[];
    profile_complete?: boolean;
}

interface UserLocation {
    lat: number;
    lng: number;
}

// ============================================================================
// CATEGORIES & REGIONS
// ============================================================================

const CATEGORIES_INFO = `
Mavjud kategoriyalar (ID bilan):
- Axborot texnologiyalari (id: a0000001-0001-4000-8000-000000000001) - dasturchi, developer, react, python, IT
- Sanoat va ishlab chiqarish (id: a0000002-0002-4000-8000-000000000002) - zavod, fabrika, tikuvchi
- Xizmatlar (id: a0000003-0003-4000-8000-000000000003) - oshpaz, ofitsiant, farrosh, qorovul
- Ta'lim, madaniyat, sport (id: a0000004-0004-4000-8000-000000000004) - o'qituvchi, murabbiy
- Sog'liqni saqlash (id: a0000005-0005-4000-8000-000000000005) - shifokor, hamshira
- Moliya, iqtisod, boshqaruv (id: a0000006-0006-4000-8000-000000000006) - buxgalter, direktor
- Qurilish (id: a0000007-0007-4000-8000-000000000007) - usta, elektrik, santexnik
- Qishloq xo'jaligi (id: a0000008-0008-4000-8000-000000000008) - fermer, dehqon
- Transport (id: a0000009-0009-4000-8000-000000000009) - haydovchi, kurier, logist
- Savdo va marketing (id: a0000010-0010-4000-8000-000000000010) - sotuvchi, kassir, smm
`;

const REGIONS_INFO = 'Viloyatlar (ID bilan):\n' + Object.entries(REGION_COORDINATES).map(([id, region]) => `- ${region.name} (${id})`).join('\n');

// ============================================================================
// GEMINI - UNDERSTAND & EXTRACT - FALLBACKS
// ============================================================================

const REGION_MAP: Record<string, number> = {
    'toshkent viloyati': 17, 'ташкентская область': 17,
    'toshkent shahri': 22, 'toshkent': 22, 'tashkent': 22,
    'andijon': 12, 'andijan': 12,
    'farg\'ona': 13, 'fergana': 13, 'fargona': 13,
    'namangan': 21,
    'samarqand': 10, 'samarkand': 10,
    'buxoro': 9, 'bukhara': 9,
    'xorazm': 16, 'khorezm': 16, 'urganch': 16,
    'qashqadaryo': 18, 'kashkadarya': 18, 'qarshi': 18,
    'surxondaryo': 14, 'surkhandarya': 14, 'termez': 14,
    'jizzax': 19, 'jizzakh': 19,
    'sirdaryo': 15, 'syrdarya': 15, 'guliston': 15,
    'navoiy': 11, 'navoi': 11,
    'qoraqalpog\'iston': 8, 'karakalpakstan': 8, 'nukus': 8,
    'ташкент': 22, 'андижан': 12, 'ферган': 13, 'наманган': 21, 'самарканд': 10,
    'бухар': 9, 'хорезм': 16, 'ургенч': 16, 'кашкадар': 18, 'карши': 18,
    'сурхандар': 14, 'термез': 14, 'джизак': 19, 'сырдар': 15, 'гулистан': 15,
    'навои': 11, 'каракалпак': 8, 'нукус': 8
};

const CATEGORY_MAP: Record<string, string> = {
    // IT - Axborot texnologiyalari
    'it': 'a0000001-0001-4000-8000-000000000001',
    'dasturlash': 'a0000001-0001-4000-8000-000000000001',
    'developer': 'a0000001-0001-4000-8000-000000000001',
    'frontend': 'a0000001-0001-4000-8000-000000000001',
    'backend': 'a0000001-0001-4000-8000-000000000001',
    'react': 'a0000001-0001-4000-8000-000000000001',
    'python': 'a0000001-0001-4000-8000-000000000001',

    // Production - Sanoat va ishlab chiqarish
    'ishlab chiqarish': 'a0000002-0002-4000-8000-000000000002',
    'sanoat': 'a0000002-0002-4000-8000-000000000002',
    'zavod': 'a0000002-0002-4000-8000-000000000002',
    'fabrika': 'a0000002-0002-4000-8000-000000000002',
    'tikuvchi': 'a0000002-0002-4000-8000-000000000002',

    // Services - Xizmatlar
    'xizmatlar': 'a0000003-0003-4000-8000-000000000003',
    'oshpaz': 'a0000003-0003-4000-8000-000000000003',
    'ofitsiant': 'a0000003-0003-4000-8000-000000000003',
    'farrosh': 'a0000003-0003-4000-8000-000000000003',
    'qorovul': 'a0000003-0003-4000-8000-000000000003',

    // Education - Ta'lim, madaniyat, sport
    'ta\'lim': 'a0000004-0004-4000-8000-000000000004',
    'o\'qituvchi': 'a0000004-0004-4000-8000-000000000004',
    'ustoz': 'a0000004-0004-4000-8000-000000000004',
    'murabbiy': 'a0000004-0004-4000-8000-000000000004',

    // Healthcare - Sog'liqni saqlash
    'tibbiyot': 'a0000005-0005-4000-8000-000000000005',
    'shifokor': 'a0000005-0005-4000-8000-000000000005',
    'hamshira': 'a0000005-0005-4000-8000-000000000005',

    // Finance - Moliya, iqtisod, boshqaruv
    'moliya': 'a0000006-0006-4000-8000-000000000006',
    'buxgalter': 'a0000006-0006-4000-8000-000000000006',
    'iqtisod': 'a0000006-0006-4000-8000-000000000006',
    'direktor': 'a0000006-0006-4000-8000-000000000006',

    // Construction - Qurilish
    'qurilish': 'a0000007-0007-4000-8000-000000000007',
    'usta': 'a0000007-0007-4000-8000-000000000007',
    'elektrik': 'a0000007-0007-4000-8000-000000000007',
    'santexnik': 'a0000007-0007-4000-8000-000000000007',

    // Agriculture - Qishloq xo'jaligi
    'qishloq': 'a0000008-0008-4000-8000-000000000008',
    'fermer': 'a0000008-0008-4000-8000-000000000008',
    'dehqon': 'a0000008-0008-4000-8000-000000000008',

    // Transport
    'transport': 'a0000009-0009-4000-8000-000000000009',
    'haydovchi': 'a0000009-0009-4000-8000-000000000009',
    'kurier': 'a0000009-0009-4000-8000-000000000009',
    'logist': 'a0000009-0009-4000-8000-000000000009',

    'программист': 'a0000001-0001-4000-8000-000000000001',
    'разработчик': 'a0000001-0001-4000-8000-000000000001',
    'водитель': 'a0000009-0009-4000-8000-000000000009',
    'учител': 'a0000004-0004-4000-8000-000000000004',
    'бухгалтер': 'a0000006-0006-4000-8000-000000000006',
    'продавец': 'a0000010-0010-4000-8000-000000000010',
    // Sales & Marketing - Savdo va marketing
    'savdo': 'a0000010-0010-4000-8000-000000000010',
    'sotuvchi': 'a0000010-0010-4000-8000-000000000010',
    'kassir': 'a0000010-0010-4000-8000-000000000010',
    'marketing': 'a0000010-0010-4000-8000-000000000010',
    'smm': 'a0000010-0010-4000-8000-000000000010'
};

function fallbackUnderstanding(message: string, currentProfile: UserProfile, lang: 'uz' | 'ru'): GeminiUnderstanding {
    const lower = message.toLowerCase();
    const updates: Partial<UserProfile> = {};

    // Check categories
    for (const [key, id] of Object.entries(CATEGORY_MAP)) {
        if (lower.includes(key)) {
            updates.category_id = id;
            updates.category = key.charAt(0).toUpperCase() + key.slice(1);
            break; // Stop at first match to avoid confusion
        }
    }

    // Check regions
    for (const [key, id] of Object.entries(REGION_MAP)) {
        if (lower.includes(key)) {
            updates.region_id = id;
            updates.region = key.charAt(0).toUpperCase() + key.slice(1);
            break;
        }
    }

    // Determine state
    const mergedProfile = { ...currentProfile, ...updates };
    // Safe checks using optional chaining logic equivalent
    const hasCategory = mergedProfile.category_id !== undefined;
    const hasRegion = mergedProfile.region_id !== undefined;
    const isNearbyRequest = lower.includes('yaqin') || lower.includes('nearby');

    // If both exist OR (category + nearby), then search
    if (hasCategory && (hasRegion || isNearbyRequest)) {
        return {
            intent: 'search',
            profile_updates: updates,
            search_ready: true
        };
    }

    // If only category -> ask region
    if (hasCategory) {
        return {
            intent: 'search',
            profile_updates: updates,
            search_ready: false,
            next_question: lang === 'ru' ? "В каком регионе ищете работу?" : "Qaysi hududda ish qidiryapsiz?"
        };
    }

    // If only region -> ask category
    if (hasRegion) {
        return {
            intent: 'search',
            profile_updates: updates,
            search_ready: false,
            next_question: lang === 'ru' ? "В какой сфере хотите работать?" : "Qaysi sohada ishlamoqchisiz?"
        };
    }

    // Nothing found
    return {
        intent: 'clarify',
        profile_updates: {},
        search_ready: false,
        response_text: lang === 'ru' ? "Укажите сферу и регион. Например: IT, Ташкент." : "Soha va hududni yozing. Masalan: IT, Toshkent."
    };
}

// ============================================================================
// GEMINI - UNDERSTAND & EXTRACT
// ============================================================================

interface GeminiUnderstanding {
    intent: 'greeting' | 'search' | 'clarify' | 'feedback';
    profile_updates: Partial<UserProfile>;
    search_ready: boolean;
    response_text?: string;
    next_question?: string;
}

async function understandWithGemini(
    message: string,
    history: any[],
    currentProfile: UserProfile,
    lang: 'uz' | 'ru'
): Promise<GeminiUnderstanding> {
    const historyText = history.slice(-5).map((m: any) => `${m.role}: ${m.content}`).join('\n');

    const prompt = `Sen HR yordamchisissan. Javob tilini saqla: ${lang === 'ru' ? 'Russian' : 'Uzbek'}. Foydalanuvchi xabarini tushun va profil yangilanishlarini chiqar.

JORIY PROFIL: ${JSON.stringify(currentProfile)}

XABAR: "${message}"
${historyText ? `OLDINGI SUHBAT:\n${historyText}` : ''}

${CATEGORIES_INFO}
${REGIONS_INFO}

VAZIFA:
1. Foydalanuvchi nimani xohlayotganini tushun (xato yozsa ham, qisqa yozsa ham)
2. Agar soha/hudud/maosh/skill aytilsa - profile_updates ga qo'sh
3. Agar profil to'liq (category + region) - search_ready: true
4. Agar profil to'liq emas - next_question ber

MUHIM QOIDALAR:
- "mnga osh krk" = "menga ish kerak"
- "itda" = IT sohasida
- "andjondan" = Andijon
- "react, noda" = skills: [React, Node.js]
- Agar faqat "salom" - bu greeting
- Agar soha aytilsa lekin hudud yo'q - so'ra
- Agar ikkalasi bor - search_ready: true

JSON FORMAT:
{
  "intent": "greeting|search|clarify|feedback",
  "profile_updates": {
    "category": "IT va Texnologiyalar",
    "category_id": "a0000001-0001-4000-8000-000000000001",
    "region": "Andijon",
    "region_id": 12,
    "skills": ["React"],
    "salary_min": 5000000,
    "work_mode": "remote"
  },
  "search_ready": true,
  "response_text": "Agar greeting/clarify bo'lsa - javob",
  "next_question": "Agar profil to'liq emas - savol"
}

FAQAT JSON QAYTAR.`;

    if (!vertexConfigured()) return fallbackUnderstanding(message, currentProfile, lang);
    try {
        const text = await generateVertexText(prompt, { model: MODEL, maxOutputTokens: 600, temperature: 0.15, responseMimeType: 'application/json' });

        // Robust JSON cleaning
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}');
        if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON found');

        const cleaned = text.substring(jsonStart, jsonEnd + 1);
        return z.object({ intent: z.enum(['greeting', 'search', 'clarify', 'feedback']), profile_updates: z.unknown().transform(readChatProfile), search_ready: z.boolean(), response_text: z.string().max(3000).optional(), next_question: z.string().max(1000).optional() }).parse(JSON.parse(cleaned));
    } catch (error) {
        console.error('[AI] Understanding unavailable; using keyword search');
        // CRITICAL FALLBACK (Never say 'I dont understand' if keywords exist)
        return fallbackUnderstanding(message, currentProfile, lang);
    }
}

// ============================================================================
// HAVERSINE DISTANCE
// ============================================================================

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ============================================================================
// DATABASE SEARCH
// ============================================================================

async function searchCandidates(profile: UserProfile, userLocation?: UserLocation): Promise<any[]> {
    let query = supabase
        .from('jobs')
        .select(`
            id, title_uz, title_ru, company_name,
            description_uz, requirements_uz,
            salary_min, salary_max, work_mode,
            region_id, region_name, district_name,
            latitude, longitude,
            districts(name_uz, regions(name_uz))
        `)
        .eq('ishdasiz_job_available', true)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(30);

    // Category filter
    if (profile.category_id) {
        query = query.eq('category_id', profile.category_id);
    }

    // Region filter
    if (profile.region_id) {
        query = query.eq('region_id', profile.region_id);
    }

    // Work mode
    if (profile.work_mode === 'remote' || profile.work_mode === 'onsite') {
        query = query.eq('work_mode', profile.work_mode);
    }

    // Salary
    if (profile.salary_min) {
        query = query.gte('salary_max', profile.salary_min);
    }

    const { data, error } = await query;
    if (error) {
        throw new AccountError(503, 'Поиск временно недоступен / Qidiruv vaqtincha mavjud emas');
    }

    let jobs: any[] = data || [];

    // Add distance if user location provided
    if (userLocation) {
        jobs = jobs.map(job => ({
            ...job,
            distance_km: (Number.isFinite(job.latitude) && Math.abs(job.latitude) <= 90 && Number.isFinite(job.longitude) && Math.abs(job.longitude) <= 180)
                ? Math.round(haversineDistance(userLocation.lat, userLocation.lng, job.latitude, job.longitude))
                : null
        }));

        // Sort by distance
        jobs.sort((a, b) => {
            if (a.distance_km === null) return 1;
            if (b.distance_km === null) return -1;
            return a.distance_km - b.distance_km;
        });
    }

    // Exclude keywords
    if (profile.exclude_keywords && profile.exclude_keywords.length > 0) {
        jobs = jobs.filter(job => {
            const title = (job.title_uz || '').toLowerCase();
            return !profile.exclude_keywords!.some(kw => title.includes(kw.toLowerCase()));
        });
    }

    return jobs;
}

// ============================================================================
// GEMINI RERANK
// ============================================================================

interface RerankResult {
    ranked_jobs: { job_id: string; score: number; reason: string }[];
    advice?: string;
}

async function rerankWithGemini(jobs: any[], profile: UserProfile, lang: 'uz' | 'ru'): Promise<RerankResult> {
    if (jobs.length === 0) {
        return { ranked_jobs: [] };
    }

    // For small result sets, skip reranking
    if (jobs.length <= 5 || !vertexConfigured()) {
        return {
            ranked_jobs: jobs.slice(0, 8).map((j, i) => ({
                job_id: j.id,
                score: 80 - i * 5,
                reason: lang === 'ru' ? 'Соответствует условиям поиска' : 'Mezonlaringizga mos'
            }))
        };
    }

    // Prepare compact job data for Gemini
    const jobsForAI = jobs.slice(0, 20).map(j => ({
        id: j.id,
        title: j.title_uz || j.title_ru,
        company: j.company_name,
        description: (j.description_uz || '').slice(0, 200),
        requirements: (j.requirements_uz || '').slice(0, 150),
        salary: `${(j.salary_min || 0) / 1e6}-${(j.salary_max || 0) / 1e6} mln`,
        distance_km: j.distance_km
    }));

    const prompt = `Sen HR mutaxassisi. Vakansiyalarni profilga qarab RERANK qil.

PROFIL:
${JSON.stringify(profile, null, 2)}

VAKANSIYALAR:
${JSON.stringify(jobsForAI, null, 2)}

VAZIFA:
1. Har bir vakansiyaning title, description, requirements ni O'QI
2. Profilga mos kelishini bahola (0-100)
3. TOP 8 ni tanla, qisqa sabab yoz (${lang === 'ru' ? 'Russian' : 'Uzbek'})
4. distance_km yaqinroq bo'lsa, bonus ber

JSON:
{
  "ranked_jobs": [
    { "job_id": "uuid", "score": 95, "reason": "React talabiga mos, yaqinda" }
  ],
  "advice": "Umumiy maslahat (ixtiyoriy)"
}`;

    try {
        const text = await generateVertexText(prompt, { model: MODEL, maxOutputTokens: 800, temperature: 0.2, responseMimeType: 'application/json' });
        const cleaned = text.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();

        const ranking = z.object({ ranked_jobs: z.array(z.object({ job_id: z.string().uuid(), score: z.number().finite().min(0).max(100), reason: z.string().max(1000) })).max(8), advice: z.string().max(1000).optional() }).parse(JSON.parse(cleaned));
        const seen = new Set<string>();
        const ranked_jobs = ranking.ranked_jobs.filter(item => {
            if (seen.has(item.job_id) || !jobs.some(job => job.id === item.job_id)) return false;
            seen.add(item.job_id); return true;
        });
        if (!ranked_jobs.length) throw new Error('No valid ranked jobs');
        return { ...ranking, ranked_jobs };
    } catch (error) {
        console.error('[AI] Ranking unavailable; using search order');
        // Fallback to simple ranking
        return {
            ranked_jobs: jobs.slice(0, 8).map((j, i) => ({
                job_id: j.id,
                score: 90 - i * 5,
                reason: lang === 'ru' ? 'Соответствует условиям поиска' : 'Mezonlaringizga mos'
            }))
        };
    }
}

// ============================================================================
// FORMAT JOBS FOR CARD
// ============================================================================

function formatJobsForCard(jobs: any[], rerank: RerankResult, lang: 'uz' | 'ru'): any[] {
    const seen = new Set<string>();

    return rerank.ranked_jobs.map(r => {
        const job = jobs.find(j => j.id === r.job_id);
        if (!job || seen.has(job.id)) return null;
        seen.add(job.id);

        // Build location
        let location = '';
        if (job.districts?.regions?.name_uz) {
            location = job.districts.regions.name_uz;
            if (job.districts.name_uz) {
                location = `${job.districts.name_uz}, ${location}`;
            }
        } else if (job.region_name) {
            location = job.region_name;
        }

        // Add distance if available
        if (job.distance_km !== null && job.distance_km !== undefined) {
            location = `${location} (${job.distance_km} km)`;
        }

        // Format salary
        const salaryMin = job.salary_min ? Math.round(job.salary_min / 1e6) : 0;
        const salaryMax = job.salary_max ? Math.round(job.salary_max / 1e6) : 0;
        let salary = lang === 'ru' ? 'По договорённости' : 'Kelishiladi';
        const unit = lang === 'ru' ? 'млн сум' : 'mln so‘m';
        if (salaryMin && salaryMax) salary = salaryMin + '–' + salaryMax + ' ' + unit;
        else if (salaryMax) salary = (lang === 'ru' ? 'до ' : '') + salaryMax + ' ' + unit + (lang === 'uz' ? ' gacha' : '');
        else if (salaryMin) salary = (lang === 'ru' ? 'от ' : '') + salaryMin + ' ' + unit + (lang === 'uz' ? ' dan' : '');

        return {
            id: job.id,
            title: (lang === 'ru' ? job.title_ru || job.title_uz : job.title_uz || job.title_ru) || (lang === 'ru' ? 'Вакансия' : 'Vakansiya'),
            company: job.company_name || 'Kompaniya',
            salary,
            location,
            work_mode: job.work_mode === 'remote' ? (lang === 'ru' ? 'Удалённо' : 'Masofaviy') : '',
            match_score: r.score,
            reason_fit: r.reason
        };
    }).filter(Boolean);
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
    try {
        checkSameOrigin(request);
        const raw = await request.text();
        if (raw.length > 100_000) throw new AccountError(413, 'Сообщение слишком большое / Xabar juda uzun');
        let body: unknown;
        try { body = JSON.parse(raw); } catch { throw new AccountError(400, 'Неверный запрос / Noto‘g‘ri so‘rov'); }
        const parsed = chatRequestSchema.safeParse(body);
        if (!parsed.success) throw new AccountError(400, 'Проверьте сообщение / Xabarni tekshiring');
        const { message, messages: history, profile: currentProfile, user_location: userLocation, lang } = parsed.data;
        // Browser-supplied session/user IDs never determine history ownership or the rate-limit key.
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
        const limit = checkRateLimit('chat:ip:' + ip);
        if (!limit.allowed) throw new AccountError(429, 'Слишком много запросов. Подождите минуту / Bir daqiqa kuting');
        const understanding = await understandWithGemini(message, history, currentProfile, lang);
        const profile = readChatProfile({ ...currentProfile, ...understanding.profile_updates });
        if (understanding.intent === 'greeting' || !understanding.search_ready) {
            return accountResult(chatResponseSchema.parse({
                response: understanding.response_text || understanding.next_question || (lang === 'ru' ? 'В какой сфере и регионе ищете работу?' : 'Qaysi soha va hududda ish qidiryapsiz?'),
                jobs: [], profile,
            }));
        }
        const jobs = await searchCandidates(profile, userLocation || undefined);
        const rerank = await rerankWithGemini(jobs, profile, lang);
        const formattedJobs = formatJobsForCard(jobs, rerank, lang);
        const response = formattedJobs.length === 0
            ? (lang === 'ru' ? 'Подходящих вакансий не найдено. Попробуйте другую сферу или регион.' : 'Mos vakansiya topilmadi. Boshqa soha yoki hududni sinab ko‘ring.')
            : (lang === 'ru' ? 'Подобрано вакансий: ' : 'Mos vakansiyalar: ') + formattedJobs.length + (rerank.advice ? '\n\n' + rerank.advice : '');
        return accountResult(chatResponseSchema.parse({ response, jobs: formattedJobs, profile: { ...profile, profile_complete: true } }));
    } catch (error) {
        return accountFailure(error);
    }
}
