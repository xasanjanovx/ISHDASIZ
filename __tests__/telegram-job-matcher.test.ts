import { calculateMatchScore } from '@/lib/telegram/job-matcher';

describe('telegram job matcher', () => {
    it('matches district ids as strings', () => {
        const profile = {
            region_id: 1,
            district_id: 'district-uuid',
            category_id: 'cat-1',
            expected_salary_min: 2000000,
            experience_level: 'no_experience'
        };

        const job = {
            id: 'job-1',
            region_id: 1,
            district_id: 'district-uuid',
            category_id: 'cat-1',
            salary_min: 3000000
        };

        const result = calculateMatchScore(profile, job);
        expect(result.matchScore).toBeGreaterThanOrEqual(60);
    });

    it('adds neighbor region bonus', () => {
        const profile = {
            region_id: 1
        };

        const job = {
            id: 'job-2',
            region_id: 2
        };

        const result = calculateMatchScore(profile, job);
        expect(result.matchScore).toBeGreaterThanOrEqual(10);
    });
});
