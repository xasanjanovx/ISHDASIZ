"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

const subscribe = () => () => {};
const serverSnapshot = () => "";

export function useHydratedPathname() {
  const pathname = usePathname();
  // Hosting rewrites can give the prerender a different path from the browser.
  // Keep the first render neutral, then select the actual browser route.
  return useSyncExternalStore(subscribe, () => pathname ?? "", serverSnapshot);
}
