"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORIES, SIZES } from "@/lib/constants";
import { activeFilterCount, filtersToQuery, type Filters } from "@/lib/filters";

const TYPES = [
  { value: "", label: "Any" },
  { value: "swap", label: "Swap" },
  { value: "sell", label: "Buy" },
] as const;

const inputClass =
  "w-full rounded-2xl border border-ink/10 bg-surface px-4 py-3 outline-none focus:border-sky";

// The filter icon + the bottom sheet it opens (category, size, price,
// swap/buy). "Show items" puts the choices in the URL; the page (Feed or
// Explore) reads them and filters on the server.
export function FilterSheet({ filters, tab }: { filters: Filters; tab?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const count = activeFilterCount(filters);

  function apply(next: Filters) {
    setOpen(false);
    router.push(`${pathname}${filtersToQuery({ ...next, tab })}`);
  }

  const chip = (selected: boolean) =>
    `rounded-full px-4 py-2 text-sm ${selected ? "bg-navy text-white" : "bg-pale text-navy"}`;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDraft(filters);
          setOpen(true);
        }}
        aria-label={count ? `Filters (${count} on)` : "Filters"}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-navy hover:bg-pale"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
          <path d="M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4" />
        </svg>
        {count > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky px-1 text-[10px] font-bold text-navy">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-30 flex items-end justify-center lg:items-center" role="dialog" aria-modal="true" aria-label="Filters">
          <button type="button" aria-label="Close filters" onClick={() => setOpen(false)} className="absolute inset-0 bg-navy/40" />
          <div className="relative max-h-[85dvh] w-full max-w-md space-y-6 overflow-y-auto rounded-t-3xl bg-cloud p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-soft lg:rounded-3xl">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-ink/15 lg:hidden" />
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-navy">Filters</h2>
              <button
                type="button"
                onClick={() => apply({ ...draft, category: "", size: "", min: "", max: "", type: "" })}
                className="text-sm text-navy underline"
              >
                Clear all
              </button>
            </div>

            <section className="space-y-2">
              <h3 className="text-sm text-ink/70">Category</h3>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button key={c} type="button" onClick={() => setDraft({ ...draft, category: draft.category === c ? "" : c })} className={chip(draft.category === c)}>
                    {c}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm text-ink/70">Size</h3>
              <div className="flex flex-wrap gap-2">
                {SIZES.map((s) => (
                  <button key={s} type="button" onClick={() => setDraft({ ...draft, size: draft.size === s ? "" : s })} className={chip(draft.size === s)}>
                    {s}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm text-ink/70">Price ($)</h3>
              <div className="grid grid-cols-2 gap-3">
                <input aria-label="Min price" type="number" inputMode="numeric" min="0" placeholder="Min" value={draft.min} onChange={(e) => setDraft({ ...draft, min: e.target.value.replace(/\D/g, "").slice(0, 5) })} className={inputClass} />
                <input aria-label="Max price" type="number" inputMode="numeric" min="0" placeholder="Max" value={draft.max} onChange={(e) => setDraft({ ...draft, max: e.target.value.replace(/\D/g, "").slice(0, 5) })} className={inputClass} />
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm text-ink/70">Swap or buy</h3>
              <div className="grid grid-cols-3 gap-2">
                {TYPES.map((t) => (
                  <button key={t.value} type="button" onClick={() => setDraft({ ...draft, type: t.value })} className={chip(draft.type === t.value)}>
                    {t.label}
                  </button>
                ))}
              </div>
            </section>

            <button type="button" onClick={() => apply(draft)} className="w-full rounded-full bg-navy px-6 py-3.5 font-semibold text-white">
              Show items
            </button>
          </div>
        </div>
      )}
    </>
  );
}
