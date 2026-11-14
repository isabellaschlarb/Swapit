import type { NextConfig } from "next";

// Tailwind CSS is set up in postcss.config.mjs.
const nextConfig: NextConfig = {
  // Let next/image show photos stored in Supabase Storage.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
};

export default nextConfig;
