'use client';
import { useId, useState } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MAX_JOB_SALARY, type JobSalaryRange } from '@/lib/search-ranges';

export function JobSalaryFilter({ value, onChange }: { value: JobSalaryRange; onChange: (range: JobSalaryRange) => void }) {
  const { lang, t } = useLanguage(), ru = lang === 'ru', id = useId();
  const key = value.join('-');
  const [draft, setDraft] = useState({ base: key, min: value[0] ? String(value[0]) : '', max: value[1] === undefined ? '' : String(value[1]) });
  const current = draft.base === key ? draft : { base: key, min: value[0] ? String(value[0]) : '', max: value[1] === undefined ? '' : String(value[1]) };
  const parse = (text: string) => /^\d*$/.test(text.replace(/\s/g, '')) ? Number(text.replace(/\s/g, '')) : NaN;
  const min = parse(current.min), max = current.max.trim() ? parse(current.max) : undefined;
  const invalid = !Number.isSafeInteger(min) || min > MAX_JOB_SALARY || max !== undefined && (!Number.isSafeInteger(max) || min > max || max > MAX_JOB_SALARY);
  function edit(field: 'min' | 'max', text: string) {
    const next = { ...current, [field]: text };
    setDraft(next);
    const from = parse(next.min), to = next.max.trim() ? parse(next.max) : undefined;
    if (Number.isSafeInteger(from) && from <= MAX_JOB_SALARY && (to === undefined || Number.isSafeInteger(to) && from <= to && to <= MAX_JOB_SALARY)) onChange([from, to]);
  }
  return <div className="space-y-3">
    <p className="text-sm font-medium">{t.filters.salary}, {ru ? 'сум' : 'so‘m'}</p>
    <div className="grid grid-cols-2 gap-2">
      {(['min', 'max'] as const).map(field => <div key={field} className="space-y-1.5">
        <Label htmlFor={`${id}-${field}`} className="text-xs text-muted-foreground">{field === 'min' ? (ru ? 'От' : 'Dan') : (ru ? 'До' : 'Gacha')}</Label>
        <Input id={`${id}-${field}`} type="text" inputMode="numeric" maxLength={24} autoComplete="off" value={current[field]} onChange={event => edit(field, event.target.value)} aria-label={field === 'min' ? (ru ? 'Зарплата от' : 'Maosh, dan') : (ru ? 'Зарплата до' : 'Maosh, gacha')} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined} placeholder={field === 'min' ? '0' : (ru ? 'Без лимита' : 'Cheklanmagan')} className="h-11" />
      </div>)}
    </div>
    {invalid ? <p id={`${id}-error`} role="alert" className="text-sm text-red-700">{ru ? 'Введите целые суммы. «От» не должно превышать «До». Изменение ещё не применено.' : 'Butun summalarni kiriting. «Dan» qiymati «Gacha»dan oshmasin. O‘zgarish hali qo‘llanmadi.'}</p> : (value[0] > 0 || value[1] !== undefined) && <p className="text-xs leading-relaxed text-muted-foreground">{ru ? 'Показываем объявления с указанной зарплатой в выбранном диапазоне.' : 'Tanlangan oraliqda maoshi ko‘rsatilgan e’lonlar chiqariladi.'}</p>}
  </div>;
}
