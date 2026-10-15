'use client';

import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, FileText, Briefcase, Building2, Plus, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { accountApi, AccountApiError } from '@/lib/account-api';
import * as Dialog from '@radix-ui/react-dialog';

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
    onSuccess?: () => void;
}

export function ApplicationModal(props: ApplicationModalProps) {
    const { user } = useUserAuth();
    return props.isOpen ? <ApplicationForm key={`${props.job.id}:${user?.id || 'guest'}`} onClose={props.onClose} onSuccess={props.onSuccess} job={props.job} user={user} /> : null;
}

function ApplicationForm({ onClose, onSuccess, job, user }: Omit<ApplicationModalProps, 'isOpen'> & { user: ReturnType<typeof useUserAuth>['user'] }) {
    const { lang } = useLanguage();
    const [resumes, setResumes] = useState<Resume[]>([]);
    const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
    const [phone, setPhone] = useState(user?.phone || '');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingResumes, setIsLoadingResumes] = useState(!!user?.id);
    const [resumeError, setResumeError] = useState(!user?.id);
    const [attempt, setAttempt] = useState(0);
    const submitting = useRef(false);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);
    useEffect(() => {
        if (!user?.id) return;
        let cancelled = false;
        accountApi<{ resumes: Resume[] }>('/api/account/applications/resumes').then(result => {
            if (!cancelled) { setResumes(result.resumes); setResumeError(false); }
        }).catch(() => { if (!cancelled) setResumeError(true); })
          .finally(() => { if (!cancelled) setIsLoadingResumes(false); });
        return () => { cancelled = true; };
    }, [user?.id, attempt]);

    const handleSubmit = async () => {
        if (submitting.current) return;
        if (!user?.id || !selectedResumeId || !resumes.some(resume => resume.id === selectedResumeId)) {
            toast.error(lang === 'ru' ? 'Войдите и выберите своё резюме' : 'Kiring va rezyumeni tanlang');
            return;
        }
        const digits = phone.replace(/[\s()+-]/g, '');
        const normalizedPhone = /^\d{9}$/.test(digits) ? `+998${digits}` : /^998\d{9}$/.test(digits) ? `+${digits}` : null;
        if (!normalizedPhone) {
            toast.error(lang === 'ru' ? 'Введите номер Узбекистана: +998 и 9 цифр' : '+998 va 9 raqamdan iborat telefon kiriting');
            return;
        }
        if (message.trim().length > 4000) {
            toast.error(lang === 'ru' ? 'Сообщение должно быть не длиннее 4000 символов' : 'Xabar 4000 belgidan oshmasin');
            return;
        }
        submitting.current = true;
        setIsLoading(true);
        try {
            await accountApi('/api/account/applications', { method: 'POST', body: JSON.stringify({ job_id: job.id, resume_id: selectedResumeId, phone: normalizedPhone, message: message.trim() }) });
            if (!mounted.current) return;
            toast.success(lang === 'ru' ? 'Заявка отправлена!' : 'Ariza yuborildi!');
            window.dispatchEvent(new Event('applicationsRead'));
            onSuccess?.();
            onClose();
        } catch (error) {
            if (!mounted.current) return;
            const status = error instanceof AccountApiError ? error.status : 0;
            toast.error(status === 409
                ? (lang === 'ru' ? 'Отклик уже отправлен или это ваша вакансия' : 'Ariza allaqachon yuborilgan yoki bu o‘z vakansiyangiz')
                : status === 401 || status === 403
                ? (lang === 'ru' ? 'Войдите в профиль соискателя' : 'Ish qidiruvchi profiliga kiring')
                : status === 404
                ? (lang === 'ru' ? 'Вакансия или резюме уже недоступны' : 'Vakansiya yoki rezyume endi mavjud emas')
                : (lang === 'ru' ? 'Не удалось отправить. Попробуйте ещё раз.' : 'Yuborib bo‘lmadi. Qayta urinib ko‘ring.'));
        } finally {
            submitting.current = false;
            if (mounted.current) setIsLoading(false);
        }
    };

    return (
        <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 bg-card rounded-2xl max-w-lg w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto">
                <Dialog.Description className="sr-only">{job.title}</Dialog.Description>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <Dialog.Title className="text-xl font-bold text-foreground">
                        {lang === 'ru' ? 'Заявка на вакансию' : 'Vakansiyaga ariza'}
                    </Dialog.Title>
                    <button aria-label={lang === 'ru' ? 'Закрыть' : 'Yopish'} onClick={onClose} className="p-2 hover:bg-secondary rounded-lg transition-colors">
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                {/* Job Info */}
                <div className="p-6 bg-background border-b border-border">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
                            <Briefcase className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">{job.title}</h3>
                            {job.company_name && (
                                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
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
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : resumeError ? (
                            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
                                {user ? (lang === 'ru' ? 'Не удалось загрузить резюме.' : 'Rezyumeni yuklab bo‘lmadi.') : (lang === 'ru' ? 'Войдите в профиль соискателя.' : 'Ish qidiruvchi profiliga kiring.')}
                                {user && <Button variant="outline" className="mt-3" onClick={() => { setIsLoadingResumes(true); setAttempt(value => value + 1); }}>{lang === 'ru' ? 'Повторить' : 'Qayta urinish'}</Button>}
                            </div>
                        ) : resumes.length === 0 ? (
                            <div className="text-center py-8 bg-background rounded-xl border-2 border-dashed border-border">
                                <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                                <p className="text-muted-foreground font-medium mb-1">
                                    {lang === 'ru' ? 'У вас нет резюме' : "Sizda hali rezyume yo'q"}
                                </p>
                                <p className="text-sm text-muted-foreground mb-4">
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
                                        className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${selectedResumeId === resume.id
                                            ? 'border-primary bg-accent'
                                            : 'border-border hover:border-border'
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
                                            ? 'border-primary bg-primary'
                                            : 'border-border'
                                            }`}>
                                            {selectedResumeId === resume.id && (
                                                <div className="w-2 h-2 rounded-full bg-card" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium text-foreground">{resume.title}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {typeof resume.experience_years==='number' && Number.isFinite(resume.experience_years) ? `💼 ${resume.experience_years} ${lang === 'ru' ? 'лет опыта' : 'yil tajriba'}` : (lang==='ru'?'Опыт не указан':'Tajriba ko‘rsatilmagan')}
                                                {resume.updated_at && Number.isFinite(Date.parse(resume.updated_at)) && <>{lang === 'ru' ? ' • Обновлено: ' : ' • Yangilangan: '}{new Date(resume.updated_at).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-UZ')}</>}
                                            </p>
                                        </div>
                                    </label>
                                ))}

                                <Link href="/profile/job-seeker/resumes/new" className="block">
                                    <button className="w-full p-3 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-border hover:text-muted-foreground transition-colors flex items-center justify-center gap-2">
                                        <Plus className="w-4 h-4" />
                                        {lang === 'ru' ? 'Создать новое резюме' : 'Yangi rezyume yaratish'}
                                    </button>
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Phone */}
                    <div className="space-y-2">
                        <Label htmlFor="application-phone">
                            {lang === 'ru' ? 'Ваш номер телефона' : 'Telefon raqamingiz'} *
                        </Label>
                        <Input id="application-phone" type="tel" autoComplete="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+998 90 123 45 67"
                        />
                    </div>

                    {/* Message */}
                    <div className="space-y-2">
                        <Label htmlFor="application-message">
                            {lang === 'ru' ? 'Сопроводительное письмо' : "Qo'shimcha xabar"}
                        </Label>
                        <Textarea id="application-message" maxLength={4000}
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
                <div className="p-6 border-t border-border flex gap-3">
                    <Button variant="outline" onClick={onClose} className="flex-1">
                        {lang === 'ru' ? 'Отмена' : 'Bekor qilish'}
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading || isLoadingResumes || resumeError || !selectedResumeId}
                        className="flex-1 bg-primary hover:bg-primary gap-2"
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
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
    );
}
