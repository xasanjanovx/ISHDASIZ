'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserAuth } from '@/contexts/user-auth-context';
import { Loader2 } from '@/components/ui/icons';

export default function UnifiedMessagesPage() {
    const { user, isAuthenticated, isLoading } = useUserAuth();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;

        if (!isAuthenticated) {
            router.push('/');
            return;
        }

        if (user?.active_role === 'employer') {
            router.push('/profile/employer/messages');
        } else {
            router.push('/profile/job-seeker/messages');
        }
    }, [user, isAuthenticated, isLoading, router]);

    return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
    );
}
