import { FeedHeader } from "@/components/FeedHeader";
import { InstallBanner } from "@/components/InstallBanner";
import { ItemGrid, type ItemOwner } from "@/components/ItemCard";
import { createClient } from "@/lib/supabase/server";
import type { Item } from "@/lib/types";

// The feed: newest available items at MY school.
// We don't filter by school here, because the database security rules
// (RLS) already hide items from other schools.
//
// "For You" is where AI style matching will plug in (see HANDOFF.md).
export default async function FeedPage() {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("items")
    .select("*, owner:profiles(display_name, avatar_url)")
    .eq("status", "available")
    .order("created_at", { ascending: false })
    .limit(60);

  return (
    <main className="mx-auto w-full max-w-screen-2xl lg:px-5 lg:pt-4">
      <FeedHeader />
      <section className="space-y-4 px-5">
        <InstallBanner />
        <ItemGrid
          items={(items ?? []) as (Item & { owner: ItemOwner | null })[]}
          emptyText="Nothing posted yet. Be the first, tap +!"
        />
      </section>
    </main>
  );
}
