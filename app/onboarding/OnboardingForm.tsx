"use client";

import { useActionState } from "react";
import { StyleTagPicker } from "@/components/StyleTagPicker";
import { SubmitButton } from "@/components/SubmitButton";
import { saveOnboarding, type OnboardingState } from "./actions";

export function OnboardingForm() {
  const [state, formAction] = useActionState<OnboardingState, FormData>(saveOnboarding, {});

  return (
    <form action={formAction} className="space-y-8">
      <label className="block space-y-2">
        <span className="text-sm text-ink/70">What should people call you?</span>
        <input
          name="display_name"
          required
          minLength={2}
          maxLength={40}
          placeholder="First name or nickname"
          className="w-full rounded-2xl border border-ink/10 bg-surface px-4 py-3 outline-none focus:border-primary"
        />
      </label>

      <div className="space-y-3">
        <p className="text-sm text-ink/70">Your style (pick a few)</p>
        <StyleTagPicker />
      </div>

      {state.error && <p className="rounded-2xl bg-accent/40 p-4 text-sm">{state.error}</p>}

      <SubmitButton pendingText="Saving…">Start swapping</SubmitButton>
    </form>
  );
}
