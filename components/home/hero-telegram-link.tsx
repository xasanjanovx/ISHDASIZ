"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, BriefcaseBusiness, FileUser, Headphones, Radio, Send } from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import styles from "./hero-telegram-link.module.css";

type Point = { x: number; y: number };
type Wiring = { hub: Point; feeds: Point[]; port: Point; turnY: number };
const mix = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const cable = (a: Point, b: Point) => {
  const reach = Math.max(45, Math.abs(b.x - a.x) * .48);
  return `M ${a.x} ${a.y} C ${a.x + reach} ${a.y + 35}, ${b.x - reach} ${b.y}, ${b.x} ${b.y}`;
};

const trunk = (wiring: Wiring) => {
  const { hub: a, port: b, turnY } = wiring;
  if (b.x >= a.x) return cable(a, b);
  const lane = b.x - 21;
  return `M ${a.x} ${a.y} C ${a.x} ${a.y + 35}, ${a.x} ${turnY}, ${a.x - 30} ${turnY} H ${lane + 18} Q ${lane} ${turnY}, ${lane} ${turnY + 18} V ${b.y - 18} Q ${lane} ${b.y}, ${b.x} ${b.y}`;
};

export function HeroTelegramLink() {
  const { lang } = useLanguage();
  const ru = lang === "ru";
  const reducedMotion = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [target, setTarget] = useState<Wiring | null>(null);
  const [drawing, setDrawing] = useState<Wiring | null>(null);
  const previous = useRef<Wiring | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const hub = useRef<HTMLButtonElement>(null);
  const feeds = useRef<(HTMLSpanElement | null)[]>([]);
  const ports = useRef<(HTMLSpanElement | null)[]>([]);
  const running = visible && !reducedMotion && !hovered && !focused;
  const links = [
    { id: "bot", href: "https://t.me/ishdasizbot", handle: "@ishdasizbot", title: ru ? "Найти работу в боте" : "Bot orqali ish topish", text: ru ? "Поиск, резюме и отклики — в одном чате." : "Ish qidirish, rezyume va arizalar — bitta chatda.", Icon: Send },
    { id: "channel", href: "https://t.me/ishdasiz", handle: "@ishdasiz", title: ru ? "Канал вакансий" : "Vakansiyalar kanali", text: ru ? "Новые предложения в вашей ленте Telegram." : "Yangi ish takliflari Telegram tasmangizda.", Icon: Radio },
    { id: "support", href: "https://t.me/ishdasiz_admin", handle: "@ishdasiz_admin", title: ru ? "Поддержка" : "Yordam", text: ru ? "Есть вопрос? Напишите нашей команде." : "Savolingiz bormi? Jamoamizga yozing.", Icon: Headphones },
  ];

  useEffect(() => {
    const element = panel.current;
    if (!element || !window.IntersectionObserver) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .15 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => setActive((value) => (value + 1) % 3), 4800);
    return () => clearTimeout(timer);
  }, [running, active]);

  // Measure real terminals so wires stay attached when text wraps or the phone rotates.
  useEffect(() => {
    const element = panel.current;
    if (!element || !window.ResizeObserver) return;
    let frame = 0;
    let disposed = false;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      const center = (node: HTMLElement): Point => {
        const box = node.getBoundingClientRect();
        return { x: box.left - bounds.left + box.width / 2, y: box.top - bounds.top + box.height / 2 };
      };
      const outlet = hub.current;
      const port = ports.current[active];
      if (outlet && port && feeds.current.every(Boolean)) {
        const turnY = ports.current[0]!.parentElement!.getBoundingClientRect().top - bounds.top - 13;
        const next = { hub: center(outlet), port: center(port), turnY, feeds: feeds.current.map((node) => center(node!)) };
        setTarget((value) => JSON.stringify(value) === JSON.stringify(next) ? value : next);
      }
    };
    const schedule = () => { if (!disposed) { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); } };
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    ports.current.forEach((node) => { if (node) observer.observe(node.parentElement!); });
    schedule();
    void document.fonts?.ready.then(schedule);
    return () => { disposed = true; observer.disconnect(); cancelAnimationFrame(frame); };
  }, [active, lang]);

  useEffect(() => {
    if (!target) return;
    const from = previous.current;
    let frame = 0;
    let start: number | null = null;
    const tick = (time: number) => {
      start ??= time;
      const progress = reducedMotion || !from ? 1 : Math.min(1, (time - start) / 850);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from ? { turnY: from.turnY + (target.turnY - from.turnY) * eased, hub: mix(from.hub, target.hub, eased), port: mix(from.port, target.port, eased), feeds: target.feeds.map((point, i) => mix(from.feeds[i] || point, point, eased)) } : target;
      previous.current = next;
      setDrawing(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, reducedMotion]);

  return (
    <div ref={panel} className={styles.panel} role="region" aria-label={ru ? "ISHDASIZ в Telegram" : "Telegram’da ISHDASIZ"} data-active={links[active].id} data-running={visible && !reducedMotion}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(true); }} onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <div className={styles.intro}>
        <span className={styles.kicker}>ISHDASIZ × TELEGRAM</span>
        <h2>{ru ? "Ваша работа.\nВ одном чате." : "Sizning ishingiz.\nBitta chatda."}</h2>
        <p>{ru ? "В Telegram найти работу проще. Откройте бота, следите за вакансиями и оставайтесь на связи." : "Telegram’da ish topish osonroq. Botni oching, vakansiyalarni kuzating va biz bilan aloqada bo‘ling."}</p>
        <div className={styles.power}>
          <div className={styles.feeds} aria-hidden="true">
            {[{ Icon: BriefcaseBusiness, label: ru ? "Вакансии" : "Vakansiyalar" }, { Icon: FileUser, label: ru ? "Резюме" : "Rezyume" }].map(({ Icon, label }, index) => (
              <div key={index}><Icon size={16} /><span>{label}</span><span ref={(node) => { feeds.current[index] = node; }} className={styles.terminal} /></div>
            ))}
          </div>
          <button ref={hub} className={styles.hub} type="button" onClick={() => setActive((value) => (value + 1) % 3)} aria-label={ru ? "Переключить Telegram-ссылку" : "Telegram havolasini almashtirish"}>
            <Send size={24} aria-hidden="true" />
          </button>
        </div>
        <span className={styles.status} aria-hidden="true"><i />{links[active].title}</span>
      </div>
      <div className={styles.destinations}>
        {links.map(({ id, href, handle, title, text, Icon }, index) => (
          <a key={id} href={href} target="_blank" rel="noopener noreferrer" className={styles.destination} data-selected={index === active}
            onPointerEnter={() => setActive(index)} onFocus={() => setActive(index)} onTouchStart={() => setActive(index)}>
            <span ref={(node) => { ports.current[index] = node; }} className={styles.port} aria-hidden="true"><i /></span>
            <span className={styles.destinationCopy}>
              <span className={styles.destinationTitle}><Icon size={18} aria-hidden="true" /><strong>{title}</strong></span>
              <span className={styles.handle}>{handle}</span>
              <span className={styles.description}>{text}</span>
            </span>
            <span className={styles.arrow} aria-hidden="true"><ArrowUpRight size={19} /></span>
          </a>
        ))}
      </div>
      {drawing && <svg className={styles.wires} aria-hidden="true">
        {drawing.feeds.map((point, index) => <g key={index}><path d={cable(point, drawing.hub)} className={styles.feedWire} /><path d={cable(point, drawing.hub)} className={styles.feedFlow} pathLength="100" /></g>)}
        <path className={styles.cableShadow} d={trunk(drawing)} />
        <path className={styles.cable} d={trunk(drawing)} />
        <path className={styles.cableCore} d={trunk(drawing)} />
        <path className={styles.flow} d={trunk(drawing)} pathLength="100" />
        <g transform={`translate(${drawing.port.x - 10} ${drawing.port.y})`}>
          <rect x="-20" y="-10" width="29" height="20" rx="6" fill="#fff6e6" stroke="#c9bca7" />
          <path d="M -9 0 H 1" stroke="#ff824f" strokeWidth="3" strokeLinecap="round" />
          <rect x="9" y="-4" width="7" height="8" rx="2" fill="#ded3be" />
        </g>
      </svg>}
    </div>
  );
}
