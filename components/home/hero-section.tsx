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
  const number = (value?: number | null) =>
    value == null ? "—" : value.toLocaleString("ru-RU").replace(/\u00a0/g, " ");
  const allJobs = stats?.totalJobs != null && stats?.archivedJobs != null
    && Number.isSafeInteger(stats.totalJobs + stats.archivedJobs)
    ? stats.totalJobs + stats.archivedJobs : null;
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
          title: "Передавайте знания.\nОткрывайте будущее.",
          text: "Найдите своё место в образовании — от первого урока до нового этапа карьеры.",
          action: "Вакансии в образовании",
          category: "a0000004-0004-4000-8000-000000000004",
        },
        {
          name: "Строитель",
          title: "Стройте больше.\nРастите в профессии.",
          text: "Новый проект начинается с вас. Найдите работу в строительстве в удобном регионе.",
          action: "Вакансии в строительстве",
          category: "a0000007-0007-4000-8000-000000000007",
        },
        {
          name: "Врач",
          title: "Заботьтесь о людях.\nНайдите своё место.",
          text: "Ваши знания нужны людям. Посмотрите предложения в медицине по всему Узбекистану.",
          action: "Вакансии в медицине",
          category: "a0000005-0005-4000-8000-000000000005",
        },
        {
          name: "Программист",
          title: "Создавайте новое.\nРазвивайте карьеру.",
          text: "Следующая задача может стать новым этапом. Найдите возможности в IT и разработке.",
          action: "Вакансии в IT",
          category: "a0000001-0001-4000-8000-000000000001",
        },
        {
          name: "Повар",
          title: "Создавайте вкус.\nНайдите свою команду.",
          text: "Найдите работу на кухне, где ваш опыт и мастерство станут частью нового меню.",
          action: "Вакансии повара",
          category: "a0000003-0003-4000-8000-000000000003",
          query: "oshpaz",
        },
        { name: "Швея", title: "Создавайте с мастерством.\nРастите в своём деле.", text: "Ваши навыки нужны производству. Найдите работу в швейном деле рядом с вами.", action: "Вакансии швеи", category: "", query: "tikuvchi" },
        { name: "Водитель", title: "Выбирайте свой маршрут.\nДвигайтесь к новому.", text: "Найдите работу водителем с подходящим графиком и удобным маршрутом.", action: "Вакансии водителя", category: "", query: "haydovchi" },
        { name: "Продавец", title: "Общайтесь с людьми.\nРастите вместе с командой.", text: "Посмотрите предложения в торговле и найдите команду, где ценят ваше общение и опыт.", action: "Вакансии продавца", category: "", query: "sotuvchi" },
      ]
    : [
        {
          name: "O‘qituvchi",
          title: "Bilim ulashing.\nKelajakni yarating.",
          text: "Ta’limda o‘z o‘rningizni toping — ilk darsdan kasbingizdagi yangi bosqichgacha.",
          action: "Ta’limdagi vakansiyalar",
          category: "a0000004-0004-4000-8000-000000000004",
        },
        {
          name: "Quruvchi",
          title: "Ko‘proq bunyod eting.\nKasbingizda o‘sing.",
          text: "Yangi loyiha sizdan boshlanadi. Qulay hududda qurilish sohasidagi ishni toping.",
          action: "Qurilishdagi vakansiyalar",
          category: "a0000007-0007-4000-8000-000000000007",
        },
        {
          name: "Shifokor",
          title: "Insonlarga g‘amxo‘rlik.\nSizga mos imkoniyat.",
          text: "Bilimingiz insonlarga kerak. Butun O‘zbekiston bo‘ylab tibbiyotdagi takliflarni ko‘ring.",
          action: "Tibbiyotdagi vakansiyalar",
          category: "a0000005-0005-4000-8000-000000000005",
        },
        {
          name: "Dasturchi",
          title: "Yangilik yarating.\nKaryerangizni o‘stiring.",
          text: "Keyingi vazifa yangi bosqichga aylanishi mumkin. IT va dasturlashdagi imkoniyatlarni toping.",
          action: "IT vakansiyalari",
          category: "a0000001-0001-4000-8000-000000000001",
        },
        {
          name: "Oshpaz",
          title: "Ta’m yarating.\nJamoangizni toping.",
          text: "Tajribangiz va mahoratingiz yangi menyuning bir qismiga aylanishi mumkin. Sizga mos oshxonani toping.",
          action: "Oshpaz vakansiyalari",
          category: "a0000003-0003-4000-8000-000000000003",
          query: "oshpaz",
        },
        { name: "Tikuvchi", title: "Mahorat bilan yarating.\nKasbingizda o‘sing.", text: "Mahoratingiz ishlab chiqarishga kerak. Yaqin atrofdagi tikuvchilik ishlarini toping.", action: "Tikuvchi vakansiyalari", category: "", query: "tikuvchi" },
        { name: "Haydovchi", title: "Yo‘lingizni tanlang.\nYangi imkoniyat sari.", text: "Qulay jadval va yo‘nalishga mos haydovchilik ishini toping.", action: "Haydovchi vakansiyalari", category: "", query: "haydovchi" },
        { name: "Sotuvchi", title: "Insonlar bilan ishlang.\nJamoa bilan o‘sing.", text: "Savdodagi takliflarni ko‘ring. Muloqotingiz va tajribangizni qadrlaydigan jamoani toping.", action: "Sotuvchi vakansiyalari", category: "", query: "sotuvchi" },
      ];
  const scene = scenes[active];
  const professionParams = new URLSearchParams();
  if (scene.category) professionParams.set("category", scene.category);
  if (scene.query) professionParams.set("q", scene.query);
  if (region !== "all") professionParams.set("region", region);
  return (
    <section
      id="home-top"
      className="poster-hero"
      data-playing={playing}
      data-motion="system"
      data-profession={active}
    >
      <BenefitsTicker />
      <div className="poster-stage home-shell">
        <svg key={`art-${active}`} className="poster-scene-art" viewBox="0 0 1440 820" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          {active === 0 && <g><path className="scene-panel" d="M420 100h480v550H420z" /><path d="M480 150v450m-25-390h150m-150 25h120M990 190l160-45v300l-160 45zM1015 230l100-28m-100 70 100-28m-100 70 70-20M180 530l170-45 50 145-170 45z" /></g>}
          {active === 1 && <g><path className="scene-panel" d="m450 80 450 65-70 570-450-65z" /><path d="M470 200h370v360H470zM490 580h340m-340 20h340M1020 560V240h180v320m-150-280h120m-120 55h120m-120 55h120m-120 55h120M160 350h180v130H160zM180 370h140v90H180z" /><path d="M1010 205h200m-195-10v20m190-20v20" strokeDasharray="5 8" /></g>}
          {active === 2 && <g><path className="scene-panel" d="M460 90h430v610H460z" /><path d="M1040 190h60v-60h55v60h60v55h-60v60h-55v-60h-60ZM160 485h90l30-65 40 130 35-75h90M500 150h110m-110 25h70M1020 540h170m-170 25h110" /></g>}
          {active === 3 && <g><path className="scene-panel" d="m420 150 520-70 65 520-520 70z" /><path d="m280 230-65 60 65 60m115-120 65 60-65 60m-65-135-25 150M1010 470h100l45 45h120m-255 55h70l45 45h140M1050 210h140m-140 30h95m-95 30h115" /><path d="M480 180h80m-80 25h120m-120 25h95" strokeDasharray="12 8" /></g>}
          {active === 4 && <g><path className="scene-panel" d="M430 100h490l-40 580H390z" /><path d="M1030 430h210l-30 100h-150zM1065 380q-40-35 0-70t0-70m65 140q-40-35 0-70t0-70m65 140q-40-35 0-70t0-70M200 210v170m25-170v170m25-170v170m-50-75q25 30 50 0m-25 75v150" /></g>}
          {active === 5 && <g><path className="scene-panel" d="m480 85 430 100-130 560-430-100z" /><path d="m1020 200 130 30 55 110-100 40-85-180v340M180 260l155 40-65 250-155-40z" /><path d="m480 120 350 80-110 490-330-80zM1040 245l90 20 40 65" strokeDasharray="6 9" /></g>}
          {active === 6 && <g><path className="scene-panel" d="M450 100h470l100 600H350z" /><path d="m520 100-110 600m440-600 110 600M1080 220h135v100h-135zM1080 245h135m-100 30h65M150 490h170m-130 30h130" /><path d="M680 120v80m0 55v100m0 60v120m0 60v130" strokeWidth="5" /></g>}
          {active === 7 && <g><path className="scene-panel" d="m420 130 440-50 70 580-440 50z" /><path d="M1020 270h190v240h-190zM1060 275v-35q0-55 55-55t55 55v35M165 220h170v70H165zM190 240h85m-85 25h120M160 450h30v90h-30zm55-40h30v130h-30zm55-70h30v200h-30z" /></g>}
        </svg>
        <div key={scene.name} className="poster-word" aria-hidden="true" style={{ "--profession-length": scene.name.length } as CSSProperties}>
          {scene.name}
        </div>
        <div className="poster-character" aria-hidden="true">
          {professionals.map((src, index) => (
            <div
              key={src}
              className={`poster-character-layer ${index === active ? "is-active" : ""}`}
            >
              <Image
                src={src}
                alt=""
                fill
                preload={index === 0}
                sizes="(min-width:1100px) 45vw, 95vw"
                loading={index === 0 ? undefined : "eager"}
                className="poster-character-image"
              />
            </div>
          ))}
        </div>
        <div className="poster-search-card">
          <div className="poster-search-summary">
            <div className="poster-card-label">
              <span>{ru ? "ВСЕГО ВАКАНСИЙ" : "JAMI VAKANSIYALAR"}</span>
            </div>
            <Link href="/jobs" className="poster-job-count"
              aria-label={ru ? `${number(allJobs)} вакансий за всё время` : `Jami ${number(allJobs)} ta vakansiya`}>
              <strong>{number(allJobs)}</strong>
            </Link>
          </div>
          <form onSubmit={search} className="home-search">
            <div className="home-search-query">
              <Search size={18} />
              <label htmlFor="home-search" className="sr-only">
                {ru ? "Профессия или компания" : "Kasb yoki kompaniya"}
              </label>
              <input
                id="home-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  ru ? "Кем хотите работать?" : "Qaysi kasbni qidiryapsiz?"
                }
              />
            </div>
            <div className="home-search-bottom">
              <div className="home-search-region">
                <MapPin size={16} />
                <label htmlFor="home-region" className="sr-only">
                  {ru ? "Регион" : "Hudud"}
                </label>
                <select
                  id="home-region"
                  value={region}
                  onChange={(event) => setRegion(event.target.value)}
                >
                  <option value="all">
                    {ru ? "Весь Узбекистан" : "Butun O‘zbekiston"}
                  </option>
                  {regions.map((row) => (
                    <option key={row.id} value={row.id}>
                      {ru ? row.name_ru || row.name_uz : row.name_uz}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="home-button" aria-label={ru ? "Найти работу" : "Ish topish"}>
                <span className="home-search-label-full" aria-hidden="true">{ru ? "Найти работу" : "Ish topish"}</span>
                <span className="home-search-label-short" aria-hidden="true">{ru ? "Найти" : "Ish topish"}</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </div>
        <Link href="/resumes" className="poster-resumes-card">
          <div className="poster-card-label">
            <ArrowUpRight size={17} />
            <span>{ru ? "ПОЛЬЗОВАТЕЛИ" : "FOYDALANUVCHILAR"}</span>
          </div>
          <div className="poster-resume-count">
            <strong>{number(stats?.totalUsers)}</strong>
            <span>
              {ru
                ? "человек зарегистрировано\nна ISHDASIZ"
                : "ISHDASIZ’da ro‘yxatdan\no‘tgan insonlar"}
            </span>
          </div>
        </Link>
        <div className="poster-copy">
          <div className="home-eyebrow">
            <span className="home-status-dot" />
            {ru
              ? "МЕСТО ДЛЯ ВАШЕГО БУДУЩЕГО"
              : "KELAJAGINGIZ UCHUN YANGI MAKON"}
          </div>
          <h1>
            {ru
              ? "Работа, в которой\nесть ваше будущее."
              : "Sizga mos ish.\nSizga mos kelajak."}
          </h1>
          <p>
            {ru
              ? "Найдите своё место. По всему Узбекистану."
              : "O‘z o‘rningizni toping. Butun O‘zbekiston bo‘ylab."}
          </p>
          <div className="home-popular">
            {(ru
              ? ["Продавец", "Водитель", "Бухгалтер"]
              : ["Sotuvchi", "Haydovchi", "Buxgalter"]
            ).map((term) => (
              <Link key={term} href={`/jobs?q=${encodeURIComponent(term)}`}>
                {term}
                <ArrowUpRight size={11} />
              </Link>
            ))}
          </div>
        </div>
        <div className="poster-feature">
          <div className="poster-controls">
            <div className="poster-avatars" role="group" aria-label={ru ? "Выберите профессию" : "Kasbni tanlang"}>
              {scenes.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  className={index === active ? "is-active" : ""}
                  aria-label={item.name}
                  aria-pressed={index === active}
                  onClick={() => {
                    setActive(index);
                  }}
                >
                  <Image src={professionals[index]} alt="" fill sizes="52px" />
                </button>
              ))}
            </div>
            <span className="poster-slide-number">
              0{active + 1}
              <em>/ {String(professionals.length).padStart(2, "0")}</em>
            </span>
          </div>
          <div className="poster-progress" aria-hidden="true">
            <span key={active} />
          </div>
          <div
            key={scene.name}
            className="poster-feature-copy"
            aria-live={playing ? "off" : "polite"}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") setHovered(true);
            }}
            onPointerLeave={() => setHovered(false)}
            onFocusCapture={() => setFocused(true)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
            }}
          >
            <h2>{scene.title}</h2>
            <p>{scene.text}</p>
            <Link className="poster-action" href={`/jobs?${professionParams}`}>
              <ArrowUpRight size={20} />
              {scene.action}
            </Link>
          </div>
        </div>
        <div className="poster-bottom-label" aria-hidden="true">
          <span>UZBEKISTAN</span>
          <span>EST. ISHDASIZ ↗</span>
        </div>
      </div>
    </section>
  );
}
