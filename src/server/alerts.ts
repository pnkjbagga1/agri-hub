import "server-only";
import { db } from "@/lib/db";
import { notify } from "./notify";

type Q = { q?: string; category?: string[]; region?: string[]; cert?: string[] };

/** "Notify me" alerts: tell buyers when a new listing matches one of their saved searches. */
export async function matchSavedSearches(listingId: string) {
  const l = await db.listing.findUnique({ where: { id: listingId }, include: { region: true, grower: { select: { profile: { select: { orgName: true } } } } } });
  if (!l || l.status !== "active") return;
  // alert at most once per listing (pause/resume must not re-notify)
  if (await db.activityEvent.count({ where: { type: "alerts_sent", listingId: l.id } })) return;
  await db.activityEvent.create({ data: { type: "alerts_sent", listingId: l.id, ownerId: l.growerId } });
  const searches = await db.savedSearch.findMany({ where: { alert: true, userId: { not: l.growerId } }, take: 5000 });
  const hay = `${l.title} ${l.produce} ${l.variety ?? ""} ${l.description ?? ""} ${l.grower.profile?.orgName ?? ""}`.toLowerCase();
  for (const s of searches) {
    const q = s.query as Q;
    if (q.q && !hay.includes(q.q.toLowerCase())) continue;
    if (q.category?.length && !q.category.includes(l.category)) continue;
    if (q.region?.length && !(l.region && q.region.includes(l.region.slug))) continue;
    if (q.cert?.length && !q.cert.some((c) => l.certifications.includes(c))) continue;
    await notify(s.userId, { type: "search_match", title: `New match for "${s.name}": ${l.title}`, link: `/marketplace/${l.slug}`, email: true });
    await db.savedSearch.update({ where: { id: s.id }, data: { lastNotifiedAt: new Date() } });
  }
}
