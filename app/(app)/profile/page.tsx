import Link from "next/link";
import { redirect } from "next/navigation";
import { ItemGrid } from "@/components/ItemCard";
import { ProfileHeader } from "@/components/ProfileHeader";
import { StyleTwins } from "@/components/StyleTwins";
import { createClient, getMyProfile } from "@/lib/supabase/server";
import type { Item } from "@/lib/types";
import { signOut } from "./actions";

// My own profile: header + Edit, style twins, my items, items I liked.
export default async function ProfilePage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const [{ data: items }, { data: likes }] = await Promise.all([
    // All my items, including ones that are pending or already swapped.
    supabase.from("items").select("*").eq("owner_id", profile.id).order("created_at", { ascending: false }),
    // Items I've hearted (RLS only returns my own likes).
    supabase.from("likes").select("item:items(*)").order("created_at", { ascending: false }),
  ]);
  const likedItems = ((likes ?? []) as unknown as { item: Item | null }[])
    .map((like) => like.item)
    .filter((item): item is Item => item !== null);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-5 pt-8 lg:pt-10">
      <ProfileHeader
        person={profile}
        schoolName={profile.schoolName}
        action={
          <Link href="/profile/edit" className="rounded-full border border-navy px-4 py-2 text-sm font-semibold text-navy">
            Edit
          </Link>
        }
      />

      <StyleTwins myId={profile.id} title="Meet new people" />

      <section className="space-y-3">
        <h2 className="font-bold text-navy">My items</h2>
        <ItemGrid items={(items ?? []) as Item[]} myId={profile.id} emptyText="You haven't posted anything yet. Tap + to list something." />
      </section>

      <section className="space-y-3">
        <h2 className="font-bold text-navy">Liked</h2>
        <ItemGrid
          items={likedItems}
          likedIds={new Set(likedItems.map((item) => item.id))}
          myId={profile.id}
          emptyText="Tap the heart on anything you like and it'll show up here."
        />
      </section>

      <form action={signOut}>
        <button type="submit" className="w-full rounded-full px-6 py-3 text-sm text-ink/60">
          Sign out
        </button>
      </form>
    </main>
  );
}
