'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';
import { BadgeCheck, Mail, Phone, MapPin, Shield } from '@/components/ui/icons';

export function Footer() {
  const { t, lang } = useLanguage();

  return (
    <footer className="bg-slate-900 text-white mt-auto border-t-4 border-blue-600">
      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-8 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl font-bold">ISHDASIZ</span>
              <BadgeCheck className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              {lang === 'uz' || lang === 'uzCyrillic'
                ? "O'zbekiston bo'ylab tasdiqlangan rasmiy ish joylari"
                : 'Официальный портал проверенных вакансий по всему Узбекистану'
              }
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-slate-200">
              {lang === 'uz' || lang === 'uzCyrillic' ? 'Bog\'lanish' : 'Контакты'}
            </h3>
            <div className="space-y-2 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <span>+998 74 223 XX XX</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span>info@ishdasiz.uz</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>{lang === 'uz' || lang === 'uzCyrillic' ? "Andijon viloyati" : 'Андижанская область'}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-slate-200">
              {lang === 'uz' || lang === 'uzCyrillic' ? 'Foydali havolalar' : 'Полезные ссылки'}
            </h3>
            <div className="space-y-2 text-sm text-slate-400">
              <a href="/" className="block hover:text-white transition-colors">
                {lang === 'uz' || lang === 'uzCyrillic' ? 'Bosh sahifa' : 'Главная'}
              </a>
              <a href="/jobs" className="block hover:text-white transition-colors">
                {lang === 'uz' || lang === 'uzCyrillic' ? 'Vakansiyalar' : 'Вакансии'}
              </a>
              <a href="/map" className="block hover:text-white transition-colors">
                {lang === 'uz' || lang === 'uzCyrillic' ? 'Xarita' : 'Карта'}
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left text-sm text-slate-400">
            <p className="mt-1">
              &copy; {new Date().getFullYear()} ISHDASIZ. {t.footer.copyright}
            </p>
          </div>

          <Link href="/admin" className="flex items-center gap-2 px-4 py-2 hover:bg-slate-800 rounded-lg transition-colors group">
            <Shield className="w-3 h-3 text-slate-500 group-hover:text-blue-400 transition-colors" />
            <span className="text-xs text-slate-500 group-hover:text-slate-300 font-medium uppercase tracking-wide transition-colors">
              Admin
            </span>
          </Link>
        </div>
      </div>
    </footer>
  );
}
