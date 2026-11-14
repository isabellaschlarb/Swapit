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
  const { data: items } = await supabase
    .from("items")
    .select("*")
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: false });

  const initial = (profile.display_name ?? "?").charAt(0).toUpperCase();

  return (
    <main className="space-y-8 px-5 pt-8">
      <section className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-2xl font-medium">
          {initial}
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{profile.display_name}</h1>
          <p className="text-sm text-ink/60">{profile.schoolName}</p>
        </div>
      </section>

      {profile.bio && <p>{profile.bio}</p>}

      {profile.style_tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {profile.style_tags.map((tag) => (
            <span key={tag} className="rounded-full bg-accent/50 px-3 py-1 text-sm">
              {tag}
            </span>
          ))}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink/60">My items</h2>
        <ItemGrid items={(items ?? []) as Item[]} emptyText="You haven't posted anything yet." />
      </section>

      <form action={signOut}>
        <button type="submit" className="w-full rounded-full px-6 py-3 text-sm text-ink/60">
          Sign out
        </button>
      </form>
    </main>
  );
}
