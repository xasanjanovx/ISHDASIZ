/**
 * Import Quality Audit Script
 * Compares OsonIsh API data with ISHDASIZ database
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ComparisonResult {
    source_id: number;
    title: string;
    issues: string[];
    osonish: Record<string, any>;
    ishdasiz: Record<string, any> | null;
}

async function fetchOsonishVacancy(id: number): Promise<any> {
    try {
        const res = await fetch(`https://osonish.uz/api/api/v1/vacancies/${id}`, {
            headers: { 'Accept': 'application/json' }
        });
        const data = await res.json();
        return data.success ? data.data : null;
    } catch (e) {
        console.error(`Failed to fetch OsonIsh ${id}:`, e);
        return null;
    }
}

async function fetchIshdasizBySourceId(sourceId: number): Promise<any> {
    const { data } = await supabase
        .from('jobs')
        .select('*')
        .eq('source', 'osonish')
        .eq('source_id', String(sourceId))
        .single();
    return data;
}

function compareVacancy(osonish: any, ishdasiz: any): string[] {
    const issues: string[] = [];

    if (!ishdasiz) {
        issues.push('NOT IMPORTED: Vacancy not found in ISHDASIZ database');
        return issues;
    }

    // Category
    const srcCat = osonish.mmk_group?.cat2 || osonish.mmk_group?.cat1 || 'N/A';
    if (!ishdasiz.category_id) {
        issues.push(`CATEGORY: Not mapped (source: ${srcCat})`);
    }

    // Region
    const srcRegion = osonish.filial?.region?.name_uz;
    if (srcRegion && !ishdasiz.region_id) {
        issues.push(`REGION: Not mapped (source: ${srcRegion})`);
    }

    // District
    const srcDistrict = osonish.filial?.city?.name_uz;
    if (srcDistrict && !ishdasiz.district_id) {
        issues.push(`DISTRICT: Not mapped (source: ${srcDistrict})`);
    }

    // Salary
    if (osonish.min_salary && ishdasiz.salary_min !== osonish.min_salary) {
        issues.push(`SALARY_MIN: Mismatch (source: ${osonish.min_salary}, ours: ${ishdasiz.salary_min})`);
    }
    if (osonish.max_salary && ishdasiz.salary_max !== osonish.max_salary) {
        issues.push(`SALARY_MAX: Mismatch (source: ${osonish.max_salary}, ours: ${ishdasiz.salary_max})`);
    }

    // Gender
    if (osonish.gender && ishdasiz.gender !== osonish.gender) {
        issues.push(`GENDER: Mismatch (source: ${osonish.gender}, ours: ${ishdasiz.gender})`);
    }

    // Education
    if (osonish.min_education && ishdasiz.education_level !== osonish.min_education) {
        issues.push(`EDUCATION: Mismatch (source: ${osonish.min_education}, ours: ${ishdasiz.education_level})`);
    }

    // Experience
    if (osonish.work_experiance && !ishdasiz.experience) {
        issues.push(`EXPERIENCE: Not stored (source: ${osonish.work_experiance})`);
    }

    // Working days
    if (osonish.working_days_id && !ishdasiz.working_schedule) {
        const raw = ishdasiz.raw_source_json;
        if (!raw?.working_days_id) {
            issues.push(`WORKING_DAYS: Not in raw_source_json (source: ${osonish.working_days_id})`);
        }
    }

    // Benefits
    if (osonish.benefit_ids?.length > 0 && !ishdasiz.benefits) {
        issues.push(`BENEFITS: Not stored (source has ${osonish.benefit_ids.length} benefits)`);
    }

    // Special flags
    const forWhos = osonish.for_whos || [];
    if (forWhos.includes(1) && !ishdasiz.is_for_disabled) {
        issues.push('IS_FOR_DISABLED: Should be true');
    }
    if (forWhos.includes(2) && !ishdasiz.is_for_graduates) {
        issues.push('IS_FOR_GRADUATES: Should be true');
    }
    if (forWhos.includes(3) && !ishdasiz.is_for_students) {
        issues.push('IS_FOR_STUDENTS: Should be true');
    }

    // Contact info
    if (osonish.hr?.phone && !ishdasiz.contact_phone) {
        issues.push(`CONTACT_PHONE: Not stored (source: ${osonish.hr.phone})`);
    }

    if (issues.length === 0) {
        issues.push('✅ ALL FIELDS MATCH');
    }

    return issues;
}

async function runAudit() {
    console.log('🔍 IMPORT QUALITY AUDIT');
    console.log('========================\n');

    // Get 10 random OsonIsh IDs that exist in our DB
    const { data: sampleJobs } = await supabase
        .from('jobs')
        .select('source_id')
        .eq('source', 'osonish')
        .order('created_at', { ascending: false })
        .limit(10);

    if (!sampleJobs || sampleJobs.length === 0) {
        console.log('No OsonIsh jobs found in database!');
        return;
    }

    const ids = sampleJobs.map(j => parseInt(j.source_id));
    console.log(`Analyzing ${ids.length} vacancies: ${ids.join(', ')}\n`);

    const allIssues: Record<string, number> = {};
    let totalIssues = 0;
    let perfectMatches = 0;

    for (const id of ids) {
        console.log(`\n--- Vacancy ${id} ---`);

        const osonish = await fetchOsonishVacancy(id);
        if (!osonish) {
            console.log('❌ Could not fetch from OsonIsh API');
            continue;
        }

        const ishdasiz = await fetchIshdasizBySourceId(id);
        const issues = compareVacancy(osonish, ishdasiz);

        console.log(`Title: ${osonish.title}`);
        console.log(`OsonIsh Category: ${osonish.mmk_group?.cat2 || osonish.mmk_group?.cat1 || 'N/A'}`);
        console.log(`OsonIsh Region: ${osonish.filial?.region?.name_uz || 'N/A'}`);
        console.log(`Issues found: ${issues.length}`);

        issues.forEach(i => {
            console.log(`  - ${i}`);
            if (!i.includes('✅')) {
                const issueType = i.split(':')[0];
                allIssues[issueType] = (allIssues[issueType] || 0) + 1;
                totalIssues++;
            } else {
                perfectMatches++;
            }
        });
    }

    console.log('\n\n========== SUMMARY ==========');
    console.log(`Total vacancies analyzed: ${ids.length}`);
    console.log(`Perfect matches: ${perfectMatches}`);
    console.log(`Total issues found: ${totalIssues}`);
    console.log('\nIssue breakdown:');
    Object.entries(allIssues)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
            console.log(`  ${type}: ${count}`);
        });
}

runAudit().catch(console.error);

