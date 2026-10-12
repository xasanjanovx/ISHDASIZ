/** Employer scheduling uses Uzbekistan time regardless of the browser timezone. */
export function interviewFromLocal(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [,year,month,day,hour,minute] = m, date = new Date(Date.UTC(+year,+month-1,+day));
  if (+year < 2000 || +year > 2199 || +hour > 23 || +minute > 59 || date.getUTCFullYear() !== +year || date.getUTCMonth() !== +month-1 || date.getUTCDate() !== +day) return null;
  return value+':00+05:00';
}
export function interviewToLocal(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  const parts = new Intl.DateTimeFormat('en-GB',{ timeZone: 'Asia/Tashkent',year: 'numeric',month: '2-digit',day: '2-digit',hour: '2-digit',minute: '2-digit',hourCycle: 'h23' }).formatToParts(new Date(value));
  const at = (type: string) => parts.find(part => part.type === type)?.value || '';
  return at('year')+'-'+at('month')+'-'+at('day')+'T'+at('hour')+':'+at('minute');
}
