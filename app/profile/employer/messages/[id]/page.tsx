'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { ProfileLayout } from '@/components/profile/profile-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, Loader2, User } from '@/components/ui/icons';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fetchEmployerOwnedJobs } from '@/lib/employer-jobs';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Briefcase } from 'lucide-react';


interface Message {
    id: string;
    content: string;
    sender_id: string;
    created_at: string;
}

interface Participant {
    id: string;
    name: string;
}

export default function EmployerConversationPage() {
    const { lang } = useLanguage();
    const { user } = useUserAuth();
    const params = useParams();
    const router = useRouter();
    const conversationId = params.id as string;

    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [participant, setParticipant] = useState<Participant | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        const fetchConversation = async () => {
            if (!user?.id || !conversationId) {
                setIsLoading(false);
                return;
            }

            try {
                // Get conversation
                const { data: conv } = await supabase
                    .from('conversations')
                    .select('*')
                    .eq('id', conversationId)
                    .single();

                if (conv) {
                    const otherUserId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id;

                    // Get other user's profile
                    const { data: profile } = await supabase
                        .from('job_seeker_profiles')
                        .select('full_name')
                        .eq('user_id', otherUserId)
                        .single();

                    const { data: otherUser } = await supabase
                        .from('users')
                        .select('phone')
                        .eq('id', otherUserId)
                        .single();

                    setParticipant({
                        id: otherUserId,
                        name: profile?.full_name || otherUser?.phone || 'User',
                    });
                }

                // Get messages
                const { data: msgs } = await supabase
                    .from('messages')
                    .select('id, content, sender_id, created_at')
                    .eq('conversation_id', conversationId)
                    .order('created_at', { ascending: true });

                setMessages(msgs || []);

                // Mark as read
                await supabase
                    .from('messages')
                    .update({ is_read: true })
                    .eq('conversation_id', conversationId)
                    .neq('sender_id', user.id);

                // Dispatch event to refresh header indicator
                window.dispatchEvent(new CustomEvent('messagesRead'));

            } catch (err: any) {
                console.error('Error fetching conversation:', err);
                if (err.code === '42703') {
                    toast.error(lang === 'uz' ? 'Chat tizimi hali tayyor emas (DB sync error)' : 'Система чата еще не готова (ошибка БД)');
                }
            }
            setIsLoading(false);
        };

        fetchConversation();
    }, [user?.id, conversationId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Real-time subscription
    useEffect(() => {
        if (!conversationId) return;

        const subscription = supabase
            .channel(`messages:employer:${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`,
                },
                (payload) => {
                    setMessages((prev) => [...prev, payload.new as Message]);
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [conversationId]);

    const handleSend = async () => {
        if (!newMessage.trim() || !user?.id || !conversationId) return;

        const tempMessage: Message = {
            id: `temp-${Date.now()}`,
            content: newMessage.trim(),
            sender_id: user.id,
            created_at: new Date().toISOString(),
        };

        // Optimistic update - add message immediately
        setMessages((prev) => [...prev, tempMessage]);
        const messageContent = newMessage.trim();
        setNewMessage('');

        setSending(true);
        try {
            const { error } = await supabase
                .from('messages')
                .insert({
                    conversation_id: conversationId,
                    sender_id: user.id,
                    content: messageContent,
                });

            if (error) {
                // Rollback on error
                setMessages((prev) => prev.filter(m => m.id !== tempMessage.id));
                throw error;
            }
        } catch (err) {
            console.error('Error sending message:', err);
            toast.error(lang === 'ru' ? 'Ошибка отправки' : 'Yuborishda xatolik');
        }
        setSending(false);
    };

    if (isLoading) {
        return (
            <ProfileLayout userType="employer" userName="Kompaniya">
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                </div>
            </ProfileLayout>
        );
    }

    return (
        <ProfileLayout userType="employer" userName="Kompaniya">
            <div className="flex flex-col h-[calc(100vh-180px)] bg-slate-50/50 rounded-3xl border border-slate-200/60 p-4 md:p-6 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-200/60 bg-white/60 -mx-4 md:-mx-6 -mt-4 md:-mt-6 px-4 md:px-6 pt-4 md:pt-6 rounded-t-3xl backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <Link href="/profile/employer/messages">
                            <Button variant="ghost" size="icon" className="hover:bg-slate-100 rounded-xl">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-200">
                                    {participant?.name?.[0]?.toUpperCase() || <User className="w-6 h-6" />}
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white"></div>
                            </div>
                            <div>
                                <h2 className="font-bold text-slate-900 text-lg">
                                    {participant?.name || (lang === 'ru' ? 'Соискатель' : 'Nomzod')}
                                </h2>
                                <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                    {lang === 'ru' ? 'Онлайн' : 'Onlayn'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto space-y-4 pb-4">
                    {messages.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                            {lang === 'ru' ? 'Нет сообщений' : 'Xabarlar yo\'q'}
                        </div>
                    ) : (
                        messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                            >
                                <div
                                    className={`max-w-[80%] md:max-w-[70%] p-4 rounded-3xl shadow-sm border ${msg.sender_id === user?.id
                                        ? 'bg-indigo-600 text-white rounded-br-none border-indigo-500 shadow-indigo-100'
                                        : 'bg-white text-slate-900 rounded-bl-none border-slate-200'
                                        }`}
                                >
                                    <p className="text-sm leading-relaxed font-medium">{msg.content}</p>
                                    <div className={`flex items-center gap-1.5 mt-2 justify-end ${msg.sender_id === user?.id ? 'text-indigo-100/70' : 'text-slate-400'}`}>
                                        <time className="text-[10px] font-bold uppercase tracking-tighter">
                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </time>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="flex bg-white p-2 rounded-xl border border-slate-200 shadow-sm gap-2">
                    {/* Offer Job Button */}
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50" title={lang === 'ru' ? 'Предложить вакансию' : 'Vakansiya taklif qilish'}>
                                <Briefcase className="w-5 h-5" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{lang === 'ru' ? 'Предложить вакансию' : 'Vakansiya taklif qilish'}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-2 max-h-[60vh] overflow-y-auto py-2">
                                <OfferVacancyList onSelect={async (jobId, jobTitle) => {
                                    const link = `${window.location.origin}/jobs/${jobId}`;
                                    const text = lang === 'ru'
                                        ? `Здравствуйте! Приглашаем вас рассмотреть нашу вакансию: ${jobTitle}\n${link}`
                                        : `Assalomu alaykum! Sizni ushbu vakansiyamizni ko'rib chiqishga taklif qilamiz: ${jobTitle}\n${link}`;

                                    // Send message
                                    try {
                                        const { error } = await supabase.from('messages').insert({
                                            conversation_id: conversationId,
                                            sender_id: user?.id,
                                            content: text
                                        });
                                        if (error) throw error;
                                        toast.success(lang === 'ru' ? 'Приглашение отправлено' : 'Taklifnoma yuborildi');
                                    } catch (e) {
                                        toast.error(lang === 'ru' ? 'Ошибка отправки' : 'Xatolik yuz berdi');
                                    }
                                }} />
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Input
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
                        placeholder={lang === 'ru' ? 'Введите сообщение...' : 'Xabar yozing...'}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                        disabled={sending}
                    />
                    <Button onClick={handleSend} disabled={sending || !newMessage.trim()} className="h-9 w-9 p-0 rounded-lg bg-indigo-600 hover:bg-indigo-700">
                        {sending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                    </Button>
                </div>
            </div>
        </ProfileLayout>
    );
}

function OfferVacancyList({ onSelect }: { onSelect: (id: string, title: string) => void }) {
    const { lang } = useLanguage();
    const { user } = useUserAuth();
    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadJobs = async () => {
            if (!user?.id) {
                setJobs([]);
                setLoading(false);
                return;
            }
            const ownedJobs = await fetchEmployerOwnedJobs(supabase, user.id, {
                select: 'id, title_uz, title_ru, is_active, status, employer_id, created_by, user_id, created_at',
                limit: 100
            });
            const activeJobs = ownedJobs.filter((job: any) => {
                const status = String(job?.status || '').toLowerCase();
                const isFilled = status === 'filled' || status === 'closed' || status === 'archived';
                const isPaused = status === 'inactive' || status === 'paused' || status === 'on_hold' || job?.is_active === false;
                return !isFilled && !isPaused;
            });
            setJobs(activeJobs);
            setLoading(false);
        };

        loadJobs();
    }, [user?.id]);

    if (loading) return <div className="text-center py-4"><Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500" /></div>;
    if (jobs.length === 0) return <div className="text-center py-6 text-slate-500">{lang === 'ru' ? 'Нет активных вакансий' : 'Faol vakansiyalar yo\'q'}</div>;

    return (
        <div className="space-y-2">
            {jobs.map(job => (
                <div key={job.id}
                    onClick={() => onSelect(job.id, lang === 'uz' ? job.title_uz : job.title_ru)}
                    className="p-3 rounded-lg border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 cursor-pointer transition-colors group"
                >
                    <h4 className="font-semibold text-slate-900 group-hover:text-indigo-700">
                        {lang === 'uz' ? job.title_uz : job.title_ru}
                    </h4>
                    <p className="text-xs text-slate-500">{lang === 'ru' ? 'Активная вакансия' : 'Faol vakansiya'}</p>
                </div>
            ))}
        </div>
    );
}
