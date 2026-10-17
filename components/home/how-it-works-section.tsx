"use client";
import Link from "next/link";
import { ArrowRight, Search, FileText, Send } from "lucide-react";
import { SectionHeading } from "./section-heading";
import styles from "./home-sections.module.css";
import { ActionLabel } from "@/components/ui/action-label";
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
  const icons = [Search, FileText, Send];
  return <section className={`${styles.section} ${styles.how}`} id="how-it-works"><div className={styles.shell}>
    <SectionHeading kicker={ru ? "КАК ЭТО РАБОТАЕТ" : "BU QANDAY ISHLAYDI"} title={ru ? "Три шага к вашей работе." : "Ishingiz sari uchta qadam."} description={ru ? "От первого поиска до первого отклика — всё на одной платформе." : "Birinchi qidiruvdan birinchi arizagacha — barchasi bitta platformada."} />
    <div className={styles.stepGrid}>{steps.map((step, index) => {
      const Icon = icons[index];
      return <div className={styles.step} key={step.title} data-home-reveal>
        <div className={styles.stepTop}><span className={styles.stepNumber}>0{index + 1}</span><span className={styles.stepIcon} aria-hidden="true"><Icon size={26} strokeWidth={1.5} /></span></div>
        <h3>{step.title}</h3><p>{step.text}</p>
      </div>;
    })}</div>
    <div className={styles.actions}>
      <Link href="/jobs" className={styles.button}><ActionLabel>{ru ? "Найти работу" : "Ish topish"}</ActionLabel></Link>
      <button type="button" onClick={create} className={styles.textLink}>{ru ? "Создать резюме" : "Rezyume yaratish"}<ArrowRight size={17} aria-hidden="true" /></button>
    </div>
  </div></section>;
}
