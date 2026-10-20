import { notFound } from 'next/navigation';
import { Onboarding } from '@/components/onboarding/onboarding';

export default async function StartPage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (role !== 'employer' && role !== 'job-seeker') notFound();
  return <Onboarding role={role === 'employer' ? 'employer' : 'job_seeker'} />;
}
