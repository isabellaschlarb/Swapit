import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
function modules(mocks = {}) {
  const loaded = new Map();
  function load(file) {
    if (loaded.has(file)) return loaded.get(file);
    const evaluated = { exports: {} };
    loaded.set(file, evaluated.exports);
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2017, esModuleInterop: true, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
    vm.runInNewContext(outputText, {
      module: evaluated, exports: evaluated.exports, Response, Request, Headers, URL, Date, TextDecoder, process: { env: { OPENAI_API_KEY: "test-only" } },
      require: (name) => {
        if (Object.hasOwn(mocks, name)) return mocks[name];
        if (name === "server-only") return {};
        if (name.startsWith("@/")) return load(`${name.slice(2)}.ts`);
        return require(name);
      },
    }, { filename: file });
    return evaluated.exports;
  }
  return load;
}
const core = modules()("lib/mutual-matching.ts");
const me = "00000000-0000-4000-8000-000000000001";
const them = "00000000-0000-4000-8000-000000000002";
const wantedId = "00000000-0000-4000-8000-000000000003";
const offeredId = "00000000-0000-4000-8000-000000000004";
function fixtures() {
  return {
    items: [
      { id: wantedId, owner_id: them, school_id: "school", title: "Rain jacket", description: "Waterproof outer layer", category: "Outerwear", size: "M", status: "available", listing_type: "swap", photo_urls: ["https://example.supabase.co/jacket.jpg"] },
      { id: offeredId, owner_id: me, school_id: "school", title: "Cotton tee", description: "Blue cotton", category: "Tops", size: "S", status: "available", listing_type: "swap_or_sell", photo_urls: [] },
    ],
    preferences: [
      { user_id: me, school_id: "school", category: "Outerwear", size: "M", details: "For rainy days" },
      { user_id: them, school_id: "school", category: "Tops", size: "S", details: "" },
    ],
  };
}
const pairs = (f) => core.candidatePairs(me, "school", f.items, f.preferences);

test("reciprocal explicit category and size preferences produce a real pair", () => {
  const result = pairs(fixtures());
  assert.equal(result.length, 1);
  assert.equal(result[0].wanted.id, wantedId);
  assert.equal(result[0].offered.id, offeredId);
});
test("missing preferences on either side never imply mutual interest", () => {
  for (const index of [0, 1]) {
    const f = fixtures(); f.preferences.splice(index, 1);
    assert.equal(pairs(f).length, 0);
  }
});
test("cross-school, unavailable, sell-only, wrong size/category and wrong ownership are excluded", () => {
  for (const index of [0, 1]) {
    for (const patch of [{ school_id: "other" }, { status: "pending" }, { status: "sold" }, { status: "swapped" }, { listing_type: "sell" }, { size: "XL" }, { category: "Shoes" }, { owner_id: "stranger" }]) {
      const f = fixtures(); Object.assign(f.items[index], patch);
      assert.equal(pairs(f).length, 0, JSON.stringify({ index, patch }));
    }
    const f = fixtures(); f.preferences[index].school_id = "other";
    assert.equal(pairs(f).length, 0);
  }
});
test("any size is explicit and still requires the category", () => {
  const f = fixtures(); f.preferences[0].size = null; f.items[0].size = "XL";
  assert.equal(pairs(f).length, 1);
});
test("provider payload is bounded and excludes identity, photos, emails and messages", () => {
  const f = fixtures(); f.items[0].email = "private@example.com"; f.items[0].messages = "secret";
  f.items[0].description = "x".repeat(5000);
  f.preferences[0].details = "Rain jacket. Contact private@example.com";
  const payload = core.aiCandidates(pairs(f));
  const text = JSON.stringify(payload);
  for (const value of [me, them, wantedId, offeredId, "private@example.com", "secret", "photo_urls", "school_id"]) assert.ok(!text.includes(value), value);
  assert.equal(payload[0].wanted.description.length, 1000);
});
test("strict output validation rejects unauthorized, duplicate, partial and malformed responses", () => {
  const candidates = core.aiCandidates(pairs(fixtures()));
  for (const value of ["no json", "null", "{}", '{"matches":[]}', '{"matches":[{"id":"999","fits":true}]}', '{"matches":[{"id":"0","fits":"true"}]}', '{"matches":[{"id":"0","fits":true,"reason":"invented"}]}', '{"matches":[{"id":"0","fits":true},{"id":"0","fits":true}]}']) {
    assert.throws(() => core.validateAI(value, candidates), value);
  }
  assert.equal(core.validateAI('{"matches":[{"id":"0","fits":true}]}', candidates)[0], "0");
});
test("provider failure and invalid output fall back; no description means zero AI calls", async () => {
  const f = fixtures();
  for (const call of [async () => { throw new Error("provider down"); }, async () => '{"matches":[{"id":"unauthorized","fits":true}]}']) {
    const result = await core.rankPairs(pairs(f), call);
    assert.equal(result.mode, "fallback"); assert.equal(result.pairs.length, 1);
  }
  f.preferences[0].details = "";
  const result = await core.rankPairs(pairs(f), async () => assert.fail("no AI needed"));
  assert.equal(result.mode, "filters");
});
test("negative AI assessment removes a suggestion rather than inventing interest", async () => {
  const result = await core.rankPairs(pairs(fixtures()), async () => '{"matches":[{"id":"0","fits":false}]}');
  assert.equal(result.mode, "ai"); assert.equal(result.pairs.length, 0);
});

function harness() {
  const f = fixtures();
  const state = { allowed: true, quotaError: false, signedIn: true, profileError: false, calls: 0, aiOutput: '{"matches":[{"id":"0","fits":true}]}', queries: [], failAI: false, afterAI: () => {} };
  const db = {
    from(table) {
      const filters = [];
      const record = { table, filters };
      state.queries.push(record);
      function execute() {
        if (table === "profiles") return { data: state.profileError ? [] : [{ id: me, school_id: "school" }], error: state.profileError };
        const rows = table === "items" ? f.items : f.preferences;
        const selected = rows.filter((row) => filters.every(([k, op, v]) => op === "eq" ? row[k] === v : op === "neq" ? row[k] !== v : v.includes(row[k])));
        if (record.insertValues) { rows.push(record.insertValues); return { data: [record.insertValues], error: null }; }
        if (record.updateValues) selected.forEach((row) => Object.assign(row, record.updateValues));
        if (record.deleting) selected.forEach((row) => rows.splice(rows.indexOf(row), 1));
        return { data: selected, error: null };
      }
      const query = {
        select: () => query,
        insert: (values) => { record.insertValues = values; return query; },
        update: (values) => { record.updateValues = values; return query; },
        delete: () => { record.deleting = true; return query; },
        eq: (key, value) => { filters.push([key, "eq", value]); return query; },
        neq: (key, value) => { filters.push([key, "neq", value]); return query; },
        in: (key, value) => { filters.push([key, "in", value]); return query; },
        order: () => query, limit: () => query,
        single: async () => { const result = execute(); return { data: result.data[0] ?? null, error: result.error || !result.data.length }; },
        maybeSingle: async () => { const result = execute(); return { data: result.data[0] ?? null, error: result.error }; },
        then: (resolve) => Promise.resolve(execute()).then(resolve),
      };
      return query;
    },
    rpc: async () => ({ data: state.allowed, error: state.quotaError }),
  };
  class OpenAI {
    responses = { create: async (payload) => {
      state.calls++;
      assert.equal(payload.store, false);
      assert.match(payload.instructions, /untrusted data/);
      state.afterAI();
      if (state.failAI) throw new Error("provider down");
      return { output_text: state.aiOutput };
    } };
  }
  const load = modules({ openai: OpenAI, "@/lib/supabase/server": { createClient: async () => db, getCurrentUser: async () => state.signedIn ? { id: me } : null } });
  const { POST } = load("app/api/mutual-matches/route.ts");
  async function post(body, origin = "https://swapit.example") {
    const response = await POST(new Request("https://swapit.example/api/mutual-matches", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) }));
    return { status: response.status, body: await response.json(), headers: response.headers };
  }
  return { f, state, post };
}
test("route authorizes school and filters both item queries before provider; caches only after fresh reads", async () => {
  const h = harness();
  const first = await h.post({ action: "find" });
  assert.equal(first.status, 200); assert.equal(first.body.matches.length, 1);
  assert.equal(first.headers.get("cache-control"), "private, no-store");
  const second = await h.post({ action: "find" });
  assert.equal(second.body.matches.length, 1); assert.equal(h.state.calls, 1);
  const queries = h.state.queries.filter((q) => q.table === "items");
  assert.equal(queries.length, 8); // Two queries before and after each search, even on cache hit.
  for (const q of queries) {
    assert.ok(q.filters.some(([k, op, v]) => k === "school_id" && op === "eq" && v === "school"));
    assert.ok(q.filters.some(([k, op, v]) => k === "status" && op === "eq" && v === "available"));
  }
  h.f.items[0].status = "pending";
  const stale = await h.post({ action: "find" });
  assert.equal(stale.body.matches.length, 0); assert.equal(h.state.calls, 1);
});
test("route fails closed for foreign origins, unsigned users, missing school profile and denied quota", async () => {
  const h = harness();
  assert.equal((await h.post({ action: "find" }, "https://other.example")).status, 403);
  h.state.signedIn = false;
  assert.equal((await h.post({ action: "find" })).status, 401);
  h.state.signedIn = true; h.state.profileError = true;
  assert.equal((await h.post({ action: "find" })).status, 403);
  h.state.profileError = false; h.state.allowed = false;
  assert.equal((await h.post({ action: "find" })).status, 429);
  h.state.quotaError = true;
  assert.equal((await h.post({ action: "find" })).status, 503);
  assert.equal(h.state.calls, 0);
});
test("route never calls provider for missing preferences or cross-school candidates", async () => {
  for (const change of [(h) => h.f.preferences.pop(), (h) => { h.f.items[0].school_id = "other"; }]) {
    const h = harness(); change(h);
    const result = await h.post({ action: "find" });
    assert.equal(result.body.matches.length, 0); assert.equal(h.state.calls, 0);
  }
});
test("route falls back on provider failure or unauthorized output", async () => {
  for (const fail of [true, false]) {
    const h = harness(); h.state.failAI = fail; h.state.aiOutput = '{"matches":[{"id":"stolen","fits":true}]}';
    const result = await h.post({ action: "find" });
    assert.equal(result.body.matches.length, 1); assert.match(result.body.message, /category and size only/);
  }
});
test("changes while AI runs are rejected before displaying a recommendation", async () => {
  const h = harness(); h.state.afterAI = () => { h.f.items[0].status = "sold"; };
  assert.equal((await h.post({ action: "find" })).status, 409);
});
test("review rechecks both items without writing a swap", async () => {
  for (const patch of [{ status: "pending" }, { owner_id: me }, { school_id: "other" }, { listing_type: "sell" }]) {
    const h = harness(); Object.assign(h.f.items[0], patch);
    assert.equal((await h.post({ action: "review", wantedId, offeredId })).status, 409);
  }
  const h = harness();
  assert.equal((await h.post({ action: "review", wantedId, offeredId })).body.href, `/item/${wantedId}/request?type=swap`);
  h.f.items[1].owner_id = them;
  assert.equal((await h.post({ action: "review", wantedId, offeredId })).status, 409);
  assert.ok(h.state.queries.every((q) => q.table !== "swap_requests"));
});
test("saving rejects invalid or oversized preferences", async () => {
  const h = harness();
  for (const patch of [{ category: "anything" }, { size: "unknown" }, { details: "x".repeat(301) }]) {
    const response = await h.post({ action: "save", category: "Tops", size: null, details: "", ...patch });
    assert.equal(response.status, 400);
  }
  assert.equal((await h.post({ action: "save", details: "x".repeat(5000) })).status, 413);
});
test("preference create, edit and opt-out always scope to the authenticated student", async () => {
  const h = harness(); h.f.preferences.shift();
  const result = await h.post({ action: "save", category: "Outerwear", size: null, details: "  Rainy days  ", user_id: them, school_id: "other" });
  assert.equal(result.status, 200);
  const saved = h.f.preferences.find((p) => p.user_id === me);
  assert.equal(saved.school_id, "school"); assert.equal(saved.details, "Rainy days");
  const updated = await h.post({ action: "save", category: "Tops", size: "M", details: "Cotton" });
  assert.equal(updated.status, 200); assert.equal(saved.category, "Tops");
  const write = h.state.queries.find((q) => q.updateValues);
  assert.ok(!("user_id" in write.updateValues) && !("school_id" in write.updateValues));
  assert.equal((await h.post({ action: "remove" })).status, 200);
  assert.equal(h.f.preferences.length, 1); assert.equal(h.f.preferences[0].user_id, them);
});
test("candidates and displayed matches are bounded and spread across owners", () => {
  const f = fixtures();
  for (let i = 0; i < 40; i++) {
    const owner = `student-${i}`;
    f.preferences.push({ ...f.preferences[1], user_id: owner });
    f.items.push({ ...f.items[0], id: `item-${i}`, owner_id: owner });
  }
  const candidates = pairs(f);
  assert.equal(candidates.length, 24);
  assert.equal(core.fewPairs(candidates).length, 3);
  assert.equal(new Set(core.fewPairs(candidates).map((p) => p.wanted.owner_id)).size, 3);
});
