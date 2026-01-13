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
} from '@/components/ui/icons';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
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
};

interface CategoriesSectionProps {
  categories: Category[];
  jobCounts: Record<string, number>;
}

export function CategoriesSection({ categories, jobCounts }: CategoriesSectionProps) {
  const { lang } = useLanguage();

  return (
    <section className="py-12 bg-white">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 font-display">
          {lang === 'uz' ? 'Yo\'nalishlar bo\'yicha' : 'По направлениям'}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {categories.map((category) => {
            const IconComponent = iconMap[category.icon] || Briefcase;
            const count = jobCounts[category.id] || 0;

            return (
              <Link
                key={category.id}
                href={`/jobs?category=${category.id}`}
                className="group block"
              >
                <div className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition-all hover:border-blue-300 hover:-translate-y-1">
                  <div className="w-14 h-14 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white shadow-sm transition-all duration-300">
                    <IconComponent className="w-7 h-7" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-base text-slate-900 group-hover:text-indigo-600 transition-colors truncate mb-1">
                      {lang === 'uz' ? category.name_uz : category.name_ru}
                    </h3>
                    <p className="text-sm text-slate-500 font-medium">
                      {lang === 'uz' ? 'Vakansiyalar' : 'Вакансии'}: <span className="text-indigo-600 group-hover:text-indigo-700">{count}</span>
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
