import { PageHeader } from "@/components/PageHeader";
import { CATEGORIES } from "@/lib/constants";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { MutualMatches } from "@/components/MutualMatches";

// PLACEHOLDER: search + browse by category is a future feature.
export default async function ExplorePage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = user
    ? await supabase.from("swap_preferences").select("category, size, details").eq("user_id", user.id).maybeSingle()
    : { data: null, error: null };
  return (
    <main>
      <PageHeader title="Explore" />
      <section className="space-y-6 px-5">
        <MutualMatches initial={data} setupError={Boolean(error)} />
        <div className="flex items-center gap-3 rounded-full bg-surface px-4 py-3 text-ink/40 shadow-soft">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
            <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" />
          </svg>
          Search is coming soon
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((category) => (
            <span key={category} className="rounded-full bg-pale px-4 py-2 text-sm text-navy">
              {category}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
