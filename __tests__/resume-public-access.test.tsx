import { submittedResume } from '@/lib/submitted-resume';
import { AccountApiError } from '@/lib/account-api';
import React from 'react';
import { render, screen } from '@testing-library/react';
import ResumePage from '@/app/resumes/[id]/page';
let mockResume: any;
jest.mock('next/navigation', () => ({ useParams: () => ({ id: 'resume' }), useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('@/contexts/language-context', () => ({ useLanguage: () => ({ lang: 'ru' }) }));
jest.mock('@/contexts/user-auth-context', () => ({ useUserAuth: () => ({ user: { id: 'employer', active_role: 'employer' }, isAuthenticated: true }) }));
jest.mock('@/contexts/auth-modal-context', () => ({ useAuthModal: () => ({ openModal: jest.fn() }) }));
jest.mock('@/lib/account-api', () => ({ ...jest.requireActual('@/lib/account-api'),accountApi: async () => {
  // Visibility rules themselves are exercised against PostgreSQL in catalog-resume.test.cjs.
  if (!mockResume.is_public || mockResume.status !== 'active' || !mockResume.ishdasiz_resume_available) throw new AccountApiError(404);
  return { resume: { ...submittedResume(mockResume),user_id:mockResume.user_id,telegram:null,created_at:mockResume.created_at } };
} }));
beforeEach(() => { mockResume = { id: 'resume', user_id: 'candidate', title: 'Resume title', full_name: 'Candidate name', status: 'active', is_public: true, ishdasiz_resume_available: true, phone: '+998901234567', created_at: '2026-10-07' }; });
test.each([{ is_public: false }, { status: 'draft' }, { status: 'archived' }, { found_job: true, ishdasiz_resume_available: false }, { ishdasiz_resume_available: false }])('the public link hides a server-denied resume (%j)', async flags => {
  Object.assign(mockResume, flags); render(<ResumePage />); await screen.findByText('Резюме недоступно'); expect(screen.queryByText('Candidate name')).not.toBeInTheDocument();
});
test('a published active resume remains visible to an employer', async () => {
  render(<ResumePage />); expect(await screen.findByText('Candidate name')).toBeInTheDocument(); expect(screen.queryByText('Резюме недоступно')).not.toBeInTheDocument();
});
