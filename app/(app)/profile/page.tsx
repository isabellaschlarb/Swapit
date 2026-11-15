import { redirect } from "next/navigation";
import { ItemGrid } from "@/components/ItemCard";
import { createClient, getMyProfile } from "@/lib/supabase/server";
import type { Item } from "@/lib/types";
import { signOut } from "./actions";

export default async function ProfilePage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  // All my items, including ones that are pending or already swapped.
  const supabase = await createClient();
  const [{ data: items }, { data: likes }] = await Promise.all([
    supabase.from("items").select("*").eq("owner_id", profile.id).order("created_at", { ascending: false }),
    // Items I've hearted (RLS only returns my own likes).
    supabase.from("likes").select("item:items(*)").order("created_at", { ascending: false }),
  ]);
  const likedItems = ((likes ?? []) as unknown as { item: Item | null }[])
    .map((like) => like.item)
    .filter((item): item is Item => item !== null);

  const initial = (profile.display_name ?? "?").charAt(0).toUpperCase();

  return (
    <main className="mx-auto w-full max-w-screen-2xl space-y-8 break-words px-5 pt-8 lg:px-10 lg:pt-12">
      <section className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-pale text-2xl font-extrabold text-navy">
          {initial}
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy">{profile.display_name}</h1>
          <p className="text-sm text-ink/60">{profile.schoolName}</p>
        </div>
      </section>

      {profile.bio && <p>{profile.bio}</p>}

      {profile.style_tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {profile.style_tags.map((tag) => (
            <span key={tag} className="rounded-full bg-pale px-3 py-1 text-sm text-navy">
              {tag}
            </span>
          ))}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink/60">My items</h2>
        <ItemGrid items={(items ?? []) as Item[]} myId={profile.id} emptyText="You haven't posted anything yet." />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink/60">Liked</h2>
        <ItemGrid
          items={likedItems}
          likedIds={new Set(likedItems.map((item) => item.id))}
          myId={profile.id}
          emptyText="Tap the heart on anything you like and it'll show up here."
        />
      </section>

      <form action={signOut}>
        <button type="submit" className="w-full rounded-full px-6 py-3 text-sm text-ink/60 sm:w-auto">
          Sign out
        </button>
      </form>
    </main>
  );
}
