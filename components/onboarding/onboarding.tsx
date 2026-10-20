"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Search, ArrowRight, Check } from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
import { useUserAuth } from "@/contexts/user-auth-context";
import { accountApi, AccountApiError } from "@/lib/account-api";
import { AccountGate } from "@/components/profile/account-gate";
import { LocationSelect } from "@/components/ui/location-select";
import { JobMap } from "@/components/map/job-map";
import { REGION_COORDINATES, UZBEKISTAN_CENTER } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import styles from "./onboarding.module.css";

type Role = "job_seeker" | "employer";
type Category = { id: string; name_ru: string; name_uz: string };
type Form = Record<string, string>;
type Loaded = { completed: boolean; profile: any; categories: Category[] };
const initial: Form = { name: "", birth_date: "", phone: "", title: "", category: "", region: "", district: "", address: "", about: "", salary_min: "", salary_max: "", skills: "", experience: "no_experience", education: "secondary", institution: "", field: "", previous_company: "", previous_position: "", employment_type: "full_time", work_mode: "onsite" };

export function Onboarding({ role }: { role: Role }) {
  return <AccountGate role={role}><Setup role={role} /></AccountGate>;
}

function Setup({ role }: { role: Role }) {
  const { lang } = useLanguage(), ru = lang === "ru", employer = role === "employer";
  const { updateProfile } = useUserAuth();
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded | null>(null), [revision, setRevision] = useState(0);
  const [form, setForm] = useState<Form>(initial), [step, setStep] = useState(0), [categoryQuery, setCategoryQuery] = useState("");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [publicResume, setPublicResume] = useState(true), [showMap, setShowMap] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const lock = useRef(false), requestId = useRef<string | null>(null), profileSaved = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const text = (r: string, u: string) => ru ? r : u;
  useEffect(() => {
    setLoadFailed(false);
    let cancelled = false; const controller = new AbortController();
    accountApi<Loaded>(`/api/account/onboarding?role=${role}`, { signal: controller.signal }).then(data => {
      if (cancelled) return;
      if (data.completed) { router.replace(employer ? "/profile/employer" : "/profile/job-seeker"); return; }
      setLoaded(data); setError("");
      const p = data.profile;
      setForm(current => ({ ...current, name: (employer ? p.company_name : p.full_name) || "", birth_date: p.birth_date || "", phone: p.phone || p.account_phone || "", region: String(p.region_id || ""), district: String(p.district_id || ""), address: p.address || "", about: employer ? "" : p.about || "" }));
    }).catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; controller.abort(); };
  }, [role, employer, router, revision]);

  const change = (patch: Partial<Form>) => { setForm(current => ({ ...current, ...patch } as Form)); profileSaved.current = false; setError(""); };
  const advance = (value: number) => { setStep(value); setError(""); requestAnimationFrame(() => { heading.current?.focus(); heading.current?.scrollIntoView({ block: "start", behavior: "auto" }); }); };
  const input = (key: string, label: string, type = "text", required = false, placeholder?: string) => <div className={styles.field}>
    <label htmlFor={`setup-${key}`}>{label}</label>
    <input id={`setup-${key}`} type={type} value={form[key]} required={required} disabled={busy} readOnly={key === "name" && employer && loaded?.profile.is_verified === true} autoComplete={key === "phone" ? "tel" : key === "name" && !employer ? "name" : undefined} maxLength={key === "phone" ? 25 : 255} min={type === "number" ? 0 : undefined} step={type === "number" ? 1 : undefined} placeholder={placeholder} onChange={event => change({ [key]: event.target.value })} />
  </div>;
  const select = (key: string, label: string, options: [string, string, string][]) => <div className={styles.field}><label htmlFor={`setup-${key}`}>{label}</label><select id={`setup-${key}`} value={form[key]} disabled={busy} onChange={event => change({ [key]: event.target.value })}>{options.map(([value, r, u]) => <option key={value} value={value}>{text(r, u)}</option>)}</select></div>;
  const steps = employer ? [text("О компании", "Kompaniya haqida"), text("Кого ищете?", "Kim kerak?"), text("Где работать?", "Ish joyi qayerda?"), text("Условия работы", "Ish sharoitlari"), text("Всё готово", "Hammasi tayyor")] : [text("Познакомимся", "Tanishamiz"), text("Какая работа нужна?", "Qanday ish kerak?"), text("Где ищете работу?", "Qayerdan ish qidirasiz?"), text("Опыт и ожидания", "Tajriba va istaklar"), text("Ваш следующий шаг", "Keyingi qadamingiz")];
  const category = loaded?.categories.find(row => row.id === form.category);
  async function save() {
    if (!loaded || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    requestId.current ||= crypto.randomUUID();
    try {
      if (!profileSaved.current) {
        const { profile } = await accountApi<{ profile: any }>(`/api/account/profile?role=${role}`, { method: "PUT", body: JSON.stringify({ expected_updated_at: loaded.profile.updated_at, [employer ? "company_name" : "full_name"]: form.name, ...(!employer ? { birth_date: form.birth_date, about: form.about } : { address: form.address }), phone: form.phone, region_id: Number(form.region), district_id: Number(form.district) }) });
        setLoaded(current => current && ({ ...current, profile })); profileSaved.current = true;
        updateProfile(employer ? { company_name: form.name } : { full_name: form.name });
      }
      const shared = { request_id: requestId.current, region_id: Number(form.region), district_id: Number(form.district), category_id: form.category, employment_type: form.employment_type, skills: form.skills.split(",").map(value => value.trim()).filter(Boolean).slice(0, 50), status: "active" };
      if (employer) {
        const { vacancy } = await accountApi<{ vacancy: { id: string } }>("/api/account/vacancies", { method: "POST", body: JSON.stringify({ ...shared, company_name: form.name, title_uz: form.title, description_uz: form.about, salary_min: form.salary_min ? Number(form.salary_min) : null, salary_max: form.salary_max ? Number(form.salary_max) : null, contact_phone: form.phone, address: form.address, work_mode: form.work_mode, experience: ({ "3_years": "1_3_years", "5_years": "3_5_years", "10_years": "5_plus" } as Record<string, string>)[form.experience] || form.experience, education_level: "any", gender: "any", payment_type: 3, latitude: point?.lat ?? null, longitude: point?.lng ?? null }) });
        router.replace(`/profile/employer/vacancies/${vacancy.id}/promotion`);
      } else {
        await accountApi("/api/account/resumes", { method: "POST", body: JSON.stringify({ ...shared, title: form.title, full_name: form.name, phone: form.phone, birth_date: form.birth_date, about: form.about, expected_salary_min: form.salary_min ? Number(form.salary_min) : null, expected_salary_max: form.salary_max ? Number(form.salary_max) : null, experience: form.experience, experience_details: form.experience === "no_experience" ? [] : [{ company: form.previous_company, position: form.previous_position }], education_level: form.education, education: ["higher", "master"].includes(form.education) ? [{ institution: form.institution, field: form.field }] : [], gender: "any", languages: [], is_public: publicResume }) });
        router.replace(`/jobs?${new URLSearchParams({ category: form.category, region: form.region })}`);
      }
    } catch (failure) {
      const detail = failure instanceof AccountApiError ? failure.detail : "";
      const parts = detail?.split(" / ");
      setError(parts?.[ru ? 0 : 1] || parts?.[0] || text("Не удалось сохранить. Ответы остаются в форме — попробуйте ещё раз.", "Saqlab bo‘lmadi. Javoblaringiz formada qoldi — qayta urinib ko‘ring."));
    } finally { lock.current = false; setBusy(false); }
  }
  function next(event: React.FormEvent) {
    event.preventDefault();
    if (step === 0 && !/^(?:998)?\d{9}$/.test(form.phone.replace(/[^\d]/g, ""))) { setError(text("Укажите телефон +998 и 9 цифр.", "+998 va 9 ta raqamdan iborat telefon kiriting.")); return; }
    if (step === 1 && !form.category) { setError(text("Выберите направление из списка.", "Ro‘yxatdan sohani tanlang.")); return; }
    if (step === 2 && (!form.region || !form.district)) { setError(text("Выберите регион и район.", "Viloyat va tumanni tanlang.")); return; }
    if (step === 3 && form.salary_min && form.salary_max && Number(form.salary_min) > Number(form.salary_max)) { setError(text("Зарплата «от» должна быть меньше зарплаты «до».", "Eng kam maosh eng ko‘p maoshdan oshmasin.")); return; }
    if (step < 4) advance(step + 1); else void save();
  }
  return <main data-onboarding className={styles.page}><div className={styles.shell}>
    <aside className={styles.intro}><span className={styles.eyebrow}>ISHDASIZ · {text("ПЕРВЫЙ ШАГ", "BIRINCHI QADAM")}</span><h1>{employer ? text("Найдём человека в вашу команду.", "Jamoangizga mos xodim topamiz.") : text("Расскажите о себе. Найдём вашу работу.", "O‘zingiz haqingizda ayting. Mos ishni topamiz.")}</h1><p>{text("Несколько понятных шагов. Анкета появится при первом заполнении, дальше — ваш личный кабинет.", "Bir nechta sodda qadam. Anketani birinchi marta to‘ldirasiz, keyin shaxsiy kabinetingiz ochiladi.")}</p><div className={styles.shortcuts}><Link href="/jobs"><Search size={17} />{text("Найти работу", "Ish qidirish")}</Link><Link href="/map"><MapPin size={17} />{text("Работа на карте", "Xaritadagi ishlar")}</Link></div></aside>
    <div className={styles.panel}>{!loaded ? <div className={styles.status}>{loadFailed ? <><p role="alert">{text("Не удалось загрузить анкету. Попробуйте ещё раз.", "Anketani yuklab bo‘lmadi. Qayta urinib ko‘ring.")}</p><Button className="mt-4" onClick={() => setRevision(value => value + 1)}>{text("Повторить", "Qayta urinish")}</Button></> : <p role="status">{text("Готовим вашу анкету…", "Anketangiz tayyorlanmoqda…")}</p>}</div> : <form onSubmit={next}>
      <div className={styles.progress} aria-label={text(`Шаг ${step + 1} из 5`, `5 qadamdan ${step + 1}-qadam`)}>{steps.map((label, index) => <span key={label} data-current={index === step} data-done={index < step} />)}</div>
      <div className={styles.step} key={step}>
        <h2 ref={heading} tabIndex={-1}>{steps[step]}</h2>
        {step === 0 && <>
          <p>{employer ? text("Как называется ваша компания и как с вами связаться?", "Kompaniyangiz nomi va aloqa raqamingizni kiriting.") : text("Эти данные помогут работодателю с вами познакомиться.", "Bu ma’lumotlar ish beruvchiga siz bilan tanishishga yordam beradi.")}</p>
          {input("name", employer ? text("Название компании", "Kompaniya nomi") : text("Имя и фамилия", "Ism va familiya"), "text", true)}
          {!employer && input("birth_date", text("Дата рождения", "Tug‘ilgan sana"), "date", true)}
          {input("phone", text("Контактный телефон", "Aloqa telefoni"), "tel", true, "+998 90 123 45 67")}
        </>}
        {step === 1 && <>
          {input("title", employer ? text("Название вакансии", "Vakansiya nomi") : text("Кем хотите работать?", "Kim bo‘lib ishlamoqchisiz?"), "text", true, text("Например: продавец, водитель, программист", "Masalan: sotuvchi, haydovchi, dasturchi"))}
          <div className={styles.field}><label htmlFor="setup-category-search">{text("Найдите направление", "Sohani qidiring")}</label><input id="setup-category-search" type="search" value={categoryQuery} onChange={event => setCategoryQuery(event.target.value)} placeholder={text("Начните вводить…", "Yozishni boshlang…")} /></div>
          <div className={styles.choices} role="group" aria-label={text("Направление", "Soha")}>{loaded.categories.filter(item => `${item.name_ru} ${item.name_uz}`.toLocaleLowerCase().includes(categoryQuery.toLocaleLowerCase())).map(item => <button type="button" key={item.id} aria-pressed={form.category === item.id} onClick={() => change({ category: item.id })}>{text(item.name_ru || item.name_uz, item.name_uz)}{form.category === item.id && <Check className="ml-2 inline" size={16} />}</button>)}</div>
        </>}
        {step === 2 && <>
          <LocationSelect selectedRegion={form.region} selectedDistrict={form.district} disabled={busy} required onRegionChange={region => { change({ region, district: "" }); setPoint(null); }} onDistrictChange={district => change({ district })} />
          {employer && <>{input("address", text("Адрес места работы", "Ish joyi manzili"))}<Button type="button" variant="outline" onClick={() => setShowMap(value => !value)}>{text("Указать точку на карте (необязательно)", "Xaritada nuqtani belgilash (ixtiyoriy)")}</Button>{showMap && <JobMap jobs={[]} interactive markerPosition={point} center={REGION_COORDINATES[Number(form.region)] || UZBEKISTAN_CENTER} zoom={form.region ? 9 : 6} height="280px" onMapClick={(lat, lng) => setPoint({ lat, lng })} />}</>}
        </>}
        {step === 3 && <>
          <div className={styles.pair}>{input("salary_min", text("Зарплата от, сум", "Maosh, dan (so‘m)"), "number")}{input("salary_max", text("Зарплата до, сум", "Maosh, gacha (so‘m)"), "number")}</div>
          <p>{text("Если зарплата по договорённости — оставьте поля пустыми.", "Maosh kelishilgan holda bo‘lsa, maydonlarni bo‘sh qoldiring.")}</p>
          {select("employment_type", text("Занятость", "Bandlik"), [["full_time", "Полный день", "To‘liq kun"], ["part_time", "Неполный день", "Qisman kun"], ["contract", "По договору", "Shartnoma"], ["internship", "Стажировка", "Stajirovka"]])}
          {employer && select("work_mode", text("Формат работы", "Ish shakli"), [["onsite", "На месте", "Ish joyida"], ["remote", "Удалённо", "Masofaviy"], ["hybrid", "Гибрид", "Gibrid"]])}
          {select("experience", employer ? text("Нужен ли опыт?", "Tajriba kerakmi?") : text("Ваш опыт", "Tajribangiz"), [["no_experience", "Без опыта", "Tajribasiz"], ["1_year", "До 1 года", "1 yilgacha"], ["3_years", "1–3 года", "1–3 yil"], ["5_years", "3–5 лет", "3–5 yil"], ["10_years", "Более 5 лет", "5 yildan ko‘p"]])}
          {!employer && form.experience !== "no_experience" && <>{input("previous_company", text("Где вы работали?", "Qayerda ishlagansiz?"), "text", true)}{input("previous_position", text("Ваша должность там", "U yerdagi lavozimingiz"), "text", true)}</>}
          {!employer && <>{select("education", text("Образование", "Ma’lumotingiz"), [["secondary", "Среднее", "O‘rta"], ["vocational", "Среднее специальное", "O‘rta maxsus"], ["higher", "Высшее", "Oliy"], ["master", "Магистратура", "Magistratura"]])}{["higher", "master"].includes(form.education) && <>{input("institution", text("Учебное заведение", "O‘quv yurti"), "text", true)}{input("field", text("Специальность", "Mutaxassislik"), "text", true)}</>}</>}
          {input("skills", text("Навыки через запятую (необязательно)", "Ko‘nikmalarni vergul bilan kiriting (ixtiyoriy)"), "text", false, "Excel, Python, ...")}
          <div className={styles.field}><label htmlFor="setup-about">{employer ? text("Что нужно делать и какие условия?", "Nima qilish kerak va sharoitlar qanday?") : text("Что умеете и какую работу ищете?", "Nimalarni bilasiz va qanday ish qidiryapsiz?")}</label><textarea id="setup-about" value={form.about} onChange={event => change({ about: event.target.value })} maxLength={10000} required /></div>
        </>}
        {step === 4 && <>
          <div className={styles.summary}><strong>{form.title}</strong><span>{form.name}</span><span>{category && text(category.name_ru || category.name_uz, category.name_uz)}</span><p>{form.about}</p>{employer ? <p>{text("Вакансия будет размещена на сайте бесплатно. Продвижение в основном канале @ishdasiz оформляется отдельно через администратора.", "Vakansiya saytda bepul joylanadi. Asosiy @ishdasiz kanalida targ‘ib qilish administrator orqali alohida rasmiylashtiriladi.")} <Link href="/pricing" target="_blank">{text("Посмотреть тарифы", "Tariflarni ko‘rish")}</Link></p> : <p>{text("После сохранения откроем вакансии вашего направления и региона.", "Saqlagandan so‘ng soha va hududingizga mos vakansiyalar ochiladi.")}</p>}</div>
          {!employer && <label className={styles.visibility}><input type="checkbox" checked={publicResume} onChange={event => setPublicResume(event.target.checked)} />{text("Показывать резюме работодателям, чтобы они могли меня найти. Можно изменить в кабинете.", "Ish beruvchilar meni topishi uchun rezyumemni ularga ko‘rsatish. Kabinetda o‘zgartirish mumkin.")}</label>}
        </>}
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.actions}>{step > 0 && <Button type="button" variant="outline" disabled={busy} onClick={() => advance(step - 1)}>{text("Назад", "Orqaga")}</Button>}<Button type="submit" disabled={busy}>{busy ? text("Сохраняем…", "Saqlanmoqda…") : step === 4 ? (employer ? text("Разместить бесплатно", "Bepul joylashtirish") : text("Сохранить и найти работу", "Saqlash va ish topish")) : text("Далее", "Davom etish")}<ArrowRight size={18} className="ml-2" /></Button></div>
    </form>}</div>
  </div></main>;
}
