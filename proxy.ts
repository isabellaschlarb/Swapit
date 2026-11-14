import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 calls this "proxy" (it used to be called "middleware").
// It runs before every request — see lib/supabase/proxy.ts for the logic.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on every path except Next.js internals and static files.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
