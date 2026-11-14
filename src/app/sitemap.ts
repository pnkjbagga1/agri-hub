import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

// SEO: every public listing, profile, program and event gets an indexable page.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const [listings, profiles, resources, events] = await Promise.all([
    db.listing.findMany({ where: { status: "active", approval: "approved" }, select: { slug: true, updatedAt: true }, take: 5000 }),
    db.profile.findMany({ where: { approval: "approved", photoUrl: { not: null } }, select: { slug: true, updatedAt: true }, take: 5000 }),
    db.resource.findMany({ where: { approval: "approved" }, select: { id: true, createdAt: true }, take: 2000 }),
    db.event.findMany({ where: { approval: "approved" }, select: { id: true, createdAt: true }, take: 2000 }),
  ]);
  const statics = ["", "/marketplace", "/demand", "/directory", "/buy-bc", "/resources", "/events", "/community", "/insights", "/about"].map((p) => ({ url: `${base}${p}`, changeFrequency: "daily" as const }));
  return [
    ...statics,
    ...listings.map((l) => ({ url: `${base}/marketplace/${l.slug}`, lastModified: l.updatedAt })),
    ...profiles.map((p) => ({ url: `${base}/directory/${p.slug}`, lastModified: p.updatedAt })),
    ...resources.map((r) => ({ url: `${base}/resources/${r.id}`, lastModified: r.createdAt })),
    ...events.map((e) => ({ url: `${base}/events/${e.id}`, lastModified: e.createdAt })),
  ];
}
