"use client";
import Link from "next/link";
import { Send, ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
export function TelegramBanner() {
  const { lang } = useLanguage();
  const ru = lang === "ru";
  return (
    <section className="home-shell home-telegram-wrap">
      <Link
        href="https://t.me/ishdasizbot"
        target="_blank"
        rel="noopener noreferrer"
        className="home-telegram"
      >
        <div className="home-telegram-icon">
          <Send size={30} />
        </div>
        <div>
          <span className="home-eyebrow">ISHDASIZ × TELEGRAM</span>
          <h2>
            {ru
              ? "Ваша работа. Всегда рядом."
              : "Sizning ishingiz. Doim yoningizda."}
          </h2>
          <p>
            {ru
              ? "Ищите работу, создавайте резюме и отправляйте отклики прямо в Telegram."
              : "Telegram orqali ish qidiring, rezyume yarating va ariza yuboring."}
          </p>
        </div>
        <span className="home-telegram-button">
          {ru ? "Открыть бота" : "Botni ochish"}
          <ArrowUpRight size={17} />
        </span>
      </Link>
    </section>
  );
}
