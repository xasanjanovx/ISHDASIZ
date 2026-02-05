/**
 * ISHDASIZ Smart AI Chat - Enhanced with Session & Geo
 * 
 * Features:
 * 1. Session memory (Supabase) - persists until tab close
 * 2. Deep understanding of chaotic/short messages
 * 3. Geo-location search (lat/lng nearby)
 * 4. Profile collection before search
 * 5. Intelligent reranking with Gemini
 * 
 * Architecture:
 * A) Load session → B) Gemini understands → C) Update profile
 * D) If ready: SQL search → Gemini rerank → Return jobs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ============================================================================
// INITIALIZATION
// ============================================================================

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MODEL = 'gemini-2.5-flash';

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

const REGIONS_INFO = `
Viloyatlar (ID bilan):
- Toshkent shahri (1), Toshkent viloyati (27)
- Andijon (2), Farg'ona (3), Namangan (4)
- Samarqand (5), Buxoro (6), Xorazm (7)
- Qashqadaryo (8), Surxondaryo (9), Jizzax (10)
- Sirdaryo (11), Navoiy (12), Qoraqalpog'iston (14)
`;

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

async function loadSession(sessionId: string): Promise<{ profile: UserProfile; messages: any[] }> {
    if (!sessionId) return { profile: {}, messages: [] };

    const { data } = await supabase
        .from('ai_sessions')
        .select('profile, messages')
        .eq('session_id', sessionId)
        .maybeSingle();

    return {
        profile: data?.profile || {},
        messages: data?.messages || []
    };
}

async function saveSession(sessionId: string, profile: UserProfile, messages: any[]): Promise<void> {
    if (!sessionId) return;

    await supabase
        .from('ai_sessions')
        .upsert({
            session_id: sessionId,
            profile,
            messages: messages.slice(-10),
            updated_at: new Date().toISOString()
        }, { onConflict: 'session_id' });
}

// ============================================================================
// GEMINI - UNDERSTAND & EXTRACT - FALLBACKS
// ============================================================================

const REGION_MAP: Record<string, number> = {
    'toshkent shahri': 1, 'toshkent': 1, 'tashkent': 1,
    'andijon': 2, 'andijan': 2,
    'farg\'ona': 3, 'fergana': 3, 'fargona': 3,
    'namangan': 4,
    'samarqand': 5, 'samarkand': 5,
    'buxoro': 6, 'bukhara': 6,
    'xorazm': 7, 'khorezm': 7, 'urganch': 7,
    'qashqadaryo': 8, 'kashkadarya': 8, 'qarshi': 8,
    'surxondaryo': 9, 'surkhandarya': 9, 'termez': 9,
    'jizzax': 10, 'jizzakh': 10,
    'sirdaryo': 11, 'syrdarya': 11, 'guliston': 11,
    'navoiy': 12, 'navoi': 12,
    'qoraqalpog\'iston': 14, 'karakalpakstan': 14, 'nukus': 14
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

    // Sales & Marketing - Savdo va marketing
    'savdo': 'a0000010-0010-4000-8000-000000000010',
    'sotuvchi': 'a0000010-0010-4000-8000-000000000010',
    'kassir': 'a0000010-0010-4000-8000-000000000010',
    'marketing': 'a0000010-0010-4000-8000-000000000010',
    'smm': 'a0000010-0010-4000-8000-000000000010'
};

function fallbackUnderstanding(message: string, currentProfile: UserProfile): GeminiUnderstanding {
    console.log('[AI] Using fallback logic for:', message);
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
            next_question: "Qaysi hududda ish qidiryapsiz? (Yoki 'joylashuvim' tugmasini bosing)"
        };
    }

    // If only region -> ask category
    if (hasRegion) {
        return {
            intent: 'search',
            profile_updates: updates,
            search_ready: false,
            next_question: "Qaysi sohada ishlamoqchisiz?"
        };
    }

    // Nothing found
    return {
        intent: 'clarify',
        profile_updates: {},
        search_ready: false,
        response_text: "Kechirasiz, aniqroq yozing. Masalan: 'Andijonda IT ish kerak' yoki 'Toshkentda haydovchi'"
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
    currentProfile: UserProfile
): Promise<GeminiUnderstanding> {
    const historyText = history.slice(-5).map((m: any) => `${m.role}: ${m.content}`).join('\n');

    const prompt = `Sen HR yordamchisissan. Foydalanuvchi xabarini tushun va profil yangilanishlarini chiqar.

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
    "category_id": "6cdb160a-f3a9-4d7b-944a-d34df1ebd730",
    "region": "Andijon",
    "region_id": 2,
    "skills": ["React"],
    "salary_min": 5000000,
    "work_mode": "remote"
  },
  "search_ready": true,
  "response_text": "Agar greeting/clarify bo'lsa - javob",
  "next_question": "Agar profil to'liq emas - savol"
}

FAQAT JSON QAYTAR.`;

    try {
        const model = genAI.getGenerativeModel({
            model: MODEL,
            generationConfig: {
                maxOutputTokens: 600,
                temperature: 0.15,
                responseMimeType: "application/json"
            }
        });

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // Robust JSON cleaning
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}');
        if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON found');

        const cleaned = text.substring(jsonStart, jsonEnd + 1);
        return JSON.parse(cleaned);
    } catch (error) {
        console.error('[AI] Gemini failed:', error);
        // CRITICAL FALLBACK (Never say 'I dont understand' if keywords exist)
        return fallbackUnderstanding(message, currentProfile);
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
            contact_telegram, contact_phone,
            districts(name_uz, regions(name_uz))
        `)
        .eq('is_active', true)
        .eq('status', 'active')
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
    if (profile.work_mode === 'remote') {
        query = query.eq('work_mode', 'remote');
    }

    // Salary
    if (profile.salary_min) {
        query = query.gte('salary_max', profile.salary_min);
    }

    const { data, error } = await query;
    if (error) {
        console.error('[DB] Search error:', error);
        return [];
    }

    let jobs: any[] = data || [];

    // Add distance if user location provided
    if (userLocation && userLocation.lat && userLocation.lng) {
        jobs = jobs.map(job => ({
            ...job,
            distance_km: (job.latitude && job.longitude)
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

async function rerankWithGemini(jobs: any[], profile: UserProfile): Promise<RerankResult> {
    if (jobs.length === 0) {
        return { ranked_jobs: [] };
    }

    // For small result sets, skip reranking
    if (jobs.length <= 5) {
        return {
            ranked_jobs: jobs.map((j, i) => ({
                job_id: j.id,
                score: 80 - i * 5,
                reason: 'Mezonlaringizga mos'
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
3. TOP 8 ni tanla, qisqa sabab yoz (O'ZBEKCHA)
4. distance_km yaqinroq bo'lsa, bonus ber

JSON:
{
  "ranked_jobs": [
    { "job_id": "uuid", "score": 95, "reason": "React talabiga mos, yaqinda" }
  ],
  "advice": "Umumiy maslahat (ixtiyoriy)"
}`;

    try {
        const model = genAI.getGenerativeModel({
            model: MODEL,
            generationConfig: {
                maxOutputTokens: 800,
                temperature: 0.2,
                responseMimeType: "application/json"
            }
        });

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const cleaned = text.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();

        return JSON.parse(cleaned);
    } catch (error) {
        console.error('[AI] Rerank error:', error);
        // Fallback to simple ranking
        return {
            ranked_jobs: jobs.slice(0, 8).map((j, i) => ({
                job_id: j.id,
                score: 90 - i * 5,
                reason: 'Mezonlaringizga mos'
            }))
        };
    }
}

// ============================================================================
// FORMAT JOBS FOR CARD
// ============================================================================

function formatJobsForCard(jobs: any[], rerank: RerankResult): any[] {
    const rankMap = new Map(rerank.ranked_jobs.map(r => [r.job_id, r]));

    return rerank.ranked_jobs.map(r => {
        const job = jobs.find(j => j.id === r.job_id);
        if (!job) return null;

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
        let salary = 'Kelishiladi';
        if (salaryMin && salaryMax) salary = `${salaryMin}-${salaryMax} mln`;
        else if (salaryMax) salary = `${salaryMax} mln gacha`;
        else if (salaryMin) salary = `${salaryMin} mln dan`;

        return {
            id: job.id,
            title: job.title_uz || job.title_ru || 'Vakansiya',
            company: job.company_name || 'Kompaniya',
            salary,
            location,
            work_mode: job.work_mode === 'remote' ? 'Masofaviy' : '',
            contact_telegram: job.contact_telegram,
            contact_phone: job.contact_phone,
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
        const body = await request.json();
        const message = body.message?.trim() || '';
        const sessionId = body.session_id || '';
        const history = body.messages || [];
        const userLocation = body.user_location as UserLocation | undefined;

        if (!message) {
            return NextResponse.json({ response: "Xabar yozing", jobs: [] });
        }

        console.log('[Chat] Session:', sessionId, 'Message:', message);

        // ========================================
        // STEP A: Load session
        // ========================================
        const session = await loadSession(sessionId);
        let profile = session.profile;
        let messages = [...session.messages, { role: 'user', content: message }];

        // ========================================
        // STEP B: Gemini understands
        // ========================================
        const understanding = await understandWithGemini(message, history, profile);
        console.log('[Chat] Understanding:', JSON.stringify(understanding));

        // ========================================
        // STEP C: Merge profile updates
        // ========================================
        if (understanding.profile_updates) {
            profile = { ...profile, ...understanding.profile_updates };
        }

        // ========================================
        // Handle greeting/clarify
        // ========================================
        if (understanding.intent === 'greeting' || !understanding.search_ready) {
            const responseText = understanding.response_text ||
                understanding.next_question ||
                "Qaysi soha va shaharda ish qidiryapsiz?";

            messages.push({ role: 'assistant', content: responseText });
            await saveSession(sessionId, profile, messages);

            return NextResponse.json({
                response: responseText,
                jobs: [],
                intent: understanding.intent,
                profile
            });
        }

        // ========================================
        // STEP D: Search + Rerank
        // ========================================
        const jobs = await searchCandidates(profile, userLocation);
        console.log('[Chat] Found:', jobs.length, 'candidates');

        const rerank = await rerankWithGemini(jobs, profile);
        const formattedJobs = formatJobsForCard(jobs, rerank);

        // Build response
        let responseText = '';
        if (formattedJobs.length === 0) {
            responseText = `Afsuski, ${profile.category || 'tanlangan soha'}da ${profile.region || 'barcha hududlar'}da vakansiya topilmadi. Boshqa soha yoki hududni sinab ko'ring.`;
        } else {
            responseText = `${profile.category || 'Barcha sohalar'}, ${profile.region || 'barcha hududlar'} - ${formattedJobs.length} ta mos vakansiya:`;
            if (rerank.advice) {
                responseText += `\n\n💡 ${rerank.advice}`;
            }
        }

        messages.push({ role: 'assistant', content: responseText });
        await saveSession(sessionId, { ...profile, profile_complete: true }, messages);

        return NextResponse.json({
            response: responseText,
            jobs: formattedJobs,
            intent: 'search',
            profile
        });

    } catch (error: any) {
        console.error('[Chat] Error:', error);
        return NextResponse.json({
            response: "Xatolik yuz berdi. Qaytadan urinib ko'ring.",
            jobs: [],
            intent: 'error'
        }, { status: 500 });
    }
}
