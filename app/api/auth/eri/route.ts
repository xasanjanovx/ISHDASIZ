import { NextRequest } from 'next/server';
import { startVerification } from '@/lib/identity-verification';

export async function GET(request: NextRequest) {
    return startVerification(request, 'eri');
}
