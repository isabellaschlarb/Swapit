export const PHOTO_LIMIT = 5 * 1024 * 1024;
export const PROFILE_BODY_LIMIT = PHOTO_LIMIT + 64 * 1024;

export function profileFields(form: FormData) {
  const displayName = form.get("display_name");
  const bio = form.get("bio");
  if (typeof displayName !== "string" || displayName.trim().length < 2 || displayName.trim().length > 40) {
    throw new Error("Use a display name between 2 and 40 characters.");
  }
  if (typeof bio !== "string" || bio.length > 300) throw new Error("Keep your bio to 300 characters.");
  const photo = form.get("photo");
  if (photo !== null && typeof photo === "string") throw new Error("Choose an image file.");
  const file = photo && photo.size > 0 ? photo : null;
  const remove = form.get("remove_photo") === "on";
  if (file && remove) throw new Error("Choose a new photo or remove the current one, not both.");
  return { display_name: displayName.trim(), bio: bio.trim(), file, remove };
}

export async function photoBytes(file: File) {
  const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const extension = Object.hasOwn(extensions, file.type) ? extensions[file.type] : undefined;
  if (!extension || file.size > PHOTO_LIMIT) throw new Error("Choose a JPEG, PNG, or WebP photo up to 5 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const prefix = (...values: number[]) => values.every((value, i) => bytes[i] === value);
  const valid = file.type === "image/jpeg" ? prefix(0xff, 0xd8, 0xff)
    : file.type === "image/png" ? prefix(137, 80, 78, 71, 13, 10, 26, 10)
      : prefix(82, 73, 70, 70) && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80;
  if (!valid) throw new Error("That file doesn't match its image type. Choose another photo.");
  return { bytes, extension, contentType: file.type };
}

export function avatarUrl(profile: { id: string; avatar_path?: string | null; avatar_url?: string | null }) {
  if (profile.avatar_path) return `/api/avatars/${profile.id}?v=${encodeURIComponent(profile.avatar_path.split("/")[1])}`;
  // Preserve existing supported public photo URLs; never render arbitrary schemes.
  try {
    const url = new URL(profile.avatar_url ?? "");
    return url.protocol === "https:" && !url.username && !url.password && url.hostname.endsWith(".supabase.co") ? url.href : null;
  } catch { return null; }
}
