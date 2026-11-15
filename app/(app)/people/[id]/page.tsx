import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FollowButton } from "@/components/FollowButton";
import { ItemGrid, OWNER_SELECT, type ItemOwner } from "@/components/ItemCard";
import { ProfileHeader } from "@/components/ProfileHeader";
import { getFollowingIds, getMyLikes } from "@/lib/social";
import { createClient, getMyProfile } from "@/lib/supabase/server";
import type { Item, Profile } from "@/lib/types";

// Anyone's public profile + closet. RLS only finds people at my school,
// so someone from another school shows "not found".
export default async function PersonPage({ params }: PageProps<"/people/[id]">) {
  const { id } = await params;
  const me = await getMyProfile();
  if (!me) redirect("/login");
  if (id === me.id) redirect("/profile");

  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const person = data as Profile;

  const [{ data: items }, following, likes] = await Promise.all([
    supabase
      .from("items")
      .select(`*, ${OWNER_SELECT}`)
      .eq("owner_id", id)
      .in("status", ["available", "pending"])
      .order("created_at", { ascending: false }),
    getFollowingIds(supabase, me.id),
    getMyLikes(supabase),
  ]);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-5 pt-6 lg:pt-10">
      <Link href="/explore" className="text-sm text-navy">
        ← Explore
      </Link>
      <ProfileHeader
        person={person}
        schoolName={me.schoolName}
        action={<FollowButton personId={person.id} initialFollowing={following.has(person.id)} />}
      />

      <section className="space-y-3">
        <h2 className="font-bold text-navy">{person.display_name ?? "Their"}&apos;s closet</h2>
        <ItemGrid
          items={(items ?? []) as (Item & { owner: ItemOwner | null })[]}
          likedIds={likes.ids}
          myId={me.id}
          emptyText="Nothing listed right now. Follow them to see new items in your Following feed."
        />
      </section>
    </main>
  );
}
