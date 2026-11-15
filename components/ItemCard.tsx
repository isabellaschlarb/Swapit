import Image from "next/image";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { HeartButton } from "@/components/HeartButton";
import { listingLabel, sizeLabel } from "@/lib/format";
import type { Item } from "@/lib/types";

export type ItemOwner = { display_name: string | null; avatar_url: string | null };

// One white card in an item grid: photo (with heart), title,
// "Size M · Swap or $35", and optionally the owner's avatar + name.
export function ItemCard({ item, owner }: { item: Item; owner?: ItemOwner | null }) {
  const photo = item.photo_urls[0];

  return (
    <div className="relative rounded-2xl bg-surface p-2 shadow-soft">
      <Link href={`/item/${item.id}`} className="block space-y-2">
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-pale/60">
          {photo && (
            <Image
              src={photo}
              alt={item.title}
              fill
              sizes="(max-width: 448px) 50vw, 224px"
              className="object-cover"
            />
          )}
          {item.status !== "available" && (
            <span className="absolute left-2 top-2 rounded-full bg-surface/90 px-2 py-0.5 text-xs">
              {item.status}
            </span>
          )}
        </div>
        <div className="px-1">
          <p className="truncate text-sm font-bold text-navy">{item.title}</p>
          <p className="truncate text-xs text-ink/60">
            {[sizeLabel(item.size), listingLabel(item)].filter(Boolean).join(" · ")}
          </p>
        </div>
      </Link>

      {owner && (
        <Link href={`/people/${item.owner_id}`} className="mt-2 flex items-center gap-1.5 px-1 pb-1 text-xs text-ink/70">
          <Avatar name={owner.display_name} url={owner.avatar_url} />
          <span className="truncate">{owner.display_name ?? "student"}</span>
        </Link>
      )}

      {/* Outside the link so tapping the heart doesn't open the item */}
      <HeartButton className="absolute right-4 top-4" />
    </div>
  );
}

// A 2-column grid of ItemCards, with a friendly message when empty.
export function ItemGrid({
  items,
  emptyText,
}: {
  items: (Item & { owner?: ItemOwner | null })[];
  emptyText: string;
}) {
  if (items.length === 0) {
    return <p className="rounded-2xl bg-surface p-6 text-center text-ink/60 shadow-soft">{emptyText}</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} owner={item.owner} />
      ))}
    </div>
  );
}
