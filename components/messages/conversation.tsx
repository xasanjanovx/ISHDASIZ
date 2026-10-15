'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { ProfileLayout } from '@/components/profile/profile-layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Briefcase, Loader2, Send } from 'lucide-react';
import { accountApi, accountErrorText, AccountApiError } from '@/lib/account-api';
import type { ChatRole } from '@/lib/account-chat';
import {JobOffers} from './job-offers';
import { toast } from 'sonner';

import { orderChatMessages,type ChatMessage as Message } from '@/lib/chat-messages';
interface MessagePage { messages: Message[]; name: string; more: boolean; cursor?: string; can_send?: boolean }

export function Conversation({role}:{role:ChatRole}) {
 const {id}=useParams(),{user,isLoading}=useUserAuth();
 return <ConversationContent key={String(isLoading?'pending':user?.id||'guest')+':'+role+':'+String(id)} role={role}/>;
}
function ConversationContent({ role }: { role: ChatRole }) {
    const { id } = useParams();
    const conversationId = String(id);
    const { user, isLoading: authLoading } = useUserAuth();
    const userId = user?.id;
    const { lang } = useLanguage();
    const { openModal } = useAuthModal();
    const [messages, setMessages] = useState<Message[]>([]);
    const [name, setName] = useState('');
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [canSend,setCanSend] = useState(false);
    const pendingSend = useRef<{ id: string;content: string } | null>(null);
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true;return () => { mounted.current = false; }; },[]);
    const [sending, setSending] = useState(false);
    const [olderLoading, setOlderLoading] = useState(false);
    const [olderCursor, setOlderCursor] = useState<string>();
    const [hasOlder, setHasOlder] = useState(false);
    const [offerOpen, setOfferOpen] = useState(false);
    const newest = useRef<string | undefined>(undefined);
    const sendingRef = useRef(false);
    const pollingRef = useRef(false);
    const generation = useRef(0);
    const invalidate = useCallback(() => { generation.current++; }, []);
    const viewport = useRef<HTMLDivElement>(null);
    const nearBottom = useRef(true);

    const readThrough = useCallback(async (message?: Message) => {
        if (!message || document.visibilityState !== 'visible') return;
        try {
            await accountApi(`/api/account/chat/${conversationId}`, { method: 'PATCH', body: JSON.stringify({ action: 'read', through: message.id,role }) });
            window.dispatchEvent(new CustomEvent('messagesRead'));
        } catch { /* A failed read receipt must not hide the conversation. */ }
    }, [conversationId,role]);

    const load = useCallback(async (cursor?: string, older = false) => {
        if (!userId || pollingRef.current) return;
        pollingRef.current = true;
        const current = generation.current;
        if (older) setOlderLoading(true);
        const scrollHeight = viewport.current?.scrollHeight || 0;
        try {
            const query = new URLSearchParams({ role });
            if (cursor) query.set(older ? 'before' : 'after', cursor);
            const data = await accountApi<MessagePage>(`/api/account/chat/${conversationId}?${query}`);
            if (current !== generation.current) return;
            setName(data.name);
            setCanSend(data.can_send !== false);
            setMessages(prev => cursor ? orderChatMessages([...prev, ...data.messages]) : data.messages);
            if (older || !cursor) { setHasOlder(data.more); setOlderCursor(data.messages[0]?.id); }
            if (!older && data.messages.length) newest.current = data.messages.at(-1)?.id;
            setError('');
            if (!older) await readThrough(data.messages.at(-1));
            requestAnimationFrame(() => {
                if (current !== generation.current) return;
                if (older && viewport.current) viewport.current.scrollTop += viewport.current.scrollHeight - scrollHeight;
                else if ((!cursor || nearBottom.current) && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
            });
        } catch (err) { if (current === generation.current) { setError(accountErrorText(err, lang));if (err instanceof AccountApiError && [401,403,404,423].includes(err.status)) setCanSend(false); } }
        finally { pollingRef.current = false; if (current === generation.current) { setLoading(false); setOlderLoading(false); } }
    }, [userId, role, conversationId, lang, readThrough]);

    useEffect(() => {
        if (authLoading || !userId) return;
        load(newest.current);
        const timer = setInterval(() => { if (document.visibilityState === 'visible') load(newest.current); }, 5000);
        const visible = () => { if (document.visibilityState === 'visible') load(newest.current); };
        document.addEventListener('visibilitychange', visible);
        return () => { invalidate(); clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
    }, [load, authLoading, userId, invalidate]);

    const send = async (content: string) => {
        const trimmed = content.trim();
        if (sendingRef.current || !canSend || !user || !trimmed || trimmed.length > 4000) return false;
        sendingRef.current = true;setSending(true);
        try {
            if (pendingSend.current?.content !== trimmed) pendingSend.current = { id: crypto.randomUUID(),content: trimmed };
            const request = pendingSend.current;
            const data = await accountApi<{ message: Message }>(`/api/account/chat/${conversationId}`, { method: 'POST', body: JSON.stringify({ role,content: trimmed,request_id: request.id }) });
            if (!mounted.current) return false;
            setMessages(prev => orderChatMessages([...prev,data.message]));
            pendingSend.current = null;
            // Only fetched messages advance the polling cursor, so simultaneous incoming messages are retained.
            nearBottom.current = true;
            requestAnimationFrame(() => { if (mounted.current && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight; });
            return true;
        } catch (err) {
            if (mounted.current) {
                if (err instanceof AccountApiError && [401,403,404,423].includes(err.status)) setCanSend(false);
                if (err instanceof AccountApiError && [401,403,404].includes(err.status)) setError(accountErrorText(err,lang));
                toast.error(err instanceof AccountApiError && err.status === 409 ? (lang === 'ru' ? 'Сообщение изменилось. Проверьте черновик.' : 'Xabar o‘zgardi. Qoralamani tekshiring.') : err instanceof AccountApiError && [401,403,404,423].includes(err.status) ? accountErrorText(err,lang) : (lang === 'ru' ? 'Не удалось подтвердить отправку. Черновик сохранён. Попробуйте ещё раз.' : 'Xabar yuborilganini tasdiqlab bo‘lmadi. Qoralama saqlandi. Qayta urinib ko‘ring.'));
            }
            return false;
        } finally { sendingRef.current = false;if (mounted.current) setSending(false); }
    };

    return <ProfileLayout userType={role} userName={role === 'employer' ? user?.company_name || undefined : user?.full_name || undefined}>
        <Link href={`/profile/${role === 'employer' ? 'employer' : 'job-seeker'}/messages`} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground"><ArrowLeft className="h-4 w-4" />{lang === 'ru' ? 'Все сообщения' : 'Barcha xabarlar'}</Link>
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4"><h1 className="font-semibold text-foreground">{name || (lang === 'ru' ? 'Личный чат' : 'Shaxsiy chat')}</h1><p className="mt-1 text-xs text-muted-foreground">{lang === 'ru' ? 'Обсудите условия работы с собеседником.' : 'Suhbatdoshingiz bilan ish shartlarini muhokama qiling.'}</p></div>
            {!user && !authLoading ? <div className="p-8"><p className="mb-4">{lang === 'ru' ? 'Войдите, чтобы открыть чат.' : 'Chatni ochish uchun kiring.'}</p><Button onClick={openModal}>{lang === 'ru' ? 'Войти' : 'Kirish'}</Button></div>
                : loading || authLoading ? <div role="status" className="flex justify-center p-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
                    : <>
                        {error && <div role="alert" className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm"><p>{error}</p><Button variant="outline" size="sm" className="mt-2" onClick={() => load(newest.current)}>{lang === 'ru' ? 'Повторить' : 'Qayta urinish'}</Button></div>}
                        {name && !canSend && !error && <p role="status" className="border-b border-border bg-background p-4 text-sm text-muted-foreground">{lang === 'ru' ? 'Собеседник временно недоступен. История переписки сохранена.' : 'Suhbatdosh vaqtincha mavjud emas. Yozishmalar tarixi saqlangan.'}</p>}
                        <div ref={viewport} role="log" aria-label={lang === 'ru' ? 'Сообщения чата' : 'Chat xabarlari'} aria-live="polite" onScroll={() => { if (viewport.current) nearBottom.current = viewport.current.scrollHeight - viewport.current.scrollTop - viewport.current.clientHeight < 100; }} className={(canSend ? 'h-[50vh] min-h-[280px]' : 'max-h-[50vh] min-h-[180px]')+' space-y-4 overflow-y-auto bg-background/70 px-4 py-5 md:px-6'}>
                            {hasOlder && <div className="text-center"><Button size="sm" variant="outline" disabled={olderLoading} onClick={() => load(olderCursor, true)}>{lang === 'ru' ? 'Предыдущие сообщения' : 'Oldingi xabarlar'}</Button></div>}
                            {!error && messages.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">{lang === 'ru' ? 'Напишите первое сообщение.' : 'Birinchi xabarni yozing.'}</p>}
                            {messages.map(message => <div key={message.id} className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${message.sender_id === user?.id ? 'rounded-br-sm bg-primary text-white' : 'rounded-bl-sm border border-border bg-card text-foreground'}`}><p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.content.split(/(https?:\/\/[^\s]+)/g).map((part, i) => /^https?:\/\//.test(part) ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline">{part}</a> : part)}</p><time className="mt-1 block text-right text-xs opacity-60">{new Date(message.created_at).toLocaleTimeString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { hour: '2-digit', minute: '2-digit' })}</time></div></div>)}
                        </div>
                        
                        {name && canSend && <form className="border-t border-border p-4" onSubmit={async event => { event.preventDefault(); const draft = text; if (await send(draft)) setText(current => current === draft ? '' : current); }}>
                            <label htmlFor="chat-message" className="sr-only">{lang === 'ru' ? 'Ваше сообщение' : 'Xabaringiz'}</label><Textarea id="chat-message" value={text} onChange={event => setText(event.target.value)} maxLength={4000} disabled={sending} placeholder={lang === 'ru' ? 'Напишите сообщение…' : 'Xabar yozing…'} className="min-h-[72px] resize-none border-border" />
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{text.length}/4000</span><div className="flex gap-2">{role === 'employer' && <Dialog open={offerOpen} onOpenChange={setOfferOpen}><DialogTrigger asChild><Button type="button" variant="outline" size="sm"><Briefcase className="mr-2 h-4 w-4" />{lang === 'ru' ? 'Предложить работу' : 'Ish taklif qilish'}</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{lang === 'ru' ? 'Ваши активные вакансии' : 'Faol vakansiyalaringiz'}</DialogTitle><DialogDescription>{lang==='ru'?'Выбор добавит предложение в черновик. Проверьте текст и нажмите «Отправить».':'Tanlov taklifni qoralamaga qo‘shadi. Matnni tekshiring va «Yuborish» tugmasini bosing.'}</DialogDescription></DialogHeader>{offerOpen&&<JobOffers disabled={sending} onSelect={async job=>{const title=lang==='ru'?job.title_ru||job.title_uz:job.title_uz||job.title_ru;const offer=`${lang==='ru'?'Предлагаем рассмотреть нашу вакансию':'Vakansiyamizni ko‘rib chiqishni taklif qilamiz'}: ${title|| (lang==='ru'?'Вакансия':'Vakansiya')}\n${window.location.origin}/jobs/${job.id}`;const draft=[text,offer].filter(value=>value.trim()).join('\n\n');if(draft.length>4000){toast.error(lang==='ru'?'Сократите черновик, чтобы добавить предложение.':'Taklifni qo‘shish uchun qoralamani qisqartiring.');return;}setText(draft);setOfferOpen(false);}}/>}</DialogContent></Dialog>}
                                <Button size="sm" type="submit" disabled={sending || !text.trim()} className="bg-primary hover:bg-primary">{sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}{lang === 'ru' ? 'Отправить' : 'Yuborish'}</Button></div></div>
                        </form>}
                    </>}
        </section>
    </ProfileLayout>;
}
