"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  MapPin,
  Plus,
  Users,
} from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
import { useUserAuth } from "@/contexts/user-auth-context";
import { useAuthModal } from "@/contexts/auth-modal-context";
import { resumeSkills } from "@/lib/resume-api";
import { getExperienceLabel } from "@/lib/experience-compat";
import { SectionHeading } from "./section-heading";
import styles from "./home-sections.module.css";
export function SeekersSection({
  resumes,
  unavailable,
}: {
  resumes: any[];
  unavailable?: boolean;
}) {
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
  return (
    <section className={`${styles.shell} ${styles.section}`} id="seekers">
      <SectionHeading kicker={ru ? "ЛЮДИ И ВОЗМОЖНОСТИ" : "INSONLAR VA IMKONIYATLAR"} title={ru ? "За каждым навыком — человек." : "Har bir ko‘nikma ortida inson bor."} description={ru ? "Познакомьтесь с людьми, открытыми к новой работе." : "Yangi ishga tayyor insonlar bilan tanishing."} href="/resumes" action={ru ? "Все профили" : "Barcha profillar"} />
      <div className="home-seekers-grid">
        {resumes.map((resume, index) => {
          const place = resume.regions;
          const skills = resumeSkills(resume.skills).slice(0, 3);
          return (
            <Link
              key={resume.id}
              href={`/resumes/${resume.id}`}
              className="home-seeker-card"
            >
              <div className="home-seeker-top">
                <span className={`home-seeker-avatar tone-${index % 3}`}>
                  {(resume.full_name || "?").trim().slice(0, 1).toUpperCase()}
                </span>
                <ArrowUpRight size={18} />
              </div>
              <h3>
                {resume.full_name || (ru ? "Соискатель" : "Ish izlovchi")}
              </h3>
              <p className="home-seeker-title">
                {resume.title ||
                  (ru ? "Открыт к предложениям" : "Takliflar uchun ochiq")}
              </p>
              <p className="home-seeker-location">
                <MapPin size={14} />
                {(ru ? place?.name_ru : place?.name_uz) ||
                  resume.city ||
                  (ru ? "Узбекистан" : "O‘zbekiston")}
              </p>
              <div className="home-skill-list">
                {skills.map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>
              <div className="home-seeker-bottom">
                <span>
                  {getExperienceLabel(
                    resume.experience,
                    resume.experience_years,
                    lang,
                  )}
                </span>
                <FileText size={16} />
              </div>
            </Link>
          );
        })}
        {!resumes.length && (
          <div className="home-empty home-seekers-empty">
            <Users size={28} />
            <p>
              {unavailable
                ? ru
                  ? "Профили временно недоступны. Попробуйте позже."
                  : "Profillar vaqtincha mavjud emas. Keyinroq urinib ko‘ring."
                : ru
                  ? "Расскажите о себе — ваш профиль может появиться здесь."
                  : "O‘zingiz haqingizda ayting — profilingiz shu yerda paydo bo‘lishi mumkin."}
            </p>
          </div>
        )}
      </div>
      <div className="home-resume-cta">
        <div className="home-cta-icon">
          <Plus size={24} />
        </div>
        <div>
          <h3>
            {ru
              ? "Следующий профиль может быть вашим"
              : "Keyingi profil sizniki bo‘lishi mumkin"}
          </h3>
          <p>
            {ru
              ? "Добавьте резюме, чтобы вас могли найти."
              : "Sizni topishlari uchun rezyumengizni qo‘shing."}
          </p>
        </div>
        <button onClick={create} className={styles.button}>
          {ru ? "Создать резюме" : "Rezyume yaratish"}
          <ArrowRight size={17} />
        </button>
      </div>
    </section>
  );
}
