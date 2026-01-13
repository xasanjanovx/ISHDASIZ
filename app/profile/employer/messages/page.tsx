'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { ProfileLayout } from '@/components/profile/profile-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Loader2, User, Trash2 } from '@/components/ui/icons';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Conversation {
    id: string;
    user1_id: string;
    user2_id: string;
    last_message: string | null;
    updated_at: string;
    other_user_name: string | null;
    unread_count: number;
}

export default function EmployerMessagesPage() {
    const { lang } = useLanguage();
    const { user } = useUserAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const chatWithUserId = searchParams.get('chat_with');

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Handle chat_with param
    useEffect(() => {
        const initChat = async () => {
            if (!user?.id || !chatWithUserId) return;

            // Prevent self-chat
            if (user.id === chatWithUserId) {
                router.push('/profile/employer/messages');
                return;
            }

            try {
                // Check if internal conversation exists
                const { data: existing } = await supabase
                    .from('conversations')
                    .select('id')
                    .or(`and(user1_id.eq.${user.id},user2_id.eq.${chatWithUserId}),and(user1_id.eq.${chatWithUserId},user2_id.eq.${user.id})`)
                    .maybeSingle();

                if (existing) {
                    router.push(`/profile/employer/messages/${existing.id}`);
                    return;
                }

                // Create new conversation with role info
                const { data: newConv, error } = await supabase
                    .from('conversations')
                    .insert({
                        user1_id: user.id,
                        user1_role: 'employer',
                        user2_id: chatWithUserId,
                        user2_role: 'job_seeker',
                        updated_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (error) throw error;
                if (newConv) {
                    router.push(`/profile/employer/messages/${newConv.id}`);
                }
            } catch (err: any) {
                console.error('Error initiating chat:', err);
                if (err.code === '42703' || err.message?.includes('user1_id')) {
                    toast.error(lang === 'ru' ? 'Система чата не настроена (DB Sync Error)' : 'Chat tizimi sozlanmagan (DB Sync Error)');
                } else {
                    toast.error(lang === 'ru' ? 'Ошибка при создании чата' : 'Chat yaratishda xatolik');
                }
            }
        };

        initChat();
    }, [user?.id, chatWithUserId, router]);

    useEffect(() => {
        const fetchConversations = async () => {
            if (!user?.id) {
                setIsLoading(false);
                return;
            }
            // ... rest of fetchConversations logic unchanged

            try {
                // Get all conversations where user is participant
                const { data, error } = await supabase
                    .from('conversations')
                    .select('*')
                    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
                    .order('updated_at', { ascending: false });

                if (error) {
                    console.log('Conversations not available:', error.code);
                    setConversations([]);
                    setIsLoading(false);
                    return;
                }

                // Filter: only show chats where OTHER user has job_seeker_profile
                // This ensures employers only see chats with job seekers
                const enriched: Conversation[] = [];

                for (const conv of data || []) {
                    // Strict Role Check: If role columns exist, ensure we are participating as 'employer'
                    const myRole = conv.user1_id === user.id ? conv.user1_role : conv.user2_role;
                    if (myRole && myRole !== 'employer') {
                        continue; // Skip chats where I am acting as job_seeker or admin
                    }

                    const otherUserId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id;

                    // Check if other user has job_seeker_profile
                    const { data: jsProfile } = await supabase
                        .from('job_seeker_profiles')
                        .select('full_name')
                        .eq('user_id', otherUserId)
                        .single();

                    // Only include if other user is a job seeker
                    // (This is still useful for legacy chats where roles might be null)
                    if (!jsProfile) continue;

                    // Count unread messages
                    const { count } = await supabase
                        .from('messages')
                        .select('id', { count: 'exact', head: true })
                        .eq('conversation_id', conv.id)
                        .eq('is_read', false)
                        .neq('sender_id', user.id);

                    enriched.push({
                        ...conv,
                        other_user_name: jsProfile.full_name || null,
                        unread_count: count || 0,
                    });
                }

                setConversations(enriched);
            } catch (err) {
                console.log('Conversations feature not available');
                setConversations([]);
            }
            setIsLoading(false);
        };

        fetchConversations();
    }, [user?.id, lang]);

    const handleDeleteChat = async (conversationId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const confirmed = window.confirm(
            lang === 'ru'
                ? 'Удалить этот чат? Все сообщения будут удалены.'
                : 'Bu chatni o\'chirmoqchimisiz? Barcha xabarlar o\'chiriladi.'
        );

        if (!confirmed) return;

        try {
            // Delete all messages in the conversation first
            const { error: msgError } = await supabase
                .from('messages')
                .delete()
                .eq('conversation_id', conversationId);

            if (msgError) {
                console.error('Error deleting messages:', msgError);
                // Continue anyway - messages might not exist
            }

            // Delete the conversation
            const { error: convError } = await supabase
                .from('conversations')
                .delete()
                .eq('id', conversationId);

            if (convError) {
                console.error('Error deleting conversation:', convError);
                toast.error(lang === 'ru' ? 'Ошибка: нет прав на удаление' : 'Xatolik: o\'chirish huquqi yo\'q');
                return;
            }

            setConversations(prev => prev.filter(c => c.id !== conversationId));
            toast.success(lang === 'ru' ? 'Чат удален' : 'Chat o\'chirildi');
        } catch (err) {
            console.error('Error deleting chat:', err);
            toast.error(lang === 'ru' ? 'Ошибка при удалении' : 'O\'chirishda xatolik');
        }
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
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        {lang === 'ru' ? 'Сообщения' : 'Xabarlar'}
                    </h1>
                    <p className="text-slate-500 mt-1">
                        {lang === 'ru' ? 'Переписка с соискателями' : 'Nomzodlar bilan yozishmalar'}
                    </p>
                </div>

                {/* Conversations List */}
                {conversations.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                                <MessageCircle className="w-8 h-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">
                                {lang === 'ru' ? 'Нет сообщений' : 'Xabarlar yo\'q'}
                            </h3>
                            <p className="text-slate-500">
                                {lang === 'ru'
                                    ? 'Здесь появятся ваши переписки'
                                    : 'Bu yerda yozishmalaringiz ko\'rinadi'}
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {conversations.map((conv) => (
                            <Link key={conv.id} href={`/profile/employer/messages/${conv.id}`}>
                                <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                                                <User className="w-6 h-6 text-slate-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="font-semibold text-slate-900 truncate">
                                                        {conv.other_user_name || (lang === 'ru' ? 'Соискатель' : 'Nomzod')}
                                                    </h3>
                                                    <span className="text-xs text-slate-400">
                                                        {new Date(conv.updated_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-500 truncate mt-1">
                                                    {conv.last_message || (lang === 'ru' ? 'Нет сообщений' : 'Xabar yo\'q')}
                                                </p>
                                            </div>
                                            {conv.unread_count > 0 && (
                                                <Badge className="bg-violet-500">
                                                    {conv.unread_count}
                                                </Badge>
                                            )}
                                            <button
                                                onClick={(e) => handleDeleteChat(conv.id, e)}
                                                className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                                title={lang === 'ru' ? 'Удалить чат' : 'Chatni o\'chirish'}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </ProfileLayout>
    );
}
