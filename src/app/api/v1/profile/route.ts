import { z } from "zod";
import { db } from "@/lib/db";
import { handler, body, zMedia, zOptText, zReqText, zUrl } from "@/server/api";
import { BUYER_TYPES, CERTIFICATIONS } from "@/lib/constants";
import { assertOwnedMedia } from "@/server/rules";

const schema = z.object({
  orgName: zReqText(120, 2),
  contactName: zOptText(80),
  tagline: zOptText(160),
  bio: zOptText(4000),
  photoUrl: zMedia,
  coverUrl: zMedia.optional().nullable(),
  website: zUrl,
  publicEmail: z
    .string()
    .trim()
    .max(160)
    .optional()
    .nullable()
    .transform((v) => v || null)
    .refine((v) => v === null || z.string().email().safeParse(v).success, "Enter a valid email"),
  publicPhone: zOptText(30),
  address: zOptText(200),
  city: zOptText(80),
  regionId: zOptText(40),
  certifications: z.array(z.enum(CERTIFICATIONS.map((c) => c.key) as [string, ...string[]])).max(10).default([]),
  specialties: z.array(z.string().trim().toLowerCase().max(40)).max(15).default([]),
  buyerType: z.enum(BUYER_TYPES.map((b) => b.key) as [string, ...string[]]).optional().nullable(),
  farmSizeAcres: z.coerce.number().min(0).max(1e6).optional().nullable(),
  phone: zOptText(30),
});

/** Update the signed-in member's profile (the photo/logo is required). */
export const PUT = handler({ auth: true, rateLimit: [60, 3600], name: "profile" }, async ({ req, user }) => {
  const data = await body(req, schema);
  await assertOwnedMedia([data.photoUrl, data.coverUrl], [user.id]);
  const region = data.regionId ? await db.region.findUnique({ where: { id: data.regionId } }) : null;
  const { phone, ...profile } = data;
  const fields = {
    ...profile,
    coverUrl: profile.coverUrl ?? null,
    regionId: region?.id ?? null,
    ...(region && user.profile?.regionId !== region.id ? { lat: region.lat, lng: region.lng } : {}),
    buyerType: user.role === "buyer" ? (profile.buyerType ?? null) : null,
  };
  if (user.profile) {
    await db.profile.update({ where: { id: user.profile.id }, data: fields });
    // certifications auto-attach to the grower's current listings
    await db.listing.updateMany({ where: { growerId: user.id, status: { in: ["active", "paused", "draft"] } }, data: { certifications: fields.certifications } });
  }
  await db.user.update({ where: { id: user.id }, data: { phone } });
  return { ok: true, slug: user.profile?.slug };
});
