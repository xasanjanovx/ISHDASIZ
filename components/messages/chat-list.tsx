'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUserAuth } from '@/contexts/user-auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { ProfileLayout } from '@/components/profile/profile-layout';
import { Button } from '@/components/ui/button';
import { Archive, Loader2, MessageSquare, ArrowUpRight } from 'lucide-react';
import { accountApi, accountErrorText } from '@/lib/account-api';
import type { ChatRole } from '@/lib/account-chat';
import { toast } from 'sonner';

interface ChatSummary { id: string; name: string; lastMessage: string; lastMessageAt: string; unread: number }
interface ChatPage { conversations: ChatSummary[]; nextOffset: number | null }
const chatBase = (role: ChatRole) => `/profile/${role === 'employer' ? 'employer' : 'job-seeker'}/messages`;

export function ChatList({role}:{role:ChatRole}) {
 const {user,isLoading}=useUserAuth();
 return <ChatListContent key={String(isLoading?'pending':user?.id||'guest')+':'+role} role={role}/>;
}
function ChatListContent({ role }: { role: ChatRole }) {
    const { user, isLoading: authLoading } = useUserAuth();
    const userId = user?.id;
    const { lang } = useLanguage();
    const { openModal } = useAuthModal();
    const router = useRouter();
    const params = useSearchParams();
    const partner = params.get('chat_with');
    const [chats, setChats] = useState<ChatSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [nextOffset, setNextOffset] = useState<number | null>(null);
    const [moreLoading, setMoreLoading] = useState(false);
    const [archiving, setArchiving] = useState<string | null>(null);
    const sequence = useRef(0);
    const pageCount = useRef(1);
    const alive = useRef(false);
    useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
    const cancelPending = useCallback(() => { sequence.current++; }, []);

    const load = useCallback(async (offset = 0) => {
        if (!userId) return;
        const current = ++sequence.current;
        try {
            // Reload all loaded pages so sorting, archive changes and counters stay consistent.
            const pages = offset ? [await accountApi<ChatPage>(`/api/account/chat?role=${role}&offset=${offset}`)]
                : await Promise.all(Array.from({ length: pageCount.current }, (_, i) => accountApi<ChatPage>(`/api/account/chat?role=${role}&offset=${i * 25}`)));
            if (current !== sequence.current) return;
            const rows = pages.flatMap(p => p.conversations);
            setChats(prev => Array.from(new Map((offset ? [...prev, ...rows] : rows).map(c => [c.id, c])).values()));
            setNextOffset(pages.at(-1)?.nextOffset ?? null);
            if (offset) pageCount.current = offset / 25 + 1;
            setError('');
        } catch (err) { if (current === sequence.current) setError(accountErrorText(err, lang)); }
        finally { if (current === sequence.current) { setLoading(false); setMoreLoading(false); } }
    }, [userId, role, lang]);

    useEffect(() => {
        if (authLoading || !userId) return;
        load();
        const timer = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 20000);
        return () => { cancelPending(); clearInterval(timer); };
    }, [load, authLoading, userId, cancelPending]);

    useEffect(() => {
        if (!partner || !userId) return;
        let cancelled = false;
        accountApi<{ id: string }>('/api/account/chat', { method: 'POST', body: JSON.stringify({ role, userId: partner }) })
            .then(data => { if (!cancelled) router.replace(`${chatBase(role)}/${data.id}`); })
            .catch(err => { if (!cancelled) setError(accountErrorText(err, lang)); });
        return () => { cancelled = true; };
    }, [partner, userId, role, router, lang]);

    const archive = async (id: string) => {
        if (archiving) return;
        setArchiving(id);
        cancelPending();
        try {
            await accountApi(`/api/account/chat/${id}?role=${role}`, { method: 'DELETE' });
            if(!alive.current)return;
            cancelPending();
            setChats(prev => prev.filter(c => c.id !== id));
            window.dispatchEvent(new CustomEvent('messagesRead'));
            toast.success(lang === 'ru' ? 'Чат скрыт. Новое сообщение вернёт его в список.' : 'Chat yashirildi. Yangi xabar kelganda yana ko‘rinadi.', {
                action: { label: lang === 'ru' ? 'Вернуть' : 'Qaytarish', onClick: async () => {
                    if(!alive.current)return;
                    try { await accountApi(`/api/account/chat/${id}`, { method: 'PATCH', body: JSON.stringify({ action: 'restore',role }) }); if(alive.current)await load(); }
                    catch (err) { if(alive.current)toast.error(accountErrorText(err, lang)); }
                } },
            });
            await load();
        } catch (err) { if(alive.current)toast.error(accountErrorText(err, lang)); }
        finally { if(alive.current)setArchiving(null); }
    };

    return <ProfileLayout userType={role} userName={role === 'employer' ? user?.company_name || undefined : user?.full_name || undefined}>
        <div className="mb-6"><h1 className="text-3xl font-semibold tracking-tight text-slate-950">{lang === 'ru' ? 'Сообщения' : 'Xabarlar'}</h1>
            <p className="mt-2 text-sm text-slate-500">{lang === 'ru' ? 'Обсуждайте работу напрямую в личном чате.' : 'Ish haqida shaxsiy chatda bevosita suhbatlashing.'}</p></div>
        {authLoading || (Boolean(user) && loading) ? <div role="status" aria-label={lang === 'ru' ? 'Загрузка' : 'Yuklanmoqda'} className="flex justify-center p-12"><Loader2 className="h-7 w-7 animate-spin text-blue-600" /></div>
            : !user ? <div className="rounded-2xl border bg-white p-8"><p className="mb-4">{lang === 'ru' ? 'Войдите, чтобы открыть переписку.' : 'Xabarlarni ko‘rish uchun kiring.'}</p><Button onClick={openModal}>{lang === 'ru' ? 'Войти' : 'Kirish'}</Button></div>
                : error ? <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><p>{error}</p><Button variant="outline" className="mt-4" onClick={() => {setLoading(true);load();}}>{lang === 'ru' ? 'Повторить' : 'Qayta urinish'}</Button></div>
                    : chats.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center"><MessageSquare className="mx-auto mb-4 h-10 w-10 text-blue-500" /><h2 className="font-semibold">{lang === 'ru' ? 'Пока нет переписки' : 'Hozircha suhbatlar yo‘q'}</h2><p className="mt-2 text-sm text-slate-500">{lang === 'ru' ? 'Найдите подходящую вакансию или кандидата, чтобы начать разговор.' : 'Suhbatni boshlash uchun mos vakansiya yoki nomzod toping.'}</p><Link href={role === 'employer' ? '/resumes' : '/jobs'} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-600">{lang === 'ru' ? 'Перейти к поиску' : 'Qidiruvga o‘tish'}<ArrowUpRight className="h-4 w-4" /></Link></div>
                        : <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">{chats.map(chat => <div key={chat.id} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50">
                            <Link href={`${chatBase(role)}/${chat.id}`} className="flex min-w-0 flex-1 items-center gap-4 py-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 font-semibold text-blue-700">{chat.name.slice(0, 1)}</div><div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-900">{chat.name}</p><p className="mt-1 truncate text-sm text-slate-500">{chat.lastMessage || (lang === 'ru' ? 'Начните разговор' : 'Suhbatni boshlang')}</p></div><div className="shrink-0 text-right"><time className="text-xs text-slate-400">{new Date(chat.lastMessageAt).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-UZ')}</time>{chat.unread > 0 && <span className="ml-auto mt-1 block w-fit rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">{chat.unread}</span>}</div></Link>
                            <button disabled={!!archiving} onClick={() => archive(chat.id)} aria-label={lang === 'ru' ? `Скрыть чат с ${chat.name}` : `${chat.name} bilan chatni yashirish`} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"><Archive className="h-4 w-4" /></button></div>)}</div>}
        {nextOffset !== null && !error && <Button variant="outline" className="mt-4" disabled={moreLoading} onClick={() => {setMoreLoading(true);load(nextOffset);}}>{lang === 'ru' ? 'Ещё чаты' : 'Yana chatlar'}</Button>}
    </ProfileLayout>;
}
