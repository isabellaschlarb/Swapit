"use client";

import { useState } from "react";

// STUB: the heart toggles on screen only. Saving favorites needs a
// "saved_items" table (future feature), so it resets on reload.
export function HeartButton({ className = "" }: { className?: string }) {
  const [saved, setSaved] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setSaved(!saved)}
      aria-pressed={saved}
      aria-label={saved ? "Unsave" : "Save"}
      className={`flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 shadow-soft ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-[18px] w-[18px] ${saved ? "fill-sky text-navy" : "fill-none text-navy"}`}
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
      </svg>
    </button>
  );
}
