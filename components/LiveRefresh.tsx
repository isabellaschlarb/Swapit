"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Listens for new chat messages (Supabase Realtime) and reloads the page's
// data when one arrives. Realtime follows the database rules, so we only
// hear about messages in our own swaps.
export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.realtime.setAuth().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel("my-messages")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => router.refresh())
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
