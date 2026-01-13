'use client';

import { useLanguage } from '@/contexts/language-context';
import { Button } from '@/components/ui/button';
import { Send } from '@/components/ui/icons';

export function TelegramBanner() {
    const { lang } = useLanguage();

    return (
        <div className="container mx-auto px-4 py-6 md:py-8">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0088cc] via-[#00a2e8] to-[#00bfff] p-4 md:p-6 shadow-lg">
                {/* Background Patterns */}
                <div className="absolute inset-0 opacity-10">
                    <svg className="w-full h-full" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern id="telegram_pattern" width="60" height="60" patternUnits="userSpaceOnUse">
                                <path d="M10 10l20 20M50 10l-20 20" stroke="white" strokeWidth="2" strokeLinecap="round" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#telegram_pattern)" />
                    </svg>
                </div>

                {/* Floating Icons - Scaled down */}
                <div className="absolute top-[-20px] right-[-20px] w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute bottom-[-30px] left-[20%] w-24 h-24 bg-white/10 rounded-full blur-2xl" />

                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-full flex items-center justify-center shadow-md flex-shrink-0 animate-pulse">
                            <Send className="w-6 h-6 md:w-8 md:h-8 text-[#0088cc] ml-1" />
                        </div>
                        <div>
                            <h3 className="text-lg md:text-2xl font-bold text-white mb-1">
                                {lang === 'uz' ? "So'nggi vakansiyalar Telegram kanalimizda!" : "Последние вакансии в нашем Telegram канале!"}
                            </h3>
                            <p className="text-white/90 text-xs md:text-sm max-w-lg">
                                {lang === 'uz'
                                    ? "Obuna bo'ling va eng yangi ish takliflarini birinchilardan bo'lib ko'ring. Kunlik yangilanishlar!"
                                    : "Подпишитесь и первыми узнавайте о новых предложениях работы. Ежедневные обновления!"}
                            </p>
                        </div>
                    </div>

                    <Button
                        variant="outline"
                        className="bg-white text-[#0088cc] hover:bg-slate-50 border-none font-bold text-sm px-6 h-10 shadow-lg active:scale-95 transition-all whitespace-nowrap"
                        onClick={() => window.open('https://t.me/ishdasiz', '_blank')}
                    >
                        {lang === 'uz' ? "Obuna bo'lish" : "Подписаться"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
