'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth as useUserAuth } from '@/hooks/useAuth';
import { useAuth as useAdminAuth } from '@/contexts/auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';

interface ProtectedRouteProps {
    children: ReactNode;
    allowedRole?: 'job_seeker' | 'employer';
}

export function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
    const { user, isLoading, isLoggedIn } = useUserAuth();
    const { user: adminUser, adminProfile, loading: adminLoading } = useAdminAuth();
    const router = useRouter();
    const { openModal } = useAuthModal();

    // Check if admin is logged in
    const isAdmin = !!adminUser && !!adminProfile;

    useEffect(() => {
        // Wait for both auth systems to load
        if (isLoading || adminLoading) return;

        // Admin has access to everything
        if (isAdmin) return;

        if (!isLoggedIn()) {
            // Not authenticated - redirect to home and open modal
            router.push('/');
            openModal();
            return;
        }

        // Check if user has the required profile for this role
        if (allowedRole) {
            const hasRequiredProfile = allowedRole === 'job_seeker'
                ? user?.has_job_seeker_profile
                : user?.has_employer_profile;

            if (!hasRequiredProfile) {
                // User doesn't have this profile - redirect to correct profile
                const correctPath = user?.has_employer_profile
                    ? '/profile/employer'
                    : '/profile/job-seeker';
                router.push(correctPath);
            }
        }
    }, [isLoading, adminLoading, isLoggedIn, isAdmin, user, allowedRole, router, openModal]);

    // Show loading state
    if (isLoading || adminLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-sky-500 border-t-transparent"></div>
            </div>
        );
    }

    // Admin has full access
    if (isAdmin) {
        return <>{children}</>;
    }

    // Not logged in - show nothing (will redirect)
    if (!isLoggedIn()) {
        return null;
    }

    // Check if user has the required profile
    if (allowedRole) {
        const hasRequiredProfile = allowedRole === 'job_seeker'
            ? user?.has_job_seeker_profile
            : user?.has_employer_profile;

        if (!hasRequiredProfile) {
            return null;
        }
    }

    // Authorized - render children
    return <>{children}</>;
}
