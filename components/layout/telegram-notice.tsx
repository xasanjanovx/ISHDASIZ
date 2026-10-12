'use client';
import { useTelegram } from '@/contexts/telegram-context';
import { useLanguage } from '@/contexts/language-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { Button } from '@/components/ui/button';

export function TelegramNotice() {
  const { isTelegram, error, retry, isLoading } = useTelegram();
  const { lang } = useLanguage(), { openModal } = useAuthModal();
  if (!isTelegram || !error || error === 'cancelled') return null;
  const messages = {
    link: ['Telegram hisobingiz saytga ulanmagan. Telefon raqamingiz orqali kiring.', 'Telegram ещё не связан с аккаунтом сайта. Войдите по номеру телефона.'],
    closed: ['Hisob yopilgan. SMS orqali kirib, uni tiklashingiz mumkin.', 'Аккаунт закрыт. Войдите через SMS, чтобы восстановить его.'],
    expired: ['Telegram kirish muddati tugadi. Botdan saytni qayta oching yoki telefon orqali kiring.', 'Срок Telegram-входа истёк. Откройте сайт заново из бота или войдите по телефону.'],
    conflict: ['Boshqa hisobga kirilgan. Telefon orqali kirishni davom ettiring.', 'Уже выполнен вход в другой аккаунт. Продолжите вход по телефону.'],
    unavailable: ['Telegram orqali kirib bo‘lmadi. Qayta urinib ko‘ring yoki telefon orqali kiring.', 'Не удалось войти через Telegram. Повторите попытку или войдите по телефону.'],
  };
  return <aside role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-3"><div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 text-sm text-amber-950"><p className="flex-1">{messages[error][lang === 'ru' ? 1 : 0]}</p>{error === 'unavailable' && <Button variant="outline" size="sm" disabled={isLoading} onClick={retry}>{lang === 'ru' ? 'Повторить' : 'Qayta urinish'}</Button>}<Button size="sm" onClick={openModal}>{lang === 'ru' ? 'Войти по телефону' : 'Telefon orqali kirish'}</Button></div></aside>;
}
