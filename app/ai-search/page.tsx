'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { supabase } from '@/lib/supabase';
import { JobCard } from '@/components/jobs/job-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { JobWithRelations, Category, District } from '@/types/database';
import { Send, User, Bot, Loader2 } from '@/components/ui/icons';
import Image from 'next/image';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  jobs?: JobWithRelations[];
}

export default function AISearchPage() {
  const { lang, t } = useLanguage();
  const { user } = useUserAuth();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [allJobs, setAllJobs] = useState<JobWithRelations[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const initialQueryProcessed = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [jobsRes, catRes, distRes] = await Promise.all([
        supabase.from('jobs').select('*, categories(*), districts(*, regions(*))').eq('status', 'active'),
        supabase.from('categories').select('*'),
        supabase.from('districts').select('*'),
      ]);
      setAllJobs(jobsRes.data || []);
      setCategories(catRes.data || []);
      setDistricts(distRes.data || []);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-send query from URL params (from AI widget redirect)
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
  }, [searchParams]);



  const performSearch = async (query: string, history: Message[]) => {
    setLoading(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: history.map(m => ({ role: m.role, content: m.content })),
          userId: user?.id
        }),
      });
      const data = await response.json();

      if (data.response) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.response, jobs: data.jobs }
        ]);
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
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setInput('');
    setMessages(newMessages);
    performSearch(userMessage, messages);
  };


  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-sky-600 to-sky-700 text-white py-6">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2 text-white relative z-10">
            <Image src="/ai-sparkle.png" alt="AI" width={28} height={28} className="w-7 h-7" />
            {t.ai.title}
          </h1>
          <p className="text-sky-100 mt-1">{t.ai.placeholder}</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Card className="min-h-[60vh]">
          <CardContent className="p-0 flex flex-col h-[60vh]">
            <ScrollArea ref={scrollRef} className="flex-1 p-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <Image src="/ai-sparkle.png" alt="AI" width={48} height={48} className="w-12 h-12 mb-4" />
                  <h2 className="text-xl font-semibold text-slate-900 mb-2">
                    {lang === 'uz' ? 'AI Yordamchiga xush kelibsiz!' : 'Добро пожаловать в AI помощник!'}
                  </h2>
                  <p className="text-slate-500 mb-6 max-w-md">{t.ai.placeholder}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                      {msg.role === 'assistant' && (
                        <Image src="/ai-sparkle.png" alt="AI" width={32} height={32} className="w-8 h-8 flex-shrink-0" />
                      )}
                      <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                        <div
                          className={`rounded-2xl px-4 py-2 ${msg.role === 'user'
                            ? 'bg-sky-600 text-white rounded-tr-sm'
                            : 'bg-slate-100 text-slate-900 rounded-tl-sm'
                            }`}
                        >
                          {msg.content}
                        </div>
                        {msg.jobs && msg.jobs.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {msg.jobs.map((job) => (
                              <JobCard key={job.id} job={job} />
                            ))}
                          </div>
                        )}
                      </div>
                      {msg.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-slate-600" />
                        </div>
                      )}
                    </div>
                  ))}
                  {loading && (
                    <div className="flex gap-3">
                      <Image src="/ai-sparkle.png" alt="AI" width={32} height={32} className="w-8 h-8" />
                      <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-2 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t.ai.thinking}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            <div className="p-4 border-t">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex gap-2"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={lang === 'uz' ? 'Qanday ish qidiryapsiz?' : 'Какую работу ищете?'}
                  className="flex-1"
                  autoFocus
                />
                <Button type="submit" disabled={loading || !input.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
