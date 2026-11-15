import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getMyProfile } from "@/lib/supabase/server";
import { EditProfileForm } from "./EditProfileForm";

export default async function EditProfilePage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: spots } = await supabase.from("meetup_spots").select("id, name").order("name");

  return (
    <main className="mx-auto w-full max-w-xl space-y-6 px-5 pt-6 lg:pt-10">
      <Link href="/profile" className="text-sm text-navy">
        ← Profile
      </Link>
      <h1 className="text-2xl font-extrabold tracking-tight text-navy">Edit profile</h1>
      <EditProfileForm profile={profile} spots={spots ?? []} />
    </main>
  );
}
