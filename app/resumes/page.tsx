'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { supabase } from '@/lib/supabase';
import { ResumeFilters } from '@/components/resumes/resume-filters';
import { ResumeCard } from '@/components/resumes/resume-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Category, District, Region } from '@/types/database';
import { Search, Loader2 } from '@/components/ui/icons';

export default function ResumesPage() {
    const { lang, t } = useLanguage();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [resumes, setResumes] = useState<any[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [regions, setRegions] = useState<Region[]>([]);
    const [districts, setDistricts] = useState<District[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null); // Для отображения ошибок RLS
    const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');

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
        setLoading(true);

        // Fetch options only once if empty
        let currentCategories = categories;
        let currentRegions = regions;
        let currentDistricts = districts;

        if (categories.length === 0) {
            const [cats, regs, dists] = await Promise.all([
                supabase.from('categories').select('*').order('name_uz'),
                supabase.from('regions').select('*').order('name_uz'),
                supabase.from('districts').select('*').order('name_uz'),
            ]);
            if (cats.data) {
                setCategories(cats.data);
                currentCategories = cats.data;
            }
            if (regs.data) {
                setRegions(regs.data);
                currentRegions = regs.data;
            }
            if (dists.data) {
                setDistricts(dists.data);
                currentDistricts = dists.data;
            }
        }

        // Build Query - simplified select, enrichResumes handles districts/regions join
        // REMOVED is_public and status filters to show all resumes (user request)
        let query = supabase
            .from('resumes')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        // Category filter
        if (selectedCategory !== 'all') query = query.eq('category_id', selectedCategory);

        if (selectedDistrict !== 'all') {
            // Filter directly by district_id
            query = query.eq('district_id', selectedDistrict);
        } else if (selectedRegion !== 'all') {
            // If only region is selected, we need to get all districts in that region first
            // Then filter resumes by those district IDs
            const { data: regionDistricts } = await supabase
                .from('districts')
                .select('id')
                .eq('region_id', selectedRegion);

            if (regionDistricts && regionDistricts.length > 0) {
                const districtIds = regionDistricts.map(d => d.id);
                query = query.in('district_id', districtIds);
            }
        }

        if (selectedExperience !== 'all') {
            // Experience options: 'no_experience', '1_year', etc.
            // Resume table likely stores 'experience_years' (number) or string code?
            // search-resumes page used logic: exp=0, 1..3, 3..6.
            // Let's match typical resume schema. 'experience_years' is a number usually.
            // And 'experience' field might be a code string.
            // Let's guess schema uses 'experience' string code like jobs, OR 'experience_years'.
            // search-resumes.tsx uses 'experience_years'.
            // creation form uses 'experience' string code?
            // Let's filter by 'experience' column if it exists, matching codes.
            query = query.eq('experience', selectedExperience);
        }

        if (selectedEducation !== 'all') query = query.eq('education_level', selectedEducation);
        if (selectedGender !== 'all') query = query.eq('gender', selectedGender);

        // Salary filter (Expected salary)
        // Resume has 'expected_salary_min', 'expected_salary_max'.
        // Logic: Intersect ranges? Or Min >= Filter Min?
        if (salaryRange[0] > 0) {
            // expected_salary_min >= filter OR expected_salary_min IS NULL (negotiable)
            query = query.or(`expected_salary_min.gte.${salaryRange[0]},expected_salary_min.is.null`);
        }

        const { data, error } = await query;

        // Функция обогащения резюме данными о location
        const enrichResumes = (resumeList: any[]) => {
            return resumeList.map(resume => {
                if (resume.district_id) {
                    const district = currentDistricts.find(d => d.id === resume.district_id);
                    const region = currentRegions.find(r => r.id === district?.region_id);
                    return {
                        ...resume,
                        districts: district ? { ...district, regions: region } : null
                    };
                }
                return resume;
            });
        };

        if (error) {
            console.error('Error fetching resumes:', error);
            // Показываем понятную ошибку пользователю (возможно RLS)
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
        } else if (!data || data.length === 0) {
            // Fallback: попробуем без status filter
            console.debug('[RESUMES] Основной запрос вернул 0, пробуем fallback без status');
            const fallbackQuery = supabase
                .from('resumes')
                .select('*, districts(*, regions(*))')
                .eq('is_public', true)
                .order('created_at', { ascending: false })
                .limit(20);
            const { data: fallbackData, error: fallbackError } = await fallbackQuery;

            if (fallbackError) {
                console.error('Fallback query error:', fallbackError);
                setErrorMessage(lang === 'uz'
                    ? "Rezyumelar topilmadi"
                    : 'Резюме не найдены');
                setResumes([]);
            } else {
                // Используем fallbackData!
                setErrorMessage(null);
                const enrichedData = enrichResumes(fallbackData || []);
                let filtered = enrichedData;
                if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    filtered = filtered.filter(r =>
                        r.title?.toLowerCase().includes(q) ||
                        r.full_name?.toLowerCase().includes(q) ||
                        r.about?.toLowerCase().includes(q)
                    );
                }
                setResumes(filtered);
            }
        } else {
            // Основной запрос вернул данные
            setErrorMessage(null);
            const enrichedData = enrichResumes(data);
            let filtered = enrichedData;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                filtered = filtered.filter(r =>
                    r.title?.toLowerCase().includes(q) ||
                    r.full_name?.toLowerCase().includes(q) ||
                    r.about?.toLowerCase().includes(q)
                );
            }
            setResumes(filtered);
        }
        setLoading(false);
    }, [selectedCategory, selectedRegion, selectedDistrict, selectedExperience, selectedEducation, selectedGender, salaryRange, searchQuery, categories.length]);

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

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="bg-indigo-900 text-white py-10 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute -top-24 -left-24 w-96 h-96 bg-white rounded-full blur-3xl opacity-20"></div>
                    <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-400 rounded-full blur-3xl opacity-20"></div>
                </div>

                <div className="container mx-auto px-4 relative z-10">
                    <h1 className="text-3xl md:text-4xl font-black mb-4 tracking-tight">{lang === 'uz' ? 'Rezyumelar' : 'Резюме'}</h1>
                    <div className="flex gap-2 max-w-2xl">
                        <div className="relative flex-1 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                            <Input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={lang === 'uz' ? 'Kasb yoki ko\'nikma bo\'yicha qidirish...' : 'Поиск по профессии или навыкам...'}
                                className="pl-12 h-14 bg-white text-slate-900 border-0 rounded-2xl shadow-xl shadow-indigo-900/20 text-lg"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8">
                <div className="flex flex-col lg:flex-row gap-6">
                    <aside className="lg:w-72 flex-shrink-0">
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
                    </aside>

                    <main className="flex-1">
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
                            </div>
                        ) : errorMessage ? (
                            /* Показываем ошибку RLS/доступа */
                            <div className="text-center py-16 bg-red-50 rounded-xl shadow-sm border border-red-200">
                                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Search className="w-8 h-8 text-slate-400" />
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {resumes.map(resume => (
                                    <ResumeCard key={resume.id} resume={resume} />
                                ))}
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
}
