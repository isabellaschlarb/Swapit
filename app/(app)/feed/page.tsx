import { FeedHeader, type FeedTab } from "@/components/FeedHeader";
import { ItemGrid, type ItemOwner } from "@/components/ItemCard";
import { createClient } from "@/lib/supabase/server";
import type { Item } from "@/lib/types";

// The feed: newest available items at MY school.
// We don't filter by school here, because the database security rules
// (RLS) already hide items from other schools.
//
// "For You" is where AI style matching will plug in (see HANDOFF.md).
// "Following" and "Trending" are placeholders for now.
export default async function FeedPage({ searchParams }: PageProps<"/feed">) {
  const { tab } = await searchParams;
  const active: FeedTab = tab === "following" || tab === "trending" ? tab : "for-you";

  if (active !== "for-you") {
    return (
      <main className="mx-auto w-full max-w-screen-2xl lg:px-5 lg:pt-4">
        <FeedHeader active={active} />
        <section className="px-5">
          <div className="space-y-2 rounded-2xl bg-surface p-8 text-center shadow-soft">
            <p className="font-bold text-navy">Coming soon</p>
            <p className="text-sm text-ink/60">
              {active === "following"
                ? "Follow students to see their newest posts here."
                : "The most-loved items on campus will show up here."}
            </p>
          </div>
        </section>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: items } = await supabase
    .from("items")
    .select("*, owner:profiles(display_name, avatar_url)")
    .eq("status", "available")
    .order("created_at", { ascending: false })
    .limit(60);

  return (
    <main className="mx-auto w-full max-w-screen-2xl lg:px-5 lg:pt-4">
      <FeedHeader active={active} />
      <section className="px-5">
        <ItemGrid
          items={(items ?? []) as (Item & { owner: ItemOwner | null })[]}
          emptyText="Nothing posted yet. Be the first, tap +!"
        />
      </section>
    </main>
  );
}
