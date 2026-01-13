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
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <section className="py-16 md:py-20 bg-white border-b border-slate-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
                {lang === 'uz' ? 'So\'nggi vakansiyalar' : 'Последние вакансии'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {lang === 'uz'
                  ? 'Eng yangi va dolzarb ish o\'rinlari'
                  : 'Самые новые и актуальные вакансии'
                }
              </p>
            </div>
          </div>
          <Link href="/jobs" className="hidden sm:block">
            <Button variant="outline" className="border-slate-300 hover:bg-slate-50">
              {lang === 'uz' ? 'Barcha vakansiyalar' : 'Все вакансии'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-50px" }}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-2"
        >
          {jobs.map((job) => (
            <motion.div key={job.id} variants={item}>
              <JobCard job={job} />
            </motion.div>
          ))}
        </motion.div>

        <div className="mt-10 text-center sm:hidden">
          <Link href="/jobs">
            <Button variant="outline" className="w-full max-w-xs border-slate-300 hover:bg-slate-50">
              {lang === 'uz' ? 'Barcha vakansiyalar' : 'Все вакансии'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
