import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase client for code that runs on the server: pages, server actions,
// and route handlers. It reads the login session from the browser's cookies,
// so every query runs "as" the signed-in user and the database security
// rules (RLS) apply automatically.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Pages can't set cookies — that's fine, proxy.ts refreshes
            // the session on every request anyway.
          }
        },
      },
    },
  );
}

// Returns the signed-in user, or null if nobody is signed in.
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}
