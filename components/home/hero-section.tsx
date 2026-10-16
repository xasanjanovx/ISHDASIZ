"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import {
  Search,
  MapPin,
  ArrowUpRight,
  ArrowRight,
  Pause,
  Play,
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
];
export function HeroSection({ regions = [], stats }: HeroProps) {
  const { lang } = useLanguage();
  const ru = lang === "ru";
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("all");
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [motionEnabled, setMotionEnabled] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const stopped = paused || (reducedMotion && !motionEnabled);
  const playing = !stopped && !hovered && !focused;
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () => setActive((value) => (value + 1) % professionals.length),
      7000,
    );
    return () => clearInterval(timer);
  }, [playing]);
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
      ];
  const scene = scenes[active];
  const professionParams = new URLSearchParams({ category: scene.category });
  if (scene.query) professionParams.set("q", scene.query);
  if (region !== "all") professionParams.set("region", region);
  return (
    <section
      id="home-top"
      className="poster-hero"
      data-playing={playing}
      data-motion={motionEnabled ? "enabled" : "system"}
      data-profession={active}
    >
      <div className="poster-atmospheres" aria-hidden="true">
        {professionals.map((src, index) => (
          <div
            key={src}
            className={`poster-atmosphere theme-${index} ${index === active ? "is-active" : ""}`}
          />
        ))}
      </div>
      <BenefitsTicker />
      <div className="poster-stage home-shell">
        <div className="poster-word" aria-hidden="true">
          ISHDASIZ
        </div>
        <svg
          className="poster-connectors"
          viewBox="0 0 1600 820"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M320 410 C480 410 475 310 630 310" />
          <path d="M1010 455 C1180 455 1220 440 1290 440" />
          <circle cx="630" cy="310" r="5" />
          <circle cx="1010" cy="455" r="5" />
        </svg>
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
        <div
          className="poster-profession-tag"
          aria-hidden="true"
          key={scene.name}
        >
          <span>0{active + 1}</span>
          {scene.name}
          <ArrowUpRight size={15} />
        </div>
        <div className="poster-search-card">
          <div className="poster-card-label">
            <span>{ru ? "ВСЕГО ВАКАНСИЙ" : "JAMI VAKANSIYALAR"}</span>
            <ArrowUpRight size={17} />
          </div>
          <Link href="/jobs" className="poster-job-count"
            aria-label={ru ? `${number(allJobs)} вакансий за всё время` : `Jami ${number(allJobs)} ta vakansiya`}>
            <strong>{number(allJobs)}</strong>
          </Link>
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
              <button type="submit" className="home-button">
                {ru ? "Найти работу" : "Ish topish"}
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
            <div className="poster-avatars">
              {scenes.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  className={index === active ? "is-active" : ""}
                  aria-label={item.name}
                  aria-pressed={index === active}
                  onClick={() => {
                    setActive(index);
                    setPaused(true);
                  }}
                >
                  <Image src={professionals[index]} alt="" fill sizes="52px" />
                </button>
              ))}
            </div>
            <span className="poster-slide-number">
              0{active + 1}
              <em>/ 05</em>
            </span>
            <button
              type="button"
              className="poster-pause"
              aria-label={
                stopped
                  ? ru
                    ? "Включить смену профессий"
                    : "Kasblar almashinuvini yoqish"
                  : ru
                    ? "Приостановить смену профессий"
                    : "Kasblar almashinuvini to‘xtatish"
              }
              aria-pressed={!stopped}
              onClick={() => {
                if (stopped) {
                  setMotionEnabled(true);
                  setPaused(false);
                } else setPaused(true);
              }}
            >
              {stopped ? (
                <Play size={17} />
              ) : (
                <Pause size={17} />
              )}
            </button>
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
