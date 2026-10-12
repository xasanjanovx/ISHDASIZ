import { NextRequest } from 'next/server';
import { finishVerification } from '@/lib/identity-verification';

export async function GET(request: NextRequest) {
    return finishVerification(request, 'eri');
}
