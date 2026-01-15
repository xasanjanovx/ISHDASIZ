import { NextRequest, NextResponse } from 'next/server';
import { scrapeOsonishFull, TransformedVacancy } from '@/lib/scrapers/osonish';

// API key validation
const IMPORT_API_KEY = process.env.IMPORT_API_KEY;
const INTERNAL_API_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

/**
 * POST /api/scraper/osonish
 * 
 * 2-Step List → Detail Scraper
 * 
 * Headers: X-Import-Key: your_api_key
 * Body: { max_pages?: number, only_with_contacts?: boolean }
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

        const body = await request.json().catch(() => ({}));
        const maxPages = body.max_pages || 20;
        const onlyWithContacts = body.only_with_contacts !== false;

        console.log(`[API] Starting 2-step scraper (max ${maxPages} pages)...`);

        // Run 2-step scraper
        const result = await scrapeOsonishFull(maxPages, onlyWithContacts);

        console.log(`[API] Scraper complete: ${result.vacancies.length} vacancies`);

        // If no vacancies, return debug info
        if (result.vacancies.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No vacancies with contacts found',
                stats: {
                    list_items_count: result.debug.list_items_count,
                    detail_success_count: result.debug.detail_success_count,
                    detail_fail_count: result.debug.detail_fail_count,
                    vacancies_with_contacts: result.debug.vacancies_with_contacts
                },
                debug: result.debug
            });
        }

        // Prepare for import API
        const importPayload = {
            source: 'osonish',
            vacancies: result.vacancies.map((v: TransformedVacancy) => ({
                source_id: v.source_id,
                source_url: v.source_url,
                title: v.title,
                company_name: v.company_name,
                description: v.description || '',
                salary_min: v.salary_min,
                salary_max: v.salary_max,
                contact_phone: v.contact_phone,
                contact_telegram: v.contact_telegram,
                address: v.address,
                region_name: v.region_name,
                district_name: v.district_name,
                latitude: v.latitude,
                longitude: v.longitude,
                // Boolean flags for filters
                is_for_disabled: v.is_for_disabled,
                is_for_graduates: v.is_for_graduates,
                is_for_students: v.is_for_students,
                is_for_women: v.is_for_women,
                // Work info
                employment_type: v.employment_type,
                work_mode: v.work_mode
            })),
            triggered_by: 'api'
        };

        // Call import API
        const importResponse = await fetch(`${INTERNAL_API_URL}/api/import/jobs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Import-Key': IMPORT_API_KEY
            },
            body: JSON.stringify(importPayload)
        });

        const importResult = await importResponse.json();

        // Call sync API
        const syncPayload = {
            source: 'osonish',
            active_source_ids: result.active_ids,
            filled_source_ids: result.filled_ids,
            removed_source_ids: result.removed_ids
        };

        const syncResponse = await fetch(`${INTERNAL_API_URL}/api/import/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Import-Key': IMPORT_API_KEY
            },
            body: JSON.stringify(syncPayload)
        });

        const syncResult = await syncResponse.json();

        return NextResponse.json({
            success: true,
            stats: {
                list_items_count: result.debug.list_items_count,
                detail_fetched_count: result.debug.detail_fetched_count,
                detail_success_count: result.debug.detail_success_count,
                detail_fail_count: result.debug.detail_fail_count,
                vacancies_with_contacts: result.debug.vacancies_with_contacts,
                vacancies_without_contacts: result.debug.vacancies_without_contacts,
                imported_count: result.vacancies.length
            },
            debug: result.debug,
            import_result: importResult,
            sync_result: syncResult
        });

    } catch (error: any) {
        console.error('[API] Scraper error:', error);
        return NextResponse.json(
            { error: 'Scraper failed', details: error.message },
            { status: 500 }
        );
    }
}

/**
 * GET /api/scraper/osonish
 * 
 * Quick test - fetch 1 page only
 */
export async function GET(request: NextRequest) {
    const apiKey = request.headers.get('X-Import-Key');
    if (!IMPORT_API_KEY || apiKey !== IMPORT_API_KEY) {
        return NextResponse.json(
            { error: 'Unauthorized: Invalid API key' },
            { status: 401 }
        );
    }

    try {
        const result = await scrapeOsonishFull(1, false);

        return NextResponse.json({
            source: 'osonish',
            api_type: '2-step (list → detail)',
            status: 'ready',
            quick_test: {
                list_items: result.debug.list_items_count,
                detail_success: result.debug.detail_success_count,
                with_contacts: result.debug.vacancies_with_contacts,
                sample_urls: result.debug.sample_detail_urls,
                sample_keys: result.debug.sample_detail_preview_keys.slice(0, 10)
            }
        });
    } catch (error: any) {
        return NextResponse.json({
            source: 'osonish',
            status: 'error',
            error: error.message
        });
    }
}
