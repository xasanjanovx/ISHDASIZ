import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type ProfessionRow = {
    id: number | string;
    title_uz?: string | null;
    title_ru?: string | null;
    vacancies_count?: number | null;
    category_id?: string | null;
    category_title?: string | null;
};

async function seedProfessionTable(rows: ProfessionRow[]): Promise<void> {
    if (!Array.isArray(rows) || rows.length === 0) return;
    const payload = rows
        .map((row) => {
            const id = Number(row.id);
            if (!Number.isFinite(id) || id <= 0) return null;
            return {
                id,
                title_uz: row.title_uz || row.title_ru || '',
                title_ru: row.title_ru || row.title_uz || null,
                category_id: row.category_id || null,
                category_title: row.category_title || null,
                vacancies_count: Number(row.vacancies_count || 0),
                source: 'osonish',
                last_seen_at: new Date().toISOString()
            };
        })
        .filter(Boolean) as any[];
    if (!payload.length) return;
    const { error } = await supabaseAdmin
        .from('osonish_professions')
        .upsert(payload, { onConflict: 'id', ignoreDuplicates: false });
    if (error) {
        console.warn('[OSONISH_FIELDS] profession seed failed:', error.message);
    }
}

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const JOBS_FALLBACK_CACHE_TTL_MS = 5 * 60 * 1000;
let jobsFallbackCache: { rows: ProfessionRow[]; loadedAt: number } = { rows: [], loadedAt: 0 };

function normalize(value: string): string {
    return value
        .toLowerCase()
        .replace(/[\u2018\u2019\u02BC\u02BB`']/g, '')
        .replace(/[^a-z0-9\u0400-\u04FF\s]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function buildBigrams(value: string): string[] {
    if (!value || value.length < 2) return [];
    const grams: string[] = [];
    for (let i = 0; i < value.length - 1; i += 1) {
        grams.push(value.slice(i, i + 2));
    }
    return grams;
}

function diceSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const aBigrams = buildBigrams(a);
    const bBigrams = buildBigrams(b);
    if (!aBigrams.length || !bBigrams.length) return 0;
    const bCount = new Map<string, number>();
    for (const gram of bBigrams) {
        bCount.set(gram, (bCount.get(gram) || 0) + 1);
    }
    let overlap = 0;
    for (const gram of aBigrams) {
        const count = bCount.get(gram) || 0;
        if (count > 0) {
            overlap += 1;
            bCount.set(gram, count - 1);
        }
    }
    return (2 * overlap) / (aBigrams.length + bBigrams.length);
}

function scoreProfession(row: ProfessionRow, query: string): number {
    const title = normalize(`${row.title_uz || ''} ${row.title_ru || ''}`);
    if (!title || !query) return 0;
    let score = 0;
    if (title === query) score += 120;
    if (title.startsWith(query)) score += 70;
    if (title.includes(query)) score += 40;
    if (score === 0) {
        const fullSim = diceSimilarity(title, query);
        const tokenSim = Math.max(
            0,
            ...title
                .split(' ')
                .filter(Boolean)
                .map((token) => diceSimilarity(token, query))
        );
        const best = Math.max(fullSim, tokenSim);
        if (best >= 0.62) {
            score = Math.round(best * 100);
        }
    }
    if (score === 0) return 0;
    score += Math.min(20, Number(row.vacancies_count || 0));
    return score;
}

function normalizeRows(rows: ProfessionRow[]): ProfessionRow[] {
    return rows
        .filter((row) => row?.id && String(row.title_uz || row.title_ru || '').trim().length > 0)
        .map((row) => ({
            id: row.id,
            title: row.title_uz || row.title_ru || '',
            title_uz: row.title_uz || row.title_ru || '',
            title_ru: row.title_ru || row.title_uz || '',
            vacancies_count: row.vacancies_count ?? 0,
            category_id: row.category_id ?? null,
            category_title: row.category_title ?? null
        })) as any[];
}

async function fetchFromProfessionTable(search: string): Promise<ProfessionRow[]> {
    if (!search) return [];

    const cleaned = search.replace(/[%_,]/g, ' ').trim();
    if (!cleaned) return [];

    const { data, error } = await supabaseAdmin
        .from('osonish_professions')
        .select('id, title_uz, title_ru, vacancies_count, category_id, category_title')
        .or(`title_uz.ilike.%${cleaned}%,title_ru.ilike.%${cleaned}%`)
        .limit(120);

    if (error) return [];
    return data || [];
}

async function fetchProfessionCatalog(limit: number = 1600): Promise<ProfessionRow[]> {
    const { data, error } = await supabaseAdmin
        .from('osonish_professions')
        .select('id, title_uz, title_ru, vacancies_count, category_id, category_title')
        .order('vacancies_count', { ascending: false })
        .limit(limit);
    if (error) return [];
    return data || [];
}

async function buildFromJobs(search: string): Promise<ProfessionRow[]> {
    const now = Date.now();
    const normalizedSearch = normalize(search || '');
    if (jobsFallbackCache.rows.length > 0 && (now - jobsFallbackCache.loadedAt) < JOBS_FALLBACK_CACHE_TTL_MS) {
        const cachedRows = jobsFallbackCache.rows;
        if (!normalizedSearch) return cachedRows.slice(0, 120);
        const filtered = cachedRows.filter((row) =>
            normalize(`${row.title_uz || ''} ${row.title_ru || ''}`).includes(normalizedSearch)
        );
        return filtered.slice(0, 120);
    }

    const { data, error } = await supabaseAdmin
        .from('jobs')
        .select('category_id, raw_source_json')
        .eq('source', 'osonish')
        .eq('is_active', true)
        .order('last_seen_at', { ascending: false })
        .limit(8000);

    if (error || !data) return [];

    const categoriesRes = await supabaseAdmin
        .from('categories')
        .select('id, name_uz, name_ru');
    const categories = categoriesRes.data || [];

    const acc = new Map<string, ProfessionRow>();
    for (const row of data as any[]) {
        const raw = row?.raw_source_json || {};
        const mmkId = raw?.mmk_position?.id ?? raw?.mmk_position_id ?? null;
        const title = String(raw?.mmk_position?.position_name || raw?.field_title || '').trim();
        if (!mmkId || !title) continue;
        const key = String(mmkId);
        const existing = acc.get(key);
        if (!existing) {
            const cat = categories.find((c: any) => String(c.id) === String(row?.category_id));
            acc.set(key, {
                id: key,
                title_uz: title,
                title_ru: title,
                vacancies_count: 1,
                category_id: row?.category_id ? String(row.category_id) : null,
                category_title: cat?.name_uz || cat?.name_ru || null
            });
            continue;
        }
        existing.vacancies_count = Number(existing.vacancies_count || 0) + 1;
        if (!existing.category_id && row?.category_id) {
            const cat = categories.find((c: any) => String(c.id) === String(row.category_id));
            existing.category_id = String(row.category_id);
            existing.category_title = cat?.name_uz || cat?.name_ru || existing.category_title || null;
        }
    }

    let rows = Array.from(acc.values());
    rows.sort((a, b) => Number(b.vacancies_count || 0) - Number(a.vacancies_count || 0));
    jobsFallbackCache = { rows, loadedAt: now };
    if (!normalizedSearch) return rows.slice(0, 120);
    rows = rows.filter((row) => normalize(`${row.title_uz || ''} ${row.title_ru || ''}`).includes(normalizedSearch));
    return rows.slice(0, 120);
}

async function fetchFromOsonishRemote(search: string): Promise<ProfessionRow[]> {
    if (!search || search.length < 3) return [];
    const headers: Record<string, string> = {
        Accept: 'application/json',
        Referer: 'https://osonish.uz/10095/seeker/resumes/create',
        Origin: 'https://osonish.uz',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept-Language': 'uz,ru;q=0.9,en;q=0.8'
    };
    const authToken = process.env.OSONISH_BEARER_TOKEN || process.env.OSONISH_API_TOKEN || '';
    const cookie = process.env.OSONISH_COOKIE || '';
    const userId = process.env.OSONISH_USER_ID || process.env.OSONISH_CURRENT_USER_ID || '';
    if (authToken) headers.Authorization = authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`;
    if (cookie) headers.Cookie = cookie;
    if (userId) headers['x-current-user-id'] = userId;

    const bases = [
        'https://osonish.uz/api/v1',
        'https://osonish.uz/api/api/v1'
    ];
    for (const base of bases) {
        try {
            const res = await fetch(`${base}/mmk-positions?search=${encodeURIComponent(search)}`, {
                headers,
                cache: 'no-store'
            });
            if (!res.ok) continue;
            const payload = await res.json();
            const raw = Array.isArray(payload?.data?.data)
                ? payload.data.data
                : Array.isArray(payload?.data)
                    ? payload.data
                    : [];
            return (raw || []).map((item: any) => ({
                id: item.id ?? item.position_id ?? item.value ?? item.code,
                title_uz: item.position_name ?? item.name_uz ?? item.name ?? '',
                title_ru: item.position_name ?? item.name_ru ?? item.name ?? '',
                vacancies_count: item.vacancies_count ?? item.count ?? item.total ?? 0,
                category_id: null,
                category_title: null
            }));
        } catch {
            // Try next base.
        }
    }
    return [];
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = String(searchParams.get('search') || '').trim();
        const normalizedSearch = normalize(search);

        if (!search || normalizedSearch.length < 3) {
            return NextResponse.json({ fields: [] });
        }

        let rows = await fetchFromProfessionTable(normalizedSearch);
        if (rows.length === 0) {
            rows = await buildFromJobs(normalizedSearch);
            if (rows.length > 0) {
                await seedProfessionTable(rows);
            }
        }
        if (rows.length === 0) {
            rows = await fetchFromOsonishRemote(normalizedSearch);
        }
        if (rows.length === 0) {
            rows = await fetchProfessionCatalog();
        }

        const normalizedRows = normalizeRows(rows)
            .map((row: any) => ({ ...row, _score: scoreProfession(row, normalizedSearch) }))
            .filter((row: any) => row._score > 0)
            .sort((a: any, b: any) => {
                if (b._score !== a._score) return b._score - a._score;
                return Number(b.vacancies_count || 0) - Number(a.vacancies_count || 0);
            })
            .slice(0, 100)
            .map(({ _score, ...row }: any) => row);

        return NextResponse.json({ fields: normalizedRows });
    } catch (err) {
        console.error('fields fetch error', err);
        return NextResponse.json({ fields: [] }, { status: 500 });
    }
}
