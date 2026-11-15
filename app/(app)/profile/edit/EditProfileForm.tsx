"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import { Avatar } from "@/components/Avatar";
import { StyleTagPicker } from "@/components/StyleTagPicker";
import { SubmitButton } from "@/components/SubmitButton";
import { randomFileName, shrinkImage } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { saveProfile, type EditProfileState } from "./actions";

const inputClass =
  "w-full rounded-2xl border border-ink/10 bg-surface px-4 py-3 outline-none focus:border-sky";

// Edit my profile. Picking a photo uploads it right away (shrunk to a
// small square-ish JPEG) to avatars/<my-id>/...; "Save" stores the link.
export function EditProfileForm({
  profile,
  spots,
}: {
  profile: Pick<Profile, "id" | "display_name" | "avatar_url" | "bio" | "style_tags" | "preferred_meetup_spot_id">;
  spots: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState<EditProfileState, FormData>(saveProfile, {});
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [tags, setTags] = useState(profile.style_tags);
  const [name, setName] = useState(profile.display_name ?? "");

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setPhotoError(null);
    try {
      const image = await shrinkImage(file, 512, 0.85);
      const supabase = createClient();
      const path = `${profile.id}/${randomFileName()}`;
      const { error } = await supabase.storage.from("avatars").upload(path, image, { contentType: "image/jpeg" });
      if (error) throw error;
      setAvatarUrl(supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl);
    } catch (err) {
      console.error(err);
      setPhotoError("Couldn't upload that photo. Try a JPG or PNG.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="avatar_url" value={avatarUrl} />

      <div className="flex items-center gap-4">
        <Avatar name={name} url={avatarUrl || null} size={80} />
        <div className="space-y-2">
          <label className="inline-block cursor-pointer rounded-full border border-navy px-4 py-2 text-sm font-semibold text-navy">
            {uploading ? "Uploading…" : avatarUrl ? "Change photo" : "Add a photo"}
            <input type="file" accept="image/*" onChange={uploadPhoto} disabled={uploading} className="sr-only" />
          </label>
          {avatarUrl && (
            <button type="button" onClick={() => setAvatarUrl("")} className="block text-sm text-ink/60 underline">
              Remove photo
            </button>
          )}
          {photoError && <p className="text-sm">{photoError}</p>}
        </div>
      </div>

      <label className="block space-y-2">
        <span className="text-sm text-ink/70">Name</span>
        <input name="display_name" required minLength={2} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </label>

      <label className="block space-y-2">
        <span className="text-sm text-ink/70">Bio</span>
        <textarea name="bio" rows={3} maxLength={300} defaultValue={profile.bio ?? ""} placeholder="Sizes you wear, what you're hunting for…" className={inputClass} />
      </label>

      <div className="space-y-3">
        <p className="text-sm text-ink/70">Your style</p>
        <StyleTagPicker selected={tags} onChange={setTags} />
      </div>

      <label className="block space-y-2">
        <span className="text-sm text-ink/70">Where do you like to meet?</span>
        <select name="preferred_meetup_spot_id" defaultValue={profile.preferred_meetup_spot_id ?? ""} className={inputClass}>
          <option value="">No preference</option>
          {spots.map((spot) => (
            <option key={spot.id} value={spot.id}>
              {spot.name}
            </option>
          ))}
        </select>
        <span className="block text-xs text-ink/60">Shown on your item cards so people know where you usually swap.</span>
      </label>

      {state.error && <p className="rounded-2xl bg-pale p-4 text-sm">{state.error}</p>}

      <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
    </form>
  );
}
