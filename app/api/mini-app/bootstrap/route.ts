import {accountFailure,accountResult} from '@/lib/auth/account';
import {miniPublicBootstrap} from '@/lib/mini-app/bootstrap';
export const dynamic='force-dynamic';
export async function GET(){try{
 return accountResult(await miniPublicBootstrap());
}catch(e){return accountFailure(e);}}
