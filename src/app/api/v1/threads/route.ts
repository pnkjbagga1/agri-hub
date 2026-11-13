import { z } from "zod";
import { db } from "@/lib/db";
import { handler, body, fail, zReqText } from "@/server/api";
import { assertCanAct } from "@/server/rules";
import { findOrCreateThread, postMessage, track } from "@/server/threads";

const schema = z.object({ recipientId: z.string().max(40), listingId: z.string().max(40).optional().nullable(), body: zReqText(4000), subject: z.string().max(160).optional() });

/** Start (or continue) a conversation with another member. */
export const POST = handler({ auth: true, rateLimit: [30, 600], name: "thread-start" }, async ({ req, user }) => {
  await assertCanAct(user, { messaging: true });
  const data = await body(req, schema);
  const recipient = await db.user.findUnique({ where: { id: data.recipientId }, include: { profile: { select: { isClaimed: true } } } });
  if (!recipient || recipient.status !== "active") fail(404, "That member isn't available.");
  if (recipient!.profile && !recipient!.profile.isClaimed) fail(422, "This organisation hasn't claimed its profile yet, so it can't receive messages. Use the website link on their profile.");
  let listingId: string | null = null;
  if (data.listingId) {
    const l = await db.listing.findUnique({ where: { id: data.listingId }, select: { id: true, growerId: true, title: true } });
    if (!l || l.growerId !== recipient!.id) fail(422, "Listing doesn't belong to this member.");
    listingId = l!.id;
    data.subject ??= l!.title;
  }
  const t = await findOrCreateThread(user.id, recipient!.id, listingId, data.subject);
  await postMessage(t.id, user.id, data.body);
  if (t.created) await track("inquiry", { userId: user.id, listingId: listingId ?? undefined, ownerId: recipient!.id });
  return { ok: true, threadId: t.id };
});
