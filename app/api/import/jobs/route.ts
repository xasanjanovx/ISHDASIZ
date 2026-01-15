import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service role client for import operations (bypasses RLS)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Import API key validation
const IMPORT_API_KEY = process.env.IMPORT_API_KEY;

interface ImportedVacancy {
    source_id: string;
    source_url: string;
    title: string;
    company_name: string;
    description?: string;
    requirements?: string;
    benefits?: string;
    salary_min?: number;
    salary_max?: number;
    contact_phone?: string;
    contact_telegram?: string;
    employment_type?: string;
    experience?: string;
    education_level?: string;
    district_id?: string;
    region_id?: number;
    address?: string;
    latitude?: number;
    longitude?: number;
    category_id?: string;
}

interface ImportRequest {
    source: string;
    vacancies: ImportedVacancy[];
    triggered_by?: 'cron' | 'manual' | 'api';
}

// Validation function
function validateVacancy(vacancy: ImportedVacancy): { valid: boolean; error?: string } {
    if (!vacancy.source_id || typeof vacancy.source_id !== 'string') {
        return { valid: false, error: 'Missing or invalid source_id' };
    }
    if (!vacancy.title || typeof vacancy.title !== 'string' || vacancy.title.trim().length < 2) {
        return { valid: false, error: 'Missing or invalid title (min 2 chars)' };
    }
    if (!vacancy.company_name || typeof vacancy.company_name !== 'string') {
        return { valid: false, error: 'Missing or invalid company_name' };
    }
    if (!vacancy.source_url || typeof vacancy.source_url !== 'string') {
        return { valid: false, error: 'Missing source_url' };
    }
    // Salary validation
    if (vacancy.salary_min !== undefined && (typeof vacancy.salary_min !== 'number' || vacancy.salary_min < 0)) {
        return { valid: false, error: 'Invalid salary_min' };
    }
    if (vacancy.salary_max !== undefined && (typeof vacancy.salary_max !== 'number' || vacancy.salary_max < 0)) {
        return { valid: false, error: 'Invalid salary_max' };
    }
    // At least some contact info is preferred
    if (!vacancy.contact_phone && !vacancy.contact_telegram) {
        // Warning but still valid
        console.warn(`Vacancy ${vacancy.source_id} has no contact info`);
    }
    return { valid: true };
}

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

        const body: ImportRequest = await request.json();
        const { source, vacancies, triggered_by = 'api' } = body;

        if (!source || typeof source !== 'string') {
            return NextResponse.json(
                { error: 'Invalid request: source is required' },
                { status: 400 }
            );
        }

        if (!vacancies || !Array.isArray(vacancies) || vacancies.length === 0) {
            return NextResponse.json(
                { error: 'Invalid request: vacancies array is required and must not be empty' },
                { status: 400 }
            );
        }

        // Create import log entry
        const { data: logEntry, error: logError } = await supabaseAdmin
            .from('import_logs')
            .insert({
                source,
                triggered_by,
                operation_type: 'import',
                total_found: vacancies.length,
                status: 'running'
            })
            .select('id')
            .single();

        if (logError) {
            console.error('Failed to create import log:', logError);
        }

        const logId = logEntry?.id;

        // Statistics
        const stats = {
            new_imported: 0,
            updated: 0,
            skipped: 0,
            duplicates: 0,
            validation_errors: 0
        };

        const errors: { source_id: string; error: string }[] = [];
        const now = new Date().toISOString();

        // Deduplicate by source_id within batch
        const seenSourceIds = new Set<string>();
        const uniqueVacancies: ImportedVacancy[] = [];

        for (const vacancy of vacancies) {
            if (seenSourceIds.has(vacancy.source_id)) {
                stats.duplicates++;
                continue;
            }
            seenSourceIds.add(vacancy.source_id);
            uniqueVacancies.push(vacancy);
        }

        // Process unique vacancies
        for (const vacancy of uniqueVacancies) {
            try {
                // Validate
                const validation = validateVacancy(vacancy);
                if (!validation.valid) {
                    stats.validation_errors++;
                    errors.push({ source_id: vacancy.source_id || 'unknown', error: validation.error || 'Validation failed' });
                    continue;
                }

                // Check if already exists in DB by (source, source_id)
                const { data: existing } = await supabaseAdmin
                    .from('jobs')
                    .select('id, title_uz, source_status')
                    .eq('source', source)
                    .eq('source_id', vacancy.source_id)
                    .maybeSingle();

                const jobData = {
                    source,
                    source_id: vacancy.source_id,
                    source_url: vacancy.source_url,
                    is_imported: true,
                    source_status: 'active',
                    last_synced_at: now,
                    last_seen_at: now,
                    last_checked_at: now,

                    title_uz: vacancy.title,
                    title_ru: vacancy.title,
                    company_name: vacancy.company_name,
                    description_uz: vacancy.description || '',
                    description_ru: vacancy.description || '',
                    requirements_uz: vacancy.requirements || '',
                    requirements_ru: vacancy.requirements || '',
                    benefits: vacancy.benefits || null,

                    salary_min: vacancy.salary_min || null,
                    salary_max: vacancy.salary_max || null,
                    contact_phone: vacancy.contact_phone || null,
                    contact_telegram: vacancy.contact_telegram || null,

                    employment_type: vacancy.employment_type || 'full_time',
                    experience: vacancy.experience || 'no_experience',
                    education_level: vacancy.education_level || 'any',

                    district_id: vacancy.district_id || null,
                    region_id: vacancy.region_id || null,
                    address: vacancy.address || null,
                    latitude: vacancy.latitude || null,
                    longitude: vacancy.longitude || null,

                    category_id: vacancy.category_id || null,
                    status: 'active',
                    is_active: true,
                };

                if (existing) {
                    // Update existing (also reactivate if was removed)
                    const { error: updateError } = await supabaseAdmin
                        .from('jobs')
                        .update({
                            ...jobData,
                            // Reactivate if previously removed
                            is_active: true,
                            source_status: 'active'
                        })
                        .eq('id', existing.id);

                    if (updateError) {
                        errors.push({ source_id: vacancy.source_id, error: updateError.message });
                    } else {
                        stats.updated++;
                    }
                } else {
                    // Insert new
                    const { error: insertError } = await supabaseAdmin
                        .from('jobs')
                        .insert(jobData);

                    if (insertError) {
                        // Check if it's a duplicate constraint violation
                        if (insertError.code === '23505') {
                            stats.duplicates++;
                        } else {
                            errors.push({ source_id: vacancy.source_id, error: insertError.message });
                        }
                    } else {
                        stats.new_imported++;
                    }
                }
            } catch (err: any) {
                errors.push({ source_id: vacancy.source_id, error: err.message });
            }
        }

        // Determine final status
        const totalErrors = errors.length;
        const finalStatus = totalErrors > 0
            ? (stats.new_imported > 0 || stats.updated > 0 ? 'completed_with_errors' : 'failed')
            : 'completed';

        // Update import log
        if (logId) {
            await supabaseAdmin
                .from('import_logs')
                .update({
                    completed_at: new Date().toISOString(),
                    status: finalStatus,
                    new_imported: stats.new_imported,
                    updated: stats.updated,
                    skipped: stats.skipped,
                    duplicates: stats.duplicates,
                    validation_errors: stats.validation_errors,
                    error_details: totalErrors > 0 ? errors : null
                })
                .eq('id', logId);
        }

        return NextResponse.json({
            success: finalStatus !== 'failed',
            log_id: logId,
            stats: {
                total_received: vacancies.length,
                unique_processed: uniqueVacancies.length,
                ...stats,
                errors: totalErrors
            },
            errors: totalErrors > 0 ? errors.slice(0, 50) : undefined // Limit error array
        });

    } catch (error: any) {
        console.error('Import API error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}

// GET endpoint to check import status / recent logs
export async function GET(request: NextRequest) {
    try {
        const apiKey = request.headers.get('X-Import-Key');
        if (!IMPORT_API_KEY || apiKey !== IMPORT_API_KEY) {
            return NextResponse.json(
                { error: 'Unauthorized: Invalid API key' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const source = searchParams.get('source');
        const limit = parseInt(searchParams.get('limit') || '10');
        const operation = searchParams.get('operation'); // 'import' or 'sync'

        let query = supabaseAdmin
            .from('import_logs')
            .select('*')
            .order('started_at', { ascending: false })
            .limit(limit);

        if (source) {
            query = query.eq('source', source);
        }
        if (operation) {
            query = query.eq('operation_type', operation);
        }

        const { data, error } = await query;

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Get summary stats
        const { data: statsData } = await supabaseAdmin
            .from('jobs')
            .select('source, source_status, is_imported')
            .eq('is_imported', true);

        const sourceStats: Record<string, any> = {};
        if (statsData) {
            for (const job of statsData) {
                if (!sourceStats[job.source]) {
                    sourceStats[job.source] = { active: 0, removed_at_source: 0, filled: 0, total: 0 };
                }
                sourceStats[job.source][job.source_status || 'active']++;
                sourceStats[job.source].total++;
            }
        }

        return NextResponse.json({
            logs: data,
            stats_by_source: sourceStats
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
