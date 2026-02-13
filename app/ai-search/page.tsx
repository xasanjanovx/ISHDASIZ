'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { useSession } from '@/lib/contexts/session-context';
import { AIJobCard } from '@/components/ai/ai-job-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, User, Loader2, MapPin } from '@/components/ui/icons';
import Image from 'next/image';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  jobs?: any[];
}

export default function AISearchPage() {
  const { lang, t } = useLanguage();
  const { sessionId, profile, updateProfile, userLocation, requestLocation } = useSession();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const initialQueryProcessed = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const performSearch = useCallback(async (query: string, history: Message[]) => {
    setLoading(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          session_id: sessionId,
          messages: history.map(m => ({ role: m.role, content: m.content })),
          user_location: userLocation
        }),
      });
      const data = await response.json();

      if (data.response) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.response, jobs: data.jobs }
        ]);

        // Update profile from server
        if (data.profile) {
          updateProfile(data.profile);
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: lang === 'uz' ? 'Xatolik yuz berdi. Iltimos qayta urinib ko\'ring.' : 'Произошла ошибка. Попробуйте еще раз.' }
      ]);
    } finally {
      setLoading(false);
    }
  }, [lang, sessionId, updateProfile, userLocation]);

  // Auto-send query from URL params
  useEffect(() => {
    const q = searchParams.get('q');
    if (q && !initialQueryProcessed.current) {
      initialQueryProcessed.current = true;
      setInput(q);
      const userMsg: Message = { role: 'user', content: q };
      setMessages([userMsg]);
      performSearch(q, []);
      setInput('');
    }
  }, [searchParams, performSearch]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setInput('');
    setMessages(newMessages);
    performSearch(userMessage, messages);
  };

  const handleRequestLocation = async () => {
    setGeoLoading(true);
    const location = await requestLocation();
    setGeoLoading(false);

    if (location) {
      // Add system message about location
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `📍 Joylashuvingiz aniqlandi! Endi yaqiningizda ish qidirish uchun soha yozing.` }
      ]);
    } else {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Joylashuvni aniqlab bo'lmadi. Brauzer sozlamalarini tekshiring.` }
      ]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-indigo-900 text-white py-8 relative overflow-hidden flex-shrink-0">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl opacity-20 translate-x-1/2 -translate-y-1/2"></div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <h1 className="text-2xl md:text-3xl font-black flex items-center gap-3 text-white">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <Image src="/ai-sparkle.png" alt="AI" width={24} height={24} className="w-6 h-6" />
            </div>
            {t.ai.title}
          </h1>
          <p className="text-indigo-200 mt-2 max-w-xl text-lg">{t.ai.placeholder}</p>

          {/* Location indicator */}
          {userLocation && (
            <div className="mt-2 flex items-center gap-2 text-emerald-300 text-sm">
              <MapPin className="w-4 h-4" />
              Joylashuv aniqlangan
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-4xl flex-1 flex flex-col h-full">
        <Card className="flex-1 flex flex-col shadow-xl border-slate-200/60 bg-white rounded-3xl overflow-hidden h-[600px]">
          <CardContent className="p-0 flex flex-col h-full">
            <ScrollArea ref={scrollRef} className="flex-1 p-6 bg-slate-50/50">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="w-20 h-20 bg-white rounded-3xl shadow-lg flex items-center justify-center mb-6 animate-pulse">
                    <Image src="/ai-sparkle.png" alt="AI" width={48} height={48} className="w-12 h-12" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 mb-2">
                    {lang === 'uz' ? 'AI Yordamchiga xush kelibsiz!' : 'Добро пожаловать в AI помощник!'}
                  </h2>
                  <p className="text-slate-500 mb-6 max-w-md leading-relaxed">{t.ai.placeholder}</p>

                  {/* Geo button */}
                  {!userLocation && (
                    <Button
                      variant="outline"
                      className="mb-4 gap-2"
                      onClick={handleRequestLocation}
                      disabled={geoLoading}
                    >
                      {geoLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <MapPin className="w-4 h-4" />
                      )}
                      {lang === 'uz' ? 'Joylashuvni aniqlash' : 'Определить местоположение'}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                      {msg.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-200 mt-1">
                          <Image src="/ai-sparkle.png" alt="AI" width={16} height={16} className="w-4 h-4 brightness-0 invert" />
                        </div>
                      )}
                      <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                        <div
                          className={`rounded-2xl px-5 py-3.5 shadow-sm text-sm md:text-base leading-relaxed ${msg.role === 'user'
                            ? 'bg-indigo-600 text-white rounded-tr-sm'
                            : 'bg-white text-slate-800 border border-slate-100 rounded-tl-sm'
                            }`}
                        >
                          {msg.content}
                        </div>
                        {msg.jobs && msg.jobs.length > 0 && (
                          <div className="mt-4 space-y-3">
                            {msg.jobs.map((job) => (
                              <div key={job.id} className="scale-95 origin-top-left">
                                <AIJobCard job={job} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {msg.role === 'user' && (
                        <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0 mt-1">
                          <User className="w-4 h-4 text-slate-600" />
                        </div>
                      )}
                    </div>
                  ))}
                  {loading && (
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-200">
                        <Image src="/ai-sparkle.png" alt="AI" width={16} height={16} className="w-4 h-4 brightness-0 invert" />
                      </div>
                      <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-5 py-3 flex items-center gap-3 shadow-sm">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                        <span className="text-slate-500 font-medium text-sm">{t.ai.thinking}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            <div className="p-4 md:p-5 border-t border-slate-100 bg-white">
              {/* Geo button in input area if not set */}
              {!userLocation && messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mb-2 text-xs text-slate-500 gap-1"
                  onClick={handleRequestLocation}
                  disabled={geoLoading}
                >
                  <MapPin className="w-3 h-3" />
                  {lang === 'uz' ? 'Yaqinimda qidirish' : 'Поиск рядом'}
                </Button>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex gap-3 relative"
              >
                <div className="relative flex-1">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={lang === 'uz' ? 'Qanday ish qidiryapsiz?' : 'Какую работу ищете?'}
                    className="h-12 bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-300 rounded-xl pl-4 pr-12 text-base transition-all shadow-sm"
                    autoFocus
                  />
                  <Button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="absolute right-1 top-1 h-10 w-10 p-0 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
