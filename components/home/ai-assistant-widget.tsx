'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, X } from '@/components/ui/icons';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

export function AiAssistantWidget() {
    const { lang } = useLanguage();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [showGreeting, setShowGreeting] = useState(false);
    const [input, setInput] = useState('');

    // Expose global open function for Hero button
    const openChat = useCallback(() => {
        setIsOpen(true);
        setShowGreeting(false);
    }, []);

    useEffect(() => {
        // Attach to window for global access
        (window as any).openAiChat = openChat;
        return () => { delete (window as any).openAiChat; };
    }, [openChat]);

    // Show greeting after mount
    useEffect(() => {
        const timer = setTimeout(() => setShowGreeting(true), 1500);
        return () => clearTimeout(timer);
    }, []);

    const handleSend = () => {
        if (!input.trim()) return;
        // Redirect to AI search page with the query
        const query = encodeURIComponent(input.trim());
        router.push(`/ai-search?q=${query}`);
    };

    const toggleChat = () => {
        setIsOpen(!isOpen);
        if (!isOpen) setShowGreeting(false);
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
            {/* Greeting Bubble */}
            <AnimatePresence>
                {showGreeting && !isOpen && (
                    <motion.div
                        initial={{ opacity: 0, x: 20, scale: 0.8 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="bg-white px-4 py-3 rounded-2xl rounded-tr-sm shadow-xl border border-blue-100 max-w-[200px] text-sm text-slate-700 font-medium relative mr-2"
                    >
                        <div className="absolute -right-2 top-0 w-0 h-0 border-t-[10px] border-t-white border-r-[10px] border-r-transparent" />
                        {lang === 'uz' ? 'Men sizga ish topishda yordam beraman!' : 'Я помогу вам найти работу!'}
                        <button
                            onClick={() => setShowGreeting(false)}
                            className="absolute -top-2 -left-2 bg-slate-100 hover:bg-slate-200 rounded-full p-0.5"
                        >
                            <X className="w-3 h-3 text-slate-400" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Chat Window */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="w-[350px] md:w-[400px] h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex items-center justify-between text-white">
                            <div className="flex items-center gap-2">
                                <Image src="/ai-sparkle.png" alt="AI" width={32} height={32} className="w-8 h-8" />
                                <div>
                                    <h3 className="font-bold text-sm">AI Yordamchi</h3>
                                    <div className="flex items-center gap-1.5 opacity-80">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        <span className="text-xs">Online</span>
                                    </div>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20 rounded-full" onClick={toggleChat}>
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        {/* Welcome Message */}
                        <div className="flex-1 p-4 bg-slate-50 flex flex-col items-center justify-center text-center">
                            <Image src="/ai-sparkle.png" alt="AI" width={48} height={48} className="w-12 h-12 mb-3" />
                            <p className="text-sm text-slate-500">
                                {lang === 'uz'
                                    ? "Salom! Men sizga mos ish topishda yordam beraman. Menga qanday ish qidirayotganingizni yozing."
                                    : "Привет! Я помогу вам найти подходящую работу. Напишите мне, какую работу вы ищете."}
                            </p>
                        </div>

                        {/* Input */}
                        <div className="p-3 bg-white border-t border-slate-100">
                            <form
                                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                                className="flex gap-2"
                            >
                                <Input
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Yozing..."
                                    className="flex-1 h-10 text-sm bg-slate-50 border-slate-200 focus-visible:ring-blue-500"
                                />
                                <Button type="submit" size="icon" className="h-10 w-10 shrink-0 bg-blue-600 hover:bg-blue-700 rounded-lg">
                                    <Send className="w-4 h-4" />
                                </Button>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Trigger Button */}
            <motion.button
                onClick={toggleChat}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-2xl shadow-blue-600/30 flex items-center justify-center relative overflow-hidden"
            >
                {isOpen ? <X className="w-7 h-7" /> : <Image src="/ai-sparkle.png" alt="AI" width={36} height={36} className="w-9 h-9 brightness-0 invert" />}
            </motion.button>
        </div>
    );
}
