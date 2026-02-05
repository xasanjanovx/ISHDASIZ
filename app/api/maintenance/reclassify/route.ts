import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { mapOsonishCategory } from '@/lib/mappers/osonish-mapper';

// Service role client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
    try {
        console.log('[RECLASSIFY] Starting reclassification of "Other" and OsonIsh jobs...');

        // 1. Fetch jobs that need re-classification
        // - Jobs in "Other" category
        // - Jobs from OsonIsh (since they were likely missed)
        // - Limit to active jobs to save time, or all jobs
        const { data: jobs, error } = await supabase
            .from('jobs')
            .select('id, title_uz, source_category, source_subcategory, category_id, source')
            .eq('is_active', true);

        if (error) throw error;
        if (!jobs) return NextResponse.json({ message: 'No jobs found' });

        let updatedCount = 0;
        let errors = 0;
        const updates = [];

        for (const job of jobs) {
            const mapping = mapOsonishCategory(
                job.source_category || '',
                job.source_subcategory || null,
                job.title_uz || ''
            );

            if (!mapping) {
                continue;
            }

            // Only update if the category is different
            if (mapping.categoryId !== job.category_id) {
                updates.push({
                    id: job.id,
                    category_id: mapping.categoryId,
                    old_cat: job.category_id,
                    new_cat: mapping.categoryId,
                    match_type: mapping.matchedBy,
                    keyword: mapping.matchedKeyword
                });

                // Batch update or single? Single for safety now, batch later if slow.
                const { error: updateError } = await supabase
                    .from('jobs')
                    .update({ category_id: mapping.categoryId })
                    .eq('id', job.id);

                if (updateError) {
                    console.error(`Failed to update job ${job.id}:`, updateError);
                    errors++;
                } else {
                    updatedCount++;
                }
            }
        }

        return NextResponse.json({
            success: true,
            total_scanned: jobs.length,
            updated: updatedCount,
            errors,
            sample_updates: updates.slice(0, 20)
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
