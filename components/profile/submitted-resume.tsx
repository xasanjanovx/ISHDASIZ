'use client';
import { useEffect,useState } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { accountApi,AccountApiError } from '@/lib/account-api';
import type { SubmittedResumeDocument } from '@/lib/submitted-resume';
import { getExperienceLabel } from '@/lib/experience-compat';
import { EDUCATION_OPTIONS,GENDER_OPTIONS,LANGUAGES_LIST,formatSalary } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from '@/components/ui/icons';

export function SubmittedResume({ applicationId }: { applicationId: string }) {
  const { lang } = useLanguage(),ru = lang === 'ru';
  const [revision,setRevision] = useState(0);
  const [result,setResult] = useState<{ id: string; revision: number; resume: SubmittedResumeDocument | null; error: unknown } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    accountApi<{ resume: SubmittedResumeDocument }>('/api/account/applications/'+applicationId+'/resume',{ signal: controller.signal })
      .then(({ resume }) => { if (!controller.signal.aborted) setResult({ id: applicationId,revision,resume,error: null }); })
      .catch(error => { if (!controller.signal.aborted) setResult({ id: applicationId,revision,resume: null,error }); });
    return () => controller.abort();
  },[applicationId,revision]);
  const ready = result?.id === applicationId && result.revision === revision,resume = ready ? result.resume : null;
  if (!ready) return <div role="status" className="flex gap-2 py-5 text-sm text-muted-foreground"><Loader2 className="size-5 animate-spin" />{ru ? 'Загружаем резюме…' : 'Rezyume yuklanmoqda…'}</div>;
  if (!resume) return <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4"><p role="alert" className="text-sm text-rose-800">{result.error instanceof AccountApiError && result.error.status === 404 ? (ru ? 'Резюме больше недоступно.' : 'Rezyume endi mavjud emas.') : result.error instanceof AccountApiError && result.error.status === 401 ? (ru ? 'Войдите повторно, чтобы открыть резюме.' : 'Rezyumeni ochish uchun qayta kiring.') : (ru ? 'Не удалось загрузить резюме. Попробуйте ещё раз.' : 'Rezyumeni yuklab bo‘lmadi. Qayta urinib ko‘ring.')}</p><Button variant="outline" onClick={() => setRevision(value => value+1)}>{ru ? 'Повторить загрузку резюме' : 'Rezyumeni qayta yuklash'}</Button></div>;
  return <ResumeDocument resume={resume} lang={lang} />;
}

export function ResumeDocument({ resume,lang,variant = 'submitted' }: { resume: SubmittedResumeDocument;lang: 'ru' | 'uz';variant?: 'submitted' | 'catalog' }) {
  const ru = lang === 'ru';
  const Heading = variant === 'catalog' ? 'h2' : 'h4';
  const optionLabel = (options: ReadonlyArray<{ value: string; label_ru: string; label_uz: string }>,value: string | null) => { const option = options.find(item => item.value === value);return option ? ru ? option.label_ru : option.label_uz : value; };
  const location = [resume.regions,resume.districts].map(place => place && (ru ? place.name_ru || place.name_uz : place.name_uz || place.name_ru)).filter(Boolean).join(', ') || resume.city;
  const employment: Record<string,[string,string]> = { full_time: ['Полная занятость','To‘liq bandlik'],part_time: ['Частичная занятость','Qisman bandlik'],contract: ['По договору','Shartnoma'],internship: ['Стажировка','Stajirovka'],remote: ['Удалённая работа','Masofaviy ish'] };
  const languageLevel: Record<string,[string,string]> = { beginner: ['Начальный','Boshlang‘ich'],intermediate: ['Средний','O‘rta'],advanced: ['Продвинутый','Yuqori'],native: ['Родной','Ona tili'] };
  return <section aria-label={variant === 'catalog' ? (ru ? 'Полное резюме' : 'To‘liq rezyume') : (ru ? 'Полное резюме из отклика' : 'Arizadagi to‘liq rezyume')} className="space-y-5 rounded-xl border border-border bg-card p-4 text-sm break-words">
    {variant === 'submitted' && <div className="space-y-2"><h3 className="text-lg font-semibold text-foreground">{resume.title || (ru ? 'Резюме' : 'Rezyume')}</h3>{resume.full_name && <p className="font-medium">{resume.full_name}</p>}{location && <p className="text-muted-foreground">{location}</p>}<p className="text-xs leading-5 text-muted-foreground">{ru ? 'Резюме предоставлено в этом отклике. Его видимость в общем каталоге может быть отключена.' : 'Rezyume ushbu arizada taqdim etilgan. Umumiy katalogdagi ko‘rinishi o‘chirilgan bo‘lishi mumkin.'}</p></div>}
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">{[
      [ru ? 'Опыт' : 'Tajriba',resume.experience !== null || resume.experience_years !== null ? getExperienceLabel(resume.experience,resume.experience_years,lang) : null],
      [ru ? 'Образование' : 'Ta’lim',optionLabel(EDUCATION_OPTIONS,resume.education_level)],
      [ru ? 'Занятость' : 'Bandlik',resume.employment_type ? employment[resume.employment_type]?.[ru ? 0 : 1] || resume.employment_type : null],
      [ru ? 'Желаемая зарплата' : 'Kutilayotgan maosh',formatSalary(resume.expected_salary_min,resume.expected_salary_max,lang)],
      [ru ? 'Дата рождения' : 'Tug‘ilgan sana',resume.birth_date],[ru ? 'Пол' : 'Jins',optionLabel(GENDER_OPTIONS,resume.gender)],
    ].filter(([,value]) => value).map(([label,value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1">{value}</dd></div>)}</dl>
    {resume.phone && <p><span className="text-muted-foreground">{ru ? 'Телефон в резюме: ' : 'Rezyumedagi telefon: '}</span><a href={'tel:'+resume.phone} className="text-primary underline">{resume.phone}</a></p>}
    {resume.about && <div className="space-y-2"><Heading className="font-semibold">{ru ? 'О себе' : 'O‘zi haqida'}</Heading><p className="whitespace-pre-wrap leading-6">{resume.about}</p></div>}
    {!!resume.skills.length && <div className="space-y-2"><Heading className="font-semibold">{ru ? 'Навыки' : 'Ko‘nikmalar'}</Heading><div className="flex flex-wrap gap-2">{resume.skills.map((skill,index) => <Badge key={index} className="max-w-full whitespace-normal break-words bg-accent text-primary">{skill}</Badge>)}</div></div>}
    {!!resume.experience_details.length && <div className="space-y-3"><Heading className="font-semibold">{ru ? 'Опыт работы' : 'Ish tajribasi'}</Heading>{resume.experience_details.map((item,index) => <article key={index} className="space-y-1 border-l-2 border-border pl-3"><p className="font-medium">{[item.position,item.company].filter(Boolean).join(' · ')}</p><p className="text-xs text-muted-foreground">{[item.start_date,item.is_current ? ru ? 'По настоящее время' : 'Hozirgacha' : item.end_date].filter(Boolean).join(' — ')}</p>{item.description && <p className="whitespace-pre-wrap leading-6">{item.description}</p>}</article>)}</div>}
    {!!resume.education.length && <div className="space-y-3"><Heading className="font-semibold">{ru ? 'Обучение' : 'Ta’lim tarixi'}</Heading>{resume.education.map((item,index) => <article key={index} className="space-y-1 border-l-2 border-border pl-3"><p className="font-medium">{item.institution}</p><p>{[item.field,item.degree].filter(Boolean).join(' · ')}</p><p className="text-xs text-muted-foreground">{[item.start_year,item.end_year].filter(Boolean).join(' — ')}</p></article>)}</div>}
    {!!resume.languages.length && <div className="space-y-2"><Heading className="font-semibold">{ru ? 'Языки' : 'Tillar'}</Heading>{resume.languages.map((item,index) => {const name = LANGUAGES_LIST.find(option => option.value === item.name);return <p key={index}>{name ? ru ? name.label_ru : name.label_uz : item.name}{item.level && ' — '+(languageLevel[item.level]?.[ru ? 0 : 1] || item.level)}</p>;})}</div>}
  </section>;
}
