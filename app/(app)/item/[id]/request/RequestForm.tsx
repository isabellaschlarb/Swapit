"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { formatCents } from "@/lib/format";
import { createSwapRequest, type RequestState } from "./actions";

type MyItem = { id: string; title: string; estimated_value_cents: number; photo_urls: string[] };
type Spot = { id: string; name: string; description: string | null };

const inputClass =
  "w-full rounded-2xl border border-ink/10 bg-surface px-4 py-3 outline-none focus:border-sky";

export function RequestForm({
  kind,
  itemId,
  itemValueCents,
  askingPriceCents,
  myItems,
  spots,
}: {
  kind: "swap" | "buy";
  itemId: string;
  itemValueCents: number;
  askingPriceCents: number | null;
  myItems: MyItem[];
  spots: Spot[];
}) {
  const [state, formAction] = useActionState<RequestState, FormData>(createSwapRequest, {});
  const [selected, setSelected] = useState<string[]>([]);
  const [cash, setCash] = useState("");
  // These are "controlled" (kept in state) so they survive an error message.
  const [spotId, setSpotId] = useState("");
  const [payer, setPayer] = useState<"requester" | "owner">("requester");
  const [offer, setOffer] = useState(askingPriceCents ? String(askingPriceCents / 100) : "");
  // The time picker gives a local time like "2026-11-20T15:00". We turn it
  // into a full timestamp here in the browser, where the user's timezone is known.
  const [meetupLocal, setMeetupLocal] = useState("");
  const meetupIso = meetupLocal ? new Date(meetupLocal).toISOString() : "";

  const offeredValue = myItems
    .filter((item) => selected.includes(item.id))
    .reduce((sum, item) => sum + item.estimated_value_cents, 0);

  function toggle(id: string) {
    setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  if (kind === "swap" && myItems.length === 0) {
    return (
      <div className="space-y-4 rounded-2xl bg-surface shadow-soft p-6 text-center">
        <p className="text-ink/70">You need an available item of your own to offer in a swap.</p>
        <Link href="/post" className="inline-block rounded-full bg-navy px-6 py-3 font-medium text-white">
          Post an item
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="requested_item_id" value={itemId} />
      <input type="hidden" name="meetup_time" value={meetupIso} />

      {kind === "swap" ? (
        <>
          {/* 1. Which of my items to offer */}
          <section className="space-y-3">
            <h2 className="font-medium">What will you offer?</h2>
            <ul className="space-y-2">
              {myItems.map((item) => (
                <li key={item.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-ink/10 bg-surface p-2 has-[:checked]:border-navy">
                    <input
                      type="checkbox"
                      name="offered_item_ids"
                      value={item.id}
                      checked={selected.includes(item.id)}
                      onChange={() => toggle(item.id)}
                      className="h-5 w-5 accent-navy"
                    />
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-pale">
                      {item.photo_urls[0] && (
                        <Image src={item.photo_urls[0]} alt="" fill sizes="48px" className="object-cover" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-ink/60">{formatCents(item.estimated_value_cents)} est.</p>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
            <p className="text-sm text-ink/60">
              Their item ≈ {formatCents(itemValueCents)} · Your offer ≈ {formatCents(offeredValue)}
            </p>
          </section>

          {/* 2. Optional cash difference */}
          <section className="space-y-3">
            <h2 className="font-medium">
              Cash difference <span className="font-normal text-ink/50">(optional)</span>
            </h2>
            <input
              name="cash"
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              placeholder="$0"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              className={inputClass}
            />
            {Number(cash) > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "requester", label: "I pay" },
                  { value: "owner", label: "They pay" },
                ].map((option) => (
                  <label key={option.value} className="cursor-pointer">
                    <input
                      type="radio"
                      name="cash_paid_by"
                      value={option.value}
                      checked={payer === option.value}
                      onChange={() => setPayer(option.value as "requester" | "owner")}
                      className="peer sr-only"
                    />
                    <span className="block rounded-full border border-ink/15 py-2 text-center text-sm peer-checked:border-navy peer-checked:bg-navy peer-checked:text-white">
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        /* Buy: just an amount (defaults to the asking price) */
        <section className="space-y-3">
          <h2 className="font-medium">Your offer ($)</h2>
          <input
            name="cash"
            type="number"
            inputMode="decimal"
            min="1"
            step="1"
            required
            value={offer}
            onChange={(e) => setOffer(e.target.value)}
            className={inputClass}
          />
          {askingPriceCents && (
            <p className="text-sm text-ink/60">
              Asking price is {formatCents(askingPriceCents)}. You can offer a different amount.
            </p>
          )}
        </section>
      )}

      {/* 3. Where + when to meet */}
      <section className="space-y-3">
        <h2 className="font-medium">Where and when to meet?</h2>
        <select
          name="meetup_spot_id"
          required
          value={spotId}
          onChange={(e) => setSpotId(e.target.value)}
          className={inputClass}
        >
          <option value="" disabled>
            Choose a campus spot
          </option>
          {spots.map((spot) => (
            <option key={spot.id} value={spot.id}>
              {spot.name}
            </option>
          ))}
        </select>
        <input
          type="datetime-local"
          required
          value={meetupLocal}
          onChange={(e) => setMeetupLocal(e.target.value)}
          className={inputClass}
        />
      </section>

      {(kind === "buy" || Number(cash) > 0) && (
        <p className="rounded-2xl bg-pale p-4 text-sm">
          <span className="font-medium">Pay at meetup.</span> Cash or Venmo, in person, once
          you&apos;ve seen the item. Swapit doesn&apos;t handle payments.
        </p>
      )}

      {state.error && <p className="rounded-2xl bg-pale p-4 text-sm">{state.error}</p>}

      <SubmitButton pendingText="Sending…">
        {kind === "buy" ? "Send buy request" : "Send swap request"}
      </SubmitButton>
    </form>
  );
}
