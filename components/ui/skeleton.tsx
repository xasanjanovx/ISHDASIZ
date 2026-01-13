'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'circular' | 'text';
}

function Skeleton({ className, variant = 'default', ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-slate-200 rounded-md',
        // Shimmer animation
        'before:absolute before:inset-0 before:-translate-x-full',
        'before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent',
        'before:animate-[shimmer_1.5s_infinite]',
        variant === 'circular' && 'rounded-full',
        variant === 'text' && 'h-4 rounded',
        className
      )}
      {...props}
    />
  );
}

// Add shimmer keyframes to tailwind.config or use inline style
// @keyframes shimmer { 100% { transform: translateX(100%); } }

export { Skeleton };
