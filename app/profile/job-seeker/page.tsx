'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { ProfileLayout } from '@/components/profile/profile-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { User, MapPin, Phone, Edit3, Save, X, FileText, Send, Briefcase, MessageSquare, CheckCircle, Info, Loader2 } from '@/components/ui/icons';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export default function JobSeekerProfilePage() {
    const { lang } = useLanguage();
    const { user, updateProfile } = useUserAuth();
    const [isSearching, setIsSearching] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Location state
    const [selectedRegion, setSelectedRegion] = useState<string>('');

    const [profile, setProfile] = useState({
        full_name: '',
        birth_date: '',
        phone: '',
        telegram: '',
        region_id: '',
        district_id: '',
        about: '',
    });

    const [savedProfile, setSavedProfile] = useState({
        full_name: '',
        birth_date: '',
        phone: '',
        telegram: '',
        region_id: '',
        district_id: '',
        about: '',
    });

    const [displayLocation, setDisplayLocation] = useState('');

    // Location effects handled by LocationSelect
    // Load profile from database on mount

    // Load profile from database on mount
    useEffect(() => {
        const loadProfile = async () => {
            if (!user?.id) {
                setIsLoading(false);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('job_seeker_profiles')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (error && error.code !== 'PGRST116') {
                    console.error('Load profile error:', error);
                }

                if (data) {
                    const profileData = {
                        full_name: data.full_name || '',
                        birth_date: data.birth_date || '',
                        phone: data.phone || user.phone || '',
                        telegram: data.telegram || '',
                        region_id: data.region_id ? String(data.region_id) : '',
                        district_id: data.district_id ? String(data.district_id) : (data.city ? String(data.city) : ''),
                        about: data.about || '',
                    };

                    setProfile(profileData);
                    setSavedProfile(profileData);

                    // Set selected region
                    if (profileData.region_id) {
                        setSelectedRegion(profileData.region_id);
                    } else if (profileData.district_id) {
                        // Region inference if needed, but rely on DB usually
                        // If we really need to fetch district to find region:
                        const dist = await getDistrictById(profileData.district_id);
                        if (dist && dist.region_id) {
                            setSelectedRegion(String(dist.region_id));
                            setProfile(prev => ({ ...prev, region_id: String(dist.region_id) }));
                            setSavedProfile(prev => ({ ...prev, region_id: String(dist.region_id) }));
                        }
                    }

                    // Resolve display location
                    if (profileData.district_id) {
                        // Check if it's a UUID or Number (legacy). getDistrictById handles UUIDs if backend supports it.
                        // We will try fetching regardless.
                        const dist = await getDistrictById(profileData.district_id);
                        if (dist) {
                            setDisplayLocation(lang === 'ru' ? dist.name_ru : dist.name_uz);
                        } else {
                            // Fallback to ID if not found (unlikely)
                            setDisplayLocation('');
                        }

                    }
                } else if (user.phone) {
                    // No profile yet
                    setProfile(prev => ({
                        ...prev,
                        phone: user.phone
                    }));
                    setSavedProfile(prev => ({
                        ...prev,
                        phone: user.phone
                    }));
                }
            } catch (err) {
                console.error('Failed to load profile:', err);
            }
            setIsLoading(false);
        };

        loadProfile();
    }, [user?.id, user?.phone, lang]);

    const handleSave = async () => {
        if (!user?.id) {
            toast.error('Foydalanuvchi topilmadi');
            return;
        }

        setIsSaving(true);
        try {
            // Save to database
            const { error } = await supabase
                .from('job_seeker_profiles')
                .upsert({
                    user_id: user.id,
                    full_name: profile.full_name,
                    birth_date: profile.birth_date || null,
                    phone: profile.phone,
                    telegram: profile.telegram || null,
                    region_id: (profile.region_id && !isNaN(parseInt(profile.region_id))) ? parseInt(profile.region_id) : null,
                    district_id: (profile.district_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profile.district_id)) ? profile.district_id : null,
                    city: profile.district_id || null,
                    about: profile.about,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id'
                });

            if (error) {
                console.error('Save profile error detailed:', error);
                const errorMsg = error.message || (lang === 'ru' ? 'Ошибка сохранения' : 'Saqlashda xatolik');
                toast.error(errorMsg);
                setIsSaving(false);
                return;
            }

            // Update display location
            if (profile.district_id && /^\d+$/.test(profile.district_id)) {
                const dist = await getDistrictById(profile.district_id);
                if (dist) {
                    setDisplayLocation(lang === 'ru' ? dist.name_ru : dist.name_uz);
                }
            }


            // Also update context
            if (updateProfile) {
                updateProfile({ full_name: profile.full_name });
            }

            setSavedProfile(profile);
            toast.success(lang === 'ru' ? 'Профиль сохранён' : 'Profil saqlandi');
        } catch (err) {
            console.error('Save error:', err);
            toast.error(lang === 'ru' ? 'Ошибка сети' : 'Tarmoq xatosi');
        }
        setIsSaving(false);
    };

    const hasChanges = JSON.stringify(profile) !== JSON.stringify(savedProfile);

    const [stats, setStats] = useState([
        { label: lang === 'ru' ? 'Резюме' : 'Rezyume', value: 0, icon: FileText, color: 'text-sky-600', bgColor: 'bg-sky-50' },
        { label: lang === 'ru' ? 'Отклики' : 'Arizalar', value: 0, icon: Send, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
        { label: lang === 'ru' ? 'Просмотры' : "Ko'rishlar", value: 0, icon: Briefcase, color: 'text-violet-600', bgColor: 'bg-violet-50' },
    ]);

    // Fetch real stats from database
    useEffect(() => {
        const fetchStats = async () => {
            if (!user?.id) return;

            try {
                const { count: resumeCount } = await supabase
                    .from('resumes')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', user.id);

                const { count: applicationCount } = await supabase
                    .from('job_applications')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', user.id);

                const { data: resumeViews } = await supabase
                    .from('resumes')
                    .select('views_count')
                    .eq('user_id', user.id);
                const totalViews = resumeViews?.reduce((sum, r) => sum + (r.views_count || 0), 0) || 0;

                setStats(prev => [
                    { ...prev[0], value: resumeCount || 0 },
                    { ...prev[1], value: applicationCount || 0 },
                    { ...prev[2], value: totalViews },
                ]);
            } catch (err) {
                console.error('Failed to fetch stats:', err);
            }
        };

        fetchStats();
    }, [user?.id]);

    const completeness = [
        profile.full_name,
        profile.birth_date,
        profile.phone,
        profile.district_id,
        profile.about
    ].filter(Boolean).length * 20;

    if (isLoading) {
        return (
            <ProfileLayout userType="job_seeker" userName="...">
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
                </div>
            </ProfileLayout>
        );
    }

    return (
        <ProfileLayout userType="job_seeker" userName={profile.full_name || 'Foydalanuvchi'}>
            <div className="space-y-6">
                {/* Header Card */}
                <Card>
                    <CardContent className="p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center text-white text-2xl font-bold">
                                    {profile.full_name ? profile.full_name[0].toUpperCase() : 'F'}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h1 className="text-xl font-bold text-slate-900">
                                            {profile.full_name || (lang === 'ru' ? 'Имя не указано' : "Ism ko'rsatilmagan")}
                                        </h1>
                                        {isSearching && (
                                            <Badge className="bg-emerald-100 text-emerald-700">
                                                <CheckCircle className="w-3 h-3 mr-1" />
                                                {lang === 'ru' ? 'Ищу работу' : 'Ish qidirmoqda'}
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
                                        {profile.phone && (
                                            <span className="flex items-center gap-1">
                                                <Phone className="w-4 h-4" />
                                                {profile.phone}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                        </div>
                    </CardContent>
                </Card>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {stats.map((stat, i) => (
                        <Card key={i}>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                                        <stat.icon className={`w-5 h-5 ${stat.color}`} />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                                        <p className="text-xs text-slate-500">{stat.label}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Profile Completeness */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-700">
                                {lang === 'ru' ? 'Заполненность профиля' : "Profil to'ldirilganligi"}
                            </span>
                            <span className="text-sm font-semibold text-emerald-600">{completeness}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
                                style={{ width: `${completeness}%` }}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Edit Form */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="w-5 h-5 text-slate-600" />
                            {lang === 'ru' ? 'Личные данные' : "Shaxsiy ma'lumotlar"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label>{lang === 'ru' ? 'ФИО' : "To'liq ism"}</Label>
                                <Input
                                    value={profile.full_name}
                                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                                    disabled={false}
                                    placeholder={lang === 'ru' ? 'Ваше полное имя' : "To'liq ismingiz"}
                                />
                            </div>
                            <div>
                                <Label>{lang === 'ru' ? 'Дата рождения' : "Tug'ilgan sana"}</Label>
                                <Input
                                    type="date"
                                    value={profile.birth_date}
                                    onChange={(e) => setProfile({ ...profile, birth_date: e.target.value })}
                                    disabled={false}
                                />
                            </div>
                            <div>
                                <Label>{lang === 'ru' ? 'Телефон' : 'Telefon'}</Label>
                                <Input
                                    value={profile.phone}
                                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                    disabled={false}
                                    placeholder="+998 90 123 45 67"
                                />
                            </div>
                            <div>
                                <Label>Telegram (username)</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-slate-400">@</span>
                                    <Input
                                        className="pl-7"
                                        value={profile.telegram}
                                        onChange={(e) => setProfile({ ...profile, telegram: e.target.value.replace('@', '') })}
                                        placeholder="username"
                                    />
                                </div>
                            </div>

                            {/* Region and District Selection */}
                            <div className="col-span-1 md:col-span-2">
                                <LocationSelect
                                    selectedRegion={profile.region_id}
                                    selectedDistrict={profile.district_id}
                                    onRegionChange={(val) => {
                                        setSelectedRegion(val);
                                        setProfile(prev => ({ ...prev, region_id: val, district_id: '' }));
                                    }}
                                    onDistrictChange={(val) => setProfile(prev => ({ ...prev, district_id: val }))}
                                    disabled={false}
                                    className="col-span-1 md:col-span-2"
                                />
                            </div>
                        </div>
                        <div>
                            <Label>{lang === 'ru' ? 'О себе' : "O'zingiz haqingizda"}</Label>
                            <Textarea
                                value={profile.about}
                                onChange={(e) => setProfile({ ...profile, about: e.target.value })}
                                disabled={false}
                                placeholder={lang === 'ru' ? 'Расскажите о себе, навыках и опыте...' : "O'zingiz, ko'nikmalaringiz va tajribangiz haqida yozing..."}
                                className="min-h-[100px]"
                            />
                        </div>
                        {hasChanges && (
                            <div className="flex justify-end pt-4">
                                <Button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[150px]"
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                    {lang === 'ru' ? 'Сохранить изменения' : "O'zgarishlarni saqlash"}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Job Search Status */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                                    <Briefcase className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="font-medium text-slate-900">
                                        {lang === 'ru' ? 'Статус поиска работы' : 'Ish qidirish holati'}
                                    </p>
                                    <p className="text-sm text-slate-500">
                                        {isSearching
                                            ? (lang === 'ru' ? 'Активно ищу работу' : 'Faol ish qidirmoqda')
                                            : (lang === 'ru' ? 'Не ищу работу' : 'Ish qidirmayapman')}
                                    </p>
                                </div>
                            </div>
                            <Switch
                                checked={isSearching}
                                onCheckedChange={setIsSearching}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Info Notice */}
                <div className="flex items-start gap-3 p-4 bg-sky-50 border border-sky-200 rounded-xl">
                    <Info className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-sky-800">
                        {lang === 'ru'
                            ? 'Заполните профиль полностью, чтобы работодатели могли найти вас. Добавьте резюме для большей видимости.'
                            : "Profilingizni to'liq to'ldiring, shunda ish beruvchilar sizni tezroq topishlari mumkin"}
                    </p>
                </div>
            </div>
        </ProfileLayout>
    );
}
