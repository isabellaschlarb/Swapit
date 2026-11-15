import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { FollowButton } from "@/components/FollowButton";
import { UserName } from "@/components/UserName";
import { getFollowingIds } from "@/lib/social";
import { createClient } from "@/lib/supabase/server";

type Twin = { id: string; display_name: string | null; avatar_url: string | null; style_tags: string[]; match_pct: number };

// "Meet new people": students at my school whose style (profile tags +
// liked items) is most like mine, with a match % and a Follow button.
// The matching runs in the database (style_twins in 0008_social.sql).
// Shows nothing if there's nobody to suggest yet.
export async function StyleTwins({ myId, title = "Style twins" }: { myId: string; title?: string }) {
  const supabase = await createClient();
  const { data: matches } = await supabase.rpc("style_twins", { max_people: 10 });
  const pct = new Map(((matches ?? []) as { profile_id: string; match_pct: number }[]).map((m) => [m.profile_id, m.match_pct]));
  if (pct.size === 0) return null;

  const [{ data: people }, following] = await Promise.all([
    supabase.from("profiles").select("id, display_name, avatar_url, style_tags").in("id", [...pct.keys()]),
    getFollowingIds(supabase, myId),
  ]);
  const twins = ((people ?? []) as Omit<Twin, "match_pct">[])
    .map((person) => ({ ...person, match_pct: pct.get(person.id) ?? 0 }))
    .sort((a, b) => b.match_pct - a.match_pct);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-bold text-navy">{title}</h2>
        <p className="text-sm text-ink/60">Students at your school with a style like yours</p>
      </div>
      <ul className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
        {twins.map((twin) => (
          <li key={twin.id} className="w-40 shrink-0 snap-start space-y-2 rounded-2xl bg-surface p-3 text-center shadow-soft">
            <Link href={`/people/${twin.id}`} className="block space-y-2">
              <span className="flex justify-center">
                <Avatar name={twin.display_name} url={twin.avatar_url} size={56} />
              </span>
              <UserName name={twin.display_name} className="max-w-full justify-center text-sm font-semibold text-navy" />
              <span className="block text-xs font-bold text-navy">{twin.match_pct}% style match</span>
              <span className="block truncate text-xs text-ink/60">{twin.style_tags.slice(0, 3).join(" · ")}</span>
            </Link>
            <FollowButton personId={twin.id} initialFollowing={following.has(twin.id)} small />
          </li>
        ))}
      </ul>
    </section>
  );
}
