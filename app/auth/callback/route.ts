import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// The magic link in the email points here. We trade the link's one-time
// token for a login session, then send the user on to the right page.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const supabase = await createClient();

  // Two kinds of links are supported:
  //  - token_hash: from our custom email template (works in any browser)
  //  - code: Supabase's default template (must open in the same browser)
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  let failed = true;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    failed = Boolean(error);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = Boolean(error);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (failed || !user) {
    return NextResponse.redirect(`${origin}/login?error=link`);
  }

  // First time here? (No display name yet) → onboarding. Otherwise → feed.
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const next = profile?.display_name ? "/feed" : "/onboarding";
  return NextResponse.redirect(`${origin}${next}`);
}
