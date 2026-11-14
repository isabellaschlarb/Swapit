import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;

  return (
    <main className="flex flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-primary">Sign in</h1>
        <p className="text-ink/70">
          Use your school email. We&apos;ll send you a link, no password needed.
        </p>
      </div>

      {error && (
        <p className="rounded-2xl bg-accent/40 p-4 text-sm">
          That sign-in link didn&apos;t work (links expire after a while). Request a new one below.
        </p>
      )}

      <LoginForm />
    </main>
  );
}
