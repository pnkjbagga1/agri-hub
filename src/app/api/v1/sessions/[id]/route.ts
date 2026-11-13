import { db } from "@/lib/db";
import { handler, fail } from "@/server/api";
import { audit } from "@/server/notify";

/** Sign out one of my devices. */
export const DELETE = handler<{ id: string }>({ auth: true }, async ({ params, user }) => {
  const r = await db.session.updateMany({ where: { id: params.id, userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (!r.count) fail(404, "Session not found.");
  await audit(user.id, "session.revoke", "session", params.id);
  return { ok: true, current: params.id === user.sessionId };
});
