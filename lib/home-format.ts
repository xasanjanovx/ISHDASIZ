export function vacancyNoun(value: number | null | undefined, ru: boolean) {
  if (!ru) return 'ta vakansiya';
  if (value == null) return 'вакансий';
  const last = value % 10, lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return 'вакансий';
  return last === 1 ? 'вакансия' : last >= 2 && last <= 4 ? 'вакансии' : 'вакансий';
}

// Numeric parts avoid differing Uzbek month names in Node and browser ICU data.
export function tashkentStamp(value: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find(part => part.type === type)?.value || '';
  return `${get('day')}.${get('month')} ${get('hour')}:${get('minute')}`;
}
