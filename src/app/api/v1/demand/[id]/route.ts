import { z } from "zod";
import { db } from "@/lib/db";
import { handler, body, fail, zReqText } from "@/server/api";
import { assertCanAct } from "@/server/rules";
import { findOrCreateThread, postMessage, track } from "@/server/threads";
import { getSettings } from "@/server/settings";

/** Buyer closes/reopens their post. */
export const PATCH = handler<{ id: string }>({ auth: true }, async ({ req, params, user }) => {
  const post = await db.demandPost.findUnique({ where: { id: params.id } });
  if (!post || (post.buyerId !== user.id && user.role !== "admin")) fail(404, "Not found.");
  const { isOpen } = await body(req, z.object({ isOpen: z.boolean() }));
  await db.demandPost.update({ where: { id: params.id }, data: { isOpen } });
  return { ok: true };
});

/** Grower offers to supply → opens a conversation with the buyer. */
export const POST = handler<{ id: string }>({ auth: ["grower", "supplier", "dealer"], rateLimit: [20, 3600], name: "demand-offer" }, async ({ req, params, user }) => {
  await assertCanAct(user, { messaging: true });
  const post = await db.demandPost.findUnique({ where: { id: params.id } });
  const settings = await getSettings();
  if (!post || !post.isOpen || post.approval === "rejected" || (settings.moderation === "pre" && post.approval !== "approved")) fail(404, "This demand post is closed.");
  const { message } = await body(req, z.object({ message: zReqText(3000, 5) }));
  const t = await findOrCreateThread(user.id, post!.buyerId, null, `Offer: ${post!.title}`);
  await postMessage(t.id, user.id, `Offer to supply “${post!.title}”: ${message}`, "text", { demandId: post!.id });
  await track("inquiry", { userId: user.id, ownerId: post!.buyerId, meta: { demandId: post!.id } });
  return { ok: true, threadId: t.id };
});
