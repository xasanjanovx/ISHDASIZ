/**
 * Diagnostic script to check import status and region distribution
 * Run with: npx tsx scripts/diagnose-import.ts
 */

require('dotenv').config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log('=== ISHDASIZ Import Diagnostics ===\n');

    // 1. Total job counts
    const { count: totalJobs } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true });

    const { count: osonishJobs } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'osonish');

    const { count: activeOsonish } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'osonish')
        .eq('is_active', true);

    const { count: inactiveOsonish } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'osonish')
        .eq('is_active', false);

    console.log('📊 JOB COUNTS:');
    console.log(`   Total jobs in DB: ${totalJobs}`);
    console.log(`   OsonIsh jobs: ${osonishJobs}`);
    console.log(`   Active OsonIsh: ${activeOsonish}`);
    console.log(`   Inactive OsonIsh: ${inactiveOsonish}`);
    console.log('');

    // 2. Jobs with/without region_id
    const { count: withRegion } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'osonish')
        .eq('is_active', true)
        .not('region_id', 'is', null);

    const { count: withoutRegion } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'osonish')
        .eq('is_active', true)
        .is('region_id', null);

    console.log('📍 REGION MAPPING:');
    console.log(`   Active jobs WITH region_id: ${withRegion}`);
    console.log(`   Active jobs WITHOUT region_id: ${withoutRegion}`);
    console.log('');

    // 3. Region distribution
    const { data: regionDist } = await supabase
        .from('jobs')
        .select('region_id, regions(name_uz)')
        .eq('source', 'osonish')
        .eq('is_active', true)
        .not('region_id', 'is', null);

    const regionCounts: Record<string, number> = {};
    for (const job of regionDist || []) {
        const regionName = (job.regions as any)?.name_uz || `ID:${job.region_id}`;
        regionCounts[regionName] = (regionCounts[regionName] || 0) + 1;
    }

    console.log('🗺️ REGION DISTRIBUTION (Active OsonIsh):');
    const sortedRegions = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]);
    for (const [region, count] of sortedRegions) {
        console.log(`   ${region}: ${count} jobs`);
    }
    console.log('');

    // 4. Last import log
    const { data: lastLog } = await supabase
        .from('import_logs')
        .select('*')
        .eq('source', 'osonish')
        .order('created_at', { ascending: false })
        .limit(5);

    console.log('📜 LAST 5 IMPORT LOGS:');
    for (const log of lastLog || []) {
        console.log(`   [${log.created_at}] ${log.status} - Found: ${log.total_found}, Updated: ${log.updated}, Errors: ${log.errors}`);
    }
    console.log('');

    // 5. Check source_status distribution
    const { data: statusDist } = await supabase
        .from('jobs')
        .select('source_status')
        .eq('source', 'osonish');

    const statusCounts: Record<string, number> = {};
    for (const job of statusDist || []) {
        const status = job.source_status || 'null';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    }

    console.log('📋 SOURCE STATUS DISTRIBUTION:');
    for (const [status, count] of Object.entries(statusCounts)) {
        console.log(`   ${status}: ${count}`);
    }
    console.log('');

    // 6. Sample jobs without region mapping
    const { data: unMapped } = await supabase
        .from('jobs')
        .select('source_id, title_uz, region_name, district_name, raw_source_json')
        .eq('source', 'osonish')
        .eq('is_active', true)
        .is('region_id', null)
        .limit(5);

    if (unMapped && unMapped.length > 0) {
        console.log('❌ SAMPLE JOBS WITHOUT REGION MAPPING:');
        for (const job of unMapped) {
            const raw = job.raw_source_json as any;
            console.log(`   ID: ${job.source_id}`);
            console.log(`      Title: ${job.title_uz}`);
            console.log(`      region_name: "${job.region_name}"`);
            console.log(`      district_name: "${job.district_name}"`);
            console.log(`      raw.filial.region: ${JSON.stringify(raw?.filial?.region)}`);
            console.log('');
        }
    }

    console.log('=== Diagnostics Complete ===');
}

diagnose().catch(console.error);
