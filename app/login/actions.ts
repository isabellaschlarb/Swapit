"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, pathAfterSignIn } from "@/lib/supabase/server";

// Sign-in works with a 6-digit code from the email (typed into the login page),
// so it signs you in exactly where you typed it, including the iPhone
// home-screen app, which doesn't share logins with Safari.
// The email also has a backup link (see app/auth/confirm).

export type LoginState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "no-school" }
  | { status: "error"; message: string };

export type CodeState = { status: "idle" } | { status: "error"; message: string };

export type ResendResult =
  | { ok: true }
  | { ok: false; message: string; waitSeconds?: number };

// Step 1: the email form was submitted.
export async function sendCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "That doesn't look like an email address." };
  }

  const result = await emailCode(email);
  if (result === "no-school") return { status: "no-school" };
  if (!result.ok) return { status: "error", message: result.message };
  return { status: "sent", email };
}

// "Resend code" button on the code step.
export async function resendCode(email: string): Promise<ResendResult> {
  const result = await emailCode(email.trim().toLowerCase());
  if (result === "no-school") return { ok: false, message: "Swapit isn't at your school yet." };
  return result;
}

// Step 2: the code form was submitted.
export async function verifyCode(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("token") ?? "").replace(/\D/g, ""); // digits only

  if (token.length !== 6) {
    return { status: "error", message: "Enter the 6-digit code from the email." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });

  if (error || !data.user) {
    const message =
      error?.status === 429
        ? "Too many tries. Wait a few minutes, then try again."
        : "That code didn't work. Check it, or tap Resend for a new one.";
    return { status: "error", message };
  }

  redirect(await pathAfterSignIn(supabase, data.user.id));
}

// Checks the school, then asks Supabase to email a code (and backup link).
async function emailCode(email: string): Promise<ResendResult | "no-school"> {
  const supabase = await createClient();

  // Is Swapit live at this email's school? (Looks it up in the schools table.)
  const { data: schoolId, error: schoolError } = await supabase.rpc("school_id_for_email", {
    email,
  });
  if (schoolError) return { ok: false, message: "Something went wrong. Please try again." };
  if (!schoolId) return "no-school";

  // The backup link in the email opens /auth/confirm on this site.
  const origin = (await headers()).get("origin");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });

  if (error) {
    if (error.status === 429) {
      // Supabase says e.g. "...you can only request this after 42 seconds."
      const seconds = Number(error.message.match(/after (\d+) seconds/)?.[1]);
      return {
        ok: false,
        message: seconds
          ? `Please wait ${seconds} seconds before asking for another code.`
          : "Too many emails were sent. Wait a bit and try again.",
        waitSeconds: seconds || undefined,
      };
    }
    return { ok: false, message: "We couldn't send the email. Please try again." };
  }
  return { ok: true };
}
