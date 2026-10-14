"use client";
import Link from "next/link";
import {
  GraduationCap,
  Accessibility,
  Users,
  ArrowUpRight,
} from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
interface Props {
  counts: {
    students: number | null;
    disabled: number | null;
    women: number | null;
  };
}
export function SpecialCategoriesSection({ counts }: Props) {
  const { lang } = useLanguage();
  const ru = lang === "ru";
  const categories = [
    {
      id: "students",
      icon: GraduationCap,
      count: counts.students,
      title: ru ? "Студентам и выпускникам" : "Talaba va bitiruvchilarga",
    },
    {
      id: "disabled",
      icon: Accessibility,
      count: counts.disabled,
      title: ru ? "Людям с инвалидностью" : "Nogironligi bor shaxslarga",
    },
    {
      id: "women",
      icon: Users,
      count: counts.women,
      title: ru ? "Работа для женщин" : "Ayollar uchun ish",
    },
  ];
  return (
    <section className="home-opportunities">
      <div className="home-shell home-section">
        <div className="home-section-heading">
          <div>
            <span className="home-eyebrow">
              {ru ? "КАЖДЫЙ МОЖЕТ НАЧАТЬ" : "HAR KIM BOSHLASHI MUMKIN"}
            </span>
            <h2>
              {ru ? "Возможности для каждого" : "Har bir inson uchun imkoniyat"}
            </h2>
          </div>
        </div>
        <div className="home-opportunities-grid">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/jobs?special=${cat.id}`}
              className="home-opportunity"
            >
              <cat.icon size={26} />
              <h3>{cat.title}</h3>
              <div>
                <span>
                  {cat.count == null ? "—" : cat.count.toLocaleString("ru-RU")}{" "}
                  {ru ? "вакансий" : "ta vakansiya"}
                </span>
                <ArrowUpRight size={19} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
