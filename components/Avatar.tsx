import Image from "next/image";

// A small round profile picture, or the first letter of their name on pale blue.
export function Avatar({
  name,
  url,
  size = 20,
}: {
  name: string | null;
  url?: string | null;
  size?: number;
}) {
  if (url) {
    return (
      <Image src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      className="flex shrink-0 items-center justify-center rounded-full bg-pale font-bold text-navy"
    >
      {(name ?? "?").charAt(0).toUpperCase()}
    </span>
  );
}
