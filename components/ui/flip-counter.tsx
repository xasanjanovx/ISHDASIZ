'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface FlipCounterProps {
    value: number;
    className?: string;
    prefix?: string;
    suffix?: string;
}

const Digit = ({ digit }: { digit: string }) => {
    return (
        <div className="relative inline-block w-[0.6em] h-[1.1em] overflow-hidden align-top">
            <AnimatePresence mode="popLayout">
                <motion.span
                    key={digit}
                    initial={{ y: '100%' }}
                    animate={{ y: '0%' }}
                    exit={{ y: '-100%' }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className="absolute inset-x-0 flex justify-center text-center"
                >
                    {digit}
                </motion.span>
            </AnimatePresence>
        </div>
    );
};

export function FlipCounter({ value, className = '', prefix = '', suffix = '' }: FlipCounterProps) {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        // Simple count up effect
        const steps = 20;
        const duration = 1500; // 1.5s
        const intervalTime = duration / steps;
        const increment = value / steps;

        let current = 0;
        const timer = setInterval(() => {
            current += increment;
            if (current >= value) {
                current = value;
                clearInterval(timer);
            }
            setDisplayValue(Math.floor(current));
        }, intervalTime);

        return () => clearInterval(timer);
    }, [value]);

    const digits = displayValue.toString().split('');

    return (
        <div className={`inline-flex items-center justify-center ${className}`}>
            {prefix && <span>{prefix}</span>}
            {digits.map((d, i) => (
                <Digit key={i} digit={d} />
            ))}
            {suffix && <span>{suffix}</span>}
        </div>
    );
}
