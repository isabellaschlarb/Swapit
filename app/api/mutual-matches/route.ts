import { CATEGORIES, SIZES } from "@/lib/constants";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { eligible, fewPairs, type Pair } from "@/lib/mutual-matching";
import { loadPairs, matchingSuggestions, pairFingerprint } from "@/lib/mutual-matching-server";

const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const preview = (item: Pair["wanted"]) => ({ id: item.id, title: item.title, photo_urls: item.photo_urls, category: item.category, size: item.size });

export async function POST(request: Request) {
  // Same-origin only, including preference mutations. Never rely on the UI for authorization.
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Please use Explore on this site." }, 403);
  const user = await getCurrentUser();
  if (!user) return reply({ error: "Please sign in." }, 401);
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return reply({ error: "Request is too large." }, 413);
  let input;
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "Please check your request." }, 400);
    const decoder = new TextDecoder();
    let text = "", bytes = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 4096) {
          await reader.cancel();
          return reply({ error: "Request is too large." }, 413);
        }
        text += decoder.decode(value, { stream: true });
      }
    } finally { reader.releaseLock(); }
    input = JSON.parse(text + decoder.decode());
  } catch { return reply({ error: "Please check your request." }, 400); }
  if (!input || typeof input !== "object" || !["save", "remove", "find", "review"].includes(input.action)) {
    return reply({ error: "Please check your request." }, 400);
  }
  try {
    const supabase = await createClient();
    const { data: profile, error: profileError } = await supabase.from("profiles").select("id, school_id").eq("id", user.id).single();
    if (profileError || !profile?.school_id) return reply({ error: "Your school profile could not be loaded. Try again." }, 403);
    const schoolId = profile.school_id as string;
    if (input.action === "save") {
      if (!CATEGORIES.some((c) => c === input.category) ||
        !(input.size === null || SIZES.some((s) => s === input.size)) ||
        typeof input.details !== "string" || input.details.length > 300) {
        return reply({ error: "Choose a category, a listed size (or any size), and at most 300 characters." }, 400);
      }
      // Separate insert/update so immutable user_id/school_id are never updated by upsert.
      const { data: existing, error: readError } = await supabase.from("swap_preferences").select("user_id").eq("user_id", user.id).maybeSingle();
      if (readError) throw readError;
      const values = { category: input.category, size: input.size, details: input.details.trim() };
      const result = existing
        ? await supabase.from("swap_preferences").update(values).eq("user_id", user.id).select("user_id").single()
        : await supabase.from("swap_preferences").insert({ ...values, user_id: user.id, school_id: schoolId }).select("user_id").single();
      if (result.error) throw result.error;
      return reply({ saved: true });
    }
    if (input.action === "remove") {
      const { error } = await supabase.from("swap_preferences").delete().eq("user_id", user.id);
      if (error) throw error;
      return reply({ removed: true });
    }
    if (input.action === "review") {
      if (!uuid(input.wantedId) || !uuid(input.offeredId) || input.wantedId === input.offeredId) return reply({ error: "Choose a suggestion again." }, 400);
      const { data, error } = await supabase.from("items").select("*").eq("school_id", schoolId).in("id", [input.wantedId, input.offeredId]);
      if (error) throw error;
      const wanted = data?.find((i) => i.id === input.wantedId);
      const offered = data?.find((i) => i.id === input.offeredId);
      if (!wanted || !offered || wanted.owner_id === user.id || offered.owner_id !== user.id ||
        !eligible(wanted, schoolId) || !eligible(offered, schoolId)) {
        return reply({ error: "One of these items is no longer available for a swap. Find suggestions again." }, 409);
      }
      // Only navigate to the existing manual request form. Its database trigger
      // checks availability/ownership again when the student actually submits.
      return reply({ href: `/item/${wanted.id}/request?type=swap` });
    }
    const { data: allowed, error: limitError } = await supabase.rpc("claim_mutual_match_request");
    if (limitError) throw limitError; // Fail closed; no unlimited provider calls if migration is absent.
    if (!allowed) return reply({ error: "Please wait 30 seconds between searches. You can search up to 30 times per day." }, 429);
    const snapshot = await loadPairs(supabase, user.id, schoolId);
    if (!snapshot.hasPreference) return reply({ matches: [], message: "Save what you want first. We never guess mutual interest." });
    if (!snapshot.hasItems) return reply({ matches: [], message: "Post an available item for swapping first." });
    if (!snapshot.pairs.length) return reply({ matches: [], message: "No reciprocal category and size matches yet. Other students need to save what they want too." });
    const key = pairFingerprint(user.id, schoolId, snapshot.pairs);
    const ranked = await matchingSuggestions(key, snapshot.pairs);
    const fresh = await loadPairs(supabase, user.id, schoolId);
    if (pairFingerprint(user.id, schoolId, fresh.pairs) !== key) {
      return reply({ error: "Listings or preferences changed during your search. Please try again." }, 409);
    }
    return reply({
      matches: fewPairs(ranked.pairs).map((p) => ({
        wanted: preview(p.wanted), offered: preview(p.offered),
        explanation: `You want ${p.mine.category}${p.mine.size ? ` in ${p.mine.size}` : ""}; their listing matches. They want ${p.theirs.category}${p.theirs.size ? ` in ${p.theirs.size}` : ""}; your listing matches.`,
      })),
      message: ranked.mode === "fallback"
        ? "AI is unavailable. These suggestions match category and size only; extra descriptions have not been checked."
        : ranked.mode === "ai"
          ? "AI suggested these description matches. Check both listings; interest and agreement are not confirmed."
          : "Suggestions based on both students’ saved categories and sizes. Interest and agreement are not confirmed.",
    });
  } catch {
    return reply({ error: "Matching could not load. Please try again. If this continues, ask the Swapit team to check matching setup." }, 503);
  }
}
