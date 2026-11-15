"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { StyleTagPicker } from "@/components/StyleTagPicker";
import {
  CATEGORIES,
  CONDITIONS,
  LISTING_TYPES,
  MAX_PHOTOS,
  PHOTO_BUCKET,
  SIZES,
} from "@/lib/constants";
import { dollarsToCents } from "@/lib/format";
import { randomFileName, shrinkImage } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";
import type { ListingType } from "@/lib/types";

type Photo = { file: File; preview: string };

const inputClass =
  "w-full rounded-2xl border border-ink/10 bg-surface px-4 py-3 outline-none focus:border-sky";

// The "post an item" form. It runs in the browser so photos can upload
// straight from the phone to Supabase Storage:
//   1. shrink each photo  2. upload it to item-photos/<my-user-id>/...
//   3. save the item row with the photo links  4. go to the new item's page
export function PostItemForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionMessage, setSuggestionMessage] = useState<string | null>(null);
  const [listingType, setListingType] = useState<ListingType>("swap");
  const canSell = listingType !== "swap";

  function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const room = MAX_PHOTOS - photos.length;
    const added = files.slice(0, room).map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setPhotos([...photos, ...added]);
    event.target.value = ""; // lets you pick the same photo again after removing it
  }

  function removePhoto(index: number) {
    URL.revokeObjectURL(photos[index].preview);
    setPhotos(photos.filter((_, i) => i !== index));
  }

  async function suggestTags(formElement: HTMLFormElement | null) {
    if (!formElement) return;
    const form = new FormData(formElement);
    const title = String(form.get("title") ?? "").trim();
    if (!title) {
      setSuggestionMessage("Add a title first to get suggestions.");
      return;
    }
    setSuggesting(true);
    setSuggestionMessage(null);
    setSuggestions([]);
    try {
      const response = await fetch("/api/style-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: form.get("description"),
          category: form.get("category"),
          size: form.get("size"),
          condition: form.get("condition"),
          selectedTags: tags,
        }),
      });
      if (!response.ok) throw new Error();
      const data: { tags: string[] } = await response.json();
      setSuggestions(data.tags);
      if (data.tags.length === 0) setSuggestionMessage("No new suggestions this time. You can still pick tags below.");
    } catch {
      setSuggestionMessage("Suggestions are unavailable right now. You can still choose tags and post your item.");
    } finally {
      setSuggesting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    if (!title) return setError("Give your item a title.");
    if (photos.length === 0) return setError("Add at least one photo.");
    const priceCents = canSell ? dollarsToCents(String(form.get("price") ?? "")) : null;
    if (canSell && !priceCents) return setError("Add an asking price.");

    setSaving(true);
    const supabase = createClient();

    try {
      // Steps 1 + 2: shrink and upload each photo.
      const photoUrls: string[] = [];
      for (const photo of photos) {
        const image = await shrinkImage(photo.file);
        const path = `${userId}/${randomFileName()}`;
        const { error: uploadError } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(path, image, { contentType: "image/jpeg" });
        if (uploadError) throw uploadError;
        photoUrls.push(supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl);
      }

      // Step 3: save the item. (school_id is filled in by the database.)
      const { data: item, error: insertError } = await supabase
        .from("items")
        .insert({
          owner_id: userId,
          title,
          description: String(form.get("description") ?? "").trim() || null,
          category: form.get("category") || null,
          size: form.get("size") || null,
          condition: form.get("condition") || null,
          estimated_value_cents: dollarsToCents(String(form.get("value") ?? "")),
          style_tags: form.getAll("style_tags").map(String),
          photo_urls: photoUrls,
          listing_type: listingType,
          price_cents: priceCents,
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      // Step 4: show the new item.
      router.push(`/item/${item.id}`);
    } catch (err) {
      console.error(err);
      setError("Something went wrong saving your item. Check your photos (JPG or PNG) and try again.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Photos */}
      <div className="space-y-2">
        <p className="text-sm text-ink/70">
          Photos ({photos.length}/{MAX_PHOTOS})
        </p>
        <div className="grid grid-cols-4 gap-2">
          {photos.map((photo, i) => (
            <div key={photo.preview} className="relative aspect-square overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview, not a hosted image */}
              <img src={photo.preview} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                aria-label="Remove photo"
                className="absolute right-1 top-1 h-6 w-6 rounded-full bg-white/90 text-sm leading-6"
              >
                ×
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label className="flex aspect-square cursor-pointer items-center justify-center rounded-xl border border-dashed border-ink/20 text-2xl text-ink/40">
              +
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={addPhotos}
                className="sr-only"
              />
            </label>
          )}
        </div>
      </div>

      <label className="block space-y-2">
        <span className="text-sm text-ink/70">Title</span>
        <input name="title" required maxLength={100} placeholder="e.g. Vintage Patagonia fleece" className={inputClass} />
      </label>

      <label className="block space-y-2">
        <span className="text-sm text-ink/70">Description</span>
        <textarea name="description" rows={3} placeholder="Fit, flaws, why you love it…" className={inputClass} />
      </label>

      {/* How the owner wants to trade it */}
      <div className="space-y-2">
        <p className="text-sm text-ink/70">How do you want to trade it?</p>
        <div className="grid grid-cols-3 gap-2">
          {LISTING_TYPES.map((type) => (
            <label key={type.value} className="cursor-pointer">
              <input
                type="radio"
                name="listing_type"
                value={type.value}
                checked={listingType === type.value}
                onChange={() => setListingType(type.value)}
                className="peer sr-only"
              />
              <span className="block rounded-full border border-ink/15 px-2 py-2 text-center text-sm peer-checked:border-navy peer-checked:bg-navy peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-sky">
                {type.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {canSell && (
        <label className="block space-y-2">
          <span className="text-sm text-ink/70">Asking price ($)</span>
          <input
            name="price"
            type="number"
            inputMode="decimal"
            min="1"
            step="1"
            required
            placeholder="20"
            className={inputClass}
          />
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-2">
          <span className="text-sm text-ink/70">Category</span>
          <select name="category" defaultValue="" className={inputClass}>
            <option value="">Choose</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-2">
          <span className="text-sm text-ink/70">Size</span>
          <select name="size" defaultValue="" className={inputClass}>
            <option value="">Choose</option>
            {SIZES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-2">
          <span className="text-sm text-ink/70">Condition</span>
          <select name="condition" defaultValue="" className={inputClass}>
            <option value="">Choose</option>
            {CONDITIONS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-2">
          <span className="text-sm text-ink/70">Est. value ($)</span>
          <input name="value" type="number" inputMode="decimal" min="0" step="1" placeholder="20" className={inputClass} />
        </label>
      </div>

      <div className="space-y-3">
        <p className="text-sm text-ink/70">Style tags</p>
        <button type="button" onClick={(event) => suggestTags(event.currentTarget.form)} disabled={suggesting} className="rounded-full border border-primary px-4 py-2 text-sm text-primary disabled:opacity-60">
          {suggesting ? "Finding suggestions…" : "Suggest style tags"}
        </button>
        <p className="text-sm text-ink/70" role="status">{suggesting ? "Finding style tags…" : suggestionMessage}</p>
        {suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-ink/70">Tap a suggestion to add it:</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.filter((tag) => !tags.includes(tag)).map((tag) => (
                <button key={tag} type="button" onClick={() => { setTags([...tags, tag]); setSuggestions(suggestions.filter((item) => item !== tag)); }} className="rounded-full border border-primary px-4 py-2 text-sm text-primary">+ {tag}</button>
              ))}
            </div>
          </div>
        )}
        <StyleTagPicker selected={tags} onChange={setTags} />
      </div>

      {error && <p className="rounded-2xl bg-pale p-4 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-full bg-navy px-6 py-3 font-medium text-white disabled:opacity-60"
      >
        {saving ? "Posting…" : "Post item"}
      </button>
    </form>
  );
}
