"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/library", label: "Library", icon: "📚" },
  { href: "/series", label: "Series", icon: "📖" },
  { href: "/activity", label: "Activity", icon: "📊" },
  { href: "/scan", label: "Scan", icon: "📷" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 sm:hidden z-50">
      <div className="flex justify-around">
        {navItems.map((item) => (
          <Link
            key={item.href}
                aria-current={pathname.startsWith(item.href) ? "page" : undefined}
            href={item.href}
            className={cn(
              "flex flex-1 min-w-0 flex-col items-center py-3 px-1 text-xs transition-colors",
              pathname.startsWith(item.href)
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-600 dark:text-gray-400"
            )}
          >
            <span className="text-xl mb-1">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
