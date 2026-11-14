"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(sendMagicLink, {
    status: "idle",
  });

  if (state.status === "sent") {
    return (
      <div className="space-y-2 text-center">
        <h2 className="text-lg font-bold text-navy">Check your email</h2>
        <p className="text-ink/70">
          We sent a sign-in link to <span className="font-medium text-ink">{state.email}</span>.
          Tap it to continue.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <label className="block space-y-2">
        <span className="text-sm text-ink/70">School email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@school.edu"
          className="w-full rounded-2xl border border-ink/10 bg-surface px-4 py-3 outline-none focus:border-sky"
        />
      </label>

      {state.status === "no-school" && (
        <div className="space-y-1 rounded-2xl bg-pale p-4 text-sm">
          <p className="font-medium">Swapit isn&apos;t at your school yet.</p>
          <p className="text-ink/70">
            We&apos;re starting with a few campuses. Make sure you used your school email, or
            check back soon!
          </p>
        </div>
      )}

      {state.status === "error" && (
        <p className="rounded-2xl bg-pale p-4 text-sm">{state.message}</p>
      )}

      <SubmitButton pendingText="Sending…">Email me a sign-in link</SubmitButton>
    </form>
  );
}
