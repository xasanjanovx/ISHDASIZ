import { ChatList } from '@/components/messages/chat-list';
import { Suspense } from 'react';
import { PageLoading } from '@/components/layout/page-loading';
export default function MessagesPage() { return <Suspense fallback={<PageLoading />}><ChatList role="employer" /></Suspense>; }
