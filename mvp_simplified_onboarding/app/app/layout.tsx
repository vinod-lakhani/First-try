"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, TrendingUp, Rss, User } from "lucide-react";

const TABS = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/income", label: "Income", icon: TrendingUp },
  { href: "/app/feed", label: "Feed", icon: Rss },
  { href: "/app/profile", label: "Profile", icon: User },
] as const;

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Top bar with logo and tabs */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mx-auto max-w-xl px-4 pt-4">
          <Link href="/app" className="text-xl font-bold text-slate-900 dark:text-white">
            WeLeap
          </Link>
        </div>
        <nav className="mx-auto flex max-w-xl items-center justify-around border-t border-slate-200 px-2 py-2 dark:border-slate-700">
          {TABS.map((tab) => {
            const isActive = pathname === tab.href || (tab.href !== "/app" && pathname.startsWith(tab.href));
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center gap-1 rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
