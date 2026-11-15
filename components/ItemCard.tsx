import Image from "next/image";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { HeartButton } from "@/components/HeartButton";
import { listingLabel, sizeLabel } from "@/lib/format";
import type { Item } from "@/lib/types";

export type ItemOwner = { display_name: string | null; avatar_url: string | null };

// One white card in an item grid: photo (with heart), title,
// "Size M · Swap or $35", and optionally the owner's avatar + name.
// `match` shows the "Matches your style" badge (For You feed).
export function ItemCard({
  item,
  owner,
  liked = false,
  match = false,
  showHeart = true,
}: {
  item: Item;
  owner?: ItemOwner | null;
  liked?: boolean;
  match?: boolean;
  showHeart?: boolean;
}) {
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
              sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1535px) 25vw, 20vw"
              className="object-cover"
            />
          )}
          {item.status !== "available" ? (
            <span className="absolute left-2 top-2 rounded-full bg-surface/90 px-2 py-0.5 text-xs">
              {item.status}
            </span>
          ) : (
            match && (
              <span className="absolute bottom-2 left-2 rounded-full bg-navy px-2.5 py-1 text-[11px] font-semibold text-white">
                ✨ Matches your style
              </span>
            )
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
        <div className="mt-2 flex items-center gap-1.5 px-1 pb-1 text-xs text-ink/70">
          <Avatar name={owner.display_name} url={owner.avatar_url} />
          <span className="truncate">{owner.display_name ?? "student"}</span>
        </div>
      )}

      {/* Outside the link so tapping the heart doesn't open the item */}
      {showHeart && <HeartButton itemId={item.id} initialLiked={liked} className="absolute right-4 top-4" />}
    </div>
  );
}

// A 2-column grid of ItemCards, with a friendly message when empty.
export function ItemGrid({
  items,
  emptyText,
  likedIds,
  matchIds,
  myId,
}: {
  items: (Item & { owner?: ItemOwner | null })[];
  emptyText: string;
  likedIds?: Set<string>;
  matchIds?: Set<string>;
  myId?: string; // no heart on my own items
}) {
  if (items.length === 0) {
    return <p className="rounded-2xl bg-surface p-6 text-center text-ink/60 shadow-soft">{emptyText}</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 lg:gap-5">
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          owner={item.owner}
          liked={likedIds?.has(item.id)}
          match={matchIds?.has(item.id)}
          showHeart={item.owner_id !== myId}
        />
      ))}
    </div>
  );
}
