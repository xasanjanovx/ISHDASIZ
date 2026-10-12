'use client';
import {Suspense} from 'react';
import {PageLoading} from '@/components/layout/page-loading';
import {CompanyVerificationPage} from '@/components/profile/company-verification';
export default function VerificationPage(){return <Suspense fallback={<PageLoading/>}><CompanyVerificationPage/></Suspense>;}
