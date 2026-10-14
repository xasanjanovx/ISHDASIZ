"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import {
  Search,
  MapPin,
  ArrowUpRight,
  ArrowRight,
  Pause,
  Play,
} from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
import { useAuthModal } from "@/contexts/auth-modal-context";
import { useUserAuth } from "@/contexts/user-auth-context";
interface HeroProps {
  regions?: { id: number; name_uz: string; name_ru: string }[];
  stats?: {
    totalJobs: number | null;
    totalResumes: number | null;
    totalEmployers?: number | null;
  };
}
const mascots = [
  "/mascot-search.webp",
  "/mascot-resume.webp",
  "/mascot-map.webp",
];
export function HeroSection({ regions = [], stats }: HeroProps) {
  const { lang } = useLanguage();
  const ru = lang === "ru";
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { openModal, setStep, setUserRole } = useAuthModal();
  const { user } = useUserAuth();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("all");
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const playing = !paused && !reducedMotion && !hovered && !focused;
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () => setActive((value) => (value + 1) % mascots.length),
      7000,
    );
    return () => clearInterval(timer);
  }, [playing]);
  const number = (value?: number | null) =>
    value == null ? "—" : value.toLocaleString("ru-RU").replace(/\u00a0/g, " ");
  const search = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (region !== "all") params.set("region", region);
    router.push(params.size ? `/jobs?${params}` : "/jobs");
  };
  const create = () => {
    if (user?.has_job_seeker_profile)
      router.push("/profile/job-seeker/resumes/new");
    else {
      setUserRole("seeker");
      setStep("auth");
      openModal();
    }
  };
  const scenes = ru
    ? [
        {
          name: "Поиск работы",
          title: "Ваш следующий шаг",
          text: "Вакансии по вашим навыкам и в вашем регионе. Всё начинается с одного поиска.",
          action: "Смотреть вакансии",
          href: "/jobs",
        },
        {
          name: "Резюме",
          title: "Пусть работа найдёт вас",
          text: "Расскажите о своих навыках и опыте. Создайте профиль, который поможет вас найти.",
          action: "Создать резюме",
          href: null,
        },
        {
          name: "Карта вакансий",
          title: "Работа ближе, чем кажется",
          text: "Посмотрите предложения на карте и выберите удобное место для следующего шага.",
          action: "Открыть карту",
          href: "/map",
        },
      ]
    : [
        {
          name: "Ish qidirish",
          title: "Keyingi qadamingiz",
          text: "Ko‘nikmalaringiz va hududingizga mos vakansiyalar. Hammasi bitta qidiruvdan boshlanadi.",
          action: "Vakansiyalarni ko‘rish",
          href: "/jobs",
        },
        {
          name: "Rezyume",
          title: "Ish sizni topsin",
          text: "Ko‘nikmalaringiz va tajribangizni ko‘rsating. Sizni topishga yordam beradigan profil yarating.",
          action: "Rezyume yaratish",
          href: null,
        },
        {
          name: "Vakansiyalar xaritasi",
          title: "Ish sizga yanada yaqin",
          text: "Xaritadagi takliflarni ko‘ring va keyingi qadamingiz uchun qulay joyni tanlang.",
          action: "Xaritani ochish",
          href: "/map",
        },
      ];
  const scene = scenes[active];
  const ticker = ru
    ? [
        "РАБОТА ПО ВСЕМУ УЗБЕКИСТАНУ",
        "ВАКАНСИИ",
        "РЕЗЮМЕ",
        "РАБОТА НА КАРТЕ",
        "ISHDASIZ",
      ]
    : [
        "BUTUN O‘ZBEKISTON BO‘YLAB ISH",
        "VAKANSIYALAR",
        "REZYUMELAR",
        "XARITADA ISH",
        "ISHDASIZ",
      ];
  return (
    <section id="home-top" className="poster-hero" data-playing={playing}>
      <div className="poster-ticker" aria-hidden="true">
        <div>
          {[...ticker, ...ticker].map((label, index) => (
            <span key={index}>
              {label}
              <i />
            </span>
          ))}
        </div>
      </div>
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
          {mascots.map((src, index) => (
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
                className="poster-character-image"
              />
            </div>
          ))}
        </div>
        <div className="poster-search-card">
          <div className="poster-card-label">
            <span>{ru ? "ВАШИ ВОЗМОЖНОСТИ" : "SIZNING IMKONIYATLARINGIZ"}</span>
            <ArrowUpRight size={17} />
          </div>
          <div className="poster-job-count">
            <strong>{number(stats?.totalJobs)}</strong>
            <span>{ru ? "открытых вакансий" : "ochiq vakansiyalar"}</span>
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
            <span>{ru ? "СОИСКАТЕЛИ" : "ISH IZLOVCHILAR"}</span>
          </div>
          <div className="poster-resume-count">
            <strong>{number(stats?.totalResumes)}</strong>
            <span>
              {ru
                ? "резюме людей, открытых\nк новой работе"
                : "yangi ishga tayyor\ninsonlarning rezyumelari"}
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
        <div
          className="poster-feature"
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
          onFocusCapture={() => setFocused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setFocused(false);
          }}
        >
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
                  <Image src={mascots[index]} alt="" fill sizes="52px" />
                </button>
              ))}
            </div>
            <span className="poster-slide-number">
              0{active + 1}
              <em>/ 03</em>
            </span>
            <button
              type="button"
              className="poster-pause"
              aria-label={
                paused || reducedMotion
                  ? ru
                    ? "Включить смену аватаров"
                    : "Avatarlar almashinuvini yoqish"
                  : ru
                    ? "Приостановить смену аватаров"
                    : "Avatarlar almashinuvini to‘xtatish"
              }
              onClick={() => setPaused((value) => !value)}
              disabled={!!reducedMotion}
            >
              {paused || reducedMotion ? (
                <Play size={17} />
              ) : (
                <Pause size={17} />
              )}
            </button>
          </div>
          <div
            className="poster-feature-copy"
            aria-live={playing ? "off" : "polite"}
          >
            <h2>{scene.title}</h2>
            <p>{scene.text}</p>
            {scene.href ? (
              <Link className="poster-action" href={scene.href}>
                <ArrowUpRight size={20} />
                {scene.action}
              </Link>
            ) : (
              <button className="poster-action" type="button" onClick={create}>
                <ArrowUpRight size={20} />
                {scene.action}
              </button>
            )}
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
