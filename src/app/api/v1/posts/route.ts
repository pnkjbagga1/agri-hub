import { z } from "zod";
import { db } from "@/lib/db";
import { handler, body, fail, zMedia, zOptText, zReqText } from "@/server/api";
import { assertCanAct, assertOwnedMedia } from "@/server/rules";

/** Community post in a space (Circle / Mighty Networks-style discussions). */
export const POST = handler({ auth: true, rateLimit: [15, 3600], name: "post" }, async ({ req, user }) => {
  await assertCanAct(user);
  const d = await body(req, z.object({ spaceId: z.string().max(40), title: zOptText(160), body: zReqText(8000, 2), images: z.array(zMedia).max(4).default([]) }));
  await assertOwnedMedia(d.images, [user.id]);
  const space = await db.space.findUnique({ where: { id: d.spaceId } });
  if (!space) fail(404, "Space not found.");
  if (space!.isLocked && user.role !== "admin") fail(403, "Only GRIS Canada can post in this space.");
  const p = await db.post.create({ data: { spaceId: space!.id, authorId: user.id, title: d.title, body: d.body, images: d.images } });
  return { ok: true, id: p.id };
});
