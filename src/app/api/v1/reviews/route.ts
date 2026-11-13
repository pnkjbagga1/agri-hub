import { z } from "zod";
import { db } from "@/lib/db";
import { handler, body, fail, zOptText } from "@/server/api";
import { assertCanAct } from "@/server/rules";
import { notify } from "@/server/notify";

/**
 * Reviews are only allowed between members who have actually done business:
 * they must share a conversation and at least one RFQ. This blocks fake reviews.
 */
export const POST = handler({ auth: true, rateLimit: [10, 3600], name: "review" }, async ({ req, user }) => {
  await assertCanAct(user);
  const d = await body(req, z.object({ subjectId: z.string().max(40), rating: z.coerce.number().int().min(1).max(5), body: zOptText(2000) }));
  if (d.subjectId === user.id) fail(422, "You can't review yourself.");
  const traded = await db.rfq.count({ where: { OR: [{ buyerId: user.id, growerId: d.subjectId }, { buyerId: d.subjectId, growerId: user.id }] } });
  if (!traded) fail(403, "You can review members after you've exchanged an RFQ with them.");
  const r = await db.review.upsert({
    where: { authorId_subjectId: { authorId: user.id, subjectId: d.subjectId } },
    create: { authorId: user.id, subjectId: d.subjectId, rating: d.rating, body: d.body },
    update: { rating: d.rating, body: d.body, isHidden: false },
  });
  const p = await db.profile.findUnique({ where: { userId: d.subjectId }, select: { slug: true } });
  await notify(d.subjectId, { type: "review", title: `${user.profile?.orgName} left you a ${d.rating}★ review`, link: `/directory/${p?.slug}` });
  return { ok: true, id: r.id };
});
