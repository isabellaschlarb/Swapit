"use client";

import { useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, STYLE_TAGS } from "@/lib/constants";
import type { SearchFilters } from "@/lib/search";

export function SearchForm({ filters }: { filters: SearchFilters }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const query = new URLSearchParams();
    for (const [key, value] of data) if (typeof value === "string" && value) query.set(key, value);
    startTransition(() => router.push(`/explore?${query}`));
  }
  return (
    <form onSubmit={search} method="get" action="/explore" className="space-y-3 rounded-2xl bg-surface p-4 shadow-soft" aria-label="Search your school">
      <label className="block space-y-1 text-sm"><span>Search for</span><select name="mode" defaultValue={filters.mode} className="w-full rounded-xl border border-ink/15 bg-cloud p-3"><option value="listings">Listings</option><option value="people">People</option></select></label>
      <label className="block space-y-1 text-sm"><span>Words or public display name</span><input name="q" maxLength={100} defaultValue={filters.q} type="search" placeholder="Jacket, vintage, or a name" className="w-full rounded-xl border border-ink/15 bg-cloud p-3" /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1 text-sm"><span>Listing category</span><select name="category" defaultValue={filters.category} className="w-full rounded-xl border border-ink/15 bg-cloud p-3"><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="block space-y-1 text-sm"><span>Listing style</span><select name="tag" defaultValue={filters.tag} className="w-full rounded-xl border border-ink/15 bg-cloud p-3"><option value="">All styles</option>{STYLE_TAGS.map((t) => <option key={t}>{t}</option>)}</select></label>
      </div>
      <p className="text-xs text-ink/60">Listing search includes titles, descriptions, categories and tags. People search uses public display names; listing filters don’t apply to people.</p>
      <button type="submit" disabled={pending} className="w-full rounded-full bg-navy px-4 py-3 font-semibold text-white disabled:opacity-60">{pending ? "Searching…" : "Search my school"}</button>
      {pending && <p role="status" className="text-sm text-ink/60">Loading results…</p>}
    </form>
  );
}
