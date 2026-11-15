import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import type { PublicPerson } from "@/lib/search-server";

export function PeopleResults({ people }: { people: PublicPerson[] }) {
  if (!people.length) return <p className="rounded-2xl bg-surface p-5 text-ink/60">No people found at your school. Try another display name.</p>;
  return <div className="space-y-3">{people.map((person) => (
    <Link key={person.id} href={`/people/${person.id}`} className="flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-soft">
      <Avatar name={person.display_name} url={person.avatar_url} size={48} />
      <div className="min-w-0"><p className="break-words font-bold text-navy">{person.display_name}</p>{person.bio && <p className="line-clamp-2 break-words text-sm text-ink/70">{person.bio}</p>}</div>
    </Link>
  ))}</div>;
}
