import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCents, listingLabel } from "@/lib/format";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { Item } from "@/lib/types";

export default async function ItemPage({ params }: PageProps<"/item/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser();

  // Load the item and its owner's name. If it's from another school,
  // RLS hides it and we show "not found".
  const { data } = await supabase
    .from("items")
    .select("*, owner:profiles(display_name)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  const { owner, ...item } = data as Item & { owner: { display_name: string | null } | null };
  const isMine = item.owner_id === user?.id;
  const details = [item.category, item.size, item.condition].filter(Boolean);
  const canSwap = item.listing_type !== "sell";
  const canBuy = item.listing_type !== "swap";

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-10 lg:space-y-0 lg:p-10">
      {/* Photos: swipe sideways if there's more than one */}
      <div className="flex min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto lg:rounded-2xl">
        {item.photo_urls.map((url, i) => (
          <div key={url} className="relative aspect-[4/5] w-full shrink-0 snap-center bg-pale">
            <Image
              src={url}
              alt={`${item.title} photo ${i + 1}`}
              fill
              sizes="(max-width: 1023px) 100vw, 45vw"
              className="object-cover"
              priority={i === 0}
            />
          </div>
        ))}
      </div>

      <section className="min-w-0 space-y-4 break-words px-5 lg:px-0 lg:pt-2">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-navy">{item.title}</h1>
          <p className="text-lg font-bold text-navy">{listingLabel(item)}</p>
          <p className="text-ink/60">
            {formatCents(item.estimated_value_cents)} est. value
            {details.length > 0 && ` · ${details.join(" · ")}`}
          </p>
          <p className="text-sm text-ink/60">
            Posted by {isMine ? "you" : (owner?.display_name ?? "a student")}
          </p>
        </div>

        {item.description && <p className="whitespace-pre-line">{item.description}</p>}

        {item.style_tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {item.style_tags.map((tag) => (
              <span key={tag} className="rounded-full bg-pale px-3 py-1 text-sm text-navy">
                {tag}
              </span>
            ))}
          </div>
        )}

        {isMine ? (
          <p className="rounded-2xl bg-surface shadow-soft p-4 text-sm text-ink/70">
            This is your item. Status: <span className="font-medium text-ink">{item.status}</span>
          </p>
        ) : item.status === "available" ? (
          <div className="space-y-2">
            {canSwap && (
              <Link
                href={`/item/${item.id}/request?type=swap`}
                className="block rounded-full bg-navy px-6 py-3.5 text-center font-semibold text-white"
              >
                Request swap
              </Link>
            )}
            {canBuy && item.price_cents && (
              <Link
                href={`/item/${item.id}/request?type=buy`}
                className={`block rounded-full px-6 py-3.5 text-center font-semibold ${
                  canSwap ? "border border-navy bg-surface text-navy" : "bg-navy text-white"
                }`}
              >
                Buy for {formatCents(item.price_cents)}
              </Link>
            )}
          </div>
        ) : (
          <p className="rounded-2xl bg-surface shadow-soft p-4 text-sm text-ink/70">
            This item is {item.status}, so it can&apos;t be requested right now.
          </p>
        )}

        <Link href="/feed" className="block text-center text-sm text-navy">
          Back to feed
        </Link>
      </section>
    </main>
  );
}
