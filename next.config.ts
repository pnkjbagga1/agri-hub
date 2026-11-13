import type { NextConfig } from "next";

// AGRI HUB is almost entirely per-request, database-driven and session-aware,
// so it uses the classic dynamic rendering model instead of Cache Components.
const nextConfig: NextConfig = {
  // Set NEXT_PUBLIC_BASE_PATH=/hub to serve AGRI HUB at griscanada.org/hub
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  cacheComponents: false,
  serverExternalPackages: ["pg"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
