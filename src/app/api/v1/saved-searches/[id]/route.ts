import { db } from "@/lib/db";
import { handler } from "@/server/api";

export const DELETE = handler<{ id: string }>({ auth: true }, async ({ params, user }) => {
  await db.savedSearch.deleteMany({ where: { id: params.id, userId: user.id } });
  return { ok: true };
});
