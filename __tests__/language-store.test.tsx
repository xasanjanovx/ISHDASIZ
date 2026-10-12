import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '@/contexts/language-context';

function Probe({ id }: { id: string }) {
  const { lang, setLang } = useLanguage();
  return <><span data-testid={id}>{lang}</span><button onClick={() => setLang(lang === 'uz' ? 'ru' : 'uz')}>{id}</button></>;
}
beforeEach(() => localStorage.setItem('ishdasiz-lang', 'uz'));
test('multiple providers and document language update together and restore the saved preference', () => {
  localStorage.setItem('ishdasiz-lang', 'ru');
  render(<><LanguageProvider><Probe id="A" /></LanguageProvider><LanguageProvider><Probe id="B" /></LanguageProvider></>);
  expect(screen.getByTestId('A')).toHaveTextContent('ru');
  expect(document.documentElement.lang).toBe('ru');
  fireEvent.click(screen.getByRole('button', { name: 'A' }));
  expect(screen.getByTestId('B')).toHaveTextContent('uz');
  expect(localStorage.getItem('ishdasiz-lang')).toBe('uz');
});
test('storage changes in another tab update the current page', () => {
  render(<LanguageProvider><Probe id="A" /></LanguageProvider>);
  act(() => { localStorage.setItem('ishdasiz-lang', 'ru'); window.dispatchEvent(new StorageEvent('storage', { key: 'ishdasiz-lang' })); });
  expect(screen.getByTestId('A')).toHaveTextContent('ru');
});
test('the language switch works when the browser blocks local storage', () => {
  const get = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  const set = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  render(<LanguageProvider><Probe id="A" /></LanguageProvider>);
  const previous = screen.getByTestId('A').textContent;
  fireEvent.click(screen.getByRole('button', { name: 'A' }));
  expect(screen.getByTestId('A').textContent).not.toBe(previous);
  get.mockRestore(); set.mockRestore();
});
