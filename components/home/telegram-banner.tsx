'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';
import { MessageCircle, ArrowRight, Send } from '@/components/ui/icons';
import { motion } from 'framer-motion';

export function TelegramBanner() {
    const { lang } = useLanguage();

    return (
        <div className="container mx-auto px-4 py-8 md:py-12">
            <Link
                href="https://t.me/ishdasiz_bot"
                target="_blank"
                className="block"
            >
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-7 md:p-10 shadow-2xl shadow-indigo-900/10 group animate-mesh"
                    style={{ backgroundSize: '200% 200%' }}
                >
                    {/* Shimmer overlay */}
                    <div className="absolute inset-0 overflow-hidden">
                        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                    </div>

                    {/* Decorative glowing orbs */}
                    <div className="absolute top-0 right-[20%] w-[200px] h-[200px] bg-blue-600/15 rounded-full blur-[80px] pointer-events-none" />
                    <div className="absolute bottom-0 left-[10%] w-[150px] h-[150px] bg-indigo-500/10 rounded-full blur-[60px] pointer-events-none" />

                    {/* Small decorative dots */}
                    <div className="absolute top-4 right-8 w-1.5 h-1.5 bg-blue-400/40 rounded-full" />
                    <div className="absolute top-8 right-16 w-1 h-1 bg-indigo-400/30 rounded-full" />
                    <div className="absolute bottom-6 left-20 w-1.5 h-1.5 bg-teal-400/30 rounded-full" />

                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex flex-col md:flex-row items-center gap-5 text-center md:text-left">
                            {/* Telegram Icon with pulse ring */}
                            <div className="relative">
                                <div className="absolute inset-0 rounded-2xl bg-blue-500/30 animate-pulse-ring" />
                                <div className="w-16 h-16 md:w-18 md:h-18 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-xl shadow-blue-600/30 relative z-10">
                                    <Send className="w-8 h-8 text-white" />
                                </div>
                            </div>

                            <div className="max-w-md">
                                <h3 className="text-xl md:text-2xl font-bold text-white mb-2">
                                    {lang === 'uz' ? 'Telegram bot orqali' : 'Через Telegram бот'}
                                </h3>
                                <p className="text-slate-400 text-sm md:text-base leading-relaxed">
                                    {lang === 'uz'
                                        ? "Ish va ishchi topish oson! O'zingizga mos vakansiyalarni toping."
                                        : 'Найти работу и сотрудников легко! Подберите подходящие вакансии.'}
                                </p>
                            </div>
                        </div>

                        {/* CTA Button with glow */}
                        <div className="flex-shrink-0">
                            <div className="inline-flex items-center gap-2.5 bg-white text-slate-900 font-bold text-sm md:text-base px-7 py-3.5 rounded-xl shadow-lg shadow-white/10 group-hover:shadow-white/20 transition-all duration-300 group-hover:scale-105">
                                <MessageCircle className="w-5 h-5" />
                                {lang === 'uz' ? 'Botni ochish' : 'Открыть бота'}
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                            </div>
                        </div>
                    </div>
                </motion.div>
            </Link>
        </div>
    );
}
