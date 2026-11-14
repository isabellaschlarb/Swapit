import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  // Already onboarded → skip.
  if (profile?.display_name) redirect("/feed");

  return (
    <main className="flex flex-1 flex-col gap-8 px-6 py-16">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-navy">Welcome to Swapit</h1>
        <p className="text-ink/70">Two quick things and you&apos;re in.</p>
      </div>
      <OnboardingForm />
    </main>
  );
}
