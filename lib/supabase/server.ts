import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Profile } from "@/lib/types";

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

// Where to send someone right after they sign in:
// first time here (no display name yet) → onboarding, otherwise → feed.
export async function pathAfterSignIn(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .single();
  return profile?.display_name ? "/feed" : "/onboarding";
}

// Returns the signed-in user, or null if nobody is signed in.
// cache() means: if several parts of the same page ask, we only look it up once.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

// Returns the signed-in user's profile plus their school's name and
// timezone, or null if nobody is signed in.
export const getMyProfile = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*, school:schools(name, timezone)")
    .eq("id", user.id)
    .single();
  if (!data) return null;

  const { school, ...profile } = data as Profile & {
    school: { name: string; timezone: string } | null;
  };
  return {
    ...profile,
    schoolName: school?.name ?? "",
    schoolTimezone: school?.timezone ?? "America/Los_Angeles",
  };
});
