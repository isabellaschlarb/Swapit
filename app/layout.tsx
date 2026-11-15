import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Brand font: bold, rounded geometric sans. ExtraBold (800) for the wordmark
// and titles, regular (400) for body text.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Swapit",
  description: "Your campus closet, just a swap away.",
  // The manifest (app/manifest.ts) and apple-icon.png are linked automatically.
  // iPhone "Add to Home Screen" settings:
  appleWebApp: {
    capable: true,
    title: "Swapit",
    // "default" = dark clock/battery on a light bar, readable on our off-white pages.
    // (black-translucent would put white text over the page and under the notch.)
    statusBarStyle: "default",
  },
  // Older iPhones only read the apple- prefixed version of "open full screen".
  other: { "apple-mobile-web-app-capable": "yes" },
};

// Phone viewport settings:
//  - pinch-zoom stays ON so people with low vision can enlarge things
//    (text fields are 16px+ in globals.css, so iPhones don't auto-zoom on tap)
//  - viewportFit "cover" lets us use the full screen and pad around the
//    iPhone notch / home bar ourselves with env(safe-area-inset-*)
//  - navy browser/status bar to match the app icon
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0D1B3D",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full bg-cloud font-sans text-ink">
        <div className="flex min-h-dvh w-full min-w-0 flex-col pt-[env(safe-area-inset-top)]">{children}</div>
      </body>
    </html>
  );
}
