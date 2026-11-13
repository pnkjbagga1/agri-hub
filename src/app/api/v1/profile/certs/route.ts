import { z } from "zod";
import { db } from "@/lib/db";
import { handler, body, fail, zDate } from "@/server/api";
import { notifyAdmins } from "@/server/notify";
import { assertOwnedMedia } from "@/server/rules";

const schema = z.object({
  type: z.enum(["organic", "buy_bc", "canadagap", "haccp", "salmon_safe", "other"]),
  documentUrl: z
    .string()
    .max(500)
    .refine((u) => /^\/media\/certificate\/\d{4}\/\d{2}\/[a-z0-9-]+\.(pdf|jpg|png|webp|avif)$/.test(u) || (!!process.env.S3_PUBLIC_BASE_URL && u.startsWith(process.env.S3_PUBLIC_BASE_URL + "/certificate/") && !u.includes("..")), "Upload the document through AGRI HUB"),
  expiresAt: zDate,
});

/** Upload a certificate document for admin verification. */
export const POST = handler({ auth: true, rateLimit: [20, 3600], name: "cert" }, async ({ req, user }) => {
  if (!user.profile) fail(400, "Complete your profile first.");
  const data = await body(req, schema);
  await assertOwnedMedia([data.documentUrl], [user.id]);
  const doc = await db.certificationDoc.create({ data: { profileId: user.profile!.id, type: data.type, documentUrl: data.documentUrl, expiresAt: data.expiresAt } });
  await notifyAdmins({ type: "review_cert", title: `Certificate to verify: ${data.type} — ${user.profile!.orgName}`, link: "/admin/approvals?tab=certs" });
  return { ok: true, id: doc.id };
});
