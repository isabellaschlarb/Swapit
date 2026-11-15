"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Follow / Following toggle. Saves a row in `follows` (the database only
// lets you follow people at your school, as yourself). Refreshes the page
// afterwards so follower counts and the Following feed update.
export function FollowButton({
  personId,
  initialFollowing,
  small = false,
}: {
  personId: string;
  initialFollowing: boolean;
  small?: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    const next = !following;
    setFollowing(next);
    setBusy(true);
    const supabase = createClient();
    const { error } = next
      ? await supabase.from("follows").insert({ followee_id: personId })
      : await supabase.from("follows").delete().eq("followee_id", personId);
    if (error && error.code !== "23505") {
      console.error(error);
      setFollowing(!next);
    } else {
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={following}
      className={`rounded-full font-semibold ${small ? "px-3 py-1.5 text-xs" : "px-5 py-2.5 text-sm"} ${
        following ? "border border-navy bg-surface text-navy" : "bg-navy text-white"
      }`}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
