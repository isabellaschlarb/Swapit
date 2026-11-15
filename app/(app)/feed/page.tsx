import Link from "next/link";
import { redirect } from "next/navigation";
import { FeedHeader, type FeedTab } from "@/components/FeedHeader";
import { InstallBanner } from "@/components/InstallBanner";
import { ItemGrid, OWNER_SELECT, type ItemOwner } from "@/components/ItemCard";
import { activeFilterCount, applyFilters, parseFilters } from "@/lib/filters";
import { rankForYou } from "@/lib/for-you";
import { getFollowingIds, getMyLikes } from "@/lib/social";
import { createClient, getMyProfile } from "@/lib/supabase/server";
import type { Item } from "@/lib/types";

type FeedItem = Item & { owner: ItemOwner | null };

// The home feed, with three tabs (like the brand board):
//   For You    available items at my school, ranked by my style (lib/for-you.ts)
//   Following  items from people I follow, newest first
//   Trending   most-liked items at my school in the last 7 days
// The filter sheet (category, size, price, swap/buy) applies to all three.
// We don't filter by school here: the database rules (RLS) already hide
// items from other schools.
export default async function FeedPage({ searchParams }: PageProps<"/feed">) {
  const params = await searchParams;
  const tab: FeedTab = params.tab === "following" || params.tab === "trending" ? params.tab : "for-you";
  const filters = { ...parseFilters(params), q: "" };

  const profile = await getMyProfile();
  if (!profile) redirect("/login");
  const supabase = await createClient();
  const likes = await getMyLikes(supabase);

  const itemsQuery = () =>
    applyFilters(
      supabase.from("items").select(`*, ${OWNER_SELECT}`).eq("status", "available"),
      filters,
    );

  let items: FeedItem[] = [];
  let matchIds: Set<string> | undefined;
  let notes: Map<string, string> | undefined;
  let empty: React.ReactNode;

  if (tab === "for-you") {
    const { data } = await itemsQuery().order("created_at", { ascending: false }).limit(200);
    const ranked = rankForYou((data ?? []) as FeedItem[], profile.style_tags, likes.tags);
    items = ranked.items.slice(0, 60);
    matchIds = ranked.matchIds;
    empty = <EmptyCard title="Nothing here yet" text="Be the first to post something. Tap + to list an item." />;
  }

  if (tab === "following") {
    const following = await getFollowingIds(supabase, profile.id);
    if (following.size > 0) {
      const { data } = await itemsQuery()
        .in("owner_id", [...following])
        .order("created_at", { ascending: false })
        .limit(60);
      items = (data ?? []) as FeedItem[];
    }
    empty = (
      <EmptyCard
        title={following.size === 0 ? "You're not following anyone yet" : "No new items from people you follow"}
        text="Follow people with your style to see their closet here."
        link={{ href: "/explore", label: "Find your style twins" }}
      />
    );
  }

  if (tab === "trending") {
    const { data: trending } = await supabase.rpc("trending_items", { days: 7, max_items: 60 });
    const counts = new Map(((trending ?? []) as { item_id: string; like_count: number }[]).map((t) => [t.item_id, Number(t.like_count)]));
    if (counts.size > 0) {
      const { data } = await itemsQuery().in("id", [...counts.keys()]);
      // Keep the most-liked first.
      items = ((data ?? []) as FeedItem[]).sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
      notes = new Map(items.map((item) => [item.id, `♥ ${counts.get(item.id)} this week`]));
    }
    empty = (
      <EmptyCard
        title="Nothing trending this week"
        text="Tap the heart on items you love. The most-liked ones on campus show up here."
      />
    );
  }

  if (activeFilterCount(filters) > 0) {
    empty = (
      <EmptyCard
        title="No items match your filters"
        text="Try a different size or price range."
        link={{ href: tab === "for-you" ? "/feed" : `/feed?tab=${tab}`, label: "Clear filters" }}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-screen-2xl lg:px-5 lg:pt-4">
      <FeedHeader active={tab} filters={filters} />
      <section className="space-y-4 px-5">
        <InstallBanner />
        <ItemGrid items={items} likedIds={likes.ids} matchIds={matchIds} notes={notes} myId={profile.id} empty={empty} />
      </section>
    </main>
  );
}

function EmptyCard({ title, text, link }: { title: string; text: string; link?: { href: string; label: string } }) {
  return (
    <div className="space-y-3 rounded-2xl bg-surface p-8 text-center shadow-soft">
      <p className="font-bold text-navy">{title}</p>
      <p className="text-sm text-ink/60">{text}</p>
      {link && (
        <Link href={link.href} className="inline-block rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white">
          {link.label}
        </Link>
      )}
    </div>
  );
}
