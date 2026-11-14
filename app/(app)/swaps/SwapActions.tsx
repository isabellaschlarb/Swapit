"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { SwapStatus } from "@/lib/types";
import { updateSwapStatus, type SwapActionState } from "./actions";

export type SwapAction = { status: SwapStatus; label: string; primary?: boolean };

// The row of buttons under a swap card. Each button sends the new status.
export function SwapActions({ swapId, actions }: { swapId: string; actions: SwapAction[] }) {
  const [state, formAction] = useActionState<SwapActionState, FormData>(updateSwapStatus, {});
  if (actions.length === 0) return null;

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="swap_id" value={swapId} />
      <div className="flex gap-2">
        {actions.map((action) => (
          <ActionButton key={action.status} action={action} />
        ))}
      </div>
      {state.error && <p className="rounded-2xl bg-accent/40 p-3 text-sm">{state.error}</p>}
    </form>
  );
}

function ActionButton({ action }: { action: SwapAction }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="status"
      value={action.status}
      disabled={pending}
      className={`flex-1 rounded-full px-4 py-2 text-sm font-medium disabled:opacity-60 ${
        action.primary ? "bg-primary text-cream" : "border border-ink/15 text-ink/70"
      }`}
    >
      {action.label}
    </button>
  );
}
