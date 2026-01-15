import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

// Keyword Mapping
const KEYWORD_MAP: Record<string, string[]> = {
    'Savdo': ['sotuvchi', 'kassir', 'savdo', 'menejer', 'agent', 'operator'],
    'Logistika': ['haydovchi', 'kuryer', 'yetkazib', 'logist', 'yuk'],
    'Moliya': ['buxgalter', 'hisobchi', 'iqtisodchi', 'kassir'],
    'Ta\'lim': ['o\'qituvchi', 'tarbiyachi', 'ustoz', 'pedagog', 'repitetor'],
    'Xizmat ko\'rsatish': ['oshpaz', 'ofitsiant', 'farrosh', 'enaga', 'qorovul', 'ma\'mur', 'administrator', 'call-center', 'operator'],
    'Qurilish': ['quruvchi', 'usta', 'svarkachi', 'payvandchi', 'santexnik', 'elektrik', 'bo\'yoqchi', 'suvoqchi'],
    'Ishlab chiqarish': ['tikuvchi', 'bichuvchi', 'yigiruvchi', 'texnolog', 'sehr', 'operator'],
    'Tibbiyot': ['shifokor', 'hamshira', 'vrach', 'doktor', 'farmatsevt'],
    'IT': ['dasturchi', 'admin', 'smm', 'dizayner', 'copywriter', 'marketolog'],
};

async function fixCategories() {
    console.log('Fetching categories...');
    const { data: categories } = await supabase.from('categories').select('*');
    if (!categories) return;

    console.log(`Loaded ${categories.length} categories.`);

    console.log('Supabase URL:', supabaseUrl);

    // Count total active jobs
    const { count: totalActive } = await supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('is_active', true);
    console.log('Total active jobs per DB:', totalActive);

    const { data: jobs, error: fetchError } = await supabase
        .from('jobs')
        .select('id, title_uz, title_ru, category_id')
        .eq('is_active', true);

    if (fetchError) {
        console.error('Fetch error:', fetchError);
        return;
    }

    if (!jobs || jobs.length === 0) {
        console.log('No active jobs found at all.');
        return;
    }

    const missingCategoryJobs = jobs.filter(j => !j.category_id);
    console.log(`Found ${jobs.length} total active jobs.`);
    console.log(`Found ${missingCategoryJobs.length} jobs with missing category.`);

    if (missingCategoryJobs.length === 0) return;

    let updatedCount = 0;

    for (const job of missingCategoryJobs) {
        const title = job.title_uz || job.title_ru;
        if (!title) continue;

        const titleLower = title.toLowerCase();
        let matchedCatId: string | null = null;
        let matchedCatName: string | null = null;

        // 1. Check exact name match against categories
        for (const cat of categories) {
            const nameUz = cat.name_uz.toLowerCase();
            const nameRu = cat.name_ru.toLowerCase();
            if (titleLower.includes(nameUz) || (nameRu && titleLower.includes(nameRu))) {
                matchedCatId = cat.id;
                matchedCatName = cat.name_uz;
                break;
            }
        }

        // 2. Check keyword map if no match
        if (!matchedCatId) {
            for (const [catNamePart, keywords] of Object.entries(KEYWORD_MAP)) {
                // Find the actual DB category that matches this key
                const dbCat = categories.find(c => c.name_uz.includes(catNamePart) || (c.name_ru && c.name_ru.includes(catNamePart)));
                if (!dbCat) continue;

                if (keywords.some(k => titleLower.includes(k))) {
                    matchedCatId = dbCat.id;
                    matchedCatName = dbCat.name_uz;
                    break;
                }
            }
        }

        // 3. Fallback: try "mmk_position" from raw json
        // if (!matchedCatId && (job as any)?.raw_source_json?.mmk_position?.position_name) {
        //      const posName = ((job as any).raw_source_json).mmk_position.position_name.toLowerCase();
        //      for (const cat of categories) {
        //          if (cat.name_uz.toLowerCase().includes(posName)) {
        //              matchedCatId = cat.id;
        //              matchedCatName = cat.name_uz;
        //              break;
        //          }
        //     }
        // }

        if (matchedCatId) {
            // Update job
            const { error } = await supabase
                .from('jobs')
                .update({ category_id: matchedCatId })
                .eq('id', job.id);

            if (!error) {
                console.log(`[OK] Mapped "${title}" -> "${matchedCatName}"`);
                updatedCount++;
            } else {
                console.error(`[ERR] Failed to update job ${job.id}:`, error);
            }
        } else {
            // console.log(`[SKIP] Could not map "${title}"`);
        }
    }

    console.log(`Finished. Updated ${updatedCount} jobs.`);
}

fixCategories();
