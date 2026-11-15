"use server";

import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient, pathAfterSignIn } from "@/lib/supabase/server";

// Link types our emails can contain ("email" covers both sign-in and sign-up).
const LINK_TYPES: EmailOtpType[] = ["email", "magiclink", "signup"];

// Runs ONLY when the person taps "Tap to sign in" on /auth/confirm.
// This is where the email link's one-time token actually gets used up.
export async function confirmSignIn(formData: FormData) {
  const tokenHash = String(formData.get("token_hash") ?? "");
  const type = String(formData.get("type") ?? "") as EmailOtpType;
  const code = String(formData.get("code") ?? "");

  const supabase = await createClient();

  if (tokenHash && LINK_TYPES.includes(type)) {
    // Our own email template (works in any browser, even the Gmail/Outlook app)
    await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  } else if (code) {
    // Supabase's default email (only works in the browser that asked for it)
    await supabase.auth.exchangeCodeForSession(code);
  }

  // If they ended up signed in, continue. This also covers tapping the
  // button twice: the second tap fails, but they're already signed in.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=link");

  redirect(await pathAfterSignIn(supabase, user.id));
}
