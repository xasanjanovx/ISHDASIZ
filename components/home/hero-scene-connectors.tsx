"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./hero-section.module.css";

type Wire = { d: string; x: number; y: number };

/** Attach the decorative curves to real elements, including after fonts load. */
export function HeroSceneConnectors() {
  const svg = useRef<SVGSVGElement>(null);
  const [wires, setWires] = useState<Wire[]>([]);

  useEffect(() => {
    const stage = svg.current?.parentElement;
    if (!stage || !window.ResizeObserver) return;
    const card = stage.querySelector<HTMLElement>("[data-hero-search]");
    const visual = stage.querySelector<HTMLElement>("[data-hero-visual]");
    const action = stage.querySelector<HTMLElement>("[data-hero-action]");
    if (!card || !visual || !action) return;
    let frame = 0;
    let disposed = false;
    const measure = () => {
      const bounds = stage.getBoundingClientRect();
      const portrait = visual.getBoundingClientRect();
      const search = card.getBoundingClientRect();
      const button = action.getBoundingClientRect();
      const y = (value: number) => value - bounds.top;
      const x = (value: number) => value - bounds.left;
      let next: Wire[];
      if (window.matchMedia("(max-width: 767px)").matches) {
        // A short curve stays entirely in the portrait area on phones.
        const end = { x: x(portrait.left + portrait.width / 2 + portrait.height * .1), y: y(portrait.top + portrait.height * .56) };
        next = [{ ...end, d: `M ${bounds.width - 8} ${y(portrait.bottom - 28)} C ${bounds.width - 8} ${end.y + 42}, ${end.x + 55} ${end.y}, ${end.x} ${end.y}` }];
      } else {
        const left = { x: x(portrait.left + portrait.width / 2 - portrait.height * .12), y: y(portrait.top + portrait.height * .49) };
        const right = { x: x(portrait.left + portrait.width / 2 + portrait.height * .1), y: y(portrait.top + portrait.height * .67) };
        const startLeft = { x: x(search.right), y: y(search.top + search.height * .38) };
        const startRight = { x: x(button.left), y: y(button.top + button.height / 2) };
        const curve = (start: { x: number; y: number }, end: { x: number; y: number }) => {
          const reach = (end.x - start.x) * .55;
          return `M ${start.x} ${start.y} C ${start.x + reach} ${start.y}, ${end.x - reach} ${end.y}, ${end.x} ${end.y}`;
        };
        next = [{ ...left, d: curve(startLeft, left) }, { ...right, d: curve(startRight, right) }];
      }
      setWires((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    };
    const schedule = () => {
      if (disposed) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    [stage, card, visual, action].forEach((element) => observer.observe(element));
    window.addEventListener("resize", schedule);
    void document.fonts?.ready.then(schedule);
    schedule();
    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, []);

  return <svg ref={svg} className={styles.connectors} aria-hidden="true" focusable="false" data-hero-connectors>
    {wires.map((wire, index) => <g key={index}>
      <path d={wire.d} className={styles.wire} />
      <path d={wire.d} pathLength="1" className={styles.wirePulse} />
      <circle cx={wire.x} cy={wire.y} r="4" className={styles.wireDot} />
      <circle cx={wire.x} cy={wire.y} r="9" className={styles.wireHalo} />
    </g>)}
  </svg>;
}
