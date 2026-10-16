"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/language-context";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

export function BenefitsTicker() {
  const { lang } = useLanguage();
  const ru = lang === "ru";
  const stopped = usePrefersReducedMotion();
  const items = [
    { text: ru ? "ISHDASIZ — работа по всему Узбекистану" : "ISHDASIZ — butun O‘zbekiston bo‘ylab ish", href: "/jobs" },
    { text: ru ? "Ищите по профессии и региону" : "Kasb va hudud bo‘yicha qidiring", href: "/jobs" },
    { text: ru ? "Сравнивайте зарплату и условия" : "Maosh va sharoitlarni solishtiring", href: "/jobs" },
    { text: ru ? "Находите вакансии рядом на карте" : "Yaqin atrofdagi ishlarni xaritada toping", href: "/map" },
    { text: ru ? "Ваш опыт заслуживает хорошего резюме" : "Tajribangizni rezyumeda ko‘rsating", href: "/profile/job-seeker/resumes" },
    { text: ru ? "Сохраняйте интересные вакансии" : "Yoqtirgan vakansiyalaringizni saqlang", href: "/profile/job-seeker/favorites" },
    { text: ru ? "Вакансии в нашем Telegram-канале — @ishdasiz" : "Telegram kanalimizdagi vakansiyalar — @ishdasiz", href: "https://t.me/ishdasiz" },
    { text: ru ? "Поиск и отклики прямо в Telegram-боте" : "Telegram botda ish qidiring va ariza yuboring", href: "https://t.me/ishdasizbot" },
  ];
  return (
    <div className="poster-ticker" role="region" aria-label={ru ? "О сайте и Telegram-канале" : "Sayt va Telegram kanal haqida"} data-paused={stopped} data-motion="system">
      <div className="poster-ticker-window">
        <div className="poster-ticker-track">
          {[false, true].map(duplicate => (
            <div key={String(duplicate)} className="poster-ticker-group" aria-hidden={duplicate || undefined}>
              {items.map(item => (
                <Link key={item.text} href={item.href} className="poster-ticker-item"
                  tabIndex={duplicate ? -1 : undefined}
                  {...(item.href.startsWith("https:") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                  <i aria-hidden="true" />{item.text}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
