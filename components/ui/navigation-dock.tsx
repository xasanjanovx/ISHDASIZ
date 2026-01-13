"use client";

import { motion } from "framer-motion";
import { Home, Briefcase, MapPin } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

interface NavigationItem {
  id: string;
  icon: React.ReactNode;
  labelUz: string;
  labelRu: string;
  href: string;
}

interface NavigationDockProps {
  lang: 'uz' | 'ru';
}

export function NavigationDock({ lang }: NavigationDockProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const items: NavigationItem[] = [
    {
      id: "home",
      icon: <Home className="w-5 h-5" />,
      labelUz: "Bosh sahifa",
      labelRu: "Главная",
      href: "/"
    },
    {
      id: "jobs",
      icon: <Briefcase className="w-5 h-5" />,
      labelUz: "Vakansiyalar",
      labelRu: "Вакансии",
      href: "/jobs"
    },
    {
      id: "map",
      icon: <MapPin className="w-5 h-5" />,
      labelUz: "Xarita",
      labelRu: "Карта",
      href: "/map"
    }
  ];

  return (
    <motion.div
      className="flex gap-2"
      style={{
        transformStyle: "preserve-3d",
      }}
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 100, damping: 15 }}
    >
      {items.map((item) => (
        <Link key={item.id} href={item.href}>
          <motion.div
            className="relative flex items-center justify-center"
            onHoverStart={() => setHovered(item.id)}
            onHoverEnd={() => setHovered(null)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            style={{ transformStyle: "preserve-3d" }}
          >
            <motion.div
              className="px-4 py-2 rounded-lg border backdrop-blur-sm transition-all duration-200 flex items-center gap-2"
              animate={{
                backgroundColor: hovered === item.id
                  ? "rgba(255, 255, 255, 0.15)"
                  : "rgba(255, 255, 255, 0.08)",
                borderColor: hovered === item.id
                  ? "rgba(255, 255, 255, 0.3)"
                  : "rgba(255, 255, 255, 0.15)",
                y: hovered === item.id ? -2 : 0,
              }}
              transition={{ type: "spring", stiffness: 200, damping: 18 }}
            >
              <motion.div
                className="text-white"
                animate={{
                  rotateY: hovered === item.id ? 10 : 0,
                  scale: hovered === item.id ? 1.1 : 1,
                }}
                transition={{ type: "spring", stiffness: 150, damping: 15 }}
              >
                {item.icon}
              </motion.div>

              <motion.span
                className="text-sm font-medium text-white whitespace-nowrap"
                animate={{
                  opacity: hovered === item.id ? 1 : 0.85,
                }}
                transition={{ duration: 0.2 }}
              >
                {lang === 'uz' ? item.labelUz : item.labelRu}
              </motion.span>
            </motion.div>
          </motion.div>
        </Link>
      ))}
    </motion.div>
  );
}
