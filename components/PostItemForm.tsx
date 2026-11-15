"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { StyleTagPicker } from "@/components/StyleTagPicker";
import type { SnapResult } from "@/app/api/snap-to-list/route";
import {
  CATEGORIES,
  CONDITIONS,
  LISTING_TYPES,
  MAX_PHOTOS,
  PHOTO_BUCKET,
  SIZES,
} from "@/lib/constants";
import { dollarsToCents } from "@/lib/format";
import { blobToDataUrl, randomFileName, shrinkImage } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";
import type { ListingType } from "@/lib/types";

type Photo = { file: File; preview: string };
type AiState = "idle" | "working" | "done" | "failed";

const inputClass =
  "w-full rounded-2xl border border-ink/10 bg-surface px-4 py-3 outline-none focus:border-sky";

// The "post an item" form. It runs in the browser so photos can upload
// straight from the phone to Supabase Storage:
//   1. shrink each photo  2. upload it to item-photos/<my-user-id>/...
//   3. save the item row with the photo links  4. go to the new item's page
//
// Snap-to-list: when the first photo is added, a small copy goes to
// /api/snap-to-list and the AI's guesses fill in any EMPTY fields, marked
// "✨ Filled by AI". Everything stays editable. If the AI fails, the
// form works exactly as before.
export function PostItemForm({ userId }: { userId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [listingType, setListingType] = useState<ListingType>("swap");
  const [ai, setAi] = useState<AiState>("idle");
  const [aiFields, setAiFields] = useState<string[]>([]); // fields the AI filled (label shows ✨)
  const canSell = listingType !== "swap";

  function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const room = MAX_PHOTOS - photos.length;
    const added = files.slice(0, room).map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setPhotos([...photos, ...added]);
    event.target.value = ""; // lets you pick the same photo again after removing it

    // First photo in? Let the AI take a look.
    if (photos.length === 0 && added.length > 0 && ai === "idle") fillFromPhoto(added[0].file);
  }

  function removePhoto(index: number) {
    URL.revokeObjectURL(photos[index].preview);
    setPhotos(photos.filter((_, i) => i !== index));
  }

  async function fillFromPhoto(file: File) {
    setAi("working");
    try {
      const small = await shrinkImage(file, 768, 0.7); // ~100 KB is plenty for the AI
      const response = await fetch("/api/snap-to-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: await blobToDataUrl(small) }),
      });
      if (!response.ok) throw new Error(`AI returned ${response.status}`);
      const guess: SnapResult = await response.json();

      const form = formRef.current;
      if (!form) return;
      const filled: string[] = [];
      // Only fill fields the user hasn't typed in yet.
      const fill = (name: string, value: string) => {
        const field = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
        if (!field || !value || field.value) return;
        field.value = value;
        filled.push(name);
      };
      fill("title", guess.title);
      fill("description", guess.description);
      fill("category", guess.category);
      fill("size", guess.size);
      fill("condition", guess.condition);
      fill("color", guess.color);
      if (guess.estimated_value_dollars > 0) {
        fill("value", String(guess.estimated_value_dollars));
        fill("price", String(guess.estimated_value_dollars)); // only exists when selling
      }
      const newTags = guess.style_tags.filter((tag) => !tags.includes(tag));
      if (newTags.length > 0) {
        setTags((current) => [...current, ...newTags.filter((tag) => !current.includes(tag))]);
        filled.push("style_tags");
      }

      setAiFields(filled);
      setAi("done");
    } catch (err) {
      console.error(err);
      setAi("failed");
    }
  }

  // Once someone edits an AI-filled field, it's theirs: drop the ✨ label.
  function handleInput(event: FormEvent<HTMLFormElement>) {
    const name = (event.target as HTMLInputElement).name;
    if (aiFields.includes(name)) setAiFields(aiFields.filter((field) => field !== name));
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
          color: String(form.get("color") ?? "").trim() || null,
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

  // A field label, with "✨ Filled by AI" while the AI's guess is untouched.
  const label = (text: string, name: string) => (
    <span className="flex items-center justify-between gap-2 text-sm text-ink/70">
      {text}
      {aiFields.includes(name) && <span className="text-xs font-semibold text-navy">✨ Filled by AI</span>}
    </span>
  );

  return (
    <form ref={formRef} onSubmit={handleSubmit} onInput={handleInput} className="space-y-6">
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

        {/* Snap-to-list status */}
        <div role="status" className="text-sm">
          {ai === "idle" && photos.length === 0 && (
            <p className="text-ink/60">✨ Add a photo and AI will fill in the details for you.</p>
          )}
          {ai === "working" && <p className="rounded-2xl bg-pale px-4 py-3 text-navy">✨ Looking at your photo…</p>}
          {ai === "done" && (
            <p className="rounded-2xl bg-pale px-4 py-3 text-navy">
              ✨ Filled by AI. Check everything and change anything that&apos;s off.
            </p>
          )}
          {ai === "failed" && (
            <p className="rounded-2xl bg-pale px-4 py-3">
              Couldn&apos;t fill this in automatically. Add the details yourself; posting still works.
            </p>
          )}
        </div>
        {photos.length > 0 && (ai === "idle" || ai === "failed") && (
          <button
            type="button"
            onClick={() => fillFromPhoto(photos[0].file)}
            className="rounded-full border border-navy px-4 py-2 text-sm text-navy"
          >
            ✨ Fill from photo
          </button>
        )}
      </div>

      <label className="block space-y-2">
        {label("Title", "title")}
        <input name="title" required maxLength={100} placeholder="e.g. Vintage Patagonia fleece" className={inputClass} />
      </label>

      <label className="block space-y-2">
        {label("Description", "description")}
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
          {label("Asking price ($)", "price")}
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
          {label("Category", "category")}
          <select name="category" defaultValue="" className={inputClass}>
            <option value="">Choose</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-2">
          {label("Size", "size")}
          <select name="size" defaultValue="" className={inputClass}>
            <option value="">Choose</option>
            {SIZES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-2">
          {label("Condition", "condition")}
          <select name="condition" defaultValue="" className={inputClass}>
            <option value="">Choose</option>
            {CONDITIONS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-2">
          {label("Color", "color")}
          <input name="color" maxLength={40} placeholder="e.g. navy" className={inputClass} />
        </label>
        <label className="col-span-2 block space-y-2">
          {label("Est. value ($)", "value")}
          <input name="value" type="number" inputMode="decimal" min="0" step="1" placeholder="20" className={inputClass} />
        </label>
      </div>

      <div className="space-y-3">
        {label("Style tags", "style_tags")}
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
