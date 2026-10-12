import { NextRequest } from 'next/server';
import { accountFailure, accountResult, requireAccount } from '@/lib/auth/account';
import { chatRole, requireChatRole, unreadMessages } from '@/lib/account-chat';

export async function GET(request: NextRequest) {
    try {
        const { client, user } = await requireAccount(request);
        const role = chatRole(request.nextUrl.searchParams.get('role'));
        await requireChatRole(client, user.id, role);
        return accountResult({ unread: await unreadMessages(client, user.id, role) });
    } catch (error) { return accountFailure(error); }
}
