import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tailwind CSS is processed by this loader (Next 16 + Turbopack setup).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Let next/image show photos stored in Supabase Storage.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
};

export default nextConfig;
