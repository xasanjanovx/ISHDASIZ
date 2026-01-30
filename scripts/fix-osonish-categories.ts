
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { mapOsonishCategory } from '../lib/mappers/osonish-mapper';
import path from 'path';

// Load env from root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function fixCategories() {
    console.log('Fetching OsonIsh jobs...');

    // Fetch categories for ID lookup
    const { data: categories } = await supabase.from('categories').select('*');
    if (!categories) throw new Error('No categories found');

    console.log(`Loaded ${categories.length} categories from DB.`);

    let page = 0;
    const pageSize = 1000;
    let updatedCount = 0;
    let errorCount = 0;

    while (true) {
        const { data: jobs, error } = await supabase
            .from('jobs')
            .select('id, title_uz, raw_source_json')
            .eq('source', 'osonish')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('Error fetching jobs:', error);
            break;
        }

        if (!jobs || jobs.length === 0) break;

        console.log(`Processing batch ${page + 1}... (${jobs.length} jobs)`);

        const updates = jobs.map(async (job) => {
            const raw = job.raw_source_json;
            if (!raw) return;

            let sourceCategoryName = '';
            // Match logic from route.ts
            if (raw.mmk_group?.cat2) {
                sourceCategoryName = raw.mmk_group.cat2;
            } else if (raw.mmk_group?.cat1) {
                sourceCategoryName = raw.mmk_group.cat1;
            }

            const mappingResult = mapOsonishCategory(sourceCategoryName, null, job.title_uz);

            // Find category ID
            let categoryId: string | null = null;

            // 1. Direct ID match
            const directMatch = categories.find(c => c.id === mappingResult.categoryId);
            if (directMatch) {
                categoryId = directMatch.id;
            } else {
                // 2. Name match
                const categoryNameToFind = mappingResult.categoryName.toLowerCase();
                const matched = categories.find(c =>
                    c.name_uz.toLowerCase().includes(categoryNameToFind) ||
                    (c.name_ru && c.name_ru.toLowerCase().includes(categoryNameToFind))
                );
                if (matched) categoryId = matched.id;
            }

            if (!categoryId) {
                // Fallback to "Boshqa" (Other)
                const other = categories.find(c => c.slug === 'boshqa' || c.name_uz.toLowerCase() === 'boshqa');
                categoryId = other?.id || null;
            }

            if (categoryId) {
                // Update
                const { error: updateError } = await supabase
                    .from('jobs')
                    .update({ category_id: categoryId })
                    .eq('id', job.id);

                if (updateError) {
                    // Suppress connection timeout errors from flooding log, just count them
                    if (JSON.stringify(updateError).includes('timeout') || JSON.stringify(updateError).includes('fetch failed')) {
                        errorCount++;
                    } else {
                        console.error(`Failed to update job ${job.id}:`, updateError);
                        errorCount++;
                    }
                } else {
                    updatedCount++;
                }
            } else {
                // console.warn(`Could not map category for job ${job.id} (${sourceCategoryName})`);
            }
        });

        // Run updates concurrently in chunks - LOWER CONCURRENCY TO AVOID TIMEOUTS
        const chunkSize = 5;
        for (let i = 0; i < updates.length; i += chunkSize) {
            const chunk = updates.slice(i, i + chunkSize);
            await Promise.all(chunk);
            // Longer delay for stability
            await new Promise(resolve => setTimeout(resolve, 500));

            if ((i + chunkSize) % 200 === 0) { // Log every 200 items logic approximately
                process.stdout.write('.');
            }
        }
        console.log(` Batch completed.`);

        if (jobs.length < pageSize) break;
        page++;
    }

    console.log(`Done! Updated: ${updatedCount}, Errors: ${errorCount}`);
}

fixCategories().catch(console.error);
