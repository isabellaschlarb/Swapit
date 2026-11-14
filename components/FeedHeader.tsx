import Link from "next/link";
import { Logo } from "@/components/Logo";

export const FEED_TABS = [
  { key: "for-you", label: "For You" },
  { key: "following", label: "Following" },
  { key: "trending", label: "Trending" },
] as const;

export type FeedTab = (typeof FEED_TABS)[number]["key"];

// Top of the feed: logo + filter icon, then the For You / Following / Trending pills.
export function FeedHeader({ active }: { active: FeedTab }) {
  return (
    <header className="space-y-4 px-5 pb-4 pt-6">
      <div className="flex items-center justify-between">
        <Logo />
        {/* STUB: filters (size, category, price) are a future feature */}
        <button
          type="button"
          aria-label="Filters (coming soon)"
          title="Filters coming soon"
          className="flex h-10 w-10 items-center justify-center rounded-full text-navy"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4" />
          </svg>
        </button>
      </div>

      <nav className="flex gap-2">
        {FEED_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "for-you" ? "/feed" : `/feed?tab=${tab.key}`}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              active === tab.key ? "bg-navy text-white" : "text-ink/60"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
