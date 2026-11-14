import Image from "next/image";
import Link from "next/link";
import { formatCents } from "@/lib/format";
import type { Item } from "@/lib/types";

// One tile in an item grid: photo, title, size, and value.
export function ItemCard({ item }: { item: Item }) {
  const photo = item.photo_urls[0];

  return (
    <Link href={`/item/${item.id}`} className="block space-y-2">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-accent/30">
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
          <span className="absolute left-2 top-2 rounded-full bg-cream/90 px-2 py-0.5 text-xs">
            {item.status}
          </span>
        )}
      </div>
      <div className="px-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="text-xs text-ink/60">
          {[item.size, formatCents(item.estimated_value_cents)].filter(Boolean).join(" · ")}
        </p>
      </div>
    </Link>
  );
}

// A 2-column grid of ItemCards, with a friendly message when empty.
export function ItemGrid({ items, emptyText }: { items: Item[]; emptyText: string }) {
  if (items.length === 0) {
    return <p className="rounded-2xl bg-surface p-6 text-center text-ink/60">{emptyText}</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-5">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}
