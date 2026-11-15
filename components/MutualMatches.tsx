"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { CATEGORIES, SIZES } from "@/lib/constants";

type Saved = { category: string; size: string | null; details: string };
type Preview = { id: string; title: string; photo_urls: string[]; category: string | null; size: string | null };
type Match = { wanted: Preview; offered: Preview; explanation: string };

function Listing({ item, label }: { item: Preview; label: string }) {
  return (
    <Link href={`/item/${item.id}`} className="min-w-0 space-y-1 rounded-xl bg-cloud p-2">
      <p className="text-xs text-ink/60">{label}</p>
      <div className="relative aspect-square overflow-hidden rounded-xl bg-pale">
        {item.photo_urls[0] ? <Image src={item.photo_urls[0]} alt={item.title} fill sizes="180px" className="object-cover" /> : <span className="p-2 text-xs">No photo</span>}
      </div>
      <p className="break-words text-sm font-bold text-navy">{item.title}</p>
      <p className="text-xs text-ink/60">{[item.category, item.size].filter(Boolean).join(" · ")}</p>
    </Link>
  );
}

export function MutualMatches({ initial, setupError }: { initial: Saved | null; setupError: boolean }) {
  const [saved, setSaved] = useState(Boolean(initial));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);

  async function request(body: object) {
    const response = await fetch("/api/mutual-matches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Couldn't load matching. Please try again.");
    return data;
  }
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try { await task(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Please try again."); }
    finally { setBusy(false); }
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    void run(async () => {
      await request({ action: "save", category: values.get("category"), size: values.get("size") || null, details: values.get("details") });
      setSaved(true); setDirty(false); setMatches([]); setMessage("Preferences saved. Find suggestions when you're ready.");
    });
  }
  function changed() { setDirty(true); setMatches([]); setMessage(""); }

  return (
    <section className="space-y-4 rounded-2xl bg-surface p-4 shadow-soft" aria-labelledby="mutual-heading">
      <h2 id="mutual-heading" className="text-xl font-extrabold text-navy">Find a mutual swap</h2>
      <p className="text-sm text-ink/70">Find items you want from students who are looking for something you offer. Both students must save what they want.</p>
      {setupError && <p className="rounded-xl bg-pale p-3 text-sm">Your preferences couldn&apos;t load. Try reloading. If this continues, ask the Swapit team to check matching setup.</p>}
      <form onSubmit={save} onChange={changed} className="space-y-3">
        <fieldset disabled={busy || setupError} className="space-y-3">
          <legend className="mb-2 font-semibold text-navy">What do you want?</legend>
          <label className="block space-y-1 text-sm">
            <span>Category</span>
            <select name="category" required defaultValue={initial?.category ?? ""} className="w-full rounded-xl border border-ink/15 bg-cloud p-3">
              <option value="" disabled>Choose a category</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span>Size</span>
            <select name="size" defaultValue={initial?.size ?? ""} className="w-full rounded-xl border border-ink/15 bg-cloud p-3">
              <option value="">Any size</option>
              {SIZES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span>Extra details (optional, 300 characters)</span>
            <textarea name="details" maxLength={300} rows={3} defaultValue={initial?.details ?? ""} placeholder="For example: a warm jacket for rainy days" className="w-full rounded-xl border border-ink/15 bg-cloud p-3" />
          </label>
          <p className="text-xs text-ink/60">Saving shares these preferences with your school. Optional descriptions and listing details may be sent to OpenAI to suggest matches. Don&apos;t include contact or private information.</p>
          <button className="w-full rounded-full bg-navy px-4 py-3 font-semibold text-white disabled:opacity-60" type="submit">{busy ? "Working…" : "Save what I want"}</button>
        </fieldset>
      </form>
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy || !saved || dirty || setupError} onClick={() => void run(async () => {
          setMatches([]); setMessage("");
          const data = await request({ action: "find" });
          setMatches(data.matches ?? []); setMessage(data.message ?? "");
        })} className="rounded-full border border-navy px-4 py-3 text-sm font-semibold text-navy disabled:opacity-60">{busy ? "Working…" : "Find suggestions"}</button>
        {saved && <button type="button" disabled={busy || setupError} onClick={() => void run(async () => {
          await request({ action: "remove" });
          setSaved(false); setMatches([]); setMessage("Preferences removed. You won't appear in mutual matching.");
        })} className="px-2 py-3 text-sm text-ink/70 underline disabled:opacity-60">Stop sharing preferences</button>}
      </div>
      {dirty && saved && <p className="text-sm text-ink/70">Save your changes before finding suggestions.</p>}
      <p role="status" className="text-sm text-ink/70">{message}</p>
      {error && <p role="alert" className="rounded-xl bg-pale p-3 text-sm">{error}</p>}
      {matches.length === 0 && message && <p className="text-sm text-ink/60">No suggestions shown. You can also <Link href="/feed" className="underline">browse your school’s feed</Link>.</p>}
      {matches.map((match) => (
        <article key={`${match.wanted.id}:${match.offered.id}`} className="space-y-3 border-t border-ink/10 pt-4">
          <h3 className="font-semibold text-navy">Swap suggestion</h3>
          <div className="grid grid-cols-2 gap-2"><Listing item={match.wanted} label="You might want" /><Listing item={match.offered} label="They might want from you" /></div>
          <p className="text-sm text-ink/70">{match.explanation}</p>
          <button type="button" disabled={busy} className="w-full rounded-full bg-navy px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" onClick={() => void run(async () => {
            const data = await request({ action: "review", wantedId: match.wanted.id, offeredId: match.offered.id });
            window.location.assign(data.href);
          })}>Check availability & review swap</button>
          <p className="text-xs text-ink/60">Nothing is sent yet. Review both listings, choose your offered item and meetup, then submit the existing request form yourself.</p>
        </article>
      ))}
    </section>
  );
}
