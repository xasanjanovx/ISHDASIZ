'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, FileText, Briefcase, Building2, Plus, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface Resume {
    id: string;
    title: string;
    experience_years: number;
    updated_at: string;
}

interface Job {
    id: string;
    title: string;
    company_name?: string;
}

interface ApplicationModalProps {
    isOpen: boolean;
    onClose: () => void;
    job: Job;
}

export function ApplicationModal({ isOpen, onClose, job }: ApplicationModalProps) {
    const { lang } = useLanguage();
    const { user } = useUserAuth();
    const [resumes, setResumes] = useState<Resume[]>([]);
    const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
    const [phone, setPhone] = useState(user?.phone || '');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingResumes, setIsLoadingResumes] = useState(true);

    const loadResumes = useCallback(async () => {
        setIsLoadingResumes(true);
        try {
            if (!user?.id) {
                setResumes([]);
                setIsLoadingResumes(false);
                return;
            }

            const { data, error } = await supabase
                .from('resumes')
                .select('id, title, experience_years, updated_at')
                .eq('user_id', user.id)
                .eq('status', 'active')
                .order('updated_at', { ascending: false });

            if (error) {
                console.error('Error loading resumes:', error);
                setResumes([]);
            } else {
                setResumes(data || []);
            }
        } catch (error) {
            console.error('Failed to load resumes:', error);
            setResumes([]);
        }
        setIsLoadingResumes(false);
    }, [user?.id]);

    // Load user's resumes
    useEffect(() => {
        if (isOpen && user) {
            loadResumes();
        }
    }, [isOpen, user, loadResumes]);

    const handleSubmit = async () => {
        if (!selectedResumeId) {
            toast.error(lang === 'ru' ? 'Выберите резюме' : 'Rezyumeni tanlang');
            return;
        }
        if (!phone.trim()) {
            toast.error(lang === 'ru' ? 'Введите номер телефона' : 'Telefon raqamini kiriting');
            return;
        }

        setIsLoading(true);

        try {
            // Get user's full name from selected resume or profile
            const selectedResume = resumes.find(r => r.id === selectedResumeId);

            // Fetch full_name from the resume
            const { data: resumeData } = await supabase
                .from('resumes')
                .select('full_name')
                .eq('id', selectedResumeId)
                .single();

            const fullName = resumeData?.full_name || user?.phone || 'Ism kiritilmagan';

            const { error } = await supabase
                .from('job_applications')
                .insert({
                    job_id: job.id,
                    full_name: fullName,
                    phone: phone.trim(),
                    message: message.trim() || null,
                    resume_id: selectedResumeId,
                    status: 'pending'
                });

            if (error) {
                console.error('Error submitting application:', error);
                toast.error(lang === 'ru' ? 'Ошибка отправки' : 'Yuborishda xatolik');
            } else {
                toast.success(lang === 'ru' ? 'Заявка отправлена!' : 'Ariza yuborildi!');
                onClose();
            }
        } catch (error) {
            console.error('Error submitting application:', error);
            toast.error(lang === 'ru' ? 'Ошибка отправки' : 'Yuborishda xatolik');
        }

        setIsLoading(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-slide-in-right"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <h2 className="text-xl font-bold text-slate-900">
                        {lang === 'ru' ? 'Заявка на вакансию' : 'Vakansiyaga ariza'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Job Info */}
                <div className="p-6 bg-slate-50 border-b border-slate-100">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center flex-shrink-0">
                            <Briefcase className="w-5 h-5 text-sky-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900">{job.title}</h3>
                            {job.company_name && (
                                <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                                    <Building2 className="w-3.5 h-3.5" />
                                    {job.company_name}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Resume Selection */}
                    <div className="space-y-3">
                        <Label className="text-base">
                            {lang === 'ru' ? 'Выберите резюме' : 'Rezyumeni tanlang'} *
                        </Label>

                        {isLoadingResumes ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                            </div>
                        ) : resumes.length === 0 ? (
                            <div className="text-center py-8 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-600 font-medium mb-1">
                                    {lang === 'ru' ? 'У вас нет резюме' : "Sizda hali rezyume yo'q"}
                                </p>
                                <p className="text-sm text-slate-400 mb-4">
                                    {lang === 'ru'
                                        ? 'Создайте резюме для отправки заявки'
                                        : 'Ariza yuborish uchun rezyume yarating'}
                                </p>
                                <Link href="/profile/job-seeker/resumes/new">
                                    <Button variant="outline" className="gap-2">
                                        <Plus className="w-4 h-4" />
                                        {lang === 'ru' ? 'Создать резюме' : 'Rezyume yaratish'}
                                    </Button>
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {resumes.map((resume) => (
                                    <label
                                        key={resume.id}
                                        className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${selectedResumeId === resume.id
                                            ? 'border-sky-500 bg-sky-50'
                                            : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="resume"
                                            value={resume.id}
                                            checked={selectedResumeId === resume.id}
                                            onChange={() => setSelectedResumeId(resume.id)}
                                            className="sr-only"
                                        />
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedResumeId === resume.id
                                            ? 'border-sky-500 bg-sky-500'
                                            : 'border-slate-300'
                                            }`}>
                                            {selectedResumeId === resume.id && (
                                                <div className="w-2 h-2 rounded-full bg-white" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium text-slate-900">{resume.title}</p>
                                            <p className="text-sm text-slate-500">
                                                💼 {resume.experience_years} {lang === 'ru' ? 'лет опыта' : 'yil tajriba'} •
                                                {lang === 'ru' ? ' Обновлено: ' : ' Yangilangan: '}
                                                {new Date(resume.updated_at).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-UZ')}
                                            </p>
                                        </div>
                                    </label>
                                ))}

                                <Link href="/profile/job-seeker/resumes/new" className="block">
                                    <button className="w-full p-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 hover:border-slate-300 hover:text-slate-600 transition-colors flex items-center justify-center gap-2">
                                        <Plus className="w-4 h-4" />
                                        {lang === 'ru' ? 'Создать новое резюме' : 'Yangi rezyume yaratish'}
                                    </button>
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Phone */}
                    <div className="space-y-2">
                        <Label>
                            {lang === 'ru' ? 'Ваш номер телефона' : 'Telefon raqamingiz'} *
                        </Label>
                        <Input
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+998 90 123 45 67"
                        />
                    </div>

                    {/* Message */}
                    <div className="space-y-2">
                        <Label>
                            {lang === 'ru' ? 'Сопроводительное письмо' : "Qo'shimcha xabar"}
                        </Label>
                        <Textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder={lang === 'ru'
                                ? 'Расскажите почему вы подходите на эту позицию...'
                                : 'Nega siz bu lavozimga mos kelishingizni ayting...'}
                            rows={4}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 flex gap-3">
                    <Button variant="outline" onClick={onClose} className="flex-1">
                        {lang === 'ru' ? 'Отмена' : 'Bekor qilish'}
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading || resumes.length === 0}
                        className="flex-1 bg-sky-500 hover:bg-sky-600 gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {lang === 'ru' ? 'Отправка...' : 'Yuborilmoqda...'}
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4" />
                                {lang === 'ru' ? 'Отправить заявку' : 'Ariza yuborish'}
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
