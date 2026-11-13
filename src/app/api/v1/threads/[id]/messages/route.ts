import { z } from "zod";
import { db } from "@/lib/db";
import { handler, body, fail, zReqText } from "@/server/api";
import { assertCanAct } from "@/server/rules";
import { assertParticipant, postMessage } from "@/server/threads";

/** Poll for messages (after= ISO timestamp) and mark the thread read. */
export const GET = handler<{ id: string }>({ auth: true, rateLimit: [240, 60], name: "msg-poll" }, async ({ req, params, user }) => {
  await assertParticipant(params.id, user.id);
  const afterRaw = req.nextUrl.searchParams.get("after");
  const after = afterRaw ? new Date(afterRaw) : null;
  if (after && Number.isNaN(after.getTime())) fail(422, "Invalid 'after' timestamp.");
  const messages = await db.message.findMany({
    where: { threadId: params.id, ...(after ? { createdAt: { gt: after } } : {}) },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { id: true, body: true, kind: true, meta: true, createdAt: true, senderId: true },
  });
  await db.threadParticipant.update({ where: { threadId_userId: { threadId: params.id, userId: user.id } }, data: { lastReadAt: new Date() } });
  await db.notification.updateMany({ where: { userId: user.id, readAt: null, link: `/messages/${params.id}` }, data: { readAt: new Date() } });
  const other = await db.threadParticipant.findFirst({ where: { threadId: params.id, userId: { not: user.id } }, select: { lastReadAt: true } });
  return { messages, otherLastReadAt: other?.lastReadAt ?? null };
});

export const POST = handler<{ id: string }>({ auth: true, rateLimit: [60, 60], name: "msg-send" }, async ({ req, params, user }) => {
  await assertParticipant(params.id, user.id);
  await assertCanAct(user, { messaging: true });
  const { body: text } = await body(req, z.object({ body: zReqText(4000) }));
  const msg = await postMessage(params.id, user.id, text);
  return { ok: true, message: { id: msg.id, body: msg.body, kind: msg.kind, meta: msg.meta, createdAt: msg.createdAt, senderId: msg.senderId } };
});
