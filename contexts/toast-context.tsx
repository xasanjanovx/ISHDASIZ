'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    type: ToastType;
    message: string;
    isExiting?: boolean;
}

interface ToastContextType {
    showToast: (type: ToastType, message: string) => void;
    hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TOAST_DURATION = 4000; // 4 seconds

const toastStyles: Record<ToastType, { bg: string; icon: React.ReactNode; border: string }> = {
    success: {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
    },
    error: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        icon: <XCircle className="w-5 h-5 text-red-500" />,
    },
    warning: {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    },
    info: {
        bg: 'bg-sky-50',
        border: 'border-sky-200',
        icon: <Info className="w-5 h-5 text-sky-500" />,
    },
};

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
    const style = toastStyles[toast.type];

    return (
        <div
            className={`
                flex items-center gap-3 p-4 rounded-lg border shadow-lg
                ${style.bg} ${style.border}
                ${toast.isExiting ? 'animate-slide-out-right' : 'animate-slide-in-right'}
            `}
        >
            {style.icon}
            <p className="flex-1 text-sm font-medium text-slate-700">{toast.message}</p>
            <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-white/50 transition-colors"
            >
                <X className="w-4 h-4 text-slate-400" />
            </button>
        </div>
    );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((type: ToastType, message: string) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setToasts((prev) => [...prev, { id, type, message }]);

        // Auto-hide after duration
        setTimeout(() => {
            hideToast(id);
        }, TOAST_DURATION);
    }, []);

    const hideToast = useCallback((id: string) => {
        // Start exit animation
        setToasts((prev) =>
            prev.map((t) => (t.id === id ? { ...t, isExiting: true } : t))
        );

        // Remove after animation
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 300);
    }, []);

    return (
        <ToastContext.Provider value={{ showToast, hideToast }}>
            {children}

            {/* Toast Container */}
            <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
                {toasts.map((toast) => (
                    <div key={toast.id} className="pointer-events-auto">
                        <ToastItem toast={toast} onClose={() => hideToast(toast.id)} />
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
}
