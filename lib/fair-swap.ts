// Fair-swap helper: which of MY items add up closest to THEIR item's
// estimated value? Tries every combination of up to 3 items (fine for
// the handful of items a student has) and picks the closest total,
// preferring fewer items on a tie. All money in cents.

type Valued = { id: string; estimated_value_cents: number };

export type FairSwap = {
  itemIds: string[];
  offeredCents: number;
  cashCents: number; // always >= 0
  cashPaidBy: "requester" | "owner" | null; // who pays the difference
};

const MAX_ITEMS = 3;
const MAX_CANDIDATES = 25; // keeps the search tiny (25 choose 3 = 2300 combos)

export function suggestFairSwap(myItems: Valued[], targetCents: number): FairSwap | null {
  const candidates = myItems.filter((item) => item.estimated_value_cents > 0).slice(0, MAX_CANDIDATES);
  if (targetCents <= 0 || candidates.length === 0) return null;

  let best: { ids: string[]; total: number } | null = null;

  function search(start: number, ids: string[], total: number) {
    if (ids.length > 0) {
      const better =
        !best ||
        Math.abs(targetCents - total) < Math.abs(targetCents - best.total) ||
        (Math.abs(targetCents - total) === Math.abs(targetCents - best.total) && ids.length < best.ids.length);
      if (better) best = { ids: [...ids], total };
    }
    if (ids.length === MAX_ITEMS) return;
    for (let i = start; i < candidates.length; i++) {
      ids.push(candidates[i].id);
      search(i + 1, ids, total + candidates[i].estimated_value_cents);
      ids.pop();
    }
  }
  search(0, [], 0);

  if (!best) return null;
  const { ids, total } = best as { ids: string[]; total: number };
  const diff = targetCents - total;
  return {
    itemIds: ids,
    offeredCents: total,
    cashCents: Math.abs(diff),
    // Their item is worth more → I add cash. Mine is worth more → they do.
    cashPaidBy: diff > 0 ? "requester" : diff < 0 ? "owner" : null,
  };
}

// Cash difference for whatever items are picked by hand.
export function cashDifference(offeredCents: number, targetCents: number) {
  const diff = targetCents - offeredCents;
  return {
    cashCents: Math.abs(diff),
    cashPaidBy: diff > 0 ? ("requester" as const) : diff < 0 ? ("owner" as const) : null,
  };
}
