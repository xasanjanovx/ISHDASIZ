'use client';
import {Suspense} from 'react';
import {PageLoading} from '@/components/layout/page-loading';
import {AccountGate} from '@/components/profile/account-gate';
import {ProfileLayout} from '@/components/profile/profile-layout';
import {ResumeCatalog} from '@/components/resumes/resume-catalog';
export default function SearchResumesPage(){return <Suspense fallback={<PageLoading/>}><AccountGate role="employer"><ProfileLayout userType="employer"><ResumeCatalog basePath="/profile/employer/search-resumes"/></ProfileLayout></AccountGate></Suspense>;}
