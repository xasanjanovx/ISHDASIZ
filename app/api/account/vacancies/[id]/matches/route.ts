import { NextRequest } from 'next/server';
import { accountFailure, accountResult, requireAccount } from '@/lib/auth/account';
import { ownVacancy, vacancyEmployer, vacancyResult } from '@/lib/account-vacancies';
import { isRemoteJob } from '@/lib/work-mode';
import { rankVacancyCandidates } from '@/lib/vacancy-candidates';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { client, user } = await requireAccount(request), { id } = await params;
    const employer = await vacancyEmployer(client, user.id);
    const job = await ownVacancy(client, user.id, employer.id, id);
    // Public, opted-in resumes only; another employer's vacancy is rejected.
    let query = client.from('resumes').select('id,title,full_name,city,category_id,region_id,district_id,experience,experience_years,education_level,skills,expected_salary_min,expected_salary_max,created_at,regions(name_uz,name_ru),districts(name_uz,name_ru)')
      .eq('ishdasiz_resume_available', true).eq('is_public', true).eq('status', 'active').neq('user_id', user.id);
    if (job.category_id) query = query.eq('category_id', job.category_id);
    if (job.region_id && !isRemoteJob(job)) query = query.eq('region_id', job.region_id);
    const result = await query.order('created_at', { ascending: false }).order('id').limit(501).abortSignal(AbortSignal.timeout(12000));
    if (result.error || !Array.isArray(result.data)) throw new Error('Candidates unavailable');
    const candidates = rankVacancyCandidates(job, (result.data as any[]).slice(0, 500));
    return accountResult({ vacancy: vacancyResult(job), candidates, examined: Math.min(500, result.data.length), hasMore: result.data.length > 500 });
  } catch (error) { return accountFailure(error); }
}
