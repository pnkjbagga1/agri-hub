import type { MetadataRoute } from "next";
import { asset } from "@/lib/paths";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [asset("/admin"), asset("/dashboard"), asset("/messages"), asset("/api/"), asset("/settings"), asset("/notifications")] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
