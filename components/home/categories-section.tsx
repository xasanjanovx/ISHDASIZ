'use client';


import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';
import { Category } from '@/types/database';
import {
  Monitor,
  GraduationCap,
  Heart,
  Building2,
  Wheat,
  Factory,
  ShoppingBag,
  Truck,
  Wallet,
  Plane,
  Wrench,
  Landmark,
  Briefcase,
  ArrowRight,
} from '@/components/ui/icons';
import { motion } from 'framer-motion';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Monitor, GraduationCap, Heart, Building2, Wheat, Factory,
  ShoppingBag, Truck, Wallet, Plane, Wrench, Landmark, Briefcase,
};

// Sophisticated accent palette per card
const accentColors = [
  { gradient: 'from-blue-500/10 to-blue-600/5', icon: 'bg-blue-500/15 text-blue-600', hover: 'hover:border-blue-400/40 hover:shadow-blue-500/8', count: 'text-blue-600' },
  { gradient: 'from-teal-500/10 to-teal-600/5', icon: 'bg-teal-500/15 text-teal-600', hover: 'hover:border-teal-400/40 hover:shadow-teal-500/8', count: 'text-teal-600' },
  { gradient: 'from-indigo-500/10 to-indigo-600/5', icon: 'bg-indigo-500/15 text-indigo-600', hover: 'hover:border-indigo-400/40 hover:shadow-indigo-500/8', count: 'text-indigo-600' },
  { gradient: 'from-violet-500/10 to-violet-600/5', icon: 'bg-violet-500/15 text-violet-600', hover: 'hover:border-violet-400/40 hover:shadow-violet-500/8', count: 'text-violet-600' },
  { gradient: 'from-rose-500/10 to-rose-600/5', icon: 'bg-rose-500/15 text-rose-600', hover: 'hover:border-rose-400/40 hover:shadow-rose-500/8', count: 'text-rose-600' },
  { gradient: 'from-cyan-500/10 to-cyan-600/5', icon: 'bg-cyan-500/15 text-cyan-600', hover: 'hover:border-cyan-400/40 hover:shadow-cyan-500/8', count: 'text-cyan-600' },
];

interface CategoriesSectionProps {
  categories: Category[];
  jobCounts: Record<string, number>;
}

export function CategoriesSection({ categories, jobCounts }: CategoriesSectionProps) {
  const { lang } = useLanguage();


  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.06, delayChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 18, scale: 0.96 },
    show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const } }
  };

  return (
    <section className="py-16 md:py-20 bg-gradient-to-b from-white to-slate-50/80 relative overflow-hidden">
      {/* Subtle background decoration */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-blue-50 to-transparent rounded-full blur-[120px] opacity-50 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-teal-50 to-transparent rounded-full blur-[100px] opacity-40 pointer-events-none" />

      <div className="container mx-auto px-4 relative">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-end justify-between mb-10"
        >
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                {lang === 'uz' ? 'Yo\'nalishlar' : 'Направления'}
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              {lang === 'uz' ? 'Soha bo\'yicha vakansiyalar' : 'Вакансии по отраслям'}
            </h2>
            <div className="h-1 w-14 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full mt-3" />
          </div>

        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4"
        >
          {categories.map((category, index) => {
            const IconComponent = iconMap[category.icon] || Briefcase;
            const count = jobCounts[category.id] || 0;
            const accent = accentColors[index % accentColors.length];

            return (
              <motion.div key={category.id} variants={item}>
                <Link
                  href={`/jobs?category=${category.id}`}
                  className={`group relative flex flex-col p-4 md:p-5 rounded-xl border border-slate-200/80 bg-white transition-all duration-300 hover:shadow-xl ${accent.hover} hover:-translate-y-1`}
                >
                  {/* Gradient background on hover */}
                  <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${accent.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

                  <div className="relative flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl ${accent.icon} flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className={`${accent.count} text-lg font-bold`}>
                      {count}
                      <span className="text-slate-400 text-xs ml-0.5 font-medium">{lang === 'uz' ? ' ta' : ' шт'}</span>
                    </div>
                  </div>

                  <div className="relative flex-1 min-w-0">
                    <span className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug group-hover:text-slate-900 transition-colors">
                      {lang === 'uz' ? category.name_uz : category.name_ru}
                    </span>
                  </div>

                  {/* Arrow */}
                  <div className="relative mt-3 flex items-center">
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-1 transition-all duration-300" />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
