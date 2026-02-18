'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { supabase } from '@/lib/supabase';
import { ResumeFilters } from '@/components/resumes/resume-filters';
import { ResumeCard } from '@/components/resumes/resume-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Category, District, Region } from '@/types/database';
import { Search, Loader2, Filter as SlidersHorizontal, X } from '@/components/ui/icons';
import { toast } from 'sonner';
import { expandExperienceFilterValues } from '@/lib/experience-compat';

export default function ResumesPage() {
    const { lang } = useLanguage();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isAuthenticated, isLoading: authLoading } = useUserAuth();
    const { openModal } = useAuthModal();
    const isEmployer = Boolean(isAuthenticated && user?.active_role === 'employer');

    const [resumes, setResumes] = useState<any[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [regions, setRegions] = useState<Region[]>([]);
    const [districts, setDistricts] = useState<District[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
    const [showFilters, setShowFilters] = useState(false);

    const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'all');
    const [selectedRegion, setSelectedRegion] = useState(searchParams.get('region') || 'all');
    const [selectedDistrict, setSelectedDistrict] = useState(searchParams.get('district') || 'all');
    const [selectedExperience, setSelectedExperience] = useState(searchParams.get('experience') || 'all');
    const [selectedEducation, setSelectedEducation] = useState(searchParams.get('education') || 'all');
    const [selectedGender, setSelectedGender] = useState(searchParams.get('gender') || 'all');

    const initialSalary = searchParams.get('salary')
        ? searchParams.get('salary')!.split('-').map(Number) as [number, number]
        : [0, 20000000] as [number, number];
    const [salaryRange, setSalaryRange] = useState<[number, number]>(initialSalary);

    const fetchData = useCallback(async () => {
        if (authLoading) return;

        setLoading(true);

        let currentRegions = regions;
        let currentDistricts = districts;

        if (categories.length === 0) {
            const [cats, regs, dists] = await Promise.all([
                supabase.from('categories').select('*').neq('id', 'a0000011-0011-4000-8000-000000000011').order('name_uz'),
                supabase.from('regions').select('*').order('name_uz'),
                supabase.from('districts').select('*').order('name_uz'),
            ]);
            if (cats.data) setCategories(cats.data);
            if (regs.data) { setRegions(regs.data); currentRegions = regs.data; }
            if (dists.data) { setDistricts(dists.data); currentDistricts = dists.data; }
        }

        let query = supabase
            .from('resumes')
            .select('*')
            .eq('is_public', true)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(200);

        if (selectedCategory !== 'all') query = query.eq('category_id', selectedCategory);

        if (selectedDistrict !== 'all') {
            query = query.eq('district_id', selectedDistrict);
        } else if (selectedRegion !== 'all') {
            const { data: regionDistricts } = await supabase
                .from('districts')
                .select('id')
                .eq('region_id', selectedRegion);

            if (!regionDistricts || regionDistricts.length === 0) {
                setResumes([]);
                setErrorMessage(null);
                setLoading(false);
                return;
            }

            const districtIds = regionDistricts.map((d) => d.id);
            query = query.in('district_id', districtIds);
        }

        if (selectedExperience !== 'all') {
            const experienceValues = expandExperienceFilterValues(selectedExperience);
            query = experienceValues.length > 1
                ? query.in('experience', experienceValues)
                : query.eq('experience', selectedExperience);
        }
        if (selectedEducation !== 'all') query = query.eq('education_level', selectedEducation);
        if (selectedGender !== 'all') query = query.eq('gender', selectedGender);

        const { data, error } = await query;

        const enrichResumes = (resumeList: any[]) => resumeList.map((resume) => {
            if (!resume.district_id) return resume;
            const district = currentDistricts.find((d) => d.id === resume.district_id);
            const region = currentRegions.find((r) => r.id === district?.region_id);
            return { ...resume, districts: district ? { ...district, regions: region } : null };
        });

        if (error) {
            console.error('Error fetching resumes:', error);
            if (error.code === 'PGRST301' || error.message?.includes('permission')) {
                setErrorMessage(lang === 'uz'
                    ? "Ruxsat cheklangan (xavfsizlik siyosati). Admin bilan bog'laning."
                    : 'Доступ ограничен (политики безопасности). Свяжитесь с администратором.');
            } else {
                setErrorMessage(lang === 'uz'
                    ? "Ma'lumotlarni yuklashda xatolik yuz berdi"
                    : 'Ошибка при загрузке данных');
            }
            setResumes([]);
            setLoading(false);
            return;
        }

        setErrorMessage(null);
        let filtered = enrichResumes(data || []);

        if (salaryRange[0] > 0 || salaryRange[1] < 20000000) {
            const minLimit = salaryRange[0];
            const maxLimit = salaryRange[1];
            filtered = filtered.filter((r) => {
                const minSalary = r.expected_salary_min ?? 0;
                const maxSalary = r.expected_salary_max ?? 20000000;
                return maxSalary >= minLimit && minSalary <= maxLimit;
            });
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter((r) =>
                r.title?.toLowerCase().includes(q) ||
                r.desired_position?.toLowerCase().includes(q) ||
                r.field_title?.toLowerCase().includes(q) ||
                r.full_name?.toLowerCase().includes(q) ||
                r.about?.toLowerCase().includes(q) ||
                (Array.isArray(r.skills)
                    ? r.skills.some((s: string) => String(s).toLowerCase().includes(q))
                    : typeof r.skills === 'string'
                        ? r.skills.toLowerCase().includes(q)
                        : false)
            );
        }

        setResumes(filtered);
        setLoading(false);
    }, [authLoading, selectedCategory, selectedRegion, selectedDistrict, selectedExperience, selectedEducation, selectedGender, salaryRange, searchQuery, categories, districts, regions, lang]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const updateURL = useCallback(() => {
        const params = new URLSearchParams();
        if (searchQuery) params.set('q', searchQuery);
        if (selectedCategory !== 'all') params.set('category', selectedCategory);
        if (selectedRegion !== 'all') params.set('region', selectedRegion);
        if (selectedDistrict !== 'all') params.set('district', selectedDistrict);
        if (salaryRange[0] > 0 || salaryRange[1] < 20000000) params.set('salary', `${salaryRange[0]}-${salaryRange[1]}`);
        if (selectedExperience !== 'all') params.set('experience', selectedExperience);
        if (selectedEducation !== 'all') params.set('education', selectedEducation);
        if (selectedGender !== 'all') params.set('gender', selectedGender);

        const newURL = params.toString() ? `/resumes?${params.toString()}` : '/resumes';
        router.push(newURL, { scroll: false });
    }, [searchQuery, selectedCategory, selectedRegion, selectedDistrict, salaryRange, selectedExperience, selectedEducation, selectedGender, router]);

    useEffect(() => {
        const timeout = setTimeout(updateURL, 400);
        return () => clearTimeout(timeout);
    }, [updateURL]);

    const hasActiveFilters =
        selectedCategory !== 'all' ||
        selectedRegion !== 'all' ||
        selectedDistrict !== 'all' ||
        selectedExperience !== 'all' ||
        selectedEducation !== 'all' ||
        selectedGender !== 'all' ||
        salaryRange[0] > 0 ||
        salaryRange[1] < 20000000;

    const clearFilters = () => {
        setSelectedCategory('all');
        setSelectedRegion('all');
        setSelectedDistrict('all');
        setSalaryRange([0, 20000000]);
        setSelectedExperience('all');
        setSelectedEducation('all');
        setSelectedGender('all');
        setSearchQuery('');
    };

    const handleRequireEmployerLogin = () => {
        toast.info(lang === 'uz'
            ? 'Batafsil ko‘rish uchun ish beruvchi sifatida kiring.'
            : 'Чтобы открыть резюме, войдите как работодатель.');
        openModal();
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header — Midnight Luxury */}
            <div className="relative text-white py-10 overflow-hidden">
                {/* Animated mesh gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 animate-mesh" style={{ backgroundSize: '200% 200%' }} />
                {/* Floating orbs */}
                <div className="absolute top-0 right-[15%] w-[250px] h-[250px] bg-blue-500/15 rounded-full blur-[80px] animate-float-slow pointer-events-none" />
                <div className="absolute bottom-0 left-[10%] w-[200px] h-[200px] bg-teal-500/10 rounded-full blur-[60px] animate-float-medium pointer-events-none" />

                <div className="container mx-auto px-4 relative z-10">
                    <p className="text-xs font-medium text-blue-300/80 uppercase tracking-widest mb-2">
                        {lang === 'uz' ? 'Nomzodlar' : 'Кандидаты'}
                    </p>
                    <h1 className="text-3xl md:text-4xl font-bold mb-2 tracking-tight">{lang === 'uz' ? 'Rezyumelar' : 'Резюме'}</h1>
                    <div className="h-1 w-12 bg-gradient-to-r from-blue-500 to-teal-400 rounded-full mb-6" />

                    {/* Search + Filter Toggle — glassmorphism */}
                    <div className="flex gap-3 max-w-3xl">
                        <div className="relative flex-1 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                            <Input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={lang === 'uz' ? 'Kasb yoki ko\'nikma bo\'yicha qidirish...' : 'Поиск по профессии или навыкам...'}
                                className="pl-12 h-12 bg-white/5 backdrop-blur-sm border-white/10 text-white rounded-xl placeholder:text-slate-400 focus:border-blue-500/50 focus:ring-blue-500/20 focus:bg-white/10 transition-all"
                            />
                        </div>
                        <Button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`h-12 px-4 rounded-xl font-medium transition-all ${showFilters
                                ? 'bg-white text-slate-900 hover:bg-slate-100 shadow-lg'
                                : 'bg-white/5 backdrop-blur-sm text-slate-300 hover:bg-white/10 border border-white/10 hover:border-white/20'
                                }`}
                        >
                            {showFilters ? <X className="w-5 h-5" /> : <SlidersHorizontal className="w-5 h-5" />}
                            <span className="ml-2 hidden sm:inline">
                                {showFilters
                                    ? (lang === 'uz' ? 'Yopish' : 'Закрыть')
                                    : (lang === 'uz' ? 'Filtrlar' : 'Фильтры')
                                }
                            </span>
                            {hasActiveFilters && (
                                <span className="ml-1.5 w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Collapsible Filters */}
            {showFilters && (
                <div className="bg-white border-b border-slate-200 shadow-sm animate-slide-up">
                    <div className="container mx-auto px-4 py-5">
                        <ResumeFilters
                            categories={categories}
                            regions={regions}
                            selectedCategory={selectedCategory}
                            selectedRegion={selectedRegion}
                            selectedDistrict={selectedDistrict}
                            salaryRange={salaryRange}
                            selectedExperience={selectedExperience}
                            selectedEducation={selectedEducation}
                            selectedGender={selectedGender}
                            onCategoryChange={setSelectedCategory}
                            onRegionChange={(val) => {
                                setSelectedRegion(val);
                                setSelectedDistrict('all');
                            }}
                            onDistrictChange={setSelectedDistrict}
                            onSalaryRangeChange={setSalaryRange}
                            onExperienceChange={setSelectedExperience}
                            onEducationChange={setSelectedEducation}
                            onGenderChange={setSelectedGender}
                            onClear={clearFilters}
                        />
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="container mx-auto px-4 py-8">
                {authLoading || loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                ) : errorMessage ? (
                    <div className="text-center py-16 bg-red-50 rounded-xl shadow-sm border border-red-200">
                        <div className="w-14 h-14 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-red-700">
                            {lang === 'uz' ? 'Xatolik' : 'Ошибка'}
                        </h3>
                        <p className="text-red-600 mt-2 mb-6">{errorMessage}</p>
                        <Button variant="outline" onClick={clearFilters}>
                            {lang === 'uz' ? 'Qayta urinish' : 'Попробовать снова'}
                        </Button>
                    </div>
                ) : resumes.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-slate-200">
                        <div className="w-14 h-14 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                            <Search className="w-7 h-7 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900">
                            {lang === 'uz' ? 'Rezyumelar topilmadi' : 'Резюме не найдены'}
                        </h3>
                        <p className="text-slate-500 mt-2 mb-6">
                            {lang === 'uz' ? 'Boshqa filtrlar bilan urinib ko\'ring' : 'Попробуйте изменить параметры поиска'}
                        </p>
                        <Button variant="outline" onClick={clearFilters}>
                            {lang === 'uz' ? 'Filtrlarni tozalash' : 'Сбросить фильтры'}
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {resumes.map(resume => (
                            <ResumeCard
                                key={resume.id}
                                resume={resume}
                                canOpenDetails={isEmployer}
                                onRequireEmployerAccess={handleRequireEmployerLogin}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
