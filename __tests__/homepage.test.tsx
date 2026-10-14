import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
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
it('uses supplied counts and omits employer promotion', () => {
  render(<HeroSection stats={{ totalJobs: 24666, totalResumes: null, totalEmployers: 24 }} />);
  expect(screen.getByText('24 666')).toBeInTheDocument();
  expect(screen.queryByText('24')).not.toBeInTheDocument();
  expect(screen.queryByText('Работодатели')).not.toBeInTheDocument();
  expect(screen.getByText('—')).toBeInTheDocument();
});

it('preserves the selected avatar and offers seeker registration without automatic navigation', () => {
  jest.useFakeTimers();
  try {
    render(<HeroSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Резюме', exact: true }));
    act(() => jest.advanceTimersByTime(14000));
    expect(screen.getByRole('button', { name: 'Резюме', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(mockPush).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Создать резюме', exact: true }));
    expect(mockOpen).toHaveBeenCalledTimes(1);
  } finally { jest.useRealTimers(); }
});
it('the map avatar exposes the working map route', () => {
  render(<HeroSection />);
  fireEvent.click(screen.getByRole('button', { name: 'Карта вакансий', exact: true }));
  expect(screen.getByRole('link', { name: 'Открыть карту', exact: true })).toHaveAttribute('href', '/map');
});
