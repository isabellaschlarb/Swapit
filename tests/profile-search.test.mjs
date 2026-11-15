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
      module: evaluated, exports: evaluated.exports, Buffer, File, FormData, Blob, Uint8Array, Response, Request, Headers, URL, URLSearchParams, Date, Error,
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
const load = modules();
const input = load("lib/profile-input.ts");
const search = load("lib/search.ts");
const { saveProfile } = load("lib/profile-server.ts");
const { listingSearch, peopleSearch, publicPerson } = load("lib/search-server.ts");
const me = "00000000-0000-4000-8000-000000000001";
const them = "00000000-0000-4000-8000-000000000002";
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const oldPath = `${me}/00000000-0000-4000-8000-000000000010.png`;
const png = () => new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "photo.png", { type: "image/png" });
function form() { const f = new FormData(); f.set("display_name", "  Student  "); f.set("bio", "  Hello  "); return f; }

test("profile fields validate length and ignore identity/authentication fields", () => {
  const f = form(); f.set("id", them); f.set("school_id", "other"); f.set("email", "private@example.com");
  const parsed = input.profileFields(f);
  assert.equal(parsed.display_name, "Student"); assert.equal(parsed.bio, "Hello");
  assert.deepEqual(Object.keys(parsed).sort(), ["bio", "display_name", "file", "remove"]);
  for (const name of [" ", "x".repeat(41)]) { f.set("display_name", name); assert.throws(() => input.profileFields(f)); }
  f.set("display_name", "Student"); f.set("bio", "x".repeat(301)); assert.throws(() => input.profileFields(f));
  f.set("bio", ""); f.set("photo", png()); f.set("remove_photo", "on"); assert.throws(() => input.profileFields(f), /not both/);
});
test("photo validation checks bytes, declared type and maximum size before upload", async () => {
  assert.equal((await input.photoBytes(png())).extension, "png");
  for (const file of [
    new File(["<svg/>"], "bad.svg", { type: "image/svg+xml" }),
    new File(["not png"], "bad.png", { type: "image/png" }),
    new File([new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80])], "bad.webp", { type: "constructor" }),
    new File([new Uint8Array(input.PHOTO_LIMIT + 1)], "large.png", { type: "image/png" }),
  ]) await assert.rejects(input.photoBytes(file));
});

function profileClient(options = {}) {
  const profile = { id: me, school_id: "school", display_name: "Before", bio: "Old bio", avatar_path: oldPath, avatar_url: null };
  const previous = { ...profile };
  const state = { uploaded: [], removed: [], writes: [], filters: [], objects: new Set([oldPath]), ...options };
  const storage = {
    upload: async (path, bytes, config) => {
      state.uploaded.push({ path, bytes, config }); state.objects.add(path);
      if (state.uploadThrows) throw new Error("network");
      return { error: state.uploadError ? { code: "upload-failed" } : null };
    },
    remove: async (paths) => {
      state.removed.push(...paths);
      if (state.cleanupError) throw new Error("cleanup-failed");
      paths.forEach((p) => state.objects.delete(p)); return { error: null };
    },
    download: async () => ({ data: png(), error: null }),
  };
  const client = {
    storage: { from: (bucket) => { assert.equal(bucket, "profile-photos"); return storage; } },
    from(table) {
      assert.equal(table, "profiles");
      let values;
      const filters = []; state.filters.push(filters);
      const query = {
        select: () => query, eq: (key, value) => { filters.push([key, value]); return query; },
        is: (key, value) => { filters.push([key, value, "is"]); return query; },
        update: (data) => { values = data; state.writes.push(data); return query; },
        async maybeSingle() {
          if (values) {
            if (state.concurrent) { profile.avatar_path = `${me}/another.png`; return { data: null, error: null }; }
            if (state.updateError) return { data: null, error: { code: "42501" } };
            Object.assign(profile, values);
            if (state.commitThenThrow) throw new Error("response-lost");
            return { data: { id: me }, error: null };
          }
          if (state.verifyError) return { data: null, error: { code: "network" } };
          return { data: { ...profile }, error: null };
        },
        async single() { return { data: { ...profile }, error: null }; },
      };
      return query;
    },
  };
  return { client, profile, previous, state };
}
const updateInput = () => ({ display_name: "After", bio: "New bio", file: png(), remove: false });
test("successful photo save uses a unique owner path and removes old photo only after row confirmation", async () => {
  const h = profileClient(); const result = await saveProfile(h.client, h.previous, updateInput());
  assert.equal(result.ok, true); assert.equal(h.profile.display_name, "After");
  const upload = h.state.uploaded[0];
  assert.match(upload.path, new RegExp(`^${me}/[0-9a-f-]{36}\\.png$`));
  assert.equal(upload.config.upsert, false);
  assert.equal(h.profile.avatar_path, upload.path); assert.ok(h.state.objects.has(upload.path));
  assert.deepEqual(h.state.removed, [oldPath]);
  assert.ok(h.state.filters[0].some(([key, value]) => key === "id" && value === me));
  assert.ok(h.state.filters[0].some(([key, value]) => key === "school_id" && value === "school"));
  assert.ok(h.state.filters[0].some(([key, value]) => key === "avatar_path" && value === oldPath));
  assert.ok(!("school_id" in h.state.writes[0]) && !("id" in h.state.writes[0]) && !("email" in h.state.writes[0]));
});
for (const options of [{ uploadError: true }, { uploadThrows: true }, { updateError: true }]) {
  test(`failed upload/save retains previous photo: ${JSON.stringify(options)}`, async () => {
    const h = profileClient(options); const result = await saveProfile(h.client, h.previous, updateInput());
    assert.equal(result.ok, false); assert.equal(h.profile.avatar_path, oldPath); assert.ok(h.state.objects.has(oldPath));
    assert.ok(!h.state.removed.includes(oldPath));
    assert.ok(h.state.removed.includes(h.state.uploaded[0].path));
    if (!options.updateError) assert.equal(h.state.writes.length, 0);
  });
}
test("ambiguous committed save is verified before cleanup", async () => {
  const h = profileClient({ commitThenThrow: true });
  const result = await saveProfile(h.client, h.previous, updateInput());
  assert.equal(result.ok, true); assert.equal(h.profile.avatar_path, h.state.uploaded[0].path);
  assert.deepEqual(h.state.removed, [oldPath]);
});
test("unverifiable save keeps both photos for recovery", async () => {
  const h = profileClient({ commitThenThrow: true, verifyError: true });
  assert.equal((await saveProfile(h.client, h.previous, updateInput())).ok, false);
  assert.equal(h.state.objects.size, 2); assert.equal(h.state.removed.length, 0);
});
test("concurrent photo replacement is not overwritten or deleted", async () => {
  const h = profileClient({ concurrent: true });
  assert.equal((await saveProfile(h.client, h.previous, updateInput())).ok, false);
  assert.equal(h.profile.avatar_path, `${me}/another.png`);
  assert.deepEqual(h.state.removed, [h.state.uploaded[0].path]);
  assert.ok(h.state.objects.has(oldPath));
});
test("cleanup failure does not report a confirmed profile save as failed", async () => {
  const h = profileClient({ cleanupError: true });
  assert.equal((await saveProfile(h.client, h.previous, updateInput())).ok, true);
});
test("remove photo clears the reference and legacy URL; editing text preserves the current photo", async () => {
  const h = profileClient(); h.profile.avatar_url = "https://example.supabase.co/old.jpg";
  assert.equal((await saveProfile(h.client, h.previous, { ...updateInput(), file: null, remove: true })).ok, true);
  assert.equal(h.profile.avatar_path, null); assert.equal(h.profile.avatar_url, null);
  const text = profileClient();
  await saveProfile(text.client, text.previous, { ...updateInput(), file: null });
  assert.equal(text.profile.avatar_path, oldPath); assert.equal(text.state.uploaded.length, 0); assert.equal(text.state.removed.length, 0);
});
test("first private photo replaces a legacy URL using a null-safe reference check", async () => {
  const h = profileClient();
  h.previous.avatar_path = null; h.profile.avatar_path = null;
  h.profile.avatar_url = "https://example.supabase.co/legacy.jpg";
  assert.equal((await saveProfile(h.client, h.previous, updateInput())).ok, true);
  assert.equal(h.profile.avatar_url, null);
  assert.equal(h.profile.avatar_path, h.state.uploaded[0].path);
  assert.ok(h.state.filters[0].some(([key, value, op]) => key === "avatar_path" && value === null && op === "is"));
  assert.equal(h.state.removed.length, 0);
});
test("invalid photo bytes never reach upload or database update", async () => {
  const h = profileClient();
  await assert.rejects(saveProfile(h.client, h.previous, { ...updateInput(), file: new File(["bad"], "bad.png", { type: "image/png" }) }));
  assert.equal(h.state.uploaded.length, 0); assert.equal(h.state.writes.length, 0);
});

const filters = { mode: "listings", q: "jacket", category: "Outerwear", tag: "vintage" };
test("search uses existing filters, validates input, and treats query punctuation as data", () => {
  const f = search.searchFilters({ ...filters, q: "  100%_' jacket  " });
  assert.equal(f.q, "100%_' jacket");
  for (const patch of [{ q: "x".repeat(101) }, { category: "secret" }, { tag: "invented" }, { mode: "emails" }]) assert.throws(() => search.searchFilters({ ...filters, ...patch }));
  assert.equal(search.searchFilters({ mode: "people", category: "Tops", tag: "vintage" }).category, "");
});
test("cursor preserves tied timestamp/id boundaries and is bound to filters and closet", async () => {
  const timestamp = "2026-11-14T20:00:00Z";
  const rows = Array.from({ length: 49 }, (_, i) => ({ id: id(100 - i), created_at: timestamp }));
  const calls = [];
  const client = { rpc: async (name, args) => {
    assert.equal(name, "search_campus_items");
    calls.push({ name, args });
    return { data: rows.filter((row) => !args.after_id || row.id < args.after_id).slice(0, 25), error: null };
  } };
  const first = await listingSearch(client, filters);
  const second = await listingSearch(client, filters, first.next);
  const third = await listingSearch(client, filters, second.next);
  assert.equal(first.results.length, 24); assert.equal(second.results.length, 24); assert.equal(third.results.length, 1);
  assert.equal(third.next, null);
  assert.equal(new Set([...first.results, ...second.results, ...third.results].map((r) => r.id)).size, 49);
  assert.equal(calls[1].args.after_id, first.results[23].id);
  assert.equal(calls[1].args.after_created_at, timestamp);
  assert.equal(calls[0].args.category_filter, "Outerwear"); assert.equal(calls[0].args.tag_filter, "vintage");
  await assert.rejects(listingSearch(client, { ...filters, q: "other" }, first.next), /different filters/);
  await assert.rejects(listingSearch(client, filters, first.next, them), /different filters/);
});
test("people pagination carries the last display name/id and only exposes public fields", async () => {
  const rows = Array.from({ length: 25 }, (_, i) => ({ id: id(i + 10), display_name: "Same Name", bio: "Hi", avatar_path: null, avatar_url: null, style_tags: [], email: "private@example.com", school_id: "secret", private_notes: "hidden" }));
  let parameters;
  const client = { rpc: async (_name, args) => { parameters = args; return { data: rows, error: null }; } };
  const peopleFilters = { mode: "people", q: "Same", category: "", tag: "" };
  const page = await peopleSearch(client, peopleFilters);
  await peopleSearch(client, peopleFilters, page.next);
  assert.equal(parameters.after_name, "Same Name"); assert.equal(parameters.after_id, rows[23].id);
  assert.equal(page.results.length, 24);
  assert.deepEqual(Object.keys(page.results[0]).sort(), ["avatar_url", "bio", "display_name", "id", "style_tags"]);
  const text = JSON.stringify(page.results);
  assert.ok(!text.includes("private@example.com") && !text.includes("private_notes") && !text.includes("school_id"));
});
test("search returns legitimate empty pages and surfaces database failures", async () => {
  assert.equal((await listingSearch({ rpc: async () => ({ data: [], error: null }) }, filters)).results.length, 0);
  await assert.rejects(listingSearch({ rpc: async () => ({ error: { message: "private detail" } }) }, filters), /Listings couldn't load/);
  await assert.rejects(peopleSearch({ rpc: async () => ({ error: true }) }, { ...filters, mode: "people" }), /People couldn't load/);
  await assert.rejects(listingSearch({ rpc: async () => { throw new Error("sensitive transport detail"); } }, filters), { message: "Listings couldn't load. Please try again." });
  for (const cursor of ["not-json", "!", "x".repeat(2049), search.encodeCursor({ id: "bad", value: "bad" }, search.searchScope(filters))]) {
    assert.throws(() => search.decodeCursor(cursor, search.searchScope(filters), "listings"));
  }
});
test("public avatar references use an authenticated route, and unsafe legacy URLs are excluded", () => {
  const person = publicPerson({ id: me, display_name: "Student", bio: "Hi", avatar_path: oldPath, avatar_url: null, style_tags: [] });
  assert.match(person.avatar_url, new RegExp(`^/api/avatars/${me}\\?v=`));
  assert.ok(!("avatar_path" in person));
  assert.equal(input.avatarUrl({ id: me, avatar_url: "javascript:alert(1)" }), null);
  assert.equal(input.avatarUrl({ id: me, avatar_url: "https://user:password@example.supabase.co/old.png" }), null);
});
test("public closet restricts school and owner, excludes private profile data, and handles missing profiles", async () => {
  let targetSchool = "school", queryError = false;
  const selected = [], rpcCalls = [];
  const client = {
    from() {
      const filters = []; selected.push(filters);
      const q = {
        select: () => q, eq: (key, value) => { filters.push([key, value]); return q; },
        maybeSingle: async () => ({
          data: filters.some(([k, v]) => k === "school_id" && v === targetSchool) ? {
            id: them, display_name: "Public Name", bio: "Public bio", style_tags: [], avatar_path: null, avatar_url: null,
            email: "private@example.com", private_notes: "never-serialize-this",
          } : null,
          error: queryError ? { message: "sensitive database error" } : null,
        }),
      }; return q;
    },
    rpc: async (name, args) => { rpcCalls.push({ name, args }); return { data: [], error: null }; },
  };
  const routes = modules({
    "@/lib/supabase/server": { createClient: async () => client, getMyProfile: async () => ({ id: me, school_id: "school" }) },
    "next/navigation": { notFound: () => { throw new Error("not-found"); }, redirect: (path) => { throw new Error(path); } },
    "next/link": () => null,
    "@/components/Avatar": { Avatar: () => null },
    "@/components/ItemCard": { ItemGrid: () => null },
  });
  const { default: Page } = routes("app/(app)/people/[id]/page.tsx");
  const page = () => Page({ params: Promise.resolve({ id: them }), searchParams: Promise.resolve({}) });
  const tree = JSON.stringify(await page());
  assert.ok(tree.includes("Public Name") && tree.includes("Public bio"));
  assert.ok(!tree.includes("private@example.com") && !tree.includes("never-serialize-this"));
  assert.equal(rpcCalls[0].args.owner_filter, them);
  assert.ok(selected[0].some(([k, v]) => k === "school_id" && v === "school"));
  targetSchool = "other";
  await assert.rejects(page(), /not-found/); assert.equal(rpcCalls.length, 1);
  queryError = true;
  const failure = JSON.stringify(await page());
  assert.ok(failure.includes("Retry") && !failure.includes("sensitive database error"));
});
test("profile endpoint rejects foreign origins/unsigned users and never accepts another owner", async () => {
  const h = profileClient(); let signedIn = true;
  const routes = modules({ "@/lib/supabase/server": { createClient: async () => h.client, getCurrentUser: async () => signedIn ? { id: me } : null } });
  const { POST } = routes("app/api/profile/route.ts");
  const post = (body, origin = "https://swapit.example") => POST(new Request("https://swapit.example/api/profile", { method: "POST", headers: { origin }, body }));
  assert.equal((await post(form(), "https://evil.example")).status, 403);
  signedIn = false; assert.equal((await post(form())).status, 401);
  signedIn = true;
  const malicious = form(); malicious.set("user_id", them); malicious.set("school_id", "other");
  assert.equal((await post(malicious)).status, 200);
  assert.ok(h.state.filters[0].some(([key, value]) => key === "id" && value === me));
  assert.equal(h.profile.id, me); assert.equal(h.profile.school_id, "school");
  const invalidPhoto = form(); invalidPhoto.set("photo", new File(["fake png"], "bad.png", { type: "image/png" }));
  assert.equal((await post(invalidPhoto)).status, 400);
  assert.equal(h.state.uploaded.length, 0);
});
test("bounded body reading rejects oversized uploads even with a misleading content length", async () => {
  const { boundedBody } = load("lib/request-body.ts");
  await assert.rejects(boundedBody(new Request("https://swapit.example", { method: "POST", body: "123456789", headers: { "content-length": "1" } }), 4), /too large/);
});
test("multipart profile upload failure returns a useful error and preserves the previous photo", async () => {
  const h = profileClient({ uploadError: true });
  const routes = modules({ "@/lib/supabase/server": { createClient: async () => h.client, getCurrentUser: async () => ({ id: me }) } });
  const { POST } = routes("app/api/profile/route.ts");
  const body = form(); body.set("photo", png());
  const response = await POST(new Request("https://swapit.example/api/profile", { method: "POST", headers: { origin: "https://swapit.example" }, body }));
  assert.equal(response.status, 409); assert.match((await response.json()).error, /previous photo is unchanged/);
  assert.equal(h.profile.avatar_path, oldPath); assert.equal(h.state.writes.length, 0);
});
test("avatar route enforces school access and serves no-store bytes without exposing storage URLs", async () => {
  let signedIn = true, targetSchool = "school", downloads = 0;
  const client = {
    from() {
      const filters = [];
      const q = {
        select: () => q, eq: (key, value) => { filters.push([key, value]); return q; },
        single: async () => ({ data: { school_id: "school" }, error: null }),
        maybeSingle: async () => ({ data: filters.some(([k, v]) => k === "school_id" && v === targetSchool) ? { avatar_path: `${them}/picture.png` } : null, error: null }),
      }; return q;
    },
    storage: { from: () => ({ download: async () => { downloads++; return { data: png(), error: null }; } }) },
  };
  const routes = modules({ "@/lib/supabase/server": { createClient: async () => client, getCurrentUser: async () => signedIn ? { id: me } : null } });
  const { GET } = routes("app/api/avatars/[id]/route.ts");
  const get = () => GET(new Request("https://swapit.example"), { params: Promise.resolve({ id: them }) });
  const response = await get(); assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store"); assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal((await response.arrayBuffer()).byteLength, 8);
  targetSchool = "other"; assert.equal((await get()).status, 404); assert.equal(downloads, 1);
  signedIn = false; assert.equal((await get()).status, 401); assert.equal(downloads, 1);
});
test("feed read failure is retryable rather than displayed as an empty campus", async () => {
  const query = {
    select: () => query, eq: () => query, order: () => query, limit: () => query,
    then: (resolve) => Promise.resolve({ data: null, error: { message: "sensitive database detail" } }).then(resolve),
  };
  const routes = modules({
    "@/lib/supabase/server": { createClient: async () => ({ from: () => query }) },
    "@/components/FeedHeader": { FeedHeader: () => null },
    "@/components/ItemCard": { ItemGrid: () => null },
    "next/link": () => null,
  });
  const { default: Page } = routes("app/(app)/feed/page.tsx");
  const tree = JSON.stringify(await Page({ searchParams: Promise.resolve({}) }));
  assert.ok(tree.includes('"role":"alert"') && tree.includes("Try again"));
  assert.ok(!tree.includes("Nothing posted yet") && !tree.includes("sensitive database detail"));
});
