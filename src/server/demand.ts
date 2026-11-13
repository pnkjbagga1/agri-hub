import "server-only";
import { db } from "@/lib/db";
import { notify } from "./notify";

/** Demand matching: alert growers who list the same produce or category (once per post). */
export async function notifyDemandMatches(postId: string) {
  const d = await db.demandPost.findUnique({ where: { id: postId }, include: { buyer: { select: { profile: { select: { orgName: true } } } } } });
  if (!d || !d.isOpen) return 0;
  const already = await db.activityEvent.count({ where: { type: "demand_alerted", meta: { path: ["demandId"], equals: d.id } } });
  if (already) return 0;
  const growers = await db.listing.findMany({
    where: { status: "active", growerId: { not: d.buyerId }, OR: [{ produce: { contains: d.produce, mode: "insensitive" } }, { category: d.category }] },
    select: { growerId: true },
    distinct: ["growerId"],
    take: 200,
  });
  for (const g of growers) {
    await notify(g.growerId, { type: "demand_match", title: `Buyer demand matches your produce: ${d.title}`, body: `${d.buyer.profile?.orgName} needs ${d.quantity} ${d.unit} of ${d.produce}.`, link: `/demand/${d.id}`, email: true });
  }
  await db.activityEvent.create({ data: { type: "demand_alerted", ownerId: d.buyerId, meta: { demandId: d.id, growers: growers.length } } });
  return growers.length;
}
