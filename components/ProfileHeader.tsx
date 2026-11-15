import { Avatar } from "@/components/Avatar";
import { UserName } from "@/components/UserName";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

// The top of a profile page (mine or someone else's): big avatar, name
// with the verified shield, school, bio, style tags, usual meetup spot,
// and the swaps / followers / following numbers.
// `action` is a button on the right (Follow, or Edit profile).
export async function ProfileHeader({
  person,
  schoolName,
  action,
}: {
  person: Pick<Profile, "id" | "display_name" | "avatar_url" | "bio" | "style_tags" | "preferred_meetup_spot_id">;
  schoolName?: string;
  action?: React.ReactNode;
}) {
  const supabase = await createClient();
  const [{ data: stats }, { data: spot }] = await Promise.all([
    supabase.rpc("profile_stats", { person: person.id }).maybeSingle(),
    person.preferred_meetup_spot_id
      ? supabase.from("meetup_spots").select("name").eq("id", person.preferred_meetup_spot_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const numbers = stats as { swap_count: number; followers: number; following: number } | null;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar name={person.display_name} url={person.avatar_url} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-navy">
            <UserName name={person.display_name} badgeSize={20} className="max-w-full" />
          </h1>
          {schoolName && <p className="text-sm text-ink/60">Verified student · {schoolName}</p>}
        </div>
        {action}
      </div>

      <dl className="grid grid-cols-3 rounded-2xl bg-surface py-3 text-center shadow-soft">
        {[
          ["Swaps", numbers?.swap_count ?? 0],
          ["Followers", numbers?.followers ?? 0],
          ["Following", numbers?.following ?? 0],
        ].map(([label, value]) => (
          <div key={label}>
            <dd className="text-lg font-extrabold text-navy">{value}</dd>
            <dt className="text-xs text-ink/60">{label}</dt>
          </div>
        ))}
      </dl>

      {person.bio && <p className="whitespace-pre-line">{person.bio}</p>}

      {(person.style_tags.length > 0 || spot) && (
        <div className="flex flex-wrap gap-2">
          {person.style_tags.map((tag) => (
            <span key={tag} className="rounded-full bg-pale px-3 py-1 text-sm text-navy">
              {tag}
            </span>
          ))}
          {spot && (
            <span className="rounded-full border border-navy/15 px-3 py-1 text-sm text-navy">
              📍 Usually meets at {(spot as { name: string }).name}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
