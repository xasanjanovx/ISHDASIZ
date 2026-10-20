"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { accountApi } from '@/lib/account-api';
import { AccountGate } from '@/components/profile/account-gate';
import { Button } from '@/components/ui/button';
import { ResumeCard } from '@/components/resumes/resume-card';
import { PromotionPlans } from './promotion-plans';

type Result = { vacancy: any; candidates: { resume: any; conditional: boolean }[]; examined: number; hasMore: boolean };
export function VacancyPromotion({ id }: { id: string }) { return <AccountGate role="employer"><Promotion id={id} /></AccountGate>; }
function Promotion({ id }: { id: string }) {
  const { lang } = useLanguage(), ru = lang === 'ru';
  const [data, setData] = useState<Result | null>(null), [error, setError] = useState(false), [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false; const controller = new AbortController();
    accountApi<Result>(`/api/account/vacancies/${id}/matches`, { signal: controller.signal }).then(result => { if (!cancelled) { setData(result); setError(false); } }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; controller.abort(); };
  }, [id, revision]);
  return <>
    <section className="mx-auto w-[calc(100%-2rem)] max-w-6xl py-8 sm:py-12">
      <Link href="/profile/employer/vacancies" className="text-base font-semibold text-primary underline">{ru ? 'Мои вакансии' : 'Mening vakansiyalarim'}</Link>
      <h1 className="mt-5 text-3xl font-bold sm:text-4xl">{ru ? 'Ваша команда начинается здесь.' : 'Jamoangiz shu yerdan boshlanadi.'}</h1>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">{ru ? 'Подбор открытых резюме доступен бесплатно. Размещение в основном канале @ishdasiz заказывается отдельно у администратора.' : 'Ochiq rezyumelarni tanlash bepul. Asosiy @ishdasiz kanalida e’lon joylashtirish administrator orqali alohida buyurtma qilinadi.'}</p>
      {error ? <div role="alert" className="mt-6 space-y-3 rounded-2xl bg-card p-5"><p>{ru ? 'Не удалось загрузить вакансию и кандидатов. Проверьте доступ и повторите.' : 'Vakansiya va nomzodlarni yuklab bo‘lmadi. Kirishni tekshiring va qayta urinib ko‘ring.'}</p><Button variant="outline" onClick={() => setRevision(value => value + 1)}>{ru ? 'Повторить' : 'Qayta urinish'}</Button></div> : !data ? <p role="status" className="py-10 text-lg">{ru ? 'Подбираем кандидатов…' : 'Mos nomzodlar qidirilmoqda…'}</p> : <>
        <div className="mt-6 rounded-2xl bg-accent p-5"><h2 className="text-xl font-bold">{ru ? data.vacancy.title_ru || data.vacancy.title_uz : data.vacancy.title_uz || data.vacancy.title_ru}</h2><Link className="mt-2 inline-block text-base font-semibold text-primary underline" href={`/jobs/${id}`}>{ru ? 'Открыть вакансию на сайте' : 'Saytdagi vakansiyani ochish'} ↗</Link></div>
        <h2 className="mb-5 mt-8 text-2xl font-bold">{ru ? 'Кандидаты по вашим условиям' : 'Shartlaringizga mos nomzodlar'}</h2>
        {data.candidates.length ? <div className="grid gap-5 md:grid-cols-2">{data.candidates.map(candidate => <div key={candidate.resume.id}><ResumeCard resume={candidate.resume} />{candidate.conditional && <p className="mt-2 text-sm text-muted-foreground">{ru ? 'Опыт или образование нужно уточнить при общении.' : 'Tajriba yoki ma’lumotni suhbatda aniqlashtirish kerak.'}</p>}</div>)}</div> : <div className="rounded-2xl border border-border bg-card p-6 text-base leading-relaxed">{ru ? 'В открытых анкетах пока нет подходящих кандидатов. Можно расширить условия или посмотреть каталог резюме.' : 'Ochiq anketalarda hozircha mos nomzodlar yo‘q. Shartlarni kengaytirish yoki rezyumelar katalogini ko‘rish mumkin.'}</div>}
        <Button asChild variant="outline" className="mt-5 h-12 rounded-full"><Link href={`/resumes?${new URLSearchParams(data.vacancy.category_id ? { category: data.vacancy.category_id } : {})}`}>{ru ? 'Посмотреть больше резюме' : 'Ko‘proq rezyumelarni ko‘rish'} ↗</Link></Button>
      </>}
    </section>
    {data && <PromotionPlans vacancyId={id} />}
  </>;
}
