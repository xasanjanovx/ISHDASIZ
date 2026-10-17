"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const targets = "[data-home-reveal], .poster-search-card, .poster-resumes-card, .poster-copy, .poster-controls, .home-section-heading, .home-how-heading, .home-category, .home-job-card, .home-seeker-card, .home-resume-cta, .home-opportunity, .home-step, .home-telegram, .catalog-job-card, .catalog-resume-card, .site-page-banner";

// Progressive enhancement: content stays visible when scripts, observers or motion are unavailable.
export function SiteMotion() {
  const pathname = usePathname();
  useEffect(() => {
    if (!window.matchMedia || !window.IntersectionObserver || !window.MutationObserver) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    // The page can still be streaming when this layout component hydrates.
    const main = document.querySelector("main") ?? document.body;
    let stop = () => {};
    const start = () => {
      stop();
      if (preference.matches) return;
      const seen = new WeakSet<Element>();
      const animations = new Set<Animation>();
      const observer = new IntersectionObserver(entries => {
        let order = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          const element = entry.target as HTMLElement;
          if (!element.animate || element.contains(document.activeElement)) continue;
          const animation = element.animate([
            { opacity: 0.25, transform: "translateY(22px)" },
            { opacity: 1, transform: "translateY(0)" },
          ], { duration: 620, delay: Math.min(order++, 4) * 65, easing: "cubic-bezier(.2,.7,.2,1)", fill: "backwards" });
          animations.add(animation);
          animation.onfinish = animation.oncancel = () => animations.delete(animation);
        }
      }, { threshold: 0.08, rootMargin: "0px 0px -24px 0px" });
      const scan = () => {
        main.querySelectorAll(targets).forEach(element => {
          if (seen.has(element)) return;
          seen.add(element);
          // Do not animate content above a restored scroll position or direct fragment.
          if (element.getBoundingClientRect().bottom > 0) observer.observe(element);
        });
      };
      scan();
      const mutations = new MutationObserver(scan);
      mutations.observe(main, { childList: true, subtree: true });
      stop = () => {
        observer.disconnect();
        mutations.disconnect();
        animations.forEach(animation => animation.cancel());
        animations.clear();
      };
    };
    start();
    preference.addEventListener("change", start);
    return () => { preference.removeEventListener("change", start); stop(); };
  }, [pathname]);
  return null;
}
