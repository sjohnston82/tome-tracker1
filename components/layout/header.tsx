"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface HeaderProps {
  user: { email: string; role: string } | null;
}

export function Header({ user }: HeaderProps) {
  const pathname = usePathname();
  const navItems = user
    ? [
        { href: "/library", label: "Library" },
        { href: "/scan", label: "Scan" },
        { href: "/settings", label: "Settings" },
      ]
    : [];

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link
            href={user ? "/library" : "/"}
            className="font-bold text-xl flex items-center gap-2"
          >
            <span>📚</span>
            <span className="hidden sm:inline">Tome Tracker</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  pathname.startsWith(item.href)
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {!user && (
            <div className="flex items-center gap-4">
              <Link href="/login" className="text-gray-600 hover:text-gray-900">
                Login
              </Link>
              <Link
                href="/register"
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
