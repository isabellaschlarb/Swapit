import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { LiveRefresh } from "@/components/LiveRefresh";
import { PageHeader } from "@/components/PageHeader";
import { UserName } from "@/components/UserName";
import { formatChatTime } from "@/lib/format";
import { createClient, getMyProfile } from "@/lib/supabase/server";
import type { Message } from "@/lib/types";

type Person = { id: string; display_name: string | null; avatar_url: string | null };
type SwapRow = {
  id: string;
  status: string;
  requester_id: string;
  owner_id: string;
  created_at: string;
  item: { title: string; photo_urls: string[] } | null;
  requester: Person | null;
  owner: Person | null;
};

// Messages tab: one conversation per swap/buy request I'm part of.
// Shows the other person, the item, the last message, and a dot when
// there's something I haven't read. Updates live.
export default async function MessagesPage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");
  const supabase = await createClient();

  // RLS: only swaps I'm in, only their messages, only my read markers.
  const { data: swapData } = await supabase
    .from("swap_requests")
    .select(
      `id, status, requester_id, owner_id, created_at,
       item:items(title, photo_urls),
       requester:profiles!swap_requests_requester_id_fkey(id, display_name, avatar_url),
       owner:profiles!swap_requests_owner_id_fkey(id, display_name, avatar_url)`,
    )
    .order("created_at", { ascending: false });
  const swaps = (swapData ?? []) as unknown as SwapRow[];
  const swapIds = swaps.map((s) => s.id);

  const [{ data: messageData }, { data: readData }] = swapIds.length
    ? await Promise.all([
        supabase
          .from("messages")
          .select("swap_request_id, sender_id, body, created_at")
          .in("swap_request_id", swapIds)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase.from("message_reads").select("swap_request_id, last_read_at"),
      ])
    : [{ data: [] }, { data: [] }];

  // Newest message per swap (the list is newest-first, so the first one wins).
  const latest = new Map<string, Omit<Message, "id">>();
  for (const m of (messageData ?? []) as Omit<Message, "id">[]) {
    if (!latest.has(m.swap_request_id)) latest.set(m.swap_request_id, m);
  }
  const lastRead = new Map((readData ?? []).map((r) => [r.swap_request_id as string, r.last_read_at as string]));

  // Show chats that have messages, plus open swaps (so you can say hi).
  const conversations = swaps
    .filter((s) => latest.has(s.id) || s.status === "pending" || s.status === "accepted")
    .map((s) => {
      const last = latest.get(s.id);
      const read = lastRead.get(s.id);
      return {
        swap: s,
        other: s.requester_id === profile.id ? s.owner : s.requester,
        last,
        activity: last?.created_at ?? s.created_at,
        unread: Boolean(last && last.sender_id !== profile.id && (!read || last.created_at > read)),
      };
    })
    .sort((a, b) => b.activity.localeCompare(a.activity));

  return (
    <main className="mx-auto w-full max-w-3xl lg:pt-4">
      <LiveRefresh />
      <PageHeader title="Messages" />
      <div className="px-5">
        {conversations.length === 0 ? (
          <div className="space-y-3 rounded-2xl bg-surface p-8 text-center shadow-soft">
            <p className="font-bold text-navy">No chats yet</p>
            <p className="text-sm text-ink/60">
              When you send or get a swap request, you can chat about it here: sizes, fit, when to meet.
            </p>
            <Link href="/feed" className="inline-block rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white">
              Browse the feed
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-ink/5 overflow-hidden rounded-2xl bg-surface shadow-soft">
            {conversations.map(({ swap, other, last, activity, unread }) => (
              <li key={swap.id}>
                <Link href={`/messages/${swap.id}`} className="flex items-center gap-3 p-3 hover:bg-cloud">
                  <Avatar name={other?.display_name ?? null} url={other?.avatar_url} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <UserName name={other?.display_name ?? null} className={`text-sm ${unread ? "font-bold text-navy" : "font-semibold"}`} />
                      <span className="shrink-0 text-xs text-ink/50">{formatChatTime(activity, profile.schoolTimezone)}</span>
                    </div>
                    <p className="truncate text-xs text-ink/50">{swap.item?.title ?? "Item removed"}</p>
                    <p className={`truncate text-sm ${unread ? "font-semibold text-ink" : "text-ink/60"}`}>
                      {last ? `${last.sender_id === profile.id ? "You: " : ""}${last.body}` : "Say hi and plan your meetup 👋"}
                    </p>
                  </div>
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-pale">
                    {swap.item?.photo_urls[0] && <Image src={swap.item.photo_urls[0]} alt="" fill sizes="48px" className="object-cover" />}
                  </div>
                  {unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-sky ring-2 ring-navy/10" aria-label="Unread" />}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
