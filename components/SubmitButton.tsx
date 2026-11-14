"use client";

import { useFormStatus } from "react-dom";

// A form's main button. Shows a "working..." label while the form submits.
export function SubmitButton({
  children,
  pendingText = "One sec…",
}: {
  children: React.ReactNode;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-primary px-6 py-3 font-medium text-cream disabled:opacity-60"
    >
      {pending ? pendingText : children}
    </button>
  );
}
