'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';
import { MessageCircle, ArrowRight } from '@/components/ui/icons';

export function TelegramBanner() {
    const { lang } = useLanguage();

    return (
        <div className="container mx-auto px-4 py-6 md:py-8">
            <Link
                href="https://t.me/ishdasizbot"
                target="_blank"
                className="block"
            >
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 border border-white/10 p-6 md:p-8 shadow-xl hover:shadow-2xl transition-all duration-300 group cursor-pointer">
                    {/* Animated background elements (Hero Style) */}
                    <div className="absolute inset-0 opacity-20">
                        <div className="absolute top-0 left-0 w-40 h-40 bg-white/20 rounded-full blur-3xl animate-pulse"></div>
                        <div className="absolute bottom-0 right-0 w-60 h-60 bg-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                    </div>

                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
                        {/* Left side - Icon and Text */}
                        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
                            {/* AI Icon */}
                            <div className="relative">
                                <div className="w-16 h-16 md:w-20 md:h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300 border border-white/20">
                                    <Image
                                        src="/ai-sparkle.png"
                                        alt="AI Bot"
                                        width={40}
                                        height={40}
                                        className="w-8 h-8 md:w-10 md:h-10 brightness-0 invert"
                                    />
                                </div>
                            </div>

                            {/* Text content */}
                            <div className="max-w-md">
                                <p className="text-white/90 text-sm md:text-base leading-relaxed font-medium">
                                    {lang === 'uz'
                                        ? "Telegram botimiz orqali osongina ish toping! Shunchaki yozing qanday ish kerak - bot sizga mos vakansiyalarni topib beradi."
                                        : "Найдите работу легко через наш Telegram бот! Просто напишите какую работу ищете - бот найдет подходящие вакансии."}
                                </p>
                            </div>
                        </div>

                        {/* Right side - CTA */}
                        <div className="flex-shrink-0">
                            <div className="inline-flex items-center gap-2 bg-white text-indigo-600 font-bold text-base md:text-lg px-6 py-3 rounded-xl shadow-lg group-hover:bg-indigo-50 group-hover:shadow-xl transition-all duration-300">
                                <MessageCircle className="w-5 h-5" />
                                {lang === 'uz' ? 'Botni ishga tushirish' : 'Открыть бота'}
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    </div>
                </div>
            </Link>
        </div>
    );
}
