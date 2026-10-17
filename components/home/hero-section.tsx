"use client";
import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import {
  Search,
  MapPin,
  ArrowUpRight,
  ArrowRight,
} from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
import { BenefitsTicker } from "./benefits-ticker";
import { HeroTelegramLink } from "./hero-telegram-link";
import { displayedUsers } from "@/lib/display-counts";
import { useHomeStatistics } from "@/hooks/use-home-statistics";
import styles from "./hero-section.module.css";
interface HeroProps {
  regions?: { id: number; name_uz: string; name_ru: string }[];
  stats?: {
    totalJobs: number | null;
    totalUsers: number | null;
    archivedJobs: number | null;
    totalEmployers?: number | null;
  };
}
const professionals = [
  "/profession-teacher-formal.webp",
  "/profession-builder.webp",
  "/profession-doctor.webp",
  "/profession-programmer.webp",
  "/profession-chef.webp",
  "/profession-tailor-v1.webp",
  "/profession-driver-v1.webp",
  "/profession-salesperson-v1.webp",
];
export function HeroSection({ regions = [], stats }: HeroProps) {
  const currentStats = useHomeStatistics(stats);
  const { lang } = useLanguage();
  const ru = lang === "ru";
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("all");
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const playing = !reducedMotion && !hovered && !focused;
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(
      () => setActive((value) => (value + 1) % professionals.length),
      7000,
    );
    return () => clearTimeout(timer);
  }, [playing, active]);
  const users = displayedUsers(currentStats?.totalUsers);
  const number = (value?: number | null) =>
    value == null ? "—" : value.toLocaleString("ru-RU").replace(/\u00a0/g, " ");
  const allJobs = currentStats?.totalJobs != null && currentStats?.archivedJobs != null
    && Number.isSafeInteger(currentStats.totalJobs + currentStats.archivedJobs)
    ? currentStats.totalJobs + currentStats.archivedJobs : null;
  const search = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (region !== "all") params.set("region", region);
    router.push(params.size ? `/jobs?${params}` : "/jobs");
  };
  const scenes = ru
    ? [
        {
          name: "Учитель",
          action: "Вакансии в образовании",
          category: "a0000004-0004-4000-8000-000000000004",
        },
        {
          name: "Строитель",
          action: "Вакансии в строительстве",
          category: "a0000007-0007-4000-8000-000000000007",
        },
        {
          name: "Врач",
          action: "Вакансии в медицине",
          category: "a0000005-0005-4000-8000-000000000005",
        },
        {
          name: "Программист",
          action: "Вакансии в IT",
          category: "a0000001-0001-4000-8000-000000000001",
        },
        {
          name: "Повар",
          action: "Вакансии повара",
          category: "a0000003-0003-4000-8000-000000000003",
          query: "oshpaz",
        },
        { name: "Швея", action: "Вакансии швеи", category: "", query: "tikuvchi" },
        { name: "Водитель", action: "Вакансии водителя", category: "", query: "haydovchi" },
        { name: "Продавец", action: "Вакансии продавца", category: "", query: "sotuvchi" },
      ]
    : [
        {
          name: "O‘qituvchi",
          action: "Ta’limdagi vakansiyalar",
          category: "a0000004-0004-4000-8000-000000000004",
        },
        {
          name: "Quruvchi",
          action: "Qurilishdagi vakansiyalar",
          category: "a0000007-0007-4000-8000-000000000007",
        },
        {
          name: "Shifokor",
          action: "Tibbiyotdagi vakansiyalar",
          category: "a0000005-0005-4000-8000-000000000005",
        },
        {
          name: "Dasturchi",
          action: "IT vakansiyalari",
          category: "a0000001-0001-4000-8000-000000000001",
        },
        {
          name: "Oshpaz",
          action: "Oshpaz vakansiyalari",
          category: "a0000003-0003-4000-8000-000000000003",
          query: "oshpaz",
        },
        { name: "Tikuvchi", action: "Tikuvchi vakansiyalari", category: "", query: "tikuvchi" },
        { name: "Haydovchi", action: "Haydovchi vakansiyalari", category: "", query: "haydovchi" },
        { name: "Sotuvchi", action: "Sotuvchi vakansiyalari", category: "", query: "sotuvchi" },
      ];
  const scene = scenes[active];
  const professionParams = new URLSearchParams();
  if (scene.category) professionParams.set("category", scene.category);
  if (scene.query) professionParams.set("q", scene.query);
  if (region !== "all") professionParams.set("region", region);
  return (
    <section id="home-top" className={`poster-hero ${styles.hero}`} data-playing={playing} data-motion="system" data-profession={active}>
      <BenefitsTicker />
      <div className={`home-shell ${styles.stage}`}>
        <div className={styles.content}>
          <div className={styles.intro}>
            <span className={styles.eyebrow}>{ru ? "ВАШ СЛЕДУЮЩИЙ ШАГ" : "SIZNING KEYINGI QADAMINGIZ"}</span>
            <h1>{ru ? "Ваша работа.\nВаше будущее." : "Sizga mos ish.\nSizga mos kelajak."}</h1>
            <p>{ru ? "Найдите своё место. По всему Узбекистану." : "O‘z o‘rningizni toping. Butun O‘zbekiston bo‘ylab."}</p>
          </div>
          <div className={`poster-search-card ${styles.searchCard}`}>
            <div className={styles.stats} aria-label={ru ? "Вакансии и пользователи" : "Vakansiyalar va foydalanuvchilar"}>
              <div className={styles.stat}>
                <span>{ru ? "ВСЕГО ВАКАНСИЙ" : "JAMI VAKANSIYALAR"}</span>
                <Link href="/jobs" className={`poster-job-count ${styles.count}`} aria-label={ru ? `${number(allJobs)} вакансий за всё время` : `Jami ${number(allJobs)} ta vakansiya`}>
                  <strong>{number(allJobs)}</strong>
                </Link>
              </div>
              <div className={styles.stat}>
                <span>{ru ? "ПОЛЬЗОВАТЕЛИ" : "FOYDALANUVCHILAR"}</span>
                <strong className={styles.userCount}>{number(users)}</strong>
              </div>
            </div>
            <form onSubmit={search} className={styles.search}>
              <div className={styles.query}>
                <Search size={19} aria-hidden="true" />
                <label htmlFor="home-search" className="sr-only">{ru ? "Профессия или компания" : "Kasb yoki kompaniya"}</label>
                <input id="home-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ru ? "Кем хотите работать?" : "Qaysi kasbni qidiryapsiz?"} />
              </div>
              <div className={styles.searchBottom}>
                <div className={styles.region}>
                  <MapPin size={17} aria-hidden="true" />
                  <label htmlFor="home-region" className="sr-only">{ru ? "Регион" : "Hudud"}</label>
                  <select id="home-region" value={region} onChange={(event) => setRegion(event.target.value)}>
                    <option value="all">{ru ? "Весь Узбекистан" : "Butun O‘zbekiston"}</option>
                    {regions.map((row) => <option key={row.id} value={row.id}>{ru ? row.name_ru || row.name_uz : row.name_uz}</option>)}
                  </select>
                </div>
                <button type="submit" className={styles.searchButton} aria-label={ru ? "Найти работу" : "Ish topish"}>
                  <span>{ru ? "Найти" : "Ish topish"}</span><ArrowRight size={18} aria-hidden="true" />
                </button>
              </div>
            </form>
          </div>
          <div className={styles.popular}>
            <span>{ru ? "Часто ищут" : "Ko‘p qidiriladi"}</span>
            {(ru ? ["Продавец", "Водитель", "Бухгалтер"] : ["Sotuvchi", "Haydovchi", "Buxgalter"]).map((term) => (
              <Link key={term} href={`/jobs?q=${encodeURIComponent(term)}`}>{term}<ArrowUpRight size={12} aria-hidden="true" /></Link>
            ))}
          </div>
        </div>
        <div className={styles.visual} aria-hidden="true">
          <div key={scene.name} className={`poster-word ${styles.word}`} style={{ "--profession-length": scene.name.length } as CSSProperties}>{scene.name}</div>
          <div className={styles.portrait}>
            {professionals.map((src, index) => (
              <div key={src} className={styles.layer} data-active={index === active}>
                <Image src={src} alt="" fill preload={index === 0} sizes="(min-width:900px) 45vw, 95vw" loading={index === 0 ? undefined : "eager"} className={styles.image} />
              </div>
            ))}
          </div>
          <span className={styles.visualIndex}>0{active + 1} <span>/ 08</span></span>
        </div>
        <div className={styles.professions}
          onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(true); }}
          onPointerLeave={() => setHovered(false)}
          onFocusCapture={() => setFocused(true)}
          onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
          <div className={`poster-avatars ${styles.avatars}`} role="group" aria-label={ru ? "Выберите профессию" : "Kasbni tanlang"}>
            {scenes.map((item, index) => (
              <button key={item.name} type="button" aria-label={item.name} aria-pressed={index === active} onClick={() => setActive(index)}>
                <span><Image src={professionals[index]} alt="" fill sizes="44px" /></span>
              </button>
            ))}
          </div>
          <div className={styles.professionFooter}>
            <div className={styles.progress} aria-hidden="true"><span key={active} /></div>
            <Link className={styles.professionAction} href={`/jobs?${professionParams}`}>{scene.action}<ArrowUpRight size={17} aria-hidden="true" /></Link>
          </div>
        </div>
      </div>
      <div className={`home-shell ${styles.telegramWrap}`}><HeroTelegramLink /></div>
    </section>
  );
}
