import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCents } from "@/lib/format";
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
    <main className="space-y-6">
      {/* Photos: swipe sideways if there's more than one */}
      <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto">
        {item.photo_urls.map((url, i) => (
          <div key={url} className="relative aspect-[4/5] w-full shrink-0 snap-center bg-accent/30">
            <Image
              src={url}
              alt={`${item.title} photo ${i + 1}`}
              fill
              sizes="(max-width: 448px) 100vw, 448px"
              className="object-cover"
              priority={i === 0}
            />
          </div>
        ))}
      </div>

      <section className="space-y-4 px-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{item.title}</h1>
          {canBuy && item.price_cents ? (
            <p className="text-lg font-medium text-primary">
              {formatCents(item.price_cents)}
              {canSwap && <span className="font-normal text-ink/60"> · or swap</span>}
            </p>
          ) : (
            <p className="text-lg font-medium text-primary">Swap only</p>
          )}
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
              <span key={tag} className="rounded-full bg-accent/50 px-3 py-1 text-sm">
                {tag}
              </span>
            ))}
          </div>
        )}

        {isMine ? (
          <p className="rounded-2xl bg-surface p-4 text-sm text-ink/70">
            This is your item. Status: <span className="font-medium text-ink">{item.status}</span>
          </p>
        ) : item.status === "available" ? (
          <div className="space-y-2">
            {canSwap && (
              <Link
                href={`/item/${item.id}/request?type=swap`}
                className="block rounded-full bg-primary px-6 py-3 text-center font-medium text-cream"
              >
                Request swap
              </Link>
            )}
            {canBuy && item.price_cents && (
              <Link
                href={`/item/${item.id}/request?type=buy`}
                className={`block rounded-full px-6 py-3 text-center font-medium ${
                  canSwap ? "border border-primary text-primary" : "bg-primary text-cream"
                }`}
              >
                Buy for {formatCents(item.price_cents)}
              </Link>
            )}
          </div>
        ) : (
          <p className="rounded-2xl bg-surface p-4 text-sm text-ink/70">
            This item is {item.status}, so it can&apos;t be requested right now.
          </p>
        )}

        <Link href="/feed" className="block text-center text-sm text-primary">
          Back to feed
        </Link>
      </section>
    </main>
  );
}
