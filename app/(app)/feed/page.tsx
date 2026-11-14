import { ItemGrid } from "@/components/ItemCard";
import { PageHeader } from "@/components/PageHeader";
import { createClient, getMyProfile } from "@/lib/supabase/server";
import type { Item } from "@/lib/types";

// The feed: newest available items at MY school.
// We don't filter by school here, because the database security rules
// (RLS) already hide items from other schools.
export default async function FeedPage() {
  const supabase = await createClient();
  const [profile, { data: items }] = await Promise.all([
    getMyProfile(),
    supabase
      .from("items")
      .select("*")
      .eq("status", "available")
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  return (
    <main>
      <PageHeader title="Feed" subtitle={profile ? `Fresh finds at ${profile.schoolName}` : undefined} />
      <section className="px-5">
        <ItemGrid
          items={(items ?? []) as Item[]}
          emptyText="Nothing posted yet. Be the first. Tap Post!"
        />
      </section>
    </main>
  );
}
