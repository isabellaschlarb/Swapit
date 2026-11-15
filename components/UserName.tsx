// A person's name with the small "Verified student" shield next to it.
// Everyone on Swapit signed in with a school email, so everyone gets it.

export function VerifiedBadge({ size = 14 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className="shrink-0"
      role="img"
      aria-label="Verified student"
    >
      <title>Verified student</title>
      <path d="M12 2.5 4.5 5.5v5.7c0 4.6 3.1 8.7 7.5 10.3 4.4-1.6 7.5-5.7 7.5-10.3V5.5z" className="fill-sky" />
      <path d="m8.5 12 2.4 2.4 4.6-4.8" fill="none" className="stroke-navy" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function UserName({
  name,
  className = "",
  badgeSize = 14,
}: {
  name: string | null;
  className?: string;
  badgeSize?: number;
}) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-1 ${className}`}>
      <span className="truncate">{name ?? "student"}</span>
      <VerifiedBadge size={badgeSize} />
    </span>
  );
}
