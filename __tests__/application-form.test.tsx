import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApplicationModal } from '@/components/jobs/application-modal';
import { AccountApiError } from '@/lib/account-api';
const mockInsert = jest.fn();
const mockError = jest.fn();
const mockClose = jest.fn();
const mockUser = { id: 'user-1', phone: '+998901234567' };
jest.mock('@/contexts/language-context', () => ({ useLanguage: () => ({ lang: 'ru' }) }));
jest.mock('@/contexts/user-auth-context', () => ({ useUserAuth: () => ({ user: mockUser }) }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: (...args: any[]) => mockError(...args) } }));
jest.mock('@/lib/account-api', () => ({ ...jest.requireActual('@/lib/account-api'), accountApi: (_url: string, init: any) => init?.method === 'POST'
  ? mockInsert(JSON.parse(init.body))
  : Promise.resolve({ resumes: [{ id: 'resume-1', title: 'Бухгалтер', updated_at: '2026-01-01', experience_years: 2 }] }) }));
const job = { id: 'job-1', title: 'Бухгалтер' };
beforeEach(() => { jest.clearAllMocks(); mockInsert.mockResolvedValue({ error: null }); });
async function selectResume() { fireEvent.click(await screen.findByRole('radio')); }
it('normalizes the contact phone and leaves ownership to the server', async () => {
 render(<ApplicationModal isOpen onClose={mockClose} job={job} />);
 await selectResume();
 fireEvent.change(screen.getByLabelText(/Ваш номер телефона/), { target: { value: '90 123 45 67' } });
 fireEvent.click(screen.getByRole('button', { name: 'Отправить заявку' }));
 await waitFor(() => expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ job_id: 'job-1', resume_id: 'resume-1', phone: '+998901234567' })));
 expect(mockInsert.mock.calls[0][0]).not.toHaveProperty('user_id');
 await waitFor(() => expect(mockClose).toHaveBeenCalled());
});
it('rejects a foreign phone before writing an application', async () => {
 render(<ApplicationModal isOpen onClose={mockClose} job={job} />);
 await selectResume();
 fireEvent.change(screen.getByLabelText(/Ваш номер телефона/), { target: { value: '+79012345678' } });
 fireEvent.click(screen.getByRole('button', { name: 'Отправить заявку' }));
 expect(mockInsert).not.toHaveBeenCalled();
 expect(mockError).toHaveBeenCalled();
});
it('reports a duplicate instead of reporting a successful application', async () => {
 mockInsert.mockRejectedValue(new AccountApiError(409));
 render(<ApplicationModal isOpen onClose={mockClose} job={job} />);
 await selectResume(); fireEvent.click(screen.getByRole('button', { name: 'Отправить заявку' }));
 await waitFor(() => expect(mockError).toHaveBeenCalledWith('Отклик уже отправлен или это ваша вакансия'));
 expect(mockClose).not.toHaveBeenCalled();
});
it('clears the previous selection when switching jobs', async () => {
 const view=render(<ApplicationModal isOpen onClose={mockClose} job={job} />);
 await selectResume();
 view.rerender(<ApplicationModal isOpen onClose={mockClose} job={{ ...job, id: 'job-2' }} />);
 await waitFor(() => expect(screen.getByRole('radio')).not.toBeChecked());
});
