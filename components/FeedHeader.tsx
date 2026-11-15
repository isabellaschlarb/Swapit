import Link from "next/link";
import { FilterSheet } from "@/components/FilterSheet";
import { Logo } from "@/components/Logo";
import { filtersToQuery, type Filters } from "@/lib/filters";

export const FEED_TABS = [
  { key: "for-you", label: "For You" },
  { key: "following", label: "Following" },
  { key: "trending", label: "Trending" },
] as const;

export type FeedTab = (typeof FEED_TABS)[number]["key"];

// Top of the feed (like the brand board): logo, search + filter icons,
// then the For You / Following / Trending pills. Switching tabs keeps
// the filters.
export function FeedHeader({ active, filters }: { active: FeedTab; filters: Filters }) {
  const keep = { ...filters, q: "" };

  return (
    <header className="space-y-4 px-5 pb-4 pt-6">
      <div className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-1">
          <Link href="/explore" aria-label="Search" className="flex h-10 w-10 items-center justify-center rounded-full text-navy hover:bg-pale">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
              <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" />
            </svg>
          </Link>
          <FilterSheet filters={filters} tab={active === "for-you" ? undefined : active} />
        </div>
      </div>

      <nav aria-label="Feed" className="flex flex-wrap gap-2">
        {FEED_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/feed${filtersToQuery({ ...keep, tab: tab.key === "for-you" ? undefined : tab.key })}`}
            aria-current={active === tab.key ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              active === tab.key ? "bg-navy text-white" : "text-ink/60 hover:bg-pale"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
