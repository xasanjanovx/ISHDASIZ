import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

type JobRow = {
    category_id: string | null;
    raw_source_json: any;
};

type ProfessionAggregate = {
    id: number;
    title_uz: string;
    title_ru: string | null;
    category_id: string | null;
    category_title: string | null;
    vacancies_count: number;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing');
}

const supabase = createClient(supabaseUrl, serviceKey);

function safeText(value: any): string {
    return String(value || '').trim();
}

function extractProfessionId(raw: any): number | null {
    const id = raw?.mmk_position?.id ?? raw?.mmk_position_id ?? null;
    const num = Number(id);
    return Number.isFinite(num) && num > 0 ? num : null;
}

function extractProfessionTitle(raw: any): string {
    return safeText(
        raw?.mmk_position?.position_name
        || raw?.mmk_position?.name
        || raw?.field_title
        || raw?.position_name
        || raw?.title
        || ''
    );
}

async function loadCategoryMap(): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const { data, error } = await supabase
        .from('categories')
        .select('id, name_uz, name_ru');
    if (error) {
        throw new Error(`Failed to load categories: ${error.message}`);
    }
    for (const row of data || []) {
        map.set(String(row.id), String(row.name_uz || row.name_ru || ''));
    }
    return map;
}

async function loadJobs(): Promise<JobRow[]> {
    const pageSize = 1000;
    let from = 0;
    const all: JobRow[] = [];

    while (true) {
        const to = from + pageSize - 1;
        const { data, error } = await supabase
            .from('jobs')
            .select('category_id, raw_source_json')
            .eq('source', 'osonish')
            .eq('is_active', true)
            .range(from, to);

        if (error) {
            throw new Error(`Failed to load jobs [${from}-${to}]: ${error.message}`);
        }
        if (!data || data.length === 0) break;

        all.push(...(data as JobRow[]));
        if (data.length < pageSize) break;
        from += pageSize;
    }

    return all;
}

function aggregateProfessions(rows: JobRow[], categoryMap: Map<string, string>): ProfessionAggregate[] {
    const acc = new Map<number, ProfessionAggregate>();

    for (const row of rows) {
        const raw = row?.raw_source_json || {};
        const professionId = extractProfessionId(raw);
        const title = extractProfessionTitle(raw);
        if (!professionId || !title) continue;

        const current = acc.get(professionId);
        const categoryId = row?.category_id ? String(row.category_id) : null;
        const categoryTitle = categoryId ? (categoryMap.get(categoryId) || null) : null;

        if (!current) {
            acc.set(professionId, {
                id: professionId,
                title_uz: title,
                title_ru: null,
                category_id: categoryId,
                category_title: categoryTitle,
                vacancies_count: 1
            });
            continue;
        }

        current.vacancies_count += 1;
        if (!current.category_id && categoryId) {
            current.category_id = categoryId;
            current.category_title = categoryTitle;
        }
    }

    return Array.from(acc.values()).sort((a, b) => b.vacancies_count - a.vacancies_count);
}

async function upsertProfessions(rows: ProfessionAggregate[]): Promise<void> {
    const chunkSize = 500;
    const now = new Date().toISOString();
    for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize).map((row) => ({
            id: row.id,
            title_uz: row.title_uz,
            title_ru: row.title_ru,
            category_id: row.category_id,
            category_title: row.category_title,
            vacancies_count: row.vacancies_count,
            source: 'osonish',
            last_seen_at: now
        }));

        const { error } = await supabase
            .from('osonish_professions')
            .upsert(chunk, { onConflict: 'id', ignoreDuplicates: false });

        if (error) {
            throw new Error(`Upsert failed at chunk ${i / chunkSize + 1}: ${error.message}`);
        }
    }
}

async function main() {
    const categoryMap = await loadCategoryMap();
    const jobs = await loadJobs();
    const professions = aggregateProfessions(jobs, categoryMap);
    await upsertProfessions(professions);
    console.log(`[sync-osonish-professions] jobs=${jobs.length}, professions=${professions.length}`);
}

main().catch((err) => {
    console.error('[sync-osonish-professions] error:', err instanceof Error ? err.message : err);
    process.exit(1);
});

