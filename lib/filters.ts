import { CATEGORIES, SIZES, STYLE_TAGS } from "@/lib/constants";
import { dollarsToCents } from "@/lib/format";

// Feed + Explore filters. They live in the URL (?category=Tops&size=M...)
// so a filtered page can be shared, reloaded, or opened with the back button.

export type Filters = {
  q: string; // search text (Explore)
  category: string;
  size: string;
  min: string; // dollars, as typed
  max: string;
  type: "" | "swap" | "sell";
};

type Params = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export function parseFilters(params: Params): Filters {
  const category = one(params.category);
  const size = one(params.size);
  const type = one(params.type);
  return {
    // Keep letters, numbers, spaces, ' and - only, so the text is safe to
    // put inside a database search.
    q: one(params.q).replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 50),
    category: (CATEGORIES as readonly string[]).includes(category) ? category : "",
    size: (SIZES as readonly string[]).includes(size) ? size : "",
    min: /^\d{1,5}$/.test(one(params.min)) ? one(params.min) : "",
    max: /^\d{1,5}$/.test(one(params.max)) ? one(params.max) : "",
    type: type === "swap" || type === "sell" ? type : "",
  };
}

// How many filters (not counting search) are on, for the badge on the filter icon.
export function activeFilterCount(f: Filters) {
  return [f.category, f.size, f.min || f.max, f.type].filter(Boolean).length;
}

// The few query methods we use, so this works with any items query.
type Filterable<Q> = {
  eq(column: string, value: string): Q;
  in(column: string, values: string[]): Q;
  or(filters: string): Q;
};

// Adds the filters to a Supabase items query.
export function applyFilters<Q>(query: Q, f: Filters): Q {
  let q = query as Q & Filterable<Q>;
  const next = (result: Q) => (q = result as Q & Filterable<Q>);

  if (f.category) next(q.eq("category", f.category));
  if (f.size) next(q.eq("size", f.size));
  // "Swap" = swap or swap-or-sell. "Buy" = sell or swap-or-sell.
  if (f.type === "swap") next(q.in("listing_type", ["swap", "swap_or_sell"]));
  if (f.type === "sell") next(q.in("listing_type", ["sell", "swap_or_sell"]));

  // "Either/or" conditions. There can be two, so they're combined into one.
  const eitherOr: string[] = [];
  if (f.q) {
    // Title or description contains the text, or a word matches a style tag.
    const like = `*${f.q}*`;
    const tags = f.q.toLowerCase().split(" ").filter((word) => (STYLE_TAGS as readonly string[]).includes(word));
    const parts = [`title.ilike.${like}`, `description.ilike.${like}`];
    if (tags.length > 0) parts.push(`style_tags.ov.{${tags.join(",")}}`);
    eitherOr.push(parts.join(","));
  }
  if (f.min || f.max) {
    // Price range: the asking price, or the estimated value for swap-only items.
    const range = (column: string) =>
      [f.min && `${column}.gte.${dollarsToCents(f.min)}`, f.max && `${column}.lte.${dollarsToCents(f.max)}`]
        .filter(Boolean)
        .join(",");
    eitherOr.push(`and(price_cents.not.is.null,${range("price_cents")}),and(price_cents.is.null,${range("estimated_value_cents")})`);
  }
  if (eitherOr.length === 1) next(q.or(eitherOr[0]));
  if (eitherOr.length === 2) next(q.or(`and(or(${eitherOr[0]}),or(${eitherOr[1]}))`));
  return q;
}

// Turns filters back into a URL query string (empty values left out).
export function filtersToQuery(f: Partial<Filters> & { tab?: string }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(f)) if (value) params.set(key, value);
  const text = params.toString();
  return text ? `?${text}` : "";
}
