'use client';

import { Suspense, useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageLoading } from '@/components/layout/page-loading';
import { useLanguage } from '@/contexts/language-context';
import { useSession } from '@/lib/contexts/session-context';
import { chatResponseSchema, type ChatMessage } from '@/lib/ai/chat-contract';
import { AIJobCard } from '@/components/ai/ai-job-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2, MapPin, Sparkles, RotateCcw } from '@/components/ui/icons';

export default function AISearchPage() {
  return <Suspense fallback={<PageLoading />}><ReadyConversation /></Suspense>;
}
function ReadyConversation() {
  const { ready, sessionId, messages } = useSession();
  const searchParams = useSearchParams();
  const [initialQuery, setInitialQuery] = useState(() => searchParams.get('q')?.trim().slice(0, 2000) || '');
  const consumeQuery = useCallback(() => setInitialQuery(''), []);
  return ready ? <Conversation key={sessionId} initialQuery={messages.length ? '' : initialQuery} consumeQuery={consumeQuery} /> : <PageLoading />;
}
function Conversation({ initialQuery, consumeQuery }: { initialQuery: string; consumeQuery: () => void }) {
  const { lang, t } = useLanguage();
  const { messages, profile, updateProfile, setMessages, userLocation, requestLocation, resetSession } = useSession();
  const [input, setInput] = useState(initialQuery);
  const [pending, setPending] = useState<{ query: string; history: ChatMessage[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [geo, setGeo] = useState<'idle' | 'loading' | 'error'>('idle');
  const active = useRef<AbortController | null>(null), alive = useRef(false), initialProcessed = useRef(false);
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; active.current?.abort(); }; }, []);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [messages, pending, loading]);

  const send = useCallback(async (query: string, history: ChatMessage[]) => {
    if (active.current || !query.trim()) return;
    const controller = new AbortController(); active.current = controller;
    setLoading(true); setError(false); setPending({ query, history });
    try {
      const response = await fetch('/api/chat', { method: 'POST', cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query, messages: history.slice(-20).map(({ role, content }) => ({ role, content })), profile, user_location: userLocation, lang }),
      });
      if (!response.ok) throw new Error('Search unavailable');
      const result = chatResponseSchema.safeParse(await response.json());
      if (!result.success) throw new Error('Invalid search response');
      if (!alive.current || controller.signal.aborted) return;
      setMessages([...history, { role: 'user', content: query }, { role: 'assistant', content: result.data.response, jobs: result.data.jobs }]);
      updateProfile(result.data.profile); setPending(null);
      setInput(current => current.trim() === query ? '' : current);
    } catch {
      if (alive.current && !controller.signal.aborted) setError(true);
    } finally {
      if (active.current === controller) active.current = null;
      if (alive.current && !controller.signal.aborted) setLoading(false);
    }
  }, [lang, profile, userLocation, setMessages, updateProfile]);

  useEffect(() => {
    // Start only after the tab session is ready. Cleanup cancels Strict Mode's first scheduled pass.
    let cancelled = false;
    if (initialQuery && !initialProcessed.current) {
      queueMicrotask(() => {
        if (cancelled || initialProcessed.current) return;
        initialProcessed.current = true;
        consumeQuery();
        void send(initialQuery, messages);
      });
    }
    return () => { cancelled = true; };
  }, [initialQuery, messages, send, consumeQuery]);

  const locate = async () => {
    if (geo === 'loading') return;
    setGeo('loading');
    const location = await requestLocation();
    if (alive.current) setGeo(location ? 'idle' : 'error');
  };
  const question = lang === 'ru' ? 'Какую работу ищете?' : 'Qanday ish qidiryapsiz?';
  const displayMessages: ChatMessage[] = pending ? [...messages, { role: 'user', content: pending.query }] : messages;
  return <section className="min-h-[calc(100dvh-4rem)] bg-gradient-to-b from-accent via-background to-card px-4 py-7 md:py-10" aria-label={t.ai.title}>
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0"><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-accent px-3 py-1 text-xs font-semibold text-primary"><Sparkles className="h-3.5 w-3.5" />{lang === 'ru' ? 'Работа по всему Узбекистану' : 'Butun O‘zbekiston bo‘ylab ish'}</div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">{t.ai.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{lang === 'ru' ? 'Расскажите о навыках, городе и желаемой зарплате. Поможем подобрать вакансии.' : 'Ko‘nikmalar, hudud va kerakli maoshni yozing. Mos vakansiyalarni topishga yordam beramiz.'}</p>
        </div>
        <Button variant="outline" size="sm" onClick={resetSession} className="shrink-0 gap-2 bg-card" aria-label={lang === 'ru' ? 'Новый диалог' : 'Yangi suhbat'}><RotateCcw className="h-4 w-4" /><span className="hidden sm:inline">{lang === 'ru' ? 'Новый диалог' : 'Yangi suhbat'}</span></Button>
      </div>
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-lg shadow-primary/40">
        <div ref={log} role="log" aria-label={lang === 'ru' ? 'Диалог поиска работы' : 'Ish qidirish suhbati'} aria-live="polite" className="h-[clamp(220px,calc(100dvh-32rem),480px)] space-y-5 sm:h-[clamp(220px,calc(100dvh-24rem),540px)] overflow-y-auto p-4 md:p-6">
          {displayMessages.length === 0 && <div className="flex h-full flex-col items-center justify-center text-center"><div className="mb-4 rounded-2xl bg-accent p-4 text-primary"><Sparkles className="h-7 w-7" /></div><h2 className="text-lg font-semibold text-foreground">{question}</h2><p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{lang === 'ru' ? 'Например: «Ищу работу оператором в Ташкенте, знаю Excel». Можно уточнять условия в диалоге.' : 'Masalan: «Toshkentda operatorlik ishini qidiryapman, Excelni bilaman». Suhbatda shartlarni aniqlashtirishingiz mumkin.'}</p></div>}
          {displayMessages.map((message, index) => <div key={index} className={message.role === 'user' ? 'ml-8 flex justify-end' : 'mr-2'}><div className={message.role === 'user' ? 'max-w-full rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm text-white' : 'w-full rounded-2xl rounded-tl-sm border border-border bg-background px-4 py-3 text-sm text-foreground'}><p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>{message.jobs?.length ? <div className="mt-4 space-y-3">{message.jobs.map(job => <AIJobCard key={job.id} job={job} />)}</div> : null}</div></div>)}
          {loading && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" />{t.ai.thinking}</p>}
        </div>
        <div className="border-t border-border p-4 md:p-5">
          {error && <div role="alert" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p>{lang === 'ru' ? 'Не удалось получить ответ. Ваш запрос сохранён — попробуйте ещё раз.' : 'Javob olinmadi. So‘rovingiz saqlandi — qayta urinib ko‘ring.'}</p><Button variant="outline" size="sm" className="mt-2 bg-card" onClick={() => pending && void send(pending.query, pending.history)}>{lang === 'ru' ? 'Повторить' : 'Qayta urinish'}</Button></div>}
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {userLocation ? <span className="flex items-center gap-1.5 text-primary"><MapPin className="h-3.5 w-3.5" />{lang === 'ru' ? 'Местоположение определено' : 'Joylashuv aniqlandi'}</span> : <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground" disabled={geo === 'loading'} onClick={() => void locate()}><MapPin className="h-3.5 w-3.5" />{lang === 'ru' ? 'Поиск рядом' : 'Yaqinimda qidirish'}</Button>}
            <span>{lang === 'ru' ? 'История сохраняется в этой вкладке' : 'Suhbat shu brauzer oynasida saqlanadi'}</span>
          </div>
          {geo === 'error' && <p role="alert" className="mb-3 text-sm text-amber-800">{lang === 'ru' ? 'Не удалось определить местоположение. Проверьте разрешение браузера или укажите город в сообщении.' : 'Joylashuv aniqlanmadi. Brauzer ruxsatini tekshiring yoki hududni xabarda yozing.'}</p>}
          <form onSubmit={event => { event.preventDefault(); void send(input.trim(), messages); }} className="flex items-center gap-2">
            <Input aria-label={question} maxLength={2000} value={input} onChange={event => setInput(event.target.value)} placeholder={question} className="h-12 min-w-0 rounded-xl border-border bg-background text-base" />
            <Button type="submit" disabled={loading || !input.trim()} aria-label={lang === 'ru' ? 'Отправить' : 'Yuborish'} className="h-12 w-12 shrink-0 rounded-xl bg-primary p-0 hover:bg-primary"><Send className="h-4 w-4" /></Button>
          </form>
        </div>
      </div>
    </div>
  </section>;
}
