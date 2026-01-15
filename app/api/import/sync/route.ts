import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service role client for sync operations
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const IMPORT_API_KEY = process.env.IMPORT_API_KEY;

interface SyncRequest {
    source: string;
    // List of source_ids that still exist on the source site
    active_source_ids: string[];
    // Optional: explicitly mark as filled (source says "job closed/filled")
    filled_source_ids?: string[];
}

/**
 * POST /api/import/sync
 * 
 * Sync status of imported vacancies:
 * - Mark vacancies as removed_at_source if they're no longer in active_source_ids (404/missing)
 * - Mark vacancies as filled ONLY if explicitly provided in filled_source_ids
 * - Update last_checked_at for all, last_seen_at only for active ones
 */
export async function POST(request: NextRequest) {
    try {
        // Validate API key
        const apiKey = request.headers.get('X-Import-Key');
        if (!IMPORT_API_KEY || apiKey !== IMPORT_API_KEY) {
            return NextResponse.json(
                { error: 'Unauthorized: Invalid API key' },
                { status: 401 }
            );
        }

        const body: SyncRequest = await request.json();
        const { source, active_source_ids, filled_source_ids = [] } = body;

        if (!source || typeof source !== 'string') {
            return NextResponse.json(
                { error: 'Invalid request: source is required' },
                { status: 400 }
            );
        }

        if (!active_source_ids || !Array.isArray(active_source_ids)) {
            return NextResponse.json(
                { error: 'Invalid request: active_source_ids array is required' },
                { status: 400 }
            );
        }

        const now = new Date().toISOString();

        // Get all imported jobs from this source
        const { data: existingJobs, error: fetchError } = await supabaseAdmin
            .from('jobs')
            .select('id, source_id, source_status, is_active')
            .eq('source', source)
            .eq('is_imported', true);

        if (fetchError) {
            return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }

        // Statistics
        const stats = {
            total_checked: existingJobs?.length || 0,
            still_active: 0,
            removed_at_source: 0,
            marked_filled: 0,
            reactivated: 0,
            unchanged: 0
        };

        const activeSet = new Set(active_source_ids);
        const filledSet = new Set(filled_source_ids);

        for (const job of existingJobs || []) {
            if (!job.source_id) continue;

            // Always update last_checked_at
            const updateData: Record<string, any> = {
                last_checked_at: now,
                last_synced_at: now
            };

            if (filledSet.has(job.source_id)) {
                // Explicitly marked as filled by source
                updateData.source_status = 'filled';
                updateData.is_active = false;
                stats.marked_filled++;
            } else if (!activeSet.has(job.source_id)) {
                // Not in active list = 404/removed at source
                if (job.source_status !== 'removed_at_source') {
                    updateData.source_status = 'removed_at_source';
                    updateData.is_active = false;
                    stats.removed_at_source++;
                } else {
                    stats.unchanged++;
                }
            } else {
                // Still active on source
                updateData.last_seen_at = now;
                updateData.source_status = 'active';
                updateData.is_active = true;

                // Check if we're reactivating a previously removed job
                if (job.source_status === 'removed_at_source' || job.source_status === 'filled') {
                    stats.reactivated++;
                } else {
                    stats.still_active++;
                }
            }

            await supabaseAdmin
                .from('jobs')
                .update(updateData)
                .eq('id', job.id);
        }

        // Log the sync operation
        await supabaseAdmin
            .from('import_logs')
            .insert({
                source,
                triggered_by: 'api',
                operation_type: 'sync',
                status: 'completed',
                completed_at: now,
                total_checked: stats.total_checked,
                still_active: stats.still_active,
                removed_at_source: stats.removed_at_source,
                marked_filled: stats.marked_filled,
                notes: `Sync: ${stats.still_active} active, ${stats.removed_at_source} removed, ${stats.marked_filled} filled, ${stats.reactivated} reactivated`
            });

        return NextResponse.json({
            success: true,
            stats
        });

    } catch (error: any) {
        console.error('Sync API error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
