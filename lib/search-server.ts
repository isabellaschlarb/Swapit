import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decodeCursor, pageOf, searchScope, type SearchFilters } from "@/lib/search";
import { avatarUrl } from "@/lib/profile-input";
import type { Item } from "@/lib/types";

export type PublicPerson = {
  id: string; display_name: string | null; bio: string | null; avatar_url: string | null; style_tags: string[];
};
type PersonRow = PublicPerson & { avatar_path: string | null };

// Explicit allowlist: never serialize a raw profile row or its storage path.
export function publicPerson(row: PersonRow): PublicPerson {
  return { id: row.id, display_name: row.display_name, bio: row.bio, style_tags: row.style_tags, avatar_url: avatarUrl(row) };
}
export async function listingSearch(client: SupabaseClient, filters: SearchFilters, cursor?: string | string[], ownerId = "") {
  const scope = searchScope(filters, ownerId);
  const after = decodeCursor(cursor, scope, "listings");
  try {
    const { data, error } = await client.rpc("search_campus_items", {
      query_text: filters.q, category_filter: filters.category || null, tag_filter: filters.tag || null,
      after_created_at: after?.value ?? null, after_id: after?.id ?? null, owner_filter: ownerId || null,
    });
    if (error) throw error;
    return pageOf((data ?? []) as Item[], scope, (item) => item.created_at);
  } catch { throw new Error("Listings couldn't load. Please try again."); }
}
export async function peopleSearch(client: SupabaseClient, filters: SearchFilters, cursor?: string | string[]) {
  const scope = searchScope(filters);
  const after = decodeCursor(cursor, scope, "people");
  try {
    const { data, error } = await client.rpc("search_campus_people", { query_text: filters.q, after_name: after?.value ?? null, after_id: after?.id ?? null });
    if (error) throw error;
    const page = pageOf((data ?? []) as PersonRow[], scope, (person) => person.display_name ?? "");
    return { ...page, results: page.results.map(publicPerson) };
  } catch { throw new Error("People couldn't load. Please try again."); }
}
