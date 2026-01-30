
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { mapOsonishCategory } from '../lib/mappers/osonish-mapper';
import { transformDetail } from '../lib/scrapers/osonish';

// Force load env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
    console.log('--- FIXING JOB 140 ---');

    // 1. Fetch remote data
    const remoteId = 140;
    const response = await fetch(`https://osonish.uz/api/api/v1/vacancies/${remoteId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const json = await response.json();
    const detail = json.data;

    if (!detail) {
        console.error('No data found for 140');
        return;
    }

    // 2. Map Category
    let categoryName = '';

    if (detail.mmk_group) {
        categoryName = detail.mmk_group.cat2 || detail.mmk_group.cat1;
    }

    if (!categoryName && detail.title) {
        categoryName = detail.title;
    }

    console.log(`Mapping category for: "${categoryName}"`);
    const mappingResult = mapOsonishCategory(categoryName, null, detail.title || '');
    const categoryId = mappingResult.categoryId;
    console.log(`Mapped to: ${mappingResult.categoryKey} (${categoryId})`);

    // 3. Transform for Description
    const transformed = transformDetail(detail);

    // 4. Update Supabase
    const updateData = {
        category_id: categoryId,
        description_uz: transformed.description || '',
        description_ru: transformed.description || '', // fallback
        // Update raw source for future debugging
        raw_source_json: detail
    };

    console.log('Updating job with:', JSON.stringify(updateData, null, 2));

    const { error } = await supabase
        .from('jobs')
        .update(updateData)
        .eq('source_id', String(remoteId)) // Assuming source_id is string "140"
        .eq('source', 'osonish');

    if (error) {
        console.error('Update failed:', error);
    } else {
        console.log('✅ Job 140 updated class="s-success".');
    }
}

main();
