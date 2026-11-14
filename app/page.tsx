import Link from "next/link";

// Landing page — public, anyone can see it.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight text-primary">Swapit</h1>
        <p className="text-lg text-ink/70">
          Trade clothes with students on your campus. Meet up, swap, done.
        </p>
      </div>
      <Link
        href="/login"
        className="rounded-full bg-primary px-6 py-3 text-center font-medium text-cream"
      >
        Get started
      </Link>
    </main>
  );
}
