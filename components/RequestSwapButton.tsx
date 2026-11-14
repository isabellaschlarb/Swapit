"use client";

import { useState } from "react";

// STUB: the real swap request flow (pick items to offer, add cash,
// choose a meetup spot) is the next feature to build.
export function RequestSwapButton() {
  const [clicked, setClicked] = useState(false);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setClicked(true)}
        className="w-full rounded-full bg-primary px-6 py-3 font-medium text-cream"
      >
        Request swap
      </button>
      {clicked && (
        <p className="text-center text-sm text-ink/60">Swap requests are coming soon!</p>
      )}
    </div>
  );
}
