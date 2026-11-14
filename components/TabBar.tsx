"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Thin outline icons (SVG paths, 24×24).
const ICONS = {
  home: "M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z",
  explore: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  swaps: "M7 7h11l-3-3M17 17H6l3 3",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20c1.4-3.3 4.3-5 7.5-5s6.1 1.7 7.5 5",
  plus: "M12 6v12M6 12h12",
};

const LEFT = [
  { href: "/feed", label: "Home", icon: ICONS.home },
  { href: "/explore", label: "Explore", icon: ICONS.explore },
];
const RIGHT = [
  // "Swaps" stays here until chat exists (then it can become "Messages").
  { href: "/swaps", label: "Swaps", icon: ICONS.swaps },
  { href: "/profile", label: "Profile", icon: ICONS.profile },
];

// Mobile-style bottom navigation with a raised + (Post) button in the middle.
// The current tab is navy; the others are faded.
export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_rgb(13_27_61/0.06)] backdrop-blur">
      <ul className="mx-auto grid max-w-md grid-cols-5 items-end">
        {LEFT.map((tab) => (
          <Tab key={tab.href} {...tab} active={pathname.startsWith(tab.href)} />
        ))}

        <li className="flex justify-center">
          <Link
            href="/post"
            aria-label="Post an item"
            className={`-mt-5 mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-sky text-navy shadow-lift ${
              pathname.startsWith("/post") ? "ring-4 ring-pale" : ""
            }`}
          >
            <Icon path={ICONS.plus} className="h-7 w-7" strokeWidth={2.2} />
          </Link>
        </li>

        {RIGHT.map((tab) => (
          <Tab key={tab.href} {...tab} active={pathname.startsWith(tab.href)} />
        ))}
      </ul>
    </nav>
  );
}

function Tab({ href, label, icon, active }: { href: string; label: string; icon: string; active: boolean }) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${
          active ? "font-semibold text-navy" : "text-navy/45"
        }`}
      >
        <Icon path={icon} className="h-6 w-6" />
        {label}
      </Link>
    </li>
  );
}

function Icon({ path, className, strokeWidth = 1.6 }: { path: string; className: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}
