'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { ProfileLayout } from '@/components/profile/profile-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Users } from '@/components/ui/icons';

// TODO: Fetch from Supabase
interface Candidate {
    id: string;
    full_name: string;
    vacancy_title: string;
    status: string;
}

export default function CandidatesPage() {
    const { lang } = useLanguage();
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // TODO: Fetch candidates from Supabase
        // const { data } = await supabase.from('applications').select('*').eq('employer_id', userId);
        setIsLoading(false);
    }, []);

    if (isLoading) {
        return (
            <ProfileLayout userType="employer" userName="Kompaniya">
                <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                </div>
            </ProfileLayout>
        );
    }

    return (
        <ProfileLayout userType="employer" userName="Kompaniya">
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        {lang === 'ru' ? 'Кандидаты' : 'Nomzodlar'}
                    </h1>
                    <p className="text-slate-500 mt-1">
                        {lang === 'ru' ? 'Отклики на ваши вакансии' : 'Vakansiyalaringizga arizalar'}
                    </p>
                </div>

                {/* Empty state or list */}
                {candidates.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                                <Users className="w-8 h-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">
                                {lang === 'ru' ? 'Нет кандидатов' : 'Nomzodlar yo\'q'}
                            </h3>
                            <p className="text-slate-500 max-w-sm mx-auto">
                                {lang === 'ru'
                                    ? 'Здесь будут отображаться отклики на ваши вакансии'
                                    : 'Bu yerda vakansiyalaringizga arizalar ko\'rsatiladi'}
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {candidates.map((candidate) => (
                            <Card key={candidate.id} className="hover:shadow-md transition-shadow">
                                <CardContent className="p-5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-semibold text-slate-900">{candidate.full_name}</h3>
                                            <p className="text-sm text-slate-500">{candidate.vacancy_title}</p>
                                        </div>
                                        <span className="text-sm text-slate-400">{candidate.status}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </ProfileLayout>
    );
}
