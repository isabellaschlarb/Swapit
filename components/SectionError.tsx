"use client";
export default function SectionError({ reset }: { reset: () => void }) {
  return <main className="space-y-3 px-5 py-8"><h1 className="text-xl font-bold text-navy">We couldn&apos;t load this page</h1><p>Your connection or the service may be unavailable.</p><button onClick={reset} className="rounded-full bg-navy px-4 py-3 text-white">Try again</button></main>;
}
