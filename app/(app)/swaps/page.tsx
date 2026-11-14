import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { formatCents } from "@/lib/format";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { SwapRequest } from "@/lib/types";

type SwapRow = SwapRequest & { item: { id: string; title: string } | null };

// Lists swaps I'm part of. RLS only returns swaps where I'm the requester
// or the owner, so no extra filtering is needed.
// STUB: no accept/decline/chat yet — that's the next feature.
export default async function SwapsPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { data } = await supabase
    .from("swap_requests")
    .select("*, item:items(id, title)")
    .order("created_at", { ascending: false });

  const swaps = (data ?? []) as SwapRow[];
  const incoming = swaps.filter((s) => s.owner_id === user?.id);
  const outgoing = swaps.filter((s) => s.requester_id === user?.id);

  return (
    <main>
      <PageHeader title="Swaps" />
      <div className="space-y-8 px-5">
        <SwapList title="Requests for your items" swaps={incoming} empty="No one has asked yet." />
        <SwapList title="Your requests" swaps={outgoing} empty="You haven't requested any swaps yet." />
      </div>
    </main>
  );
}

function SwapList({ title, swaps, empty }: { title: string; swaps: SwapRow[]; empty: string }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-ink/60">{title}</h2>
      {swaps.length === 0 ? (
        <p className="rounded-2xl bg-surface p-6 text-center text-ink/60">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {swaps.map((swap) => (
            <li key={swap.id}>
              <Link
                href={swap.item ? `/item/${swap.item.id}` : "#"}
                className="flex items-center justify-between rounded-2xl bg-surface p-4"
              >
                <div>
                  <p className="font-medium">{swap.item?.title ?? "Item removed"}</p>
                  <p className="text-sm text-ink/60">
                    {swap.offered_item_ids.length} item(s) offered
                    {swap.cash_amount_cents > 0 && ` + ${formatCents(swap.cash_amount_cents)}`}
                  </p>
                </div>
                <span className="rounded-full bg-accent/50 px-3 py-1 text-xs">{swap.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
