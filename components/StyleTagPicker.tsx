import { STYLE_TAGS } from "@/lib/constants";

// Tappable style tag "pills". Each one is a checkbox under the hood, so the
// selected tags arrive in the form data as `style_tags` — no extra code needed.
export function StyleTagPicker({ selected = [] }: { selected?: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {STYLE_TAGS.map((tag) => (
        <label key={tag} className="cursor-pointer">
          <input
            type="checkbox"
            name="style_tags"
            value={tag}
            defaultChecked={selected.includes(tag)}
            className="peer sr-only"
          />
          <span className="block rounded-full border border-ink/15 px-4 py-2 text-sm peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-primary">
            {tag}
          </span>
        </label>
      ))}
    </div>
  );
}
