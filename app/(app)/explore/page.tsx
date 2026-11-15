import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ItemGrid } from "@/components/ItemCard";
import { SearchForm } from "@/components/SearchForm";
import { PeopleResults } from "@/components/PeopleResults";
import { createClient } from "@/lib/supabase/server";
import { searchFilters, searchHref, type SearchFilters } from "@/lib/search";
import { listingSearch, peopleSearch, type PublicPerson } from "@/lib/search-server";
import type { Item } from "@/lib/types";

type Params = Record<string, string | string[] | undefined>;
export default async function ExplorePage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  let filters: SearchFilters = { mode: "listings", q: "", category: "", tag: "" };
  let listings: Item[] = [], people: PublicPerson[] = [];
  let next: string | null = null, error = "";
  try {
    filters = searchFilters(params);
    const client = await createClient();
    if (filters.mode === "listings") {
      const page = await listingSearch(client, filters, params.cursor);
      listings = page.results;
      next = page.next;
    } else {
      const page = await peopleSearch(client, filters, params.cursor);
      people = page.results;
      next = page.next;
    }
  } catch (cause) { error = cause instanceof Error ? cause.message : "Search couldn't load. Please try again."; }
  return (
    <main>
      <PageHeader title="Explore" />
      <section className="space-y-5 px-5 pb-6">
        <SearchForm key={JSON.stringify(filters)} filters={filters} />
        {error ? <div role="alert" className="space-y-2 rounded-2xl bg-pale p-4 text-sm"><p>{error}</p><Link href={searchHref(filters)} className="font-semibold text-navy underline">Retry from the first page</Link></div> : <>
          <h2 className="font-bold text-navy">{filters.mode === "listings" ? "Available listings" : "People at your school"}</h2>
          {filters.mode === "listings" ? <ItemGrid items={listings} emptyText="No available listings match. Try different words or clear the filters." /> : <PeopleResults people={people} />}
          <nav aria-label="Search pages" className="flex items-center justify-between gap-3 text-sm text-navy">
            {params.cursor ? <Link href={searchHref(filters)} className="rounded-full border border-navy px-4 py-3">First page</Link> : <span />}
            {next ? <Link href={searchHref(filters, next)} className="rounded-full bg-navy px-4 py-3 font-semibold text-white">Next page →</Link> : <span className="text-ink/60">End of results</span>}
          </nav>
        </>}
      </section>
    </main>
  );
}
