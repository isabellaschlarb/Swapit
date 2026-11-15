import type { createClient } from "@/lib/supabase/server";

// Small server-side lookups shared by several pages.
type Supabase = Awaited<ReturnType<typeof createClient>>;

// My likes: which items, and each liked item's style tags (for ranking).
export async function getMyLikes(supabase: Supabase) {
  const { data } = await supabase.from("likes").select("item_id, item:items(style_tags)");
  const rows = (data ?? []) as unknown as { item_id: string; item: { style_tags: string[] } | null }[];
  return {
    ids: new Set(rows.map((row) => row.item_id)),
    tags: rows.map((row) => row.item?.style_tags ?? []),
  };
}

// Ids of the people I follow.
export async function getFollowingIds(supabase: Supabase, myId: string) {
  const { data } = await supabase.from("follows").select("followee_id").eq("follower_id", myId);
  return new Set((data ?? []).map((row) => row.followee_id as string));
}
