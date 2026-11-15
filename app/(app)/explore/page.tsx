import Link from "next/link";
import { redirect } from "next/navigation";
import { FilterSheet } from "@/components/FilterSheet";
import { ItemGrid, OWNER_SELECT, type ItemOwner } from "@/components/ItemCard";
import { PageHeader } from "@/components/PageHeader";
import { StyleTwins } from "@/components/StyleTwins";
import { CATEGORIES } from "@/lib/constants";
import { activeFilterCount, applyFilters, filtersToQuery, parseFilters } from "@/lib/filters";
import { getMyLikes } from "@/lib/social";
import { createClient, getMyProfile } from "@/lib/supabase/server";
import type { Item } from "@/lib/types";

// Explore: search (title, description, style tags), category chips, the
// same filter sheet as the feed, and "Style twins" to meet new people.
export default async function ExplorePage({ searchParams }: PageProps<"/explore">) {
  const filters = parseFilters(await searchParams);
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const [{ data }, likes] = await Promise.all([
    applyFilters(supabase.from("items").select(`*, ${OWNER_SELECT}`).eq("status", "available"), filters)
      .order("created_at", { ascending: false })
      .limit(60),
    getMyLikes(supabase),
  ]);
  const items = (data ?? []) as (Item & { owner: ItemOwner | null })[];
  const searching = Boolean(filters.q) || activeFilterCount(filters) > 0;

  return (
    <main className="mx-auto w-full max-w-screen-2xl lg:px-5 lg:pt-4">
      <PageHeader title="Explore" />
      <div className="space-y-6 px-5">
        {/* Search box: a plain GET form, so results have their own URL */}
        <div className="flex items-center gap-2">
          <form action="/explore" role="search" className="flex flex-1 items-center gap-3 rounded-full bg-surface px-4 py-3 shadow-soft focus-within:ring-2 focus-within:ring-sky">
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-ink/40" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
              <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" />
            </svg>
            <input
              type="search"
              name="q"
              defaultValue={filters.q}
              maxLength={50}
              placeholder="Search jeans, vintage, Nike…"
              aria-label="Search items"
              className="min-w-0 flex-1 bg-transparent outline-none"
            />
            {/* Keep the other filters when searching */}
            {(["category", "size", "min", "max", "type"] as const).map(
              (key) => filters[key] && <input key={key} type="hidden" name={key} value={filters[key]} />,
            )}
          </form>
          <FilterSheet filters={filters} />
        </div>

        {/* Category chips (tap again to clear) */}
        <nav aria-label="Categories" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {CATEGORIES.map((category) => {
            const selected = filters.category === category;
            return (
              <Link
                key={category}
                href={`/explore${filtersToQuery({ ...filters, category: selected ? "" : category })}`}
                aria-current={selected ? "page" : undefined}
                className={`shrink-0 rounded-full px-4 py-2 text-sm ${selected ? "bg-navy text-white" : "bg-pale text-navy"}`}
              >
                {category}
              </Link>
            );
          })}
        </nav>

        {!searching && <StyleTwins myId={profile.id} />}

        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-bold text-navy">
              {searching ? `${items.length === 60 ? "60+" : items.length} result${items.length === 1 ? "" : "s"}` : "New on campus"}
            </h2>
            {searching && (
              <Link href="/explore" className="text-sm text-navy underline">
                Clear search
              </Link>
            )}
          </div>
          <ItemGrid
            items={items}
            likedIds={likes.ids}
            myId={profile.id}
            emptyText={searching ? "No items match. Try another word or fewer filters." : "Nothing posted yet. Tap + to list the first item."}
          />
        </section>
      </div>
    </main>
  );
}
