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
};

// Makes the app size correctly on phones and tints the browser bar off-white.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F7FAFF",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full bg-cloud font-sans text-ink">
        {/* Phone-width column, centered on bigger screens */}
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">{children}</div>
      </body>
    </html>
  );
}
