import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
    useRouter() {
        return {
            push: jest.fn(),
            replace: jest.fn(),
            back: jest.fn(),
            prefetch: jest.fn(),
        };
    },
    useSearchParams() {
        return new URLSearchParams();
    },
    useParams() {
        return {};
    },
}));

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
    supabase: {
        from: jest.fn(() => ({
            select: jest.fn(() => ({
                eq: jest.fn(() => ({
                    order: jest.fn(() => ({
                        limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
                    })),
                    maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
                })),
                order: jest.fn(() => Promise.resolve({ data: [], error: null })),
            })),
            insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
    },
}));
