import { db } from "@/lib/db";
import { handler, fail } from "@/server/api";
import { notify } from "@/server/notify";

/** Toggle RSVP. Capacity is enforced inside a transaction with a per-event lock (no overbooking). */
export const POST = handler<{ id: string }>({ auth: true, rateLimit: [60, 600], name: "rsvp" }, async ({ params, user }) => {
  const e = await db.event.findUnique({ where: { id: params.id }, include: { host: { select: { userId: true } } } });
  if (!e) fail(404, "Event not found.");
  const result = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"rsvp:" + e!.id}))`;
    const count = await tx.eventRsvp.count({ where: { eventId: e!.id } });
    const mine = await tx.eventRsvp.findUnique({ where: { eventId_userId: { eventId: e!.id, userId: user.id } } });
    if (mine) {
      await tx.eventRsvp.delete({ where: { eventId_userId: { eventId: e!.id, userId: user.id } } });
      return { going: false, count: count - 1 };
    }
    if (e!.approval !== "approved") fail(404, "Event not found.");
    if (e!.startsAt < new Date()) fail(409, "This event has already started.");
    if (e!.capacity && count >= e!.capacity) fail(409, "Sorry — this event is full.");
    await tx.eventRsvp.create({ data: { eventId: e!.id, userId: user.id } });
    return { going: true, count: count + 1 };
  });
  if (result.going && e!.host) await notify(e!.host.userId, { type: "rsvp", title: `${user.profile?.orgName ?? "A member"} is attending ${e!.title}`, link: `/events/${e!.id}` });
  return result;
});

export const DELETE = handler<{ id: string }>({ auth: true }, async ({ params, user }) => {
  const e = await db.event.findUnique({ where: { id: params.id }, include: { host: { select: { userId: true } } } });
  if (!e || (e.host?.userId !== user.id && user.role !== "admin")) fail(404, "Not found.");
  await db.event.delete({ where: { id: params.id } });
  return { ok: true };
});
