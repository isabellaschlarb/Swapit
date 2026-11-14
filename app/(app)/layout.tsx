import { redirect } from "next/navigation";
import { TabBar } from "@/components/TabBar";
import { getMyProfile } from "@/lib/supabase/server";

// Wraps every main page (feed, post, item, swaps, profile) with the bottom
// tab bar. The (app) folder name in parentheses does NOT show up in the URL.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  // Haven't finished onboarding yet? Send them there first.
  if (!profile.display_name) redirect("/onboarding");

  return (
    <>
      {/* Bottom padding so content never hides behind the tab bar */}
      <div className="flex-1 pb-28">{children}</div>
      <TabBar />
    </>
  );
}
