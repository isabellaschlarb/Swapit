import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { formatCents, formatMeetupTime } from "@/lib/format";
import { createClient, getMyProfile } from "@/lib/supabase/server";
import type { Item, SwapRequest } from "@/lib/types";
import { SwapActions, type SwapAction } from "./SwapActions";

type SwapRow = SwapRequest & {
  item: Pick<Item, "id" | "title" | "photo_urls" | "status"> | null;
  spot: { name: string } | null;
  requester: { display_name: string | null } | null;
  owner: { display_name: string | null } | null;
};

// Lists swaps I'm part of, in two tabs:
//   Incoming = requests for MY items · Sent = requests I made
// RLS only returns swaps where I'm the requester or owner.
export default async function SwapsPage({ searchParams }: PageProps<"/swaps">) {
  const { tab } = await searchParams;
  const showSent = tab === "sent";
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase
    .from("swap_requests")
    .select(
      `*,
       item:items(id, title, photo_urls, status),
       spot:meetup_spots(name),
       requester:profiles!swap_requests_requester_id_fkey(display_name),
       owner:profiles!swap_requests_owner_id_fkey(display_name)`,
    )
    .order("created_at", { ascending: false });
  const swaps = (data ?? []) as SwapRow[];

  // Look up the titles of every offered item in one go.
  const offeredIds = [...new Set(swaps.flatMap((s) => s.offered_item_ids))];
  const { data: offered } = offeredIds.length
    ? await supabase.from("items").select("id, title").in("id", offeredIds)
    : { data: [] };
  const titles = new Map((offered ?? []).map((i) => [i.id, i.title as string]));

  const incoming = swaps.filter((s) => s.owner_id === profile.id);
  const sent = swaps.filter((s) => s.requester_id === profile.id);
  const shown = showSent ? sent : incoming;
  const waiting = incoming.filter((s) => s.status === "pending").length;

  return (
    <main className="mx-auto w-full max-w-4xl lg:pt-4">
      <PageHeader title="Swaps" />

      {/* Tabs */}
      <nav aria-label="Swap requests" className="mx-5 mb-5 grid grid-cols-2 rounded-full bg-surface p-1 text-sm">
        <Link
          href="/swaps"
          className={`rounded-full py-2 text-center ${!showSent ? "bg-navy text-white" : "text-ink/60"}`}
        >
          Incoming{waiting > 0 && ` (${waiting})`}
        </Link>
        <Link
          href="/swaps?tab=sent"
          className={`rounded-full py-2 text-center ${showSent ? "bg-navy text-white" : "text-ink/60"}`}
        >
          Sent
        </Link>
      </nav>

      <div className="px-5">
        {shown.length === 0 ? (
          <p className="rounded-2xl bg-surface shadow-soft p-6 text-center text-ink/60">
            {showSent
              ? "You haven't requested anything yet. Find something in the Feed!"
              : "No requests for your items yet."}
          </p>
        ) : (
          <ul className="space-y-3">
            {shown.map((swap) => (
              <SwapCard
                key={swap.id}
                swap={swap}
                isOwner={swap.owner_id === profile.id}
                titles={titles}
                timeZone={profile.schoolTimezone}
              />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function SwapCard({
  swap,
  isOwner,
  titles,
  timeZone,
}: {
  swap: SwapRow;
  isOwner: boolean;
  titles: Map<string, string>;
  timeZone: string;
}) {
  const otherName = (isOwner ? swap.requester : swap.owner)?.display_name ?? "a student";
  const offeredTitles = swap.offered_item_ids.map((id) => titles.get(id) ?? "an item");
  const youPay =
    (isOwner && swap.cash_paid_by === "owner") || (!isOwner && swap.cash_paid_by === "requester");
  const isOpen = swap.status === "pending" || swap.status === "accepted";
  const itemOnHoldElsewhere = swap.status === "pending" && swap.item?.status !== "available";

  // Which buttons to show. (The database enforces these rules too.)
  const actions: SwapAction[] = [];
  if (swap.status === "pending" && isOwner) {
    actions.push({ status: "accepted", label: "Accept", primary: true });
    actions.push({ status: "declined", label: "Decline" });
  } else if (swap.status === "pending") {
    actions.push({ status: "cancelled", label: "Cancel request" });
  } else if (swap.status === "accepted") {
    actions.push({ status: "completed", label: "Mark complete", primary: true });
    actions.push({ status: "cancelled", label: "Cancel" });
  }

  return (
    <li className="space-y-3 rounded-2xl bg-surface shadow-soft p-4">
      {/* The item being requested */}
      <div className="flex items-center gap-3">
        <Link
          href={swap.item ? `/item/${swap.item.id}` : "#"}
          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-pale"
        >
          {swap.item?.photo_urls[0] && (
            <Image src={swap.item.photo_urls[0]} alt="" fill sizes="56px" className="object-cover" />
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{swap.item?.title ?? "Item removed"}</p>
          <p className="text-sm text-ink/60">
            {isOwner ? `From ${otherName}` : `To ${otherName}`}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs ${
            swap.status === "accepted" ? "bg-navy text-white" : "bg-pale"
          }`}
        >
          {swap.status}
        </span>
      </div>

      {/* What's being offered */}
      <div className="space-y-1 text-sm">
        {swap.kind === "buy" ? (
          <p>
            <span className="text-ink/60">Buy offer:</span> {formatCents(swap.cash_amount_cents)}
          </p>
        ) : (
          <p>
            <span className="text-ink/60">Offering:</span> {offeredTitles.join(", ")}
            {swap.cash_amount_cents > 0 &&
              ` + ${formatCents(swap.cash_amount_cents)} (${youPay ? "you pay" : "they pay"})`}
          </p>
        )}
        <p>
          <span className="text-ink/60">Meetup:</span> {swap.spot?.name ?? "No spot"}
          {swap.meetup_time && ` · ${formatMeetupTime(swap.meetup_time, timeZone)}`}
        </p>
      </div>

      {isOpen && swap.cash_amount_cents > 0 && (
        <p className="rounded-2xl bg-pale px-3 py-2 text-sm">
          <span className="font-medium">Pay at meetup:</span>{" "}
          {youPay ? "you pay" : "they pay"} {formatCents(swap.cash_amount_cents)} in cash or Venmo.
        </p>
      )}

      {/* Only the requester sees the note (the owner already knows why) */}
      {!isOwner && swap.closed_note && <p className="rounded-2xl bg-pale px-3 py-2 text-sm">{swap.closed_note}</p>}

      {itemOnHoldElsewhere && (
        <p className="text-sm text-ink/60">This item is on hold in another swap right now.</p>
      )}

      <SwapActions swapId={swap.id} actions={actions} />
    </li>
  );
}
