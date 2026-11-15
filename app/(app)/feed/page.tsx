import { FeedHeader, type FeedTab } from "@/components/FeedHeader";
import { ItemGrid, type ItemOwner } from "@/components/ItemCard";
import { createClient } from "@/lib/supabase/server";
import type { Item } from "@/lib/types";
import { avatarUrl } from "@/lib/profile-input";
import Link from "next/link";

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
      <main>
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
  const { data: items, error: itemsError } = await supabase
    .from("items")
    .select("*, owner:profiles(display_name, avatar_url, avatar_path)")
    .eq("status", "available")
    .order("created_at", { ascending: false })
    .limit(60);

  if (itemsError) {
    return (
      <main>
        <FeedHeader active={active} />
        <section role="alert" className="space-y-2 px-5">
          <p>Your feed couldn&apos;t load.</p>
          <Link href="/feed" className="text-sm font-semibold text-navy underline">Try again</Link>
        </section>
      </main>
    );
  }

  return (
    <main>
      <FeedHeader active={active} />
      <section className="px-5">
        <ItemGrid
          items={((items ?? []) as unknown as (Item & { owner: (ItemOwner & { avatar_path: string | null }) | null })[]).map((item) => ({
            ...item, owner: item.owner ? { display_name: item.owner.display_name, avatar_url: avatarUrl({ ...item.owner, id: item.owner_id }) } : null,
          }))}
          emptyText="Nothing posted yet. Be the first, tap +!"
        />
      </section>
    </main>
  );
}
