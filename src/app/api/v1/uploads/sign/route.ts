import { z } from "zod";
import { db } from "@/lib/db";
import { handler, body, fail } from "@/server/api";
import { DOC_TYPES, IMAGE_TYPES, MAX_DOC_BYTES, MAX_IMAGE_BYTES, makeKey, signUpload } from "@/server/storage";

const schema = z.object({
  kind: z.enum(["avatar", "cover", "listing", "post", "event", "certificate"]),
  contentType: z.string().max(60),
  size: z.number().int().positive(),
});

/** Step 1 of an upload: ask for a short-lived signed URL, then PUT the file to it directly. */
export const POST = handler({ auth: true, rateLimit: [60, 600], name: "upload-sign" }, async ({ req, user }) => {
  const data = await body(req, schema);
  const isDoc = data.kind === "certificate";
  const allowed: readonly string[] = isDoc ? DOC_TYPES : IMAGE_TYPES;
  if (!allowed.includes(data.contentType)) fail(415, isDoc ? "Upload a PDF, JPG, PNG or WebP file." : "Upload a JPG, PNG, WebP or AVIF image.");
  const max = isDoc ? MAX_DOC_BYTES : MAX_IMAGE_BYTES;
  if (data.size > max) fail(413, `File is too large (max ${Math.round(max / 1024 / 1024)} MB).`);
  const key = makeKey(user.id, data.kind, data.contentType);
  const signed = await signUpload(key, data.contentType, data.size);
  await db.upload.create({ data: { key, ownerId: user.id, contentType: data.contentType, size: data.size } });
  return { ...signed, key };
});
