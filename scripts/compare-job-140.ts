/**
 * DETAILED FIELD COMPARISON: OsonIsh API vs Local DB
 * This script performs a thorough analysis of ALL fields
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface FieldComparison {
    field: string;
    osonish: any;
    local: any;
    match: boolean;
    notes: string;
}

async function main() {
    const sourceId = '140';

    console.log('='.repeat(80));
    console.log('DETAILED FIELD COMPARISON: OsonIsh vs Local DB');
    console.log('='.repeat(80));

    // 1. Fetch from OsonIsh API
    console.log('\n[1] Fetching from OsonIsh API...');
    const response = await fetch(`https://osonish.uz/api/api/v1/vacancies/140`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const json = await response.json();
    const remote = json.data;

    if (!remote) {
        console.error('ERROR: No data from OsonIsh API');
        return;
    }

    // 2. Fetch from Local DB
    console.log('[2] Fetching from Local DB...');
    const { data: local, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('source_id', sourceId)
        .eq('source', 'osonish')
        .single();

    if (error || !local) {
        console.error('ERROR: No local job found:', error);
        return;
    }

    console.log(`\nLocal job ID: ${local.id}`);
    console.log(`Source URL: ${local.source_url}`);

    // 3. Field-by-field comparison
    console.log('\n' + '='.repeat(80));
    console.log('FIELD-BY-FIELD COMPARISON');
    console.log('='.repeat(80));

    const comparisons: FieldComparison[] = [];

    // Helper function
    const compare = (field: string, osonishVal: any, localVal: any, notes = '') => {
        const match = JSON.stringify(osonishVal) === JSON.stringify(localVal);
        comparisons.push({ field, osonish: osonishVal, local: localVal, match, notes });

        const status = match ? '✅' : '❌';
        console.log(`\n${status} ${field}:`);
        console.log(`   OsonIsh: ${JSON.stringify(osonishVal)}`);
        console.log(`   Local:   ${JSON.stringify(localVal)}`);
        if (notes) console.log(`   Notes:   ${notes}`);
    };

    // ==================== BASIC INFO ====================
    console.log('\n--- BASIC INFO ---');
    compare('title', remote.title, local.title_uz);
    compare('company_name', remote.company?.name, local.company_name);
    compare('description (info)', remote.info, local.description_uz || null, 'Should be HTML stripped or fallback generated');

    // ==================== SALARY ====================
    console.log('\n--- SALARY ---');
    compare('salary_min', remote.min_salary, local.salary_min);
    compare('salary_max', remote.max_salary, local.salary_max);
    compare('payment_type', remote.payment_type, local.payment_type, '1=monthly, 2=hourly, etc.');

    // ==================== LOCATION ====================
    console.log('\n--- LOCATION ---');
    compare('region_id (OsonIsh)', remote.filial?.region?.id, local.region_id, 'Should be mapped to our ID');
    compare('region_name', remote.filial?.region?.name_uz, local.region_name);
    compare('district_id (OsonIsh)', remote.filial?.city?.id, local.district_id, 'Should be mapped to our ID');
    compare('district_name', remote.filial?.city?.name_uz, local.district_name);
    compare('address', remote.filial?.address, local.address);
    compare('latitude', parseFloat(remote.filial?.lat), local.latitude);
    compare('longitude', parseFloat(remote.filial?.long), local.longitude);

    // ==================== CATEGORY ====================
    console.log('\n--- CATEGORY ---');
    compare('mmk_group.cat1', remote.mmk_group?.cat1, null, 'Source category level 1');
    compare('mmk_group.cat2', remote.mmk_group?.cat2, null, 'Source category level 2 - USED FOR MAPPING');
    compare('mmk_group.cat3', remote.mmk_group?.cat3, null, 'Source category level 3');
    compare('mmk_position', remote.mmk_position?.position_name, null, 'Position name from classifier');
    console.log(`   Local category_id: ${local.category_id}`);

    // ==================== REQUIREMENTS ====================
    console.log('\n--- REQUIREMENTS ---');
    compare('gender', remote.gender, local.gender ? parseInt(local.gender) : null, '1=Male, 2=Female, 3=Any');
    compare('age_from', remote.age_from, local.age_min);
    compare('age_to', remote.age_to, local.age_max);
    compare('min_education', remote.min_education, null, '2=vocational, 3=higher. Local uses text codes.');
    console.log(`   Local education_level: ${local.education_level}`);
    compare('work_experiance', remote.work_experiance, null, '1=none, 2=1-3yrs, etc. Local uses code.');
    console.log(`   Local experience: ${local.experience}`);
    console.log(`   Local experience_years: ${local.experience_years}`);

    // ==================== WORK CONDITIONS ====================
    console.log('\n--- WORK CONDITIONS ---');
    compare('busyness_type', remote.busyness_type, null, '1=permanent, 2=temporary. Maps to employment_type.');
    console.log(`   Local employment_type: ${local.employment_type}`);
    compare('work_type', remote.work_type, null, '1=onsite, 2=remote, 3=hybrid. Maps to work_mode.');
    console.log(`   Local work_mode: ${local.work_mode}`);
    compare('working_days_id', remote.working_days_id, local.working_days ? parseInt(local.working_days) : null);
    const remoteHours = remote.working_time_from && remote.working_time_to
        ? `${remote.working_time_from} - ${remote.working_time_to}` : null;
    compare('working_hours', remoteHours, local.working_hours);

    // ==================== SPECIAL FLAGS ====================
    console.log('\n--- SPECIAL FLAGS (for_whos) ---');
    const forWhos = remote.for_whos || [];
    compare('for_whos array', forWhos, null, '1=disabled, 2=graduates, 3=students');
    compare('is_for_disabled', forWhos.includes(1), local.is_for_disabled);
    compare('is_for_graduates', forWhos.includes(2), local.is_for_graduates);
    compare('is_for_students', forWhos.includes(3), local.is_for_students);
    compare('is_for_women (gender=2)', remote.gender === 2, local.is_for_women);

    // ==================== CONTACTS ====================
    console.log('\n--- CONTACTS ---');
    compare('hr.phone', remote.hr?.phone, local.contact_phone);
    compare('hr.fio', remote.hr?.fio, local.hr_name);
    compare('additional_phone', remote.additional_phone, local.additional_phone);
    compare('another_network (telegram)', remote.another_network, local.contact_telegram);

    // ==================== SKILLS & BENEFITS ====================
    console.log('\n--- SKILLS & BENEFITS ---');
    const skillNames = remote.skills_details?.map((s: any) => s.skill_name) || [];
    compare('skills_details', skillNames, local.skills);
    compare('benefit_ids', remote.benefit_ids, null, 'Should be converted to text');
    console.log(`   Local benefits: ${local.benefits}`);

    // ==================== OTHER ====================
    console.log('\n--- OTHER ---');
    compare('count (vacancy_count)', remote.count, local.vacancy_count);
    compare('views_count', remote.views_count, local.views_count, 'May differ due to timing');

    // ==================== SUMMARY ====================
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));

    const mismatches = comparisons.filter(c => !c.match);
    console.log(`\nTotal fields compared: ${comparisons.length}`);
    console.log(`Matches: ${comparisons.length - mismatches.length}`);
    console.log(`Mismatches: ${mismatches.length}`);

    if (mismatches.length > 0) {
        console.log('\n❌ MISMATCHED FIELDS:');
        mismatches.forEach(m => {
            console.log(`   - ${m.field}`);
        });
    }

    // ==================== RAW DATA DUMP ====================
    console.log('\n' + '='.repeat(80));
    console.log('RAW OSONISH DATA (for reference)');
    console.log('='.repeat(80));
    console.log(JSON.stringify(remote, null, 2));
}

main().catch(console.error);
