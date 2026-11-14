"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import {
  resendCode,
  sendCode,
  verifyCode,
  type CodeState,
  type LoginState,
} from "./actions";

// How long Supabase makes you wait between emails (max_frequency in config.toml).
const RESEND_WAIT_SECONDS = 60;

export function LoginForm() {
  // Changing the key starts the form over (used by "Use a different email").
  const [attempt, setAttempt] = useState(0);
  return <EmailStep key={attempt} onStartOver={() => setAttempt((n) => n + 1)} />;
}

// Step 1: type your school email.
function EmailStep({ onStartOver }: { onStartOver: () => void }) {
  const [state, formAction] = useActionState<LoginState, FormData>(sendCode, {
    status: "idle",
  });

  if (state.status === "sent") {
    return <CodeStep email={state.email} onStartOver={onStartOver} />;
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

      <SubmitButton pendingText="Sending…">Email me a code</SubmitButton>
    </form>
  );
}

// Step 2: type the 6-digit code from the email.
function CodeStep({ email, onStartOver }: { email: string; onStartOver: () => void }) {
  const [state, formAction] = useActionState<CodeState, FormData>(verifyCode, {
    status: "idle",
  });
  const [secondsLeft, setSecondsLeft] = useState(RESEND_WAIT_SECONDS);
  const [resendNote, setResendNote] = useState("");
  const [resending, startResend] = useTransition();

  // Count down once a second until the Resend button unlocks.
  useEffect(() => {
    const timer = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  function resend() {
    startResend(async () => {
      const result = await resendCode(email);
      if (result.ok) {
        setResendNote("New code sent. Use the newest email.");
        setSecondsLeft(RESEND_WAIT_SECONDS);
      } else {
        setResendNote(result.message);
        if (result.waitSeconds) setSecondsLeft(result.waitSeconds);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1 text-center">
        <h2 className="text-lg font-bold text-navy">Check your email</h2>
        <p className="text-sm text-ink/70">
          We sent a 6-digit code to <span className="font-medium text-ink">{email}</span>. Not
          there? Check your Junk folder.
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="email" value={email} />
        <input
          type="text"
          name="token"
          required
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="123456"
          aria-label="6-digit code"
          className="w-full rounded-2xl border border-ink/10 bg-surface px-4 py-3 text-center text-3xl font-bold tracking-[0.4em] text-navy outline-none placeholder:text-ink/20 focus:border-sky"
        />

        {state.status === "error" && (
          <p className="rounded-2xl bg-pale p-4 text-sm">{state.message}</p>
        )}

        <SubmitButton pendingText="Checking…">Sign in</SubmitButton>
      </form>

      <div className="space-y-2 text-center text-sm">
        <button
          type="button"
          onClick={resend}
          disabled={secondsLeft > 0 || resending}
          className="font-semibold text-navy disabled:text-ink/40"
        >
          {resending
            ? "Sending…"
            : secondsLeft > 0
              ? `Resend code in ${secondsLeft}s`
              : "Resend code"}
        </button>
        {resendNote && <p className="text-ink/60">{resendNote}</p>}
        <button type="button" onClick={onStartOver} className="block w-full text-ink/60 underline">
          Use a different email
        </button>
      </div>
    </div>
  );
}
