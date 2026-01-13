'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function ProfileSkeleton() {
    return (
        <div className="space-y-6">
            {/* Header Card */}
            <div className="bg-white rounded-xl border p-6">
                <div className="flex items-start gap-6">
                    {/* Avatar */}
                    <Skeleton className="h-24 w-24 rounded-full flex-shrink-0" />

                    <div className="flex-1 space-y-3">
                        {/* Name */}
                        <Skeleton className="h-8 w-48" />
                        {/* Role/Title */}
                        <Skeleton className="h-4 w-32" />
                        {/* Stats */}
                        <div className="flex gap-6 pt-2">
                            <div className="space-y-1">
                                <Skeleton className="h-6 w-12" />
                                <Skeleton className="h-3 w-16" />
                            </div>
                            <div className="space-y-1">
                                <Skeleton className="h-6 w-12" />
                                <Skeleton className="h-3 w-16" />
                            </div>
                            <div className="space-y-1">
                                <Skeleton className="h-6 w-12" />
                                <Skeleton className="h-3 w-16" />
                            </div>
                        </div>
                    </div>

                    {/* Edit Button */}
                    <Skeleton className="h-10 w-28 rounded-lg" />
                </div>
            </div>

            {/* Content Cards */}
            <div className="grid md:grid-cols-2 gap-6">
                {/* Info Card */}
                <div className="bg-white rounded-xl border p-6 space-y-4">
                    <Skeleton className="h-6 w-40" />
                    <div className="space-y-3">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <Skeleton className="h-5 w-5 rounded" />
                                <Skeleton className="h-4 w-full" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Stats Card */}
                <div className="bg-white rounded-xl border p-6 space-y-4">
                    <Skeleton className="h-6 w-32" />
                    <div className="grid grid-cols-2 gap-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-10 w-16" />
                                <Skeleton className="h-3 w-20" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* List Section */}
            <div className="bg-white rounded-xl border p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-36" />
                    <Skeleton className="h-9 w-24 rounded-lg" />
                </div>
                <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                            <Skeleton className="h-12 w-12 rounded-lg" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-5 w-48" />
                                <Skeleton className="h-4 w-32" />
                            </div>
                            <Skeleton className="h-8 w-20 rounded" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function ProfileCardSkeleton() {
    return (
        <div className="bg-white rounded-xl border p-4 space-y-3">
            <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-3 w-24" />
                </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
        </div>
    );
}

export function MessageListSkeleton() {
    return (
        <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-4 border rounded-lg">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <div className="flex justify-between">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-4 w-16" />
                        </div>
                        <Skeleton className="h-4 w-full" />
                    </div>
                </div>
            ))}
        </div>
    );
}
