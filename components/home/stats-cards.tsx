'use client';

import { useLanguage } from '@/contexts/language-context';
import { Briefcase, FileText, Users, CheckCircle, Send, BarChart } from '@/components/ui/icons';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, useInView } from 'framer-motion';
import { AnimatedCounter } from './animated-counter';

interface Stats {
    totalJobs: number;
    totalResumes: number;
    totalUsers: number;
    hiredCount: number;
    totalApplications: number;
}

export function StatsCards() {
    const { lang } = useLanguage();
    const [stats, setStats] = useState<Stats>({
        totalJobs: 0,
        totalResumes: 0,
        totalUsers: 0,
        hiredCount: 0,
        totalApplications: 0
    });
    const containerRef = useRef(null);
    const isInView = useInView(containerRef, { once: true, margin: "-100px" });

    useEffect(() => {
        const fetchStats = async () => {
            // Parallel requests for speed
            const [jobs, resumes, employers, jobSeekers, hired, applications] = await Promise.all([
                supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('is_active', true),
                supabase.from('resumes').select('id', { count: 'exact', head: true }),
                supabase.from('employer_profiles').select('id', { count: 'exact', head: true }),
                supabase.from('job_seeker_profiles').select('id', { count: 'exact', head: true }),
                supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'filled'),
                supabase.from('job_applications').select('id', { count: 'exact', head: true })
            ]);

            // Total users = employer profiles + job seeker profiles
            const totalUsers = (employers.count || 0) + (jobSeekers.count || 0);

            setStats({
                totalJobs: jobs.count || 0,
                totalResumes: resumes.count || 0,
                totalUsers: totalUsers,
                hiredCount: hired.count || 0,
                totalApplications: applications.count || 0
            });
        };

        fetchStats();
    }, []);

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    const cardClass = "rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 p-6 flex flex-col items-center text-center group";

    return (
        <section className="py-16 bg-slate-50/50 container mx-auto px-4" ref={containerRef}>
            <div className="flex flex-col items-center mb-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white mb-4 shadow-lg shadow-blue-500/20">
                    <BarChart className="w-6 h-6" />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
                    {lang === 'uz' ? 'Platforma ko\'rsatkichlari' : 'Статистика платформы'}
                </h2>
                <p className="text-slate-500 max-w-lg">
                    {lang === 'uz' ? 'ISHDASIZ - minglab insonlarni ish bilan ta\'minlayotgan ishonchli portal' : 'ISHDASIZ — надежный портал, обеспечивающий работой тысячи людей'}
                </p>
            </div>

            <motion.div
                variants={container}
                initial="hidden"
                animate={isInView ? "show" : "hidden"}
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6"
            >
                {/* Total Jobs */}
                <motion.div variants={item} className={cardClass}>
                    <div className="w-14 h-14 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Briefcase className="w-7 h-7" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 mb-1 flex items-center justify-center gap-0.5">
                        <AnimatedCounter end={stats.totalJobs} />
                    </div>
                    <p className="text-sm font-medium text-slate-500">
                        {lang === 'uz' ? 'Vakansiyalar' : 'Вакансий'}
                    </p>
                </motion.div>

                {/* Resumes */}
                <motion.div variants={item} className={cardClass}>
                    <div className="w-14 h-14 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <FileText className="w-7 h-7" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 mb-1 flex items-center justify-center gap-0.5">
                        <AnimatedCounter end={stats.totalResumes} />
                    </div>
                    <p className="text-sm font-medium text-slate-500">
                        {lang === 'uz' ? 'Rezyumelar' : 'Резюме'}
                    </p>
                </motion.div>

                {/* Users */}
                <motion.div variants={item} className={cardClass}>
                    <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Users className="w-7 h-7" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 mb-1 flex items-center justify-center gap-0.5">
                        <AnimatedCounter end={stats.totalUsers} />
                    </div>
                    <p className="text-sm font-medium text-slate-500">
                        {lang === 'uz' ? 'Foydalanuvchilar' : 'Пользователей'}
                    </p>
                </motion.div>

                {/* Applications */}
                <motion.div variants={item} className={cardClass}>
                    <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Send className="w-7 h-7" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 mb-1 flex items-center justify-center gap-0.5">
                        <AnimatedCounter end={stats.totalApplications} />
                    </div>
                    <p className="text-sm font-medium text-slate-500">
                        {lang === 'uz' ? 'Arizalar' : 'Заявки'}
                    </p>
                </motion.div>

                {/* Hired */}
                <motion.div variants={item} className={cardClass}>
                    <div className="w-14 h-14 rounded-full bg-green-50 text-green-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <CheckCircle className="w-7 h-7" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 mb-1 flex items-center justify-center gap-0.5">
                        <AnimatedCounter end={stats.hiredCount} />
                    </div>
                    <p className="text-sm font-medium text-slate-500">
                        {lang === 'uz' ? 'Ishga kirganlar' : 'Трудоустроено'}
                    </p>
                </motion.div>

            </motion.div>
        </section>
    );
}
