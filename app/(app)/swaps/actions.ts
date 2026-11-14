"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SwapStatus } from "@/lib/types";

export type SwapActionState = { error?: string };

const ALLOWED: SwapStatus[] = ["accepted", "declined", "cancelled", "completed"];

// Accept / Decline / Cancel / Mark complete.
// The database decides who may do what, and updates the items' status
// (see handle_swap_status_change in supabase/migrations/0003_swap_flow.sql).
export async function updateSwapStatus(
  _prev: SwapActionState,
  formData: FormData,
): Promise<SwapActionState> {
  const swapId = String(formData.get("swap_id") ?? "");
  const status = String(formData.get("status") ?? "") as SwapStatus;
  if (!swapId || !ALLOWED.includes(status)) return { error: "Unknown action." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("swap_requests")
    .update({ status })
    .eq("id", swapId)
    .select("id");

  if (error) {
    if (error.code === "P0001") return { error: error.message };
    console.error(error);
    return { error: "Something went wrong. Please try again." };
  }
  if (!data?.length) return { error: "We couldn't find that swap." };

  revalidatePath("/swaps");
  return {};
}
