import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { HeroSection } from '@/components/home/hero-section';
const mockPush = jest.fn();
const mockOpen = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/contexts/language-context', () => ({ useLanguage: () => ({ lang: 'ru' }) }));
jest.mock('@/contexts/user-auth-context', () => ({ useUserAuth: () => ({ user: null }) }));
jest.mock('@/contexts/auth-modal-context', () => ({ useAuthModal: () => ({ openModal: mockOpen, setStep: jest.fn(), setUserRole: jest.fn() }) }));
beforeEach(() => jest.clearAllMocks());
it('searches the whole country by default without inventing a region', () => {
  render(<HeroSection />);
  fireEvent.click(screen.getByRole('button', { name: 'Найти работу' }));
  expect(mockPush).toHaveBeenCalledWith('/jobs');
});
it('keeps the database region ID and safely encodes the search', () => {
  render(<HeroSection regions={[{ id: 22, name_uz: 'Toshkent', name_ru: 'Ташкент' }]} />);
  fireEvent.change(screen.getByLabelText('Профессия или компания'), { target: { value: '  Бухгалтер & кассир  ' } });
  fireEvent.change(screen.getByLabelText('Регион'), { target: { value: '22' } });
  fireEvent.click(screen.getByRole('button', { name: 'Найти работу' }));
  const url = new URL(mockPush.mock.calls[0][0], 'https://example.com');
  expect(url.searchParams.get('q')).toBe('Бухгалтер & кассир');
  expect(url.searchParams.get('region')).toBe('22');
});
it('uses supplied counts and never doubles the employer count', () => {
  render(<HeroSection stats={{ totalJobs: 24666, totalResumes: null, totalEmployers: 24 }} />);
  expect(screen.getByText('24 666')).toBeInTheDocument();
  expect(screen.getByText('24')).toBeInTheDocument();
  expect(screen.getByText('—')).toBeInTheDocument();
});
