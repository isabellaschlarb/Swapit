"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";

// Thin outline icons (SVG paths, 24×24).
const ICONS = {
  home: "M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z",
  swaps: "M7 7h11l-3-3M17 17H6l3 3",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20c1.4-3.3 4.3-5 7.5-5s6.1 1.7 7.5 5",
  plus: "M12 6v12M6 12h12",
};

// Explore is hidden until search exists (the page is still at /explore).
const LEFT = [{ href: "/feed", label: "Home", icon: ICONS.home }];
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
    <>
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-navy/10 bg-surface px-5 py-8 lg:flex">
      <Link href="/feed" aria-label="Swapit home" className="px-3"><Logo /></Link>
      <nav aria-label="Main navigation" className="mt-10">
        <ul className="space-y-2">
          {[...LEFT, { href: "/post", label: "Post an item", icon: ICONS.plus }, ...RIGHT].map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <li key={tab.href}>
                <Link href={tab.href} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-2xl px-4 py-3 font-semibold ${active ? "bg-pale text-navy" : "text-navy/60 hover:bg-cloud"}`}>
                  <Icon path={tab.icon} className="h-6 w-6" />{tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-10 lg:hidden bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_rgb(13_27_61/0.06)] backdrop-blur">
      <ul className="mx-auto grid max-w-md grid-cols-4 items-end">
        {LEFT.map((tab) => (
          <Tab key={tab.href} {...tab} active={pathname.startsWith(tab.href)} />
        ))}

        <li className="flex justify-center">
          <Link
            href="/post"
            aria-label="Post an item"
            aria-current={pathname.startsWith("/post") ? "page" : undefined}
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
    </>
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
