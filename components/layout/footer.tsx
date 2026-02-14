'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';
import { BadgeCheck, Mail, MapPin, Shield, Send } from '@/components/ui/icons';

export function Footer() {
  const { t, lang } = useLanguage();

  return (
    <footer className="relative bg-slate-950 text-white mt-auto overflow-hidden">
      {/* Gradient top accent line */}
      <div className="h-[3px] bg-gradient-to-r from-blue-600 via-teal-500 to-indigo-600" />

      {/* Decorative background orbs */}
      <div className="absolute top-10 right-[15%] w-[250px] h-[250px] bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-[10%] w-[200px] h-[200px] bg-indigo-600/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="container mx-auto px-4 py-10 md:py-14 relative">
        <div className="grid md:grid-cols-3 gap-10 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-2xl font-bold tracking-tight">ISHDASIZ</span>
              <BadgeCheck className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
              {lang === 'uz'
                ? "O'zbekiston bo'ylab tasdiqlangan rasmiy ish joylari. Karyerangizni biz bilan boshlang."
                : 'Официальный портал проверенных вакансий по всему Узбекистану. Начните карьеру с нами.'}
            </p>
            <div className="flex items-center gap-3 mt-5">
              <a
                href="https://t.me/ishdasiz_admin"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-blue-600/20 border border-white/10 hover:border-blue-500/30 flex items-center justify-center transition-all duration-300 hover:scale-105 group"
              >
                <Send className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors" />
              </a>
              <a
                href="mailto:info@ishdasiz.uz"
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-teal-600/20 border border-white/10 hover:border-teal-500/30 flex items-center justify-center transition-all duration-300 hover:scale-105 group"
              >
                <Mail className="w-4 h-4 text-slate-400 group-hover:text-teal-400 transition-colors" />
              </a>
            </div>
          </div>

          {/* Contacts */}
          <div>
            <h3 className="font-bold mb-4 text-white text-sm uppercase tracking-wider">
              {lang === 'uz' ? 'Bog\'lanish' : 'Контакты'}
            </h3>
            <div className="space-y-3 text-sm text-slate-400">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <Send className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <a href="https://t.me/ishdasiz_admin" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors font-medium">@ishdasiz_admin</a>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-3.5 h-3.5 text-teal-400" />
                </div>
                <span>info@ishdasiz.uz</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <span>{lang === 'uz' ? 'Andijon viloyati' : 'Андижанская область'}</span>
              </div>
            </div>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-bold mb-4 text-white text-sm uppercase tracking-wider">
              {lang === 'uz' ? 'Foydali havolalar' : 'Полезные ссылки'}
            </h3>
            <div className="space-y-3 text-sm">
              {[
                { href: '/', label: lang === 'uz' ? 'Bosh sahifa' : 'Главная' },
                { href: '/jobs', label: lang === 'uz' ? 'Vakansiyalar' : 'Вакансии' },
                { href: '/resumes', label: lang === 'uz' ? 'Rezyumelar' : 'Резюме' },
                { href: '/map', label: lang === 'uz' ? 'Xarita' : 'Карта' },
              ].map((link) => (
                <a key={link.href} href={link.href} className="block text-slate-400 hover:text-white transition-colors group">
                  <span className="inline-flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-700 group-hover:bg-blue-500 transition-colors" />
                    {link.label}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/5 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} ISHDASIZ. {t.footer.copyright}
          </p>
          <Link href="/admin" className="flex items-center gap-2 px-4 py-2 hover:bg-white/5 rounded-lg transition-all group">
            <Shield className="w-3 h-3 text-slate-600 group-hover:text-blue-400 transition-colors" />
            <span className="text-xs text-slate-600 group-hover:text-slate-400 font-medium uppercase tracking-wide transition-colors">
              Admin
            </span>
          </Link>
        </div>
      </div>
    </footer>
  );
}
