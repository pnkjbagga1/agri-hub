import { z } from "zod";
import { db } from "@/lib/db";
import { handler, body, fail } from "@/server/api";

/** Partner updates a lead's status. */
export const PATCH = handler<{ id: string }>({ auth: true }, async ({ req, params, user }) => {
  const i = await db.resourceInterest.findUnique({ where: { id: params.id }, include: { resource: { select: { profileId: true } } } });
  if (!i || i.resource.profileId !== user.profile?.id) fail(404, "Not found.");
  const { status } = await body(req, z.object({ status: z.enum(["new", "contacted", "closed"]) }));
  await db.resourceInterest.update({ where: { id: params.id }, data: { status } });
  return { ok: true };
});
