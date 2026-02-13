'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { ProfileLayout } from '@/components/profile/profile-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Search, Loader2, User, Banknote, Briefcase, Phone, Filter, X
} from '@/components/ui/icons';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { formatSalary, EXPERIENCE_OPTIONS, EDUCATION_OPTIONS, GENDER_OPTIONS } from '@/lib/constants';
import { Category, District } from '@/types/database';

interface PublicResume {
    id: string;
    title: string;
    full_name: string | null;
    about: string | null;
    skills: string[] | null;
    expected_salary_min: number | null;
    expected_salary_max: number | null;
    experience_years: number | null;
    experience: string | null;
    education_level: string | null;
    gender: string | null;
    phone: string | null;
    created_at: string;
    district_id: string | null;
}

export default function SearchResumesPage() {
    const { lang } = useLanguage();
    const { user } = useUserAuth();
    const [resumes, setResumes] = useState<PublicResume[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filter states (matching public /resumes page)
    const [searchTerm, setSearchTerm] = useState('');
    const [categories, setCategories] = useState<Category[]>([]);
    const [districts, setDistricts] = useState<District[]>([]);

    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedDistrict, setSelectedDistrict] = useState('all');
    const [selectedExperience, setSelectedExperience] = useState('all');
    const [selectedEducation, setSelectedEducation] = useState('all');
    const [selectedGender, setSelectedGender] = useState('all');
    const [salaryMin, setSalaryMin] = useState('');
    const [salaryMax, setSalaryMax] = useState('');

    useEffect(() => {
        const loadInitialData = async () => {
            const [cats, dists] = await Promise.all([
                supabase.from('categories').select('*').neq('id', 'a0000011-0011-4000-8000-000000000011').order('name_uz'),
                supabase.from('districts').select('*').order('name_uz'),
            ]);
            if (cats.data) setCategories(cats.data);
            if (dists.data) setDistricts(dists.data);

            fetchResumes();
        };
        loadInitialData();
    }, []);

    const fetchResumes = async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from('resumes')
                .select('id, title, full_name, about, skills, expected_salary_min, expected_salary_max, experience_years, experience, education_level, gender, phone, created_at, district_id')
                .eq('is_public', true)
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            // Apply filters
            if (selectedDistrict !== 'all') {
                query = query.eq('district_id', selectedDistrict);
            }
            if (selectedExperience !== 'all') {
                query = query.eq('experience', selectedExperience);
            }
            if (selectedEducation !== 'all') {
                query = query.eq('education_level', selectedEducation);
            }
            if (selectedGender !== 'all') {
                query = query.eq('gender', selectedGender);
            }
            if (salaryMin) {
                query = query.gte('expected_salary_min', parseInt(salaryMin));
            }
            if (salaryMax) {
                query = query.lte('expected_salary_max', parseInt(salaryMax));
            }

            const { data, error } = await query.limit(100);

            if (error) throw error;

            // Client-side text search
            let filtered = data || [];
            if (searchTerm) {
                const q = searchTerm.toLowerCase();
                filtered = filtered.filter(r =>
                    r.title?.toLowerCase().includes(q) ||
                    r.full_name?.toLowerCase().includes(q) ||
                    r.about?.toLowerCase().includes(q) ||
                    r.skills?.some((s: string) => s.toLowerCase().includes(q))
                );
            }

            setResumes(filtered);
        } catch (err) {
            console.error('Error fetching resumes:', err);
        }
        setIsLoading(false);
    };

    // Re-fetch when filters change
    useEffect(() => {
        fetchResumes();
    }, [selectedDistrict, selectedExperience, selectedEducation, selectedGender, salaryMin, salaryMax]);

    const clearFilters = () => {
        setSearchTerm('');
        setSelectedCategory('all');
        setSelectedDistrict('all');
        setSelectedExperience('all');
        setSelectedEducation('all');
        setSelectedGender('all');
        setSalaryMin('');
        setSalaryMax('');
    };

    const hasActiveFilters =
        selectedDistrict !== 'all' ||
        selectedExperience !== 'all' ||
        selectedEducation !== 'all' ||
        selectedGender !== 'all' ||
        salaryMin !== '' ||
        salaryMax !== '' ||
        searchTerm !== '';

    return (
        <ProfileLayout userType="employer" userName="Kompaniya">
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        {lang === 'ru' ? 'Поиск резюме' : 'Rezyume qidirish'}
                    </h1>
                    <p className="text-slate-500 mt-1">
                        {lang === 'ru' ? 'Найдите подходящих кандидатов' : 'Mos nomzodlarni toping'}
                    </p>
                </div>

                {/* Filters Card */}
                <Card>
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Filter className="w-5 h-5 text-violet-600" />
                                {lang === 'ru' ? 'Фильтры' : 'Filtrlar'}
                            </CardTitle>
                            {hasActiveFilters && (
                                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-500">
                                    <X className="w-4 h-4 mr-1" />
                                    {lang === 'ru' ? 'Сбросить' : 'Tozalash'}
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Search Input */}
                        <div className="flex gap-2">
                            <Input
                                placeholder={lang === 'ru' ? 'Поиск по ключевым словам...' : 'Kalit so\'zlar bo\'yicha qidirish...'}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && fetchResumes()}
                                className="flex-1"
                            />
                            <Button onClick={fetchResumes} className="gap-2">
                                <Search className="w-4 h-4" />
                                {lang === 'ru' ? 'Найти' : 'Qidirish'}
                            </Button>
                        </div>

                        {/* Filter Row */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                            {/* District */}
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-500">{lang === 'ru' ? 'Район' : 'Tuman'}</Label>
                                <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder={lang === 'ru' ? 'Все' : 'Barchasi'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">{lang === 'ru' ? 'Все' : 'Barchasi'}</SelectItem>
                                        {districts.map((dist) => (
                                            <SelectItem key={dist.id} value={dist.id}>
                                                {lang === 'uz' ? dist.name_uz : dist.name_ru}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Experience */}
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-500">{lang === 'ru' ? 'Опыт' : 'Tajriba'}</Label>
                                <Select value={selectedExperience} onValueChange={setSelectedExperience}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">{lang === 'ru' ? 'Любой' : 'Barchasi'}</SelectItem>
                                        {EXPERIENCE_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {lang === 'uz' ? opt.label_uz : opt.label_ru}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Education */}
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-500">{lang === 'ru' ? 'Образование' : 'Ta\'lim'}</Label>
                                <Select value={selectedEducation} onValueChange={setSelectedEducation}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">{lang === 'ru' ? 'Любое' : 'Barchasi'}</SelectItem>
                                        {EDUCATION_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {lang === 'uz' ? opt.label_uz : opt.label_ru}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Gender */}
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-500">{lang === 'ru' ? 'Пол' : 'Jins'}</Label>
                                <Select value={selectedGender} onValueChange={setSelectedGender}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">{lang === 'ru' ? 'Любой' : 'Barchasi'}</SelectItem>
                                        {GENDER_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {lang === 'uz' ? opt.label_uz : opt.label_ru}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Salary Min */}
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-500">{lang === 'ru' ? 'Зарплата от' : 'Maosh (dan)'}</Label>
                                <Input
                                    type="number"
                                    placeholder="0"
                                    value={salaryMin}
                                    onChange={(e) => setSalaryMin(e.target.value)}
                                    className="h-9"
                                />
                            </div>

                            {/* Salary Max */}
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-500">{lang === 'ru' ? 'Зарплата до' : 'Maosh (gacha)'}</Label>
                                <Input
                                    type="number"
                                    placeholder="∞"
                                    value={salaryMax}
                                    onChange={(e) => setSalaryMax(e.target.value)}
                                    className="h-9"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Results */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                    </div>
                ) : resumes.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                                <User className="w-8 h-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">
                                {lang === 'ru' ? 'Резюме не найдены' : 'Rezyumelar topilmadi'}
                            </h3>
                            <p className="text-slate-500">
                                {lang === 'ru' ? 'Попробуйте изменить параметры поиска' : 'Qidiruv parametrlarini o\'zgartirib ko\'ring'}
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-500">
                            {lang === 'ru' ? `Найдено: ${resumes.length}` : `Topildi: ${resumes.length}`}
                        </p>
                        {resumes.map((resume) => (
                            <Link href={`/resumes/${resume.id}`} key={resume.id}>
                                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                                    <CardContent className="p-5">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-lg text-slate-900">
                                                    {resume.title}
                                                </h3>
                                                <p className="text-slate-600 mt-1">
                                                    {resume.full_name || (lang === 'ru' ? 'Имя не указано' : 'Ism ko\'rsatilmagan')}
                                                </p>

                                                <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
                                                    {(resume.expected_salary_min || resume.expected_salary_max) ? (
                                                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                                            <Banknote className="w-4 h-4" />
                                                            {formatSalary(resume.expected_salary_min, resume.expected_salary_max, lang)}
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-slate-500">
                                                            <Banknote className="w-4 h-4" />
                                                            {lang === 'ru' ? 'Договорная' : 'Kelishiladi'}
                                                        </span>
                                                    )}
                                                    {resume.experience_years != null && (
                                                        <span className="flex items-center gap-1 text-slate-500">
                                                            <Briefcase className="w-4 h-4" />
                                                            {resume.experience_years} {lang === 'ru' ? 'лет опыта' : 'yil tajriba'}
                                                        </span>
                                                    )}
                                                </div>

                                                {resume.about && (
                                                    <p className="text-sm text-slate-500 mt-3 line-clamp-2">
                                                        {resume.about}
                                                    </p>
                                                )}

                                                {resume.skills && resume.skills.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-3">
                                                        {resume.skills.slice(0, 5).map((skill, i) => (
                                                            <Badge key={i} variant="secondary" className="text-xs">
                                                                {skill}
                                                            </Badge>
                                                        ))}
                                                        {resume.skills.length > 5 && (
                                                            <Badge variant="outline" className="text-xs">
                                                                +{resume.skills.length - 5}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex flex-col items-end gap-2">
                                                {resume.phone && (
                                                    <a
                                                        href={`tel:${resume.phone}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="flex items-center gap-2 px-4 py-2 bg-violet-50 text-violet-700 rounded-lg hover:bg-violet-100 transition-colors text-sm font-medium"
                                                    >
                                                        <Phone className="w-4 h-4" />
                                                        {lang === 'ru' ? 'Позвонить' : 'Qo\'ng\'iroq'}
                                                    </a>
                                                )}
                                                <span className="text-xs text-slate-400">
                                                    {new Date(resume.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </ProfileLayout>
    );
}
