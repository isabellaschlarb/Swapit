"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// The heart on an item. Tapping it saves (or removes) a row in the
// `likes` table. It flips right away, then flips back if saving fails.
// Likes are private and also feed the "For You" ranking.
export function HeartButton({
  itemId,
  initialLiked = false,
  className = "",
}: {
  itemId: string;
  initialLiked?: boolean;
  className?: string;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    const next = !liked;
    setLiked(next);
    setBusy(true);

    const supabase = createClient();
    const { error } = next
      ? await supabase.from("likes").insert({ item_id: itemId })
      : await supabase.from("likes").delete().eq("item_id", itemId);
    // "duplicate key" just means it was already liked (e.g. another tab).
    if (error && error.code !== "23505") {
      console.error(error);
      setLiked(!next);
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={liked}
      aria-label={liked ? "Unlike" : "Like"}
      className={`flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 shadow-soft ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-[18px] w-[18px] ${liked ? "fill-sky text-navy" : "fill-none text-navy"}`}
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
