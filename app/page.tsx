import Link from "next/link";
import { Blobs } from "@/components/Blobs";
import { AppIcon } from "@/components/Logo";

// Welcome screen. Public, anyone can see it.
// "Get Started" and "Log In" both go to /login: the same email link works
// for new and returning students.
export default function Welcome() {
  return (
    <main className="relative flex flex-1 flex-col px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-16">
      <Blobs />

      <div className="relative flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <AppIcon size={112} className="rounded-[26px] shadow-lift" />
        <h1 className="text-5xl font-extrabold tracking-tight text-navy">Swapit</h1>
        <p className="text-lg leading-snug text-ink/70">
          Your campus closet,
          <br />
          just a swap away.
        </p>
      </div>

      <div className="relative space-y-3 pt-10">
        <Link
          href="/login"
          className="block rounded-full bg-navy px-6 py-3.5 text-center font-semibold text-white"
        >
          Get Started
        </Link>
        <Link
          href="/login"
          className="block rounded-full border border-navy bg-surface px-6 py-3.5 text-center font-semibold text-navy"
        >
          Log In
        </Link>
      </div>

      <ul className="relative mt-8 grid grid-cols-3 divide-x divide-ink/10 text-center text-xs text-ink/70">
        <Badge label="Student Verified" icon="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3zM9 12l2 2 4-4" />
        <Badge label="Safe" icon="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6zM12 15v2" />
        <Badge label="Local" icon="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
      </ul>
    </main>
  );
}

function Badge({ label, icon }: { label: string; icon: string }) {
  return (
    <li className="flex flex-col items-center gap-1.5 px-2">
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 text-navy"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d={icon} />
      </svg>
      {label}
    </li>
  );
}
