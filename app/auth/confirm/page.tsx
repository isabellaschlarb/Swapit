import type { Metadata } from "next";
import Link from "next/link";
import { Blobs } from "@/components/Blobs";
import { AppIcon } from "@/components/Logo";
import { SubmitButton } from "@/components/SubmitButton";
import { confirmSignIn } from "./actions";

// The sign-in email links here.
//
// Why a button instead of signing in right away: school email systems
// (Cal Poly uses Microsoft 365 "Safe Links") open every link in an email to
// scan it for viruses, before the student ever sees it. If simply opening
// this page signed you in, the scanner would use up the one-time link and
// the student would get "link expired". Scanners open pages but don't tap
// buttons, so the link is only used when a real person taps.
//
// So: this page must NOT verify anything when it loads. Only the button does.

export const metadata: Metadata = {
  title: "Sign in · Swapit",
  robots: { index: false, follow: false },
  // Don't send the link's token to anyone else in the Referer header.
  referrer: "no-referrer",
};

export default async function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const tokenHash = one(params.token_hash);
  const type = one(params.type);
  const code = one(params.code);
  const hasLink = Boolean((tokenHash && type) || code);

  return (
    <main className="relative flex flex-1 flex-col px-6 pb-10 pt-16">
      <Blobs />

      <div className="relative flex flex-1 flex-col justify-center gap-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <AppIcon size={72} className="rounded-[18px] shadow-lift" />
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-navy">
              {hasLink ? "Almost there" : "Link incomplete"}
            </h1>
            <p className="text-ink/70">
              {hasLink
                ? "Tap the button to finish signing in to Swapit."
                : "This sign-in link is missing a piece. Ask for a new code."}
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-surface p-5 shadow-soft">
          {hasLink ? (
            <form action={confirmSignIn}>
              <input type="hidden" name="token_hash" value={tokenHash} />
              <input type="hidden" name="type" value={type} />
              <input type="hidden" name="code" value={code} />
              <SubmitButton pendingText="Signing in…">Tap to sign in</SubmitButton>
            </form>
          ) : (
            <Link
              href="/login"
              className="block rounded-full bg-navy px-6 py-3.5 text-center font-semibold text-white"
            >
              Get a new code
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
