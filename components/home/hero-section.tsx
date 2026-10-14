"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Search,
  MapPin,
  ArrowUpRight,
  ArrowRight,
  Briefcase,
  FileText,
} from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
interface HeroProps {
  regions?: { id: number; name_uz: string; name_ru: string }[];
  stats?: {
    totalJobs: number | null;
    totalResumes: number | null;
    totalEmployers?: number | null;
  };
}
export function HeroSection({ regions = [], stats }: HeroProps) {
  const { lang } = useLanguage();
  const ru = lang === "ru";
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("all");
  const number = (value?: number | null) =>
    value == null ? "—" : value.toLocaleString("ru-RU").replace(/\u00a0/g, " ");
  const search = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (region !== "all") params.set("region", region);
    router.push(params.size ? `/jobs?${params}` : "/jobs");
  };
  return (
    <section className="home-hero">
      <div className="home-hero-art">
        <Image
          src="/hero-career-portal.webp"
          alt={
            ru
              ? "Объёмный светящийся портал к новым карьерным возможностям"
              : "Yangi karyera imkoniyatlari sari yorqin uch o‘lchamli portal"
          }
          fill
          preload
          sizes="100vw"
          className="home-hero-photo"
        />
      </div>
      <div className="home-shell home-hero-grid">
        <div className="home-hero-copy">
          <div className="home-eyebrow">
            <span className="home-status-dot" />
            {ru
              ? "Ваша карьера начинается здесь"
              : "Karyerangiz shu yerdan boshlanadi"}
          </div>
          <h1>
            {ru ? "Ваша работа." : "Sizga mos ish."}
            <br />
            <span>{ru ? "Новое будущее." : "Yangi kelajak."}</span>
          </h1>
          <p className="home-hero-description">
            {ru
              ? "Найдите свою работу по всему Узбекистану. По вашим навыкам, в вашем городе, в вашем ритме."
              : "Butun O‘zbekiston bo‘ylab o‘zingizga mos ishni toping. Ko‘nikmalaringiz, hududingiz va hayot tarzingizga mos."}
          </p>
          <form onSubmit={search} className="home-search">
            <div className="home-search-query">
              <Search size={20} />
              <label htmlFor="home-search" className="sr-only">
                {ru ? "Профессия или компания" : "Kasb yoki kompaniya"}
              </label>
              <input
                id="home-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  ru ? "Кем хотите работать?" : "Qaysi kasbni qidiryapsiz?"
                }
              />
            </div>
            <div className="home-search-bottom">
              <div className="home-search-region">
                <MapPin size={18} />
                <label htmlFor="home-region" className="sr-only">
                  {ru ? "Регион" : "Hudud"}
                </label>
                <select
                  id="home-region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                >
                  <option value="all">
                    {ru ? "Весь Узбекистан" : "Butun O‘zbekiston"}
                  </option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {ru ? r.name_ru || r.name_uz : r.name_uz}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="home-button">
                {ru ? "Найти работу" : "Ish topish"}
                <ArrowRight size={18} />
              </button>
            </div>
          </form>
          <div className="home-popular">
            <span>{ru ? "Популярно:" : "Ommabop:"}</span>
            {(ru
              ? ["Продавец", "Водитель", "Бухгалтер"]
              : ["Sotuvchi", "Haydovchi", "Buxgalter"]
            ).map((term) => (
              <Link key={term} href={`/jobs?q=${encodeURIComponent(term)}`}>
                {term}
              </Link>
            ))}
          </div>
          <Link href="/map" className="home-map-link">
            <MapPin size={16} />
            {ru ? "Посмотреть вакансии на карте" : "Xaritadan ish topish"}
            <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="home-hero-scene">
          <div className="home-photo-frame" aria-hidden="true" />
          <div className="home-float-card home-float-jobs">
            <div className="home-float-icon">
              <Briefcase size={21} />
            </div>
            <div>
              <strong>{number(stats?.totalJobs)}</strong>
              <span>{ru ? "Открытые вакансии" : "Ochiq vakansiyalar"}</span>
            </div>
            <ArrowUpRight size={18} />
          </div>
          <Link href="/resumes" className="home-float-card home-float-people">
            <div className="home-float-icon mint">
              <FileText size={21} />
            </div>
            <div>
              <strong>{number(stats?.totalResumes)}</strong>
              <span>
                {ru ? "Резюме соискателей" : "Ish izlovchilar rezyumelari"}
              </span>
            </div>
            <ArrowUpRight size={18} />
          </Link>
          <div className="home-scene-label">
            <span className="home-status-dot" />
            {ru ? "Один поиск. Вся страна." : "Bir qidiruv. Butun mamlakat."}
          </div>
        </div>
      </div>
    </section>
  );
}
