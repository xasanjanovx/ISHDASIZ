'use client';

import { useState } from 'react';
import { useAuthModal, UserRole } from '@/contexts/auth-modal-context';
import { useLanguage } from '@/contexts/language-context';
import { Button } from '@/components/ui/button';
import { Briefcase, Search, ArrowRight, Sparkles } from '@/components/ui/icons';

export function RoleSelection() {
    const { setUserRole, setStep } = useAuthModal();
    const { lang } = useLanguage();
    const [selectedRole, setSelectedRole] = useState<UserRole>(null);

    const handleContinue = () => {
        if (selectedRole) {
            setUserRole(selectedRole);
            setStep('auth');
        }
    };

    const roles = [
        {
            id: 'seeker' as const,
            icon: Search,
            title: lang === 'ru' ? 'Ищу работу' : 'Ish qidiryapman',
            subtitle: lang === 'ru'
                ? 'Найдите работу мечты'
                : 'O\'z ishingizni toping',
            gradient: 'from-emerald-500 to-teal-600',
            bgLight: 'bg-emerald-50',
            borderActive: 'border-emerald-500',
            iconBg: 'bg-gradient-to-br from-emerald-400 to-teal-500',
        },
        {
            id: 'employer' as const,
            icon: Briefcase,
            title: lang === 'ru' ? 'Ищу сотрудников' : 'Xodim izlayapman',
            subtitle: lang === 'ru'
                ? 'Найдите лучших специалистов'
                : 'Eng yaxshi mutaxassislarni toping',
            gradient: 'from-violet-500 to-purple-600',
            bgLight: 'bg-violet-50',
            borderActive: 'border-violet-500',
            iconBg: 'bg-gradient-to-br from-violet-400 to-purple-500',
        },
    ];

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="text-center space-y-1">
                <h2 className="text-xl font-bold text-slate-900">
                    {lang === 'ru' ? 'Как вы хотите использовать платформу?' : 'Platformadan qanday foydalanmoqchisiz?'}
                </h2>
            </div>

            {/* Role Cards */}
            <div className="space-y-2.5">
                {roles.map((role) => {
                    const Icon = role.icon;
                    const isSelected = selectedRole === role.id;

                    return (
                        <button
                            key={role.id}
                            onClick={() => setSelectedRole(role.id)}
                            className={`
                group relative w-full p-3 rounded-xl border-2 transition-all duration-300 text-left
                ${isSelected
                                    ? `${role.borderActive} ${role.bgLight} shadow-md scale-[1.01]`
                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                                }
              `}
                        >
                            <div className="flex items-center gap-3">
                                {/* Icon */}
                                <div className={`
                  w-11 h-11 rounded-lg flex items-center justify-center text-white shadow-md
                  transition-transform duration-300 group-hover:scale-105
                  ${role.iconBg}
                `}>
                                    <Icon className="w-5 h-5" />
                                </div>

                                {/* Text */}
                                <div className="flex-1">
                                    <h3 className="font-semibold text-base text-slate-900">{role.title}</h3>
                                    <p className="text-xs text-slate-500">{role.subtitle}</p>
                                </div>

                                {/* Check indicator */}
                                <div className={`
                  w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300
                  ${isSelected
                                        ? `${role.borderActive} bg-gradient-to-br ${role.gradient}`
                                        : 'border-slate-300'
                                    }
                `}>
                                    {isSelected && (
                                        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                                            <path d="M3 6L5 8L9 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    )}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Continue Button */}
            <Button
                onClick={handleContinue}
                disabled={!selectedRole}
                className={`
          w-full h-12 rounded-xl font-semibold text-sm transition-all duration-300
          ${selectedRole
                        ? 'bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 shadow-lg shadow-sky-500/25'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }
        `}
            >
                <span>{lang === 'ru' ? 'Продолжить' : 'Davom etish'}</span>
                <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
        </div>
    );
}
