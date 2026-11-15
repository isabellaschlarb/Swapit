import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { UserName } from "@/components/UserName";
import { createClient, getMyProfile } from "@/lib/supabase/server";
import type { Message } from "@/lib/types";
import { ChatThread } from "./ChatThread";

type Person = { id: string; display_name: string | null; avatar_url: string | null };

// One chat, attached to one swap/buy request. RLS only finds the swap
// (and its messages) if I'm the requester or the owner; anyone else
// gets "not found".
export default async function ChatPage({ params }: PageProps<"/messages/[id]">) {
  const { id } = await params;
  const profile = await getMyProfile();
  if (!profile) redirect("/login");
  const supabase = await createClient();

  const { data } = await supabase
    .from("swap_requests")
    .select(
      `id, status, kind, requester_id,
       item:items(id, title, photo_urls),
       requester:profiles!swap_requests_requester_id_fkey(id, display_name, avatar_url),
       owner:profiles!swap_requests_owner_id_fkey(id, display_name, avatar_url)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const swap = data as unknown as {
    id: string;
    status: string;
    kind: "swap" | "buy";
    requester_id: string;
    item: { id: string; title: string; photo_urls: string[] } | null;
    requester: Person | null;
    owner: Person | null;
  };
  const other = swap.requester_id === profile.id ? swap.owner : swap.requester;

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("swap_request_id", id)
    .order("created_at", { ascending: true })
    .limit(500);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col lg:pt-4">
      <header className="sticky top-0 z-10 space-y-3 border-b border-ink/5 bg-cloud/95 px-5 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link href="/messages" aria-label="Back to messages" className="text-xl text-navy">
            ←
          </Link>
          <Link href={other ? `/people/${other.id}` : "#"} className="flex min-w-0 items-center gap-2">
            <Avatar name={other?.display_name ?? null} url={other?.avatar_url} size={36} />
            <UserName name={other?.display_name ?? null} className="font-bold text-navy" />
          </Link>
        </div>
        {swap.item && (
          <Link href={`/swaps${swap.requester_id === profile.id ? "?tab=sent" : ""}`} className="flex items-center gap-3 rounded-2xl bg-surface p-2 shadow-soft">
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-pale">
              {swap.item.photo_urls[0] && <Image src={swap.item.photo_urls[0]} alt="" fill sizes="40px" className="object-cover" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{swap.item.title}</span>
              <span className="block text-xs text-ink/60">
                {swap.kind === "buy" ? "Buy request" : "Swap request"} · {swap.status}
              </span>
            </span>
            <span className="pr-2 text-xs text-navy">View swap →</span>
          </Link>
        )}
      </header>

      <ChatThread
        swapId={swap.id}
        myId={profile.id}
        timeZone={profile.schoolTimezone}
        initialMessages={(messages ?? []) as Message[]}
        otherName={other?.display_name ?? "them"}
      />
    </main>
  );
}
