import type { MetadataRoute } from "next";

// The web app manifest: tells phones how Swapit looks and opens when it's
// installed to the home screen. Next.js serves this at /manifest.webmanifest.
// Icons are made by `node scripts/generate-icons.mjs`.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Swapit",
    short_name: "Swapit",
    description: "Your campus closet, just a swap away.",
    start_url: "/feed",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#0D1B3D",
    background_color: "#F7FAFF",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
