import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { PostItemForm } from "@/components/PostItemForm";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function PostPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main>
      <PageHeader title="Post an item" subtitle="Snap a few photos and list it for a swap." />
      <section className="px-5">
        <PostItemForm userId={user.id} />
      </section>
    </main>
  );
}
