import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Pages anyone can visit without signing in. Everything else needs a login.
const PUBLIC_PATHS = ["/", "/login", "/auth/callback"];

// Runs before every page load (called from /proxy.ts):
//  1. keeps the user's login session fresh (refreshes cookies), and
//  2. sends signed-out visitors to /login if the page is protected.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // Important: this call is what refreshes the session. Don't remove it.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims);

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.includes(path);

  if (!isSignedIn && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  // Already signed in? Skip the landing + login pages.
  if (isSignedIn && (path === "/" || path === "/login")) {
    const feedUrl = request.nextUrl.clone();
    feedUrl.pathname = "/feed";
    feedUrl.search = "";
    return NextResponse.redirect(feedUrl);
  }

  return response;
}
