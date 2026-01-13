'use client';

import { useAuthModal } from '@/contexts/auth-modal-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { useLanguage } from '@/contexts/language-context';
import { Button } from '@/components/ui/button';
import { User, Building2 } from '@/components/ui/icons';

export function RoleSelectLogin() {
    const { closeModal, phoneNumber, pendingUserId } = useAuthModal();
    const { login } = useUserAuth();
    const { lang } = useLanguage();

    const handleSelectRole = (role: 'job_seeker' | 'employer') => {
        // Login with selected role
        login({
            id: pendingUserId || '',
            phone: `+998${phoneNumber.replace(/\D/g, '')}`,
            active_role: role,
            has_job_seeker_profile: true,
            has_employer_profile: true,
        });
        closeModal();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
                <h2 className="text-xl font-bold text-slate-900">
                    {lang === 'ru' ? 'Выберите режим входа' : 'Qaysi sifatda kirasiz?'}
                </h2>
                <p className="text-slate-500 text-sm">
                    {lang === 'ru'
                        ? 'У вас есть оба профиля. Выберите, как войти:'
                        : "Sizda ikkala profil mavjud. Qaysi biri sifatida kirishni tanlang:"}
                </p>
            </div>

            {/* Role Selection Buttons */}
            <div className="grid grid-cols-2 gap-4">
                {/* Job Seeker */}
                <button
                    onClick={() => handleSelectRole('job_seeker')}
                    className="group flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all duration-300"
                >
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25 group-hover:scale-110 transition-transform duration-300">
                        <User className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-center">
                        <p className="font-semibold text-slate-900">
                            {lang === 'ru' ? 'Соискатель' : 'Ish qidiruvchi'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                            {lang === 'ru' ? 'Искать работу' : 'Ish izlash'}
                        </p>
                    </div>
                </button>

                {/* Employer */}
                <button
                    onClick={() => handleSelectRole('employer')}
                    className="group flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-slate-200 hover:border-violet-400 hover:bg-violet-50/50 transition-all duration-300"
                >
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25 group-hover:scale-110 transition-transform duration-300">
                        <Building2 className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-center">
                        <p className="font-semibold text-slate-900">
                            {lang === 'ru' ? 'Работодатель' : 'Ish beruvchi'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                            {lang === 'ru' ? 'Нанять работника' : 'Xodim izlash'}
                        </p>
                    </div>
                </button>
            </div>
        </div>
    );
}
