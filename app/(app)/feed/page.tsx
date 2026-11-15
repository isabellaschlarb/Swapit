import { redirect } from "next/navigation";
import { FeedHeader } from "@/components/FeedHeader";
import { InstallBanner } from "@/components/InstallBanner";
import { ItemGrid, type ItemOwner } from "@/components/ItemCard";
import { rankForYou } from "@/lib/for-you";
import { createClient, getMyProfile } from "@/lib/supabase/server";
import type { Item } from "@/lib/types";

type FeedItem = Item & { owner: ItemOwner | null };

// The "For You" feed: available items at MY school, ranked by how well
// their style tags match mine (profile tags + tags of items I liked),
// plus a boost for new posts. The math is in lib/for-you.ts.
// We don't filter by school here, because the database security rules
// (RLS) already hide items from other schools.
export default async function FeedPage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const [{ data: items }, { data: likes }] = await Promise.all([
    supabase
      .from("items")
      .select("*, owner:profiles(display_name, avatar_url)")
      .eq("status", "available")
      .order("created_at", { ascending: false })
      .limit(200),
    // My likes (RLS only returns mine), with each liked item's tags.
    supabase.from("likes").select("item_id, item:items(style_tags)"),
  ]);

  const myLikes = (likes ?? []) as unknown as { item_id: string; item: { style_tags: string[] } | null }[];
  const ranked = rankForYou(
    (items ?? []) as FeedItem[],
    profile.style_tags,
    myLikes.map((like) => like.item?.style_tags ?? []),
  );

  return (
    <main className="mx-auto w-full max-w-screen-2xl lg:px-5 lg:pt-4">
      <FeedHeader />
      <section className="space-y-4 px-5">
        <InstallBanner />
        <ItemGrid
          items={ranked.items.slice(0, 60)}
          likedIds={new Set(myLikes.map((like) => like.item_id))}
          matchIds={ranked.matchIds}
          myId={profile.id}
          emptyText="Nothing posted yet. Be the first, tap +!"
        />
      </section>
    </main>
  );
}
