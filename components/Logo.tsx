// The Swapit logo: a hanger with two swap arrows in a navy rounded square.
// Same drawing as app/icon.svg (the browser tab icon). Keep them in sync.

export function AppIcon({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Swapit"
    >
      <rect width="100" height="100" rx="23" fill="#0D1B3D" />
      <g fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M50 40 V35 C50 31 57 30 57 24 C57 19.5 53.5 16.5 49.5 16.5 C45.5 16.5 42.5 19.5 42.5 23" />
        <path d="M50 40 L82 62 C85.5 64.5 84 69 80 69 H20 C16 69 14.5 64.5 18 62 Z" />
      </g>
      <g fill="#91BDF8" stroke="#91BDF8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 58 Q18 44 33 39" fill="none" strokeWidth="6.5" />
        <path d="M43 35.5 L35.3 45.6 L30.7 32.4 Z" strokeWidth="2" />
        <path d="M86 67 Q84 78 66 78" fill="none" strokeWidth="6.5" />
        <path d="M56 78.3 L66 85 L66 71 Z" strokeWidth="2" />
      </g>
    </svg>
  );
}

// Icon + bold "Swapit" wordmark, side by side (for headers).
export function Logo({ iconSize = 30, textClass = "text-2xl" }: { iconSize?: number; textClass?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <AppIcon size={iconSize} />
      <span className={`font-extrabold tracking-tight text-navy ${textClass}`}>Swapit</span>
    </span>
  );
}
