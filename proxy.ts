import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 calls this "proxy" (it used to be called "middleware").
// It runs before every request — see lib/supabase/proxy.ts for the logic.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on every path except Next.js internals, static files, and the app
  // manifest (phones fetch it without login cookies, so it must stay public
  // or "Add to Home Screen" breaks).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
