import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { photoBytes, type profileFields } from "@/lib/profile-input";

export type EditableProfile = {
  id: string; school_id: string; display_name: string | null; bio: string | null; avatar_path: string | null;
};

export async function saveProfile(client: SupabaseClient, previous: EditableProfile, input: ReturnType<typeof profileFields>) {
  const storage = client.storage.from("profile-photos");
  let uploaded: string | null = null;
  let path = input.remove ? null : previous.avatar_path;
  // Validate all fields and bytes before starting any upload or database write.
  const photo = input.file ? await photoBytes(input.file) : null;
  if (photo) {
    uploaded = `${previous.id}/${randomUUID()}.${photo.extension}`;
    let failed = true;
    try { failed = Boolean((await storage.upload(uploaded, photo.bytes, { contentType: photo.contentType, upsert: false })).error); }
    catch { /* An upload response can fail after storage receives the bytes. */ }
    if (failed) {
      // The generated object is not referenced by a profile yet. Storage policy
      // additionally forbids deleting an object that became active meanwhile.
      await storage.remove([uploaded]).catch(() => {});
      return { ok: false, message: "Your photo couldn't upload. Your previous photo is unchanged. Try again." };
    }
    path = uploaded;
  }
  const values = {
    display_name: input.display_name, bio: input.bio, avatar_path: path,
    ...(photo || input.remove ? { avatar_url: null } : {}),
  };
  let update = client.from("profiles").update(values).eq("id", previous.id).eq("school_id", previous.school_id);
  // Compare-and-swap prevents concurrent photo replacements from overwriting
  // each other and makes cleanup safe. Names/bios are always saved with the form.
  update = previous.avatar_path === null ? update.is("avatar_path", null) : update.eq("avatar_path", previous.avatar_path);
  let confirmed = false;
  try {
    const result = await update.select("id").maybeSingle();
    confirmed = !result.error && Boolean(result.data);
  } catch { /* The response can fail even after the database committed. */ }
  if (!confirmed) {
    try {
      const verification = await client.from("profiles").select("display_name, bio, avatar_path, avatar_url").eq("id", previous.id).eq("school_id", previous.school_id).maybeSingle();
      confirmed = !verification.error && verification.data !== null &&
        verification.data.avatar_path === path && verification.data.display_name === values.display_name && verification.data.bio === values.bio &&
        (!(photo || input.remove) || verification.data.avatar_url === null);
      if (!confirmed && !verification.error && verification.data && uploaded && verification.data.avatar_path !== uploaded) {
        await storage.remove([uploaded]).catch(() => {});
      }
    } catch { /* Keep both objects if the current reference cannot be verified. */ }
  }
  if (!confirmed) return { ok: false, message: "We couldn't confirm your save. Reload your profile before retrying. Your previous photo has been kept." };
  if (previous.avatar_path && previous.avatar_path !== path) {
    // A cleanup failure doesn't undo a successful save. The active-photo delete
    // policy protects references changed by another request after this save.
    await storage.remove([previous.avatar_path]).catch(() => {});
  }
  return { ok: true };
}
