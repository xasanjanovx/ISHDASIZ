'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function JobDetailSkeleton() {
    return (
        <div className="container mx-auto px-4 py-8">
            <div className="grid lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Breadcrumb */}
                    <div className="flex gap-2">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-4 w-24" />
                    </div>

                    {/* Title */}
                    <div className="space-y-3">
                        <Skeleton className="h-10 w-3/4" />
                        <div className="flex gap-4">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-5 w-24" />
                        </div>
                    </div>

                    {/* Company Card */}
                    <div className="bg-white rounded-xl border p-6 space-y-4">
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-16 w-16 rounded-xl" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-6 w-48" />
                                <Skeleton className="h-4 w-32" />
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="bg-white rounded-xl border p-6 space-y-4">
                        <Skeleton className="h-6 w-32" />
                        <div className="space-y-3">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-5/6" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-4/5" />
                        </div>

                        <Skeleton className="h-6 w-28 mt-6" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-4 w-2/3" />
                            <Skeleton className="h-4 w-1/2" />
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Salary Card */}
                    <div className="bg-white rounded-xl border p-6 space-y-4">
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-12 w-full rounded-lg" />
                    </div>

                    {/* Details Card */}
                    <div className="bg-white rounded-xl border p-6 space-y-4">
                        <Skeleton className="h-6 w-32" />
                        <div className="space-y-3">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="flex justify-between">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-4 w-20" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Share Card */}
                    <div className="bg-white rounded-xl border p-6 space-y-4">
                        <Skeleton className="h-6 w-28" />
                        <div className="flex gap-2">
                            <Skeleton className="h-10 w-10 rounded-lg" />
                            <Skeleton className="h-10 w-10 rounded-lg" />
                            <Skeleton className="h-10 w-10 rounded-lg" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
