"use client"

import React from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface NavItem {
  name: string
  url: string
  icon: any
}

interface NavBarProps {
  items: NavItem[]
  className?: string
  activeTab?: string
  onTabChange?: (tab: string) => void
}

export function NavBar({ items, className, activeTab, onTabChange }: NavBarProps) {
  const [currentTab, setCurrentTab] = React.useState(activeTab || items[0]?.name)

  const handleClick = (name: string) => {
    setCurrentTab(name)
    onTabChange?.(name)
  }

  React.useEffect(() => {
    if (activeTab) {
      setCurrentTab(activeTab)
    }
  }, [activeTab])

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {items.map((item) => {
        const Icon = item.icon
        const isActive = currentTab === item.name

        return (
          <Link
            key={item.name}
            href={item.url}
            onClick={() => handleClick(item.name)}
            data-active={isActive}
            className={cn(
              "relative cursor-pointer text-sm font-medium px-6 py-2.5 rounded-full transition-colors",
              "text-foreground/70 hover:text-foreground",
              isActive && "text-foreground"
            )}
          >
            <span className="relative z-10 flex items-center gap-2">
              <Icon size={18} />
              {item.name}
            </span>
            {isActive && (
              <motion.div
                layoutId="lamp"
                className="absolute inset-0 bg-white/90 border border-primary/10 rounded-full shadow-md"
                initial={false}
                transition={{
                  type: "spring",
                  stiffness: 380,
                  damping: 30,
                }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-primary/0 via-primary to-primary/0 rounded-full">
                  <div className="absolute w-12 h-4 bg-primary/10 rounded-full blur-md -top-2 -left-2" />
                  <div className="absolute w-8 h-4 bg-primary/15 rounded-full blur-sm -top-1" />
                </div>
              </motion.div>
            )}
          </Link>
        )
      })}
    </div>
  )
}
