import { render, screen, fireEvent, within } from '@testing-library/react';
import { MobileNav } from '@/components/layout/mobile-nav';

let mockPath = '/', mockUser: any = null;
const mockOpen = jest.fn();
jest.mock('@/hooks/use-hydrated-pathname', () => ({ useHydratedPathname: () => mockPath }));
jest.mock('@/contexts/language-context', () => ({ useLanguage: () => ({ lang: 'ru' }) }));
jest.mock('@/contexts/user-auth-context', () => ({ useUserAuth: () => ({ user: mockUser, isAuthenticated: !!mockUser }) }));
jest.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: null, adminProfile: null }) }));
jest.mock('@/contexts/auth-modal-context', () => ({ useAuthModal: () => ({ openModal: mockOpen }) }));

beforeEach(() => { mockPath = '/'; mockUser = null; jest.clearAllMocks(); });

test('guest actions open authentication and menu links remain available', () => {
  render(<MobileNav />);
  const nav = screen.getByRole('navigation', { name: 'Основная навигация' });
  expect(within(nav).getByRole('link', { name: 'Главная' })).toHaveAttribute('aria-current', 'page');
  fireEvent.click(within(nav).getByRole('link', { name: 'Профиль' }));
  fireEvent.click(within(nav).getByRole('link', { name: 'Создать' }));
  expect(mockOpen).toHaveBeenCalledTimes(2);
  fireEvent.click(within(nav).getByRole('button', { name: 'Меню' }));
  const menu = screen.getByRole('dialog', { name: 'Меню' });
  expect(within(menu).getByRole('link', { name: 'Работа на карте' })).toHaveAttribute('href', '/map');
  fireEvent.click(within(menu).getByRole('button', { name: 'Войти в профиль' }));
  expect(mockOpen).toHaveBeenCalledTimes(3);
});

test('nested job pages keep search selected and authenticated actions keep their destinations', () => {
  mockPath = '/jobs/vacancy-id';
  mockUser = { active_role: 'employer' };
  render(<MobileNav />);
  const nav = screen.getByRole('navigation', { name: 'Основная навигация' });
  expect(within(nav).getByRole('link', { name: 'Поиск' })).toHaveAttribute('aria-current', 'page');
  expect(within(nav).getByRole('link', { name: 'Создать' })).toHaveAttribute('href', '/profile/employer/vacancies/new');
  expect(within(nav).getByRole('link', { name: 'Профиль' })).toHaveAttribute('href', '/profile/employer');
});
