import "server-only";
import { db } from "@/lib/db";
import { fail } from "./api";
import { notify, track } from "./notify";

/** Find (or open) the 1:1 thread between two members, scoped to a listing when given. */
export async function findOrCreateThread(a: string, b: string, listingId: string | null, subject?: string | null) {
  if (a === b) fail(422, "You can't message yourself.");
  const existing = await db.thread.findFirst({
    where: { listingId, AND: [{ participants: { some: { userId: a } } }, { participants: { some: { userId: b } } }] },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };
  const t = await db.thread.create({ data: { listingId, subject: subject ?? null, participants: { create: [{ userId: a, lastReadAt: new Date() }, { userId: b }] } } });
  return { id: t.id, created: true };
}

export async function assertParticipant(threadId: string, userId: string) {
  const p = await db.threadParticipant.findUnique({ where: { threadId_userId: { threadId, userId } } });
  if (!p) fail(404, "Conversation not found.");
  return p!;
}

export async function postMessage(threadId: string, senderId: string, body: string, kind = "text", meta?: object) {
  const msg = await db.message.create({ data: { threadId, senderId, body, kind, meta } });
  await db.thread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
  await db.threadParticipant.update({ where: { threadId_userId: { threadId, userId: senderId } }, data: { lastReadAt: new Date() } });
  const others = await db.threadParticipant.findMany({ where: { threadId, userId: { not: senderId } }, select: { userId: true } });
  const sender = await db.profile.findUnique({ where: { userId: senderId }, select: { orgName: true } });
  for (const o of others) {
    // one email per conversation burst: only email if the recipient hasn't got an unread notification for this thread
    const unread = await db.notification.count({ where: { userId: o.userId, readAt: null, type: "message", link: `/messages/${threadId}` } });
    await notify(o.userId, { type: "message", title: `New message from ${sender?.orgName ?? "a member"}`, body: body.slice(0, 140), link: `/messages/${threadId}`, email: unread === 0 && kind === "text" });
    if (kind === "text") await track("message", { userId: senderId, ownerId: o.userId });
  }
  return msg;
}

export { track };
