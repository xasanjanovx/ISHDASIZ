/**
 * COMPLETE FIX for Job 140 (Xareogrof)
 * Updates ALL fields to match OsonIsh API exactly
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { mapOsonishCategory } from '../lib/mappers/osonish-mapper';
import { getMappedValue, OSONISH_MAPPINGS } from '../lib/mappings';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// === HELPERS ===

function normalizePhone(phone?: string): string | null {
    if (!phone) return null;
    const cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.match(/^\+?998\d{9}$/)) {
        return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
    }
    return null;
}

function mapEmploymentType(busynessType?: number): string {
    const map: Record<number, string> = { 1: 'full_time', 2: 'contract', 3: 'contract', 4: 'internship' };
    return busynessType ? (map[busynessType] || 'full_time') : 'full_time';
}

function mapWorkMode(workType?: number): string | null {
    const map: Record<number, string> = { 1: 'onsite', 2: 'remote', 3: 'remote', 4: 'hybrid' };
    return workType ? (map[workType] || null) : null;
}

function mapEducationLevel(minEducation?: number): string | null {
    const map: Record<number, string> = { 1: 'secondary', 2: 'vocational', 3: 'higher', 4: 'higher' };
    return minEducation ? (map[minEducation] || null) : null;
}

function mapExperience(expId?: number): number {
    const map: Record<number, number> = { 1: 0, 2: 2, 3: 5, 4: 7 };
    return expId !== undefined ? (map[expId] ?? 0) : 0;
}

function convertBenefitsToText(benefitIds: number[] | undefined, lang: 'uz' | 'ru' = 'uz'): string | null {
    if (!benefitIds || benefitIds.length === 0) return null;
    const benefitLabels = benefitIds
        .map(id => getMappedValue('benefits', id, lang))
        .filter(Boolean);
    return benefitLabels.length > 0 ? benefitLabels.join(', ') : null;
}

async function main() {
    console.log('='.repeat(80));
    console.log('COMPLETE FIX for Job 140');
    console.log('='.repeat(80));

    // 1. Fetch from OsonIsh API
    console.log('\n[1] Fetching from OsonIsh API...');
    const response = await fetch('https://osonish.uz/api/v1/vacancies/140', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const json = await response.json();
    const remote = json.data;

    if (!remote) {
        console.error('ERROR: No data from API');
        return;
    }

    // 2. Map category
    const sourceCategory = remote.mmk_group?.cat2 || remote.mmk_group?.cat1 || '';
    const mapResult = mapOsonishCategory(sourceCategory, remote.mmk_group?.cat3 || null, remote.title || '');
    console.log(`Category mapping: "${sourceCategory}" -> ${mapResult.categoryKey} (${mapResult.categoryId})`);

    // 3. Generate fallback description if needed
    let description = remote.info;
    if (!description && remote.mmk_position?.position_name) {
        const skillsList = remote.skills_details?.map((s: any) => s.skill_name) || [];
        description = remote.mmk_position.position_name;
        if (skillsList.length > 0) {
            description += '\n\nTalablar:\n' + skillsList.map((s: string) => '- ' + s).join('\n');
        }
    }

    // 4. Extract for_whos flags
    const forWhos = remote.for_whos || [];

    // 5. Build complete update data
    const updateData = {
        // Basic
        title_uz: remote.title || 'Noma\'lum lavozim',
        title_ru: remote.title || 'Неизвестная должность',
        company_name: remote.company?.name || 'Noma\'lum kompaniya',
        description_uz: description || '',
        description_ru: description || '',

        // Category
        category_id: mapResult.categoryId,
        source_category: sourceCategory || null,
        source_subcategory: remote.mmk_group?.cat3 || null,

        // Salary
        salary_min: remote.min_salary || null,
        salary_max: remote.max_salary || null,
        payment_type: remote.payment_type || null,

        // Location (exact values from API)
        region_id: remote.filial?.region?.id || null,
        region_name: remote.filial?.region?.name_uz || null,
        district_id: remote.filial?.city?.id || null,
        district_name: remote.filial?.city?.name_uz || null,
        address: remote.filial?.address || null,
        latitude: remote.filial?.lat ? parseFloat(remote.filial.lat) : null,
        longitude: remote.filial?.long ? parseFloat(remote.filial.long) : null,

        // Requirements
        gender: remote.gender !== null ? String(remote.gender) : null,
        age_min: remote.age_from || null,
        age_max: remote.age_to || null,
        education_level: mapEducationLevel(remote.min_education),
        experience: remote.work_experiance !== null ? String(remote.work_experiance) : null,
        experience_years: mapExperience(remote.work_experiance),

        // Work conditions
        employment_type: mapEmploymentType(remote.busyness_type),
        work_mode: mapWorkMode(remote.work_type),
        working_days: remote.working_days_id !== null ? String(remote.working_days_id) : null,
        working_hours: remote.working_time_from && remote.working_time_to
            ? `${remote.working_time_from} - ${remote.working_time_to}` : null,

        // Special flags
        is_for_disabled: forWhos.includes(1),
        is_for_graduates: forWhos.includes(2),
        is_for_students: forWhos.includes(3),
        is_for_women: remote.gender === 2,

        // Contacts
        contact_phone: normalizePhone(remote.hr?.phone),
        hr_name: remote.hr?.fio || null,
        additional_phone: normalizePhone(remote.additional_phone),
        contact_telegram: null, // remote.another_network is null

        // Skills & Benefits
        skills: remote.skills_details?.map((s: any) => s.skill_name) || null,
        benefits: convertBenefitsToText(remote.benefit_ids, 'uz'),

        // Other
        vacancy_count: remote.count || 1,
        views_count: remote.views_count || 0,

        // Raw JSON
        raw_source_json: remote,

        // Sync timestamps
        last_synced_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        last_checked_at: new Date().toISOString(),
        source_status: 'active',
        is_active: true,
        status: 'active'
    };

    console.log('\n[2] Update data prepared:');
    console.log(JSON.stringify(updateData, null, 2));

    // 6. Update in DB
    console.log('\n[3] Updating job in database...');
    const { data, error } = await supabase
        .from('jobs')
        .update(updateData)
        .eq('source_id', '140')
        .eq('source', 'osonish')
        .select('id');

    if (error) {
        console.error('UPDATE ERROR:', error);
    } else {
        console.log(`\n✅ SUCCESS! Updated job: ${data?.[0]?.id}`);
    }

    // 7. Verify
    console.log('\n[4] Verifying update...');
    const { data: verify } = await supabase
        .from('jobs')
        .select('category_id, description_uz, source_category, region_name, district_name')
        .eq('source_id', '140')
        .eq('source', 'osonish')
        .single();

    console.log('Verified data:', verify);
}

main().catch(console.error);

