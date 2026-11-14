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
