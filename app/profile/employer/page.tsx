'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { ProfileLayout } from '@/components/profile/profile-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { getDistrictById } from '@/lib/regions';
import { LocationSelect } from '@/components/ui/location-select';
import { Region, District } from '@/types/database';
import { Building2, MapPin, Phone, Edit3, Save, X, BadgeCheck, AlertTriangle, FileText, Users, Eye, Loader2 } from '@/components/ui/icons';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { fetchEmployerOwnedJobs } from '@/lib/employer-jobs';

export default function EmployerProfilePage() {
    const { lang } = useLanguage();
    const { user, updateProfile } = useUserAuth();
    const [isVerified, setIsVerified] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Location state
    // const [regions, setRegions] = useState<Region[]>([]);
    // const [districts, setDistricts] = useState<District[]>([]);
    const [selectedRegion, setSelectedRegion] = useState<string>('');
    const [displayLocation, setDisplayLocation] = useState('');

    // Location effects handled by LocationSelect

    // Real stats from database
    const [stats, setStats] = useState({ vacancies: 0, applications: 0, views: 0 });
    const [employerProfileId, setEmployerProfileId] = useState<string | null>(null);

    // Saved profile (from database)
    const [savedProfile, setSavedProfile] = useState({
        company_name: '',
        industry: '',
        region_id: '',
        district_id: '',
        address: '',
        phone: '',
        telegram: '',
        email: '',
        description: '',
        inn: '',
        director_name: '',
        company_size: ''
    });

    // Editable form (changes only applied on save)
    const [formData, setFormData] = useState({
        company_name: '',
        industry: '',
        region_id: '',
        district_id: '',
        address: '',
        phone: '',
        telegram: '',
        email: '',
        description: '',
        inn: '',
        director_name: '',
        company_size: ''
    });

    // Load profile and stats from database
    const loadData = useCallback(async () => {
        if (!user?.id) {
            setIsLoading(false);
            return;
        }

        try {
            // Load profile
            const { data: profileData, error: profileError } = await supabase
                .from('employer_profiles')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (profileError && profileError.code !== 'PGRST116') {
                console.error('Load profile error:', profileError);
            }

            if (profileData) {
                const profile = {
                    company_name: profileData.company_name || '',
                    industry: profileData.industry || '',
                    region_id: profileData.region_id ? String(profileData.region_id) : '',
                    district_id: profileData.district_id ? String(profileData.district_id) : (profileData.city ? String(profileData.city) : ''),
                    address: profileData.address || '',
                    phone: profileData.phone || user.phone || '',
                    email: profileData.email || '',
                    telegram: profileData.telegram || '',
                    description: profileData.description || '',
                    inn: profileData.inn || '',
                    director_name: profileData.director_name || '',
                    company_size: profileData.company_size || ''
                };
                setSavedProfile(profile);
                setFormData(profile);
                setIsVerified(profileData.is_verified || false);
                setEmployerProfileId(profileData.id);

                // Set selected region for LocationSelect
                if (profile.region_id) {
                    setSelectedRegion(profile.region_id);
                } else if (profile.district_id) {
                    // Try to infer region from district if region_id is missing
                    // This handles legacy data or data migrated from 'city'
                    if (/^\d+$/.test(profile.district_id)) {
                        const dist = await getDistrictById(profile.district_id);
                        if (dist && dist.region_id) {
                            setSelectedRegion(String(dist.region_id));
                            // Update form data with infered region to avoid "changes detected" immediately if we save later
                            const updatedProfile = { ...profile, region_id: String(dist.region_id) };
                            setSavedProfile(updatedProfile);
                            setFormData(updatedProfile);
                        }
                    }
                }

                // Resolve display location name
                if (profile.district_id) {
                    if (/^\d+$/.test(profile.district_id)) {
                        const dist = await getDistrictById(profile.district_id);
                        if (dist) {
                            setDisplayLocation(lang === 'ru' ? dist.name_ru : dist.name_uz);
                        }
                    } else {
                        setDisplayLocation(profile.district_id);
                    }
                }

                const jobsData = await fetchEmployerOwnedJobs(supabase, user.id, {
                    select: 'id, views_count, created_at, employer_id, created_by, user_id',
                    limit: 500
                });

                if (jobsData.length > 0) {
                    const totalViews = jobsData.reduce((sum, job) => sum + (job.views_count || 0), 0);

                    const jobIds = jobsData.map((job: any) => String(job.id)).filter(Boolean);
                    let totalApps = 0;
                    if (jobIds.length > 0) {
                        const { data: appRows } = await supabase
                            .from('job_applications')
                            .select('job_id')
                            .in('job_id', jobIds);
                        totalApps = (appRows || []).length;
                    }

                    setStats({
                        vacancies: jobsData.length,
                        applications: totalApps,
                        views: totalViews
                    });
                } else {
                    // No jobs found by ownership keys - show 0
                    setStats({ vacancies: 0, applications: 0, views: 0 });
                }
            } else if (user.phone) {
                setFormData(prev => ({ ...prev, phone: user.phone }));
                setSavedProfile(prev => ({ ...prev, phone: user.phone }));
            }
        } catch (err) {
            console.error('Failed to load data:', err);
        }
        setIsLoading(false);
    }, [user?.id, user?.phone, lang]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Cancel editing - reset form to saved values
    const handleCancel = () => {
        setFormData(savedProfile);
    };

    // Check if form has changes
    const hasChanges = JSON.stringify(formData) !== JSON.stringify(savedProfile);

    const handleSave = async () => {
        if (!user?.id) {
            toast.error('Foydalanuvchi topilmadi');
            return;
        }

        setIsSaving(true);
        try {
            const { data: existingProfile } = await supabase
                .from('employer_profiles')
                .select('id')
                .eq('user_id', user.id)
                .single();

            const districtIdNumeric = (formData.district_id && /^\d+$/.test(formData.district_id))
                ? parseInt(formData.district_id, 10)
                : null;

            const profileData: Record<string, any> = {
                company_name: formData.company_name || null,
                inn: formData.inn || null,
                director_name: formData.director_name || null,
                industry: formData.industry || null,
                company_size: formData.company_size || null,
                region_id: (formData.region_id && !isNaN(parseInt(formData.region_id))) ? parseInt(formData.region_id) : null,
                district_id: districtIdNumeric,
                city: formData.district_id || null,
                phone: formData.phone || null,
                telegram: formData.telegram || null,
                email: formData.email || null,
                address: formData.address || null,
                description: formData.description || null,
                updated_at: new Date().toISOString()
            };

            let error;
            if (existingProfile) {
                const result = await supabase
                    .from('employer_profiles')
                    .update(profileData)
                    .eq('id', existingProfile.id);
                error = result.error;
            } else {
                profileData.user_id = user.id;
                const result = await supabase
                    .from('employer_profiles')
                    .insert(profileData);
                error = result.error;
            }

            if (error) {
                console.error('Save profile error detailed:', error);
                const errorMsg = error.message || (lang === 'ru' ? 'Ошибка сохранения' : 'Saqlashda xatolik');
                toast.error(errorMsg);
                setIsSaving(false);
                return;
            }

            // Update saved profile with new values
            setSavedProfile(formData);

            // Update display location
            if (formData.district_id && /^\d+$/.test(formData.district_id)) {
                const dist = await getDistrictById(formData.district_id);
                if (dist) {
                    setDisplayLocation(lang === 'ru' ? dist.name_ru : dist.name_uz);
                }
            }

            if (updateProfile) {
                updateProfile({
                    company_name: formData.company_name,
                    is_verified: isVerified
                });
            }

            toast.success(lang === 'ru' ? 'Профиль сохранён' : 'Profil saqlandi');
        } catch (err) {
            console.error('Save error:', err);
            toast.error(lang === 'ru' ? 'Ошибка сети' : 'Tarmoq xatosi');
        }
        setIsSaving(false);
    };

    const industries = [
        { value: 'it', label: lang === 'ru' ? 'IT и технологии' : 'IT va texnologiyalar' },
        { value: 'manufacturing', label: lang === 'ru' ? 'Производство' : 'Ishlab chiqarish' },
        { value: 'trade', label: lang === 'ru' ? 'Торговля' : 'Savdo' },
        { value: 'services', label: lang === 'ru' ? 'Услуги' : 'Xizmatlar' },
        { value: 'education', label: lang === 'ru' ? 'Образование' : "Ta'lim" },
        { value: 'healthcare', label: lang === 'ru' ? 'Здравоохранение' : "Sog'liqni saqlash" },
        { value: 'construction', label: lang === 'ru' ? 'Строительство' : 'Qurilish' },
        { value: 'agriculture', label: lang === 'ru' ? 'Сельское хозяйство' : "Qishloq xo'jaligi" },
        { value: 'other', label: lang === 'ru' ? 'Другое' : 'Boshqa' },
    ];

    const companySizes = [
        { value: 'small', label: lang === 'ru' ? 'Малый бизнес (до 50)' : 'Kichik biznes (50 gacha)' },
        { value: 'medium', label: lang === 'ru' ? 'Средний бизнес (51-250)' : "O'rta biznes (51-250)" },
        { value: 'large', label: lang === 'ru' ? 'Крупный бизнес (250+)' : 'Yirik biznes (250+)' },
    ];

    if (isLoading) {
        return (
            <ProfileLayout userType="employer" userName="...">
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
                </div>
            </ProfileLayout>
        );
    }

    return (
        <ProfileLayout userType="employer" userName={savedProfile.company_name || 'Kompaniya'}>
            <div className="space-y-6">

                {/* Stats Grid - at top */}
                <div className="grid grid-cols-3 gap-4">
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-violet-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-slate-900">{stats.vacancies}</p>
                                    <p className="text-xs text-slate-500">{lang === 'ru' ? 'Вакансий' : 'Vakansiya'}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                                    <Users className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-slate-900">{stats.applications}</p>
                                    <p className="text-xs text-slate-500">{lang === 'ru' ? 'Откликов' : 'Ariza'}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center">
                                    <Eye className="w-5 h-5 text-sky-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-slate-900">{stats.views}</p>
                                    <p className="text-xs text-slate-500">{lang === 'ru' ? 'Просмотров' : "Ko'rish"}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Profile Card with Edit buttons */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                                {savedProfile.company_name ? savedProfile.company_name[0].toUpperCase() : 'K'}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <CardTitle className="text-lg">
                                        {savedProfile.company_name || (lang === 'ru' ? 'Название не указано' : "Nom ko'rsatilmagan")}
                                    </CardTitle>
                                    {isVerified ? (
                                        <Badge variant="secondary" className="bg-sky-100 text-sky-700 gap-1">
                                            <BadgeCheck className="w-3 h-3" />
                                            {lang === 'ru' ? 'Подтверждено' : 'Tasdiqlangan'}
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-slate-500">
                                            {lang === 'ru' ? 'Не подтверждено' : 'Tasdiqlanmagan'}
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                                    {displayLocation && (
                                        <span className="flex items-center gap-1">
                                            <MapPin className="w-4 h-4" />
                                            {displayLocation}
                                        </span>
                                    )}
                                    {savedProfile.phone && (
                                        <span className="flex items-center gap-1">
                                            <Phone className="w-4 h-4" />
                                            {savedProfile.phone}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {!isVerified && (
                                <Button variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-200">
                                    <AlertTriangle className="w-4 h-4 mr-2" />
                                    {lang === 'ru' ? 'OneID верификация' : 'OneID orqali tasdiqlash'}
                                </Button>
                            )}
                            {hasChanges && (
                                <Button onClick={handleSave} disabled={isSaving} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {lang === 'ru' ? 'Сохранить' : 'Saqlash'}
                                </Button>
                            )}
                            {hasChanges && (
                                <Button onClick={handleCancel} variant="outline" className="gap-2">
                                    <X className="w-4 h-4" />
                                    {lang === 'ru' ? 'Отмена' : 'Bekor'}
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4 border-t pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label>{lang === 'ru' ? 'Название компании' : 'Kompaniya nomi'}</Label>
                                <Input
                                    value={formData.company_name}
                                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                    placeholder={lang === 'ru' ? 'OOO "Example"' : 'MCHJ "Example"'}
                                />
                            </div>
                            <div>
                                <Label>{lang === 'ru' ? 'ИНН (STIR)' : 'STIR (INN)'}</Label>
                                <Input
                                    value={formData.inn}
                                    onChange={(e) => setFormData({ ...formData, inn: e.target.value })}
                                    placeholder="123456789"
                                />
                            </div>
                            <div>
                                <Label>{lang === 'ru' ? 'Директор' : 'Direktor'}</Label>
                                <Input
                                    value={formData.director_name}
                                    onChange={(e) => setFormData({ ...formData, director_name: e.target.value })}
                                    placeholder={lang === 'ru' ? 'ФИО директора' : "Direktor F.I.Sh"}
                                />
                            </div>
                            <div>
                                <Label>{lang === 'ru' ? 'Сфера деятельности' : 'Faoliyat sohasi'}</Label>
                                <Select
                                    value={formData.industry}
                                    onValueChange={(val) => setFormData({ ...formData, industry: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={lang === 'ru' ? 'Выберите сферу' : 'Sohani tanlang'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {industries.map((ind) => (
                                            <SelectItem key={ind.value} value={ind.value}>
                                                {ind.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>{lang === 'ru' ? 'Размер компании' : 'Kompaniya hajmi'}</Label>
                                <Select
                                    value={formData.company_size}
                                    onValueChange={(val) => setFormData({ ...formData, company_size: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={lang === 'ru' ? 'Выберите размер' : 'Hajmni tanlang'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {companySizes.map((size) => (
                                            <SelectItem key={size.value} value={size.value}>
                                                {size.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <LocationSelect
                                selectedRegion={formData.region_id}
                                selectedDistrict={formData.district_id}
                                onRegionChange={(val) => {
                                    setSelectedRegion(val);
                                    setFormData(prev => ({ ...prev, region_id: val, district_id: '' }));
                                }}
                                onDistrictChange={(val) => setFormData(prev => ({ ...prev, district_id: val }))}
                                className="col-span-1 md:col-span-2"
                            />
                            <div>
                                <Label>{lang === 'ru' ? 'Телефон' : 'Telefon'}</Label>
                                <Input
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Telegram (username)</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-slate-400">@</span>
                                    <Input
                                        className="pl-7"
                                        value={formData.telegram}
                                        onChange={(e) => setFormData({ ...formData, telegram: e.target.value.replace('@', '') })}
                                        placeholder="username"
                                    />
                                </div>
                            </div>
                        </div>
                        <div>
                            <Label>{lang === 'ru' ? 'Адрес' : 'Manzil'}</Label>
                            <Input
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                placeholder={lang === 'ru' ? 'Улица, дом, офис...' : 'Ko\'cha, uy, ofis...'}
                            />
                        </div>
                        <div>
                            <Label>{lang === 'ru' ? 'О компании' : 'Kompaniya haqida'}</Label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder={lang === 'ru' ? 'Краткое описание деятельности...' : 'Faoliyat haqida qisqacha...'}
                                className="min-h-[100px]"
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </ProfileLayout >
    );
}
