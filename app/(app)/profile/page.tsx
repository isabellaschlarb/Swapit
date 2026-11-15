import { redirect } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { ProfileEditor } from "@/components/ProfileEditor";
import { avatarUrl } from "@/lib/profile-input";
import { ItemGrid } from "@/components/ItemCard";
import { createClient, getMyProfile } from "@/lib/supabase/server";
import type { Item } from "@/lib/types";
import { signOut } from "./actions";

export default async function ProfilePage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  // All my items, including ones that are pending or already swapped.
  const supabase = await createClient();
  const { data: items, error: itemsError } = await supabase
    .from("items")
    .select("*")
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: false });

  return (
    <main className="space-y-8 px-5 pt-8">
      <section className="flex items-center gap-4">
        <Avatar name={profile.display_name} url={avatarUrl(profile)} size={64} />
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-extrabold tracking-tight text-navy">{profile.display_name}</h1>
          <p className="text-sm text-ink/60">{profile.schoolName}</p>
        </div>
      </section>

      {profile.bio && <p className="whitespace-pre-wrap break-words">{profile.bio}</p>}
      <ProfileEditor name={profile.display_name} bio={profile.bio} />
      <Link href={`/people/${profile.id}`} className="block text-sm font-semibold text-navy underline">View my public closet</Link>

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
        {itemsError ? <p role="alert" className="rounded-2xl bg-pale p-4 text-sm">Your listings couldn&apos;t load. <Link href="/profile" className="underline">Try again</Link>.</p> : <ItemGrid items={(items ?? []) as Item[]} emptyText="You haven't posted anything yet." />}
      </section>

      <form action={signOut}>
        <button type="submit" className="w-full rounded-full px-6 py-3 text-sm text-ink/60">
          Sign out
        </button>
      </form>
    </main>
  );
}
