import { CATEGORIES, STYLE_TAGS } from "@/lib/constants";

export const PAGE_SIZE = 24;
export const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export type SearchFilters = { mode: "listings" | "people"; q: string; category: string; tag: string };
type Cursor = { id: string; value: string };
type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => typeof value === "string" ? value : "";

export function searchFilters(params: Params): SearchFilters {
  const mode = one(params.mode) || "listings";
  const q = one(params.q).trim();
  const category = one(params.category);
  const tag = one(params.tag);
  if (!(mode === "people" || mode === "listings") || q.length > 100 ||
    (category && !CATEGORIES.some((c) => c === category)) || (tag && !STYLE_TAGS.some((t) => t === tag))) {
    throw new Error("Use a search up to 100 characters and the listed filters.");
  }
  return { mode, q, category: mode === "listings" ? category : "", tag: mode === "listings" ? tag : "" };
}
export function encodeCursor(cursor: Cursor, scope: string) {
  return Buffer.from(JSON.stringify({ ...cursor, scope })).toString("base64url");
}
export function decodeCursor(value: string | string[] | undefined, scope: string, mode: SearchFilters["mode"]): Cursor | null {
  if (!value) return null;
  try {
    if (typeof value !== "string" || value.length > 2048 || !/^[\w-]+$/.test(value)) throw new Error();
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (parsed.scope !== scope || typeof parsed.id !== "string" || !isUuid(parsed.id) || typeof parsed.value !== "string" ||
      (mode === "people" ? parsed.value.length > 1000 : !Number.isFinite(Date.parse(parsed.value)))) throw new Error();
    return { id: parsed.id, value: parsed.value };
  } catch { throw new Error("This page link is invalid or belongs to different filters. Start a new search."); }
}
export function searchScope(filters: SearchFilters, ownerId = "") { return JSON.stringify([filters, ownerId]); }
export function searchHref(filters: SearchFilters, cursor?: string) {
  const query = new URLSearchParams({ mode: filters.mode, q: filters.q });
  if (filters.category) query.set("category", filters.category);
  if (filters.tag) query.set("tag", filters.tag);
  if (cursor) query.set("cursor", cursor);
  return `/explore?${query}`;
}
export function pageOf<T extends { id: string }>(rows: T[], scope: string, value: (row: T) => string) {
  const results = rows.slice(0, PAGE_SIZE);
  const last = results.at(-1);
  return { results, next: rows.length > PAGE_SIZE && last ? encodeCursor({ id: last.id, value: value(last) }, scope) : null };
}
