import Link from "next/link";
import { Blobs } from "@/components/Blobs";
import { AppIcon } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;

  return (
    <main className="relative flex flex-1 flex-col px-6 pb-10 pt-16">
      <Blobs />

      <div className="relative flex flex-1 flex-col justify-center gap-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <Link href="/" aria-label="Back to welcome">
            <AppIcon size={72} className="rounded-[18px] shadow-lift" />
          </Link>
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-navy">Sign in</h1>
            <p className="text-ink/70">
              Use your school email. We&apos;ll email you a 6-digit code, no password needed.
            </p>
          </div>
        </div>

        {error && (
          <p className="rounded-2xl bg-pale p-4 text-sm">
            That sign-in link didn&apos;t work. Each link works once and expires after an hour.
            Ask for a new code below.
          </p>
        )}

        <div className="rounded-2xl bg-surface p-5 shadow-soft">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
