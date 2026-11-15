import type { Item } from "@/lib/types";

// 2000 → "$20". 2050 → "$20.50". Money is stored in cents to avoid rounding bugs.
export function formatCents(cents: number) {
  const dollars = cents / 100;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(dollars) ? 0 : 2,
  });
}

// "20" or "20.50" (what a user types) → 2000 or 2050 cents.
export function dollarsToCents(input: string) {
  const value = Number.parseFloat(input);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 100);
}

// Short label for how an item can be traded:
//   swap only → "Swap only"   sell only → "$35"   swap or sell → "Swap or $35"
export function listingLabel(item: Pick<Item, "listing_type" | "price_cents">) {
  const price = item.price_cents ? formatCents(item.price_cents) : "";
  if (item.listing_type === "sell") return price;
  if (item.listing_type === "swap_or_sell") return `Swap or ${price}`;
  return "Swap only";
}

// "M" → "Size M", but "One size" stays "One size".
export function sizeLabel(size: string | null) {
  if (!size) return null;
  return size === "One size" ? size : `Size ${size}`;
}

// Meetup time in the school's timezone, e.g. "Sat, Nov 15 · 3:00 PM".
// (Pages render on the server, which may be in another timezone, so we
// always pass the campus timezone explicitly.)
export function formatMeetupTime(iso: string, timeZone: string) {
  const date = new Date(iso);
  const day = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone });
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });
  return `${day} · ${time}`;
}

// Chat timestamps in the campus timezone: "3:04 PM" if today, else "Nov 12".
// (Always pass the timezone so the server and the phone show the same thing.)
export function formatChatTime(iso: string, timeZone: string, now = new Date()) {
  const date = new Date(iso);
  const day = (d: Date) => d.toLocaleDateString("en-US", { timeZone });
  if (day(date) === day(now)) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone });
}
