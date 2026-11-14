import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient, pathAfterSignIn } from "@/lib/supabase/server";

// OLD sign-in link address, kept so emails sent before the switch still work.
// New emails link to /auth/confirm instead, which waits for a button tap so
// email virus scanners can't use up the link first. Don't point new links here.
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

  return NextResponse.redirect(`${origin}${await pathAfterSignIn(supabase, user.id)}`);
}
