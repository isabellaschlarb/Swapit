import { createBrowserClient } from "@supabase/ssr";

// Supabase client for code that runs in the browser ("use client" components),
// e.g. uploading photos straight from the phone.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
