import { Logo } from "@/components/Logo";

// Top of the feed: logo + "For You" heading.
// (Following / Trending tabs and filters were removed until they're built.)
export function FeedHeader() {
  return (
    <header className="space-y-4 px-5 pb-4 pt-6">
      <Logo />
      <h1 className="w-fit rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white">For You</h1>
    </header>
  );
}
