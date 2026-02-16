'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, MapPin, ArrowRight, Send, MessageCircle } from '@/components/ui/icons';
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
      totalUsers: (usersResult.count || 0) * 2,
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
    <section className="relative min-h-[560px] lg:min-h-[700px] overflow-hidden flex items-center justify-center pt-32 lg:pt-36 pb-16 -mt-16">
      {/* === PHOTO BACKGROUND === */}
      <div
        className="absolute inset-0 z-0 bg-center bg-cover bg-no-repeat"
        style={{
          backgroundImage: "url('/hero-office.png')",
          filter: 'brightness(0.34) saturate(0.78) contrast(1.12)',
        }}
      />

      {/* === DARK BLUE OVERLAY === */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#07153f]/95 via-[#0c2a64]/91 to-[#14408a]/87 animate-mesh"
          style={{ backgroundSize: '200% 200%' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060f2f]/82 via-[#0a2460]/56 to-[#1a4b9d]/36" />
      </div>

      {/* === FLOATING GLOWING ORBS === */}
      <div className="absolute top-10 right-[10%] w-[300px] h-[300px] bg-blue-500/15 rounded-full blur-[100px] animate-float-slow pointer-events-none" />
      <div className="absolute bottom-5 left-[5%] w-[350px] h-[350px] bg-teal-500/10 rounded-full blur-[120px] animate-float-medium pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] bg-indigo-500/8 rounded-full blur-[80px] animate-float-fast pointer-events-none" />

      {/* === SUBTLE GRID OVERLAY === */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />

      <div className="container mx-auto px-4 relative z-10 w-full">
        <div className="max-w-5xl mx-auto flex flex-col items-center text-center">

          {/* === BADGE === */}
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full glass-card text-blue-200 text-sm font-medium mb-6 animate-glow-pulse">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-400"></span>
              </span>
              {lang === 'uz' ? 'Rasmiy portal' : 'Официальный портал'}
            </span>
          </motion.div>

          {/* === MAIN TITLE === */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="text-3xl md:text-5xl lg:text-6xl font-bold mb-5 tracking-tight text-white leading-[1.15]"
          >
            <span className="block mb-1">
              {lang === 'uz' ? 'Kelajak kasbini' : 'Найдите профессию'}
            </span>
            <span className="gradient-text-blue drop-shadow-sm">
              {lang === 'uz' ? 'biz bilan toping' : 'будущего с нами'}
            </span>
          </motion.h1>

          {/* === SUBTITLE === */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-base md:text-lg text-slate-300/90 mb-10 max-w-2xl font-light leading-relaxed"
          >
            {lang === 'uz' ? (
              <>
                Eng so&apos;nggi vakansiyalar va malakali mutaxassislar bazasi. <br className="hidden md:block" />
                O&apos;z karyerangizni bugun boshlang.
              </>
            ) : (
              'База новейших вакансий и квалифицированных специалистов. Начните свою карьеру сегодня.'
            )}
          </motion.p>

          {/* === SEARCH BOX === */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-4xl glass-card p-2.5 rounded-2xl md:rounded-full shadow-2xl shadow-blue-500/20 mb-10 group hover:shadow-blue-500/30 transition-all duration-500"
          >
            <form onSubmit={handleSearch} className="flex flex-col md:flex-row items-center gap-2">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.hero.searchPlaceholder}
                  className="pl-14 h-12 md:h-14 w-full border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-400 text-white text-base"
                />
              </div>

              <div className="hidden md:block w-px h-7 bg-white/10" />

              <div className="relative w-full md:w-[260px]">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <MapPin className="w-5 h-5 text-slate-400" />
                </div>
                <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                  <SelectTrigger className="pl-14 pr-10 h-12 md:h-14 border-0 bg-transparent focus:ring-0 text-left text-base text-slate-300 font-medium hover:bg-white/5 transition-colors">
                    <SelectValue placeholder={lang === 'uz' ? 'Viloyatni tanlang' : 'Выберите регион'} />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900/95 backdrop-blur-xl border-white/10 text-slate-200">
                    <SelectItem value="all">{lang === 'uz' ? 'Barcha viloyatlar' : 'Все регионы'}</SelectItem>
                    {regions.map((r) => (
                      <SelectItem key={r.id} value={r.id.toString()}>
                        {lang === 'uz' ? r.name_uz : r.name_ru}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full md:w-auto h-12 md:h-14 px-8 rounded-xl md:rounded-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-bold text-base shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 hover:scale-[1.02]"
              >
                {lang === 'uz' ? 'Qidirish' : 'Поиск'}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </form>
          </motion.div>

          {/* === QUICK ACTIONS === */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="flex flex-wrap items-center justify-center gap-3 mb-10"
          >
            {/* Telegram bot — with YANGI corner badge */}
            <Link href="https://t.me/ishdasiz_bot" target="_blank" rel="noopener noreferrer" className="group relative">
              <Button className="h-10 px-5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border border-blue-400/20 text-white font-medium transition-all duration-300 shadow-lg shadow-blue-600/20 group-hover:shadow-blue-500/30 group-hover:scale-105">
                <MessageCircle className="w-4 h-4 mr-2" />
                {lang === 'uz' ? 'Telegram bot' : 'Telegram бот'}
              </Button>
              {/* Superscript "YANGI" badge */}
              <span className="absolute -top-1.5 -right-1.5 px-2 py-0.5 text-[9px] font-extrabold uppercase text-white rounded-md animate-badge-sweep leading-none shadow-lg shadow-blue-600/30 z-10 tracking-wide">
                YANGI
              </span>
            </Link>

            {/* Map search — green */}
            <Link href="/map">
              <Button className="h-10 px-5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border border-emerald-400/20 text-white font-medium transition-all duration-300 shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/30 hover:scale-105">
                <MapPin className="w-4 h-4 mr-2" />
                {lang === 'uz' ? 'Xaritada izlash' : 'Поиск на карте'}
              </Button>
            </Link>
          </motion.div>

          {/* === STATS — white text, no borders, clean === */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="grid grid-cols-3 gap-6 md:gap-10 w-full max-w-2xl"
          >
            {[
              { value: stats.totalJobs, label: lang === 'uz' ? 'Vakansiyalar' : 'Вакансии' },
              { value: stats.totalResumes, label: lang === 'uz' ? 'Rezyumelar' : 'Резюме' },
              { value: stats.totalUsers, label: lang === 'uz' ? 'Foydalanuvchilar' : 'Пользователи' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 + i * 0.08 }}
                className="text-center"
              >
                <span className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-1 flex items-center justify-center">
                  <FlipCounter value={stat.value} suffix="+" />
                </span>
                <span className="text-white/50 text-[10px] md:text-xs uppercase tracking-widest font-medium">
                  {stat.label}
                </span>
              </motion.div>
            ))}
          </motion.div>

        </div>
      </div>
    </section>
  );
}
