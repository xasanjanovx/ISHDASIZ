'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useUserAuth } from '@/contexts/user-auth-context';
import { useLanguage } from '@/contexts/language-context';
import { accountApi, AccountApiError } from '@/lib/account-api';
import { AccountGate } from './account-gate';
import { AccountClosure } from './account-closure';
import { ProfileLayout } from './profile-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LocationSelect } from '@/components/ui/location-select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, Save, User, Building2, CheckCircle, LogOut } from '@/components/ui/icons';
type Role = 'job_seeker' | 'employer';
const fields = ['full_name', 'birth_date', 'about', 'company_name', 'industry', 'address', 'email', 'website', 'description', 'inn', 'director_name', 'company_size', 'phone', 'telegram', 'region_id', 'district_id'];
const formOf = (profile: any) => Object.fromEntries(fields.map(key => [key, profile[key] == null ? '' : String(profile[key])]));
function errorText(error: unknown, lang: 'ru' | 'uz') {
  if (error instanceof AccountApiError) {
    if ((error.status === 400 || error.status === 409) && error.detail) { const parts = error.detail.split(' / '); return parts[lang === 'ru' ? 0 : 1] || parts[0]; }
    if (error.status === 401) return lang === 'ru' ? 'Войдите повторно, чтобы продолжить.' : 'Davom etish uchun qayta kiring.';
    if (error.status === 403) return lang === 'ru' ? 'Сначала создайте профиль этой роли при входе.' : 'Kirish paytida ushbu rol profilini yarating.';
  }
  return lang === 'ru' ? 'Не удалось загрузить или сохранить профиль. Попробуйте ещё раз.' : 'Profilni yuklab yoki saqlab bo‘lmadi. Qayta urinib ko‘ring.';
}
export function AccountProfile({ role, settings = false }: { role: Role; settings?: boolean }) {
  return <AccountGate role={role}><ProfileEditor role={role} settings={settings} /></AccountGate>;
}
function ProfileStats({ role }: { role: Role }) {
  const { lang } = useLanguage();
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ revision: number; stats: any; error: unknown } | null>(null);
  useEffect(() => {
    let cancelled = false; const controller = new AbortController();
    accountApi<{ stats: any }>(`/api/account/profile/stats?role=${role}`, { signal: controller.signal })
      .then(({ stats }) => { if (!cancelled) setResult({ revision, stats, error: null }); })
      .catch(error => { if (!cancelled) setResult({ revision, stats: null, error }); });
    return () => { cancelled = true; controller.abort(); };
  }, [role, revision]);
  const ready = result?.revision === revision;
  const labels = [role === 'employer' ? (lang === 'ru' ? 'Всего вакансий' : 'Jami vakansiyalar') : (lang === 'ru' ? 'Всего резюме' : 'Jami rezyumelar'), lang === 'ru' ? 'Отклики' : 'Arizalar', lang === 'ru' ? 'Просмотры' : 'Ko‘rishlar'];
  return <div className="space-y-3">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{['items', 'applications', 'views'].map((key, index) => <div key={key} className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{labels[index]}</p><p className="text-2xl font-semibold text-slate-950 mt-2">{ready && result.stats ? result.stats[key].toLocaleString(lang === 'ru' ? 'ru-RU' : 'uz-UZ') : '—'}</p>
    </div>)}</div>
    {ready && Boolean(result.error) && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-red-700">
      {lang === 'ru' ? 'Не удалось загрузить статистику.' : 'Statistikani yuklab bo‘lmadi.'}
      <Button variant="outline" onClick={() => setRevision(value => value + 1)}>{lang === 'ru' ? 'Повторить статистику' : 'Statistikani qayta yuklash'}</Button>
    </div>}
  </div>;
}
function ProfileEditor({ role, settings }: { role: Role; settings: boolean }) {
  const { lang } = useLanguage(); const { updateProfile, logout } = useUserAuth();
  const employer = role === 'employer';
  const [revision, setRevision] = useState(0), [loaded, setLoaded] = useState<{ revision: number; profile: any; error: unknown } | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false), [saveError, setSaveError] = useState<unknown>(null), [savedNotice, setSavedNotice] = useState(false);
  const [exitError, setExitError] = useState(false), [exiting, setExiting] = useState(false);
  const saveLock = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let cancelled = false; const controller = new AbortController();
    accountApi<{ profile: any }>(`/api/account/profile?role=${role}`, { signal: controller.signal })
      .then(({ profile }) => { if (!cancelled) { setLoaded({ revision, profile, error: null }); setForm(formOf(profile)); setSaveError(null); setSavedNotice(false); } })
      .catch(error => { if (!cancelled) setLoaded({ revision, profile: null, error }); });
    return () => { cancelled = true; controller.abort(); };
  }, [role, revision]);
  const reload = () => setRevision(value => value + 1);
  const profile = loaded?.revision === revision ? loaded.profile : null;
  const verified = employer && profile?.is_verified === true;
  const hasChanges = profile && JSON.stringify(form) !== JSON.stringify(formOf(profile));
  const change = (patch: Record<string, string>) => { setForm(previous => ({ ...previous, ...patch })); setSavedNotice(false); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!profile || saveLock.current || !hasChanges) return;
    saveLock.current = true; setSaving(true); setSaveError(null); setSavedNotice(false);
    const keys = employer ? ['company_name','industry','address','email','website','description','inn','director_name','company_size'] : ['full_name','birth_date','about'];
    const payload = Object.fromEntries([...keys,'phone','telegram'].map(key => [key, form[key] || null]));
    try {
      const result = await accountApi<{ profile: any }>(`/api/account/profile?role=${role}`, { method: 'PUT', body: JSON.stringify({ ...payload,
        region_id: form.region_id ? Number(form.region_id) : null, district_id: form.district_id ? Number(form.district_id) : null, expected_updated_at: profile.updated_at }) });
      if (!alive.current) return;
      setLoaded({ revision, profile: result.profile, error: null }); setForm(formOf(result.profile)); setSavedNotice(true);
      updateProfile(employer ? { company_name: result.profile.company_name || '' } : { full_name: result.profile.full_name || '' });
    } catch (error) { if (alive.current) setSaveError(error); }
    finally { saveLock.current = false; if (alive.current) setSaving(false); }
  };
  const exit = async () => {
    if (exiting) return; setExiting(true); setExitError(false);
    try { await logout(); } catch { if (alive.current) setExitError(true); }
    finally { if (alive.current) setExiting(false); }
  };
  const input = (key: string, ru: string, uz: string, options: { type?: string; max?: number; locked?: boolean } = {}) => <div key={key} className="space-y-2">
    <Label htmlFor={`profile-${key}`}>{lang === 'ru' ? ru : uz}</Label>
    <Input id={`profile-${key}`} type={options.type || 'text'} value={form[key] || ''} maxLength={options.max || 255}
      readOnly={options.locked} disabled={saving} onChange={event => change({ [key]: event.target.value })}
      className="rounded-xl border-slate-200 bg-white" />
  </div>;
  const name = profile?.[employer ? 'company_name' : 'full_name'];
  return <ProfileLayout userType={role} userName={name || undefined}>
    <div className="space-y-6">
      <div><p className="text-xs font-medium uppercase tracking-widest text-teal-700 mb-2">{lang === 'ru' ? 'Личный кабинет' : 'Shaxsiy kabinet'}</p>
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-950">{settings ? (lang === 'ru' ? 'Настройки аккаунта' : 'Akkaunt sozlamalari') : employer ? (lang === 'ru' ? 'Профиль компании' : 'Kompaniya profili') : (lang === 'ru' ? 'Мой профиль' : 'Mening profilim')}</h1>
      </div>
      {!settings && <ProfileStats role={role} />}
      {!loaded || loaded.revision !== revision ? <div role="status" className="flex gap-3 justify-center py-16 text-slate-600"><Loader2 className="h-6 w-6 animate-spin text-sky-600" />{lang === 'ru' ? 'Загружаем профиль…' : 'Profil yuklanmoqda…'}</div>
        : loaded.error ? <div role="alert" className="p-6 rounded-2xl border border-red-200 bg-red-50 space-y-4"><p className="text-red-700">{errorText(loaded.error, lang)}</p><Button variant="outline" onClick={reload}>{lang === 'ru' ? 'Повторить загрузку' : 'Qayta yuklash'}</Button></div>
        : <>
          <form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600">{employer ? <Building2 /> : <User />}</span>
              <h2 className="text-xl font-semibold text-slate-900">{employer ? (lang === 'ru' ? 'Данные компании' : 'Kompaniya ma’lumotlari') : (lang === 'ru' ? 'Личные данные' : 'Shaxsiy ma’lumotlar')}</h2>
              {verified && <span className="inline-flex gap-1 items-center text-sm rounded-full bg-teal-50 px-3 py-1 text-teal-700"><CheckCircle className="h-4 w-4" />{lang === 'ru' ? 'Компания подтверждена' : 'Kompaniya tasdiqlangan'}</span>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {employer ? <>{input('company_name','Название компании','Kompaniya nomi',{locked:verified})}{input('industry','Сфера деятельности','Faoliyat sohasi',{max:100})}
                {input('inn','ИНН','STIR',{max:20,locked:verified})}{input('director_name','Имя руководителя','Rahbar ismi',{locked:verified})}
                {input('company_size','Размер компании','Kompaniya hajmi',{max:100})}{input('website','Сайт компании','Kompaniya sayti',{max:2048})}
                {input('email','Email','Email',{type:'email',max:254})}</> : <>{input('full_name','ФИО','To‘liq ism')}{input('birth_date','Дата рождения','Tug‘ilgan sana',{type:'date',max:10})}</>}
              {input('phone','Контактный телефон','Aloqa telefoni',{type:'tel',max:25})}
              {input('telegram','Telegram (имя пользователя)','Telegram (foydalanuvchi nomi)',{max:100})}
            </div>
            <p className="text-sm text-slate-500">{lang === 'ru' ? 'Контактный телефон в профиле не меняет номер для входа.' : 'Profildagi aloqa telefoni kirish raqamini o‘zgartirmaydi.'}</p>
            <LocationSelect selectedRegion={form.region_id} selectedDistrict={form.district_id} disabled={saving}
              onRegionChange={region_id => change({ region_id, district_id: '' })} onDistrictChange={district_id => change({ district_id })} />
            {employer && input('address','Адрес','Manzil',{max:1000})}
            <div className="space-y-2"><Label htmlFor="profile-description">{employer ? (lang === 'ru' ? 'О компании' : 'Kompaniya haqida') : (lang === 'ru' ? 'О себе' : 'O‘zingiz haqingizda')}</Label>
              <Textarea id="profile-description" value={form[employer ? 'description' : 'about'] || ''} disabled={saving} maxLength={10000} className="min-h-32 rounded-xl"
                onChange={event => change({ [employer ? 'description' : 'about']: event.target.value })} />
            </div>
            {employer && <p className="text-sm text-slate-500">{verified && (lang === 'ru' ? 'Подтверждённые реквизиты защищены от изменения. ' : 'Tasdiqlangan rekvizitlarni o‘zgartirishdan himoyalangan. ')}<Link href="/profile/employer/verification" className="text-sky-700 underline">{lang === 'ru' ? 'Подтверждение компании' : 'Kompaniyani tasdiqlash'}</Link></p>}
            {saveError != null && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3 text-red-700"><p>{errorText(saveError, lang)}</p>
              <p className="text-sm">{lang === 'ru' ? 'Введённые данные остаются в форме.' : 'Kiritilgan ma’lumotlar formada qoladi.'}</p>
              {saveError instanceof AccountApiError && saveError.status === 409 && <AlertDialog>
                <AlertDialogTrigger asChild><Button type="button" variant="outline">{lang === 'ru' ? 'Загрузить актуальную версию' : 'Joriy versiyani yuklash'}</Button></AlertDialogTrigger>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{lang === 'ru' ? 'Обновить профиль?' : 'Profil yangilansinmi?'}</AlertDialogTitle>
                  <AlertDialogDescription>{lang === 'ru' ? 'Несохранённые изменения в этой форме будут заменены данными из профиля.' : 'Formadagi saqlanmagan o‘zgarishlar profildagi ma’lumotlar bilan almashtiriladi.'}</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>{lang === 'ru' ? 'Оставить форму' : 'Formani saqlab qolish'}</AlertDialogCancel><AlertDialogAction onClick={reload}>{lang === 'ru' ? 'Обновить' : 'Yangilash'}</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>}
            </div>}
            {savedNotice && <p role="status" className="text-teal-700">{lang === 'ru' ? 'Профиль сохранён' : 'Profil saqlandi'}</p>}
            <div className="flex flex-wrap gap-3 justify-end">
              <Button type="button" variant="outline" disabled={!hasChanges || saving} onClick={() => { setForm(formOf(profile)); setSaveError(null); setSavedNotice(false); }}>{lang === 'ru' ? 'Отменить изменения' : 'O‘zgarishlarni bekor qilish'}</Button>
              <Button type="submit" disabled={!hasChanges || saving} className="bg-sky-600 hover:bg-sky-700 rounded-xl">{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}{lang === 'ru' ? 'Сохранить изменения' : 'O‘zgarishlarni saqlash'}</Button>
            </div>
          </form>
          {settings ? <>
            <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-7 space-y-4"><h2 className="text-xl font-semibold">{lang === 'ru' ? 'Вход и безопасность' : 'Kirish va xavfsizlik'}</h2>
              <div className="space-y-2"><Label htmlFor="account-phone">{lang === 'ru' ? 'Номер для входа' : 'Kirish raqami'}</Label><Input id="account-phone" value={profile.account_phone} readOnly className="max-w-sm bg-slate-50" /></div>
              <p className="text-sm text-slate-500">{lang === 'ru' ? 'Смена номера для входа требует подтверждения нового номера по SMS.' : 'Kirish raqamini almashtirish yangi raqamni SMS orqali tasdiqlashni talab qiladi.'}</p>
              <Button type="button" variant="outline" onClick={exit} disabled={exiting}><LogOut className="h-4 w-4 mr-2" />{lang === 'ru' ? 'Выйти на этом устройстве' : 'Ushbu qurilmada chiqish'}</Button>
              {exitError && <p role="alert" className="text-red-700">{lang === 'ru' ? 'Не удалось завершить сеанс. Попробуйте ещё раз.' : 'Seansni yakunlab bo‘lmadi. Qayta urinib ko‘ring.'}</p>}
            </section>
            <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-7 space-y-3"><h2 className="text-xl font-semibold">{lang === 'ru' ? 'Сообщения и отклики' : 'Xabarlar va arizalar'}</h2>
              <p className="text-sm text-slate-500">{lang === 'ru' ? 'Новые сообщения и изменения статусов доступны в личном кабинете.' : 'Yangi xabarlar va holat o‘zgarishlari shaxsiy kabinetda mavjud.'}</p>
              <div className="flex gap-4 flex-wrap"><Link href={`/profile/${role}/messages`} className="text-sky-700 underline">{lang === 'ru' ? 'Открыть сообщения' : 'Xabarlarni ochish'}</Link><Link href={`/profile/${role}/applications`} className="text-sky-700 underline">{lang === 'ru' ? 'Открыть отклики' : 'Arizalarni ochish'}</Link></div>
            </section>
            <AccountClosure />
          </> : !employer && <section className="rounded-2xl border border-teal-200 bg-teal-50 p-5 space-y-3">
            <h2 className="font-semibold text-teal-900">{lang === 'ru' ? 'Поиск работы' : 'Ish qidirish'}</h2>
            <p className="text-sm text-teal-800">{lang === 'ru' ? 'Создайте резюме и управляйте его видимостью в разделе «Мои резюме».' : 'Rezyume yarating va uning ko‘rinishini «Mening rezyumelarim» bo‘limida boshqaring.'}</p>
            <Link href="/profile/job-seeker/resumes" className="text-sky-700 underline">{lang === 'ru' ? 'Мои резюме' : 'Mening rezyumelarim'}</Link>
          </section>}
        </>}
    </div>
  </ProfileLayout>;
}
