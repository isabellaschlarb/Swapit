"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PHOTO_LIMIT } from "@/lib/profile-input";

export function ProfileEditor({ name, bio }: { name: string | null; bio: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form);
    const file = body.get("photo");
    setError(""); setMessage("");
    if (file instanceof File && file.size && (file.size > PHOTO_LIMIT || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      setError("Choose a JPEG, PNG, or WebP photo up to 5 MB."); return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/profile", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "Couldn't save. Reload before retrying."); return; }
      const photo = form.elements.namedItem("photo") as HTMLInputElement;
      const remove = form.elements.namedItem("remove_photo") as HTMLInputElement;
      photo.value = ""; remove.checked = false;
      setMessage("Profile saved."); router.refresh();
    } catch { setError("Couldn't confirm the save. Reload your profile before retrying; your form values have been kept."); }
    finally { setBusy(false); }
  }
  return (
    <details className="rounded-2xl bg-surface p-4 shadow-soft">
      <summary className="cursor-pointer font-semibold text-navy">Edit my profile</summary>
      <form onSubmit={save} method="post" action="/api/profile" encType="multipart/form-data" className="mt-4 space-y-4">
        <fieldset disabled={busy} className="min-w-0 space-y-4">
          <label className="block space-y-1 text-sm"><span>Display name</span><input name="display_name" required minLength={2} maxLength={40} defaultValue={name ?? ""} autoComplete="nickname" className="w-full rounded-xl border border-ink/15 bg-cloud p-3" /></label>
          <label className="block space-y-1 text-sm"><span>Short bio (300 characters)</span><textarea name="bio" maxLength={300} rows={3} defaultValue={bio ?? ""} className="w-full rounded-xl border border-ink/15 bg-cloud p-3" /></label>
          <label className="block space-y-1 text-sm"><span>Profile picture (JPEG, PNG, or WebP, up to 5 MB)</span><input name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm" /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="remove_photo" />Remove my profile picture</label>
          <p className="text-xs text-ink/60">Your name, photo, bio, and style tags are visible to students at your school. Keep contact and private details out of your bio. Your verified email and school cannot be edited here.</p>
          <button type="submit" className="w-full rounded-full bg-navy px-4 py-3 font-semibold text-white disabled:opacity-60">{busy ? "Saving…" : "Save profile"}</button>
        </fieldset>
        {error && <p role="alert" className="rounded-xl bg-pale p-3 text-sm">{error}</p>}
        <p role="status" className="text-sm text-ink/70">{message}</p>
      </form>
    </details>
  );
}
