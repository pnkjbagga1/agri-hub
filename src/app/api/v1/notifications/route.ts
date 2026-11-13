import { z } from "zod";
import { db } from "@/lib/db";
import { handler, body } from "@/server/api";

export const GET = handler({ auth: true, rateLimit: [120, 60], name: "notif-get" }, async ({ user }) => {
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });
  return { items, unread: items.filter((i) => !i.readAt).length };
});

/** Mark some or all notifications read. */
export const POST = handler({ auth: true }, async ({ req, user }) => {
  const d = await body(req, z.object({ ids: z.array(z.string().max(40)).max(200).optional(), all: z.boolean().optional() }));
  await db.notification.updateMany({ where: { userId: user.id, readAt: null, ...(d.all ? {} : { id: { in: d.ids ?? [] } }) }, data: { readAt: new Date() } });
  return { ok: true };
});
