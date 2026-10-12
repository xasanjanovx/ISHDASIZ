'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { AccountGate } from '@/components/profile/account-gate';
import { ProfileLayout } from '@/components/profile/profile-layout';
import { SubmittedResume } from '@/components/profile/submitted-resume';
import { Button } from '@/components/ui/button';
export default function ApplicationResumePage() {
  const params = useParams(),{ lang } = useLanguage(),ru = lang === 'ru';
  const id = typeof params.id === 'string' ? params.id : '';
  return <AccountGate role="employer"><ProfileLayout userType="employer"><div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold text-slate-900">{ru ? 'Резюме из отклика' : 'Arizadagi rezyume'}</h1><Button asChild variant="outline"><Link href="/profile/employer/applications">{ru ? 'К откликам' : 'Arizalarga'}</Link></Button></div><SubmittedResume key={id} applicationId={id} /></div></ProfileLayout></AccountGate>;
}
