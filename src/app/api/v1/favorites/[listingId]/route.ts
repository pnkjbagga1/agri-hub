import { db } from "@/lib/db";
import { handler, fail } from "@/server/api";

export const POST = handler<{ listingId: string }>({ auth: true, rateLimit: [120, 60], name: "fav" }, async ({ params, user }) => {
  if (!(await db.listing.findUnique({ where: { id: params.listingId } }))) fail(404, "Listing not found.");
  await db.favorite.upsert({ where: { userId_listingId: { userId: user.id, listingId: params.listingId } }, create: { userId: user.id, listingId: params.listingId }, update: {} });
  return { saved: true };
});

export const DELETE = handler<{ listingId: string }>({ auth: true }, async ({ params, user }) => {
  await db.favorite.deleteMany({ where: { userId: user.id, listingId: params.listingId } });
  return { saved: false };
});
