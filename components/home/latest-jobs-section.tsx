'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';
import { Button } from '@/components/ui/button';
import { JobCard } from '@/components/jobs/job-card';
import { JobWithRelations } from '@/types/database';
import { ArrowRight, Briefcase } from '@/components/ui/icons';
import { motion } from 'framer-motion';

interface LatestJobsSectionProps {
  jobs: JobWithRelations[];
}

export function LatestJobsSection({ jobs }: LatestJobsSectionProps) {
  const { lang } = useLanguage();

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.15 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 25, scale: 0.97 },
    show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } }
  };

  return (
    <section className="py-10 md:py-14 relative overflow-hidden">
      {/* Dot grid pattern background */}
      <div className="absolute inset-0 dot-grid-pattern opacity-20" />

      {/* Floating decorative blurs */}
      <div className="absolute top-20 left-[5%] w-[280px] h-[280px] bg-blue-100/20 rounded-full blur-[100px] pointer-events-none animate-float-slow" />
      <div className="absolute bottom-10 right-[8%] w-[230px] h-[230px] bg-teal-100/15 rounded-full blur-[90px] pointer-events-none animate-float-medium" />

      <div className="container mx-auto px-4 relative">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex items-end justify-between mb-8"
        >
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Briefcase className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                {lang === 'uz' ? 'So\'nggi vakansiyalar' : 'Последние вакансии'}
              </h2>
            </div>
            <p className="text-sm text-slate-500 ml-[52px]">
              {lang === 'uz' ? 'Eng yangi ish o\'rinlari' : 'Самые свежие рабочие места'}
            </p>
          </div>
          <Link href="/jobs" className="hidden sm:block">
            <Button variant="outline" className="border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 text-slate-700 hover:text-blue-600 transition-all duration-300 rounded-xl px-6 font-semibold group">
              {lang === 'uz' ? 'Barcha vakansiyalar' : 'Все вакансии'}
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </Link>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-50px" }}
          className="grid gap-4 md:gap-5 md:grid-cols-2 lg:grid-cols-3"
        >
          {jobs.map((job) => (
            <motion.div key={job.id} variants={item}>
              <JobCard job={job} />
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-9 text-center sm:hidden"
        >
          <Link href="/jobs">
            <Button variant="outline" className="w-full max-w-xs border-slate-300 hover:border-blue-400 rounded-xl font-semibold">
              {lang === 'uz' ? 'Barcha vakansiyalar' : 'Все вакансии'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
