"use server";

import { redirect } from "next/navigation";
import { dollarsToCents } from "@/lib/format";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export type RequestState = { error?: string };

// Saves a swap or buy request. The database double-checks everything
// (see supabase/migrations/0003_swap_flow.sql) and replies with a
// friendly message if something's not allowed, which we show as-is.
export async function createSwapRequest(
  _prev: RequestState,
  formData: FormData,
): Promise<RequestState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const kind = formData.get("kind") === "buy" ? "buy" : "swap";
  const cashCents = dollarsToCents(String(formData.get("cash") ?? ""));
  const payer = formData.get("cash_paid_by");
  const meetupTime = String(formData.get("meetup_time") ?? "");

  if (!formData.get("meetup_spot_id")) return { error: "Pick a meetup spot." };
  if (!meetupTime || Number.isNaN(Date.parse(meetupTime))) {
    return { error: "Pick a meetup day and time." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("swap_requests").insert({
    kind,
    requested_item_id: formData.get("requested_item_id"),
    offered_item_ids: kind === "swap" ? formData.getAll("offered_item_ids").map(String) : [],
    cash_amount_cents: cashCents,
    cash_paid_by: kind === "buy" ? "requester" : cashCents > 0 ? payer : null,
    meetup_spot_id: formData.get("meetup_spot_id"),
    meetup_time: meetupTime,
    // owner_id + status are filled in by the database
  });

  if (error) {
    if (error.code === "P0001") return { error: error.message }; // our own rule messages
    if (error.code === "23505") return { error: "You already have an open request for this item." };
    console.error(error);
    return { error: "Couldn't send your request. Please try again." };
  }

  redirect("/swaps?tab=sent");
}
