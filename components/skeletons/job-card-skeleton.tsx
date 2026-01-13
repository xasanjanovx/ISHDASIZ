'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function JobCardSkeleton() {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            {/* Header: Title + Company */}
            <div className="space-y-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
            </div>

            {/* Salary */}
            <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-4 w-32" />
            </div>

            {/* Location */}
            <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-4 w-40" />
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
            </div>

            {/* Footer: Date + Button */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-28 rounded-lg" />
            </div>
        </div>
    );
}

export function JobCardSkeletonGrid({ count = 6 }: { count?: number }) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(count)].map((_, i) => (
                <JobCardSkeleton key={i} />
            ))}
        </div>
    );
}
