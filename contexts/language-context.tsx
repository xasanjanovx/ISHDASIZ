'use client';

import { createContext, useContext, useSyncExternalStore, useEffect, ReactNode } from 'react';
import { translations, Language } from '@/lib/translations';

type TranslationType = typeof translations.uz | typeof translations.ru;

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: TranslationType;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
const LANGUAGE_KEY = 'ishdasiz-lang';
const LANGUAGE_EVENT = 'ishdasiz-language-change';
let fallbackLanguage: Language = 'uz';

function getLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (saved === 'uz' || saved === 'ru') return saved;
  } catch { /* Storage is optional. */ }
  return fallbackLanguage;
}
function subscribeLanguage(onChange: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === LANGUAGE_KEY || event.key === null) onChange(); };
  window.addEventListener('storage', onStorage);
  window.addEventListener(LANGUAGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(LANGUAGE_EVENT, onChange);
  };
}
const getServerLanguage = (): Language => 'uz';
function setLanguage(lang: Language) {
  fallbackLanguage = lang;
  try { localStorage.setItem(LANGUAGE_KEY, lang); } catch { /* Storage is optional. */ }
  window.dispatchEvent(new Event(LANGUAGE_EVENT));
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribeLanguage, getLanguage, getServerLanguage);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const t = translations[lang];

  return (
    <LanguageContext.Provider value={{ lang, setLang: setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
