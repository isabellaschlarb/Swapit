"use server";

import { redirect } from "next/navigation";
import { STYLE_TAGS } from "@/lib/constants";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export type OnboardingState = { error?: string };

export async function saveOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const displayName = String(formData.get("display_name") ?? "").trim();
  // Only keep tags from our preset list.
  const styleTags = formData
    .getAll("style_tags")
    .map(String)
    .filter((tag) => (STYLE_TAGS as readonly string[]).includes(tag));

  if (displayName.length < 2 || displayName.length > 40) {
    return { error: "Pick a name between 2 and 40 characters." };
  }
  if (styleTags.length === 0) {
    return { error: "Pick at least one style." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, style_tags: styleTags })
    .eq("id", user.id);

  if (error) return { error: "Couldn't save. Please try again." };

  redirect("/feed");
}
