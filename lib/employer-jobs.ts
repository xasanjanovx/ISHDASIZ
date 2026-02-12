import type { SupabaseClient } from '@supabase/supabase-js';

type AnySupabase = SupabaseClient<any, any, any>;

export interface EmployerOwnershipContext {
    employerId: string | null;
    companyName: string | null;
    phone: string | null;
}

export interface FetchEmployerOwnedJobsOptions {
    select: string;
    limit?: number;
}

function asId(value: any): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function isMissingColumnError(error: any): boolean {
    const message = String(error?.message || '').toLowerCase();
    return (
        message.includes('does not exist')
        || message.includes('column')
        || message.includes('schema cache')
        || message.includes('could not find')
    );
}

function ensureOwnershipSelect(select: string): string {
    const source = String(select || '').trim();
    if (!source || source === '*') return '*';
    const needs = ['employer_id', 'created_by', 'user_id', 'created_at'];
    let next = source;
    for (const col of needs) {
        const rx = new RegExp(`\\b${col}\\b`, 'i');
        if (!rx.test(next)) {
            next = `${next}, ${col}`;
        }
    }
    return next;
}

function isOwnedBy(job: any, employerId: string | null, userId: string): boolean {
    const ownerByEmployer = employerId && asId(job?.employer_id) === employerId;
    const ownerByCreatedBy = asId(job?.created_by) === userId;
    const ownerByUserId = asId(job?.user_id) === userId;
    return Boolean(ownerByEmployer || ownerByCreatedBy || ownerByUserId);
}

async function queryByOwnerColumn(
    supabase: AnySupabase,
    selectClause: string,
    column: 'employer_id' | 'created_by' | 'user_id',
    value: string,
    limit: number
): Promise<any[]> {
    try {
        let result = await supabase
            .from('jobs')
            .select(selectClause)
            .eq(column, value)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (result.error && isMissingColumnError(result.error) && String(result.error?.message || '').toLowerCase().includes('created_at')) {
            result = await supabase
                .from('jobs')
                .select(selectClause)
                .eq(column, value)
                .limit(limit);
        }

        if (!result.error) {
            return result.data || [];
        }

        if (isMissingColumnError(result.error)) {
            return [];
        }

        console.error(`[EMPLOYER_JOBS] query error (${column}):`, result.error);
        return [];
    } catch (error) {
        console.error(`[EMPLOYER_JOBS] query exception (${column}):`, error);
        return [];
    }
}

export async function getEmployerOwnershipContext(
    supabase: AnySupabase,
    userId: string
): Promise<EmployerOwnershipContext> {
    if (!userId) {
        return { employerId: null, companyName: null, phone: null };
    }

    try {
        const { data, error } = await supabase
            .from('employer_profiles')
            .select('id, company_name, phone')
            .eq('user_id', userId)
            .maybeSingle();

        if (error && error.code !== 'PGRST116' && !isMissingColumnError(error)) {
            console.error('[EMPLOYER_JOBS] profile lookup error:', error);
        }

        return {
            employerId: data?.id ? asId(data.id) : null,
            companyName: data?.company_name ? String(data.company_name) : null,
            phone: data?.phone ? String(data.phone) : null
        };
    } catch (error) {
        console.error('[EMPLOYER_JOBS] profile lookup exception:', error);
        return { employerId: null, companyName: null, phone: null };
    }
}

export async function fetchEmployerOwnedJobs(
    supabase: AnySupabase,
    userId: string,
    options: FetchEmployerOwnedJobsOptions
): Promise<any[]> {
    if (!userId) return [];
    const limit = Math.max(1, options.limit || 200);
    const selectClause = ensureOwnershipSelect(options.select);
    const ownership = await getEmployerOwnershipContext(supabase, userId);

    const rowsById = new Map<string, any>();
    const mergeRows = (rows: any[]) => {
        for (const row of rows || []) {
            const id = asId(row?.id);
            if (!id) continue;
            rowsById.set(id, row);
        }
    };

    if (ownership.employerId) {
        mergeRows(await queryByOwnerColumn(supabase, selectClause, 'employer_id', ownership.employerId, limit));
    }

    mergeRows(await queryByOwnerColumn(supabase, selectClause, 'created_by', userId, limit));
    mergeRows(await queryByOwnerColumn(supabase, selectClause, 'user_id', userId, limit));

    const owned = Array.from(rowsById.values()).filter((row) => isOwnedBy(row, ownership.employerId, userId));

    owned.sort((a, b) => {
        const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
    });

    return owned.slice(0, limit);
}
