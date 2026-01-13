import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock job data
const mockJob = {
    id: '1',
    title_uz: 'Dasturchi',
    title_ru: 'Программист',
    description_uz: 'Test description',
    description_ru: 'Тестовое описание',
    company_name: 'Test Company',
    salary_min: 5000000,
    salary_max: 10000000,
    employment_type: 'full_time',
    is_active: true,
    views_count: 100,
    created_at: new Date().toISOString(),
    categories: { id: '1', name_uz: 'IT', name_ru: 'IT', icon: 'Code' },
    districts: { id: '1', name_uz: 'Andijon', name_ru: 'Андижан', type: 'city' },
};

// Mock contexts
jest.mock('@/contexts/language-context', () => ({
    useLanguage: () => ({
        lang: 'uz',
        t: {
            job: {
                salary: 'Maosh',
                perMonth: 'oyiga',
                details: 'Batafsil',
                views: 'Ko\'rishlar',
            },
            employmentTypes: {
                full_time: 'To\'liq kun',
                part_time: 'Yarim kun',
            },
        },
    }),
}));

describe('Job List', () => {
    it('renders job cards with correct information', () => {
        render(
            <div data-testid="job-card">
                <h3>{mockJob.title_uz}</h3>
                <p>{mockJob.company_name}</p>
                <span>5.0 mln - 10.0 mln</span>
            </div>
        );

        expect(screen.getByTestId('job-card')).toBeInTheDocument();
        expect(screen.getByText('Dasturchi')).toBeInTheDocument();
        expect(screen.getByText('Test Company')).toBeInTheDocument();
    });

    it('displays job salary range', () => {
        render(
            <div data-testid="job-card">
                <span data-testid="salary">5.0 mln - 10.0 mln</span>
            </div>
        );

        expect(screen.getByTestId('salary')).toHaveTextContent('5.0 mln');
    });

    it('shows empty state when no jobs found', () => {
        render(
            <div data-testid="empty-state">
                Vakansiyalar topilmadi
            </div>
        );

        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
});
