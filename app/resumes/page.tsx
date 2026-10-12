'use client';
import {Suspense} from 'react';
import {PageLoading} from '@/components/layout/page-loading';
import {ResumeCatalog} from '@/components/resumes/resume-catalog';
export default function ResumesPage(){return <Suspense fallback={<PageLoading/>}><ResumeCatalog/></Suspense>;}
