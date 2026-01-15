'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/contexts/language-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Sparkles, MapPin, Briefcase, Eye, Users, ArrowRight } from '@/components/ui/icons';
import { FlipCounter } from '@/components/ui/flip-counter';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Stats {
  totalJobs: number;
  totalResumes: number;
  totalUsers: number;
}

interface Region {
  id: number;
  name_uz: string;
  name_ru: string;
}

export function HeroSection() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [regions, setRegions] = useState<Region[]>([]);
  const [stats, setStats] = useState<Stats>({ totalJobs: 0, totalResumes: 0, totalUsers: 0 });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Fetch regions
    supabase.from('regions').select('*').order('name_uz').then(({ data }) => {
      if (data) setRegions(data);
    });
  }, []);

  const trackVisitor = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const sessionId = sessionStorage.getItem('visitor_session_id') || crypto.randomUUID();
    sessionStorage.setItem('visitor_session_id', sessionId);

    const lastVisit = localStorage.getItem('last_visit');
    const now = new Date().getTime();

    if (!lastVisit || now - parseInt(lastVisit) > 30 * 60 * 1000) {
      await supabase.from('site_visitors').insert({
        session_id: sessionId,
        visited_at: new Date().toISOString(),
      });
      localStorage.setItem('last_visit', now.toString());
    }
  }, []);

  const fetchStats = useCallback(async () => {
    const [jobsResult, resumesResult, usersResult] = await Promise.all([
      supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('resumes').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id', { count: 'exact', head: true }),
    ]);

    setStats({
      totalJobs: jobsResult.count || 0,
      totalResumes: resumesResult.count || 0,
      totalUsers: (usersResult.count || 0) * 2, // Account for multiple profiles per user as requested
    });
  }, []);

  useEffect(() => {
    if (isMounted) {
      trackVisitor();
      fetchStats();
    }
  }, [isMounted, trackVisitor, fetchStats]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery);
    if (selectedRegion && selectedRegion !== 'all') params.set('region', selectedRegion);

    router.push(`/jobs?${params.toString()}`);
  };

  return (
    <section className="relative min-h-[450px] lg:min-h-[600px] overflow-hidden flex items-center justify-center pt-28 lg:pt-36 pb-12 -mt-16">
      {/* 1. Background Photo - Absolute to Hero Only (Scrolls away) */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[url('/hero-office.png')] bg-cover bg-center bg-no-repeat" />
        {/* 2. Dark Overlay (Blue-ish dark) */}
        <div className="absolute inset-0 bg-slate-900/80 bg-gradient-to-t from-slate-900 via-slate-900/70 to-slate-900/60" />

        {/* 3. Blue Glow Effects (No Purple) */}
        <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-sky-600/10 rounded-full blur-[100px] pointer-events-none" />
      </div>

      {/* Smooth Fade REMOVED as requested */}


      <div className="container mx-auto px-4 relative z-10 w-full mb-8">
        <div className="max-w-5xl mx-auto flex flex-col items-center text-center">

          {/* Badge - Restored Old "Rasmiy Portal" Style */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-400/30 bg-blue-500/10 text-blue-200 text-sm font-medium mb-5 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              {lang === 'uz' || lang === 'uzCyrillic' ? "Rasmiy portal" : "Официальный портал"}
            </span>
          </motion.div>

          {/* Main Title - Blue Gradient */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-7xl font-bold mb-5 tracking-tight text-white"
          >
            <span className="block mb-1">
              {lang === 'uz' || lang === 'uzCyrillic' ? "Kelajak kasbini" : "Найдите профессию"}
            </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-300 via-blue-300 to-indigo-300 drop-shadow-sm">
              {lang === 'uz' || lang === 'uzCyrillic' ? "biz bilan toping" : "будущего вместе с нами"}
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-blue-100/90 mb-8 max-w-2xl font-light leading-relaxed"
          >
            {lang === 'uz' || lang === 'uzCyrillic' ? (
              <>
                Eng so'nggi vakansiyalar va malakali mutaxassislar bazasi. <br className="hidden md:block" />
                O'z karyerangizni bugun boshlang.
              </>
            ) : (
              'База новейших вакансий и квалифицированных специалистов. Начните свою карьеру сегодня.'
            )}
          </motion.p>

          {/* Search Box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="w-full max-w-4xl bg-white/10 backdrop-blur-xl p-2 rounded-2xl md:rounded-full shadow-2xl shadow-blue-900/20 border border-white/20 mb-8 group hover:border-white/30 transition-all duration-300"
          >
            <form onSubmit={handleSearch} className="flex flex-col md:flex-row items-center gap-2">
              {/* Keyword Input */}
              <div className="relative flex-1 w-full">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-blue-300 transition-colors" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.hero.searchPlaceholder}
                  className="pl-14 h-14 md:h-14 w-full border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-300 text-white text-base"
                />
              </div>

              <div className="hidden md:block w-px h-8 bg-white/10" />

              {/* Region Select */}
              <div className="relative w-full md:w-[280px]">
                <div className="absolute left-6 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <MapPin className="w-5 h-5 text-slate-300" />
                </div>
                <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                  <SelectTrigger className="pl-14 h-14 md:h-14 border-0 bg-transparent focus:ring-0 text-left text-base text-slate-200 font-medium hover:bg-white/5 transition-colors">
                    <SelectValue placeholder={lang === 'uz' ? 'Viloyatni tanlang' : 'Выберите регион'} />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10 text-slate-200">
                    <SelectItem value="all">{lang === 'uz' ? 'Barcha viloyatlar' : 'Все регионы'}</SelectItem>
                    {regions.map((r) => (
                      <SelectItem key={r.id} value={r.id.toString()}>
                        {lang === 'uz' ? r.name_uz : r.name_ru}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search Button - Light White/Blue Button (Requested "Light buttons") */}
              <Button
                type="submit"
                size="lg"
                className="w-full md:w-auto h-12 md:h-14 px-8 rounded-xl md:rounded-full bg-white hover:bg-blue-50 text-blue-600 font-bold text-base shadow-lg hover:shadow-white/20 transition-all duration-300"
              >
                {lang === 'uz' || lang === 'uzCyrillic' ? 'Qidirish' : 'Поиск'}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </form>
          </motion.div>

          {/* Quick Actions - Lighter/Ghost */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="flex flex-wrap items-center justify-center gap-4 mb-16"
          >
            <Link href="/ai-search">
              <Button className="h-10 px-6 rounded-full bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-100 font-medium transition-all shadow-lg backdrop-blur-sm">
                <Image src="/ai-sparkle.png" alt="AI" width={16} height={16} className="w-4 h-4 mr-2" />
                {lang === 'uz' || lang === 'uzCyrillic' ? 'AI Yordamchi' : 'ИИ Помощник'}
              </Button>
            </Link>

            <Link href="/map">
              <Button className="h-10 px-6 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-100 font-medium transition-all shadow-lg backdrop-blur-sm">
                <MapPin className="w-4 h-4 mr-2 text-emerald-200" />
                {lang === 'uz' || lang === 'uzCyrillic' ? 'Xaritada izlash' : 'Поиск на карте'}
              </Button>
            </Link>
          </motion.div>

          {/* Stats - Blue Accents & "Foydalanuvchilar" Correction */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 w-full max-w-3xl border-t border-white/10 pt-6"
          >
            {/* Vakansiyalar */}
            <div className="flex flex-col items-center">
              <span className="text-3xl lg:text-4xl font-bold text-white mb-1 flex items-center justify-center">
                <FlipCounter value={stats.totalJobs} suffix="+" />
              </span>
              <span className="text-blue-200/60 text-xs uppercase tracking-wider font-medium">
                {lang === 'uz' ? 'Vakansiyalar' : 'Вакансии'}
              </span>
            </div>

            {/* Rezyumelar */}
            <div className="flex flex-col items-center">
              <span className="text-3xl lg:text-4xl font-bold text-white mb-1 flex items-center justify-center">
                <FlipCounter value={stats.totalResumes} suffix="+" />
              </span>
              <span className="text-blue-200/60 text-xs uppercase tracking-wider font-medium">
                {lang === 'uz' ? 'Rezyumelar' : 'Резюме'}
              </span>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-3xl lg:text-4xl font-bold text-white mb-1 flex items-center justify-center">
                <FlipCounter value={stats.totalUsers} suffix="+" />
              </span>
              <span className="text-blue-200/60 text-xs uppercase tracking-wider font-medium">
                {/* Changed to Foydalanuvchilar */}
                {lang === 'uz' ? 'Foydalanuvchilar' : 'Пользователи'}
              </span>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
