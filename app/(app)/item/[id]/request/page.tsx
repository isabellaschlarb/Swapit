import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { listingLabel } from "@/lib/format";
import { createClient, getMyProfile } from "@/lib/supabase/server";
import type { Item } from "@/lib/types";
import { RequestForm } from "./RequestForm";

// /item/[id]/request?type=swap  or  ?type=buy
export default async function RequestPage({ params, searchParams }: PageProps<"/item/[id]/request">) {
  const { id } = await params;
  const { type } = await searchParams;
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase.from("items").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const item = data as Item;

  // Can't request your own item, or one that's already on hold / gone.
  if (item.owner_id === profile.id || item.status !== "available") redirect(`/item/${id}`);

  // Use the requested type if the listing allows it, otherwise the one it does allow.
  const canSwap = item.listing_type !== "sell";
  const canBuy = item.listing_type !== "swap";
  const kind = type === "buy" && canBuy ? "buy" : canSwap ? "swap" : "buy";

  const [{ data: myItems }, { data: spots }] = await Promise.all([
    supabase
      .from("items")
      .select("id, title, estimated_value_cents, photo_urls")
      .eq("owner_id", profile.id)
      .eq("status", "available")
      .order("created_at", { ascending: false }),
    supabase.from("meetup_spots").select("id, name, description").order("name"),
  ]);

  return (
    <main className="space-y-6 px-5 pt-6">
      <Link href={`/item/${id}`} className="text-sm text-navy">
        ← Back
      </Link>

      <header className="flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-pale">
          {item.photo_urls[0] && (
            <Image src={item.photo_urls[0]} alt="" fill sizes="64px" className="object-cover" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-ink/60">{kind === "buy" ? "Buy" : "Swap for"}</p>
          <h1 className="truncate text-xl font-extrabold tracking-tight text-navy">{item.title}</h1>
          <p className="text-sm text-ink/60">{listingLabel(item)}</p>
        </div>
      </header>

      <RequestForm
        kind={kind}
        itemId={item.id}
        itemValueCents={item.estimated_value_cents}
        askingPriceCents={item.price_cents}
        myItems={myItems ?? []}
        spots={spots ?? []}
      />
    </main>
  );
}
