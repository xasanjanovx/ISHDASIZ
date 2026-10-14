"use client";
import Link from "next/link";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
import { useRouter } from "next/navigation";
import { useUserAuth } from "@/contexts/user-auth-context";
import { useAuthModal } from "@/contexts/auth-modal-context";
export function HowItWorksSection() {
  const { lang } = useLanguage();
  const ru = lang === "ru";
  const { user } = useUserAuth();
  const { openModal, setUserRole, setStep } = useAuthModal();
  const router = useRouter();
  const create = () => {
    if (user?.has_job_seeker_profile)
      router.push("/profile/job-seeker/resumes/new");
    else {
      setUserRole("seeker");
      setStep("auth");
      openModal();
    }
  };
  const steps = ru
    ? [
        {
          title: "Найдите своё",
          text: "Выберите профессию и регион. Посмотрите условия, зарплату и место работы.",
        },
        {
          title: "Расскажите о себе",
          text: "Создайте резюме. Добавьте навыки и опыт, которые помогут вас найти.",
        },
        {
          title: "Сделайте первый шаг",
          text: "Отправьте отклик на подходящую вакансию и следите за ним в своём профиле.",
        },
      ]
    : [
        {
          title: "O‘zingizga mosini toping",
          text: "Kasb va hududni tanlang. Shartlar, maosh va ish joyini ko‘rib chiqing.",
        },
        {
          title: "O‘zingiz haqingizda ayting",
          text: "Rezyume yarating. Sizni topishga yordam beradigan ko‘nikma va tajribani qo‘shing.",
        },
        {
          title: "Birinchi qadamni qo‘ying",
          text: "Mos vakansiyaga ariza yuboring va uni profilingizda kuzatib boring.",
        },
      ];
  return (
    <section className="home-shell home-section home-how">
      <div className="home-how-heading">
        <div>
          <span className="home-eyebrow">
            {ru ? "КАК ЭТО РАБОТАЕТ" : "BU QANDAY ISHLAYDI"}
          </span>
          <h2>
            {ru ? "Один поиск.\nНовая глава." : "Bir qidiruv.\nYangi sahifa."}
          </h2>
        </div>
        <p>
          {ru
            ? "От первого поиска до первого отклика — три понятных шага."
            : "Birinchi qidiruvdan birinchi arizagacha — uchta sodda qadam."}
        </p>
      </div>
      <div className="home-step-grid">
        {steps.map((step, index) => (
          <div key={step.title} className="home-step">
            <span className="home-step-number">0{index + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
            <ArrowUpRight size={20} />
          </div>
        ))}
      </div>
      <div className="home-how-actions">
        <Link href="/jobs" className="poster-action">
          <ArrowUpRight size={20} />
          {ru ? "Найти своё место" : "O‘z o‘rnimni topish"}
        </Link>
        <button type="button" onClick={create} className="home-text-link">
          {ru ? "Начать с резюме" : "Rezyumedan boshlash"}
          <ArrowRight size={17} />
        </button>
      </div>
    </section>
  );
}
