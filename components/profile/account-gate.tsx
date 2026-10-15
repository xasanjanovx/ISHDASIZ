'use client';
import { Fragment, type ReactNode } from 'react';
import { useUserAuth } from '@/contexts/user-auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { useLanguage } from '@/contexts/language-context';
import { ProfileLayout } from './profile-layout';
import { Button } from '@/components/ui/button';
import { PageLoading } from '@/components/layout/page-loading';
export function AccountGate({ children, role = 'job_seeker' }: { children: ReactNode; role?: 'job_seeker' | 'employer' }) {
  const { user, isLoading } = useUserAuth(); const { lang } = useLanguage(); const { openModal } = useAuthModal();
  if (isLoading) return <PageLoading />;
  if (user) return <Fragment key={`${user.id}:${role}`}>{children}</Fragment>;
  return <ProfileLayout userType={role}><div className="space-y-4 rounded-2xl border border-border bg-card p-8 text-center"><h1 className="text-xl font-semibold">{lang === 'ru' ? 'Войдите, чтобы открыть личный кабинет' : 'Shaxsiy kabinetni ochish uchun kiring'}</h1><Button onClick={openModal}>{lang === 'ru' ? 'Войти' : 'Kirish'}</Button></div></ProfileLayout>;
}
