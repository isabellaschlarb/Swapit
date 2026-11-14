"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type LoginState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "no-school" }
  | { status: "error"; message: string };

// Runs on the server when the login form is submitted.
export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "That doesn't look like an email address." };
  }

  const supabase = await createClient();

  // 1. Is Swapit live at this email's school? (Looks it up in the schools table.)
  const { data: schoolId, error: schoolError } = await supabase.rpc("school_id_for_email", {
    email,
  });
  if (schoolError) {
    return { status: "error", message: "Something went wrong. Please try again." };
  }
  if (!schoolId) {
    return { status: "no-school" };
  }

  // 2. Send the magic link. Clicking it opens /auth/callback on this site.
  const origin = (await headers()).get("origin");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    const message =
      error.status === 429
        ? "Too many sign-in emails were sent. Wait a bit and try again."
        : "We couldn't send the email. Please try again.";
    return { status: "error", message };
  }

  return { status: "sent", email };
}
