'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';
import { useAuth } from '@/contexts/auth-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { supabase } from '@/lib/supabase';
import { Category, District } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { JobMap } from '@/components/map/job-map';
import { ArrowLeft, Loader2, MapPin, Send, X, AlertTriangle, Plus, Trash2, Locate, Wand2, Save } from '@/components/ui/icons';
import Image from 'next/image';
import { LocationSelect } from '@/components/ui/location-select';
import { toast } from 'sonner';
import { getAllDistricts, getDistrictById } from '@/lib/regions';

// Constants
const EMPLOYMENT_TYPES = [
  { value: 'full_time', label: "To'liq kun" },
  { value: 'part_time', label: 'Yarim kun' },
  { value: 'contract', label: 'Shartnoma' },
  { value: 'internship', label: 'Stajirovka' },
  { value: 'remote', label: 'Masofaviy ish' },
];

const EXPERIENCE_OPTIONS = [
  { value: 'no_experience', label: 'Tajriba talab qilinmaydi' },
  { value: '1_3', label: '1-3 yil' },
  { value: '3_6', label: '3-6 yil' },
  { value: '6_plus', label: "6 yildan ko'p" },
];

const EDUCATION_OPTIONS = [
  { value: 'any', label: 'Ahamiyatsiz' },
  { value: 'secondary', label: "O'rta" },
  { value: 'vocational', label: "O'rta maxsus" },
  { value: 'higher', label: 'Oliy' },
  { value: 'master', label: 'Magistratura' },
];

const LANGUAGES = [
  { value: 'uzbek', label: "O'zbek tili" },
  { value: 'russian', label: 'Rus tili' },
  { value: 'english', label: 'Ingliz tili' },
  { value: 'korean', label: 'Koreys tili' },
  { value: 'chinese', label: 'Xitoy tili' },
  { value: 'german', label: 'Nemis tili' },
];

const LANGUAGE_LEVELS = [
  { value: 'A1', label: 'A1 - Boshlang\'ich' },
  { value: 'A2', label: 'A2 - Elementar' },
  { value: 'B1', label: 'B1 - O\'rta' },
  { value: 'B2', label: 'B2 - O\'rta+' },
  { value: 'C1', label: 'C1 - Yuqori' },
  { value: 'C2', label: 'C2 - Ravon' },
];

const GENDERS = [
  { value: 'any', label: 'Ahamiyatsiz' },
  { value: 'male', label: 'Erkak' },
  { value: 'female', label: 'Ayol' },
];

// Bad words
const BAD_WORDS = ['fohisha', 'prostitutka', 'prostitute', 'seks', 'sex', 'intim', 'escort'];
const checkBadWords = (text: string): boolean => {
  const lowerText = text.toLowerCase();
  return BAD_WORDS.some(word => lowerText.includes(word));
};

interface LanguageSkill {
  language: string;
  level: string;
}

export default function EditJobPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  console.log('EditJobPage ID:', id);

  const { lang, t } = useLanguage();
  const { user: adminUser, loading: authLoading } = useAuth();
  const { user: regularUser, isLoading: userLoading } = useUserAuth();
  const router = useRouter();

  const user = adminUser || regularUser;

  const [categories, setCategories] = useState<Category[]>([]);
  // const [districts, setDistricts] = useState<District[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

  // AI Modal state
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiUsageCount, setAiUsageCount] = useState(0);
  const [showBadWordWarning, setShowBadWordWarning] = useState(false);
  const MAX_AI_USES = 3;

  const [formData, setFormData] = useState({
    title: '',
    company_name: '',
    category_id: '',
    region_id: '',
    district_id: '',
    employment_type: 'full_time',
    experience: 'no_experience',
    education: 'any',
    salary_min: '',
    salary_max: '',
    salary_negotiable: false,
    tasks_requirements: '',
    benefits: '',
    contact_phone: '',
    contact_telegram: '',
    latitude: 0,
    longitude: 0,
    address: '',
    gender: 'any',
    age_min: '',
    age_max: '',
    age_any: true,
    languages: [] as LanguageSkill[],
    is_for_students: false,
    is_for_disabled: false,
    is_active: true,
  });

  const isForWomen = formData.gender === 'any' || formData.gender === 'female';

  useEffect(() => {
    const isLoading = authLoading || userLoading;
    if (!isLoading && !user) router.push('/admin/login');
  }, [user, authLoading, userLoading, router]);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [jobRes, catRes] = await Promise.all([
        supabase.from('jobs').select('*, districts(region_id)').eq('id', id).maybeSingle(),
        supabase.from('categories').select('*').order('name_uz'),
      ]);
      setCategories(catRes.data || []);
      // setDistricts(distRes.data || []);

      if (jobRes.data) {
        const job = jobRes.data;

        // Resolve region
        let regionId = job.region_id;
        if (!regionId && job.districts && job.districts.region_id) {
          regionId = job.districts.region_id;
        }

        if (regionId) {
          setSelectedRegion(regionId.toString());
        }

        setFormData({
          title: job.title_uz || '',
          company_name: job.company_name || '',
          category_id: job.category_id || '',
          region_id: regionId ? regionId.toString() : '',
          district_id: job.district_id ? job.district_id.toString() : '',
          employment_type: job.employment_type || 'full_time',
          experience: job.experience || 'no_experience',
          education: job.education_level || 'any',
          salary_min: job.salary_min?.toString() || '',
          salary_max: job.salary_max?.toString() || '',
          salary_negotiable: !job.salary_min && !job.salary_max,
          tasks_requirements: job.description_uz || '',
          benefits: job.requirements_uz || '',
          contact_phone: job.contact_phone || job.phone || '',
          contact_telegram: job.contact_telegram || '',
          latitude: job.latitude || 0,
          longitude: job.longitude || 0,
          address: job.address || '',
          gender: job.gender || 'any',
          age_min: job.age_min?.toString() || '',
          age_max: job.age_max?.toString() || '',
          age_any: !job.age_min && !job.age_max,
          languages: [], // TODO: If languages are stored, map them here. Assuming they might not be currently implemented in DB or complex to map back.
          is_for_students: job.is_for_students || false,
          is_for_disabled: job.is_for_disabled || false,
          is_active: job.is_active ?? true,
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Ma\'lumotlarni yuklashda xatolik');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sync region when district_id is loaded
  useEffect(() => {
    if (formData.district_id && !selectedRegion && !isNaN(parseInt(formData.district_id as string))) {
      getDistrictById(parseInt(formData.district_id as string)).then((district) => {
        if (district && district.region_id) {
          setSelectedRegion(district.region_id.toString());
        }
      });
    }
  }, [formData.district_id, selectedRegion]);

  // Language management
  const addLanguage = () => {
    if (formData.languages.length >= 5) return;
    setFormData(prev => ({
      ...prev,
      languages: [...prev.languages, { language: 'uzbek', level: 'B1' }]
    }));
  };

  const removeLanguage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.filter((_, i) => i !== index)
    }));
  };

  const updateLanguage = (index: number, field: 'language' | 'level', value: string) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.map((l, i) => i === index ? { ...l, [field]: value } : l)
    }));
  };

  // Detect current location
  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Brauzeringiz joylashuvni aniqlay olmaydi");
      return;
    }

    setDetectingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        setFormData(prev => ({
          ...prev,
          latitude: lat,
          longitude: lng
        }));

        toast.success(`Joylashuv aniqlandi: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        setDetectingLocation(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMsg = "Joylashuvni aniqlab bo'lmadi";
        if (error.code === 1) {
          errorMsg = "Joylashuvga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering.";
        } else if (error.code === 2) {
          errorMsg = "Joylashuv ma'lumoti mavjud emas";
        } else if (error.code === 3) {
          errorMsg = "Vaqt tugadi, qaytadan urinib ko'ring";
        }
        toast.error(errorMsg);
        setDetectingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  // AI Modal
  const openAIModal = () => {
    if (aiUsageCount >= MAX_AI_USES) {
      toast.error(`AI yordamchi faqat ${MAX_AI_USES} marta ishlatilishi mumkin!`);
      return;
    }
    setShowAIModal(true);
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Iltimos, vakansiya haqida yozing");
      return;
    }

    if (checkBadWords(aiPrompt)) {
      setShowBadWordWarning(true);
      setShowAIModal(false);
      return;
    }

    setAiGenerating(true);
    try {
      const allDistricts = await getAllDistricts();
      const res = await fetch('/api/ai/vacancy-helper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'full_generate',
          prompt: aiPrompt,
          categories: categories.map(c => ({ id: c.id, name: c.name_uz })),
          districts: allDistricts.map(d => ({ id: d.id, name: d.name_uz })),
        })
      });
      const data = await res.json();

      if (data.success && data.result) {
        const result = data.result;

        setFormData(prev => ({
          ...prev,
          title: result.title || prev.title,
          category_id: result.category_id || prev.category_id,
          district_id: result.district_id || prev.district_id,
          employment_type: result.employment_type || prev.employment_type,
          experience: result.experience || prev.experience,
          salary_min: result.salary_min?.toString() || prev.salary_min,
          salary_max: result.salary_max?.toString() || prev.salary_max,
          salary_negotiable: result.salary_negotiable ?? prev.salary_negotiable,
          gender: result.gender || prev.gender,
          age_min: result.age_min?.toString() || prev.age_min,
          age_max: result.age_max?.toString() || prev.age_max,
          age_any: !result.age_min && !result.age_max,
          tasks_requirements: result.tasks_requirements || prev.tasks_requirements,
          benefits: result.benefits || prev.benefits,
        }));

        setAiUsageCount(prev => prev + 1);
        toast.success('AI barcha maydonlarni to\'ldirdi!');
        setShowAIModal(false);
        setAiPrompt('');
      } else {
        toast.error(data.error || "Xatolik");
      }
    } catch (error) {
      toast.error("Tarmoq xatosi");
    }
    setAiGenerating(false);
  };

  const handleMapClick = (lat: number, lng: number) => {
    setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) { toast.error("Lavozim nomi!"); return; }
    if (!formData.company_name.trim()) { toast.error("Kompaniya nomi!"); return; }
    if (!formData.category_id) { toast.error("Kategoriya!"); return; }
    if (!formData.district_id) { toast.error("Tuman!"); return; }
    if (!formData.tasks_requirements.trim()) { toast.error("Talablar!"); return; }
    if (!formData.latitude) { toast.error("Joylashuv!"); return; }
    if (!formData.contact_phone.trim()) { toast.error("Telefon!"); return; }

    if (checkBadWords(`${formData.title} ${formData.tasks_requirements}`)) {
      setShowBadWordWarning(true);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('jobs').update({
        title_uz: formData.title,
        title_ru: formData.title,
        description_uz: formData.tasks_requirements,
        description_ru: formData.tasks_requirements,
        company_name: formData.company_name,
        category_id: formData.category_id,
        category_id: formData.category_id,
        region_id: formData.region_id ? parseInt(formData.region_id) : null,
        district_id: formData.district_id || null, // Keep as string for text column
        salary_min: formData.salary_negotiable ? null : (formData.salary_min ? parseInt(formData.salary_min) : null),
        salary_max: formData.salary_negotiable ? null : (formData.salary_max ? parseInt(formData.salary_max) : null),
        employment_type: formData.employment_type,
        latitude: formData.latitude,
        longitude: formData.longitude,
        address: formData.address || null,
        contact_phone: formData.contact_phone,
        contact_telegram: formData.contact_telegram || null,
        requirements_uz: formData.tasks_requirements,
        requirements_ru: formData.tasks_requirements,
        benefits: formData.benefits || null,
        status: 'active',
        is_for_students: formData.is_for_students,
        is_for_disabled: formData.is_for_disabled,
        is_active: formData.is_active,
        education_level: formData.education,
        experience: formData.experience,
        gender: formData.gender,
        age_min: formData.age_any ? null : (formData.age_min ? parseInt(formData.age_min) : null),
        age_max: formData.age_any ? null : (formData.age_max ? parseInt(formData.age_max) : null),
        languages: formData.languages.length > 0 ? formData.languages : null,
        is_for_women: isForWomen,
      })
        .eq('id', id);

      if (error) { toast.error(error.message); setSaving(false); return; }

      toast.success('Vakansiya yangilandi!');

      if (adminUser) {
        router.push('/admin/jobs');
      } else {
        router.push('/profile/employer/vacancies');
      }
    } catch (error) {
      toast.error('Xatolik');
    }
    setSaving(false);
  };

  if (authLoading || userLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Bad Word Warning */}
      {showBadWordWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md">
            <CardHeader className="text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-2" />
              <CardTitle className="text-red-600">Ogohlantirish!</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="mb-4">Taqiqlangan so&apos;zlar aniqlandi. Akkaunt bloklanishi mumkin!</p>
              <Button onClick={() => setShowBadWordWarning(false)}>Tushunarli</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center">
                  <Image src="/ai-sparkle.png" alt="AI" width={28} height={28} className="w-7 h-7 brightness-0 invert" />
                </div>
                <div>
                  <CardTitle className="text-2xl">AI Yordamchi</CardTitle>
                  <CardDescription className="text-base">Vakansiya haqida yozing, AI barcha maydonlarni to&apos;ldiradi</CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowAIModal(false)}>
                <X className="w-6 h-6" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-slate-600">
                Qanday xodim kerakligini batafsil yozing. Lavozim, maosh, tajriba, jins, yosh - hammasini AI tushunadi va formaga to&apos;ldiradi.
              </p>
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder=""
                rows={5}
                className="text-base"
              />
              <div className="flex justify-between items-center pt-2">
                <span className="text-sm text-slate-400">
                  {MAX_AI_USES - aiUsageCount} ta imkoniyat qoldi
                </span>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setShowAIModal(false)}>
                    Bekor qilish
                  </Button>
                  <Button
                    onClick={handleAIGenerate}
                    disabled={aiGenerating || !aiPrompt.trim()}
                    className="bg-violet-600 hover:bg-violet-700 px-8"
                  >
                    {aiGenerating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Image src="/ai-sparkle.png" alt="AI" width={20} height={20} className="w-5 h-5 mr-2" />}
                    To&apos;ldirish
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="pt-24 pb-8 px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="max-w-[1400px] mx-auto">
          {/* Header */}
          {/* Header */}
          <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" asChild className="h-11 w-11">
                <Link href={adminUser ? "/admin/jobs" : "/profile/employer/vacancies"}>
                  <ArrowLeft className="w-5 h-5" />
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Vakansiyani tahrirlash</h1>
                <p className="text-slate-500">Vakansiya ma&apos;lumotlarini o&apos;zgartirish</p>
              </div>
            </div>

            <Button
              type="button"
              onClick={openAIModal}
              size="lg"
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 gap-3 px-6 h-12 text-sm shadow-md"
            >
              <Image src="/ai-sparkle.png" alt="AI" width={20} height={20} className="w-5 h-5" />
              <div className="flex flex-col items-start text-left">
                <span className="font-semibold">Sun&apos;iy intellekt yordamida to&apos;ldirish</span>
                <span className="text-[10px] opacity-90">{MAX_AI_USES - aiUsageCount} ta imkoniyat qoldi</span>
              </div>
            </Button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">

              {/* Main Form - 3 columns */}
              <div className="xl:col-span-3 space-y-8">

                {/* Basic Info */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Asosiy ma&apos;lumotlar</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="font-medium text-base">Lavozim nomi *</Label>
                        <Input
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          placeholder="Masalan: Buxgalter, Dasturchi"
                          className="h-12 text-base"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-medium text-base">Kompaniya nomi *</Label>
                        <Input
                          value={formData.company_name}
                          onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                          placeholder="Kompaniya nomi"
                          className="h-12 text-base"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="space-y-2">
                        <Label className="font-medium">Kategoriya *</Label>
                        <Select value={formData.category_id} onValueChange={(v) => setFormData({ ...formData, category_id: v })}>
                          <SelectTrigger className="h-12"><SelectValue placeholder="Tanlang" /></SelectTrigger>
                          <SelectContent>
                            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name_uz}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <LocationSelect
                        selectedRegion={formData.region_id}
                        selectedDistrict={formData.district_id}
                        onRegionChange={(v) => {
                          setFormData(prev => ({ ...prev, region_id: v, district_id: '' }));
                        }}
                        onDistrictChange={(v) => setFormData(prev => ({ ...prev, district_id: v }))}
                        required
                        className="col-span-2"
                      />
                      <div className="space-y-2">
                        <Label className="font-medium">Ish turi</Label>
                        <Select value={formData.employment_type} onValueChange={(v) => setFormData({ ...formData, employment_type: v })}>
                          <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {EMPLOYMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="font-medium">Jins</Label>
                        <Select value={formData.gender} onValueChange={(v) => setFormData({ ...formData, gender: v })}>
                          <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {GENDERS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Tasks & Requirements */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Talablar va vazifalar *</CardTitle>
                    <CardDescription>Xodimdan nimalar talab qilinadi va qanday ishlarni bajaradi</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={formData.tasks_requirements}
                      onChange={(e) => setFormData({ ...formData, tasks_requirements: e.target.value })}
                      placeholder={"• Oliy ma'lumot\n• Kamida 2 yillik tajriba\n• 1C dasturini bilish\n• Hisobotlarni tayyorlash va yuborish"}
                      rows={8}
                      className="text-base"
                    />
                  </CardContent>
                </Card>

                {/* Benefits */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Qulayliklar</CardTitle>
                    <CardDescription>Xodimga beriladigan imtiyozlar</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={formData.benefits}
                      onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
                      placeholder={"• Rasmiy mehnat shartnomasi\n• O'z vaqtida maosh\n• Bepul tushlik"}
                      rows={5}
                      className="text-base"
                    />
                  </CardContent>
                </Card>

                {/* Languages */}
                <Card className="shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <CardTitle className="text-lg">Til bilish</CardTitle>
                    <Button type="button" variant="outline" onClick={addLanguage} disabled={formData.languages.length >= 5}>
                      <Plus className="w-4 h-4 mr-2" /> Til qo&apos;shish
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {formData.languages.length === 0 ? (
                      <p className="text-slate-400 py-4">Til talab qilinmaydi (qo&apos;shish uchun yuqoridagi tugmani bosing)</p>
                    ) : (
                      <div className="space-y-4">
                        {formData.languages.map((lang, idx) => (
                          <div key={idx} className="flex gap-4 items-center">
                            <Select value={lang.language} onValueChange={(v) => updateLanguage(idx, 'language', v)}>
                              <SelectTrigger className="w-52 h-12"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Select value={lang.level} onValueChange={(v) => updateLanguage(idx, 'level', v)}>
                              <SelectTrigger className="w-48 h-12"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {LANGUAGE_LEVELS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeLanguage(idx)} className="text-red-500 hover:text-red-600 hover:bg-red-50 h-12 w-12">
                              <Trash2 className="w-5 h-5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Location / Map */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-sky-600" />
                          Xaritadan joylashuvni tanlang *
                        </CardTitle>
                        <CardDescription>Xaritani bosib koordinatalarni belgilang yoki joylashuvni aniqlang</CardDescription>
                      </div>
                      <Button
                        type="button"
                        onClick={detectLocation}
                        disabled={detectingLocation}
                        className="gap-2 bg-sky-500 hover:bg-sky-600 text-white"
                      >
                        {detectingLocation ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <MapPin className="w-4 h-4" />
                        )}
                        Joylashuvni aniqlash
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="font-medium">Manzil</Label>
                      <Input
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="Ko'cha nomi, uy raqami"
                        className="h-12"
                      />
                    </div>
                    <div className="h-[400px] rounded-xl overflow-hidden border-2 border-slate-200">
                      <JobMap
                        jobs={[]}
                        interactive={true}
                        onMapClick={handleMapClick}
                        markerPosition={formData.latitude ? { lat: formData.latitude, lng: formData.longitude } : null}
                        height="400px"
                      />
                    </div>
                    {formData.latitude ? (
                      <p className="text-sm text-green-600 font-medium flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Joylashuv tanlandi: {formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)}
                      </p>
                    ) : (
                      <p className="text-sm text-amber-600 font-medium">
                        ⚠️ Xaritada joylashuvni bosib belgilang
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar - 1 column */}
              <div className="space-y-6">
                {/* Contact */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Aloqa *</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="font-medium">Telefon *</Label>
                      <Input
                        value={formData.contact_phone}
                        onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                        placeholder="+998 XX XXX XX XX"
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium">Telegram</Label>
                      <Input
                        value={formData.contact_telegram}
                        onChange={(e) => setFormData({ ...formData, contact_telegram: e.target.value })}
                        placeholder="@username"
                        className="h-11"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Salary & Experience - MOVED TO SIDEBAR */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Maosh</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={formData.salary_negotiable}
                        onCheckedChange={(checked) => setFormData({ ...formData, salary_negotiable: checked, salary_min: '', salary_max: '' })}
                      />
                      <Label className="font-medium">Kelishiladi</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-sm text-slate-500">Min</Label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={formData.salary_min ? Number(formData.salary_min).toLocaleString('ru-RU').replace(/,/g, ' ') : ''}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\s/g, '').replace(/\D/g, '');
                            setFormData({ ...formData, salary_min: raw, salary_negotiable: false });
                          }}
                          onFocus={() => formData.salary_negotiable && setFormData({ ...formData, salary_negotiable: false })}
                          placeholder="1 000 000"
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm text-slate-500">Max</Label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={formData.salary_max ? Number(formData.salary_max).toLocaleString('ru-RU').replace(/,/g, ' ') : ''}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\s/g, '').replace(/\D/g, '');
                            setFormData({ ...formData, salary_max: raw, salary_negotiable: false });
                          }}
                          onFocus={() => formData.salary_negotiable && setFormData({ ...formData, salary_negotiable: false })}
                          placeholder="5 000 000"
                          className="h-11"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Education & Experience */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Talablar</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="font-medium">Ta&apos;lim</Label>
                      <Select value={formData.education} onValueChange={(v) => setFormData({ ...formData, education: v })}>
                        <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {EDUCATION_OPTIONS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium">Tajriba</Label>
                      <Select value={formData.experience} onValueChange={(v) => setFormData({ ...formData, experience: v })}>
                        <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {EXPERIENCE_OPTIONS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="font-medium">Yosh chegarasi</Label>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={formData.age_any}
                            onCheckedChange={(checked) => setFormData({ ...formData, age_any: !!checked, age_min: '', age_max: '' })}
                          />
                          <Label className="text-sm text-slate-500">Ahamiyatsiz</Label>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          type="number"
                          value={formData.age_min}
                          onChange={(e) => setFormData({ ...formData, age_min: e.target.value, age_any: false })}
                          onFocus={() => formData.age_any && setFormData({ ...formData, age_any: false })}
                          placeholder="18"
                          className="h-11"
                        />
                        <Input
                          type="number"
                          value={formData.age_max}
                          onChange={(e) => setFormData({ ...formData, age_max: e.target.value, age_any: false })}
                          onFocus={() => formData.age_any && setFormData({ ...formData, age_any: false })}
                          placeholder="45"
                          className="h-11"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Special Categories */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Alohida toifalar</CardTitle>
                    <CardDescription className="text-sm">
                      Vakansiya quyidagi toifalarga mos kelsa belgilang
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={formData.is_for_students}
                        onCheckedChange={(c) => setFormData({ ...formData, is_for_students: !!c })}
                      />
                      <Label className="font-medium">Talaba va bitiruvchilar uchun</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={formData.is_for_disabled}
                        onCheckedChange={(c) => setFormData({ ...formData, is_for_disabled: !!c })}
                      />
                      <Label className="font-medium">Nogironligi bo&apos;lgan shaxslar uchun</Label>
                    </div>

                  </CardContent>
                </Card>

                {/* Status for Edit Page Only */}
                <div className="flex items-center justify-between p-4 bg-white rounded-lg border shadow-sm">
                  <Label className="font-medium">Vakansiya faolligi</Label>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={saving}
                  size="lg"
                  className="w-full h-14 text-lg bg-sky-600 hover:bg-sky-700"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                  Vakansiyani saqlash
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
