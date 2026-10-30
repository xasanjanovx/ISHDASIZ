import {NextRequest,NextResponse} from 'next/server';
export async function GET(request:NextRequest){return NextResponse.redirect(new URL('/mini-app-preview/index.html',request.url));}
