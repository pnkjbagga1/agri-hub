import { db } from "@/lib/db";
import { handler, fail } from "@/server/api";

export const DELETE = handler<{ id: string }>({ auth: true }, async ({ params, user }) => {
  const doc = await db.certificationDoc.findUnique({ where: { id: params.id } });
  if (!doc || doc.profileId !== user.profile?.id) fail(404, "Not found.");
  await db.certificationDoc.delete({ where: { id: params.id } });
  return { ok: true };
});
