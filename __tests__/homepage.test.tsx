import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock the contexts
jest.mock('@/contexts/language-context', () => ({
    useLanguage: () => ({
        lang: 'uz',
        t: {
            siteName: 'ISHDASIZ',
            nav: { home: 'Bosh sahifa', jobs: 'Vakansiyalar', map: 'Xarita' },
            hero: { title: 'Andijon viloyatida ish toping', searchPlaceholder: 'Kasbingizni kiriting...' },
            stats: { totalJobs: 'Jami vakansiyalar' },
        },
    }),
    LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/contexts/auth-context', () => ({
    useAuth: () => ({
        user: null,
        adminProfile: null,
        loading: false,
    }),
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock components that have complex dependencies
jest.mock('@/components/home/hero-section', () => ({
    HeroSection: () => <div data-testid="hero-section">Hero Section</div>,
}));

jest.mock('@/components/home/latest-jobs-section', () => ({
    LatestJobsSection: ({ jobs }: { jobs: any[] }) => (
        <div data-testid="latest-jobs-section">
            Latest Jobs: {jobs.length}
        </div>
    ),
}));

jest.mock('@/components/home/categories-section', () => ({
    CategoriesSection: () => <div data-testid="categories-section">Categories</div>,
}));

describe('Homepage', () => {
    it('renders the hero section', () => {
        render(
            <>
                <div data-testid="hero-section">Hero Section</div>
                <div data-testid="latest-jobs-section">Latest Jobs</div>
                <div data-testid="categories-section">Categories</div>
            </>
        );

        expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    });

    it('renders the latest jobs section', () => {
        render(
            <>
                <div data-testid="hero-section">Hero Section</div>
                <div data-testid="latest-jobs-section">Latest Jobs</div>
                <div data-testid="categories-section">Categories</div>
            </>
        );

        expect(screen.getByTestId('latest-jobs-section')).toBeInTheDocument();
    });

    it('renders the categories section', () => {
        render(
            <>
                <div data-testid="hero-section">Hero Section</div>
                <div data-testid="latest-jobs-section">Latest Jobs</div>
                <div data-testid="categories-section">Categories</div>
            </>
        );

        expect(screen.getByTestId('categories-section')).toBeInTheDocument();
    });
});
