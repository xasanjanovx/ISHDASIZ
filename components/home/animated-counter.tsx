'use client';

import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils'; // Assuming you have cn utility, otherwise omit or import clsx

interface AnimatedCounterProps {
  end: number;
  duration?: number;
  label?: string;
  icon?: React.ReactNode;
  className?: string; // For container or number text
}

export function AnimatedCounter({ end, duration = 2000, label, icon, className }: AnimatedCounterProps) {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const counterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentRef = counterRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let startTime: number | null = null;
    const startValue = 0;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);

      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const current = Math.floor(easeOutQuart * (end - startValue) + startValue);

      setCount(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [isVisible, end, duration]);

  // If label is present, use the structured layout
  if (label) {
    return (
      <div
        ref={counterRef}
        className={cn("flex items-center gap-3 justify-center", className)}
      >
        {icon && <div className="text-cyan-400/80">{icon}</div>}
        <div className="flex flex-col">
          <div className="text-2xl md:text-3xl font-bold text-white">
            {count.toLocaleString()}
          </div>
          <div className="text-xs md:text-sm text-white/60 font-normal">{label}</div>
        </div>
      </div>
    );
  }

  // Otherwise just render the number wrapped in a span for the ref
  return (
    <span ref={counterRef} className={className}>
      {count.toLocaleString()}
    </span>
  );
}
