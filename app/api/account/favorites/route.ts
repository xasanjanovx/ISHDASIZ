import {NextRequest} from 'next/server';
import {accountFailure,accountResult,checkSameOrigin,requireAccount} from '@/lib/auth/account';
import {requireChatRole} from '@/lib/account-chat';
import {savedJobsPage,setFavorite} from '@/lib/account-saved-jobs';
export async function GET(request:NextRequest){try{const {client,user}=await requireAccount(request);await requireChatRole(client,user.id,'job_seeker');return accountResult(await savedJobsPage(client,user.id,'favorites',request.nextUrl.searchParams.get('before')));}catch(error){return accountFailure(error);}}
export async function PUT(request:NextRequest){try{checkSameOrigin(request);const {client,user}=await requireAccount(request);await requireChatRole(client,user.id,'job_seeker');const body=await request.json().catch(()=>null);return accountResult(await setFavorite(client,user.id,body?.job_id,body?.favorite,user.session_version||0));}catch(error){return accountFailure(error);}}
