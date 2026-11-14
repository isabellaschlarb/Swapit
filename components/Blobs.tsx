// Soft pale-blue wavy shapes in the corners (welcome + login screens).
// Purely decorative, so screen readers skip them.
export function Blobs() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg viewBox="0 0 200 200" className="absolute -left-24 -top-24 h-80 w-80 text-pale">
        <path
          fill="currentColor"
          d="M44.6,-58.3C56.8,-47.6,64.4,-31.9,69.1,-14.8C73.8,2.3,75.6,20.8,68.2,34.7C60.8,48.6,44.2,57.9,27.1,64.6C10,71.3,-7.6,75.4,-24.6,71.3C-41.6,67.2,-58,54.9,-67.4,38.7C-76.8,22.5,-79.2,2.4,-73.4,-14.6C-67.6,-31.6,-53.6,-45.5,-38.3,-55.6C-23,-65.7,-6.4,-72,9.7,-73.5C25.8,-75,32.4,-69,44.6,-58.3Z"
          transform="translate(100 100)"
        />
      </svg>
      <svg viewBox="0 0 200 200" className="absolute -bottom-28 -right-24 h-96 w-96 text-pale">
        <path
          fill="currentColor"
          d="M39.4,-51.6C51.2,-44.4,61,-32.6,66.3,-18.4C71.6,-4.2,72.4,12.4,65.9,25.3C59.4,38.2,45.6,47.4,31.2,55.4C16.8,63.4,1.8,70.2,-14.6,69.6C-31,69,-48.8,61,-59.4,47.5C-70,34,-73.4,15,-70.6,-2.4C-67.8,-19.8,-58.8,-35.6,-46.3,-43C-33.8,-50.4,-17.9,-49.4,-2.3,-46.6C13.3,-43.8,27.6,-58.8,39.4,-51.6Z"
          transform="translate(100 100)"
        />
      </svg>
    </div>
  );
}
