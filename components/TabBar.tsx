"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Simple line icons (SVG paths) for each tab.
const TABS = [
  { href: "/feed", label: "Feed", icon: "M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v5H4zM13 14h7v5h-7z" },
  { href: "/post", label: "Post", icon: "M12 5v14M5 12h14" },
  { href: "/swaps", label: "Swaps", icon: "M7 7h11l-3-3M17 17H6l3 3" },
  {
    href: "/profile",
    label: "Profile",
    icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5",
  },
];

// Mobile-style bottom navigation. The current tab is green.
export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-ink/5 bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-md justify-around">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={`flex flex-col items-center gap-1 px-4 py-3 text-xs ${
                  active ? "text-primary" : "text-ink/45"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d={tab.icon} />
                </svg>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
