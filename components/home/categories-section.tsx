"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  Briefcase,
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
} from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
import type { Category } from "@/types/database";
const icons: Record<string, React.ComponentType<{ size?: number }>> = {
  Briefcase,
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
};
export function CategoriesSection({
  categories,
  jobCounts,
}: {
  categories: Category[];
  jobCounts: Record<string, number | null>;
}) {
  const { lang } = useLanguage();
  const ru = lang === "ru";
  return (
    <section className="home-categories-wrap">
      <div className="home-shell home-section">
        <div className="home-section-heading">
          <div>
            <span className="home-eyebrow">
              {ru ? "НАЙДИТЕ СВОЁ НАПРАВЛЕНИЕ" : "O‘Z YO‘NALISHINGIZNI TOPING"}
            </span>
            <h2>
              {ru
                ? "В какой сфере хотите работать?"
                : "Qaysi sohada ishlamoqchisiz?"}
            </h2>
          </div>
        </div>
        <div className="home-category-grid">
          {categories.map((category) => {
            const Icon = icons[category.icon] || Briefcase;
            const count = jobCounts[category.id];
            return (
              <Link
                key={category.id}
                href={`/jobs?category=${category.id}`}
                className="home-category"
              >
                <span className="home-category-icon">
                  <Icon size={21} />
                </span>
                <div>
                  <h3>
                    {ru
                      ? category.name_ru || category.name_uz
                      : category.name_uz}
                  </h3>
                  <span>
                    {count == null ? "—" : count.toLocaleString("ru-RU")}{" "}
                    {ru ? "вакансий" : "ta vakansiya"}
                  </span>
                </div>
                <ArrowUpRight size={16} />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
