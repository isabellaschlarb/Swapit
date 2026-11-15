import type { Item } from "@/lib/types";

export type Preference = {
  user_id: string;
  school_id: string;
  category: string;
  size: string | null;
  details: string;
};
export type Pair = { wanted: Item; offered: Item; mine: Preference; theirs: Preference };

export function eligible(item: Item, schoolId: string) {
  return item.school_id === schoolId && item.status === "available" &&
    (item.listing_type === "swap" || item.listing_type === "swap_or_sell");
}

function fits(item: Item, preference: Preference) {
  return item.category === preference.category && (!preference.size || item.size === preference.size);
}

// Never substitute style tags, bios, or an AI guess for explicit wanted items.
export function candidatePairs(userId: string, schoolId: string, items: Item[], preferences: Preference[]): Pair[] {
  const prefs = new Map(preferences.filter((p) => p.school_id === schoolId).map((p) => [p.user_id, p]));
  const mine = prefs.get(userId);
  if (!mine) return [];
  const available = items.filter((item) => eligible(item, schoolId));
  const offered = available.filter((item) => item.owner_id === userId);
  const byOwner = new Map<string, Pair[]>();
  for (const wanted of available) {
    const theirs = prefs.get(wanted.owner_id);
    if (wanted.owner_id === userId || !theirs || !fits(wanted, mine)) continue;
    const alternatives = byOwner.get(wanted.owner_id) ?? [];
    // No owner can contribute more than the total provider budget. Keep enough
    // alternatives for description checks without building an unbounded group.
    if (alternatives.length === 24) continue;
    for (const item of offered) {
      if (fits(item, theirs)) alternatives.push({ wanted, offered: item, mine, theirs });
      if (alternatives.length === 24) break;
    }
    if (alternatives.length) byOwner.set(wanted.owner_id, alternatives);
  }
  // Give each owner one candidate before taking their next alternative. Spare
  // slots go to owners with more options; the provider still receives at most 24.
  const pairs: Pair[] = [];
  for (let index = 0; index < 24; index++) {
    for (const alternatives of byOwner.values()) {
      const pair = alternatives[index];
      if (pair) pairs.push(pair);
      if (pairs.length === 24) return pairs;
    }
  }
  return pairs;
}

// Only text needed for preference interpretation goes to the provider.
// IDs are request-local indices, not user IDs. Photos, emails and messages stay out.
export function aiCandidates(pairs: Pair[]) {
  const text = (value: string | null, limit: number) =>
    (value ?? "").slice(0, limit).replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email omitted]");
  const listing = (item: Item) => ({
    title: text(item.title, 100), description: text(item.description, 1000),
    category: text(item.category, 40), size: text(item.size, 20), condition: text(item.condition, 40),
  });
  return pairs.map((p, index) => ({
    id: String(index), wanted: listing(p.wanted), offered: listing(p.offered),
    myDetails: text(p.mine.details, 300), theirDetails: text(p.theirs.details, 300),
  }));
}

export function validateAI(text: string, candidates: ReturnType<typeof aiCandidates>) {
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== "object" || !("matches" in value) ||
    Object.keys(value).length !== 1 || !Array.isArray(value.matches) || value.matches.length > candidates.length) {
    throw new Error("Invalid matching response");
  }
  const ids = new Set(candidates.map((p) => p.id));
  const seen = new Set<string>();
  const matches: string[] = [];
  for (const row of value.matches) {
    if (!row || typeof row !== "object" || Object.keys(row).sort().join(",") !== "fits,id" ||
      typeof row.id !== "string" || !ids.has(row.id) || seen.has(row.id) || typeof row.fits !== "boolean") {
      throw new Error("Unauthorized matching response");
    }
    seen.add(row.id);
    if (row.fits) matches.push(row.id);
  }
  // A truncated/partial response is a failure, not evidence against the omitted pairs.
  if (seen.size !== candidates.length) throw new Error("Incomplete matching response");
  return matches;
}

export async function rankPairs(pairs: Pair[], call: (input: ReturnType<typeof aiCandidates>) => Promise<string>) {
  if (!pairs.some((p) => p.mine.details || p.theirs.details)) {
    return { pairs, mode: "filters" as const };
  }
  try {
    const candidates = aiCandidates(pairs);
    const ids = new Set(validateAI(await call(candidates), candidates));
    return { pairs: pairs.filter((_, index) => ids.has(String(index))), mode: "ai" as const };
  } catch {
    return { pairs, mode: "fallback" as const };
  }
}

export function fewPairs(pairs: Pair[]) {
  const owners = new Set<string>();
  return pairs.filter((p) => {
    if (owners.has(p.wanted.owner_id)) return false;
    owners.add(p.wanted.owner_id);
    return true;
  }).slice(0, 3);
}
