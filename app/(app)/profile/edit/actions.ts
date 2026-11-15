"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { STYLE_TAGS } from "@/lib/constants";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export type EditProfileState = { error?: string };

// Saves my profile. The avatar photo was already uploaded from the
// browser; here we just save its link. The database double-checks that
// the link points to MY folder in the avatars bucket and that the meetup
// spot is on my campus (0008_social.sql).
export async function saveProfile(_prev: EditProfileState, formData: FormData): Promise<EditProfileState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const displayName = String(formData.get("display_name") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const avatarUrl = String(formData.get("avatar_url") ?? "").trim();
  const spotId = String(formData.get("preferred_meetup_spot_id") ?? "");
  const styleTags = formData
    .getAll("style_tags")
    .map(String)
    .filter((tag) => (STYLE_TAGS as readonly string[]).includes(tag));

  if (displayName.length < 2 || displayName.length > 40) return { error: "Pick a name between 2 and 40 characters." };
  if (bio.length > 300) return { error: "Keep your bio under 300 characters." };
  if (styleTags.length === 0) return { error: "Pick at least one style." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      bio: bio || null,
      style_tags: styleTags,
      avatar_url: avatarUrl || null,
      preferred_meetup_spot_id: spotId || null,
    })
    .eq("id", user.id);

  if (error) {
    console.error(error);
    return { error: "Couldn't save. Please try again." };
  }

  revalidatePath("/", "layout");
  redirect("/profile");
}
