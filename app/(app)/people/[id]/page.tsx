import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { ItemGrid } from "@/components/ItemCard";
import { createClient, getMyProfile } from "@/lib/supabase/server";
import { isUuid, type SearchFilters } from "@/lib/search";
import { listingSearch, publicPerson } from "@/lib/search-server";

export default async function PublicCloset({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const mine = await getMyProfile();
  if (!mine) redirect("/login");
  const client = await createClient();
  const target = await client.from("profiles").select("id, display_name, bio, avatar_url, avatar_path, style_tags")
    .eq("id", id).eq("school_id", mine.school_id).maybeSingle();
  if (target.error) return <main className="space-y-3 px-5 py-8"><p role="alert">This closet couldn&apos;t load. Please try again.</p><Link href={`/people/${id}`} className="text-navy underline">Retry</Link></main>;
  if (!target.data) notFound();
  const person = publicPerson(target.data);
  const filters: SearchFilters = { mode: "listings", q: "", category: "", tag: "" };
  const { cursor } = await searchParams;
  let page: Awaited<ReturnType<typeof listingSearch>> | null = null, error = "";
  try { page = await listingSearch(client, filters, cursor, id); }
  catch (cause) { error = cause instanceof Error ? cause.message : "Listings couldn't load."; }
  return (
    <main className="space-y-6 px-5 py-8">
      <Link href="/explore?mode=people" className="text-sm text-navy underline">← Find people</Link>
      <header className="flex items-center gap-4"><Avatar name={person.display_name} url={person.avatar_url} size={64} /><h1 className="min-w-0 break-words text-2xl font-extrabold text-navy">{person.display_name ?? "Student closet"}</h1></header>
      {person.bio && <p className="whitespace-pre-wrap break-words">{person.bio}</p>}
      {person.style_tags.length > 0 && <div className="flex flex-wrap gap-2">{person.style_tags.map((tag) => <span key={tag} className="rounded-full bg-pale px-3 py-1 text-sm text-navy">{tag}</span>)}</div>}
      {id === mine.id && <Link href="/profile" className="text-sm text-navy underline">Edit my profile</Link>}
      <h2 className="font-bold text-navy">Available listings</h2>
      {error ? <p role="alert" className="rounded-2xl bg-pale p-4 text-sm">{error} <Link href={`/people/${id}`} className="underline">Retry</Link></p> : page && <>
        <ItemGrid items={page.results} emptyText="This closet has no available listings right now." />
        <nav aria-label="Closet pages" className="flex items-center justify-between gap-3 text-sm text-navy">
          {cursor ? <Link href={`/people/${id}`} className="rounded-full border border-navy px-4 py-3">First page</Link> : <span />}
          {page.next ? <Link href={`/people/${id}?cursor=${encodeURIComponent(page.next)}`} className="rounded-full bg-navy px-4 py-3 text-white">Next page →</Link> : <span className="text-ink/60">End of listings</span>}
        </nav>
      </>}
    </main>
  );
}
