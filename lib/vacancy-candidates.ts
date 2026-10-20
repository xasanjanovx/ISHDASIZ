import { matchAndSortJobs } from '@/lib/telegram/job-matcher';
import { publicResumeCard } from '@/lib/resume-catalog';
import { isRemoteJob } from '@/lib/work-mode';

/** Recommend on professional requirements. Personal traits are not ranking inputs. */
export function rankVacancyCandidates(job: any, rows: any[]) {
  const professionalJob = { ...job, gender: 'any', age_min: null, age_max: null };
  return rows.flatMap(row => {
    if (!isRemoteJob(professionalJob) && job.region_id != null && String(row.region_id) !== String(job.region_id)) return [];
    const match = matchAndSortJobs({ ...row, gender: undefined, birth_date: undefined }, [professionalJob])[0];
    if (!match || !match.matchCriteria.salary) return [];
    return [{ resume: publicResumeCard(row), score: match.matchScore, conditional: match.conditionallySuitable === true,
      criteria: Object.entries(match.matchCriteria).filter(([key, value]) => value && key !== 'gender' && key !== 'age').map(([key]) => key) }];
  }).sort((a, b) => Number(a.conditional) - Number(b.conditional) || b.score - a.score).slice(0, 8)
    .map(({ score: _score, ...candidate }) => candidate);
}
